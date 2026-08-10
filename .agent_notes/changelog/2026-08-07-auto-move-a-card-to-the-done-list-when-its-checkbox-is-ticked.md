# 2026-08-07 - Auto-move a card to the done list when its checkbox is ticked

**Why:** Ticking a card's checkbox and then dragging it to `Done` is two
actions for one decision, and the drag is the one that gets skipped — so
boards drift into "checked cards scattered across every list" and the done
list stops being a useful record of what actually got finished. Recurring
tasks made the manual version worse: the Tasks plugin leaves two cards
behind and only one of them belongs in `Done`, so the tidy-up needs thought
every single time.

**What:** Added `auto-move-done-to-lane` (off by default) and
`done-lane-name` (default `Done`), both settable globally and per board.
When a checkbox toggle leaves a card complete, the card moves to the named
list; for a recurring task only the completed occurrence moves and the newly
scheduled one stays put. Completion dates keep coming from the Tasks plugin,
unchanged. The checkbox handler moved out of `ItemCheckbox` into
`src/helpers/completeItem.ts` so it can be tested, and the repo gained a
vitest setup (`yarn test`) with unit tests plus markdown-in/markdown-out
smoke tests over the real parser and state manager. A `demo_vault/` at the
repo root holds an example board, and `yarn build:demo` builds the plugin
straight into it so the board can be opened in Obsidian against the current
source.