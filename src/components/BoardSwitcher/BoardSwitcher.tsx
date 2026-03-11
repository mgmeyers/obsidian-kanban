import { TFile } from 'obsidian';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/compat';
import { KanbanView } from 'src/KanbanView';
import { DndManagerContext } from 'src/dnd/components/context';
import { DragEventData } from 'src/dnd/managers/DragManager';
import { getEntityFromPath, removeEntity } from 'src/dnd/util/data';
import { frontmatterKey } from 'src/parsers/common';

import { c } from '../helpers';
import { Item } from '../types';

interface BoardTile {
  file: TFile;
  label: string;
}

interface BoardSwitcherProps {
  view: KanbanView;
}

function getAllKanbanFiles(view: KanbanView): TFile[] {
  const app = view.app;
  const files = app.vault.getMarkdownFiles();
  return files.filter((f) => {
    const cache = app.metadataCache.getFileCache(f);
    return cache?.frontmatter && cache.frontmatter[frontmatterKey];
  });
}

function getStoredLabels(view: KanbanView): Record<string, string> {
  return view.plugin?.settings?.['board-switcher-labels'] || {};
}

function saveLabel(view: KanbanView, filePath: string, label: string) {
  const plugin = view.plugin;
  if (!plugin) return;
  if (!plugin.settings['board-switcher-labels']) {
    plugin.settings['board-switcher-labels'] = {};
  }
  plugin.settings['board-switcher-labels'][filePath] = label;
  plugin.saveSettings();
}

