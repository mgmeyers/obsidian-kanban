# Kanban CLI

Create, read, update, and delete cards on [Obsidian Kanban](https://github.com/mgmeyers/obsidian-kanban)
boards without running Obsidian. The tool reads and writes the same markdown
files the plugin uses, so boards edited from the shell stay fully compatible
with the plugin.

`obsidian-cli` operates on a vault generically and has no understanding of the
Kanban board format, so it cannot address lanes or cards. This tool fills that
gap.

## Build

```sh
yarn install
yarn build:cli     # writes bin/kanban-cli.js
```

Run it directly, or link it onto your `PATH` as `kanban` via the `bin` entry in
`package.json`:

```sh
node bin/kanban-cli.js list ~/vault/Board.md
```

## Commands

```
kanban list <file.md> [--json] [--archive]
kanban add  <file.md> --lane <name> --text <text> [--pos <n>]
kanban edit <file.md> --lane <name> --index <n> --text <text>
kanban move <file.md> --lane <name> --index <n> --to <lane> [--pos <n>]
kanban done <file.md> --lane <name> --index <n> [--undo]
kanban rm   <file.md> --lane <name> --index <n>
kanban lane add <file.md> --name <name> [--pos <n>] [--max-items <n>]
kanban lane rm  <file.md> --name <name>
```

| Command    | Does                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| `list`     | Prints lanes and cards. `--json` emits a stable machine-readable shape.               |
| `add`      | Adds a card to a lane. `--pos` inserts at a zero-based position; the default appends. |
| `edit`     | Replaces a card's text, keeping its block id.                                         |
| `move`     | Moves a card to another lane, or reorders it within its own.                          |
| `done`     | Checks a card. `--undo` unchecks it.                                                  |
| `rm`       | Deletes a card.                                                                       |
| `lane add` | Adds an empty lane. `--pos` inserts at a zero-based position.                         |
| `lane rm`  | Deletes a lane and every card in it.                                                  |

### Examples

```sh
kanban add  Board.md --lane 'In progress' --text 'Ship the CLI #urgent @{2026-09-20}'
kanban add  Board.md --lane Todo --text 'Triage inbox' --pos 0
kanban move Board.md --lane Todo --index 2 --to Done
kanban done Board.md --lane Done --index 0
kanban lane add Board.md --name Blocked --pos 1
```

Unknown flags, repeated flags, and empty `--text` or `--name` values are all
errors rather than silent surprises. To pass a value that itself begins with
`--`, use `--flag=value`:

```sh
kanban add Board.md --lane=Todo --text='--force is a flag'
```

Card text is passed through verbatim, so tags, dates, times, wikilinks, and
multi-line bodies all work:

```sh
kanban add Board.md --lane Todo --text 'Read [[Spec]]
follow-up line'
```

## Addressing cards

A card is addressed by its lane name plus a zero-based index within that lane.

Item `id` values are regenerated on every parse, so they cannot be used across
invocations. Block ids are persistent but exist only on cards that already carry
one. Lane name plus index is stable within a single board state and is what
`list` prints, so the two commands compose.

Lane names are matched exactly and case-sensitively. A missing lane name is an
error, not a silent no-op. Obsidian allows two lanes to share a title; an
ambiguous name is also an error, naming the indices that collide, rather than a
guess at which lane you meant.

## Lane limits

A board stores a lane's card limit in its heading, as a number in parentheses:

```
## Inbox (3)
```

`list` prints the heading as the board writes it, and `--json` carries the limit
as `maxItems` on each lane, `0` meaning no limit. A lane can be addressed by
either form, so both of these reach the lane above:

```sh
kanban add Board.md --lane 'Inbox'     --text 'Triage this'
kanban add Board.md --lane 'Inbox (3)' --text 'Triage this'
```

Set a limit when creating a lane:

```sh
kanban lane add Board.md --name Review --max-items 4     # writes "## Review (4)"
```

Passing the limit inside the name is an error. A board would read
`--name 'Review (5)'` back as a lane named `Review` with a limit of 5, so the
name you gave would not be the name you got:

```
Lane name "Review (5)" ends with a lane limit. Pass the name without it and set
the limit with --max-items.
```

Nothing enforces a limit: it is a signal for the board's reader, and the plugin
marks a lane whose card count exceeds it. `add` will not refuse a card.

## Output

Text is the default:

```
## Todo
   0 [ ] First card
   1 [ ] Second card
   2 [ ] Review the parser

## Doing
  (empty)

## Done
   0 [x] Finished card
```

`list --json` emits an array of lanes, each with a `title` and a `cards` array
of `{ index, title, done }`, plus the lane's `maxItems`:

```json
[
  {
    "title": "Todo",
    "maxItems": 0,
    "cards": [
      { "index": 0, "title": "First card", "done": false },
      { "index": 1, "title": "Second card", "done": false }
    ]
  }
]
```

`title` is the card's raw markdown, the same text `edit --text` takes.

Archived cards live outside the lanes and are indexed separately, so
`list --archive` prints them on their own:

```
## Archive
   0 [x] Old card
   1 [x] Older card
```

With `--json` it emits the bare card array, `{ index, title, done }` per entry.
The default output is unaffected either way: archived cards never appear among
the lanes.

Mutating commands print a one-line confirmation and write the file in place.

## Errors

Every failure exits 1 and writes to stderr. The file is never written when a
command fails.

| Situation                  | Message                                                        |
| -------------------------- | -------------------------------------------------------------- |
| File missing or unreadable | `Cannot read <file>: ...`                                      |
| Not a Kanban board         | `<file> is not a Kanban board: no "kanban-plugin" frontmatter` |
| Parse failure              | `Cannot parse <file>: ...`                                     |
| Unknown lane               | `No lane named "X". Lanes: Todo, Doing, Done`                  |
| Index out of range         | `No card at index 9 in lane "Todo". Valid indices: 0-1`        |
| Missing or bad flag        | The message, followed by usage                                 |

A mutating command writes only after the new markdown has been produced
successfully, so a serialization failure leaves the original file untouched.

## How it works

The CLI reuses the plugin's own parser, so the markdown format cannot drift:

```
markdown file
  -> parseMarkdown(stateManager, md)     src/parsers/parseMarkdown.ts
  -> astToUnhydratedBoard(...)           src/parsers/formats/list.ts
  -> Board                               plain JS object tree
  -> mutate board.children
  -> boardToMd(board)                    src/parsers/formats/list.ts
  -> write file
```

It bypasses the `ListFormat` class (`src/parsers/List.ts`), which assumes a live
plugin, and uses the pure functions underneath. Hydration is skipped: it
resolves moment dates and vault file links for rendering, which the CLI does not
need.

Two pieces stand in for Obsidian:

- **`stateManagerStub.ts`** implements the five `StateManager` members the parser
  touches, against plain data. Settings come from the board's own settings block,
  falling back to the plugin defaults. `getFirstLinkpathDest` returns `null`,
  since the CLI does not index a vault; unresolved links are left as written
  text, which round-trips correctly.
- **`shims/`** replaces modules that only exist for the running plugin. Each one
  either requires the real `obsidian` module or touches the DOM while it loads:
  `obsidian` itself, `obsidian-daily-notes-interface`, `choices.js`, and
  `src/components/Item/MetadataTable`. `shims/globals.ts` supplies the prototype
  methods and globals Obsidian injects (`Array.first`, `String.contains`,
  `window.localStorage`, `app`). It is wired in by esbuild's `inject` and
  vitest's `setupFiles`, because some plugin modules read those globals while
  they load.

The alias list lives in `esbuild.cli.mjs` and is mirrored in
`vitest.config.ts`. Keep the two in sync.

### Boards are never rewritten wholesale

The central guarantee is a round-trip property: for every fixture board,
`boardToMd(mdToBoard(md))` equals the original markdown byte for byte. That one
property guards every command against silent corruption of the parts of a board
it did not intend to touch. Multi-line cards are indented with tabs, matching
Obsidian's default.

A board's own file conventions are carried through a write: CRLF line endings
stay CRLF, and a final newline is kept if the file had one and not added if it
did not. Without that, editing a board saved on Windows would rewrite every line
of the file.

`list-collapse` is kept in step with the lanes: `lane add` and `lane rm` splice
its entry at the lane's own index, the same way the plugin does. Boards whose
settings do not carry it are left without it.

## Development

```sh
yarn test        # vitest: round-trip, command units, end-to-end
yarn typecheck
```

Three layers of tests:

1. **Round-trip fixtures** (`roundTrip.test.ts`) parse and re-serialize every
   board in `__fixtures__/`, comparing byte for byte. The fixtures cover
   frontmatter, the settings block, complete lanes, tags, dates, block ids,
   wikilinks, nested cards, and the archive.
2. **Command units** (`commands.test.ts`) run each command against an in-memory
   `Board`, asserting both the intended change and that the rest of the board
   serializes identically.
3. **End-to-end** (`e2e.test.ts`) builds the bundle and runs it against
   temporary copies of the fixtures, asserting file contents and exit codes.

New fixtures must be in the serializer's canonical form, which is what the
plugin itself writes. The round-trip test will show the difference if they are
not.

## Agent skill

`skills/kanban/` is a [Claude Code skill](https://docs.claude.com/en/docs/claude-code/skills)
that teaches a coding agent the rules above: the addressing model, the quoting
rules, and what each error message means. Install it for your own boards:

```sh
cp -r skills/kanban ~/.claude/skills/
```

Or symlink it instead, to follow the repo:

```sh
ln -s "$PWD/skills/kanban" ~/.claude/skills/kanban
```

## Limits

Out of scope, by design: board rendering, search and querying beyond a plain
listing, archiving cards (`list --archive` reads the archive, but nothing writes
to it), templates, date and time pickers, tag colour handling,
talking to a running Obsidian instance, and multi-file or vault-wide operations.
