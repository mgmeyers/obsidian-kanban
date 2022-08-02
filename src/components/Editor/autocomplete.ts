import Fuse from 'fuse.js';
import { moment } from 'obsidian';
import Preact from 'preact/compat';

import { getParentBodyElement } from 'src/dnd/util/getWindow';

import { KanbanContext, KanbanContextProps } from '../context';
import { c, escapeRegExpStr, useIMEInputProps } from '../helpers';
import {
  applyDate,
  constructDatePicker,
  ensureDatePickerIsOnScreen,
  getTimePickerConfig,
  toNextMonth,
  toPreviousMonth,
} from './datepicker';
import {
  LinkSuggestion,
  getBlockSearchConfig,
  getFileSearchConfig,
  getHeadingSearchConfig,
} from './filepicker';
import { Instance } from './flatpickr/types/instance';
import { replaceSelection } from './helpers';
import { getTagSearchConfig } from './tagpicker';
import { StrategyProps, Textcomplete } from './textcomplete/textcomplete-core';
import { TextareaEditor } from './textcomplete/textcomplete-textarea';

export interface ConstructAutocompleteParams {
  inputRef: Preact.RefObject<HTMLTextAreaElement>;
  isAutocompleteVisibleRef: Preact.RefObject<boolean>;
  obsidianContext: KanbanContextProps;
  excludeDatePicker?: boolean;
}

export function constructAutocomplete({
  inputRef,
  isAutocompleteVisibleRef,
  obsidianContext,
  excludeDatePicker,
}: ConstructAutocompleteParams) {
  const { stateManager, filePath, view } = obsidianContext;

  let datePickerEl: null | HTMLDivElement = null;
  let datePickerInstance: Instance | null = null;

  const dateTrigger = stateManager.getSetting('date-trigger');
  const dateTriggerRegex = new RegExp(
    `(?:^|\\s)${escapeRegExpStr(dateTrigger as string)}$`
  );

  const tags = Object.keys(
    (stateManager.app.metadataCache as any).getTags()
  ).sort();
  const tagSearch = new Fuse(tags);

  const linkSuggestions = (stateManager.app.metadataCache as any)
    .getLinkSuggestions()
    .filter(
      (suggestion: LinkSuggestion) => !!suggestion.file
    ) as Array<LinkSuggestion>;

  const fileSearch = new Fuse(linkSuggestions, {
    keys: ['file.basename', 'alias'],
  });

  const willAutoPairBrackets = (view.app.vault as any).getConfig(
    'autoPairBrackets'
  );

  const configs: StrategyProps[] = [
    getTagSearchConfig(tags, tagSearch),
    getBlockSearchConfig(filePath, stateManager, willAutoPairBrackets, true),
    getBlockSearchConfig(filePath, stateManager, willAutoPairBrackets, false),
    getHeadingSearchConfig(filePath, stateManager, willAutoPairBrackets, true),
    getHeadingSearchConfig(filePath, stateManager, willAutoPairBrackets, false),
    getFileSearchConfig(
      view.getWindow(),
      linkSuggestions,
      fileSearch,
      filePath,
      stateManager,
      willAutoPairBrackets,
      true
    ),
    getFileSearchConfig(
      view.getWindow(),
      linkSuggestions,
      fileSearch,
      filePath,
      stateManager,
      willAutoPairBrackets,
      false
    ),
  ];

  if (!excludeDatePicker) {
    configs.push(getTimePickerConfig(stateManager));
  }

  const editor = new TextareaEditor(inputRef.current);
  const autocomplete = new Textcomplete(editor, configs, {
    dropdown: {
      parent: getParentBodyElement(inputRef.current),
      maxCount: 96,
      className: `${c('autocomplete')} ${c('ignore-click-outside')}`,
      rotate: true,
      item: {
        className: `${c('autocomplete-item')} ${c('ignore-click-outside')}`,
        activeClassName: `${c('autocomplete-item-active')} ${c(
          'ignore-click-outside'
        )}`,
      },
    },
  });

  const destroyDatePicker = () => {
    if (!autocomplete.isShown()) {
      isAutocompleteVisibleRef.current = false;
    }

    const win = datePickerEl.win;

    datePickerInstance.destroy();
    datePickerEl.remove();
    win.setTimeout(() => {
      datePickerEl = null;
    });
  };

  autocomplete.on('show', () => {
    isAutocompleteVisibleRef.current = true;
  });

  autocomplete.on('hidden', () => {
    isAutocompleteVisibleRef.current = false;
  });

  let keydownHandler: (e: KeyboardEvent) => void;

  if (!excludeDatePicker) {
    keydownHandler = (e: KeyboardEvent) => {
      if (autocomplete.isShown && ['#', '^'].contains(e.key)) {
        const activeItem = (autocomplete as any).dropdown.getActiveItem();
        const searchResult = activeItem?.searchResult;

        if (searchResult && searchResult.strategy.props.id.startsWith('link')) {
          e.preventDefault();
          editor.applySearchResult(searchResult);
          replaceSelection(inputRef.current, e.key === '^' ? '#^' : '#');
          return;
        }
      }

      if (!datePickerEl) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();

        const selectedDates = datePickerInstance.selectedDates;

        if (selectedDates.length) {
          applyDate(selectedDates[0], inputRef, stateManager);
        } else {
          applyDate(new Date(), inputRef, stateManager);
        }

        return destroyDatePicker();
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        return destroyDatePicker();
      }

      const currentDate = moment(
        datePickerInstance.selectedDates[0] || new Date()
      );

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentDate.weekday() === 6) {
          datePickerInstance.setDate(toNextMonth(currentDate).toDate(), false);
        } else {
          datePickerInstance.setDate(currentDate.add(1, 'day').toDate(), false);
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentDate.weekday() === 0) {
          datePickerInstance.setDate(
            toPreviousMonth(currentDate).toDate(),
            false
          );
        } else {
          datePickerInstance.setDate(
            currentDate.subtract(1, 'day').toDate(),
            false
          );
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        datePickerInstance.setDate(
          currentDate.subtract(1, 'week').toDate(),
          false
        );
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        datePickerInstance.setDate(currentDate.add(1, 'week').toDate(), false);
        return;
      }
    };

    inputRef.current.addEventListener('keydown', keydownHandler);
    const doc = inputRef.current.doc;

    editor.on('change', (e: CustomEvent) => {
      const beforeCursor = e.detail.beforeCursor as string;

      if (beforeCursor && dateTriggerRegex.test(beforeCursor)) {
        const position = editor.getCursorOffset();

        if (datePickerEl) {
          datePickerEl.style.left = `${position.left || 0}px`;
          datePickerEl.style.top = `${position.top || 0}px`;
          ensureDatePickerIsOnScreen(position, datePickerEl);
        } else {
          datePickerEl = doc.body.createDiv(
            { cls: `${c('date-picker')} ${c('ignore-click-outside')}` },
            (div) => {
              div.style.left = `${position.left || 0}px`;
              div.style.top = `${position.top || 0}px`;

              constructDatePicker({
                div,
                inputRef,
                stateManager,
                cb: (picker) => {
                  datePickerInstance = picker;
                  isAutocompleteVisibleRef.current = true;
                  ensureDatePickerIsOnScreen(position, datePickerEl);
                },
              });
            }
          );
        }
      } else if (datePickerEl) {
        destroyDatePicker();
      }
    });
  }

  return () => {
    if (!excludeDatePicker && inputRef.current) {
      inputRef.current.removeEventListener('keydown', keydownHandler);
    }

    if (datePickerEl) {
      destroyDatePicker();
    }

    autocomplete.destroy();
    editor.destroy();
  };
}

