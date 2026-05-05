---
name: obsidian-kanban-cli
description: Use this skill when an OpenClaw agent needs to list Obsidian Kanban boards, inspect cards, or add cards to markdown kanban lanes.
---

# Obsidian Kanban CLI

Use this repo's CLI to work with markdown kanban boards. Always pass `--vault <vault>`.

```bash
PLUGIN_REPO=/path/to/obsidian-kanban
npm --prefix "$PLUGIN_REPO" run cli-build
node "$PLUGIN_REPO/openclaw-kanban-cli.cjs" list --vault <vault>
```

Inspect or add cards:

```bash
node "$PLUGIN_REPO/openclaw-kanban-cli.cjs" cards --vault <vault> --path "Board.md"
node "$PLUGIN_REPO/openclaw-kanban-cli.cjs" add-card --vault <vault> --path "Board.md" --lane "Todo" --text "Draft outline"
```

If installed or linked, `obsidian-kanban-cli ...` may be used instead.

## Safety

- `--lane` matches a markdown heading; missing lanes are appended.
- Prefer `--dry-run` before adding cards.
- Treat `ok: false` or nonzero exit as failure and report `error.message`.

