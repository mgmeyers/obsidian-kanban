# 2026-08-07 - Rename plugin id/name to avoid clashing with upstream

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