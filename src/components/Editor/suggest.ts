import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
  moment,
} from 'obsidian';

import KanbanPlugin from '../../main';
import { buildTimeArray } from '../Item/helpers';
import { c, escapeRegExpStr } from '../helpers';
import {
  applyDate,
  constructDatePicker,
  toNextMonth,
  toPreviousMonth,
} from './datepicker';
import { Instance } from './flatpickr/types/instance';

export class DateSuggest extends EditorSuggest<[]> {
  plugin: KanbanPlugin;
  app: App;

  get stateManager() {
    return this.context
      ? this.plugin.stateManagers.get(this.context.file)
      : null;
  }

  constructor(app: App, plugin: KanbanPlugin) {
    super(app);

    this.app = app;
    this.plugin = plugin;

    [...(this.scope as any).keys].forEach((k: any) => this.scope.unregister(k));

    this.suggestEl.addClass(c('date-suggest'));

    const move = (dir: 'up' | 'right' | 'down' | 'left') => {
      const { datepicker } = this;
      if (!datepicker) return;

      const currentDate = moment(datepicker.selectedDates[0] || new Date());

      if (dir === 'right') {
        if (currentDate.weekday() === 6) {
          datepicker.setDate(toNextMonth(currentDate).toDate(), false);
        } else {
          datepicker.setDate(currentDate.add(1, 'day').toDate(), false);
        }
        return;
      }

      if (dir === 'left') {
        if (currentDate.weekday() === 0) {
          datepicker.setDate(toPreviousMonth(currentDate).toDate(), false);
        } else {
          datepicker.setDate(currentDate.subtract(1, 'day').toDate(), false);
        }
      }

      if (dir === 'up') {
        datepicker.setDate(currentDate.subtract(1, 'week').toDate(), false);
        return;
      }

      if (dir === 'down') {
        datepicker.setDate(currentDate.add(1, 'week').toDate(), false);
        return;
      }
    };

    this.scope.register([], 'ArrowLeft', () => {
      move('left');
      return false;
    });

    this.scope.register([], 'ArrowRight', () => {
      move('right');
      return false;
    });

    this.scope.register([], 'ArrowDown', () => {
      move('down');
      return false;
    });

    this.scope.register([], 'ArrowUp', () => {
      move('up');
      return false;
    });

    this.scope.register([], 'Enter', () => {
      const selectedDates = this.datepicker.selectedDates;
      const ctx = this.context;

      if (selectedDates.length) {
        applyDate(ctx, this.stateManager, selectedDates[0]);
      } else {
        applyDate(ctx, this.stateManager, new Date());
      }

      this.close();
      return false;
    });

    this.scope.register([], 'Escape', () => {
      this.close();
      return false;
    });
  }

  getSuggestions(): [] {
    return [];
  }

  suggestEl: HTMLElement;
  renderSuggestion(): void {}
  selectSuggestion(): void {}

  datepicker: Instance = null;
  showSuggestions() {
    const { datepicker, suggestEl, context, stateManager } = this;
    if (!datepicker && stateManager) {
      suggestEl.empty();
      suggestEl.addClasses([c('date-picker'), c('ignore-click-outside')]);
      constructDatePicker(context, stateManager, suggestEl, (picker) => {
        this.datepicker = picker;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.updatePosition(true);
      });
    }
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    file: TFile
  ): EditorSuggestTriggerInfo | null {
    const stateManager = this.plugin.getStateManager(file);
    if (!stateManager) return null;

    const dateTrigger = stateManager.getSetting('date-trigger');
    const textCtx = (editor.getLine(cursor.line) || '').slice(0, cursor.ch);
    const isMatch = new RegExp(
      `(?:^|\\s)${escapeRegExpStr(dateTrigger)}$`
    ).test(textCtx);

    if (isMatch) {
      return {
        start: { line: cursor.line, ch: cursor.ch - dateTrigger.length },
        end: cursor,
        query: dateTrigger,
      };
    }

    return null;
  }

  close() {
    super.close();

    if (this.datepicker) {
      this.datepicker.destroy();
      this.datepicker = null;
      this.suggestEl.empty();
    }
  }
}

export class TimeSuggest extends EditorSuggest<string> {
  plugin: KanbanPlugin;
  times: string[];

  constructor(app: App, plugin: KanbanPlugin) {
    super(app);
    this.app = app;
    this.plugin = plugin;
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    file: TFile
  ): EditorSuggestTriggerInfo {
    const stateManager = this.plugin.getStateManager(file);
    if (!stateManager) return null;

    const timeTrigger = stateManager.getSetting('time-trigger');
    const timeTriggerRegex = new RegExp(
      `\\B${escapeRegExpStr(timeTrigger as string)}{?([^}]*)$`
    );
    const textCtx = (editor.getLine(cursor.line) || '').slice(0, cursor.ch);
    const match = textCtx.match(timeTriggerRegex);

    if (!match) return null;

    this.times = buildTimeArray(stateManager);

    return {
      start: {
        line: cursor.line,
        ch: cursor.ch - match[1].length - timeTrigger.length,
      },
      end: cursor,
      query: match[1],
    };
  }

  getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
    const stateManager = this.plugin.getStateManager(context.file);
    if (!stateManager) return [];

    return this.times.filter((t) => {
      return t.startsWith(context.query) || t.startsWith('0' + context.query);
    });
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    if (value.endsWith('00')) {
      el.createEl('strong', { text: value });
    } else {
      el.setText(value);
    }
  }

  selectSuggestion(value: string): void {
    const { context, plugin } = this;
    const stateManager = plugin.getStateManager(context.file);
    if (!stateManager) return;

    const timeTrigger = stateManager.getSetting('time-trigger');
    const replacement = `${timeTrigger}{${value}} `;

    context.editor.replaceRange(replacement, context.start, context.end);
    context.editor.setCursor({
      line: context.start.line,
      ch: context.start.ch + replacement.length,
    });
    context.editor.focus();
  }

  close(): void {
    super.close();
    this.times = null;
  }
}
