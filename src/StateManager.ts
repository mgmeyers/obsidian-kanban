import update from 'immutability-helper';
import { App, TFile, moment } from 'obsidian';
import { useEffect, useState } from 'preact/compat';

import { KanbanView } from './KanbanView';
import { KanbanSettings, SettingRetrievers } from './Settings';
import { getDefaultDateFormat, getDefaultTimeFormat } from './components/helpers';
import { Board, BoardTemplate, Item } from './components/types';
import { ListFormat } from './parsers/List';
import { BaseFormat, frontmatterKey, shouldRefreshBoard } from './parsers/common';
import { defaultDateTrigger, defaultTimeTrigger } from './settingHelpers';

export class StateManager {
  private onEmpty: () => void;
  private getGlobalSettings: () => KanbanSettings;

  private stateReceivers: Array<(state: Board) => void> = [];
  private settingsNotifiers: Map<keyof KanbanSettings, Array<() => void>> = new Map();

  private viewSet: Set<KanbanView> = new Set();
  private compiledSettings: KanbanSettings = {};

  public app: App;
  public state: Board;
  public file: TFile;

  private parser: BaseFormat;

  constructor(
    app: App,
    initialView: KanbanView,
    initialData: string,
    onEmpty: () => void,
    getGlobalSettings: () => KanbanSettings
  ) {
    this.app = app;
    this.file = initialView.file;
    this.onEmpty = onEmpty;
    this.getGlobalSettings = getGlobalSettings;
    this.parser = new ListFormat(this);

    this.registerView(initialView, initialData, true);
  }

  getAView(): KanbanView {
    return this.viewSet.values().next().value;
  }

  hasError(): boolean {
    return !!this.state?.data?.errors?.length;
  }

  registerView(view: KanbanView, data: string, shouldParseData: boolean) {
    if (!this.viewSet.has(view)) {
      this.viewSet.add(view);
      view.initHeaderButtons();
    }

    if (shouldParseData) {
      this.newBoard(data);
    }
  }

  unregisterView(view: KanbanView) {
    if (this.viewSet.has(view)) {
      this.viewSet.delete(view);

      if (this.viewSet.size === 0) {
        this.onEmpty();
      }
    }
  }

  buildSettingRetrievers(): SettingRetrievers {
    return {
      getGlobalSettings: this.getGlobalSettings,
      getGlobalSetting: this.getGlobalSetting,
      getSetting: this.getSetting,
    };
  }

  newBoard(md: string) {
    try {
      this.setState(this.getParsedBoard(md), false);
    } catch (e) {
      this.setError(e);
    }
  }

  saveToDisk() {
    if (this.state.data.errors.length > 0) {
      return;
    }

    const view = this.getAView();

    if (view) {
      const fileStr = this.parser.boardToMd(this.state);
      view.requestSaveToDisk(fileStr);

      this.viewSet.forEach((view) => {
        view.data = fileStr;
      });
    }
  }

  softRefresh() {
    this.stateReceivers.forEach((receiver) => receiver({ ...this.state }));
  }

  forceRefresh() {
    if (this.state) {
      try {
        this.compileSettings();
        this.state = this.parser.reparseBoard();

        this.stateReceivers.forEach((receiver) => receiver(this.state));
        this.settingsNotifiers.forEach((notifiers) => {
          notifiers.forEach((fn) => fn());
        });
        this.viewSet.forEach((view) => view.initHeaderButtons());
      } catch (e) {
        console.error(e);
        this.setError(e);
      }
    }
  }

  setState(state: Board | ((board: Board) => Board), shouldSave: boolean = true) {
    try {
      const oldSettings = this.state?.data.settings;
      const newState = typeof state === 'function' ? state(this.state) : state;
      const newSettings = newState?.data.settings;

      if (oldSettings && newSettings && shouldRefreshBoard(oldSettings, newSettings)) {
        this.state = update(this.state, {
          data: {
            settings: {
              $set: newSettings,
            },
          },
        });
        this.compileSettings();
        this.state = this.parser.reparseBoard();
      } else {
        this.state = newState;
        this.compileSettings();
      }

      this.viewSet.forEach((view) => {
        view.initHeaderButtons();
        view.validatePreviewCache(newState);
      });

      if (shouldSave) {
        this.saveToDisk();
      }

      this.stateReceivers.forEach((receiver) => receiver(this.state));

      if (oldSettings !== newSettings && newSettings) {
        this.settingsNotifiers.forEach((notifiers, key) => {
          if ((!oldSettings && newSettings) || oldSettings[key] !== newSettings[key]) {
            notifiers.forEach((fn) => fn());
          }
        });
      }
    } catch (e) {
      console.error(e);
      this.setError(e);
    }
  }

