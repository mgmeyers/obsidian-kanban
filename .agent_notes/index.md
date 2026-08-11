# Agent notes index

One line per note: `<filepath>: <short summary>`.
Grep this file first, then open only the notes you need.
Keep it in sync whenever you add, rename, or delete a note.

## Architecture

architecture/CLAUDE.md: format rules for architecture notes.
architecture/overview.md: top-level wiring — main.ts, KanbanView, DragDropApp, StateManager — and the markdown -> board -> markdown data flow.
architecture/board-state.md: Board/Lane/Item tree, Path addressing, immutable mutation helpers, boardModifiers, and the setState / saveToDisk write path.
architecture/parsing.md: parseMarkdown and astToUnhydratedBoard, hydration, the diff/patch reparse that preserves entity ids, and boardToMd serialization.
architecture/settings.md: global / per-board / per-view layers, getSetting resolution order, compileSettings, shouldRefreshBoard, and how to add a setting.
architecture/drag-and-drop.md: custom DnD in src/dnd, the handleDrop branches, moveEntity + maybeCompleteForMove, and how to build a synthetic card move.
architecture/card-completion.md: checkbox handling in src/helpers/completeItem.ts, Tasks-plugin recurring tasks, and the auto-move-to-done settings.
architecture/testing.md: vitest setup, obsidian module stubs, the real-StateManager harness, and the markdown round-trip guard.
architecture/demo-vault.md: demo_vault/ as a real Obsidian vault, yarn build:demo / dev:demo, and what is gitignored.
architecture/ci.md: the GitHub Actions gate and yarn ci — install/lockfile/typecheck/lint/format/test/build, tsconfig.eslint.json, and the lockfile transport check.

## Changelog

changelog/CLAUDE.md: format rules for changelog entries.
changelog/2026-08-07-name-to-avoid-clashing-with-upstream.md: plugin id obsidian-kanban -> kanban-custom, display name Kanban -> Kanban (custom), so the fork can run beside upstream.
changelog/2026-08-07-auto-move-a-card-to-the-done-list-when-its-checkbox-is-ticked.md: auto-move-done-to-lane + done-lane-name settings, checkbox handler extracted to completeItem.ts, vitest setup and demo_vault added.
changelog/2026-08-10-pin-cm-language-over-https-instead-of-ssh.md: yarn.lock resolves the cm-language git dep over https so yarn install works without a GitHub SSH key.
changelog/2026-08-10-get-yarn-test-and-typecheck-passing-again.md: declare the global app, type ViewState.state.file, fix the localStorage guard, and stub obsidian-daily-notes-interface.
changelog/2026-08-10-fetch-the-obsidian-api-dep-over-git-instead-of-a-codeload-tarball.md: yarn.lock resolves the obsidian dep over git+https instead of a codeload.github.com tarball, which the sandbox egress proxy blocks with a 403.
changelog/2026-08-10-add-a-ci-workflow-and-make-lint-enforceable.md: ci.yml gate on custom, scripts/check-lockfile.mjs, tsconfig.eslint.json so lint passes, .nvmrc, and release.yml building from the lockfile.
