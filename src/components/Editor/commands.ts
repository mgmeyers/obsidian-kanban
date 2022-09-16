import {
  applyWrappingFormatting,
  expandSelectionToLineBoundaries,
  getStateFromTextarea,
  replaceSelection,
  setSelectionRange,
  toggleLineFormatting,
  toggleWrappingFormattingCommand,
} from './helpers';
import { insertTextAtCursor } from './insertTextAtCursor';

export const commandIds = [
  'editor:toggle-blockquote',
  'editor:toggle-bold',
  'editor:toggle-bullet-list',
  'editor:toggle-checklist-status',
  'editor:toggle-code',
  'editor:toggle-highlight',
  'editor:toggle-italics',
  'editor:toggle-numbered-list',
  'editor:toggle-strikethrough',
];

const isBoldedRegEx = /^[*_]{2}(.+)[*_]{2}$/;
function unBold(str: string) {
  return str.replace(isBoldedRegEx, '$1');
}

const isItalicizedRegEx = /^[*_]{1}(.+)[*_]{1}$/;
function unItalicize(str: string) {
  return str.replace(isItalicizedRegEx, '$1');
}

const isCodeRegEx = /^`{1}(.+)`{1}$/;
function unCode(str: string) {
  return str.replace(isCodeRegEx, '$1');
}

const isHighlightedRegEx = /^={2}(.+)={2}$/;
function unHighlight(str: string) {
  return str.replace(isHighlightedRegEx, '$1');
}

const isStrikedRegEx = /^~{2}(.+)~{2}$/;
function unStrike(str: string) {
  return str.replace(isStrikedRegEx, '$1');
}

const isQuoted = /^(?:>.+?(?:[\r\n]|$))+$/;
function applyQuote(str: string) {
  const quoted = str
    .split('\n')
    .map((line) => {
      if (line[0] === '>') {
        return line;
      }

      return `> ${line}`;
    })
    .join('\n');

  return quoted;
}

function removeQuote(str: string) {
  const unquoted = str
    .split('\n')
    .map((line) => {
      if (line[0] !== '>') {
        return line;
      }

      return line.replace(/^>+\s*/, '');
    })
    .join('\n');

  return unquoted;
}

const isOrderedList = /^(?:\s*\d+[.)]\s+.*?(?:[\r\n]|$))+$/;
const isOrderedEmptyCheck = /^(?:\s*\d+[.)]\s+\[\s+\]\s+.*?(?:[\r\n]|$))+$/;
const isOrderedChecked = /^(?:\s*\d+[.)]\s+\[[^\]\s]+\]\s+.*?(?:[\r\n]|$))+$/;

function getIndent(line: string) {
  return line.match(/^\s*/)[0].length;
}

function getOrdinal(line: string) {
  return parseInt(line.match(/^\s*(\d+)/)[1], 10);
}

function applyOrderedList(str: string) {
  const indentCounter = [0];
  let lastIndent = 0;

  return str
    .split('\n')
    .map((line) => {
      const lineIndent = getIndent(line);

      if (lineIndent > lastIndent) {
        indentCounter.push(0);
      } else if (lineIndent < lastIndent) {
        indentCounter.pop();
      }

      lastIndent = lineIndent;

      if (isOrderedList.test(line)) {
        const ordinal = getOrdinal(line);

        indentCounter[indentCounter.length - 1] = ordinal;

        return line;
      }

      indentCounter[indentCounter.length - 1] =
        indentCounter[indentCounter.length - 1] + 1;

      return line.replace(
        /^(\s*)/,
        `$1${indentCounter[indentCounter.length - 1]}. `
      );
    })
    .join('\n');
}

function removeOrderedList(str: string) {
  return str
    .split('\n')
    .map((line) => {
      if (!isOrderedList.test(line)) {
        return line;
      }

      return line.replace(/^(\s*)\d+[.)]\s+/, '$1');
    })
    .join('\n');
}

const isBulleted = /^(?:\s*[-*+]\s+.*?(?:[\r\n]|$))+$/;
const isBulletEmptyCheck = /^(?:\s*[-*+]\s+\[\s+\]\s+.*?(?:[\r\n]|$))+$/;
const isBulletChecked = /^(?:\s*[-*+]\s+\[[^\]\s]+\]\s+.*?(?:[\r\n]|$))+$/;

