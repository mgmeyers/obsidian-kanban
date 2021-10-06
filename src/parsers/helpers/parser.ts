import { Stat } from 'obsidian';

export interface FileAccessor {
  isEmbed: boolean;
  target: string;
  stats?: Stat;
}

export function markRangeForDeletion(
  str: string,
  range: { start: number; end: number }
): string {
  const len = range.end - range.start;

  return (
    str.slice(0, range.start) + '\u0000'.repeat(len) + str.slice(range.end)
  );
}

export function executeDeletion(str: string) {
  return str.replace(/[\0\s]+/g, ' ').trim();
}
