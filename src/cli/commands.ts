import update from 'immutability-helper';
import { generateInstanceId } from 'src/components/helpers';
import type { Board, Item, Lane } from 'src/components/types';
import { LaneTemplate } from 'src/components/types';
import { getTaskStatusDone } from 'src/parsers/helpers/inlineMetadata';

import { BoardError, createItem, findCard, findLane, insertionIndex, reviseItem } from './board';

export interface CardListing {
  index: number;
  title: string;
  done: boolean;
}

export interface LaneListing {
  title: string;
  /** Largest card count the lane wants, written as `## Title (n)`. 0 means none. */
  maxItems: number;
  cards: CardListing[];
}

function listCards(items: Item[]): CardListing[] {
  return items.map((item, index) => ({
    index,
    title: item.data.titleRaw,
    done: !!item.data.checked,
  }));
}

export function listBoard(board: Board): LaneListing[] {
  return board.children.map((lane) => ({
    title: lane.data.title,
    maxItems: lane.data.maxItems ?? 0,
    cards: listCards(lane.children),
  }));
}

/** Archived cards, which live outside the lanes and are indexed separately. */
export function listArchive(board: Board): CardListing[] {
  return listCards(board.data.archive ?? []);
}

export function addCard(board: Board, args: { lane: string; text: string; pos?: number }): Board {
  const { index: laneIndex, lane } = findLane(board, args.lane);
  const at = insertionIndex(lane.children.length, args.pos);

  return update(board, {
    children: { [laneIndex]: { children: { $splice: [[at, 0, createItem(board, args.text)]] } } },
  });
}

export function editCard(board: Board, args: { lane: string; index: number; text: string }): Board {
  const { laneIndex, item } = findCard(board, args.lane, args.index);

  return update(board, {
    children: {
      [laneIndex]: { children: { [args.index]: { $set: reviseItem(board, item, args.text) } } },
    },
  });
}

export function removeCard(board: Board, args: { lane: string; index: number }): Board {
  const { laneIndex } = findCard(board, args.lane, args.index);

  return update(board, {
    children: { [laneIndex]: { children: { $splice: [[args.index, 1]] } } },
  });
}

export function setDone(
  board: Board,
  args: { lane: string; index: number; undo?: boolean }
): Board {
  const { laneIndex } = findCard(board, args.lane, args.index);
  const checked = !args.undo;

  return update(board, {
    children: {
      [laneIndex]: {
        children: {
          [args.index]: {
            data: {
              checked: { $set: checked },
              checkChar: { $set: checked ? getTaskStatusDone() : ' ' },
            },
          },
        },
      },
    },
  });
}

/**
 * Mirrors maybeCompleteForMove in src/components/helpers.ts: a card moved into
 * a lane marked `**Complete**` is checked, and one moved out is unchecked. The
 * plugin's Tasks-plugin branch is dropped, since the CLI has no plugins.
 */
function completeForMove(item: Item, from: Lane, to: Lane): Item {
  const wasComplete = !!from.data.shouldMarkItemsComplete;
  const shouldComplete = !!to.data.shouldMarkItemsComplete;

  if (!wasComplete && !shouldComplete) return item;

  const isComplete = !!item.data.checked && item.data.checkChar === getTaskStatusDone();
  if (shouldComplete === isComplete) return item;

  return update(item, {
    data: {
      checked: { $set: shouldComplete },
      checkChar: { $set: shouldComplete ? getTaskStatusDone() : ' ' },
    },
  });
}

export function moveCard(
  board: Board,
  args: { lane: string; index: number; to: string; pos?: number }
): Board {
  const { laneIndex: fromLane, lane: from, item } = findCard(board, args.lane, args.index);
  const { index: toLane, lane: to } = findLane(board, args.to);

  // Reordering within one lane must not touch the card's check state.
  const moved = fromLane === toLane ? item : completeForMove(item, from, to);

  const removed = update(board, {
    children: { [fromLane]: { children: { $splice: [[args.index, 1]] } } },
  });

  const at = insertionIndex(removed.children[toLane].children.length, args.pos);

  return update(removed, {
    children: { [toLane]: { children: { $splice: [[at, 0, moved]] } } },
  });
}

/**
 * Mirrors the plugin: one `list-collapse` entry per lane, spliced at the lane's
 * own index. Boards that do not carry the setting are left without it.
 */
function spliceCollapseState(board: Board, at: number, deleteCount: number, insert?: boolean) {
  const collapsed = board.data.settings['list-collapse'];
  if (!collapsed) return board;

  const next = [...collapsed];
  if (insert === undefined) next.splice(at, deleteCount);
  else next.splice(at, deleteCount, insert);

  return update(board, { data: { settings: { 'list-collapse': { $set: next } } } });
}

export function addLane(
  board: Board,
  args: { name: string; pos?: number; maxItems?: number }
): Board {
  // A board stores a lane limit as `## Title (n)`, so a name in that shape would
  // come back as a different name with a limit attached.
  if (/\(\d+\)$/.test(args.name.trim())) {
    throw new BoardError(
      `Lane name "${args.name}" ends with a lane limit. ` +
        'Pass the name without it and set the limit with --max-items.'
    );
  }

  if (board.children.some((lane) => lane.data.title === args.name)) {
    throw new BoardError(`There is already a lane named "${args.name}"`);
  }

  const lane: Lane = {
    ...LaneTemplate,
    id: generateInstanceId(),
    children: [],
    data: {
      title: args.name,
      maxItems: args.maxItems ?? 0,
      shouldMarkItemsComplete: false,
    },
  };

  const at = insertionIndex(board.children.length, args.pos);

  return spliceCollapseState(
    update(board, { children: { $splice: [[at, 0, lane]] } }),
    at,
    0,
    false
  );
}

export function removeLane(board: Board, args: { name: string }): Board {
  const { index } = findLane(board, args.name);

  return spliceCollapseState(update(board, { children: { $splice: [[index, 1]] } }), index, 1);
}
