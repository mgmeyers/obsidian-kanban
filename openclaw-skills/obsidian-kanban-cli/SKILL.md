---
name: obsidian-kanban-cli
description: Use this skill when an OpenClaw agent needs to list Obsidian Kanban boards, inspect cards, or add cards to markdown kanban lanes.
---

# Obsidian Kanban CLI

Use the CLI shipped in the installed plugin folder. Always pass `--vault <vault>`.

```bash
VAULT=/path/to/vault
CLI="$VAULT/.obsidian/plugins/obsidian-kanban/openclaw-kanban-cli.cjs"
node "$CLI" list --vault "$VAULT"
```

Inspect or add cards:

```bash
node "$CLI" cards --vault "$VAULT" --path "Board.md"
node "$CLI" add-card --vault "$VAULT" --path "Board.md" --lane "Todo" --text "Draft outline"
```

If the installed plugin does not include the CLI yet, use `obsidian-kanban-cli` from `PATH` or `node "$PLUGIN_REPO/openclaw-kanban-cli.cjs"` from a checkout.

## Safety

- `--lane` matches a markdown heading; missing lanes are appended.
- Prefer `--dry-run` before adding cards.
- Treat `ok: false` or nonzero exit as failure and report `error.message`.