export interface UseAutocompleteInputPropsParams {
  isInputVisible: boolean;
  onEnter?: (e: KeyboardEvent) => boolean | void;
  onEscape?: (e: KeyboardEvent) => boolean | void;
  onKeyDown?: (e: KeyboardEvent) => boolean | void;
  excludeDatePicker?: boolean;
}

export function useAutocompleteInputProps({
  isInputVisible,
  onEnter,
  onEscape,
  onKeyDown,
  excludeDatePicker,
}: UseAutocompleteInputPropsParams) {
  const obsidianContext = Preact.useContext(KanbanContext);
  const isAutocompleteVisibleRef = Preact.useRef<boolean>(false);
  const inputRef = Preact.useRef<HTMLTextAreaElement>();
  const { oncompositionstart, oncompositionend, getShouldIMEBlockAction } =
    useIMEInputProps();

  Preact.useEffect(() => {
    const input = inputRef.current;

    if (isInputVisible && input) {
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;

      return constructAutocomplete({
        inputRef,
        isAutocompleteVisibleRef,
        obsidianContext,
        excludeDatePicker,
      });
    }
  }, [isInputVisible]);

  return {
    ref: inputRef,
    oncompositionstart,
    oncompositionend,
    onKeyDownCapture: (e: KeyboardEvent) => {
      if (getShouldIMEBlockAction() || isAutocompleteVisibleRef.current) {
        return;
      }

      const handled = onKeyDown(e);

      if (handled) return;

      if (e.key === 'Enter') {
        onEnter && onEnter(e);
      } else if (e.key === 'Escape') {
        onEscape && onEscape(e);
      }
    },
  };
}
