import update from 'immutability-helper';
import { App, TFile, moment } from 'obsidian';
import React from 'react';

import {
  getDefaultDateFormat,
  getDefaultTimeFormat,
} from './components/helpers';
import { renderMarkdown } from './components/helpers/renderMarkdown';
import { Board, BoardTemplate, Item } from './components/types';
import { KanbanView } from './KanbanView';
import { KanbanParser } from './parsers/basic';
import { defaultDateTrigger, defaultTimeTrigger } from './settingHelpers';
import { KanbanSettings, SettingRetrievers } from './Settings';

export class StateManager {
  private onEmpty: () => void;
  private getGlobalSettings: () => KanbanSettings;

  private stateReceivers: Array<(state: Board) => void> = [];
  private settingsNotifiers: Map<keyof KanbanSettings, Array<() => void>> =
    new Map();

  private views: Map<string, KanbanView> = new Map();
  private ids: string[] = [];
  private compiledSettings: KanbanSettings = {};

  public parser: KanbanParser;
  private lastParsedData: string;

  public app: App;
  public state: Board;
  public file: TFile;

  constructor(
    app: App,
    initialView: KanbanView,
    initialData: string,
    onEmpty: () => void,
    getGlobalSettings: () => KanbanSettings
  ) {
    this.app = app;
    this.registerView(initialView, initialData);

    this.file = initialView.file;
    this.onEmpty = onEmpty;
    this.getGlobalSettings = getGlobalSettings;

    this.parser = new KanbanParser(
      app,
      this.file,
      this.buildMarkdownRenderer(),
      this.buildSettingRetrievers()
    );

    this.newBoard(initialData);
  }

  getAView(): KanbanView {
    const viewId = this.ids[0];
    return this.views.get(viewId);
  }

  registerView(view: KanbanView, data: string) {
    if (!this.views.has(view.id)) {
      this.ids.push(view.id);
      this.views.set(view.id, view);
    }

    if (this.lastParsedData && this.lastParsedData !== data) {
      this.newBoard(data);
    }
  }

