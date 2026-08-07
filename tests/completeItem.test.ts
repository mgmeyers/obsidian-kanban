import { LaneSort } from 'src/components/types';
import {
  DEFAULT_DONE_LANE_NAME,
  autoMoveDoneItem,
  findLaneIndexByTitle,
  isItemComplete,
} from 'src/helpers/completeItem';
import { beforeEach, describe, expect, it } from 'vitest';

import { boardShape, makeBoard, makeItem, makeLane, resetIds } from './helpers/fixtures';

const enabled = { enabled: true, laneName: DEFAULT_DONE_LANE_NAME };

function threeLaneBoard() {
  return makeBoard([
    makeLane('Todo', [makeItem('write tests'), makeItem('write docs')]),
    makeLane('Doing', [makeItem('build the thing')]),
    makeLane('Done', [makeItem('older finished thing', 'x')], { shouldMarkItemsComplete: true }),
  ]);
}

beforeEach(() => {
  resetIds();
});

describe('findLaneIndexByTitle', () => {
  it('finds a lane by exact title', () => {
    expect(findLaneIndexByTitle(threeLaneBoard(), 'Done')).toBe(2);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(findLaneIndexByTitle(threeLaneBoard(), '  dOnE ')).toBe(2);
  });

  it('returns -1 when nothing matches', () => {
    expect(findLaneIndexByTitle(threeLaneBoard(), 'Complete')).toBe(-1);
  });

  it('returns -1 for an empty name', () => {
    expect(findLaneIndexByTitle(threeLaneBoard(), '')).toBe(-1);
    expect(findLaneIndexByTitle(threeLaneBoard(), '   ')).toBe(-1);
    expect(findLaneIndexByTitle(threeLaneBoard(), undefined)).toBe(-1);
  });

  it('matches a lane whose title carries a WIP limit', () => {
    // parseLaneTitle strips the `(n)` suffix into maxItems before this point
    const board = makeBoard([makeLane('Todo'), makeLane('Done', [], { maxItems: 5 })]);
    expect(findLaneIndexByTitle(board, 'Done')).toBe(1);
  });

  it('takes the first match when lanes share a title', () => {
    const board = makeBoard([makeLane('Done'), makeLane('Todo'), makeLane('Done')]);
    expect(findLaneIndexByTitle(board, 'Done')).toBe(0);
  });
});

describe('isItemComplete', () => {
  it('is true only for a checked card carrying the done status', () => {
    expect(isItemComplete(makeItem('a', 'x'))).toBe(true);
    expect(isItemComplete(makeItem('a', ' '))).toBe(false);
    // in progress: checked, but not the done character
    expect(isItemComplete(makeItem('a', '/'))).toBe(false);
    expect(isItemComplete(undefined)).toBe(false);
  });
});

