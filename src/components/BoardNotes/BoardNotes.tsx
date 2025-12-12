import { EditorView } from '@codemirror/view';
import classcat from 'classcat';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/compat';
import { t } from 'src/lang/helpers';

import { MarkdownEditor } from '../Editor/MarkdownEditor';
import { MarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer';
import { KanbanContext } from '../context';
import { c } from '../helpers';
import { EditCoordinates, EditState, EditingState, isEditing } from '../types';
import { Icon } from '../Icon/Icon';

interface BoardNotesProps {
  notes: string | undefined;
}

export function BoardNotes({ notes }: BoardNotesProps) {
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const [editState, setEditState] = useState<EditState>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const notesRef = useRef<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Handle save when edit completes
  useEffect(() => {
    if (editState === EditingState.complete) {
      if (notesRef.current !== null) {
        boardModifiers.updateBoardNotes(notesRef.current);
      }
      notesRef.current = null;
      setEditState(null);
    } else if (editState === EditingState.cancel) {
      notesRef.current = null;
      setEditState(null);
    }
  }, [editState, boardModifiers]);

  const onEnter = useCallback(
    (cm: EditorView, mod: boolean, shift: boolean) => {
      // Always allow new lines in board notes since it's a multi-line editor
      return false;
    },
    []
  );

  const onSubmit = useCallback(() => setEditState(EditingState.complete), []);

  const onEscape = useCallback(() => {
    setEditState(EditingState.cancel);
    return true;
  }, []);

  const onDoubleClick = useCallback((e: MouseEvent) => {
    setEditState({ x: e.clientX, y: e.clientY } as EditCoordinates);
  }, []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const onAddNotes = useCallback(() => {
    boardModifiers.updateBoardNotes('');
    setEditState({ x: 0, y: 0 } as EditCoordinates);
  }, [boardModifiers]);

  // If no notes and not editing, show add button
  if (!notes && !isEditing(editState)) {
    return (
      <div className={c('board-notes-empty')}>
        <button
          className={c('board-notes-add-button')}
          onClick={onAddNotes}
          aria-label={t('Add board notes')}
        >
          <Icon name="lucide-plus" />
          <span>{t('Add board notes')}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={classcat([
        c('board-notes'),
        {
          [c('board-notes-collapsed')]: isCollapsed,
          [c('board-notes-editing')]: isEditing(editState),
        },
      ])}
    >
      <div className={c('board-notes-header')}>
        <button
          className={c('board-notes-collapse-button')}
          onClick={toggleCollapse}
          aria-label={isCollapsed ? t('Expand notes') : t('Collapse notes')}
        >
          <Icon name={isCollapsed ? 'lucide-chevron-right' : 'lucide-chevron-down'} />
        </button>
        <span className={c('board-notes-title')}>{t('Notes')}</span>
      </div>
      {!isCollapsed && (
        <div className={c('board-notes-content')}>
          {isEditing(editState) ? (
            <div className={c('board-notes-input-wrapper')}>
              <MarkdownEditor
                editState={editState}
                className={c('board-notes-input')}
                onEnter={onEnter}
                onEscape={onEscape}
                onSubmit={onSubmit}
                value={notes || ''}
                placeholder={t('Enter board notes...')}
                onChange={(update) => {
                  if (update.docChanged) {
                    notesRef.current = update.state.doc.toString();
                  }
                }}
              />
              <div className={c('board-notes-actions')}>
                <button
                  className={classcat([c('board-notes-save-button'), 'mod-cta'])}
                  onClick={() => setEditState(EditingState.complete)}
                >
                  {t('Save')}
                </button>
                <button
                  className={c('board-notes-cancel-button')}
                  onClick={() => setEditState(EditingState.cancel)}
                >
                  {t('Cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className={c('board-notes-preview')} onDblClick={onDoubleClick}>
              <MarkdownRenderer
                className={c('board-notes-markdown')}
                markdownString={notes || ''}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
