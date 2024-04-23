import { TFile } from 'obsidian';
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
    case 'description':
      return null;
    case 'priority':
      return priorityToIcon(value);
    case 'startDate':
      return DEFAULT_SYMBOLS.startDateSymbol;
    case 'createdDate':
      return DEFAULT_SYMBOLS.createdDateSymbol;
    case 'scheduledDate':
      return DEFAULT_SYMBOLS.scheduledDateSymbol;
    case 'dueDate':
      return DEFAULT_SYMBOLS.dueDateSymbol;
    case 'doneDate':
      return DEFAULT_SYMBOLS.doneDateSymbol;
    case 'cancelledDate':
      return DEFAULT_SYMBOLS.cancelledDateSymbol;
    case 'recurrence':
      return DEFAULT_SYMBOLS.recurrenceSymbol;
    case 'dependsOn':
      return DEFAULT_SYMBOLS.dependsOnSymbol;
    case 'id':
      return DEFAULT_SYMBOLS.idSymbol;
  }
}

export function lableToName(label: string) {
  switch (label) {
    case 'description':
      return null;
    case 'priority':
      return t('Priority');
    case 'startDate':
      return t('Start');
    case 'createdDate':
      return t('Created');
    case 'scheduledDate':
      return t('Scheduled');
    case 'dueDate':
      return t('Due');
    case 'doneDate':
      return t('Done');
    case 'cancelledDate':
      return t('Cancelled');
    case 'recurrence':
      return t('Recurrence');
    case 'dependsOn':
      return t('Depends on');
    case 'id':
      return t('ID');
  }
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

function getTasksPlugin() {
  if (!app.plugins.enabledPlugins.has('obsidian-tasks-plugin')) {
    return null;
  }

  return app.plugins.plugins['obsidian-tasks-plugin'];
}

function hasTaskMetadata(str: string) {
  return /[🔺⏫🔼🔽⏬🛫➕⏳⌛📅📆🗓✅❌🔁⛔🆔]\uFE0F?/u.test(str);
}

function removeNull(details: Record<string, any>): null | Record<string, any> {
  delete details.tags;

  for (const key in details) {
    const k = key as keyof Record<string, any>;
    const detail = details[k];
    if (
      detail === undefined ||
      detail === null ||
      detail === '' ||
      (Array.isArray(detail) && detail.length === 0)
    ) {
      delete details[k];
    }
  }
  if (!Object.keys(details).length) return null;
  return details;
}

export function parseDefaultTaskMetadata(str: string): Record<string, any> {
  const plugin = getTasksPlugin();
  if (!plugin || !hasTaskMetadata(str)) {
    return null;
  }

  const defaultSerializer = plugin.apiV1?.getDefaultTaskSerializer?.();
  if (!defaultSerializer) return null;

  return removeNull(defaultSerializer.deserialize(str));
}

export function parseDataviewTaskMetadata(str: string): Record<string, any> {
  const plugin = getTasksPlugin();
  if (!plugin || !str.includes('::')) {
    return null;
  }

  const dataviewSerializer = plugin.apiV1?.getDataviewTaskSerializer?.();
  if (!dataviewSerializer) return null;
  return removeNull(dataviewSerializer.deserialize(str));
}

export function toggleItemString(item: string, file: TFile): string | null {
  const plugin = getTasksPlugin();
  if (!plugin) return null;
  return plugin.apiV1?.toggleLine?.(item, file.path)?.text ?? null;
}

export function toggleItem(item: Item, file: TFile): [string[], number] | null {
  const plugin = getTasksPlugin();
  if (!plugin) {
    return null;
  }

  const prefix = item.data.isComplete ? '- [x] ' : '- [ ] ';
  const originalLines = item.data.titleRaw.split(/\n\r?/g);

  let which = -1;
  const result = plugin.apiV1?.toggleLine?.(prefix + originalLines[0], file.path);
  if (!result) return null;

  const resultLines = result.text.split(/\n/g).map((line: string, index: number) => {
    if (item.data.isComplete && line.startsWith('- [ ]')) {
      which = index;
    } else if (!item.data.isComplete && line.startsWith('- [x]')) {
      which = index;
    }
    return [line.replace(/^- \[.\] */, ''), ...originalLines.slice(1)].join('\n');
  });

  return [resultLines, which];
}
