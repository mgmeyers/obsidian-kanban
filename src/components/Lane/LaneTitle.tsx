import { EditorView } from '@codemirror/view';
import classcat from 'classcat';
import { getLinkpath } from 'obsidian';
import Preact from 'preact/compat';
import { StateUpdater, useEffect, useRef } from 'preact/hooks';
import { laneTitleWithMaxItems } from 'src/helpers';

import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { MarkdownPreviewRenderer } from '../MarkdownRenderer';
import { KanbanContext } from '../context';
import { c } from '../helpers';
import { EditState, EditingState, isEditing } from '../types';

export interface LaneTitleProps {
  itemCount: number;
  title: string;
  maxItems?: number;
  editState: EditState;
  setEditState: StateUpdater<EditState>;
  onChange: (str: string) => void;
}

export function LaneTitle({
  itemCount,
  maxItems,
  editState,
  setEditState,
  title,
  onChange,
}: LaneTitleProps) {
  const { stateManager } = Preact.useContext(KanbanContext);
  const hideCount = stateManager.getSetting('hide-card-count');
  const titleRef = useRef<string | null>(null);

  useEffect(() => {
    if (editState === EditingState.complete) {
      if (titleRef.current !== null) onChange(titleRef.current);
      titleRef.current = null;
    } else if (editState === EditingState.cancel && titleRef.current !== null) {
      titleRef.current = null;
    }
  }, [editState]);

  const onEnter = (cm: EditorView, mod: boolean, shift: boolean) => {
    if (!allowNewLine(stateManager, mod, shift)) {
      setEditState(EditingState.complete);
      return true;
    }
  };

  const onSubmit = () => {
    setEditState(EditingState.complete);
  };

  const onEscape = () => {
    setEditState(EditingState.cancel);
  };

  const counterClasses = [c('lane-title-count')];

  if (maxItems && maxItems < itemCount) {
    counterClasses.push('wip-exceeded');
  }

  return (
    <>
      <div className={c('lane-title')}>
        {isEditing(editState) ? (
          <MarkdownEditor
            editState={editState}
            className={c('lane-input')}
            onChange={(update) => {
              titleRef.current = update.state.doc.toString().trim();
            }}
            onEnter={onEnter}
            onEscape={onEscape}
            onSubmit={onSubmit}
            value={laneTitleWithMaxItems(title, maxItems)}
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
              <MarkdownPreviewRenderer markdownString={title} />
            </div>
          </>
        )}
      </div>
      {typeof editState !== 'object' && !hideCount && (
        <div className={classcat(counterClasses)}>
          {itemCount}
          {maxItems > 0 && (
            <>
              <span className={c('lane-title-count-separator')}>/</span>
              <span className={c('lane-title-count-limit')}>{maxItems}</span>
            </>
          )}
        </div>
      )}
    </>
  );
}
