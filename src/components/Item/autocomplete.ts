import { CursorOffset, StrategyProps, Textcomplete } from '@textcomplete/core';
import { TextareaEditor } from '@textcomplete/textarea';
import flatpickr from 'flatpickr';
import Fuse from 'fuse.js';
import { TFile, moment } from 'obsidian';
import React from 'react';

import { StateManager } from 'src/StateManager';

import { KanbanContext, KanbanContextProps } from '../context';
import { c, escapeRegExpStr, useIMEInputProps } from '../helpers';
import { getDefaultLocale } from './datePickerLocale';
import { buildTimeArray } from './helpers';

const tagRegex = /\B#([^\s]*)?$/;
const linkRegex = /\B\[\[([^\]]*)?$/;
const embedRegex = /\B!\[\[([^\]]*)?$/;

export function forceChangeEvent(input: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  ).set.call(input, value);

  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function applyDate(
  date: Date,
  inputRef: React.MutableRefObject<HTMLTextAreaElement>,
  stateManager: StateManager
) {
  const dateFormat = stateManager.getSetting('date-format');
  const shouldLinkDates = stateManager.getSetting('link-date-to-daily-note');

  const formattedDate = moment(date).format(dateFormat);
  const wrappedDate = shouldLinkDates
    ? `[[${formattedDate}]]`
    : `{${formattedDate}}`;

  forceChangeEvent(inputRef.current, `${inputRef.current.value}${wrappedDate}`);

  inputRef.current.focus();
}

interface ConstructDatePickerParams {
  div: HTMLElement;
  inputRef: React.MutableRefObject<HTMLTextAreaElement>;
  cb: (picker: flatpickr.Instance) => void;
  stateManager: StateManager;
}

function constructDatePicker({
  div,
  inputRef,
  cb,
  stateManager,
}: ConstructDatePickerParams) {
  div.createEl('input', { type: 'text' }, (input) => {
    setTimeout(() =>
      cb(
        flatpickr(input, {
          locale: getDefaultLocale(),
          inline: true,
          onChange: (dates) => {
            applyDate(dates[0], inputRef, stateManager);
          },
        })
      )
    );
  });
}

export function ensureDatePickerIsOnScreen(
  position: CursorOffset,
  div: HTMLElement
) {
  const height = div.clientHeight;
  const width = div.clientWidth;

  if (position.top + height > window.innerHeight) {
    div.style.top = `${(position.clientTop || 0) - height}px`;
  }

  if (position.left + width > window.innerWidth) {
    div.style.left = `${(position.left || 0) - width}px`;
  }
}

function getTimePickerConfig(
  stateManager: StateManager
): StrategyProps<string> {
  const timeTrigger = stateManager.getSetting('time-trigger');
  const timeTriggerRegex = new RegExp(
    `\\B${escapeRegExpStr(timeTrigger as string)}{?([^}]*)$`
  );
  const times = buildTimeArray(stateManager);

  return {
    id: 'time',
    match: timeTriggerRegex,
    index: 1,
    search: (term: string, callback: (results: string[]) => void) => {
      if (!term) {
        callback(times);
      } else {
        callback(times.filter((t) => t.startsWith(term)));
      }
    },
    template: (result: string) => {
      return result;
    },
    replace: (result: string): string => {
      return `${timeTrigger}{${result}} `;
    },
  };
}

function getTagSearchConfig(
  tags: string[],
  tagSearch: Fuse<string>
): StrategyProps<Fuse.FuseResult<string>> {
  return {
    id: 'tag',
    match: tagRegex,
    index: 1,
    search: (
      term: string,
      callback: (results: Fuse.FuseResult<string>[]) => void
    ) => {
      if (!term) {
        callback(
          tags.slice(0, 10).map((tag, i) => ({ item: tag, refIndex: i }))
        );
      } else {
        callback(tagSearch.search(term));
      }
    },
    template: (result: Fuse.FuseResult<string>) => {
      return result.item;
    },
    replace: (result: Fuse.FuseResult<string>): string => `${result.item} `,
  };
}

function getFileSearchConfig(
  files: TFile[],
  fileSearch: Fuse<TFile>,
  filePath: string,
  stateManager: StateManager,
  isEmbed: boolean
): StrategyProps<Fuse.FuseResult<TFile>> {
  return {
    id: 'link',
    match: isEmbed ? embedRegex : linkRegex,
    index: 1,
    template: (res: Fuse.FuseResult<TFile>) => {
      return stateManager.app.metadataCache.fileToLinktext(res.item, filePath);
    },
    search: (
      term: string,
      callback: (results: Fuse.FuseResult<TFile>[]) => void
    ) => {
      if (!term) {
        callback(
          files.slice(0, 10).map((file, i) => ({ item: file, refIndex: i }))
        );
      } else {
        callback(fileSearch.search(term));
      }
    },
    replace: (result: Fuse.FuseResult<TFile>): string =>
      `${isEmbed ? '!' : ''}[[${stateManager.app.metadataCache.fileToLinktext(
        result.item,
        filePath
      )}]] `,
  };
}

function toPreviousMonth(date: moment.Moment) {
  const initialMonth = date.month();
  const first = date.clone().startOf('month').weekday(0);
  const diff = date.diff(first, 'week');

  date.subtract(1, 'month').startOf('month').weekday(6).add(diff, 'week');

  let nextMonth = date.month();

  while (initialMonth === nextMonth) {
    date.subtract(1, 'week');
    nextMonth = date.month();
  }

  return date;
}

function toNextMonth(date: moment.Moment) {
  const initialMonth = date.month();
  const first = date.clone().startOf('month').weekday(6);
  const diff = date.diff(first, 'week');

  date.add(1, 'month').startOf('month').weekday(0).add(diff, 'week');

  let nextMonth = date.month();

  while (initialMonth === nextMonth) {
    date.add(1, 'week');
    nextMonth = date.month();
  }

  return date;
}

export interface ConstructAutocompleteParams {
  inputRef: React.MutableRefObject<HTMLTextAreaElement>;
  isAutocompleteVisibleRef: React.MutableRefObject<boolean>;
  obsidianContext: KanbanContextProps;
  excludeDatePicker?: boolean;
}

export function constructAutocomplete({
  inputRef,
  isAutocompleteVisibleRef,
  obsidianContext,
  excludeDatePicker,
}: ConstructAutocompleteParams) {
  const { stateManager, filePath } = obsidianContext;

  let datePickerEl: null | HTMLDivElement = null;
  let datePickerInstance: flatpickr.Instance | null = null;

  const dateTrigger = stateManager.getSetting('date-trigger');
  const dateTriggerRegex = new RegExp(
    `(?:^|\\s)${escapeRegExpStr(dateTrigger as string)}$`
  );

  const tags = Object.keys(
    (stateManager.app.metadataCache as any).getTags()
  ).sort();
  const tagSearch = new Fuse(tags);

  const files = stateManager.app.vault.getFiles();
  const fileSearch = new Fuse(files, {
    keys: ['name'],
  });

  const configs: StrategyProps[] = [
    getTagSearchConfig(tags, tagSearch),
    getFileSearchConfig(files, fileSearch, filePath, stateManager, false),
    getFileSearchConfig(files, fileSearch, filePath, stateManager, true),
  ];

  if (!excludeDatePicker) {
    configs.push(getTimePickerConfig(stateManager));
  }

  const editor = new TextareaEditor(inputRef.current);
  const autocomplete = new Textcomplete(editor, configs, {
    dropdown: {
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

    datePickerInstance.destroy();
    datePickerEl.remove();
    setTimeout(() => (datePickerEl = null));
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

    editor.on('change', (e: CustomEvent) => {
      const beforeCursor = e.detail.beforeCursor as string;

      if (beforeCursor && dateTriggerRegex.test(beforeCursor)) {
        const position = editor.getCursorOffset();

        if (datePickerEl) {
          datePickerEl.style.left = `${position.left || 0}px`;
          datePickerEl.style.top = `${position.top || 0}px`;
          ensureDatePickerIsOnScreen(position, datePickerEl);
        } else {
          datePickerEl = document.body.createDiv(
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
  onEnter: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onEscape: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  excludeDatePicker?: boolean;
}

export function useAutocompleteInputProps({
  isInputVisible,
  onEnter,
  onEscape,
  excludeDatePicker,
}: UseAutocompleteInputPropsParams) {
  const obsidianContext = React.useContext(KanbanContext);
  const isAutocompleteVisibleRef = React.useRef<boolean>(false);
  const inputRef = React.useRef<HTMLTextAreaElement>();
  const { oncompositionstart, oncompositionend, getShouldIMEBlockAction } =
    useIMEInputProps();

  React.useEffect(() => {
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
    onKeyDownCapture: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (getShouldIMEBlockAction() || isAutocompleteVisibleRef.current) {
        return;
      }

      if (e.key === 'Enter') {
        onEnter(e);
      } else if (e.key === 'Escape') {
        onEscape(e);
      }
    },
  };
}
