import { EditorSuggestContext, moment } from 'obsidian';
import { StateManager } from 'src/StateManager';
import { buildLinkToDailyNote } from 'src/helpers';

import { buildTimeArray } from '../Item/helpers';
import { escapeRegExpStr } from '../helpers';
import { getDefaultLocale } from './datePickerLocale';
import flatpickr from './flatpickr';
import { Instance } from './flatpickr/types/instance';
import { StrategyProps } from './textcomplete/textcomplete-core';

export function applyDate(
  ctx: EditorSuggestContext,
  stateManager: StateManager,
  date: Date
) {
  const dateFormat = stateManager.getSetting('date-format');
  const shouldLinkDates = stateManager.getSetting('link-date-to-daily-note');

  const formattedDate = moment(date).format(dateFormat);
  const wrappedDate = shouldLinkDates
    ? buildLinkToDailyNote(stateManager.app, formattedDate)
    : `{${formattedDate}} `;

  const start = { line: ctx.start.line, ch: ctx.start.ch + 1 };

  ctx.editor.replaceRange(wrappedDate, start, ctx.end);
  ctx.editor.setCursor({
    line: start.line,
    ch: start.ch + wrappedDate.length,
  });
  ctx.editor.focus();
}

export function constructDatePicker(
  ctx: EditorSuggestContext,
  stateManager: StateManager,
  div: HTMLElement,
  cb: (picker: Instance) => void
) {
  div.createEl('input', { type: 'text' }, (input) => {
    div.win.setTimeout(() =>
      cb(
        flatpickr(input, {
          win: input.win,
          now: new Date(),
          inline: true,
          locale: getDefaultLocale(stateManager),
          onChange: (dates) => applyDate(ctx, stateManager, dates[0]),
        })
      )
    );
  });
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
