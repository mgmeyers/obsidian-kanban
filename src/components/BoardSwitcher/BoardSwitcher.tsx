import classcat from 'classcat';
import { TFile } from 'obsidian';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/compat';
import { KanbanView } from 'src/KanbanView';
import { DndManagerContext } from 'src/dnd/components/context';
import { DragEventData } from 'src/dnd/managers/DragManager';
import { getBoardLabel, getKanbanFiles } from 'src/helpers/crossBoard';

import { c } from '../helpers';

interface BoardTile {
  file: TFile;
  label: string;
}

interface BoardSwitcherProps {
  view: KanbanView;
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

function contains(rect: DOMRect, x: number, y: number) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function BoardSwitcher({ view }: BoardSwitcherProps) {
  const [tiles, setTiles] = useState<BoardTile[]>([]);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPath, setHoverPath] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const tileRefs = useRef<Map<string, HTMLElement>>(new Map());
  const dndManager = useContext(DndManagerContext);

  const currentFilePath = view.file?.path;

  const refreshTiles = useCallback(() => {
    setTiles(
      getKanbanFiles(view.app).map((file) => ({ file, label: getBoardLabel(view.plugin, file) }))
    );
  }, [view]);

  useEffect(() => {
    refreshTiles();
    view.app.metadataCache.on('resolved', refreshTiles);
    return () => {
      view.app.metadataCache.off('resolved', refreshTiles);
    };
  }, [view, refreshTiles]);

  useEffect(() => {
    if (editingPath && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingPath]);

  // DnD: hold a dragged card over a tile and the leaf switches to that
  // board. The drag goes on; the card is dropped on the new board like any
  // other card. The source board's state is kept on the plugin so the drop
  // can still remove the card from it.
  useEffect(() => {
    if (!dndManager) return;
    const emitter = dndManager.dragManager.emitter;
    const win = view.getWindow();
    let hovered: string | null = null;
    let timer = 0;

    const switchBoard = (targetPath: string) => {
      const entity = dndManager.dragManager.dragEntity;
      if (entity?.getData().type !== 'item') return;

      const [, sourcePath] = entity.scopeId.split(':::');
      const sourceFile = view.app.vault.getAbstractFileByPath(sourcePath);
      const targetFile = view.app.vault.getAbstractFileByPath(targetPath);
      if (!(sourceFile instanceof TFile) || !(targetFile instanceof TFile)) return;

      const stateManager = view.plugin.stateManagers.get(sourceFile);
      if (!stateManager) return;

      view.plugin.dragSource = { file: sourceFile, stateManager };
      view.leaf.openFile(targetFile);
    };

    const setHover = (path: string | null) => {
      if (path === hovered) return;
      hovered = path;
      setHoverPath(path);
      win.clearTimeout(timer);
      if (path) timer = win.setTimeout(() => switchBoard(path), 300);
    };

    const onDragStart = () => {
      view.plugin.dragSource = null;
      setIsDragging(true);
      setHover(null);
    };

    const onDragMove = ({ dragPosition, dragEntity }: DragEventData) => {
      if (!dragPosition || dragEntity?.getData().type !== 'item') return;
      const { x, y } = dragPosition;
      for (const [path, el] of tileRefs.current) {
        if (path !== currentFilePath && contains(el.getBoundingClientRect(), x, y)) {
          return setHover(path);
        }
      }
      setHover(null);
    };

    const onDragEnd = () => {
      setIsDragging(false);
      setHover(null);
    };

    emitter.on('dragStart', onDragStart);
    emitter.on('dragMove', onDragMove);
    emitter.on('dragEnd', onDragEnd);

    return () => {
      emitter.off('dragStart', onDragStart);
      emitter.off('dragMove', onDragMove);
      emitter.off('dragEnd', onDragEnd);
      win.clearTimeout(timer);
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
        <div className={c('board-switcher-footer')}>
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
      </div>
    );
  }

  return (
    <div className={c('board-switcher')}>
      <div className={c('board-switcher-tiles')}>
        {tiles.map((tile) => {
          const isActive = tile.file.path === currentFilePath;
          const isEditing = editingPath === tile.file.path;
          const isDropTarget = hoverPath === tile.file.path;

          return (
            <div
              key={tile.file.path}
              ref={(el) => setTileRef(tile.file.path, el)}
              className={classcat([
                c('board-switcher-tile'),
                { [c('board-switcher-tile-active')]: isActive },
                { [c('board-switcher-tile-drop')]: isDropTarget },
              ])}
              onClick={() => handleTileClick(tile.file)}
              // eslint-disable-next-line react/no-unknown-property
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
      <div className={c('board-switcher-footer')}>
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
    </div>
  );
}
