import { moment } from 'obsidian';
import Preact from 'preact';

import { getParentWindow } from 'src/dnd/util/getWindow';
import { buildLinkToDailyNote } from 'src/helpers';
import { StateManager } from 'src/StateManager';

import { escapeRegExpStr } from '../helpers';
import { buildTimeArray } from '../Item/helpers';
import { getDefaultLocale } from './datePickerLocale';
import flatpickr from './flatpickr';
import { Instance } from './flatpickr/types/instance';
import { replaceSelection } from './helpers';
import { CursorOffset, StrategyProps } from './textcomplete/textcomplete-core';

export function applyDate(
  date: Date,
  inputRef: Preact.RefObject<HTMLTextAreaElement>,
  stateManager: StateManager
) {
  const dateFormat = stateManager.getSetting('date-format');
  const shouldLinkDates = stateManager.getSetting('link-date-to-daily-note');

  const formattedDate = moment(date).format(dateFormat);
  const wrappedDate = shouldLinkDates
    ? buildLinkToDailyNote(stateManager.app, formattedDate)
    : `{${formattedDate}}`;

  replaceSelection(inputRef.current, wrappedDate);

  inputRef.current.focus();
}

export interface ConstructDatePickerParams {
  div: HTMLElement;
  inputRef: Preact.RefObject<HTMLTextAreaElement>;
  cb: (picker: Instance) => void;
  stateManager: StateManager;
}

export function constructDatePicker({
  div,
  inputRef,
  cb,
  stateManager,
}: ConstructDatePickerParams) {
  div.createEl('input', { type: 'text' }, (input) => {
    div.win.setTimeout(() =>
      cb(
        flatpickr(input, {
          now: new Date(),
          locale: getDefaultLocale(stateManager),
          inline: true,
          onChange: (dates) => {
            applyDate(dates[0], inputRef, stateManager);
          },
          win: input.win,
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
  const window = getParentWindow(div);

  if (position.top + height > window.innerHeight) {
    div.style.top = `${(position.clientTop || 0) - height}px`;
  }

  if (position.left + width > window.innerWidth) {
    div.style.left = `${(position.left || 0) - width}px`;
  }
}

export function getTimePickerConfig(
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

export function toPreviousMonth(date: moment.Moment) {
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

export function toNextMonth(date: moment.Moment) {
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
