/*

MIT License

Copyright (c) 2021 Martin Schenck and Clare Macrae

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
import type { Moment } from 'moment';

/**
 * A subset of fields of {@link Task} that can be parsed from the textual
 * description of that Task.
 *
 * All fields are writeable for convenience.
 */
export type TaskDetails = Record<
  | 'description'
  | 'priority'
  | 'startDate'
  | 'createdDate'
  | 'scheduledDate'
  | 'dueDate'
  | 'doneDate'
  | 'cancelledDate'
  | 'recurrenceRule'
  | 'dependsOn'
  | 'id',
  any
>;

/**
 * When sorting, make sure low always comes after none. This way any tasks with low will be below any exiting
 * tasks that have no priority which would be the default.
 *
 * Values can be converted to strings with:
 * - {@link priorityNameUsingNone} in {@link PriorityTools}
 * - {@link priorityNameUsingNormal} in {@link PriorityTools}
 *
 * @export
 * @enum {number}
 */
export enum Priority {
  Highest = '0',
  High = '1',
  Medium = '2',
  None = '3',
  Low = '4',
  Lowest = '5',
}

/* Interface describing the symbols that {@link DefaultTaskSerializer}
 * uses to serialize and deserialize tasks.
 *
 * @export
 * @interface DefaultTaskSerializerSymbols
 */
export interface DefaultTaskSerializerSymbols {
  // NEW_TASK_FIELD_EDIT_REQUIRED
  readonly prioritySymbols: {
    Highest: string;
    High: string;
    Medium: string;
    Low: string;
    Lowest: string;
    None: string;
  };
  readonly startDateSymbol: string;
  readonly createdDateSymbol: string;
  readonly scheduledDateSymbol: string;
  readonly dueDateSymbol: string;
  readonly doneDateSymbol: string;
  readonly cancelledDateSymbol: string;
  readonly recurrenceSymbol: string;
  readonly idSymbol: string;
  readonly dependsOnSymbol: string;
  readonly TaskFormatRegularExpressions: {
    priorityRegex: RegExp;
    startDateRegex: RegExp;
    createdDateRegex: RegExp;
    scheduledDateRegex: RegExp;
    dueDateRegex: RegExp;
    doneDateRegex: RegExp;
    cancelledDateRegex: RegExp;
    recurrenceRegex: RegExp;
    idRegex: RegExp;
    dependsOnRegex: RegExp;
  };
}

// The allowed characters in a single task id:
export const taskIdRegex = /[a-zA-Z0-9-_]+/;

/**
 * A symbol map for obsidian-task's default task style.
 * Uses emojis to concisely convey meaning
 */
export const DEFAULT_SYMBOLS: DefaultTaskSerializerSymbols = {
  // NEW_TASK_FIELD_EDIT_REQUIRED
  prioritySymbols: {
    Highest: '🔺',
    High: '⏫',
    Medium: '🔼',
    Low: '🔽',
    Lowest: '⏬',
    None: '',
  },
  startDateSymbol: '🛫',
  createdDateSymbol: '➕',
  scheduledDateSymbol: '⏳',
  dueDateSymbol: '📅',
  doneDateSymbol: '✅',
  cancelledDateSymbol: '❌',
  recurrenceSymbol: '🔁',
  dependsOnSymbol: '⛔',
  idSymbol: '🆔',
  TaskFormatRegularExpressions: {
    // The following regex's end with `$` because they will be matched and
    // removed from the end until none are left.
    // \uFE0F? allows an optional Variant Selector 16 on emojis.
    priorityRegex: /([🔺⏫🔼🔽⏬])\uFE0F?$/u,
    startDateRegex: /🛫 *(\d{4}-\d{2}-\d{2})$/u,
    createdDateRegex: /➕ *(\d{4}-\d{2}-\d{2})$/u,
    scheduledDateRegex: /[⏳⌛] *(\d{4}-\d{2}-\d{2})$/u,
    dueDateRegex: /[📅📆🗓] *(\d{4}-\d{2}-\d{2})$/u,
    doneDateRegex: /✅ *(\d{4}-\d{2}-\d{2})$/u,
    cancelledDateRegex: /❌ *(\d{4}-\d{2}-\d{2})$/u,
    recurrenceRegex: /🔁 ?([a-zA-Z0-9, !]+)$/iu,
    dependsOnRegex: new RegExp(
      '⛔\uFE0F? *(' + taskIdRegex.source + '( *, *' + taskIdRegex.source + ' *)*)$',
      'iu'
    ),
    idRegex: new RegExp('🆔 *(' + taskIdRegex.source + ')$', 'iu'),
  },
} as const;

