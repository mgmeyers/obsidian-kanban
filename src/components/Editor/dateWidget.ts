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

import { StateManager } from '../../StateManager';
import { escapeRegExpStr } from '../helpers';

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
    return new DateDecorator(
      view,
      new RegExp(`${escapeRegExpStr(dateTrigger)}${reStr}`, 'g'),
      type
    );
  }, config);
}

export const datePlugins: Extension[] = [
  create('time', '{([^}]+)}'),
  create('date', '{([^}]+)}'),
  create('date', '\\[\\[([^\\]]+)\\]\\]'),
  create('date', '\\[([^\\]]+)\\]\\([^)]+\\)'),
];