function applyBullet(str: string) {
  const bulleted = str
    .split('\n')
    .map((line) => {
      if (isBulleted.test(line)) {
        return line;
      }

      return line.replace(/^(\s*)/, '$1- ');
    })
    .join('\n');

  return bulleted;
}

function bulletToEmptyCheckbox(str: string) {
  return str
    .split('\n')
    .map((line) => {
      if (isBulletEmptyCheck.test(line) || isBulletChecked.test(line)) {
        return line;
      }

      return line.replace(/^(\s*[-*+]\s+)/, '$1[ ] ');
    })
    .join('\n');
}

function orderedListToEmptyCheckbox(str: string) {
  return str
    .split('\n')
    .map((line) => {
      if (isOrderedEmptyCheck.test(line) || isOrderedChecked.test(line)) {
        return line;
      }

      return line.replace(/^(\s*\d+[.)]\s+)/, '$1[ ] ');
    })
    .join('\n');
}

function checkedToEmpty(str: string) {
  return str
    .split('\n')
    .map((line) => {
      if (isBulletEmptyCheck.test(line)) {
        return line;
      }

      return line.replace(/^(\s*[-*+]\s+)\[[^\]]\]/, '$1[ ]');
    })
    .join('\n');
}

function orderedCheckedToEmpty(str: string) {
  return str
    .split('\n')
    .map((line) => {
      if (isOrderedEmptyCheck.test(line)) {
        return line;
      }

      return line.replace(/^(\s*\d+[.)]\s+)\[[^\]]{1}\]/, '$1[ ]');
    })
    .join('\n');
}

function emptyToChecked(str: string) {
  return str
    .split('\n')
    .map((line) => {
      if (isBulletChecked.test(line)) {
        return line;
      }

      return line.replace(/^(\s*[-*+]\s+)\[\s\]/, '$1[x]');
    })
    .join('\n');
}

function orderedEmptyToChecked(str: string) {
  return str
    .split('\n')
    .map((line) => {
      if (isOrderedChecked.test(line)) {
        return line;
      }

      return line.replace(/^(\s*\d+[.)]\s+)\[\s\]/, '$1[x]');
    })
    .join('\n');
}

function removeBullet(str: string) {
  const unbulleted = str
    .split('\n')
    .map((line) => {
      if (!isBulleted.test(line)) {
        return line;
      }

      return line.replace(/^(\s*)[-+*]\s+/, '$1');
    })
    .join('\n');

  return unbulleted;
}

