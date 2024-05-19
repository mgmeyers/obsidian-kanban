/*
This code is modified from https://github.com/blacksmithgu/obsidian-dataview
and https://github.com/obsidian-tasks-group/obsidian-tasks

Dataview is licensed as such:
MIT License

Copyright (c) 2021 Michael Brenan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Tasks is licensed as such:
MIT License

Copyright (c) 2021 Martin Schenck and Clare Macrae

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import { TFile } from 'obsidian';
import { RRule } from 'rrule';
import { Item } from 'src/components/types';
import { t } from 'src/lang/helpers';

export enum Priority {
  Highest = '0',
  High = '1',
  Medium = '2',
  None = '3',
  Low = '4',
  Lowest = '5',
}

export const DEFAULT_SYMBOLS = {
  prioritySymbols: {
    Highest: '🔺',
    High: '⏫',
    Medium: '🔼',
    Low: '🔽',
    Lowest: '⏬',
    None: '',
  },
  startDateSymbol: '🛫',
  createdDateSymbol: '➕',
  scheduledDateSymbol: '⏳',
  dueDateSymbol: '📅',
  doneDateSymbol: '✅',
  cancelledDateSymbol: '❌',
  recurrenceSymbol: '🔁',
  dependsOnSymbol: '⛔',
  idSymbol: '🆔',
} as const;

export function lableToIcon(label: string, value: any) {
  switch (label) {
    case 'priority':
      return priorityToIcon(value);
    case 'start':
      return DEFAULT_SYMBOLS.startDateSymbol;
    case 'created':
      return DEFAULT_SYMBOLS.createdDateSymbol;
    case 'scheduled':
      return DEFAULT_SYMBOLS.scheduledDateSymbol;
    case 'due':
      return DEFAULT_SYMBOLS.dueDateSymbol;
    case 'completion':
      return DEFAULT_SYMBOLS.doneDateSymbol;
    case 'cancelled':
      return DEFAULT_SYMBOLS.cancelledDateSymbol;
    case 'repeat':
      return DEFAULT_SYMBOLS.recurrenceSymbol;
    case 'dependsOn':
      return DEFAULT_SYMBOLS.dependsOnSymbol;
    case 'id':
      return DEFAULT_SYMBOLS.idSymbol;
  }

  return label;
}

export function lableToName(label: string) {
  switch (label) {
    case 'priority':
      return t('Priority');
    case 'start':
      return t('Start');
    case 'created':
      return t('Created');
    case 'scheduled':
      return t('Scheduled');
    case 'due':
      return t('Due');
    case 'completion':
      return t('Done');
    case 'cancelled':
      return t('Cancelled');
    case 'repeat':
      return t('Recurrence');
    case 'dependsOn':
      return t('Depends on');
    case 'id':
      return t('ID');
  }

  return label;
}

export function priorityToIcon(p: Priority) {
  switch (p) {
    case Priority.Highest:
      return DEFAULT_SYMBOLS.prioritySymbols.Highest;
    case Priority.High:
      return DEFAULT_SYMBOLS.prioritySymbols.High;
    case Priority.Medium:
      return DEFAULT_SYMBOLS.prioritySymbols.Medium;
    case Priority.Low:
      return DEFAULT_SYMBOLS.prioritySymbols.Low;
    case Priority.Lowest:
      return DEFAULT_SYMBOLS.prioritySymbols.Lowest;
  }
  return null;
}

export function iconToPriority(icon: string) {
  switch (icon) {
    case DEFAULT_SYMBOLS.prioritySymbols.Highest:
      return Priority.Highest;
    case DEFAULT_SYMBOLS.prioritySymbols.High:
      return Priority.High;
    case DEFAULT_SYMBOLS.prioritySymbols.Medium:
      return Priority.Medium;
    case DEFAULT_SYMBOLS.prioritySymbols.Low:
      return Priority.Low;
    case DEFAULT_SYMBOLS.prioritySymbols.Lowest:
      return Priority.Lowest;
  }
  return null;
}

export function getTasksPlugin() {
  if (!(app as any).plugins.enabledPlugins.has('obsidian-tasks-plugin')) {
    return null;
  }

  return (app as any).plugins.plugins['obsidian-tasks-plugin'];
}

function getTasksPluginSettings() {
  return (app as any).workspace.editorSuggest.suggests.find(
    (s: any) => s.settings && s.settings.taskFormat
  )?.settings;
}

export function getTaskStatusDone(): string {
  const settings = getTasksPluginSettings();
  const statuses = settings?.statusSettings;
  if (!statuses) return 'x';

  let done = statuses.coreStatuses?.find((s: any) => s.type === 'DONE');
  if (!done) done = statuses.customStatuses?.find((s: any) => s.type === 'DONE');
  if (!done) return 'x';

  return done.symbol;
}

export function getTaskStatusPreDone(): string {
  const settings = getTasksPluginSettings();
  const statuses = settings?.statusSettings;
  if (!statuses) return ' ';

  const done = getTaskStatusDone();

  let preDone = statuses.coreStatuses?.find((s: any) => s.nextStatusSymbol === done);
  if (!preDone) preDone = statuses.customStatuses?.find((s: any) => s.nextStatusSymbol === done);
  if (!preDone) return ' ';

  return preDone.symbol;
}

export function toggleTaskString(item: string, file: TFile): string | null {
  const plugin = getTasksPlugin();
  if (!plugin) return null;
  return plugin.apiV1?.executeToggleTaskDoneCommand?.(item, file.path) ?? null;
}

export function toggleTask(item: Item, file: TFile): [string[], string[], number] | null {
  const plugin = getTasksPlugin();
  if (!plugin) {
    return null;
  }

  const prefix = `- [${item.data.checkChar}] `;
  const originalLines = item.data.titleRaw.split(/\n\r?/g);

  const taskSettings = getTasksPluginSettings();
  const recurrenceOnNextLine = !!taskSettings?.recurrenceOnNextLine;

  let which = 0;
  const result = plugin.apiV1?.executeToggleTaskDoneCommand?.(prefix + originalLines[0], file.path);
  if (!result) return null;

  const checkChars: string[] = [];
  const resultLines = result.split(/\n/g).map((line: string, index: number) => {
    if (recurrenceOnNextLine && index === 0) {
      which = index;
    } else if (!recurrenceOnNextLine && index > 0) {
      which = index;
    }

    const match = line.match(/^- \[([^\]]+)\]/);
    if (match?.[1]) checkChars.push(match[1]);

    return [line.replace(/^- \[[^\]]+\] */, ''), ...originalLines.slice(1)].join('\n');
  });

  return [resultLines, checkChars, which];
}

