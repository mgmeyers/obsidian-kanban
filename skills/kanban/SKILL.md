---
name: kanban
description: >-
  Read and edit Obsidian Kanban boards from the shell with this repo's `kanban` CLI: list lanes
  and cards, add, edit, move, check off, and delete cards, and add or remove lanes. Use this
  whenever the user talks about a Kanban board, a board file in an Obsidian vault, or moving
  work between lanes or columns — "add this to my board", "what's in my Todo lane", "mark that
  card done", "move it to In Progress", "make a Blocked column" — even when they never say the
  words "kanban" or "CLI". Also use it before editing a board's markdown by hand: hand edits
  risk corrupting the plugin's format, and this tool writes through the plugin's own parser.
allowed-tools: Bash(kanban *), Bash(node bin/kanban-cli.js *), Bash(yarn build:cli), Bash(grep *), Bash(ls *), Read, Glob
---

# Kanban boards from the shell

`kanban` edits Obsidian Kanban board markdown in place, using the plugin's own parser. Boards it
writes stay byte-identical apart from the intended change, so it is always the right way to touch
a board — editing the markdown by hand risks breaking the settings block, the archive, or the
plugin's canonical spacing.

The source lives in `src/cli/` in the obsidian-kanban repo, and `src/cli/README.md` there is the
full reference.

## Running it

```sh
kanban list "<file.md>"
```

Inside a checkout of the repo, `kanban` may not be on PATH. Build the bundle and call it directly
— `bin/kanban-cli.js` is gitignored, so it may be missing:

```sh
yarn build:cli
node bin/kanban-cli.js list "<file.md>"
```

Both are the same bundle. Examples below write `kanban`.

## Find the board first

Boards are ordinary notes marked by `kanban-plugin` frontmatter. Ask the user for their vault
path if it is not already known, then:

```sh
grep -rl "kanban-plugin" "<vault>" --include="*.md"
```

When several boards match and the user's request does not name one, ask which they mean rather
than guessing — a card added to the wrong board is invisible to them.

## Always list before you mutate

```sh
kanban list "<file.md>"
```

Cards are addressed by lane name plus a **zero-based index inside that lane**, which is exactly
what `list` prints. Indices shift whenever a card is added, removed, or moved, so a stale index
points at the wrong card. Re-list after any change before addressing another card by index.

Use `--json` when you need to filter or count with a script; the shape is
`[{ title, maxItems, cards: [{ index, title, done }] }]`, and `title` is the card's raw markdown
— the same text `edit --text` takes.

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

`--pos` is a zero-based insert position; omitting it appends. `done --undo` unchecks a card.
`move` into a lane the board marks complete checks the card for you, matching what the plugin
does on a drag.

## Card text

Text passes through verbatim, so the board's own syntax works as written: `#tags`,
`@{2026-09-20}` dates, `[[wikilinks]]`, and multi-line bodies.

```sh
kanban add "Board.md" --lane 'In progress' --text 'Ship the CLI #urgent @{2026-09-20}'
```

Quote every value. Lane names contain spaces often enough that an unquoted one silently becomes
two arguments. For a value that itself starts with `--`, use `--flag=value`.

## Lanes

Lane names match exactly and case-sensitively. A limit lives in the heading as `## Inbox (3)`,
and either form addresses the lane. Set a limit with `lane add --max-items 3`; passing it inside
`--name` is an error, because the board would read the parentheses back as a limit.

`lane rm` deletes every card in the lane. Confirm with the user before running it — the cards are
not archived, they are gone.

## Reading the archive

Archived cards are indexed separately and never appear among the lanes:

```sh
kanban list "<file.md>" --archive
```

Nothing writes to the archive. If the user wants a card archived, say so plainly rather than
deleting it.

## When a command fails

Failures exit 1, print to stderr, and leave the file untouched — there is no half-written board to
repair. The messages are specific and worth reading back to the user verbatim:

- `No lane named "X". Lanes: Todo, Doing, Done` — the lane list tells you the right spelling.
- `No card at index 9 in lane "Todo". Valid indices: 0-1` — usually a stale index; re-list.
- `<file> is not a Kanban board: no "kanban-plugin" frontmatter` — wrong file, not a broken one.
- An ambiguous lane name names the colliding lanes instead of guessing. Ask the user which.

## What it does not do

No archiving, no search beyond a plain listing, no templates, no vault-wide operations, and no
talking to a running Obsidian instance. Obsidian picks up file changes on its own, so there is
nothing to reload — but a board open in Obsidian with unsaved edits can overwrite what the CLI
wrote. Mention that if the user is editing the same board live.