  unregisterView(view: KanbanView) {
    if (this.views.has(view.id)) {
      this.ids.remove(view.id);
      this.views.delete(view.id);

      if (this.views.size === 0) {
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

  buildMarkdownRenderer() {
    return (md: string) => {
      return renderMarkdown(this.getAView(), md);
    };
  }

  private isParseThrottled = false;
  newBoard(md: string) {
    if (!this.isParseThrottled) {
      this.isParseThrottled = true;
      this.setState(this.getParsedBoard(md), false);
      this.lastParsedData = md;

      setTimeout(() => {
        this.isParseThrottled = false;
      }, 50);
    }
  }

  private isSaveThrottled = false;
  saveToDisk() {
    if (this.state.data.errors.length > 0) {
      return;
    }

    if (!this.isSaveThrottled) {
      this.isSaveThrottled = true;

      const view = this.getAView();
      const fileStr = this.parser.boardToMd(this.state);

      view.requestSaveToDisk(fileStr);

      this.views.forEach((view) => {
        view.data = fileStr;
      });

      setTimeout(() => {
        this.isSaveThrottled = false;
      }, 50);
    }
  }

  forceRefresh() {
    this.state = this.parser.refreshBoard(this.state);
    this.stateReceivers.forEach((receiver) => receiver(this.state));
  }

  setState(
    state: Board | ((board: Board) => Board),
    shouldSave: boolean = true
  ) {
    const oldSettings = this.state?.data.settings;
    const newState = typeof state === 'function' ? state(this.state) : state;
    const newSettings = newState?.data.settings;

    if (
      oldSettings &&
      newSettings &&
      this.parser.shouldRefreshBoard(oldSettings, newSettings)
    ) {
      this.state = this.parser.refreshBoard(newState);
    } else {
      this.state = newState;
    }

    this.compiledSettings = this.compileSettings();

    if (shouldSave) {
      this.saveToDisk();
    }

    this.stateReceivers.forEach((receiver) => receiver(this.state));

    if (oldSettings !== newSettings && newSettings) {
      this.settingsNotifiers.forEach((notifiers, key) => {
        if (
          (!oldSettings && newSettings) ||
          oldSettings[key] !== newSettings[key]
        ) {
          notifiers.forEach((fn) => fn());
        }
      });
    }
  }

  useState(): Board {
    const [state, setState] = React.useState(this.state);

    React.useEffect(() => {
      this.stateReceivers.push(setState);

      return () => {
        this.stateReceivers.remove(setState);
      };
    }, []);

    return state;
  }

  useSetting<K extends keyof KanbanSettings>(key: K): KanbanSettings[K] {
    const [state, setState] = React.useState<KanbanSettings[K]>(
      this.getSetting(key)
    );

    React.useEffect(() => {
      const receiver = () => {
        setState(this.getSetting(key));
      };

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

  compileSettings(suppliedSettings?: KanbanSettings): KanbanSettings {
    const globalKeys = this.getGlobalSetting('metadata-keys') || [];
    const localKeys =
      this.getSettingRaw('metadata-keys', suppliedSettings) || [];

    const dateFormat =
      this.getSettingRaw('date-format', suppliedSettings) ||
      getDefaultDateFormat(this.app);

    const timeFormat =
      this.getSettingRaw('time-format', suppliedSettings) ||
      getDefaultTimeFormat(this.app);

    const archiveDateFormat =
      this.getSettingRaw('prepend-archive-format', suppliedSettings) ||
      `${dateFormat} ${timeFormat}`;

    return {
      'date-format': dateFormat,
      'date-display-format':
        this.getSettingRaw('date-display-format', suppliedSettings) ||
        dateFormat,
      'date-trigger':
        this.getSettingRaw('date-trigger', suppliedSettings) ||
        defaultDateTrigger,
      'time-format': timeFormat,
      'time-trigger':
        this.getSettingRaw('time-trigger', suppliedSettings) ||
        defaultTimeTrigger,
      'link-date-to-daily-note': this.getSettingRaw(
        'link-date-to-daily-note',
        suppliedSettings
      ),
      'hide-date-in-title': this.getSettingRaw(
        'hide-date-in-title',
        suppliedSettings
      ),
      'hide-tags-in-title': this.getSettingRaw(
        'hide-tags-in-title',
        suppliedSettings
      ),
      'metadata-keys': [...globalKeys, ...localKeys],
      'prepend-archive-separator':
        this.getSettingRaw('prepend-archive-separator') || '',
      'prepend-archive-format': archiveDateFormat,
    };
  }

  getSetting = <K extends keyof KanbanSettings>(
    key: K,
    suppliedLocalSettings?: KanbanSettings
  ): KanbanSettings[K] => {
    if (suppliedLocalSettings && suppliedLocalSettings[key] !== undefined) {
      return suppliedLocalSettings[key];
    }

    if (this.compiledSettings && this.compiledSettings[key] !== undefined) {
      return this.compiledSettings[key];
    }

    return this.getSettingRaw(key);
  };

  getSettingRaw = <K extends keyof KanbanSettings>(
    key: K,
    suppliedLocalSettings?: KanbanSettings
  ): KanbanSettings[K] => {
    if (suppliedLocalSettings && suppliedLocalSettings[key] !== undefined) {
      return suppliedLocalSettings[key];
    }

    if (
      this.state?.data?.settings &&
      this.state.data.settings[key] !== undefined
    ) {
      return this.state.data.settings[key];
    }

    return this.getGlobalSetting(key);
  };

  getGlobalSetting = <K extends keyof KanbanSettings>(
    key: K
  ): KanbanSettings[K] => {
    const globalSettings = this.getGlobalSettings();

    if (globalSettings && globalSettings[key] !== undefined)
      return globalSettings[key];

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
        settings: { 'kanban-plugin': 'basic' },
        isSearching: false,
        errors: [],
      },
    };

    try {
      if (trimmedContent) {
        board = this.parser.mdToBoard(trimmedContent, this.file?.path);
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

  onFileMetadataChange(file: TFile) {
    // Invalidate the metadata caching and reparse the file if needed,
    // recreating all items that referenced the changed file
    if (this.parser.invalidateFile(file)) {
      const board = this.getParsedBoard(this.getAView().data);
      const oldBoard = this.state;

      let lanesChanged = false;

      const newLanes = oldBoard.children.map((lane, laneIndex) => {
        let match = false;

        const newItems = lane.children.map((item, itemIndex) => {
          if (item.data.metadata.file === file) {
            lanesChanged = true;
            match = true;
            return board.children[laneIndex].children[itemIndex];
          }

          return item;
        });

        if (match) {
          return update(lane, {
            children: {
              $set: newItems,
            },
          });
        }

        return lane;
      });

      if (lanesChanged) {
        this.setState(
          update(oldBoard, {
            children: {
              $set: newLanes,
            },
          })
        );
      }
    }
  }

  reparseBoard() {
    const board = this.getParsedBoard(this.getAView().data);
    this.setState(board);
  }

  archiveCompletedCards() {
    const board = this.state;

    const archived: Item[] = [];
    const shouldAppendArchiveDate = !!this.getSetting('prepend-archive-date');
    const archiveDateSeparator = this.getSetting('prepend-archive-separator');
    const archiveDateFormat = this.getSetting('prepend-archive-format');

    const appendArchiveDate = (item: Item) => {
      const newTitle = [moment().format(archiveDateFormat)];

      if (archiveDateSeparator) newTitle.push(archiveDateSeparator);

      newTitle.push(item.data.titleRaw);

      const titleRaw = newTitle.join(' ');
      return this.parser.updateItem(item, titleRaw);
    };

    const lanes = board.children.map((lane) => {
      return update(lane, {
        children: {
          $set: lane.children.filter((item) => {
            if (lane.data.shouldMarkItemsComplete || item.data.isComplete) {
              archived.push(
                shouldAppendArchiveDate ? appendArchiveDate(item) : item
              );
            }

            return !item.data.isComplete && !lane.data.shouldMarkItemsComplete;
          }),
        },
      });
    });

    this.app.workspace.trigger(
      'kanban:board-cards-archived',
      this.file,
      archived
    );

    this.setState(
      update(board, {
        children: {
          $set: lanes,
        },
        data: {
          archive: {
            $push: archived,
          },
        },
      })
    );
  }
}
