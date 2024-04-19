import { Extension, StateField } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  MatchDecorator,
  PluginSpec,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { moment } from 'obsidian';
import { useMemo } from 'preact/hooks';

import { StateManager } from '../../StateManager';
import { c } from '../helpers';
import { DateColor } from '../types';

export const stateManagerField = StateField.define<StateManager | null>({
  create() {
    return null;
  },
  update(state) {
    return state;
  },
});

class DateTimeWidget extends WidgetType {
  date: moment.Moment;
  stateManager: StateManager;
  type: string;

  constructor(stateManager: StateManager, date: moment.Moment, type: 'date' | 'time') {
    super();
    this.stateManager = stateManager;
    this.type = type;
    this.date = date;
  }

  eq(widget: this): boolean {
    return this.date.isSame(widget.date);
  }

  toDOM() {
    return createSpan(
      {
        cls: `cm-kanban-${this.type}-wrapper`,
      },
      (span) => {
        span.createSpan({
          cls: `cm-kanban-${this.type}`,
          text: this.date.format(
            this.stateManager.getSetting(
              this.type === 'time' ? 'time-format' : 'date-display-format'
            )
          ),
        });
      }
    );
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function decorate(type: 'date' | 'time') {
  return (
    add: (from: number, to: number, decoration: Decoration) => void,
    from: number,
    to: number,
    match: RegExpExecArray,
    view: EditorView
  ) => {
    const stateManager = view.state.field(stateManagerField);
    if (!stateManager) return;

    const dateStr = match[1];
    const parsed = moment(
      dateStr,
      stateManager.getSetting(type === 'date' ? 'date-format' : 'time-format')
    );

    if (!parsed.isValid()) return;

    add(
      from,
      to,
      Decoration.replace({
        widget: new DateTimeWidget(stateManager, parsed, type),
      })
    );
  };
}

class DateDecorator {
  decos: DecorationSet;
  decorator: MatchDecorator;
  type: string;
  constructor(view: EditorView, regexp: RegExp, type: 'date' | 'time') {
    this.decorator = new MatchDecorator({
      regexp,
      decorate: decorate(type),
    });
    this.decos = this.decorator.createDeco(view);
  }
  update(update: ViewUpdate) {
    if (update.docChanged) {
      this.decos = this.decorator.createDeco(update.view);
    }
  }
}

const config: PluginSpec<DateDecorator> = {
  decorations: (v) => v.decos,
  provide: (p) =>
    EditorView.atomicRanges.of((view) => {
      return view.plugin(p)?.decos || Decoration.none;
    }),
};

function create(type: 'date' | 'time', reStr: string) {
  return ViewPlugin.define((view) => {
    const stateManager = view.state.field(stateManagerField);
    const dateTrigger = stateManager.getSetting(type === 'date' ? 'date-trigger' : 'time-trigger');
    return new DateDecorator(view, new RegExp(`${dateTrigger}${reStr}`, 'g'), type);
  }, config);
}

export const datePlugins: Extension[] = [
  create('time', '{([^}]+)}'),
  create('date', '{([^}]+)}'),
  create('date', '\\[\\[([^\\]]+)\\]\\]'),
  create('date', '\\[([^\\]]+)\\]\\([^)]+\\)'),
];

export function usePreprocessedStr(
  stateManager: StateManager,
  str: string,
  getDateColor: (date: moment.Moment) => DateColor
) {
  const dateTrigger = stateManager.useSetting('date-trigger');
  const dateFormat = stateManager.useSetting('date-format');
  const dateDisplayFormat = stateManager.useSetting('date-display-format');
  const timeTrigger = stateManager.useSetting('time-trigger');
  const timeFormat = stateManager.useSetting('time-format');
  const useLinks = stateManager.useSetting('link-date-to-daily-note');
  const tagColors = stateManager.getSetting('tag-colors');

  return useMemo(() => {
    let date: moment.Moment;
    let dateColor: DateColor;
    const getWrapperStyles = (baseClass: string) => {
      let wrapperStyle = '';
      if (dateColor) {
        if (dateColor.backgroundColor) {
          baseClass += ' has-background';
          wrapperStyle = ` style="--date-color: ${dateColor.color}; --date-background-color: ${dateColor.backgroundColor};"`;
        } else {
          wrapperStyle = ` style="--date-color: ${dateColor.color};"`;
        }
      }
      return { wrapperClass: baseClass, wrapperStyle };
    };

    if (useLinks) {
      str = str.replace(
        new RegExp(`${dateTrigger}\\[\\[([^\\]]+)\\]\\]`, 'g'),
        (match, content) => {
          const parsed = moment(content, dateFormat);
          if (!parsed.isValid()) return match;
          date = parsed;
          const linkPath = app.metadataCache.getFirstLinkpathDest(content, stateManager.file.path);
          if (!dateColor) dateColor = getDateColor(parsed);
          const { wrapperClass, wrapperStyle } = getWrapperStyles(c('preview-date-wrapper'));
          return `<span data-date="${date.toISOString()}" class="${wrapperClass} ${c('date')} ${c('preview-date-link')}"${wrapperStyle}><a class="${c('preview-date')} internal-link" data-href="${linkPath?.path ?? content}" href="${linkPath?.path ?? content}" target="_blank" rel="noopener">${parsed.format(dateDisplayFormat)}</a></span>`;
        }
      );
      str = str.replace(
        new RegExp(`${dateTrigger}\\[([^\\]]+)\\]\\([^)]+\\)`, 'g'),
        (match, content) => {
          const parsed = moment(content, dateFormat);
          if (!parsed.isValid()) return match;
          date = parsed;
          const linkPath = app.metadataCache.getFirstLinkpathDest(content, stateManager.file.path);
          if (!dateColor) dateColor = getDateColor(parsed);
          const { wrapperClass, wrapperStyle } = getWrapperStyles(c('preview-date-wrapper'));
          return `<span data-date="${date.toISOString()}" class="${wrapperClass} ${c('date')} ${c('preview-date-link')}"${wrapperStyle}><a class="${c('preview-date')} internal-link" data-href="${linkPath.path}" href="${linkPath.path}" target="_blank" rel="noopener">${parsed.format(dateDisplayFormat)}</a></span>`;
        }
      );
    } else {
      str = str.replace(new RegExp(`${dateTrigger}{([^}]+)}`, 'g'), (match, content) => {
        const parsed = moment(content, dateFormat);
        if (!parsed.isValid()) return match;
        date = parsed;
        if (!dateColor) dateColor = getDateColor(parsed);
        const { wrapperClass, wrapperStyle } = getWrapperStyles(c('preview-date-wrapper'));
        return `<span data-date="${date.toISOString()}" class="${wrapperClass} ${c('date')}"${wrapperStyle}><span class="${c('preview-date')} ${c('item-metadata-date')}">${parsed.format(dateDisplayFormat)}</span></span>`;
      });
    }

    str = str.replace(new RegExp(`${timeTrigger}{([^}]+)}`, 'g'), (match, content) => {
      const parsed = moment(content, timeFormat);
      if (!parsed.isValid()) return match;

      date.hour(parsed.hour());
      date.minute(parsed.minute());
      date.second(parsed.second());

      const { wrapperClass, wrapperStyle } = getWrapperStyles(c('preview-time-wrapper'));
      return `<span data-date="${date.toISOString()}" class="${wrapperClass} ${c('date')}"${wrapperStyle}><span class="${c('preview-time')} ${c('item-metadata-time')}">${parsed.format(timeFormat)}</span></span>`;
    });

    return str;
  }, [
    getDateColor,
    dateTrigger,
    dateFormat,
    dateDisplayFormat,
    timeTrigger,
    timeFormat,
    useLinks,
    str,
    tagColors,
  ]);
}