export const commands: Record<string, (ta: HTMLTextAreaElement) => void> = {
  'editor:toggle-bold': (textarea: HTMLTextAreaElement) => {
    toggleWrappingFormattingCommand(textarea, isBoldedRegEx, unBold, '**');
  },
  'editor:toggle-code': (textarea: HTMLTextAreaElement) => {
    toggleWrappingFormattingCommand(textarea, isCodeRegEx, unCode, '`');
  },
  'editor:toggle-italics': (textarea: HTMLTextAreaElement) => {
    toggleWrappingFormattingCommand(
      textarea,
      isItalicizedRegEx,
      unItalicize,
      '*'
    );
  },
  'editor:toggle-highlight': (textarea: HTMLTextAreaElement) => {
    toggleWrappingFormattingCommand(
      textarea,
      isHighlightedRegEx,
      unHighlight,
      '=='
    );
  },
  'editor:toggle-strikethrough': (textarea: HTMLTextAreaElement) => {
    toggleWrappingFormattingCommand(textarea, isStrikedRegEx, unStrike, '~~');
  },
  'editor:toggle-blockquote': (textarea: HTMLTextAreaElement) => {
    toggleLineFormatting(textarea, isQuoted, applyQuote, removeQuote);
  },
  'editor:toggle-bullet-list': (textarea: HTMLTextAreaElement) => {
    toggleLineFormatting(textarea, isBulleted, applyBullet, removeBullet);
  },
  'editor:toggle-numbered-list': (textarea: HTMLTextAreaElement) => {
    toggleLineFormatting(
      textarea,
      isOrderedList,
      applyOrderedList,
      removeOrderedList
    );
  },

  'editor:toggle-checklist-status': (textarea: HTMLTextAreaElement) => {
    const state = getStateFromTextarea(textarea);
    const isEmptySelection = state.selection.end === state.selection.start;

    const lineRange = expandSelectionToLineBoundaries({
      text: state.text,
      selection: state.selection,
    });

    const selection = setSelectionRange(textarea, lineRange);

    let newLines = selection.selectedText;

    const isLineBulletList = isBulleted.test(newLines);
    const isLineOrderedList = isOrderedList.test(newLines);

    if (!isLineBulletList && !isLineOrderedList) {
      newLines = applyBullet(newLines);
    } else if (isLineBulletList) {
      if (isBulletEmptyCheck.test(newLines)) {
        newLines = emptyToChecked(newLines);
      } else if (isBulletChecked.test(newLines)) {
        newLines = checkedToEmpty(newLines);
      } else {
        newLines = bulletToEmptyCheckbox(newLines);
      }
    } else {
      if (isOrderedEmptyCheck.test(newLines)) {
        newLines = orderedEmptyToChecked(newLines);
      } else if (isOrderedChecked.test(newLines)) {
        newLines = orderedCheckedToEmpty(newLines);
      } else {
        newLines = orderedListToEmptyCheckbox(newLines);
      }
    }

    const newState = replaceSelection(textarea, newLines);

    if (isEmptySelection) {
      const diff = newLines.length - selection.selectedText.length;

      setSelectionRange(textarea, {
        start: state.selection.start + diff,
        end: state.selection.end + diff,
      });
    } else {
      setSelectionRange(textarea, {
        start: selection.selection.start,
        end: newState.selection.end,
      });
    }
  },
};

export const autoPairBracketsCommands: Record<
  string,
  (ta: HTMLTextAreaElement) => boolean
> = {
  '(': (textarea) => applyWrappingFormatting(textarea, '(', ')', false),
  '[': (textarea) => applyWrappingFormatting(textarea, '[', ']', false, true),
  '{': (textarea) => applyWrappingFormatting(textarea, '{', '}', false),
  "'": (textarea) => applyWrappingFormatting(textarea, "'", "'", false),
  '"': (textarea) => applyWrappingFormatting(textarea, '"', '"', false),
};

export const autoPairMarkdownCommands: Record<
  string,
  (ta: HTMLTextAreaElement) => boolean
> = {
  '*': (textarea) => applyWrappingFormatting(textarea, '*', '*', false),
  _: (textarea) => applyWrappingFormatting(textarea, '_', '_', false),
  '`': (textarea) => applyWrappingFormatting(textarea, '`', '`', false),
  '=': (textarea) => applyWrappingFormatting(textarea, '=', '=', true),
  '~': (textarea) => applyWrappingFormatting(textarea, '~', '~', true),
  $: (textarea) => applyWrappingFormatting(textarea, '$', '$', true),
  '%': (textarea) => applyWrappingFormatting(textarea, '%', '%', true),
};

const pairMap: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  "'": "'",
  '"': '"',
  '*': '*',
  _: '_',
  '`': '`',
  '=': '=',
  '~': '~',
  $: '$',
  '%': '%',
};

export function unpair(
  textarea: HTMLTextAreaElement,
  commandList: Record<string, (ta: HTMLTextAreaElement) => boolean>
) {
  const state = getStateFromTextarea(textarea);

  if (
    state.selection.end !== state.selection.start ||
    state.selection.end === state.text.length
  ) {
    return false;
  }

  const char = state.text[state.selection.end - 1];
  const next = state.text[state.selection.end];

  if (commandList[char] && next === pairMap[char]) {
    setSelectionRange(textarea, {
      start: state.selection.end,
      end: state.selection.end + 1,
    });

    replaceSelection(textarea, '');

    return true;
  }
}

export function unpairBrackets(textarea: HTMLTextAreaElement) {
  return unpair(textarea, autoPairBracketsCommands);
}