export function BoardSwitcher({ view }: BoardSwitcherProps) {
  const [tiles, setTiles] = useState<BoardTile[]>([]);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTilePath, setHoverTilePath] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const tileRefs = useRef<Map<string, HTMLElement>>(new Map());
  const dndManager = useContext(DndManagerContext);

  // Transfer state tracked via ref so dragEnd callback always sees latest
  const pendingTargetRef = useRef<string | null>(null);
  const dragEntityRef = useRef<DragEventData | null>(null);

  const currentFilePath = view.file?.path;

  const refreshTiles = useCallback(() => {
    const files = getAllKanbanFiles(view);
    const labels = getStoredLabels(view);
    const newTiles = files
      .sort((a, b) => a.basename.localeCompare(b.basename))
      .map((f) => ({
        file: f,
        label: labels[f.path] || f.basename,
      }));
    setTiles(newTiles);
  }, [view]);

  useEffect(() => {
    refreshTiles();
    const onModify = () => refreshTiles();
    view.app.metadataCache.on('resolved', onModify);
    return () => {
      view.app.metadataCache.off('resolved', onModify);
    };
  }, [view, refreshTiles]);

  useEffect(() => {
    if (editingPath && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingPath]);

  // DnD: hover over a tile while dragging → switch board after delay
  useEffect(() => {
    if (!dndManager) return;

    const emitter = dndManager.dragManager.emitter;
    let lastHoveredPath: string | null = null;
    let hoverTimer = 0;
    const win = view.getWindow();

    const doTransfer = (targetPath: string, dragEntity: DragEventData['dragEntity']) => {
      if (!dragEntity) return;

      const dragData = dragEntity.getData();
      if (dragData.type !== 'item') return;

      const [, sourceFilePath] = dragEntity.scopeId.split(':::');
      const sourceFile = view.app.vault.getAbstractFileByPath(sourceFilePath);
      if (!sourceFile || !(sourceFile instanceof TFile)) return;

      const sourceStateManager = view.plugin.stateManagers.get(sourceFile);
      if (!sourceStateManager) return;

      const dragPathArr = dragEntity.getPath();
      const item = getEntityFromPath(sourceStateManager.state, dragPathArr) as Item;
      if (!item || item.type !== 'item') return;

      // Store transfer data including current mouse position
      const mousePos = dndManager.dragManager.dragPosition;
      view.plugin.pendingTransfer = {
        itemTitleRaw: item.data.titleRaw,
        itemCheckChar: item.data.checkChar,
        itemChecked: item.data.checked,
        sourceFilePath: sourceFilePath,
        returnFilePath: currentFilePath,
        mouseX: mousePos?.x ?? 0,
        mouseY: mousePos?.y ?? 0,
        dragPath: [...dragPathArr],
      };

      // Cancel the active drag cleanly: clear primaryIntersection so no drop
      // occurs, then call dragEnd which emits the event with remaining state
      // intact so the SortManager takes the normal cleanup path
      const dm = dndManager.dragManager;
      dm.primaryIntersection = undefined;
      dm.scrollIntersection = undefined;
      dm.dragEnd(new PointerEvent('pointerup'));

      // Open target board - remove view first so the old StateManager
      // is properly cleaned up, then open the file which re-adds the view
      const targetFile = view.app.vault.getAbstractFileByPath(targetPath);
      if (targetFile && targetFile instanceof TFile) {
        win.setTimeout(() => {
          view.plugin.removeView(view);
          view.leaf.openFile(targetFile);
        }, 50);
      }
    };

    const onDragStart = () => {
      setIsDragging(true);
      lastHoveredPath = null;
    };

    const onDragMove = (data: DragEventData) => {
      if (!data.dragPosition) return;
      const { x, y } = data.dragPosition;

      let found: string | null = null;
      tileRefs.current.forEach((el, path) => {
        if (path === currentFilePath) return;
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          found = path;
        }
      });

      setHoverTilePath(found);

      if (found !== lastHoveredPath) {
        win.clearTimeout(hoverTimer);
        lastHoveredPath = found;

        if (found && data.dragEntity) {
          const target = found;
          const entity = data.dragEntity;
          hoverTimer = win.setTimeout(() => {
            doTransfer(target, entity);
          }, 400);
        }
      }
    };

    const onDragEnd = () => {
      win.clearTimeout(hoverTimer);
      lastHoveredPath = null;
      setIsDragging(false);
      setHoverTilePath(null);
    };

    emitter.on('dragStart', onDragStart);
    emitter.on('dragMove', onDragMove);
    emitter.on('dragEnd', onDragEnd);

    return () => {
      emitter.off('dragStart', onDragStart);
      emitter.off('dragMove', onDragMove);
      emitter.off('dragEnd', onDragEnd);
      win.clearTimeout(hoverTimer);
    };
  }, [dndManager, view, currentFilePath]);

  const handleTileClick = useCallback(
    (file: TFile) => {
      if (isDragging) return;
      if (file.path === currentFilePath) return;
      view.leaf.openFile(file);
    },
    [view, currentFilePath, isDragging]
  );

  const handleDblClick = useCallback((tile: BoardTile, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingPath(tile.file.path);
    setEditValue(tile.label);
  }, []);

  const commitRename = useCallback(
    (filePath: string) => {
      const trimmed = editValue.trim();
      if (trimmed) {
        saveLabel(view, filePath, trimmed);
        refreshTiles();
      }
      setEditingPath(null);
    },
    [editValue, view, refreshTiles]
  );

  const setTileRef = useCallback((path: string, el: HTMLElement | null) => {
    if (el) {
      tileRefs.current.set(path, el);
    } else {
      tileRefs.current.delete(path);
    }
  }, []);

  if (collapsed) {
    return (
      <div className={c('board-switcher-collapsed')}>
        <button
          className={c('board-switcher-toggle')}
          onClick={() => setCollapsed(false)}
          aria-label="Expand board switcher"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M6 3l5 5-5 5V3z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={c('board-switcher')}>
      <div className={c('board-switcher-header')}>
        <button
          className={c('board-switcher-toggle')}
          onClick={() => setCollapsed(true)}
          aria-label="Collapse board switcher"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M10 3l-5 5 5 5V3z" />
          </svg>
        </button>
      </div>
      <div className={c('board-switcher-tiles')}>
        {tiles.map((tile) => {
          const isActive = tile.file.path === currentFilePath;
          const isEditing = editingPath === tile.file.path;
          const isDropTarget =
            isDragging && hoverTilePath === tile.file.path && tile.file.path !== currentFilePath;

          return (
            <div
              key={tile.file.path}
              ref={(el) => setTileRef(tile.file.path, el)}
              className={`${c('board-switcher-tile')} ${isActive ? c('board-switcher-tile-active') : ''} ${isDropTarget ? c('board-switcher-tile-drop') : ''}`}
              onClick={() => handleTileClick(tile.file)}
              onDblClick={(e) => handleDblClick(tile, e)}
              title={tile.file.path}
            >
              {isEditing ? (
                <input
                  ref={editRef}
                  className={c('board-switcher-tile-input')}
                  value={editValue}
                  onInput={(e) => setEditValue((e.target as HTMLInputElement).value)}
                  onBlur={() => commitRename(tile.file.path)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(tile.file.path);
                    if (e.key === 'Escape') setEditingPath(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className={c('board-switcher-tile-label')}>{tile.label}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
