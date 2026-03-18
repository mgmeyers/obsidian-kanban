import { MarkdownRenderer as ObsidianMarkdownRenderer, TFile } from 'obsidian';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/compat';
import { t } from 'src/lang/helpers';

import { Icon } from './Icon/Icon';
import { KanbanContext } from './context';
import { c } from './helpers';

interface SidePanelProps {
  file: TFile;
  onClose: () => void;
}

export function SidePanel({ file, onClose }: SidePanelProps) {
  const { stateManager } = useContext(KanbanContext);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadContent = useCallback(async () => {
    const text = await stateManager.app.vault.read(file);
    setContent(text);
  }, [file, stateManager]);

  useEffect(() => {
    loadContent();
  }, [file]);

  // Render markdown preview
  useEffect(() => {
    if (!contentRef.current || isEditing) return;
    const el = contentRef.current;
    el.empty();

    // Strip frontmatter for display
    const displayContent = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
    ObsidianMarkdownRenderer.renderMarkdown(
      displayContent,
      el,
      file.path,
      null
    );
  }, [content, isEditing, file]);

  const handleSave = useCallback(async () => {
    if (textareaRef.current) {
      await stateManager.app.vault.modify(file, textareaRef.current.value);
      setContent(textareaRef.current.value);
    }
    setIsEditing(false);
  }, [file, stateManager]);

  const handleOpenInTab = useCallback(() => {
    const leaf = stateManager.app.workspace.getLeaf('tab');
    leaf.openFile(file);
    onClose();
  }, [file, stateManager, onClose]);

  return (
    <div className={c('side-panel')}>
      <div className={c('side-panel-header')}>
        <span className={c('side-panel-title')}>{file.basename}</span>
        <div className={c('side-panel-actions')}>
          <a
            className={`${c('side-panel-action')} clickable-icon`}
            onClick={() => {
              if (isEditing) {
                handleSave();
              } else {
                setIsEditing(true);
                setTimeout(() => textareaRef.current?.focus(), 50);
              }
            }}
            aria-label={isEditing ? t('Save') : t('Edit card')}
          >
            <Icon name={isEditing ? 'lucide-check' : 'lucide-edit'} />
          </a>
          <a
            className={`${c('side-panel-action')} clickable-icon`}
            onClick={handleOpenInTab}
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
      <div className={c('side-panel-content')}>
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className={c('side-panel-editor')}
            value={content}
            onInput={(e) => setContent((e.target as HTMLTextAreaElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                loadContent();
                setIsEditing(false);
              }
              if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
        ) : (
          <div ref={contentRef} className={`${c('side-panel-preview')} markdown-preview-view`} />
        )}
      </div>
    </div>
  );
}
