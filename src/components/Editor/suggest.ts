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
import { applyDate, constructDatePicker, toNextMonth, toPreviousMonth } from './datepicker';
import { Instance } from './flatpickr/types/instance';

export function matchTimeTrigger(timeTrigger: string, editor: Editor, cursor: EditorPosition) {
  const textCtx = (editor.getLine(cursor.line) || '').slice(0, cursor.ch);
  const timeTriggerRegex = new RegExp(`(?:^|\\s)${escapeRegExpStr(timeTrigger)}{?([^}]*)$`);
  return textCtx.match(timeTriggerRegex);
}

export function matchDateTrigger(dateTrigger: string, editor: Editor, cursor: EditorPosition) {
  const textCtx = (editor.getLine(cursor.line) || '').slice(0, cursor.ch);
  const dateTriggerRegex = new RegExp(`(?:^|\\s)${escapeRegExpStr(dateTrigger)}{?([^}]*)$`);
  return textCtx.match(dateTriggerRegex);
}

export class DateSuggest extends EditorSuggest<[]> {
  plugin: KanbanPlugin;
  app: App;

  get stateManager() {
    return this.context ? this.plugin.stateManagers.get(this.context.file) : null;
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
      let nextDate: Date;

      if (dir === 'right') {
        if (currentDate.weekday() === 6) {
          nextDate = toNextMonth(currentDate).toDate();
        } else {
          nextDate = currentDate.add(1, 'day').toDate();
        }
      } else if (dir === 'left') {
        if (currentDate.weekday() === 0) {
          nextDate = toPreviousMonth(currentDate).toDate();
        } else {
          nextDate = currentDate.subtract(1, 'day').toDate();
        }
      } else if (dir === 'up') {
        nextDate = currentDate.subtract(1, 'week').toDate();
      } else if (dir === 'down') {
        nextDate = currentDate.add(1, 'week').toDate();
      }

      if (nextDate) {
        datepicker.setDate(nextDate, false);
        return false;
      }
    };

    this.scope.register([], 'ArrowLeft', () => move('left'));
    this.scope.register([], 'ArrowRight', () => move('right'));
    this.scope.register([], 'ArrowDown', () => move('down'));
    this.scope.register([], 'ArrowUp', () => move('up'));

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

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
    const stateManager = this.plugin.getStateManager(file);
    if (!stateManager) return null;

    const dateTrigger = stateManager.getSetting('date-trigger');
    const match = matchDateTrigger(dateTrigger, editor, cursor);
    if (!match) return null;

    return {
      start: { line: cursor.line, ch: cursor.ch - dateTrigger.length },
      end: cursor,
      query: dateTrigger,
    };
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

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo {
    const stateManager = this.plugin.getStateManager(file);
    if (!stateManager) return null;

    const timeTrigger = stateManager.getSetting('time-trigger');
    const match = matchTimeTrigger(timeTrigger, editor, cursor);
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
