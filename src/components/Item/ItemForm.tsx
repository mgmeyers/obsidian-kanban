import Preact from 'preact/compat';
import useOnclickOutside from 'react-cool-onclickoutside';

import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { getDropAction, handlePaste } from '../Editor/helpers';
import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { c } from '../helpers';
import { Item } from '../types';
import { TFile } from "obsidian";

interface ItemFormProps {
  addItems: (items: Item[]) => void;
  isInputVisible: boolean;
  setIsInputVisible: Preact.StateUpdater<boolean>;
  hideButton?: boolean;
}

export function ItemForm({
  addItems,
  isInputVisible,
  setIsInputVisible,
  hideButton,
}: ItemFormProps) {
  const [itemTitle, setItemTitle] = Preact.useState('');
  const { stateManager, view } = Preact.useContext(KanbanContext);
  const inputRef = Preact.useRef<HTMLTextAreaElement>();

  const templateCard = stateManager.useSetting("new-card-template");

  const clickOutsideRef = useOnclickOutside(
    () => {
      setIsInputVisible(false);
    },
    {
      ignoreClass: c('ignore-click-outside'),
    }
  );

  const checkTemplate = () => {
    const templateFile = templateCard
        ? stateManager.app.vault.getAbstractFileByPath(templateCard)
        : null;

    if (templateFile instanceof TFile) {
      stateManager.app.vault.read(templateFile).then((data) => {
        setItemTitle(data)
      })
    } else {
      setItemTitle("")
    }
  }

  const clear = Preact.useCallback(() => {
    checkTemplate();
    setIsInputVisible(false);
  }, []);

  const addItemsFromStrings = async (titles: string[]) => {
    try {
      addItems(
        await Promise.all(
          titles.map((title) => {
            return stateManager.getNewItem(title);
          })
        )
      );
    } catch (e) {
      stateManager.setError(e);
    }
  };

  const onEnter = (e: KeyboardEvent) => {
    if (!allowNewLine(e, stateManager)) {
      e.preventDefault();

      const title = itemTitle.trim();

      if (title) {
        addItemsFromStrings([title]);
        checkTemplate();
      }
    }
  };

  const onSubmit = () => {
    const title = itemTitle.trim();

    if (title) {
      addItemsFromStrings([title]);
      checkTemplate();
    }
  };

  if (isInputVisible) {
    return (
      <div className={c('item-form')} ref={clickOutsideRef}>
        <div className={c('item-input-wrapper')}>
          <MarkdownEditor
            ref={inputRef}
            className={c('item-input')}
            placeholder={t('Card title...')}
            onEnter={onEnter}
            onEscape={clear}
            onSubmit={onSubmit}
            value={itemTitle}
            onChange={(e) => {
              setItemTitle((e.target as HTMLTextAreaElement).value);
            }}
            onPaste={(e) => {
              handlePaste(e, stateManager, view.getWindow());
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
        onClick={() => {
          checkTemplate();
          setIsInputVisible(true);
        }}
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
