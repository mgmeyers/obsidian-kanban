import { readFileSync } from 'fs';
import { join } from 'path';
import type { Board } from 'src/components/types';
import { beforeEach, describe, expect, it } from 'vitest';

import { boardToMd, mdToBoard } from './board';
import {
  addCard,
  addLane,
  editCard,
  listArchive,
  listBoard,
  moveCard,
  removeCard,
  removeLane,
  setDone,
} from './commands';

function fixture(name: string): Board {
  const path = join(__dirname, '__fixtures__', name);
  return mdToBoard(readFileSync(path, 'utf8'), path);
}

/** A board whose lane titles are not unique; Obsidian allows this. */
function ambiguousBoard(): Board {
  const md = readFileSync(join(__dirname, '__fixtures__', 'simple.md'), 'utf8');
  return mdToBoard(md.replace('## Doing', '## Todo'), 'dup.md');
}

function titles(board: Board, lane: string): string[] {
  return board.children
    .find((l) => l.data.title === lane)
    .children.map((item) => item.data.titleRaw);
}

/** Every lane except the named one, as markdown, so drift elsewhere shows up. */
function otherLanes(board: Board, except: string): string {
  return boardToMd({
    ...board,
    children: board.children.filter((lane) => lane.data.title !== except),
  } as Board);
}

describe('listBoard', () => {
  it('reports lanes, cards, indices, and checked state', () => {
    expect(listBoard(fixture('simple.md'))).toEqual([
      {
        title: 'Todo',
        maxItems: 0,
        cards: [
          { index: 0, title: 'First card', done: false },
          { index: 1, title: 'Second card', done: false },
        ],
      },
      { title: 'Doing', maxItems: 0, cards: [] },
      { title: 'Done', maxItems: 0, cards: [{ index: 0, title: 'Finished card', done: true }] },
    ]);
  });
});

describe('listArchive', () => {
  it('reports archived cards with their own indices', () => {
    expect(listArchive(fixture('settings.md'))).toEqual([
      { index: 0, title: 'Old card', done: true },
      { index: 1, title: 'Older card', done: true },
    ]);
  });

  it('is empty on a board with no archive', () => {
    expect(listArchive(fixture('simple.md'))).toEqual([]);
  });

  it('does not report archived cards as lane cards', () => {
    expect(listBoard(fixture('settings.md')).map((l) => l.title)).toEqual(['Backlog', 'Done']);
  });
});

describe('lane limits', () => {
  it('reports a lane limit, and 0 for a lane without one', () => {
    const lanes = listBoard(fixture('metadata.md'));
    expect(lanes[0]).toMatchObject({ title: 'Inbox', maxItems: 3 });
    expect(lanes[1]).toMatchObject({ title: 'Empty', maxItems: 0 });
  });

  it('sets a limit on a new lane', () => {
    const next = addLane(fixture('simple.md'), { name: 'Review', maxItems: 4 });
    expect(next.children[3].data.maxItems).toBe(4);
    expect(boardToMd(next)).toContain('## Review (4)');
  });

  it('writes no limit when none is given', () => {
    expect(boardToMd(addLane(fixture('simple.md'), { name: 'Review' }))).toContain('## Review\n');
  });

  it('refuses a name that a board would read as a limit', () => {
    expect(() => addLane(fixture('simple.md'), { name: 'Review (5)' })).toThrow(
      /ends with a lane limit/
    );
  });

  it('addresses a limited lane by either the bare name or the heading', () => {
    expect(
      titles(addCard(fixture('metadata.md'), { lane: 'Inbox', text: 'a' }), 'Inbox')
    ).toHaveLength(7);
    const viaHeading = addCard(fixture('metadata.md'), { lane: 'Inbox (3)', text: 'a' });
    expect(viaHeading.children[0].children).toHaveLength(7);
  });

  it('keeps the limit when a lane is removed from around it', () => {
    const next = removeLane(fixture('metadata.md'), { name: 'Empty' });
    expect(boardToMd(next)).toContain('## Inbox (3)');
  });
});

