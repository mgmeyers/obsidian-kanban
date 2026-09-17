import type { KanbanFormat, KanbanSettings } from 'src/Settings';
import type { StateManager } from 'src/StateManager';
import { frontmatterKey } from 'src/parsers/common';

const defaultDateTrigger = '@';
const defaultTimeTrigger = '@@';
const defaultMetadataPosition = 'body';
const defaultDateFormat = 'YYYY-MM-DD';
const defaultTimeFormat = 'HH:mm';

/**
 * The five members of `StateManager` the parser actually touches, implemented
 * against plain data. `getFirstLinkpathDest` always returns null: the CLI does
 * not index a vault, so links stay as written text, which round-trips.
 */
export class StateManagerStub {
  app = {
    metadataCache: {
      getFirstLinkpathDest: (): null => null,
      getFileCache: (): null => null,
    },
    vault: {},
    plugins: { plugins: {}, enabledPlugins: new Set<string>() },
    internalPlugins: { plugins: {} },
  };

  file: { path: string };
  settings: KanbanSettings = {};
  compiledSettings: KanbanSettings = {};
  errors: Error[] = [];

  constructor(filePath: string) {
    this.file = { path: filePath };
    this.compileSettings();
  }

  compileSettings(suppliedSettings?: KanbanSettings) {
    if (suppliedSettings) this.settings = suppliedSettings;

    const raw = <K extends keyof KanbanSettings>(key: K) => this.getSettingRaw(key);

    const dateFormat = raw('date-format') || defaultDateFormat;
    const dateDisplayFormat = raw('date-display-format') || dateFormat;
    const timeFormat = raw('time-format') || defaultTimeFormat;

    this.compiledSettings = {
      [frontmatterKey]: (raw(frontmatterKey as keyof KanbanSettings) || 'board') as KanbanFormat,
      'date-format': dateFormat,
      'date-display-format': dateDisplayFormat,
      'date-time-display-format': `${dateDisplayFormat} ${timeFormat}`,
      'date-trigger': raw('date-trigger') || defaultDateTrigger,
      'inline-metadata-position': raw('inline-metadata-position') || defaultMetadataPosition,
      'time-format': timeFormat,
      'time-trigger': raw('time-trigger') || defaultTimeTrigger,
      'link-date-to-daily-note': raw('link-date-to-daily-note'),
      'move-dates': raw('move-dates'),
      'move-tags': raw('move-tags'),
      'move-task-metadata': raw('move-task-metadata'),
      'metadata-keys': raw('metadata-keys') || [],
      'archive-date-separator': raw('archive-date-separator') || '',
      'archive-date-format': raw('archive-date-format') || `${dateFormat} ${timeFormat}`,
      'tag-colors': raw('tag-colors') ?? [],
      'tag-sort': raw('tag-sort') ?? [],
      'date-colors': raw('date-colors') ?? [],
      'tag-action': raw('tag-action') ?? 'obsidian',
    };
  }

  getSetting = <K extends keyof KanbanSettings>(
    key: K,
    suppliedLocalSettings?: KanbanSettings
  ): KanbanSettings[K] => {
    if (suppliedLocalSettings?.[key] !== undefined) return suppliedLocalSettings[key];
    if (this.compiledSettings?.[key] !== undefined) return this.compiledSettings[key];
    return this.getSettingRaw(key);
  };

  getSettingRaw = <K extends keyof KanbanSettings>(key: K): KanbanSettings[K] => {
    return this.settings?.[key];
  };

  setError(e: Error) {
    this.errors.push(e);
  }
}

export function createStateManager(filePath: string): StateManager {
  return new StateManagerStub(filePath) as unknown as StateManager;
}
