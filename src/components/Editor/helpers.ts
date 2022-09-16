import { Platform } from 'obsidian';

import { StateManager } from 'src/StateManager';

import { getFileListFromClipboard, handleDragOrPaste } from '../Item/helpers';
import { insertTextAtCursor } from './insertTextAtCursor';

export interface TextRange {
  start: number;
  end: number;
}

export interface TextSection {
  text: string;
  selection: TextRange;
}

export interface TextState {
  text: string;
  selectedText: string;
  selection: TextRange;
}

const isLineDelimiter = (c: string) => c.charCodeAt(0) === 10;
const isWordDelimiter = (c: string) => c === ' ' || isLineDelimiter(c);

export function getSurroundingLines(text: string, start: number, end?: number) {
  if (!text) throw Error("Argument 'text' should be truthy");

  // leftIndex is initialized to 0 because if selection is 0, it won't even enter the iteration
  let leftIndex = 0;
  // rightIndex is initialized to text.length because if selection is equal to text.length it won't even enter the interation
  let rightIndex = text.length;

  // iterate to the left
  for (let i = start; i - 1 > -1; i--) {
    if (isLineDelimiter(text[i - 1])) {
      leftIndex = i;
      break;
    }
  }

  // iterate to the right
  for (let i = end === undefined ? start : end; i < text.length; i++) {
    if (isLineDelimiter(text[i])) {
      rightIndex = i;
      break;
    }
  }

  return { start: leftIndex, end: rightIndex };
}

export function getSurroundingWord(text: string, start: number, end?: number) {
  if (!text) throw Error("Argument 'text' should be truthy");

  // leftIndex is initialized to 0 because if selection is 0, it won't even enter the iteration
  let leftIndex = 0;
  // rightIndex is initialized to text.length because if selection is equal to text.length it won't even enter the interation
  let rightIndex = text.length;

  // iterate to the left
  for (let i = start; i - 1 > -1; i--) {
    if (isWordDelimiter(text[i - 1])) {
      leftIndex = i;
      break;
    }
  }

  // iterate to the right
  for (let i = end === undefined ? start : end; i < text.length; i++) {
    if (isWordDelimiter(text[i])) {
      rightIndex = i;
      break;
    }
  }

  return { start: leftIndex, end: rightIndex };
}

export function selectWord({ text, selection }: TextSection) {
  if (text && text.length && selection.start === selection.end) {
    // the user is pointing to a word
    return getSurroundingWord(text, selection.start);
  }
  return selection;
}

export function expandSelectionToWordBoundaries({
  text,
  selection,
}: TextSection) {
  if (text && text.length) {
    // the user is pointing to a word
    return getSurroundingWord(text, selection.start, selection.end);
  }
  return selection;
}

export function expandSelectionToLineBoundaries({
  text,
  selection,
}: TextSection) {
  if (text && text.length) {
    return getSurroundingLines(text, selection.start, selection.end);
  }
  return selection;
}

/**
 *  Gets the number of line-breaks that would have to be inserted before the given 'startPosition'
 *  to make sure there's an empty line between 'startPosition' and the previous text
 */
export function getBreaksNeededForEmptyLineBefore(
  text = '',
  startPosition: number
): number {
  if (startPosition === 0) return 0;

  // rules:
  // - If we're in the first line, no breaks are needed
  // - Otherwise there must be 2 breaks before the previous character. Depending on how many breaks exist already, we
  //      may need to insert 0, 1 or 2 breaks

  let neededBreaks = 2;
  let isInFirstLine = true;
  for (let i = startPosition - 1; i >= 0 && neededBreaks >= 0; i--) {
    switch (text.charCodeAt(i)) {
      case 32: // blank space
        continue;
      case 10: // line break
        neededBreaks--;
        isInFirstLine = false;
        break;
      default:
        return neededBreaks;
    }
  }
  return isInFirstLine ? 0 : neededBreaks;
}

/**
 *  Gets the number of line-breaks that would have to be inserted after the given 'startPosition'
 *  to make sure there's an empty line between 'startPosition' and the next text
 */
export function getBreaksNeededForEmptyLineAfter(
  text = '',
  startPosition: number
): number {
  if (startPosition === text.length - 1) return 0;

  // rules:
  // - If we're in the first line, no breaks are needed
  // - Otherwise there must be 2 breaks before the previous character. Depending on how many breaks exist already, we
  //      may need to insert 0, 1 or 2 breaks

  let neededBreaks = 2;
  let isInLastLine = true;
  for (let i = startPosition; i < text.length && neededBreaks >= 0; i++) {
    switch (text.charCodeAt(i)) {
      case 32:
        continue;
      case 10: {
        neededBreaks--;
        isInLastLine = false;
        break;
      }
      default:
        return neededBreaks;
    }
  }
  return isInLastLine ? 0 : neededBreaks;
}

