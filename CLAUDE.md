# CLAUDE.md — obsidian-kanban (personal fork)

Personal fork of `community-archive/obsidian-kanban`
(upstream: https://github.com/community-archive/obsidian-kanban), extended
for one user's own Obsidian setup. Optimize for "does it work for me," not
general-purpose robustness or upstream-mergeability.


## Agent notes
The codebase is complex and can be unintuitive (for llms).
So before touching source, search the notes in `.agent_notes` to build up a faster context and you don't have to re-discover the same things each session.
The main topics are:
- `.agent_notes/changelog/*.md`: changes made on `custom` that diverge from upstream.
- `.agent_notes/architecture/*.md`: notes on the architecture of the plugin.

`.agent_notes/index.md` should help you find the right notes quickly.
It has a grep-friendly structure where each line has the following structure: `<filepath>: <short summary of the note>`.
You must keep this index file up to date as you added, update, remove notes.

## Fork and Branching
- Our goal is to add personal feature while keeping the ability to merge upstream changes easily.
- `main` mirrors upstream exactly never commit here directly.
- **`custom` is the primary development branch** — all personal work happens here, kept rebased onto `main`.
- Before editing, confirm the current branch: `git branch --show-current`.  If it isn't `custom`, switch before making changes.
- Fork-specific files should never be merged into `main`.

## Pull Requests
- **Always create PRs targeting the `custom` branch**, not `main`.
- Keep PRs small and focused on a single change. If changes are large, there is scope creep or you encounter new issues, either break it into multiple PRs, push back to the user and discuss it, or create issues to tackle later.  Don't let PRs grow too large and keep them easy to review.

## Constraints
- Make sure the feature does not prevent future upstream merges.  If it does, discuss with the user and consider alternative approaches.
- Prefer a toggle-able setting over hardcoded behavior.
- Never change the on-disk markdown format in a way that breaks existing boards without a migration path.
- Don't build settings/UI for anything not actually used — this is a fork of one user, not a public plugin.

## Project commands
- `yarn install`: install dependencies.
- `yarn test`: run the vitest suite, `yarn test:watch` to watch.
- `yarn typecheck`: `tsc --noemit`.
- `yarn lint` / `yarn lint:fix`: eslint over `src/`.
- `yarn clean`: prettier then `lint:fix` over `src/`.
- `yarn build`: production build, writes `main.js` + `styles.css` to the repo root.
- `yarn dev`: same but in watch mode.
- `yarn build:demo` / `yarn dev:demo`: build into `demo_vault/.obsidian/plugins/<manifest.id>` so the change can be opened in Obsidian.  See `.agent_notes/architecture/demo-vault.md`.

Before finishing a change run `yarn test` and `yarn typecheck`.
Release commands (`yarn bump`, `yarn release`) are run by the user, not by agents.