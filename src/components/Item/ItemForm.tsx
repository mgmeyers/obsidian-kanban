import { EditorView } from '@codemirror/view';
import { App, Modal, Setting } from 'obsidian';
import { Dispatch, StateUpdater, useCallback, useContext, useEffect, useRef } from 'preact/hooks';
import { t } from 'src/lang/helpers';

import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { getDropAction } from '../Editor/helpers';
import { KanbanContext } from '../context';
import { c } from '../helpers';
import { EditState, EditingState, Item, isEditing } from '../types';

interface ItemFormProps {
  addItems: (items: Item[]) => void;
  editState: EditState;
  setEditState: Dispatch<StateUpdater<EditState>>;
  hideButton?: boolean;
}

class DiscardCardDraftModal extends Modal {
  private shouldRestoreEditor = true;

  constructor(app: App, private onDiscard: () => void, private onKeepEditing: () => void) {
    super(app);
  }

  onOpen() {
    this.setTitle(t('Discard card draft?'));

    this.contentEl.createEl('p', {
      text: t('This card has text that has not been saved.'),
    });

    new Setting(this.contentEl)
      .addButton((button) => {
        button
          .setButtonText(t('Keep editing'))
          .setCta()
          .onClick(() => {
            this.close();
          });
      })
      .addButton((button) => {
        button
          .setButtonText(t('Discard draft'))
          .setWarning()
          .onClick(() => {
            this.shouldRestoreEditor = false;
            this.close();
            this.onDiscard();
          });
      });
  }

  onClose() {
    this.contentEl.empty();
    if (this.shouldRestoreEditor) {
      this.onKeepEditing();
    }
  }
}

export function ItemForm({ addItems, editState, setEditState, hideButton }: ItemFormProps) {
  const { stateManager } = useContext(KanbanContext);
  const editorRef = useRef<EditorView>();
  const formRef = useRef<HTMLDivElement>();
  const isPromptOpenRef = useRef(false);

  const clear = () => setEditState(EditingState.cancel);

  const confirmDiscardDraft = useCallback(
    (cm: EditorView) => {
      if (!cm.state.doc.toString().trim()) {
        clear();
        return;
      }

      if (isPromptOpenRef.current) return;
      isPromptOpenRef.current = true;

      new DiscardCardDraftModal(
        stateManager.app,
        () => {
          isPromptOpenRef.current = false;
          clear();
        },
        () => {
          isPromptOpenRef.current = false;
          cm.focus();
        }
      ).open();
    },
    [stateManager]
  );

  useEffect(() => {
    if (!isEditing(editState)) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const cm = editorRef.current;
      const formEl = formRef.current;

      if (!cm || !formEl || formEl.contains(target)) return;
      if (
        target.closest(`.${c('ignore-click-outside')}`) ||
        target.closest('.mobile-toolbar') ||
        target.closest('.suggestion-container') ||
        target.closest('.modal-container')
      ) {
        return;
      }

      if (!cm.state.doc.toString().trim()) {
        clear();
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      confirmDiscardDraft(cm);
    };

    activeDocument.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      activeDocument.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [editState, confirmDiscardDraft]);

  const createItem = (title: string) => {
    addItems([stateManager.getNewItem(title, ' ')]);
    const cm = editorRef.current;
    if (cm) {
      cm.dispatch({
        changes: {
          from: 0,
          to: cm.state.doc.length,
          insert: '',
        },
      });
    }
  };

  if (isEditing(editState)) {
    return (
      <div className={c('item-form')} ref={formRef}>
        <div className={c('item-input-wrapper')}>
          <MarkdownEditor
            editorRef={editorRef}
            editState={{ x: 0, y: 0 }}
            className={c('item-input')}
            placeholder={t('Card title...')}
            onEnter={(cm, mod, shift) => {
              if (!allowNewLine(stateManager, mod, shift)) {
                createItem(cm.state.doc.toString());
                return true;
              }
            }}
            onSubmit={(cm) => {
              createItem(cm.state.doc.toString());
            }}
            onEscape={(cm) => {
              confirmDiscardDraft(cm);
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
        onClick={() => setEditState({ x: 0, y: 0 })}
        onDragOver={(e) => {
          if (getDropAction(stateManager, e.dataTransfer)) {
            setEditState({ x: 0, y: 0 });
          }
        }}
      >
        <span className={c('item-button-plus')}>+</span> {t('Add a card')}
      </button>
    </div>
  );
}
