import { t } from 'src/lang/helpers';

import {
  DEFAULT_SYMBOLS,
  DataviewTaskSerializer,
  DefaultTaskSerializer,
  Priority,
} from './obsidian-tasks/serializers';

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
    case 'recurrenceRule':
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
    case 'recurrenceRule':
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

let defaultSerializer: DefaultTaskSerializer;
function hasTaskMetadata(str: string) {
  return /[🔺⏫🔼🔽⏬🛫➕⏳⌛📅📆🗓✅❌🔁⛔🆔]\uFE0F?/u.test(str);
}

function removeNull(details: Record<string, any>): null | Record<string, any> {
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
  if (
    !(app as any).plugins?.enabledPlugins?.has('obsidian-tasks-plugin') ||
    !hasTaskMetadata(str)
  ) {
    return null;
  }

  if (!defaultSerializer) defaultSerializer = new DefaultTaskSerializer(DEFAULT_SYMBOLS);
  return removeNull(defaultSerializer.deserialize(str));
}

let dataviewSerializer: DataviewTaskSerializer;
export function parseDataviewTaskMetadata(str: string): Record<string, any> {
  if (
    !(app as any).plugins?.enabledPlugins?.has('obsidian-tasks-plugin') ||
    !(app as any).plugins?.enabledPlugins?.has('dataview') ||
    !str.includes('::')
  ) {
    return null;
  }

  if (!dataviewSerializer) dataviewSerializer = new DataviewTaskSerializer();
  return removeNull(dataviewSerializer.deserialize(str));
}