describe('addCard', () => {
  let board: Board;
  beforeEach(() => (board = fixture('simple.md')));

  it('appends to the named lane by default', () => {
    const next = addCard(board, { lane: 'Todo', text: 'Third card' });
    expect(titles(next, 'Todo')).toEqual(['First card', 'Second card', 'Third card']);
  });

  it('inserts at an explicit position', () => {
    const next = addCard(board, { lane: 'Todo', text: 'Zeroth card', pos: 0 });
    expect(titles(next, 'Todo')).toEqual(['Zeroth card', 'First card', 'Second card']);
  });

  it('adds to an empty lane', () => {
    const next = addCard(board, { lane: 'Doing', text: 'Started' });
    expect(titles(next, 'Doing')).toEqual(['Started']);
  });

  it('leaves other lanes untouched', () => {
    const next = addCard(board, { lane: 'Todo', text: 'Third card' });
    expect(otherLanes(next, 'Todo')).toBe(otherLanes(board, 'Todo'));
  });

  it('rejects an unknown lane', () => {
    expect(() => addCard(board, { lane: 'Nope', text: 'x' })).toThrow(/No lane named "Nope"/);
  });
});

describe('editCard', () => {
  let board: Board;
  beforeEach(() => (board = fixture('simple.md')));

  it('replaces the card text in place', () => {
    const next = editCard(board, { lane: 'Todo', index: 0, text: 'Renamed' });
    expect(titles(next, 'Todo')).toEqual(['Renamed', 'Second card']);
  });

  it('keeps the block id', () => {
    const withId = fixture('metadata.md');
    const next = editCard(withId, { lane: 'Inbox', index: 4, text: 'Rewritten' });
    expect(next.children[0].children[4].data.blockId).toBe('abc123');
    expect(boardToMd(next)).toContain('- [ ] Rewritten ^abc123');
  });

  it('rejects an out of range index', () => {
    expect(() => editCard(board, { lane: 'Todo', index: 9, text: 'x' })).toThrow(
      /No card at index 9 .* Valid indices: 0-1/
    );
  });
});

describe('setDone', () => {
  let board: Board;
  beforeEach(() => (board = fixture('simple.md')));

  it('checks an unchecked card', () => {
    const next = setDone(board, { lane: 'Todo', index: 0 });
    expect(next.children[0].children[0].data.checked).toBe(true);
    expect(boardToMd(next)).toContain('- [x] First card');
  });

  it('unchecks with undo', () => {
    const next = setDone(board, { lane: 'Done', index: 0, undo: true });
    expect(next.children[2].children[0].data.checked).toBe(false);
    expect(boardToMd(next)).toContain('- [ ] Finished card');
  });

  it('leaves other lanes untouched', () => {
    const next = setDone(board, { lane: 'Todo', index: 0 });
    expect(otherLanes(next, 'Todo')).toBe(otherLanes(board, 'Todo'));
  });
});

describe('removeCard', () => {
  it('drops only the addressed card', () => {
    const board = fixture('simple.md');
    const next = removeCard(board, { lane: 'Todo', index: 0 });
    expect(titles(next, 'Todo')).toEqual(['Second card']);
    expect(otherLanes(next, 'Todo')).toBe(otherLanes(board, 'Todo'));
  });
});

describe('moveCard', () => {
  let board: Board;
  beforeEach(() => (board = fixture('simple.md')));

  it('moves a card to the end of another lane', () => {
    const next = moveCard(board, { lane: 'Todo', index: 0, to: 'Done' });
    expect(titles(next, 'Todo')).toEqual(['Second card']);
    expect(titles(next, 'Done')).toEqual(['Finished card', 'First card']);
  });

  it('moves a card to an explicit position', () => {
    const next = moveCard(board, { lane: 'Todo', index: 1, to: 'Done', pos: 0 });
    expect(titles(next, 'Done')).toEqual(['Second card', 'Finished card']);
  });

  it('reorders within one lane', () => {
    const next = moveCard(board, { lane: 'Todo', index: 1, to: 'Todo', pos: 0 });
    expect(titles(next, 'Todo')).toEqual(['Second card', 'First card']);
  });

  it('rejects an unknown destination', () => {
    expect(() => moveCard(board, { lane: 'Todo', index: 0, to: 'Nope' })).toThrow(
      /No lane named "Nope"/
    );
  });
});

describe('addLane', () => {
  let board: Board;
  beforeEach(() => (board = fixture('simple.md')));

  it('appends an empty lane', () => {
    const next = addLane(board, { name: 'Blocked' });
    expect(next.children.map((l) => l.data.title)).toEqual(['Todo', 'Doing', 'Done', 'Blocked']);
    expect(next.children[3].children).toEqual([]);
  });

  it('inserts at an explicit position', () => {
    const next = addLane(board, { name: 'Blocked', pos: 1 });
    expect(next.children.map((l) => l.data.title)).toEqual(['Todo', 'Blocked', 'Doing', 'Done']);
  });

  it('round-trips through markdown', () => {
    const next = addLane(board, { name: 'Blocked' });
    expect(boardToMd(mdToBoard(boardToMd(next), 'x.md'))).toBe(boardToMd(next));
  });

  it('rejects a duplicate name', () => {
    expect(() => addLane(board, { name: 'Todo' })).toThrow(/already a lane named "Todo"/);
  });
});

