import React from 'react';
import useOnclickOutside from 'react-cool-onclickoutside';

import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { getDropAction } from '../Editor/helpers';
import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { c } from '../helpers';
import { Item } from '../types';
import { handleDragOrPaste } from './helpers';

interface ItemFormProps {
  addItems: (items: Item[]) => void;
  isInputVisible: boolean;
  setIsInputVisible: React.Dispatch<React.SetStateAction<boolean>>;
  hideButton?: boolean;
}

export function ItemForm({
  addItems,
  isInputVisible,
  setIsInputVisible,
  hideButton,
}: ItemFormProps) {
  const [itemTitle, setItemTitle] = React.useState('');
  const { stateManager, filePath } = React.useContext(KanbanContext);
  const inputRef = React.useRef<HTMLTextAreaElement>();
  const selectionStart = React.useRef<number>(null);
  const selectionEnd = React.useRef<number>(null);

  const clickOutsideRef = useOnclickOutside(
    () => {
      setIsInputVisible(false);
    },
    {
      ignoreClass: c('ignore-click-outside'),
    }
  );

  const clear = React.useCallback(() => {
    setItemTitle('');
    setIsInputVisible(false);
  }, []);

  const addItemsFromStrings = async (titles: string[]) => {
    addItems(
      await Promise.all(
        titles.map(async (title) => {
          return await stateManager.parser.newItem(title);
        })
      )
    );
  };

  const onEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!allowNewLine(e, stateManager)) {
      e.preventDefault();

      const title = itemTitle.trim();

      if (title) {
        addItemsFromStrings([title]);
        setItemTitle('');
      }
    }
  };

  if (isInputVisible) {
    return (
      <div className={c('item-form')} ref={clickOutsideRef}>
        <div className={c('item-input-wrapper')}>
          <MarkdownEditor
            ref={inputRef}
            className={c('item-input')}
            placeholder={t('Item title...')}
            onEnter={onEnter}
            onEscape={clear}
            value={itemTitle}
            onChange={(e) => {
              setItemTitle((e.target as HTMLTextAreaElement).value);
            }}
            onDragOver={(e) => {
              const action = getDropAction(stateManager, e.dataTransfer);

              if (action) {
                e.dataTransfer.dropEffect = action;
                e.preventDefault();
                return false;
              }
            }}
            onDragLeave={() => {
              if (!itemTitle) setIsInputVisible(false);
            }}
            onDrop={(e) => {
              // shift key to force plain text, the same way Obsidian does it
              addItemsFromStrings(
                handleDragOrPaste(
                  stateManager,
                  filePath,
                  e.dataTransfer,
                  e.shiftKey
                )
              );
              if (!itemTitle) setIsInputVisible(false);
            }}
            onPaste={(e) => {
              const html = e.clipboardData.getData('text/html');
              const pasteLines = handleDragOrPaste(
                stateManager,
                filePath,
                e.clipboardData
              );

              if (pasteLines.length > 1) {
                addItemsFromStrings(pasteLines);
                e.preventDefault();
                return false;
              } else if (html) {
                // We want to use the markdown instead of the HTML, but you can't intercept paste
                // So we have to simulate a paste event the hard way
                const input = e.target as HTMLTextAreaElement;
                const paste = pasteLines.join('');

                selectionStart.current = input.selectionStart;
                selectionEnd.current = input.selectionEnd;

                const replace =
                  itemTitle.substr(0, selectionStart.current) +
                  paste +
                  itemTitle.substr(selectionEnd.current);

                selectionStart.current = selectionEnd.current =
                  selectionStart.current + paste.length;

                setItemTitle(replace);

                // And then cancel the default event
                e.preventDefault();
                return false;
              }
              // plain text/other, fall through to standard cut/paste
            }}
          />
        </div>
      </div>
    );
  }

  if (hideButton) return null;

  return (
    <div className={c('item-button-wrapper')}>
      <button
        className={c('new-item-button')}
        onClick={() => setIsInputVisible(true)}
        onDragOver={(e) => {
          if (getDropAction(stateManager, e.dataTransfer)) {
            setIsInputVisible(true);
          }
        }}
      >
        <span className={c('item-button-plus')}>+</span> {t('Add a card')}
      </button>
    </div>
  );
}
