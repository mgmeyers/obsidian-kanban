# Settings

Three layers, resolved by `StateManager`.

| Layer | Stored in | Written by |
| --- | --- | --- |
| Global | `data.json` plugin settings | `KanbanSettingsTab` (`src/Settings.ts:1569`) |
| Per board | `%% kanban:settings` codeblock at the end of the file, plus setting keys in frontmatter | `SettingsModal` (`src/Settings.ts:1542`) |
| Per view | Obsidian workspace layout state (`view.viewSettings`) | `KanbanView.setViewState` |

- `KanbanSettings` (`src/Settings.ts:52`) is the flat kebab-case key list; `settingKeyLookup` (`src/Settings.ts:100`) is the same keys as a `Set`, used to decide whether a frontmatter key is a setting.
- `SettingsManager` (`src/Settings.ts:158`) builds both UIs from one `constructUI(contentEl, heading, local)`.
  `getSetting(key, local)` returns `[value, globalValue]` when `local` is true, so the per-board UI can show the inherited global value as a placeholder; in the global tab the second element is always `null`.
  `applySettingsUpdate` debounces 1s, then fires `config.onSettingsChange`.

## Resolution order

`StateManager.getSetting` (`src/StateManager.ts:264`): supplied override -> `compiledSettings` -> `getSettingRaw`.
`getSettingRaw` (`:279`): supplied -> `state.data.settings[key]` -> global plugin settings.
So per-board beats global, always.

`compileSettings()` (`src/StateManager.ts:217`) precomputes derived values: merged global+local `metadata-keys`, resolved date/time formats, `show-*` flags defaulting to true, `tag-colors` / `tag-sort` / `date-colors` defaulting to `[]`, `tag-action` defaulting to `'obsidian'`.
Read compiled settings through `getSetting`, do not read `state.data.settings` directly.

## Writing settings back

- Per-board changes: `KanbanView.getBoardSettings()` wires the modal's `onSettingsChange` to `update(board, { data: { settings: { $set: settings } } })` + `setState`, which round-trips through `boardToMd` into the codeblock.
- Global changes: the settings tab's `onSettingsChange` saves plugin settings and then calls `forceRefresh()` on every state manager.
- View-only keys live in `KanbanViewSettings` (`src/Settings.ts:95`): `kanban-plugin` (board/table/list) and `list-collapse`.
  `getViewState(key)` falls back to `stateManager.getSetting(key)`.

## Adding a setting

A new setting needs: the key on `KanbanSettings`, an entry in `settingKeyLookup`, UI in `constructUI`, and (if it changes parsing) an entry in `shouldRefreshBoard`.

## Gotchas

- Changing any key in `shouldRefreshBoard`'s list forces a full reparse of every card, which is the expensive path.
  Leave a setting out of that list if it doesn't affect parsing.
- `compileSettings` is called by `parseMarkdown` before the AST is built, so a setting that affects parsing must be readable at that point.
- One `StateManager` serves many views of the same file; per-view state belongs in `KanbanViewSettings`, not in `BoardData`.