export function getStateFromTextarea(textarea: HTMLTextAreaElement): TextState {
  return {
    selection: {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    },
    text: textarea.value,
    selectedText: textarea.value.slice(
      textarea.selectionStart,
      textarea.selectionEnd
    ),
  };
}

export function replaceSelection(textarea: HTMLTextAreaElement, text: string) {
  insertTextAtCursor(textarea, text);
  return getStateFromTextarea(textarea);
}

export function setSelectionRange(
  textarea: HTMLTextAreaElement,
  selection: TextRange
): TextState {
  textarea.focus();
  textarea.selectionStart = selection.start;
  textarea.selectionEnd = selection.end;
  return getStateFromTextarea(textarea);
}

export function toggleWrappingFormattingCommand(
  textarea: HTMLTextAreaElement,
  isApplied: RegExp,
  unApply: (s: string) => string,
  formatting: string
) {
  const state = getStateFromTextarea(textarea);

  // Adjust the selection to encompass the whole word if the caret is inside one
  const newSelectionRange = expandSelectionToWordBoundaries({
    text: state.text,
    selection: state.selection,
  });

  const selection = setSelectionRange(textarea, newSelectionRange);

  if (isApplied.test(selection.selectedText)) {
    replaceSelection(textarea, unApply(selection.selectedText));
    setSelectionRange(textarea, {
      start: selection.selection.start,
      end:
        selection.selection.start +
        selection.selectedText.length -
        formatting.length * 2,
    });
  } else {
    // Replaces the current selection with the bold mark up
    const formattedState = replaceSelection(
      textarea,
      `${formatting}${selection.selectedText}${formatting}`
    );
    setSelectionRange(textarea, {
      start:
        formattedState.selection.end -
        formatting.length -
        selection.selectedText.length,
      end: formattedState.selection.end - formatting.length,
    });
  }
}

export function applyWrappingFormatting(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  requireSelection?: boolean,
  allowInMiddle?: boolean
) {
  const state = getStateFromTextarea(textarea);

  if (requireSelection && state.selection.end === state.selection.start) {
    return false;
  }

  // Prevent wrapping in the middle of typing a word. Eg. Prevent: don't'
  if (
    !allowInMiddle &&
    state.selection.end === state.selection.start &&
    state.selection.start > 0 &&
    textarea.value[state.selection.start - 1] !== ' '
  ) {
    return false;
  }

  if (state.selection.end === state.selection.start) {
    const formattedState = replaceSelection(textarea, `${after}`);
    setSelectionRange(textarea, {
      start: formattedState.selection.end - 1 - state.selectedText.length,
      end: formattedState.selection.end - 1,
    });

    return false;
  }

  const formattedState = replaceSelection(
    textarea,
    `${before}${state.selectedText}${after}`
  );
  setSelectionRange(textarea, {
    start: formattedState.selection.end - 1 - state.selectedText.length,
    end: formattedState.selection.end - 1,
  });

  return true;
}

export function toggleLineFormatting(
  textarea: HTMLTextAreaElement,
  isApplied: RegExp,
  apply: (s: string) => string,
  remove: (s: string) => string
) {
  const state = getStateFromTextarea(textarea);

  const lineRange = expandSelectionToLineBoundaries({
    text: state.text,
    selection: state.selection,
  });

  const selection = setSelectionRange(textarea, lineRange);

  const newLines = isApplied.test(selection.selectedText)
    ? remove(selection.selectedText)
    : apply(selection.selectedText);
  const newState = replaceSelection(textarea, newLines);

  setSelectionRange(textarea, {
    start: selection.selection.start,
    end: newState.selection.end,
  });
}

export function getDropAction(
  stateManager: StateManager,
  transfer: DataTransfer
) {
  // Return a 'copy' or 'link' action according to the content types, or undefined if no recognized type
  if (transfer.types.includes('text/uri-list')) return 'link';
  if (
    ['file', 'files', 'link', 'folder'].includes(
      (stateManager.app as any).dragManager.draggable?.type
    )
  )
    return 'link';
  if (
    transfer.types.includes('text/html') ||
    transfer.types.includes('text/plain')
  )
    return 'copy';
}

export async function handlePaste(
  e: ClipboardEvent,
  stateManager: StateManager,
  win: Window & typeof globalThis
) {
  const html = e.clipboardData.getData('text/html');
  const hasFiles = e.clipboardData.types.includes('Files');
  const electronClipboardFiles = Platform.isDesktopApp
    ? getFileListFromClipboard(win)
    : null;

  const shouldConsumePaste =
    html || hasFiles || electronClipboardFiles?.length > 0;

  if (shouldConsumePaste) {
    e.preventDefault();
  }

  try {
    const pasteLines = await handleDragOrPaste(stateManager, e, win);

    if (shouldConsumePaste) {
      const input = e.target as HTMLTextAreaElement;
      const paste = pasteLines.join('\n');

      replaceSelection(input, paste);
    }
  } catch (e) {
    console.error(e);
    stateManager.setError(e);
  }
}