export function allTaskPluginEmojis() {
  const allEmojis: string[] = [];

  // All the priority emojis:
  Object.values(DEFAULT_SYMBOLS.prioritySymbols).forEach((value) => {
    if (value.length > 0) {
      allEmojis.push(value);
    }
  });

  // All the other field emojis:
  Object.values(DEFAULT_SYMBOLS).forEach((value) => {
    if (typeof value === 'string') {
      allEmojis.push(value);
    }
  });
  return allEmojis;
}

export class DefaultTaskSerializer {
  constructor(public readonly symbols: DefaultTaskSerializerSymbols) {}

  /**
   * Given the string captured in the first capture group of
   *    {@link DefaultTaskSerializerSymbols.TaskFormatRegularExpressions.priorityRegex},
   *    returns the corresponding Priority level.
   *
   * @param p String captured by priorityRegex
   * @returns Corresponding priority if parsing was successful, otherwise {@link Priority.None}
   */
  protected parsePriority(p: string): Priority {
    const { prioritySymbols } = this.symbols;
    switch (p) {
      case prioritySymbols.Lowest:
        return Priority.Lowest;
      case prioritySymbols.Low:
        return Priority.Low;
      case prioritySymbols.Medium:
        return Priority.Medium;
      case prioritySymbols.High:
        return Priority.High;
      case prioritySymbols.Highest:
        return Priority.Highest;
      default:
        return Priority.None;
    }
  }

