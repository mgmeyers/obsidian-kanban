import { EditorSelection, Extension, Prec } from '@codemirror/state';
import {
  EditorView,
  ViewUpdate,
  keymap,
  placeholder as placeholderExt,
} from '@codemirror/view';
import classcat from 'classcat';
import { Platform } from 'obsidian';
import Preact, { MutableRefObject, useEffect, useRef } from 'preact/compat';
import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';
import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c, noop } from '../helpers';
import { EditState } from '../types';

interface MarkdownEditorProps {
  editorRef?: MutableRefObject<EditorView>;
  editState?: EditState;
  onEnter: (cm: EditorView, mod: boolean, shift: boolean) => boolean;
  onEscape: (cm: EditorView) => void;
  onSubmit: (cm: EditorView) => void;
  onPaste?: (e: ClipboardEvent, cm: EditorView) => void;
  onChange?: (update: ViewUpdate) => void;
  value?: string;
  className: string;
  placeholder?: string;
}

export function allowNewLine(
  stateManager: StateManager,
  mod: boolean,
  shift: boolean
) {
  if (Platform.isMobile) return true;
  return stateManager.getSetting('new-line-trigger') === 'enter'
    ? !(mod || shift)
    : mod || shift;
}

function getEditorAppProxy(view: KanbanView) {
  return new Proxy(view.app, {
    get(target, prop, reveiver) {
      if (prop === 'vault') {
        return new Proxy(view.app.vault, {
          get(target, prop, reveiver) {
            if (prop === 'config') {
              return new Proxy((view.app.vault as any).config, {
                get(target, prop, reveiver) {
                  if (
                    ['showLineNumber', 'foldHeading', 'foldIndent'].includes(
                      prop as string
                    )
                  ) {
                    return false;
                  }
                  return Reflect.get(target, prop, reveiver);
                },
              });
            }
            return Reflect.get(target, prop, reveiver);
          },
        });
      }
      return Reflect.get(target, prop, reveiver);
    },
  });
}

function getMarkdownController(view: KanbanView): Record<any, any> {
  return {
    app: view.app,
    showSearch: noop,
    toggleMode: noop,
    onMarkdownScroll: noop,
    getMode: () => 'source',
    scroll: 0,
    editMode: null,
    get file() {
      return view.file;
    },
    get path() {
      return view.file.path;
    },
  };
}

export function MarkdownEditor({
  editorRef,
  onEnter,
  onEscape,
  onChange,
  onPaste,
  className,
  onSubmit,
  editState,
  value,
  placeholder,
}: MarkdownEditorProps) {
  const { view } = Preact.useContext(KanbanContext);
  const elRef = useRef<HTMLDivElement>();
  const internalRef = useRef<EditorView>();

  useEffect(() => {
    class Editor extends view.plugin.MarkdownEditor {
      updateBottomPadding() {}
      onUpdate(update: ViewUpdate, changed: boolean) {
        super.onUpdate(update, changed);
        onChange && onChange(update);
      }
      buildLocalExtensions(): Extension[] {
        const extensions = super.buildLocalExtensions();

        if (placeholder) extensions.push(placeholderExt(placeholder));
        if (onPaste)
          extensions.push(
            Prec.high(
              EditorView.domEventHandlers({
                paste: onPaste,
              })
            )
          );

        extensions.push(
          Prec.high(
            keymap.of([
              {
                key: 'Enter',
                run: (cm) => onEnter(cm, false, false),
                shift: (cm) => onEnter(cm, false, true),
              },
              {
                key: 'Mod-Enter',
                run: (cm) => onEnter(cm, true, false),
                shift: (cm) => onEnter(cm, true, true),
              },
              {
                key: 'Escape',
                run: (cm) => {
                  onEscape(cm);
                  return false;
                },
                preventDefault: true,
              },
            ])
          )
        );

        return extensions;
      }
    }

    const controller = getMarkdownController(view);
    const app = getEditorAppProxy(view);
    const editor = view.plugin.addChild(
      new (Editor as any)(app, elRef.current, controller)
    );
    const cm: EditorView = editor.cm;

    internalRef.current = cm;
    if (editorRef) editorRef.current = cm;

    controller.editMode = editor;
    editor.set(value || '');
    if (typeof editState === 'object') {
      cm.dispatch({
        userEvent: 'select.pointer',
        selection: EditorSelection.single(cm.posAtCoords(editState, false)),
      });
    }

    return () => {
      view.plugin.removeChild(editor);
      internalRef.current = null;
      if (editorRef) editorRef.current = null;
    };
  }, []);

  const cls = ['cm-table-widget'];
  if (className) cls.push(className);

  return (
    <>
      <div className={classcat(cls)} ref={elRef}></div>
      {Platform.isMobile && (
        <button
          onPointerDown={() => onSubmit(internalRef.current)}
          className={c('item-submit-button')}
        >
          {t('Submit')}
        </button>
      )}
    </>
  );
}