describe('ambiguous lane names', () => {
  it('refuses to guess which lane was meant', () => {
    expect(() => addCard(ambiguousBoard(), { lane: 'Todo', text: 'x' })).toThrow(
      /Lane name "Todo" is ambiguous: lanes 0 and 1/
    );
  });

  it('refuses on the destination of a move', () => {
    expect(() => moveCard(ambiguousBoard(), { lane: 'Done', index: 0, to: 'Todo' })).toThrow(
      /ambiguous/
    );
  });

  it('refuses on lane removal', () => {
    expect(() => removeLane(ambiguousBoard(), { name: 'Todo' })).toThrow(/ambiguous/);
  });

  it('still resolves an unambiguous lane on the same board', () => {
    expect(titles(addCard(ambiguousBoard(), { lane: 'Done', text: 'x' }), 'Done')).toEqual([
      'Finished card',
      'x',
    ]);
  });
});

describe('moving in and out of a Complete lane', () => {
  let board: Board;
  beforeEach(() => (board = fixture('simple.md')));

  it('checks a card moved into the Complete lane', () => {
    const next = moveCard(board, { lane: 'Todo', index: 0, to: 'Done' });
    expect(next.children[2].children[1].data.checked).toBe(true);
    expect(boardToMd(next)).toContain('- [x] First card');
  });

  it('unchecks a card moved out of the Complete lane', () => {
    const next = moveCard(board, { lane: 'Done', index: 0, to: 'Todo' });
    expect(next.children[0].children[2].data.checked).toBe(false);
    expect(boardToMd(next)).toContain('- [ ] Finished card');
  });

  it('leaves a card alone when neither lane is Complete', () => {
    const next = moveCard(board, { lane: 'Todo', index: 0, to: 'Doing' });
    expect(next.children[1].children[0].data.checked).toBe(false);
    expect(boardToMd(next)).toContain('- [ ] First card');
  });

  it('does not re-toggle a card that already matches', () => {
    const checked = setDone(board, { lane: 'Todo', index: 0 });
    const next = moveCard(checked, { lane: 'Todo', index: 0, to: 'Done' });
    expect(next.children[2].children[1].data.checkChar).toBe('x');
  });

  it('leaves check state alone when reordering within one lane', () => {
    const next = moveCard(board, { lane: 'Done', index: 0, to: 'Done', pos: 0 });
    expect(next.children[2].children[0].data.checked).toBe(true);
  });
});

describe('list-collapse', () => {
  const collapse = (board: Board) => board.data.settings['list-collapse'];

  it('inserts a collapse entry at the new lane position', () => {
    expect(collapse(addLane(fixture('settings.md'), { name: 'New', pos: 1 }))).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('appends a collapse entry for an appended lane', () => {
    expect(collapse(addLane(fixture('settings.md'), { name: 'New' }))).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('drops the collapse entry of a removed lane', () => {
    expect(collapse(removeLane(fixture('settings.md'), { name: 'Backlog' }))).toEqual([true]);
  });

  it('stays absent on a board that does not use it', () => {
    const next = addLane(fixture('simple.md'), { name: 'New' });
    expect('list-collapse' in next.data.settings).toBe(false);
    expect(boardToMd(next)).toContain('{"kanban-plugin":"board"}');
  });

  it('is written to the settings block', () => {
    expect(boardToMd(removeLane(fixture('settings.md'), { name: 'Backlog' }))).toContain(
      '"list-collapse":[true]'
    );
  });
});

describe('removeLane', () => {
  it('drops the lane and its cards', () => {
    const board = fixture('simple.md');
    const next = removeLane(board, { name: 'Todo' });
    expect(next.children.map((l) => l.data.title)).toEqual(['Doing', 'Done']);
    expect(otherLanes(next, 'nothing')).toBe(otherLanes(board, 'Todo'));
  });

  it('rejects an unknown lane', () => {
    expect(() => removeLane(fixture('simple.md'), { name: 'Nope' })).toThrow(
      /No lane named "Nope"/
    );
  });
});