  /* Parse TaskDetails from the textual description of a {@link Task}
   *
   * @param line The string to parse
   *
   * @return {TaskDetails}
   */
  public deserialize(line: string): TaskDetails {
    const { TaskFormatRegularExpressions } = this.symbols;

    // Keep matching and removing special strings from the end of the
    // description in any order. The loop should only run once if the
    // strings are in the expected order after the description.
    // NEW_TASK_FIELD_EDIT_REQUIRED
    let matched: boolean;
    let priority: Priority = Priority.None;
    let startDate: Moment | null = null;
    let scheduledDate: Moment | null = null;
    let dueDate: Moment | null = null;
    let doneDate: Moment | null = null;
    let cancelledDate: Moment | null = null;
    let createdDate: Moment | null = null;
    let recurrenceRule: string = '';
    let id: string = '';
    let dependsOn: string[] | [] = [];
    // Tags that are removed from the end while parsing, but we want to add them back for being part of the description.
    // In the original task description they are possibly mixed with other components
    // (e.g. #tag1 <due date> #tag2), they do not have to all trail all task components,
    // but eventually we want to paste them back to the task description at the end
    let trailingTags = '';
    // Add a "max runs" failsafe to never end in an endless loop:
    const maxRuns = 20;
    let runs = 0;
    do {
      // NEW_TASK_FIELD_EDIT_REQUIRED
      matched = false;
      const priorityMatch = line.match(TaskFormatRegularExpressions.priorityRegex);
      if (priorityMatch !== null) {
        priority = this.parsePriority(priorityMatch[1]);
        line = line.replace(TaskFormatRegularExpressions.priorityRegex, '').trim();
        matched = true;
      }

      const doneDateMatch = line.match(TaskFormatRegularExpressions.doneDateRegex);
      if (doneDateMatch !== null) {
        doneDate = window.moment(doneDateMatch[1], TaskRegularExpressions.dateFormat);
        line = line.replace(TaskFormatRegularExpressions.doneDateRegex, '').trim();
        matched = true;
      }

      const cancelledDateMatch = line.match(TaskFormatRegularExpressions.cancelledDateRegex);
      if (cancelledDateMatch !== null) {
        cancelledDate = window.moment(cancelledDateMatch[1], TaskRegularExpressions.dateFormat);
        line = line.replace(TaskFormatRegularExpressions.cancelledDateRegex, '').trim();
        matched = true;
      }

      const dueDateMatch = line.match(TaskFormatRegularExpressions.dueDateRegex);
      if (dueDateMatch !== null) {
        dueDate = window.moment(dueDateMatch[1], TaskRegularExpressions.dateFormat);
        line = line.replace(TaskFormatRegularExpressions.dueDateRegex, '').trim();
        matched = true;
      }

      const scheduledDateMatch = line.match(TaskFormatRegularExpressions.scheduledDateRegex);
      if (scheduledDateMatch !== null) {
        scheduledDate = window.moment(scheduledDateMatch[1], TaskRegularExpressions.dateFormat);
        line = line.replace(TaskFormatRegularExpressions.scheduledDateRegex, '').trim();
        matched = true;
      }

      const startDateMatch = line.match(TaskFormatRegularExpressions.startDateRegex);
      if (startDateMatch !== null) {
        startDate = window.moment(startDateMatch[1], TaskRegularExpressions.dateFormat);
        line = line.replace(TaskFormatRegularExpressions.startDateRegex, '').trim();
        matched = true;
      }

      const createdDateMatch = line.match(TaskFormatRegularExpressions.createdDateRegex);
      if (createdDateMatch !== null) {
        createdDate = window.moment(createdDateMatch[1], TaskRegularExpressions.dateFormat);
        line = line.replace(TaskFormatRegularExpressions.createdDateRegex, '').trim();
        matched = true;
      }

      const recurrenceMatch = line.match(TaskFormatRegularExpressions.recurrenceRegex);
      if (recurrenceMatch !== null) {
        // Save the recurrence rule, but *do not parse it yet*.
        // Creating the Recurrence object requires a reference date (e.g. a due date),
        // and it might appear in the next (earlier in the line) tokens to parse
        recurrenceRule = recurrenceMatch[1].trim();
        line = line.replace(TaskFormatRegularExpressions.recurrenceRegex, '').trim();
        matched = true;
      }

      // Match tags from the end to allow users to mix the various task components with
      // tags. These tags will be added back to the description below
      const tagsMatch = line.match(TaskRegularExpressions.hashTagsFromEnd);
      if (tagsMatch != null) {
        line = line.replace(TaskRegularExpressions.hashTagsFromEnd, '').trim();
        matched = true;
        const tagName = tagsMatch[0].trim();
        // Adding to the left because the matching is done right-to-left
        trailingTags = trailingTags.length > 0 ? [tagName, trailingTags].join(' ') : tagName;
      }

      const idMatch = line.match(TaskFormatRegularExpressions.idRegex);

      if (idMatch != null) {
        line = line.replace(TaskFormatRegularExpressions.idRegex, '').trim();
        id = idMatch[1].trim();
        matched = true;
      }

      const dependsOnMatch = line.match(TaskFormatRegularExpressions.dependsOnRegex);

      if (dependsOnMatch != null) {
        line = line.replace(TaskFormatRegularExpressions.dependsOnRegex, '').trim();
        dependsOn = dependsOnMatch[1]
          .replace(/ /g, '')
          .split(',')
          .filter((item) => item !== '');
        matched = true;
      }

      runs++;
    } while (matched && runs <= maxRuns);

    // Add back any trailing tags to the description. We removed them so we can parse the rest of the
    // components but now we want them back.
    // The goal is for a task of them form 'Do something #tag1 (due) tomorrow #tag2 (start) today'
    // to actually have the description 'Do something #tag1 #tag2'
    if (trailingTags.length > 0) line += ' ' + trailingTags;

    // NEW_TASK_FIELD_EDIT_REQUIRED
    return {
      description: line,
      priority,
      startDate,
      createdDate,
      scheduledDate,
      dueDate,
      doneDate,
      cancelledDate,
      recurrenceRule,
      id,
      dependsOn,
    };
  }
}

