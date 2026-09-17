import { laneTitleWithMaxItems } from 'src/helpers';

import { BoardError, findLane, insertionIndex, loadBoard, saveBoard } from './board';
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

const usage = `kanban — edit Obsidian Kanban boards from the shell

  kanban list <file.md> [--json] [--archive]
  kanban add  <file.md> --lane <name> --text <text> [--pos <n>]
  kanban edit <file.md> --lane <name> --index <n> --text <text>
  kanban move <file.md> --lane <name> --index <n> --to <lane> [--pos <n>]
  kanban done <file.md> --lane <name> --index <n> [--undo]
  kanban rm   <file.md> --lane <name> --index <n>
  kanban lane add <file.md> --name <name> [--pos <n>] [--max-items <n>]
  kanban lane rm  <file.md> --name <name>`;

class UsageError extends Error {}

type Flags = Record<string, string | boolean>;

function parseFlags(args: string[], allowed: string[]): Flags {
  const flags: Flags = {};

  const set = (name: string, value: string | boolean) => {
    if (!allowed.includes(name)) {
      throw new UsageError(`Unknown flag --${name}. Accepted here: ${allowed.join(', ')}`);
    }
    if (name in flags) throw new UsageError(`--${name} given more than once`);
    flags[name] = value;
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg.startsWith('--')) throw new UsageError(`Unexpected argument "${arg}"`);

    // `--flag=value` is the way to pass a value that itself starts with `--`.
    const eq = arg.indexOf('=');
    if (eq > -1) {
      set(arg.slice(2, eq), arg.slice(eq + 1));
      continue;
    }

    const name = arg.slice(2);
    const next = args[i + 1];

    if (next === undefined || next.startsWith('--')) {
      set(name, true);
    } else {
      set(name, next);
      i++;
    }
  }

  return flags;
}

function str(flags: Flags, name: string): string {
  const value = flags[name];
  if (typeof value !== 'string') throw new UsageError(`Missing --${name}`);
  if (!value.trim()) throw new UsageError(`--${name} cannot be empty`);
  return value;
}

function int(flags: Flags, name: string): number {
  const value = str(flags, name);
  if (!/^\d+$/.test(value)) throw new UsageError(`--${name} must be a non-negative integer`);
  return Number(value);
}

function optionalInt(flags: Flags, name: string): number | undefined {
  return flags[name] === undefined ? undefined : int(flags, name);
}

function indent(title: string): string {
  return title.split('\n').join('\n       ');
}

function formatLane(title: string, cards: ReturnType<typeof listArchive>): string {
  const header = `## ${title}`;
  if (!cards.length) return `${header}\n  (empty)`;

  const lines = cards.map(
    (card) => `  ${String(card.index).padStart(2)} [${card.done ? 'x' : ' '}] ${indent(card.title)}`
  );

  return [header, ...lines].join('\n');
}

function formatListing(board: ReturnType<typeof listBoard>): string {
  return board
    .map((lane) => formatLane(laneTitleWithMaxItems(lane.title, lane.maxItems), lane.cards))
    .join('\n\n');
}

function run(argv: string[]): string {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') return usage;

  if (command === 'lane') {
    const [sub, file, ...args] = rest;
    if (!file) throw new UsageError('Missing board file');

    if (sub !== 'add' && sub !== 'rm') {
      throw new UsageError(`Unknown lane subcommand "${sub ?? ''}"`);
    }

    const flags = parseFlags(args, sub === 'add' ? ['name', 'pos', 'max-items'] : ['name']);

    if (sub === 'add') {
      const name = str(flags, 'name');
      const pos = optionalInt(flags, 'pos');
      const maxItems = optionalInt(flags, 'max-items');
      const board = addLane(loadBoard(file), { name, pos, maxItems });
      saveBoard(file, board);
      return `Added lane "${name}" at ${board.children.findIndex((l) => l.data.title === name)}`;
    }

    if (sub === 'rm') {
      const name = str(flags, 'name');
      const loaded = loadBoard(file);
      const cards = findLane(loaded, name).lane.children.length;
      saveBoard(file, removeLane(loaded, { name }));
      return `Removed lane "${name}" and ${cards} card${cards === 1 ? '' : 's'}`;
    }
  }

  const allowed: Record<string, string[]> = {
    list: ['json', 'archive'],
    add: ['lane', 'text', 'pos'],
    edit: ['lane', 'index', 'text'],
    move: ['lane', 'index', 'to', 'pos'],
    done: ['lane', 'index', 'undo'],
    rm: ['lane', 'index'],
  };

  if (!allowed[command]) throw new UsageError(`Unknown command "${command}"`);

  const [file, ...args] = rest;
  if (!file) throw new UsageError('Missing board file');
  const flags = parseFlags(args, allowed[command]);

  switch (command) {
    case 'list': {
      const loaded = loadBoard(file);

      if (flags.archive) {
        const archived = listArchive(loaded);
        return flags.json ? JSON.stringify(archived, null, 2) : formatLane('Archive', archived);
      }

      const listing = listBoard(loaded);
      return flags.json ? JSON.stringify(listing, null, 2) : formatListing(listing);
    }

    case 'add': {
      const lane = str(flags, 'lane');
      const text = str(flags, 'text');
      const loaded = loadBoard(file);
      const board = addCard(loaded, { lane, text, pos: optionalInt(flags, 'pos') });
      saveBoard(file, board);
      // Report where the card actually landed: --pos is clamped to the lane.
      const at = insertionIndex(
        findLane(loaded, lane).lane.children.length,
        optionalInt(flags, 'pos')
      );
      return `Added card to "${lane}" (${at})`;
    }

    case 'edit': {
      const lane = str(flags, 'lane');
      const index = int(flags, 'index');
      saveBoard(file, editCard(loadBoard(file), { lane, index, text: str(flags, 'text') }));
      return `Edited card ${index} in "${lane}"`;
    }

    case 'move': {
      const lane = str(flags, 'lane');
      const index = int(flags, 'index');
      const to = str(flags, 'to');
      saveBoard(
        file,
        moveCard(loadBoard(file), { lane, index, to, pos: optionalInt(flags, 'pos') })
      );
      return `Moved card ${index} from "${lane}" to "${to}"`;
    }

    case 'done': {
      const lane = str(flags, 'lane');
      const index = int(flags, 'index');
      const undo = flags.undo === true;
      saveBoard(file, setDone(loadBoard(file), { lane, index, undo }));
      return `Marked card ${index} in "${lane}" ${undo ? 'not done' : 'done'}`;
    }

    case 'rm': {
      const lane = str(flags, 'lane');
      const index = int(flags, 'index');
      saveBoard(file, removeCard(loadBoard(file), { lane, index }));
      return `Removed card ${index} from "${lane}"`;
    }
  }
}

try {
  console.log(run(process.argv.slice(2)));
} catch (e) {
  if (e instanceof UsageError) {
    console.error(`${e.message}\n\n${usage}`);
  } else if (e instanceof BoardError) {
    console.error(e.message);
  } else {
    console.error((e as Error).message ?? String(e));
  }
  process.exit(1);
}
