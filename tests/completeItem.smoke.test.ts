import { readFileSync } from 'fs';
import { resolve } from 'path';
import { toggleItemCheckbox } from 'src/helpers/completeItem';
import { afterEach, describe, expect, it } from 'vitest';

import { findItemPath, loadBoard } from './helpers/harness';
import { stubApp, tasksSettings } from './setup';

/**
 * End to end over the real parser, state manager, board modifiers and
 * serializer: markdown in, click a card's checkbox, markdown out.
 */

const TODAY = '2026-08-07';

/**
 * A stand-in for the Tasks plugin's `executeToggleTaskDoneCommand`, modelled on
 * the real thing: completing a task stamps `✅ <today>`, and a recurring task
 * also yields its next occurrence (returned first, as Tasks does by default).
 */
function fakeTasksPlugin() {
  return {
    apiV1: {
      executeToggleTaskDoneCommand(line: string) {
        const isDone = /^- \[[^ \]]\]/.test(line);
        const body = line.replace(/^- \[[^\]]\] */, '');

        if (isDone) {
          return `- [ ] ${body.replace(/ *✅ \d{4}-\d{2}-\d{2}/, '')}`;
        }

        const done = `- [x] ${body} ✅ ${TODAY}`;
        const recurrence = body.match(/🔁 every (\w+)/);

        if (!recurrence) return done;

        const next = body.replace(/📅 (\d{4}-\d{2}-\d{2})/, (_m, date: string) => {
          const d = new Date(`${date}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() + (recurrence[1] === 'week' ? 7 : 1));
          return `📅 ${d.toISOString().slice(0, 10)}`;
        });

        return `- [ ] ${next}\n${done}`;
      },
    },
  };
}

function board({
  autoMove = true,
  doneLaneName,
}: { autoMove?: boolean; doneLaneName?: string } = {}) {
  const settings: Record<string, any> = { 'kanban-plugin': 'board' };
  if (autoMove) settings['auto-move-done-to-lane'] = true;
  if (doneLaneName) settings['done-lane-name'] = doneLaneName;

  return [
    '---',
    '',
    'kanban-plugin: board',
    '',
    '---',
    '',
    '',
    `## Todo`,
    '',
    '- [ ] Write the smoke test',
    '- [ ] Water the plants 🔁 every week 📅 2026-08-07',
    '',
    `## ${doneLaneName || 'Done'}`,
    '',
    '**Complete**',
    '',
    '- [x] Older finished thing ✅ 2026-08-01',
    '',
    '',
    '%% kanban:settings',
    '```',
    JSON.stringify(settings),
    '```',
    '%%',
  ].join('\n');
}

let restoreApp: () => void = () => {};

afterEach(() => restoreApp());

function withTasksPlugin() {
  restoreApp = stubApp({ tasksPlugin: fakeTasksPlugin(), tasksSettings: tasksSettings() });
}

function withoutTasksPlugin() {
  restoreApp = stubApp();
}

describe('completing a card, end to end', () => {
  it('parses a board without errors', async () => {
    withoutTasksPlugin();
    const harness = await loadBoard(board());

    expect(harness.errors()).toEqual([]);
    expect(harness.board().children.map((l) => l.data.title)).toEqual(['Todo', 'Done']);
  });

  it('round-trips markdown without losing anything', async () => {
    withoutTasksPlugin();
    const first = await loadBoard(board());

    // A no-op state write is enough to force serialization
    first.stateManager.setState((b) => b);
    const serialized = first.markdown();

    const second = await loadBoard(serialized);
    second.stateManager.setState((b) => b);

    expect(second.errors()).toEqual([]);
    // stable: serializing what we parsed produces the same file again
    expect(second.markdown()).toBe(serialized);
    expect(second.board().children.map((l) => l.children.map((i) => i.data.titleRaw))).toEqual(
      first.board().children.map((l) => l.children.map((i) => i.data.titleRaw))
    );
    expect(serialized).toContain('- [ ] Water the plants 🔁 every week 📅 2026-08-07');
    expect(serialized).toContain('**Complete**');
    expect(serialized).toContain('kanban-plugin: board');
  });

  it('moves a completed card to the done lane and writes it back to disk', async () => {
    withTasksPlugin();
    const harness = await loadBoard(board());
    const path = findItemPath(harness.board(), 'Write the smoke test');

    toggleItemCheckbox(
      harness.stateManager,
      harness.boardModifiers,
      path,
      harness.board().children[path[0]].children[path[1]]
    );

    expect(harness.errors()).toEqual([]);
    expect(harness.markdown()).toContain(`- [x] Write the smoke test ✅ ${TODAY}`);
    expect(harness.markdown()).toMatch(
      /## Done\n\n\*\*Complete\*\*\n- \[x\] Older finished thing ✅ 2026-08-01\n- \[x\] Write the smoke test/
    );
    expect(harness.markdown()).not.toMatch(/## Todo\n\n- \[x\]/);
  });

  it('adds an inline completion date via the Tasks plugin', async () => {
    withTasksPlugin();
    const harness = await loadBoard(board());
    const path = findItemPath(harness.board(), 'Write the smoke test');

    toggleItemCheckbox(
      harness.stateManager,
      harness.boardModifiers,
      path,
      harness.board().children[path[0]].children[path[1]]
    );

    const moved = harness.board().children[1].children.at(-1);
    expect(moved.data.titleRaw).toBe(`Write the smoke test ✅ ${TODAY}`);
    expect(moved.data.checked).toBe(true);
    expect(moved.data.checkChar).toBe('x');
  });

  it('moves the completed occurrence of a recurring task and leaves the next one behind', async () => {
    withTasksPlugin();
    const harness = await loadBoard(board());
    const path = findItemPath(harness.board(), 'Water the plants');

    toggleItemCheckbox(
      harness.stateManager,
      harness.boardModifiers,
      path,
      harness.board().children[path[0]].children[path[1]]
    );

    expect(harness.errors()).toEqual([]);

    const md = harness.markdown();
    expect(md).toContain('- [ ] Water the plants 🔁 every week 📅 2026-08-14');
    expect(md).toContain(`- [x] Water the plants 🔁 every week 📅 2026-08-07 ✅ ${TODAY}`);

    // the next occurrence stays in Todo, the completed one is in Done
    const [todo, done] = harness.board().children;
    expect(todo.children.map((i) => i.data.titleRaw)).toEqual([
      'Write the smoke test',
      'Water the plants 🔁 every week 📅 2026-08-14',
    ]);
    expect(done.children.map((i) => i.data.titleRaw)).toEqual([
      'Older finished thing ✅ 2026-08-01',
      `Water the plants 🔁 every week 📅 2026-08-07 ✅ ${TODAY}`,
    ]);
  });

  it('leaves cards in place when the board turns the setting off', async () => {
    withTasksPlugin();
    const harness = await loadBoard(board({ autoMove: false }));
    const path = findItemPath(harness.board(), 'Write the smoke test');

    toggleItemCheckbox(
      harness.stateManager,
      harness.boardModifiers,
      path,
      harness.board().children[path[0]].children[path[1]]
    );

    expect(harness.board().children[0].children.map((i) => i.data.titleRaw)).toEqual([
      `Write the smoke test ✅ ${TODAY}`,
      'Water the plants 🔁 every week 📅 2026-08-07',
    ]);
    expect(harness.board().children[1].children).toHaveLength(1);
  });

  it('lets a board override the global setting', async () => {
    withTasksPlugin();
    // auto-move on globally, off for this board
    const md = board({ autoMove: false }).replace(
      '{"kanban-plugin":"board"}',
      '{"kanban-plugin":"board","auto-move-done-to-lane":false}'
    );
    const harness = await loadBoard(md, { 'auto-move-done-to-lane': true });
    const path = findItemPath(harness.board(), 'Write the smoke test');

    expect(harness.stateManager.getSetting('auto-move-done-to-lane')).toBe(false);

    toggleItemCheckbox(
      harness.stateManager,
      harness.boardModifiers,
      path,
      harness.board().children[path[0]].children[path[1]]
    );

    expect(harness.board().children[0].children).toHaveLength(2);
  });

  it('honours a per-board done lane name', async () => {
    withTasksPlugin();
    const harness = await loadBoard(board({ doneLaneName: 'Afgerond' }));
    const path = findItemPath(harness.board(), 'Write the smoke test');

    toggleItemCheckbox(
      harness.stateManager,
      harness.boardModifiers,
      path,
      harness.board().children[path[0]].children[path[1]]
    );

    expect(harness.board().children[1].data.title).toBe('Afgerond');
    expect(harness.board().children[1].children).toHaveLength(2);
    expect(harness.board().children[0].children).toHaveLength(1);
  });

  it('works without the Tasks plugin, minus the completion date', async () => {
    withoutTasksPlugin();
    const harness = await loadBoard(board());
    const path = findItemPath(harness.board(), 'Write the smoke test');

    toggleItemCheckbox(
      harness.stateManager,
      harness.boardModifiers,
      path,
      harness.board().children[path[0]].children[path[1]]
    );

    expect(harness.errors()).toEqual([]);
    expect(harness.board().children[0].children).toHaveLength(1);
    expect(harness.board().children[1].children.map((i) => i.data.titleRaw)).toEqual([
      'Older finished thing ✅ 2026-08-01',
      'Write the smoke test',
    ]);
    expect(harness.markdown()).toContain('- [x] Write the smoke test');
  });

  it('does not move a card back out when it is unchecked', async () => {
    withTasksPlugin();
    const harness = await loadBoard(board());
    const path = findItemPath(harness.board(), 'Older finished thing');

    toggleItemCheckbox(
      harness.stateManager,
      harness.boardModifiers,
      path,
      harness.board().children[path[0]].children[path[1]]
    );

    expect(harness.board().children[1].children.map((i) => i.data.titleRaw)).toEqual([
      'Older finished thing',
    ]);
    expect(harness.board().children[0].children).toHaveLength(2);
  });

  it('keeps the rest of the file intact', async () => {
    withTasksPlugin();
    const harness = await loadBoard(board());
    const path = findItemPath(harness.board(), 'Write the smoke test');

    toggleItemCheckbox(
      harness.stateManager,
      harness.boardModifiers,
      path,
      harness.board().children[path[0]].children[path[1]]
    );

    const md = harness.markdown();
    expect(md.startsWith('---\n\nkanban-plugin: board\n')).toBe(true);
    expect(md).toContain('**Complete**');
    expect(md).toContain('"auto-move-done-to-lane":true');
  });
});

describe('the example board in the test vault', () => {
  const examplePath = resolve(__dirname, '../docs/Examples/Auto-move completed cards.md');

  it('parses, and ticking its first card sends it to Done', async () => {
    withTasksPlugin();
    const harness = await loadBoard(readFileSync(examplePath, 'utf8'));

    expect(harness.errors()).toEqual([]);
    expect(harness.board().children.map((l) => l.data.title)).toEqual(['Todo', 'Doing', 'Done']);
    expect(harness.stateManager.getSetting('auto-move-done-to-lane')).toBe(true);

    const path = findItemPath(harness.board(), 'Tick me');
    toggleItemCheckbox(
      harness.stateManager,
      harness.boardModifiers,
      path,
      harness.board().children[path[0]].children[path[1]]
    );

    const [todo, , done] = harness.board().children;
    expect(todo.children).toHaveLength(3);
    expect(done.children).toHaveLength(2);
    expect(done.children.at(-1).data.titleRaw).toContain(`✅ ${TODAY}`);
  });

  it('splits its recurring card the way the comment on it promises', async () => {
    withTasksPlugin();
    const harness = await loadBoard(readFileSync(examplePath, 'utf8'));

    const path = findItemPath(harness.board(), 'Water the plants');
    toggleItemCheckbox(
      harness.stateManager,
      harness.boardModifiers,
      path,
      harness.board().children[path[0]].children[path[1]]
    );

    const [todo, , done] = harness.board().children;
    expect(todo.children.map((i) => i.data.titleRaw)).toContain(
      'Water the plants 🔁 every week 📅 2026-08-14'
    );
    expect(done.children.at(-1).data.titleRaw).toBe(
      `Water the plants 🔁 every week 📅 2026-08-07 ✅ ${TODAY}`
    );
  });
});
