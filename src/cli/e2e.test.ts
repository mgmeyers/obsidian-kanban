import { execFileSync } from 'child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const cli = join(root, 'bin/kanban-cli.js');

interface Result {
  status: number;
  stdout: string;
  stderr: string;
}

function kanban(args: string[]): Result {
  try {
    const stdout = execFileSync('node', [cli, ...args], { encoding: 'utf8' });
    return { status: 0, stdout, stderr: '' };
  } catch (e: any) {
    return { status: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

function board(name = 'simple.md'): string {
  const dir = mkdtempSync(join(tmpdir(), 'kanban-cli-'));
  const file = join(dir, name);
  copyFileSync(join(__dirname, '__fixtures__', name), file);
  return file;
}

beforeAll(() => {
  execFileSync('node', [join(root, 'esbuild.cli.mjs')], { cwd: root, stdio: 'ignore' });
}, 60_000);

describe('kanban list', () => {
  it('prints lanes and card indices', () => {
    const { status, stdout } = kanban(['list', board()]);
    expect(status).toBe(0);
    expect(stdout).toContain('## Todo');
    expect(stdout).toContain('   0 [ ] First card');
    expect(stdout).toContain('   0 [x] Finished card');
    expect(stdout).toContain('  (empty)');
  });

  it('emits stable json', () => {
    const { stdout } = kanban(['list', board(), '--json']);
    expect(JSON.parse(stdout)[0]).toEqual({
      title: 'Todo',
      maxItems: 0,
      cards: [
        { index: 0, title: 'First card', done: false },
        { index: 1, title: 'Second card', done: false },
      ],
    });
  });

  it('lists the archive with --archive', () => {
    const { status, stdout } = kanban(['list', board('settings.md'), '--archive']);
    expect(status).toBe(0);
    expect(stdout).toContain('## Archive');
    expect(stdout).toContain('   0 [x] Old card');
    expect(stdout).toContain('   1 [x] Older card');
    expect(stdout).not.toContain('## Backlog');
  });

  it('emits the archive as json', () => {
    const { stdout } = kanban(['list', board('settings.md'), '--archive', '--json']);
    expect(JSON.parse(stdout)).toEqual([
      { index: 0, title: 'Old card', done: true },
      { index: 1, title: 'Older card', done: true },
    ]);
  });

  it('says so when a board has no archive', () => {
    const { status, stdout } = kanban(['list', board(), '--archive']);
    expect(status).toBe(0);
    expect(stdout).toContain('(empty)');
  });

  it('shows a lane limit in the heading', () => {
    const { stdout } = kanban(['list', board('metadata.md')]);
    expect(stdout).toContain('## Inbox (3)');
    expect(stdout).toContain('## Empty');
  });

  it('reports the lane limit in json', () => {
    const { stdout } = kanban(['list', board('metadata.md'), '--json']);
    const lanes = JSON.parse(stdout);
    expect(lanes[0].maxItems).toBe(3);
    expect(lanes[1].maxItems).toBe(0);
  });

  it('leaves the file untouched', () => {
    const file = board();
    const before = readFileSync(file, 'utf8');
    kanban(['list', file]);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
});

describe('mutating commands', () => {
  it('adds a card', () => {
    const file = board();
    const { status, stdout } = kanban(['add', file, '--lane', 'Todo', '--text', 'Third card']);
    expect(status).toBe(0);
    expect(stdout.trim()).toBe('Added card to "Todo" (2)');
    expect(readFileSync(file, 'utf8')).toContain('- [ ] Second card\n- [ ] Third card\n');
  });

  it('reports where a clamped --pos actually landed', () => {
    const file = board();
    const { stdout } = kanban(['add', file, '--lane', 'Todo', '--text', 'Last', '--pos', '99']);
    expect(stdout.trim()).toBe('Added card to "Todo" (2)');
    expect(readFileSync(file, 'utf8')).toContain('- [ ] Second card\n- [ ] Last\n');
  });

  it('checks a card moved into the Complete lane', () => {
    const file = board();
    kanban(['move', file, '--lane', 'Todo', '--index', '0', '--to', 'Done']);
    expect(readFileSync(file, 'utf8')).toContain('- [x] First card');
  });

  it('exits 1 on an ambiguous lane name', () => {
    const file = board();
    writeFileSync(file, readFileSync(file, 'utf8').replace('## Doing', '## Todo'));
    const before = readFileSync(file, 'utf8');
    const { status, stderr } = kanban(['add', file, '--lane', 'Todo', '--text', 'x']);
    expect(status).toBe(1);
    expect(stderr).toContain('Lane name "Todo" is ambiguous: lanes 0 and 1 share it');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('changes nothing else in the file', () => {
    const file = board();
    const before = readFileSync(file, 'utf8');
    kanban(['add', file, '--lane', 'Todo', '--text', 'Third card']);
    expect(readFileSync(file, 'utf8')).toBe(
      before.replace('- [ ] Second card\n', '- [ ] Second card\n- [ ] Third card\n')
    );
  });

  it('edits, completes, moves, and removes a card', () => {
    const file = board();

    expect(
      kanban(['edit', file, '--lane', 'Todo', '--index', '0', '--text', 'Renamed']).status
    ).toBe(0);
    expect(readFileSync(file, 'utf8')).toContain('- [ ] Renamed');

    expect(kanban(['done', file, '--lane', 'Todo', '--index', '0']).status).toBe(0);
    expect(readFileSync(file, 'utf8')).toContain('- [x] Renamed');

    expect(kanban(['done', file, '--lane', 'Todo', '--index', '0', '--undo']).status).toBe(0);
    expect(readFileSync(file, 'utf8')).toContain('- [ ] Renamed');

    expect(kanban(['move', file, '--lane', 'Todo', '--index', '0', '--to', 'Doing']).status).toBe(
      0
    );
    expect(readFileSync(file, 'utf8')).toContain('## Doing\n\n- [ ] Renamed\n');

    expect(kanban(['rm', file, '--lane', 'Doing', '--index', '0']).status).toBe(0);
    expect(readFileSync(file, 'utf8')).not.toContain('Renamed');
  });

  it('sets a lane limit with --max-items', () => {
    const file = board();
    expect(kanban(['lane', 'add', file, '--name', 'Review', '--max-items', '4']).status).toBe(0);
    expect(readFileSync(file, 'utf8')).toContain('## Review (4)');
  });

  it('refuses a lane name that a board would read as a limit', () => {
    const file = board();
    const before = readFileSync(file, 'utf8');
    const { status, stderr } = kanban(['lane', 'add', file, '--name', 'Review (5)']);
    expect(status).toBe(1);
    expect(stderr).toContain('--max-items');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('removes a limited lane by its heading, and counts its cards', () => {
    const file = board('metadata.md');
    const { status, stdout } = kanban(['lane', 'rm', file, '--name', 'Inbox (3)']);
    expect(status).toBe(0);
    expect(stdout.trim()).toBe('Removed lane "Inbox (3)" and 6 cards');
    expect(readFileSync(file, 'utf8')).not.toContain('## Inbox');
  });

  it('adds and removes lanes', () => {
    const file = board();

    expect(kanban(['lane', 'add', file, '--name', 'Blocked', '--pos', '1']).stdout.trim()).toBe(
      'Added lane "Blocked" at 1'
    );
    expect(readFileSync(file, 'utf8')).toContain(
      '## Todo\n\n- [ ] First card\n- [ ] Second card\n\n\n## Blocked'
    );

    expect(kanban(['lane', 'rm', file, '--name', 'Todo']).stdout.trim()).toBe(
      'Removed lane "Todo" and 2 cards'
    );
    expect(readFileSync(file, 'utf8')).not.toContain('## Todo');
  });
});

describe('errors', () => {
  it('exits 1 on a missing file', () => {
    const { status, stderr } = kanban(['list', '/nope/missing.md']);
    expect(status).toBe(1);
    expect(stderr).toContain('/nope/missing.md');
  });

  it('exits 1 on a file that is not a board', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kanban-cli-'));
    const file = join(dir, 'plain.md');
    writeFileSync(file, '---\n\ntitle: Not a board\n\n---\n\nhello');
    const { status, stderr } = kanban(['list', file]);
    expect(status).toBe(1);
    expect(stderr).toContain('is not a Kanban board');
  });

  it('exits 1 and names the file when it cannot be parsed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kanban-cli-'));
    const file = join(dir, 'notes.json');
    writeFileSync(file, '{}');
    const { status, stderr } = kanban(['list', file]);
    expect(status).toBe(1);
    expect(stderr).toContain(file);
    expect(stderr).toContain('Error parsing frontmatter');
  });

  it('exits 1 on an unknown lane and lists the valid ones', () => {
    const { status, stderr } = kanban(['add', board(), '--lane', 'Nope', '--text', 'x']);
    expect(status).toBe(1);
    expect(stderr).toContain('No lane named "Nope"');
    expect(stderr).toContain('Todo, Doing, Done');
  });

  it('exits 1 on an out of range index and leaves the file alone', () => {
    const file = board();
    const before = readFileSync(file, 'utf8');
    const { status, stderr } = kanban(['rm', file, '--lane', 'Todo', '--index', '9']);
    expect(status).toBe(1);
    expect(stderr).toContain('Valid indices: 0-1');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('exits 1 on an unknown flag instead of ignoring it', () => {
    const { status, stderr } = kanban(['list', board(), '--jsno']);
    expect(status).toBe(1);
    expect(stderr).toContain('Unknown flag --jsno');
  });

  it('exits 1 on a repeated flag', () => {
    const { status, stderr } = kanban([
      'add',
      board(),
      '--lane',
      'Todo',
      '--lane',
      'Done',
      '--text',
      'x',
    ]);
    expect(status).toBe(1);
    expect(stderr).toContain('--lane given more than once');
  });

  it('exits 1 on empty text or an empty lane name', () => {
    expect(kanban(['add', board(), '--lane', 'Todo', '--text', '']).stderr).toContain(
      '--text cannot be empty'
    );
    expect(kanban(['lane', 'add', board(), '--name', '   ']).stderr).toContain(
      '--name cannot be empty'
    );
  });

  it('takes a value starting with -- via --flag=value', () => {
    const file = board();
    const { status, stdout } = kanban(['add', file, '--lane=Todo', '--text=--force is a flag']);
    expect(status).toBe(0);
    expect(stdout.trim()).toBe('Added card to "Todo" (2)');
    expect(readFileSync(file, 'utf8')).toContain('- [ ] --force is a flag');
  });

  it('preserves CRLF line endings and a final newline', () => {
    const file = board();
    const crlf = readFileSync(file, 'utf8').replace(/\n/g, '\r\n') + '\r\n';
    writeFileSync(file, crlf);
    expect(kanban(['add', file, '--lane', 'Todo', '--text', 'Third']).status).toBe(0);
    const after = readFileSync(file, 'utf8');
    expect(after).toContain('- [ ] Third');
    expect(/(?<!\r)\n/.test(after)).toBe(false);
    expect(after.endsWith('\r\n')).toBe(true);
  });

  it('exits 1 on a missing flag and prints usage', () => {
    const { status, stderr } = kanban(['add', board(), '--lane', 'Todo']);
    expect(status).toBe(1);
    expect(stderr).toContain('Missing --text');
    expect(stderr).toContain('kanban list <file.md>');
  });
});
