# CLAUDE.md — obsidian-kanban (personal fork)

Personal fork of `community-archive/obsidian-kanban`
(upstream: https://github.com/community-archive/obsidian-kanban), extended
for one user's own Obsidian setup. Optimize for "does it work for me," not
general-purpose robustness or upstream-mergeability.

## Before touching source

Read `docs/ARCHITECTURE-NOTES.md` — board state, parsing, and settings
are documented there so you don't need to re-explore each session. If a
task teaches you something that file doesn't cover, add it before you
finish.

## Branching

- `main` mirrors upstream exactly — never commit here directly.
- **`custom` is the primary development branch** — all personal work happens here,
  kept rebased onto `main`.
- Before editing, confirm the current branch: `git branch --show-current`.
  If it isn't `custom`, switch before making changes.
- This file, `CHANGELOG-personal.md`, `docs/ARCHITECTURE-NOTES.md`, and
  `.claude/commands/sync-upstream.md` exist only on `custom` — they're
  fork-specific and don't belong on `main`.

## Pull Requests

- **Always create PRs targeting the `custom` branch**, not `main`.
- `main` is reserved for upstream synchronization only.
- The `custom` branch is where all personal work and fixes are merged.

## When asked to add or change a feature

1. Check `docs/ARCHITECTURE-NOTES.md` before editing `src/`.
2. Prefer a toggle-able setting over hardcoded behavior.
3. Build (`yarn build`) and confirm existing kanban markdown files still
   parse — that must never regress.
4. Add an entry to `CHANGELOG-personal.md` before committing — format is
   at the top of that file. State the motivation ("why"), not just the
   change ("what"); the diff already shows the what.
5. Commit on `custom`, referencing the changelog entry.
6. Once the feature is confirmed working (test vault), bump the version
   and tag it so the release workflow runs and BRAT can update the real
   install — see `.claude/commands/sync-upstream.md` for the version-bump
   mechanism used.

## Upstream sync

Nightly task: `.claude/commands/sync-upstream.md`.

## Constraints

- Never change the on-disk markdown format in a way that breaks existing
  boards without a migration path.
- Don't build settings/UI for anything not actually used — this is a fork
  of one user, not a public plugin.