/** A parsed inline field. */
export interface InlineField {
  /** The raw parsed key. */
  key: string;
  /** The raw value of the field. */
  value: string;
  /** The start column of the field. */
  start: number;
  /** The start column of the *value* for the field. */
  startValue: number;
  /** The end column of the field. */
  end: number;
  /** If this inline field was defined via a wrapping ('[' or '('), then the wrapping that was used. */
  wrapping?: string;
}

export const INLINE_FIELD_WRAPPERS: Readonly<Record<string, string>> = Object.freeze({
  '[': ']',
  '(': ')',
});

/** Find the '::' separator in an inline field. */
function findSeparator(
  line: string,
  start: number
): { key: string; valueIndex: number } | undefined {
  const sep = line.indexOf('::', start);
  if (sep < 0) return undefined;

  return { key: line.substring(start, sep).trim(), valueIndex: sep + 2 };
}

/**
 * Find a matching closing bracket that occurs at or after `start`, respecting nesting and escapes. If found,
 * returns the value contained within and the string index after the end of the value.
 */
function findClosing(
  line: string,
  start: number,
  open: string,
  close: string
): { value: string; endIndex: number } | undefined {
  let nesting = 0;
  let escaped = false;
  for (let index = start; index < line.length; index++) {
    const char = line.charAt(index);

    // Allows for double escapes like '\\' to be rendered normally.
    if (char == '\\') {
      escaped = !escaped;
      continue;
    }

    // If escaped, ignore the next character for computing nesting, regardless of what it is.
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char == open) nesting++;
    else if (char == close) nesting--;

    // Only occurs if we are on a close character and trhere is no more nesting.
    if (nesting < 0) return { value: line.substring(start, index).trim(), endIndex: index + 1 };

    escaped = false;
  }

  return undefined;
}

