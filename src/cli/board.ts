import { readFileSync, writeFileSync } from 'fs';
import type { Board, Item, Lane } from 'src/components/types';
import { laneTitleWithMaxItems } from 'src/helpers';
import { frontmatterKey } from 'src/parsers/common';
import {
  astToUnhydratedBoard,
  boardToMd,
  newItem,
  updateItemContent,
} from 'src/parsers/formats/list';
import { parseMarkdown } from 'src/parsers/parseMarkdown';

import { createStateManager } from './stateManagerStub';

export class BoardError extends Error {}

/**
 * Parses markdown into a `Board` without hydrating it. Hydration resolves
 * moment dates and vault links for rendering, neither of which the CLI needs.
 */
export function mdToBoard(md: string, filePath: string): Board {
  const stateManager = createStateManager(filePath);

  let parsed: ReturnType<typeof parseMarkdown>;
  try {
    parsed = parseMarkdown(stateManager, md);
  } catch (e) {
    throw new BoardError(`Cannot parse ${filePath}: ${(e as Error).message}`);
  }

  const { settings, frontmatter, ast } = parsed;

  if (!settings[frontmatterKey] && !frontmatter[frontmatterKey]) {
    throw new BoardError(`${filePath} is not a Kanban board: no "${frontmatterKey}" frontmatter`);
  }

  return astToUnhydratedBoard(stateManager, settings, frontmatter, ast, md);
}

export { boardToMd };

/**
 * `boardToMd` always emits LF and never a final newline. Obsidian vaults are
 * edited on every platform, so writing that shape back over a CRLF board would
 * rewrite every line of the file. These carry the original file's conventions
 * onto the new markdown instead.
 */
function matchLineEndings(md: string, original: string): string {
  const lf = md.replace(/\r\n/g, '\n');
  return original.includes('\r\n') ? lf.replace(/\n/g, '\r\n') : lf;
}

function finalNewline(md: string, original: string): string {
  if (!/\r?\n$/.test(original) || /\r?\n$/.test(md)) return '';
  return original.includes('\r\n') ? '\r\n' : '\n';
}

export function serializeBoard(board: Board, original: string): string {
  const md = boardToMd(board);
  return matchLineEndings(md, original) + finalNewline(md, original);
}

export function loadBoard(filePath: string): Board {
  let md: string;

  try {
    md = readFileSync(filePath, 'utf8');
  } catch (e) {
    throw new BoardError(`Cannot read ${filePath}: ${(e as Error).message}`);
  }

  return mdToBoard(md, filePath);
}

/**
 * Serializes first, writes second, so a serialization failure leaves the
 * original file untouched. The file on disk is re-read only to copy its line
 * endings and final newline; a board that has gone missing falls back to the
 * serializer's own shape rather than failing the write.
 */
export function saveBoard(filePath: string, board: Board): void {
  const md = boardToMd(board);

  let original = '';
  try {
    original = readFileSync(filePath, 'utf8');
  } catch {
    // Nothing to match; write the serializer's own shape.
  }

  writeFileSync(filePath, matchLineEndings(md, original) + finalNewline(md, original), 'utf8');
}

function stateManagerFor(board: Board) {
  const stateManager = createStateManager(board.id);
  (stateManager as any).compileSettings(board.data.settings);
  return stateManager;
}

/** Builds an `Item` from card text, using the board's own settings. */
export function createItem(board: Board, text: string, checkChar = ' '): Item {
  return newItem(stateManagerFor(board), text, checkChar);
}

/** Replaces a card's text, keeping its block id. */
export function reviseItem(board: Board, item: Item, text: string): Item {
  return updateItemContent(stateManagerFor(board), item, text);
}

export function findLane(board: Board, name: string): { lane: Lane; index: number } {
  // `list` prints a lane's heading, limit included, so both forms resolve.
  const matches = board.children.reduce<number[]>((found, lane, index) => {
    const heading = laneTitleWithMaxItems(lane.data.title, lane.data.maxItems);
    if (lane.data.title === name || heading === name) found.push(index);
    return found;
  }, []);

  if (!matches.length) {
    const known = board.children.map((lane) =>
      laneTitleWithMaxItems(lane.data.title, lane.data.maxItems)
    );
    throw new BoardError(
      `No lane named "${name}". Lanes: ${known.length ? known.join(', ') : '(none)'}`
    );
  }

  // Obsidian allows two lanes to share a title. Guessing which one was meant
  // would silently edit the wrong lane.
  if (matches.length > 1) {
    const list = matches.slice(0, -1).join(', ') + ' and ' + matches[matches.length - 1];
    throw new BoardError(`Lane name "${name}" is ambiguous: lanes ${list} share it`);
  }

  const index = matches[0];

  return { lane: board.children[index], index };
}

export function findCard(
  board: Board,
  laneName: string,
  index: number
): { lane: Lane; laneIndex: number; item: Item } {
  const { lane, index: laneIndex } = findLane(board, laneName);

  if (!Number.isInteger(index) || index < 0 || index >= lane.children.length) {
    throw new BoardError(
      `No card at index ${index} in lane "${laneName}". Valid indices: ` +
        (lane.children.length ? `0-${lane.children.length - 1}` : '(lane is empty)')
    );
  }

  return { lane, laneIndex, item: lane.children[index] };
}

/** Clamps an insertion position to the bounds of a list; undefined appends. */
export function insertionIndex(length: number, pos?: number): number {
  if (pos === undefined) return length;
  if (!Number.isInteger(pos) || pos < 0) {
    throw new BoardError(`Position must be a non-negative integer, got "${pos}"`);
  }
  return Math.min(pos, length);
}
