import React, { ForwardedRef } from 'react';

import { StateManager } from 'src/StateManager';

import { KanbanContext } from '../context';
import { c } from '../helpers';
import { useAutocompleteInputProps } from '../Item/autocomplete';
import {
  autoPairBracketsCommands,
  autoPairMarkdownCommands,
  commands,
  handleNewLine,
  handleTab,
  unpairBrackets,
  unpairMarkdown,
} from './commands';

interface MarkdownEditorProps extends React.HTMLProps<HTMLTextAreaElement> {
  onEnter: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onEscape: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function allowNewLine(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  stateManager: StateManager
) {
  const newLineTrigger = stateManager.getSetting('new-line-trigger');

  if (newLineTrigger === 'enter') {
    return e.key === 'Enter' && !(e.shiftKey || e.metaKey || e.ctrlKey);
  }

  return e.key === 'Enter' && e.shiftKey;
}

export const MarkdownEditor = React.forwardRef(function MarkdownEditor(
  { onEnter, onEscape, ...textareaProps }: MarkdownEditorProps,
  ref: ForwardedRef<HTMLTextAreaElement>
) {
  const { view, stateManager } = React.useContext(KanbanContext);

  const shouldAutoPairMarkdown = React.useMemo(() => {
    return (view.app.vault as any).getConfig('autoPairMarkdown');
  }, [view]);

  const shouldAutoPairBrackets = React.useMemo(() => {
    return (view.app.vault as any).getConfig('autoPairBrackets');
  }, [view]);

  const shouldUseTab = React.useMemo(() => {
    return (view.app.vault as any).getConfig('useTab');
  }, [view]);

  const tabWidth = React.useMemo(() => {
    return (view.app.vault as any).getConfig('tabSize');
  }, [view]);

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

  React.useEffect(() => {
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
    <div data-replicated-value={textareaProps.value} className={c('grow-wrap')}>
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
            (ref as React.MutableRefObject<HTMLTextAreaElement>).current = c;
          }
        }}
      />
    </div>
  );
});
