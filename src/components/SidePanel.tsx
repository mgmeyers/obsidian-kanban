import { TFile, WorkspaceLeaf } from 'obsidian';
import { useContext, useEffect, useRef } from 'preact/compat';
import { t } from 'src/lang/helpers';

import { Icon } from './Icon/Icon';
import { KanbanContext } from './context';
import { c } from './helpers';

interface SidePanelProps {
  file: TFile;
  onClose: () => void;
}

// Track all active side panel leaves globally for cleanup
const activeSidePanelLeaves = new Set<WorkspaceLeaf>();

export function cleanupSidePanelLeaves() {
  activeSidePanelLeaves.forEach((leaf) => leaf.detach());
  activeSidePanelLeaves.clear();
}

export function SidePanel({ file, onClose }: SidePanelProps) {
  const { stateManager } = useContext(KanbanContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<WorkspaceLeaf | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const leaf = stateManager.app.workspace.createLeafInParent(
      stateManager.app.workspace.rootSplit,
      0
    );

    // Remove from workspace tree so it won't be serialized,
    // but keep the DOM element alive in our container
    const parentChildren = (leaf as any).parentSplit?.children;
    if (parentChildren) {
      const idx = parentChildren.indexOf(leaf);
      if (idx >= 0) parentChildren.splice(idx, 1);
    }

    containerRef.current.empty();
    containerRef.current.appendChild(leaf.containerEl);
    leaf.containerEl.style.width = '100%';
    leaf.containerEl.style.height = '100%';

    leaf.openFile(file);
    leafRef.current = leaf;
    activeSidePanelLeaves.add(leaf);

    const onMetadataChange = (changedFile: TFile) => {
      if (changedFile.path === file.path) {
        stateManager.forceRefresh();
      }
    };
    stateManager.app.metadataCache.on('changed', onMetadataChange);

    return () => {
      stateManager.app.metadataCache.off('changed', onMetadataChange);
      activeSidePanelLeaves.delete(leaf);
      leaf.detach();
      leafRef.current = null;
    };
  }, [file, stateManager]);

  // Resize handle
  const panelRef = useRef<HTMLDivElement>(null);
  const handleMouseDown = useRef((e: MouseEvent) => {
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const startX = e.clientX;
    const startWidth = panel.offsetWidth;
    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(250, startWidth + (startX - e.clientX));
      panel.style.width = `${newWidth}px`;
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }).current;

  return (
    <div ref={panelRef} className={c('side-panel')}>
      <div className={c('side-panel-resize')} onMouseDown={handleMouseDown} />
      <div className={c('side-panel-header')}>
        <span className={c('side-panel-title')}>{file.basename}</span>
        <div className={c('side-panel-actions')}>
          <a
            className={`${c('side-panel-action')} clickable-icon`}
            onClick={() => {
              const leaf = stateManager.app.workspace.getLeaf('tab');
              leaf.openFile(file);
              onClose();
            }}
            aria-label="Open in new tab"
          >
            <Icon name="lucide-external-link" />
          </a>
          <a
            className={`${c('side-panel-action')} clickable-icon`}
            onClick={onClose}
            aria-label={t('Cancel')}
          >
            <Icon name="lucide-x" />
          </a>
        </div>
      </div>
      <div ref={containerRef} className={c('side-panel-content')} />
    </div>
  );
}
