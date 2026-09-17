/**
 * Stub for `obsidian-daily-notes-interface`. It is a CommonJS module that
 * `require`s `obsidian` at load time, so it cannot be aliased away by import
 * rewriting. `src/helpers.ts` pulls it in, but only for daily-note navigation,
 * which the CLI never performs.
 */
export function getDailyNoteSettings() {
  return { format: 'YYYY-MM-DD', folder: '', template: '' };
}

export function getDateFromFile(): null {
  return null;
}