describe('autoMoveDoneItem', () => {
  it('moves a completed card to the done lane', () => {
    const board = threeLaneBoard();
    const completed = makeItem('write tests ✅ 2026-08-07', 'x');

    const next = autoMoveDoneItem(board, [0, 0], [completed], 0, enabled);

    expect(boardShape(next)).toEqual({
      Todo: ['write docs'],
      Doing: ['build the thing'],
      Done: ['older finished thing', 'write tests ✅ 2026-08-07'],
    });
  });

  it('leaves the original board untouched', () => {
    const board = threeLaneBoard();

    autoMoveDoneItem(board, [0, 0], [makeItem('write tests', 'x')], 0, enabled);

    expect(boardShape(board)).toEqual({
      Todo: ['write tests', 'write docs'],
      Doing: ['build the thing'],
      Done: ['older finished thing'],
    });
  });

  it('prepends when the board prepends new cards', () => {
    const board = threeLaneBoard();
    const completed = makeItem('write tests', 'x');

    const next = autoMoveDoneItem(board, [0, 0], [completed], 0, {
      ...enabled,
      insertionMethod: 'prepend',
    });

    expect(boardShape(next).Done).toEqual(['write tests', 'older finished thing']);
  });

  it('appends by default', () => {
    const board = threeLaneBoard();
    const next = autoMoveDoneItem(board, [0, 0], [makeItem('write tests', 'x')], 0, enabled);

    expect(boardShape(next).Done).toEqual(['older finished thing', 'write tests']);
  });

  it('honours a custom lane name', () => {
    const board = makeBoard([
      makeLane('Backlog', [makeItem('a')]),
      makeLane('Afgerond', [makeItem('b', 'x')]),
    ]);

    const next = autoMoveDoneItem(board, [0, 0], [makeItem('a', 'x')], 0, {
      enabled: true,
      laneName: 'afgerond',
    });

    expect(boardShape(next)).toEqual({ Backlog: [], Afgerond: ['b', 'a'] });
  });

  it('does nothing when the feature is off', () => {
    const board = threeLaneBoard();

    const next = autoMoveDoneItem(board, [0, 0], [makeItem('write tests', 'x')], 0, {
      ...enabled,
      enabled: false,
    });

    expect(boardShape(next)).toEqual({
      Todo: ['write tests', 'write docs'],
      Doing: ['build the thing'],
      Done: ['older finished thing'],
    });
  });

  it('does nothing when no lane matches the configured name', () => {
    const board = threeLaneBoard();

    const next = autoMoveDoneItem(board, [0, 0], [makeItem('write tests', 'x')], 0, {
      enabled: true,
      laneName: 'Finished',
    });

    expect(boardShape(next).Todo).toEqual(['write tests', 'write docs']);
    expect(boardShape(next).Done).toEqual(['older finished thing']);
  });

  it('does nothing when the card is already in the done lane', () => {
    const board = threeLaneBoard();

    const next = autoMoveDoneItem(
      board,
      [2, 0],
      [makeItem('older finished thing', 'x')],
      0,
      enabled
    );

    expect(boardShape(next).Done).toEqual(['older finished thing']);
  });

  it('does not move a card that was just unchecked', () => {
    const board = threeLaneBoard();

    const next = autoMoveDoneItem(board, [1, 0], [makeItem('build the thing', ' ')], 0, enabled);

    expect(boardShape(next)).toEqual({
      Todo: ['write tests', 'write docs'],
      Doing: ['build the thing'],
      Done: ['older finished thing'],
    });
  });

  it('does not move a card checked into a non-done status', () => {
    const board = threeLaneBoard();

    const next = autoMoveDoneItem(board, [1, 0], [makeItem('build the thing', '/')], 0, enabled);

    expect(boardShape(next).Doing).toEqual(['build the thing']);
    expect(boardShape(next).Done).toEqual(['older finished thing']);
  });

  it('keeps the checkbox change when nothing moves', () => {
    const board = threeLaneBoard();

    const next = autoMoveDoneItem(board, [1, 0], [makeItem('build the thing', '/')], 0, enabled);

    expect(next.children[1].children[0].data.checkChar).toBe('/');
  });

  it('preserves position of the remaining cards in the source lane', () => {
    const board = threeLaneBoard();

    const next = autoMoveDoneItem(board, [0, 1], [makeItem('write docs', 'x')], 0, enabled);

    expect(boardShape(next).Todo).toEqual(['write tests']);
  });

  describe('recurring tasks', () => {
    // What the Tasks plugin hands back: the next occurrence plus the completed
    // one. `completedIndex` points at the completed occurrence.
    const recurrence = () => [
      makeItem('water plants 🔁 every week 📅 2026-08-14', ' '),
      makeItem('water plants 🔁 every week 📅 2026-08-07 ✅ 2026-08-07', 'x'),
    ];

    it('moves the completed occurrence and leaves the new one behind', () => {
      const board = threeLaneBoard();

      const next = autoMoveDoneItem(board, [0, 0], recurrence(), 1, enabled);

      expect(boardShape(next)).toEqual({
        Todo: ['water plants 🔁 every week 📅 2026-08-14', 'write docs'],
        Doing: ['build the thing'],
        Done: ['older finished thing', 'water plants 🔁 every week 📅 2026-08-07 ✅ 2026-08-07'],
      });
    });

    it('keeps the new occurrence at the completed card position', () => {
      const board = threeLaneBoard();

      const next = autoMoveDoneItem(board, [0, 1], recurrence(), 1, enabled);

      expect(boardShape(next).Todo).toEqual([
        'write tests',
        'water plants 🔁 every week 📅 2026-08-14',
      ]);
    });

    it('handles the completed occurrence coming first', () => {
      // Tasks' `recurrenceOnNextLine` setting flips the order
      const board = threeLaneBoard();
      const items = recurrence().reverse();

      const next = autoMoveDoneItem(board, [0, 0], items, 0, enabled);

      expect(boardShape(next).Todo).toEqual([
        'water plants 🔁 every week 📅 2026-08-14',
        'write docs',
      ]);
      expect(boardShape(next).Done).toEqual([
        'older finished thing',
        'water plants 🔁 every week 📅 2026-08-07 ✅ 2026-08-07',
      ]);
    });

    it('keeps both occurrences in place when the feature is off', () => {
      const board = threeLaneBoard();

      const next = autoMoveDoneItem(board, [0, 0], recurrence(), 1, {
        ...enabled,
        enabled: false,
      });

      expect(boardShape(next).Todo).toEqual([
        'water plants 🔁 every week 📅 2026-08-14',
        'water plants 🔁 every week 📅 2026-08-07 ✅ 2026-08-07',
        'write docs',
      ]);
    });
  });

  it('clears the sort flag on the done lane so the card stays put', () => {
    const board = makeBoard([
      makeLane('Todo', [makeItem('a')]),
      makeLane('Done', [makeItem('b', 'x')], { sorted: LaneSort.TitleAsc }),
    ]);

    const next = autoMoveDoneItem(board, [0, 0], [makeItem('a', 'x')], 0, enabled);

    expect(next.children[1].data.sorted).toBeUndefined();
    expect(boardShape(next).Done).toEqual(['b', 'a']);
  });

  it('leaves an unsorted done lane alone', () => {
    const board = threeLaneBoard();
    const next = autoMoveDoneItem(board, [0, 0], [makeItem('write tests', 'x')], 0, enabled);

    expect('sorted' in next.children[2].data).toBe(false);
  });

  it('moves into a done lane that sits before the source lane', () => {
    const board = makeBoard([
      makeLane('Done', [makeItem('b', 'x')]),
      makeLane('Todo', [makeItem('a'), makeItem('c')]),
    ]);

    const next = autoMoveDoneItem(board, [1, 0], [makeItem('a', 'x')], 0, enabled);

    expect(boardShape(next)).toEqual({ Done: ['b', 'a'], Todo: ['c'] });
  });

  it('moves into an empty done lane', () => {
    const board = makeBoard([makeLane('Todo', [makeItem('a')]), makeLane('Done')]);

    const next = autoMoveDoneItem(board, [0, 0], [makeItem('a', 'x')], 0, enabled);

    expect(boardShape(next)).toEqual({ Todo: [], Done: ['a'] });
  });
});