  useState(): Board {
    const [state, setState] = useState(this.state);

    useEffect(() => {
      this.stateReceivers.push((state) => setState(state));
      setState(this.state);
      return () => {
        this.stateReceivers.remove(setState);
      };
    }, []);

    return state;
  }

  useSetting<K extends keyof KanbanSettings>(key: K): KanbanSettings[K] {
    const [state, setState] = useState<KanbanSettings[K]>(this.getSetting(key));

    useEffect(() => {
      const receiver = () => setState(this.getSetting(key));

      if (this.settingsNotifiers.has(key)) {
        this.settingsNotifiers.get(key).push(receiver);
      } else {
        this.settingsNotifiers.set(key, [receiver]);
      }

      return () => {
        this.settingsNotifiers.get(key).remove(receiver);
      };
    }, []);

    return state;
  }

  compileSettings(suppliedSettings?: KanbanSettings) {
    const globalKeys = this.getGlobalSetting('metadata-keys') || [];
    const localKeys = this.getSettingRaw('metadata-keys', suppliedSettings) || [];

    const dateFormat =
      this.getSettingRaw('date-format', suppliedSettings) || getDefaultDateFormat(this.app);
    const dateDisplayFormat =
      this.getSettingRaw('date-display-format', suppliedSettings) || dateFormat;

    const timeFormat =
      this.getSettingRaw('time-format', suppliedSettings) || getDefaultTimeFormat(this.app);

    const archiveDateFormat =
      this.getSettingRaw('archive-date-format', suppliedSettings) || `${dateFormat} ${timeFormat}`;

    this.compiledSettings = {
      [frontmatterKey]: this.getSettingRaw(frontmatterKey, suppliedSettings) || 'board',
      'date-format': dateFormat,
      'date-display-format': dateDisplayFormat,
      'date-time-display-format': dateDisplayFormat + ' ' + timeFormat,
      'date-trigger': this.getSettingRaw('date-trigger', suppliedSettings) || defaultDateTrigger,
      'time-format': timeFormat,
      'time-trigger': this.getSettingRaw('time-trigger', suppliedSettings) || defaultTimeTrigger,
      'link-date-to-daily-note': this.getSettingRaw('link-date-to-daily-note', suppliedSettings),
      'hide-date-in-title': this.getSettingRaw('hide-date-in-title', suppliedSettings) ?? false,
      'hide-tags-in-title': this.getSettingRaw('hide-tags-in-title', suppliedSettings) ?? false,
      'hide-date-display': this.getSettingRaw('hide-date-display', suppliedSettings) ?? true,
      'hide-tags-display': this.getSettingRaw('hide-tags-display', suppliedSettings) ?? true,
      'metadata-keys': [...globalKeys, ...localKeys],
      'archive-date-separator': this.getSettingRaw('archive-date-separator') || '',
      'archive-date-format': archiveDateFormat,
      'show-add-list': this.getSettingRaw('show-add-list', suppliedSettings) ?? true,
      'show-archive-all': this.getSettingRaw('show-archive-all', suppliedSettings) ?? true,
      'show-view-as-markdown':
        this.getSettingRaw('show-view-as-markdown', suppliedSettings) ?? true,
      'show-board-settings': this.getSettingRaw('show-board-settings', suppliedSettings) ?? true,
      'show-search': this.getSettingRaw('show-search', suppliedSettings) ?? true,
      'show-set-view': this.getSettingRaw('show-set-view', suppliedSettings) ?? true,
      'tag-colors': this.getSettingRaw('tag-colors', suppliedSettings) ?? [],
      'tag-sort': this.getSettingRaw('tag-sort', suppliedSettings) ?? [],
      'date-colors': this.getSettingRaw('date-colors', suppliedSettings) ?? [],
      'tag-action': this.getSettingRaw('tag-action', suppliedSettings) ?? 'obsidian',
    };
  }

