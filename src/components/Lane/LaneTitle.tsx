import { getLinkpath } from 'obsidian';
import Preact from 'preact/compat';

import { KanbanContext } from '../context';
import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { c } from '../helpers';
import { MarkdownRenderer } from '../MarkdownRenderer';

export interface LaneTitleProps {
  itemCount: number;
  title: string;
  isEditing: boolean;
  setIsEditing: Preact.StateUpdater<boolean>;
  onChange: Preact.ChangeEventHandler<HTMLTextAreaElement>;
}

export function LaneTitle({
  itemCount,
  isEditing,
  setIsEditing,
  title,
  onChange,
}: LaneTitleProps) {
  const { stateManager } = Preact.useContext(KanbanContext);
  const inputRef = Preact.useRef<HTMLTextAreaElement>();

  const onEnter = (e: KeyboardEvent) => {
    if (!allowNewLine(e, stateManager)) {
      e.preventDefault();
      isEditing && setIsEditing(false);
    }
  };

  const onSubmit = () => {
    isEditing && setIsEditing(false);
  };

  const onEscape = () => {
    isEditing && setIsEditing(false);
  };

  Preact.useEffect(() => {
    if (isEditing && inputRef.current) {
      const input = inputRef.current;

      inputRef.current.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }
  }, [isEditing]);

  return (
    <>
      <div className={c('lane-title')}>
        {isEditing ? (
          <MarkdownEditor
            ref={inputRef}
            className={c('lane-input')}
            onChange={onChange}
            onEnter={onEnter}
            onEscape={onEscape}
            onSubmit={onSubmit}
            value={title}
          />
        ) : (
          <>
            <div
              className={c('lane-title-text')}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();

                const internalLinkPath =
                  e.target instanceof
                    (e.view as Window & typeof globalThis).HTMLAnchorElement &&
                  e.target.hasClass('internal-link')
                    ? e.target.dataset.href
                    : undefined;

                if (internalLinkPath) {
                  (stateManager.app.workspace as any).onLinkContextMenu(
                    e,
                    getLinkpath(internalLinkPath),
                    stateManager.file.path
                  );
                }
              }}
            >
              <MarkdownRenderer markdownString={title} />
            </div>
          </>
        )}
      </div>
      {!isEditing && <div className={c('lane-title-count')}>{itemCount}</div>}
    </>
  );
}
