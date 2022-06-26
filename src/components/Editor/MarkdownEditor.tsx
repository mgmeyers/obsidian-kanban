import { Platform } from 'obsidian';
import { Ref } from 'preact';
import Preact from 'preact/compat';

import { t } from 'src/lang/helpers';
import { StateManager } from 'src/StateManager';

import { KanbanContext } from '../context';
import { c } from '../helpers';
import { useAutocompleteInputProps } from './autocomplete';
import {
  autoPairBracketsCommands,
  autoPairMarkdownCommands,
  commands,
  handleNewLine,
  handleTab,
  unpairBrackets,
  unpairMarkdown,
} from './commands';

interface MarkdownEditorProps
  extends Preact.DetailedHTMLProps<Preact.HTMLAttributes<HTMLTextAreaElement>> {
  onEnter: (e: KeyboardEvent) => void;
  onEscape: (e: KeyboardEvent) => void;
  onSubmit: () => void;
}

export function allowNewLine(e: KeyboardEvent, stateManager: StateManager) {
  if (Platform.isMobile) {
    return e.key === 'Enter' && true;
  }

  const newLineTrigger = stateManager.getSetting('new-line-trigger');

  if (newLineTrigger === 'enter') {
    return e.key === 'Enter' && !(e.shiftKey || e.metaKey || e.ctrlKey);
  }

  return e.key === 'Enter' && e.shiftKey;
}

export const MarkdownEditor = Preact.forwardRef(function MarkdownEditor(
  { onEnter, onEscape, onSubmit, ...textareaProps }: MarkdownEditorProps,
  ref: Ref<HTMLTextAreaElement>
) {
  const { view, stateManager } = Preact.useContext(KanbanContext);

  const shouldAutoPairMarkdown = (app.vault as any).getConfig(
    'autoPairMarkdown'
  );
  const shouldAutoPairBrackets = (app.vault as any).getConfig(
    'autoPairBrackets'
  );
  const shouldUseTab = (app.vault as any).getConfig('useTab');
  const tabWidth = (app.vault as any).getConfig('tabSize');
  const shouldUseMarkdownLinks = !!(app.vault as any).getConfig(
    'useMarkdownLinks'
  );

  const autocompleteProps = useAutocompleteInputProps({
    isInputVisible: true,
    onEnter,
    onEscape,
    onKeyDown: (e) => {
      if (e.key === 'Backspace') {
        const handledBrackets = unpairBrackets(e.target as HTMLTextAreaElement);
        if (handledBrackets) return handledBrackets;

        return unpairMarkdown(e.target as HTMLTextAreaElement);
      }

      if (allowNewLine(e, stateManager)) {
        const handled = handleNewLine(e.target as HTMLTextAreaElement);
        if (handled) {
          e.preventDefault();
          return handled;
        }
      }

      if (e.key === 'Tab') {
        e.preventDefault();

        return handleTab(
          e.target as HTMLTextAreaElement,
          e.shiftKey,
          shouldUseTab,
          tabWidth
        );
      }

      if (shouldAutoPairMarkdown) {
        const command = autoPairMarkdownCommands[e.key];
        if (command) {
          const handled = command(e.target as HTMLTextAreaElement);
          if (handled) {
            e.preventDefault();
            return true;
          }
        }
      }

      if (shouldAutoPairBrackets) {
        if (shouldUseMarkdownLinks && e.key === '[') {
          return false;
        }

        const command = autoPairBracketsCommands[e.key];
        if (command) {
          const handled = command(e.target as HTMLTextAreaElement);
          if (handled) {
            e.preventDefault();
            return true;
          }
        }
      }

      return false;
    },
  });

  Preact.useEffect(() => {
    const onHotkey = (command: string) => {
      const fn = commands[command];

      if (fn) {
        fn(autocompleteProps.ref.current);
      }
    };

    view.emitter.on('hotkey', onHotkey);

    return () => {
      view.emitter.off('hotkey', onHotkey);
    };
  }, [view]);

  return (
    <>
      <div
        data-replicated-value={textareaProps.value}
        className={c('grow-wrap')}
      >
        <textarea
          data-ignore-drag={true}
          rows={1}
          className={c('item-input')}
          {...textareaProps}
          {...autocompleteProps}
          ref={(c: HTMLTextAreaElement) => {
            autocompleteProps.ref.current = c;

            if (ref && typeof ref === 'function') {
              ref(c);
            } else if (ref) {
              (ref as Preact.RefObject<HTMLTextAreaElement>).current = c;
            }
          }}
        />
      </div>
      {Platform.isMobile && (
        <button onPointerDown={onSubmit} className={c('item-submit-button')}>
          {t('Submit')}
        </button>
      )}
    </>
  );
});