export class TaskRegularExpressions {
  public static readonly dateFormat = 'YYYY-MM-DD';
  public static readonly dateTimeFormat = 'YYYY-MM-DD HH:mm';

  // Matches indentation before a list marker (including > for potentially nested blockquotes or Obsidian callouts)
  public static readonly indentationRegex = /^([\s\t>]*)/;

  // Matches - * and + list markers, or numbered list markers (eg 1.)
  public static readonly listMarkerRegex = /([-*+]|[0-9]+\.)/;

  // Matches a checkbox and saves the status character inside
  public static readonly checkboxRegex = /\[(.)\]/u;

  // Matches the rest of the task after the checkbox.
  public static readonly afterCheckboxRegex = / *(.*)/u;

  // Main regex for parsing a line. It matches the following:
  // - Indentation
  // - List marker
  // - Status character
  // - Rest of task after checkbox markdown
  // See Task.extractTaskComponents() for abstraction around this regular expression.
  // That is private for now, but could be made public in future if needed.
  public static readonly taskRegex = new RegExp(
    TaskRegularExpressions.indentationRegex.source +
      TaskRegularExpressions.listMarkerRegex.source +
      ' +' +
      TaskRegularExpressions.checkboxRegex.source +
      TaskRegularExpressions.afterCheckboxRegex.source,
    'u'
  );

  // Used with the "Create or Edit Task" command to parse indentation and status if present
  public static readonly nonTaskRegex = new RegExp(
    TaskRegularExpressions.indentationRegex.source +
      TaskRegularExpressions.listMarkerRegex.source +
      '? *(' +
      TaskRegularExpressions.checkboxRegex.source +
      ')?' +
      TaskRegularExpressions.afterCheckboxRegex.source,
    'u'
  );

  // Used with "Toggle Done" command to detect a list item that can get a checkbox added to it.
  public static readonly listItemRegex = new RegExp(
    TaskRegularExpressions.indentationRegex.source + TaskRegularExpressions.listMarkerRegex.source
  );

  // Match on block link at end.
  public static readonly blockLinkRegex = / \^[a-zA-Z0-9-]+$/u;

  // Regex to match all hash tags, basically hash followed by anything but the characters in the negation.
  // To ensure URLs are not caught it is looking of beginning of string tag and any
  // tag that has a space in front of it. Any # that has a character in front
  // of it will be ignored.
  // EXAMPLE:
  // description: '#dog #car http://www/ddd#ere #house'
  // matches: #dog, #car, #house
  // MAINTENANCE NOTE:
  //  If hashTags is modified, please update 'Recognising Tags' in Tags.md in the docs.
  public static readonly hashTags = /(^|\s)#[^ !@#$%^&*(),.?":{}|<>]+/g;
  public static readonly hashTagsFromEnd = new RegExp(this.hashTags.source + '$');
}

/**
 * Takes a regex of the form 'key:: value' and turns it into a regex that can parse
 * Dataview inline field, i.e either;
 *     * (key:: value)
 *     * [key:: value]
 *
 * There can be an arbitrary amount of horizontal whitespace around the key value pair,
 * and after the '::'
 */
