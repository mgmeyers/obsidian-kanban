# Changelog (personal fork)

Entries for changes made on `custom` that diverge from upstream.
Newest first.

Format per entry:

```
## YYYY-MM-DD - Short title

**Why:** motivation for the change.

**What:** brief summary of the change (the diff has the details).
```

## 2026-08-07 - Auto-move a card to the done list when its checkbox is ticked

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
smoke tests over the real parser and state manager. Example board for the
test vault lives in `docs/Examples/`.

## 2026-08-07 - Rename plugin id/name to avoid clashing with upstream

**Why:** Running this fork alongside (or instead of) the official
`obsidian-kanban` plugin needs a distinct plugin id, otherwise Obsidian
can't tell the two apart (install/update/BRAT conflicts, same data
directory under `.obsidian/plugins/`).

**What:** Changed the plugin id from `obsidian-kanban` to `kanban-custom`
and display name from `Kanban` to `Kanban (custom)` in `manifest.json` and
`package.json`. Updated the test vault (`docs/.obsidian/`) to match: renamed
`plugins/obsidian-kanban/` to `plugins/kanban-custom/` and updated
`community-plugins.json`. The markdown board format (`kanban-plugin`
frontmatter key) and vault settings keys are unchanged.
