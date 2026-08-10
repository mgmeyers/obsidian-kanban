/**
 * The real package ships a CJS build that `require`s `obsidian`, which only
 * exists inside the app, so vitest aliases the whole package to this stub.
 * `src/helpers.ts` is the only consumer and uses just these two functions.
 */
import { moment } from 'obsidian';

const DEFAULT_FORMAT = 'YYYY-MM-DD';

export interface IDailyNoteSettings {
  folder?: string;
  format?: string;
  template?: string;
}

export function getDailyNoteSettings(): IDailyNoteSettings {
  return { folder: '', format: DEFAULT_FORMAT, template: '' };
}

export function getDateFromFile(file: any, _granularity?: string) {
  const date = moment(file?.basename ?? '', DEFAULT_FORMAT, true);

  return date.isValid() ? date : null;
}