/** Try to completely parse an inline field starting at the given position. Assuems `start` is on a wrapping character. */
function findSpecificInlineField(line: string, start: number): InlineField | undefined {
  const open = line.charAt(start);

  const key = findSeparator(line, start + 1);
  if (key === undefined) return undefined;

  // Fail the match if we find any separator characters (not allowed in keys).
  for (const sep of Object.keys(INLINE_FIELD_WRAPPERS).concat(
    Object.values(INLINE_FIELD_WRAPPERS)
  )) {
    if (key.key.includes(sep)) return undefined;
  }

  const value = findClosing(line, key.valueIndex, open, INLINE_FIELD_WRAPPERS[open]);
  if (value === undefined) return undefined;

  return {
    key: key.key,
    value: value.value,
    start: start,
    startValue: key.valueIndex,
    end: value.endIndex,
    wrapping: open,
  };
}

const priorityRegex = /([🔺⏫🔼🔽⏬])\uFE0F?/u;
const startDateRegex = /🛫 *(\d{4}-\d{2}-\d{2})/u;
const createdDateRegex = /➕ *(\d{4}-\d{2}-\d{2})/u;
const scheduledDateRegex = /[⏳⌛] *(\d{4}-\d{2}-\d{2})/u;
const dueDateRegex = /[📅📆🗓] *(\d{4}-\d{2}-\d{2})/u;
const doneDateRegex = /✅ *(\d{4}-\d{2}-\d{2})/u;
const cancelledDateRegex = /❌ *(\d{4}-\d{2}-\d{2})/u;
const dependsOnRegex = /⛔\uFE0F? *([a-zA-Z0-9-_]+)/u;
const idRegex = /🆔 *([a-zA-Z0-9-_]+)/u;
const recurrenceRegex = /🔁 *([a-zA-Z0-9; !]+)/u;

export const taskFields = new Set([
  'priority',
  'start',
  'created',
  'scheduled',
  'due',
  'completion',
  'cancelled',
  'id',
  'dependsOn',
  'repeat',
]);

export const EMOJI_REGEXES = [
  { regex: priorityRegex, key: 'priority' },
  { regex: startDateRegex, key: 'start' },
  { regex: createdDateRegex, key: 'created' },
  { regex: scheduledDateRegex, key: 'scheduled' },
  { regex: dueDateRegex, key: 'due' },
  { regex: doneDateRegex, key: 'completion' },
  { regex: cancelledDateRegex, key: 'cancelled' },
  { regex: idRegex, key: 'id' },
  { regex: dependsOnRegex, key: 'dependsOn' },
  { regex: recurrenceRegex, key: 'repeat' },
];

/** Parse special completed/due/done task fields which are marked via emoji. */
function extractSpecialTaskFields(line: string): InlineField[] {
  const results: InlineField[] = [];

  for (const { regex, key } of EMOJI_REGEXES) {
    const match = regex.exec(line);
    if (!match) continue;

    let value = match[1];
    let end = match.index + match[0].length;

    if (key === 'priority') value = iconToPriority(value);
    else if (key === 'repeat') {
      const originalLen = value.length;
      value = RRule.fromText(value).toText();
      end -= originalLen - value.length;
    }

    results.push({
      key,
      value,
      start: match.index,
      startValue: match.index + 1,
      end,
      wrapping: 'emoji-shorthand',
    });
  }

  return results;
}

export function extractInlineFields(
  line: string,
  includeTaskFields: boolean = false
): InlineField[] | null {
  const dv = getDataviewPlugin();
  const tasks = getTasksPlugin();

  let fields: InlineField[] = [];
  if (dv) {
    for (const wrapper of Object.keys(INLINE_FIELD_WRAPPERS)) {
      let foundIndex = line.indexOf(wrapper);
      while (foundIndex >= 0) {
        const parsedField = findSpecificInlineField(line, foundIndex);
        if (!parsedField) {
          foundIndex = line.indexOf(wrapper, foundIndex + 1);
          continue;
        }

        fields.push(parsedField);
        foundIndex = line.indexOf(wrapper, parsedField.end);
      }
    }
  }

  if (tasks && includeTaskFields) fields = fields.concat(extractSpecialTaskFields(line));

  fields.sort((a, b) => a.start - b.start);

  const filteredFields: InlineField[] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (i == 0 || filteredFields[filteredFields.length - 1].end < f.start) {
      filteredFields.push(f);
    }
  }

  return filteredFields;
}

export function getDataviewPlugin() {
  if (!(app as any).plugins.enabledPlugins.has('dataview')) {
    return null;
  }

  return (app as any).plugins.plugins['dataview'];
}
