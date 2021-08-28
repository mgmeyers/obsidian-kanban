import { getLinkpath } from 'obsidian';
import React from 'react';

import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c } from '../helpers';
import { useAutocompleteInputProps } from '../Item/autocomplete';
import { MarkdownRenderer } from '../MarkdownRenderer';

export interface LaneTitleProps {
  itemCount: number;
  title: string;
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
}

export function LaneTitle({
  itemCount,
  isEditing,
  setIsEditing,
  title,
  onChange,
}: LaneTitleProps) {
  const { stateManager } = React.useContext(KanbanContext);
  const inputRef = React.useRef<HTMLTextAreaElement>();

  const onEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.shiftKey) {
      e.preventDefault();
      isEditing && setIsEditing(false);
    }
  };

  const onEscape = () => {
    isEditing && setIsEditing(false);
  };

  const autocompleteProps = useAutocompleteInputProps({
    isInputVisible: isEditing,
    onEnter,
    onEscape,
    excludeDatePicker: true,
  });

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      const input = inputRef.current;

      inputRef.current.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }
  }, [isEditing]);

  return (
    <div className={c('lane-title')}>
      {isEditing ? (
        <div data-replicated-value={title} className={c('grow-wrap')}>
          <textarea
            ref={inputRef}
            rows={1}
            value={title}
            className={c('lane-input')}
            placeholder={t('Enter list title...')}
            onChange={onChange}
            {...autocompleteProps}
          />
        </div>
      ) : (
        <>
          <div
            className={c('lane-title-text')}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();

              const internalLinkPath =
                e.target instanceof HTMLAnchorElement &&
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
          <div className={c('lane-title-count')}>{itemCount}</div>
        </>
      )}
    </div>
  );
}