export function unpairMarkdown(textarea: HTMLTextAreaElement) {
  return unpair(textarea, autoPairMarkdownCommands);
}

function applyTab(str: string, useTab: boolean, tabWidth: number) {
  const tab = useTab ? '\t' : ' '.repeat(tabWidth);

  return str
    .split('\n')
    .map((line) => {
      return tab + line;
    })
    .join('\n');
}

function removeTab(str: string, useTab: boolean, tabWidth: number) {
  const tab = useTab ? '\\t' : ' '.repeat(tabWidth);
  const firstTabRegExp = new RegExp(`^${tab}`);

  return str
    .split('\n')
    .map((line) => {
      if (!firstTabRegExp.test(line)) {
        return line;
      }

      return line.replace(firstTabRegExp, '');
    })
    .join('\n');
}

export function handleTab(
  textarea: HTMLTextAreaElement,
  isShiftPressed: boolean,
  useTab: boolean,
  tabWidth: number
) {
  const initialState = getStateFromTextarea(textarea);

  if (isShiftPressed) {
    const lineRange = expandSelectionToLineBoundaries(initialState);
    const selection = setSelectionRange(textarea, lineRange);

    replaceSelection(
      textarea,
      removeTab(selection.selectedText, useTab, tabWidth)
    );

    if (initialState.selection.start === initialState.selection.end) {
      const selectionAdjust = useTab ? 1 : tabWidth;

      setSelectionRange(textarea, {
        start: initialState.selection.start - selectionAdjust,
        end: initialState.selection.end - selectionAdjust,
      });
    }

    return true;
  }

  const lineRange = expandSelectionToLineBoundaries(initialState);
  const selection = setSelectionRange(textarea, lineRange);

  const withTab = applyTab(selection.selectedText, useTab, tabWidth);
  const withInitializedOrdinal = withTab.replace(
    /^(\s*)(\d+)([.)]\s)/,
    (_, space, number, after) => {
      return `${space}1${after}`;
    }
  );

  replaceSelection(textarea, withInitializedOrdinal);

  return true;
}

export function handleNewLine(textarea: HTMLTextAreaElement) {
  const initialState = getStateFromTextarea(textarea);

  if (initialState.selection.start !== initialState.selection.end) {
    return false;
  }

  const lineRange = expandSelectionToLineBoundaries(initialState);
  const before = textarea.value.slice(
    lineRange.start,
    initialState.selection.end
  );

  const line = textarea.value.slice(lineRange.start, lineRange.end);

  // Remove bullet list
  if (/^(\s*[-*+]\s+(?:\[[^\]]\]\s*)?)$/.test(line)) {
    setSelectionRange(textarea, {
      start: lineRange.start - 1,
      end: lineRange.end,
    });
    replaceSelection(textarea, '\n');
    return true;
  }

  // Remove ordered list
  if (/^(\s*\d[.)]\s+(?:\[[^\]]\]\s*)?)$/.test(line)) {
    setSelectionRange(textarea, {
      start: lineRange.start - 1,
      end: lineRange.end,
    });
    replaceSelection(textarea, '\n');
    return true;
  }

  // Maintain bullet list
  if (isBulleted.test(before)) {
    const pre = before.match(/^(\s*[-*+]\s+(?:\[[^\]]\]\s*)?)/)[1];
    insertTextAtCursor(
      textarea,
      `\n${pre.replace(/^(\s*[-*+]\s+)\[[^\]]\]/, '$1[ ]')}`
    );
    return true;
  }

  // Maintain ordered list
  if (isOrderedList.test(before)) {
    const pre = before.match(/^(\s*\d+[.)]\s+(?:\[[^\]]\]\s*)?)/)[1];
    const withEmptyCheckbox = pre.replace(/^(\s*\d+[.)]\s+)\[[^\]]\]/, '$1[ ]');
    const withIncrementedOrdinal = withEmptyCheckbox.replace(
      /^(\s*)(\d+)/,
      (_, space, number) => {
        return `${space}${parseInt(number) + 1}`;
      }
    );
    insertTextAtCursor(textarea, `\n${withIncrementedOrdinal}`);
    return true;
  }

  return false;
}
