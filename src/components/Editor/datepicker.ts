import { EditorSuggestContext, moment } from 'obsidian';
import { StateManager } from 'src/StateManager';
import { buildLinkToDailyNote } from 'src/helpers';

import { getDefaultLocale } from './datePickerLocale';
import flatpickr from './flatpickr';
import { Instance } from './flatpickr/types/instance';

export function applyDate(ctx: EditorSuggestContext, stateManager: StateManager, date: Date) {
  const dateFormat = stateManager.getSetting('date-format');
  const dateTrigger = stateManager.getSetting('date-trigger');
  const shouldLinkDates = stateManager.getSetting('link-date-to-daily-note');

  const formattedDate = moment(date).format(dateFormat);
  const wrappedDate = shouldLinkDates
    ? buildLinkToDailyNote(stateManager.app, formattedDate)
    : `{${formattedDate}} `;

  const start = { line: ctx.start.line, ch: ctx.start.ch + dateTrigger.length };

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
