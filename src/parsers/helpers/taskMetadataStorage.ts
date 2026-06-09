import { moment } from 'obsidian';

export type KanbanTaskPriority = 'low' | 'medium' | 'high';

export const tasksDateFormat = 'YYYY-MM-DD';

const tasksPrioritySymbols: Record<KanbanTaskPriority, string> = {
  high: '⏫',
  medium: '🔼',
  low: '🔽',
};

const tasksPriorityBySymbol: Record<string, KanbanTaskPriority | undefined> = {
  '⏫': 'high',
  '🔼': 'medium',
  '🔽': 'low',
};

const tasksDueDateRegex = /(^|\s)([📅📆🗓]\uFE0F? *)(\d{4}-\d{2}-\d{2})/gu;
const tasksPriorityRegex = /(^|\s)([🔺⏫🔼🔽⏬]\uFE0F?)/gu;

interface TokenMatch {
  start: number;
  end: number;
  value: string;
}

export interface TasksCompatibleMetadata {
  dueDate?: string;
  dueDateRange?: { start: number; end: number };
  priority?: KanbanTaskPriority;
  prioritySymbol?: string;
  priorityRange?: { start: number; end: number };
}

export interface KanbanLegacyMetadataOptions {
  dateTrigger?: string;
  dateFormat?: string;
  priorityTrigger?: string;
}

function escapeRegExpStr(str: string) {
  return str.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function splitFirstLine(titleRaw: string) {
  const lineEnd = titleRaw.indexOf('\n');

  if (lineEnd === -1) {
    return { firstLine: titleRaw, rest: '' };
  }

  return {
    firstLine: titleRaw.slice(0, lineEnd),
    rest: titleRaw.slice(lineEnd),
  };
}

function getLastMatch(line: string, regex: RegExp): TokenMatch | null {
  regex.lastIndex = 0;

  let lastMatch: TokenMatch | null = null;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line))) {
    lastMatch = {
      start: match.index,
      end: match.index + match[0].length,
      value: match[3] ?? match[2],
    };
  }

  return lastMatch;
}

function removeRangesFromFirstLine(titleRaw: string, ranges: Array<{ start: number; end: number }>) {
  const { firstLine, rest } = splitFirstLine(titleRaw);
  let nextFirstLine = firstLine;

  [...ranges]
    .sort((a, b) => b.start - a.start)
    .forEach((range) => {
      nextFirstLine = nextFirstLine.slice(0, range.start) + nextFirstLine.slice(range.end);
    });

  return nextFirstLine.replace(/\s{2,}/g, ' ').trim() + rest;
}

function appendTokenToFirstLine(titleRaw: string, token: string) {
  const { firstLine, rest } = splitFirstLine(titleRaw);
  const separator = firstLine.trim().length ? ' ' : '';

  return `${firstLine.trim()}${separator}${token}${rest}`;
}

function getLegacyDueDateRegex(dateTrigger: string) {
  const trigger = escapeRegExpStr(dateTrigger);

  return new RegExp(
    `(^|\\s)${trigger}(?:\\{([^}]+)\\}|\\[\\[([^\\]]+)\\]\\]|\\[([^\\]]+)\\]\\([^)]+\\))`,
    'gu'
  );
}

function getLegacyPriorityRegex(priorityTrigger: string) {
  return new RegExp(`(^|\\s)${escapeRegExpStr(priorityTrigger)}\\{([^}]+)\\}`, 'giu');
}

function parseLegacyDueDate(titleRaw: string, options: KanbanLegacyMetadataOptions) {
  const { firstLine } = splitFirstLine(titleRaw);
  const dateTrigger = options.dateTrigger || '@';
  const dateFormat = options.dateFormat || tasksDateFormat;
  const regex = getLegacyDueDateRegex(dateTrigger);
  regex.lastIndex = 0;

  let lastMatch: { start: number; end: number; date: string } | null = null;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(firstLine))) {
    const rawDate = match[2] || match[3] || match[4];
    const parsed = moment(rawDate, dateFormat);

    if (!parsed.isValid()) continue;

    lastMatch = {
      start: match.index,
      end: match.index + match[0].length,
      date: parsed.format(tasksDateFormat),
    };
  }

  return lastMatch;
}