function toInlineFieldRegex(innerFieldRegex: RegExp): RegExp {
  /**
   * First, I'm sorry this looks so bad. Javascript's regex engine lacks some
   * conveniences from other engines like PCRE (duplicate named groups)
   * that would've made this easier to express in a readable way.
   *
   * The idea here is that we're trying to say, in English:
   *
   *     "{@link innerFieldRegex} can either be surrounded by square brackets `[]`
   *     or parens `()`"
   *
   * But there is added complexity because we want to disallow mismatched pairs
   *   (i.e. no `[key::value) or (key::value]`). And we have to take care to not
   * introduce new capture groups, since innerFieldRegex may contain capture groups
   * and depend on the numbering.
   *
   * We achieve this by using a variable length, positive lookahead to assert
   * "Only match a the first element of the pair if the other element is somewhere further in the string".
   *
   * This is likely somewhat fragile.
   *
   */
  const fieldRegex = (
    [
      '(?:',
      /*     */ /(?=[^\]]+\])\[/, // Try to match '[' if there's a ']' later in the string
      /*    */ '|',
      /*     */ /(?=[^)]+\))\(/, // Otherwise, match '(' if there's a ')' later in the string
      ')',
      / */,
      innerFieldRegex,
      / */,
      /[)\]]/,
      /(?: *,)?/, // Allow trailing comma, enables workaround from #1913 for rendering issue
      /$/, // Regexes are matched from the end of the string forwards
    ] as const
  )
    .map((val) => (val instanceof RegExp ? val.source : val))
    .join('');
  return new RegExp(fieldRegex, innerFieldRegex.flags);
}

/**
 * A symbol map that corresponds to a task format that strives to be compatible with
 *   [Dataview]{@link https://github.com/blacksmithgu/obsidian-dataview}
 */
export const DATAVIEW_SYMBOLS = {
  // NEW_TASK_FIELD_EDIT_REQUIRED
  prioritySymbols: {
    Highest: 'priority:: highest',
    High: 'priority:: high',
    Medium: 'priority:: medium',
    Low: 'priority:: low',
    Lowest: 'priority:: lowest',
    None: '',
  },
  startDateSymbol: 'start::',
  createdDateSymbol: 'created::',
  scheduledDateSymbol: 'scheduled::',
  dueDateSymbol: 'due::',
  doneDateSymbol: 'completion::',
  cancelledDateSymbol: 'cancelled::',
  recurrenceSymbol: 'repeat::',
  idSymbol: 'id::',
  dependsOnSymbol: 'dependsOn::',
  TaskFormatRegularExpressions: {
    priorityRegex: toInlineFieldRegex(/priority:: *(highest|high|medium|low|lowest)/),
    startDateRegex: toInlineFieldRegex(/start:: *(\d{4}-\d{2}-\d{2})/),
    createdDateRegex: toInlineFieldRegex(/created:: *(\d{4}-\d{2}-\d{2})/),
    scheduledDateRegex: toInlineFieldRegex(/scheduled:: *(\d{4}-\d{2}-\d{2})/),
    dueDateRegex: toInlineFieldRegex(/due:: *(\d{4}-\d{2}-\d{2})/),
    doneDateRegex: toInlineFieldRegex(/completion:: *(\d{4}-\d{2}-\d{2})/),
    cancelledDateRegex: toInlineFieldRegex(/cancelled:: *(\d{4}-\d{2}-\d{2})/),
    recurrenceRegex: toInlineFieldRegex(/repeat:: *([a-zA-Z0-9, !]+)/),
    dependsOnRegex: toInlineFieldRegex(
      new RegExp('dependsOn:: *(' + taskIdRegex.source + '( *, *' + taskIdRegex.source + ' *)*)')
    ),
    idRegex: toInlineFieldRegex(new RegExp('id:: *(' + taskIdRegex.source + ')')),
  },
} as const;

/**
 * A {@link TaskSerializer} that that reads and writes tasks compatible with
 *   [Dataview]{@link https://github.com/blacksmithgu/obsidian-dataview}
 */
export class DataviewTaskSerializer extends DefaultTaskSerializer {
  constructor() {
    super(DATAVIEW_SYMBOLS);
  }

  protected parsePriority(p: string): Priority {
    switch (p) {
      case 'highest':
        return Priority.Highest;
      case 'high':
        return Priority.High;
      case 'medium':
        return Priority.Medium;
      case 'low':
        return Priority.Low;
      case 'lowest':
        return Priority.Lowest;
      default:
        return Priority.None;
    }
  }
}
