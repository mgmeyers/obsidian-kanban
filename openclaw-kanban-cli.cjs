#!/usr/bin/env node
"use strict";

process.env.OPENCLAW_PLUGIN_CONFIG = JSON.stringify({
  pluginId: "obsidian-kanban",
  installedId: "obsidian-kanban",
  bin: "obsidian-kanban-cli",
  domain: "kanban",
  capabilities: ["settings", "markdown-kanban"],
  commands: ["list", "cards", "add-card"],
});
require("./openclaw-plugin-cli.cjs");
