import {
  MarkdownSourceView,
  TFile,
  htmlToMarkdown,
  parseLinktext,
} from 'obsidian';
import React from 'react';
import useOnclickOutside from 'react-cool-onclickoutside';

import { t } from 'src/lang/helpers';
import { StateManager } from 'src/StateManager';

import { KanbanContext } from '../context';
import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { c } from '../helpers';
import { Item } from '../types';

function linkTo(
  stateManager: StateManager,
  file: TFile,
  sourcePath: string,
  subpath?: string
) {
  // Generate a link relative to this Kanban board, respecting user link type preferences
  return stateManager.app.fileManager.generateMarkdownLink(
    file,
    sourcePath,
    subpath
  );
}

function getMarkdown(
  stateManager: StateManager,
  transfer: DataTransfer,
  html: string
) {
  // 0.12.5 -- remove handleDataTransfer below when this version is more widely supported
  if (htmlToMarkdown) {
    return htmlToMarkdown(html);
  }

  // crude hack to use Obsidian's html-to-markdown converter (replace when Obsidian exposes it in API):
  return (MarkdownSourceView.prototype as any).handleDataTransfer.call(
    { app: stateManager.app },
    transfer
  ) as string;
}

function fixLinks(text: string) {
  // Internal links from e.g. dataview plugin incorrectly begin with `app://obsidian.md/`, and
  // we also want to remove bullet points and task markers from text and markdown
  return text.replace(/^\[(.*)\]\(app:\/\/obsidian.md\/(.*)\)$/, '[$1]($2)');
}

function dropAction(stateManager: StateManager, transfer: DataTransfer) {
  // Return a 'copy' or 'link' action according to the content types, or undefined if no recognized type
  if (transfer.types.includes('text/uri-list')) return 'link';
  if (
    ['file', 'files', 'link'].includes(
      (stateManager.app as any).dragManager.draggable?.type
    )
  )
    return 'link';
  if (
    transfer.types.includes('text/html') ||
    transfer.types.includes('text/plain')
  )
    return 'copy';
}

function handleDragOrPaste(
  stateManager: StateManager,
  filePath: string,
  transfer: DataTransfer,
  forcePlaintext: boolean = false
): string[] {
  const draggable = (stateManager.app as any).dragManager.draggable;
  const html = transfer.getData('text/html');
  const plain = transfer.getData('text/plain');
  const uris = transfer.getData('text/uri-list');

  switch (draggable?.type) {
    case 'file':
      return [linkTo(stateManager, draggable.file, filePath)];
    case 'files':
      return draggable.files.map((f: TFile) =>
        linkTo(stateManager, f, filePath)
      );
    case 'link': {
      let link = draggable.file
        ? linkTo(
            stateManager,
            draggable.file,
            parseLinktext(draggable.linktext).subpath
          )
        : `[[${draggable.linktext}]]`;
      const alias = new DOMParser().parseFromString(html, 'text/html')
        .documentElement.textContent; // Get raw text
      link = link
        .replace(/]]$/, `|${alias}]]`)
        .replace(/^\[[^\]].+]\(/, `[${alias}](`);
      return [link];
    }
    default: {
      const text = forcePlaintext
        ? plain || html
        : getMarkdown(stateManager, transfer, html);

      return [fixLinks(text || uris || plain || html || '')];
    }
  }
}

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

  const addItemsFromStrings = async (titles: string[]) => {
    addItems(
      await Promise.all(
        titles.map(async (title) => {
          return await stateManager.parser.newItem(title);
        })
      )
    );
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
              const action = dropAction(stateManager, e.dataTransfer);

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
          if (dropAction(stateManager, e.dataTransfer)) {
            setIsInputVisible(true);
          }
        }}
      >
        <span className={c('item-button-plus')}>+</span> {t('Add a card')}
      </button>
    </div>
  );
}