function parseLegacyPriority(titleRaw: string, options: KanbanLegacyMetadataOptions) {
  const { firstLine } = splitFirstLine(titleRaw);
  const priorityTrigger = options.priorityTrigger || '!!';
  const regex = getLegacyPriorityRegex(priorityTrigger);
  regex.lastIndex = 0;

  let lastMatch: { start: number; end: number; priority: KanbanTaskPriority } | null = null;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(firstLine))) {
    const priority = match[2]?.toLowerCase();

    if (priority !== 'low' && priority !== 'medium' && priority !== 'high') continue;

    lastMatch = {
      start: match.index,
      end: match.index + match[0].length,
      priority,
    };
  }

  return lastMatch;
}

export function parseTasksCompatibleMetadata(titleRaw: string): TasksCompatibleMetadata {
  const { firstLine } = splitFirstLine(titleRaw);
  const dueDateMatch = getLastMatch(firstLine, tasksDueDateRegex);
  const priorityMatch = getLastMatch(firstLine, tasksPriorityRegex);
  const prioritySymbol = priorityMatch?.value.replace('\uFE0F', '');

  return {
    dueDate: dueDateMatch?.value,
    dueDateRange: dueDateMatch
      ? { start: dueDateMatch.start, end: dueDateMatch.end }
      : undefined,
    priority: prioritySymbol ? tasksPriorityBySymbol[prioritySymbol] : undefined,
    prioritySymbol,
    priorityRange: priorityMatch
      ? { start: priorityMatch.start, end: priorityMatch.end }
      : undefined,
  };
}

export function upsertDueDate(
  titleRaw: string,
  date: string,
  options: KanbanLegacyMetadataOptions = {}
) {
  const withoutDueDate = removeDueDate(titleRaw, options);

  return appendTokenToFirstLine(withoutDueDate, `📅 ${date}`);
}

export function removeDueDate(titleRaw: string, options: KanbanLegacyMetadataOptions = {}) {
  const metadata = parseTasksCompatibleMetadata(titleRaw);
  const legacyDueDate = parseLegacyDueDate(titleRaw, options);
  const ranges = [metadata.dueDateRange, legacyDueDate].filter(Boolean) as Array<{
    start: number;
    end: number;
  }>;

  if (!ranges.length) return titleRaw;

  return removeRangesFromFirstLine(titleRaw, ranges);
}

export function upsertPriority(
  titleRaw: string,
  priority: KanbanTaskPriority,
  options: KanbanLegacyMetadataOptions = {}
) {
  return appendTokenToFirstLine(removePriority(titleRaw, options), tasksPrioritySymbols[priority]);
}

export function removePriority(titleRaw: string, options: KanbanLegacyMetadataOptions = {}) {
  const metadata = parseTasksCompatibleMetadata(titleRaw);
  const legacyPriority = parseLegacyPriority(titleRaw, options);
  const ranges = [metadata.priorityRange, legacyPriority].filter(Boolean) as Array<{
    start: number;
    end: number;
  }>;

  if (!ranges.length) return titleRaw;

  return removeRangesFromFirstLine(titleRaw, ranges);
}

export function normalizeKanbanTaskMetadata(
  titleRaw: string,
  options: KanbanLegacyMetadataOptions = {}
) {
  const legacyDueDate = parseLegacyDueDate(titleRaw, options);
  const legacyPriority = parseLegacyPriority(titleRaw, options);
  let nextTitleRaw = titleRaw;

  if (legacyDueDate) {
    nextTitleRaw = removeDueDate(nextTitleRaw, options);
    nextTitleRaw = upsertDueDate(nextTitleRaw, legacyDueDate.date);
  }

  if (legacyPriority) {
    nextTitleRaw = removePriority(nextTitleRaw, options);
    nextTitleRaw = upsertPriority(nextTitleRaw, legacyPriority.priority);
  }

  return nextTitleRaw;
}