  getSetting = <K extends keyof KanbanSettings>(
    key: K,
    suppliedLocalSettings?: KanbanSettings
  ): KanbanSettings[K] => {
    if (suppliedLocalSettings?.[key] !== undefined) {
      return suppliedLocalSettings[key];
    }

    if (this.compiledSettings?.[key] !== undefined) {
      return this.compiledSettings[key];
    }

    return this.getSettingRaw(key);
  };

  getSettingRaw = <K extends keyof KanbanSettings>(
    key: K,
    suppliedLocalSettings?: KanbanSettings
  ): KanbanSettings[K] => {
    if (suppliedLocalSettings?.[key] !== undefined) {
      return suppliedLocalSettings[key];
    }

    if (this.state?.data?.settings?.[key] !== undefined) {
      return this.state.data.settings[key];
    }

    return this.getGlobalSetting(key);
  };

  getGlobalSetting = <K extends keyof KanbanSettings>(key: K): KanbanSettings[K] => {
    const globalSettings = this.getGlobalSettings();

    if (globalSettings?.[key] !== undefined) {
      return globalSettings[key];
    }

    return null;
  };

  getParsedBoard(data: string) {
    const trimmedContent = data.trim();

    let board: Board = {
      ...BoardTemplate,
      id: this.file.path,
      children: [],
      data: {
        archive: [],
        settings: { [frontmatterKey]: 'board' },
        frontmatter: {},
        isSearching: false,
        errors: [],
      },
    };

    try {
      if (trimmedContent) {
        board = this.parser.mdToBoard(trimmedContent);
      }
    } catch (e) {
      console.error(e);

      board = update(board, {
        data: {
          errors: {
            $push: [{ description: e.toString(), stack: e.stack }],
          },
        },
      });
    }

    return board;
  }

  setError(e: Error) {
    this.setState(
      update(this.state, {
        data: {
          errors: {
            $push: [{ description: e.toString(), stack: e.stack }],
          },
        },
      }),
      false
    );
  }

  onFileMetadataChange() {
    this.reparseBoardFromMd();
  }

  async reparseBoardFromMd() {
    try {
      this.setState(this.getParsedBoard(this.getAView().data), false);
    } catch (e) {
      console.error(e);
      this.setError(e);
    }
  }

  async archiveCompletedCards() {
    const board = this.state;

    const archived: Item[] = [];
    const shouldAppendArchiveDate = !!this.getSetting('archive-with-date');
    const archiveDateSeparator = this.getSetting('archive-date-separator');
    const archiveDateFormat = this.getSetting('archive-date-format');
    const archiveDateAfterTitle = this.getSetting('append-archive-date');

    const appendArchiveDate = (item: Item) => {
      const newTitle = [moment().format(archiveDateFormat)];

      if (archiveDateSeparator) newTitle.push(archiveDateSeparator);

      newTitle.push(item.data.titleRaw);

      if (archiveDateAfterTitle) newTitle.reverse();

      const titleRaw = newTitle.join(' ');

      return this.parser.updateItemContent(item, titleRaw);
    };

    const lanes = board.children.map((lane) => {
      return update(lane, {
        children: {
          $set: lane.children.filter((item) => {
            if (lane.data.shouldMarkItemsComplete || item.data.isComplete) {
              archived.push(item);
            }

            return !item.data.isComplete && !lane.data.shouldMarkItemsComplete;
          }),
        },
      });
    });

    this.app.workspace.trigger('kanban:board-cards-archived', this.file, archived);

    try {
      this.setState(
        update(board, {
          children: {
            $set: lanes,
          },
          data: {
            archive: {
              $push: shouldAppendArchiveDate
                ? await Promise.all(archived.map((item) => appendArchiveDate(item)))
                : archived,
            },
          },
        })
      );
    } catch (e) {
      this.setError(e);
    }
  }

  getNewItem(content: string, isComplete?: boolean, forceEdit?: boolean) {
    return this.parser.newItem(content, isComplete, forceEdit);
  }

  updateItemContent(item: Item, content: string) {
    return this.parser.updateItemContent(item, content);
  }
}
