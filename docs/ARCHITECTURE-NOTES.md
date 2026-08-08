# Architecture notes

Working reference for `src/`.
Read this before editing source, and extend it when you learn something it doesn't cover.
All paths are relative to the repo root.

## Top-level wiring

- `src/main.ts` is the plugin entry.
  Owns `stateManagers: Map<TFile, StateManager>` (one per open kanban file, shared by all views of that file) and `windowRegistry` (per-window view lists + a mounted Preact app).
- `src/KanbanView.tsx` is the Obsidian `TextFileView`.
  Multiple views can point at the same file, so view-level state is separate from board state.
  `view.id = ${leaf.id}:::${file.path}`, and the drag-and-drop scope id is that same string.
- `src/DragDropApp.tsx` renders one Preact tree per window, with each view portaled into `view.contentEl`.
  It also holds the global drop handler, see the drag-and-drop section.
- `src/StateManager.ts` is the hub: holds the parsed board, resolves settings, reparses, and writes back to disk.

Data flow, roughly:

```
file md -> StateManager.setState / parser.mdToBoard -> Board (in memory)
        -> components read via stateManager.useState()
        -> mutations call stateManager.setState(board => newBoard)
        -> parser.boardToMd(board) -> view.requestSaveToDisk -> file md
```

## Board state model

Defined in `src/components/types.ts`, built on the generic tree in `src/dnd/types.ts`.

- `Nestable<D, T> { id, type, accepts: string[], children: T[], data: D }`.
- `Board = Nestable<BoardData, Lane>`, `Lane = Nestable<LaneData, Item>`, `Item = Nestable<ItemData>`.
- `type` / `accepts` come from `DataTypes` (`'board' | 'lane' | 'item'`) and drive what can be dropped where.
- `Path = number[]` addresses any entity, for example `[2, 0]` is the first card in the third lane.
  Everything (drag-drop, board modifiers, patching) speaks `Path`.
- Templates `BoardTemplate` / `LaneTemplate` / `ItemTemplate` supply the `type` / `accepts` / empty `children` defaults.
- `id` is `generateInstanceId()` from `src/components/helpers.ts`, in-memory only and never written to markdown.

Key fields:

- `LaneData`: `title`, `maxItems`, `shouldMarkItemsComplete`, `sorted?: LaneSort | string`, `forceEditMode`, `dom`.
- `ItemData`: `titleRaw` (source of truth for serialization), `title` (display HTML after date/time preprocessing and metadata stripping), `titleSearch` / `titleSearchRaw`, `checked`, `checkChar`, `blockId`, `metadata`.
- `ItemMetadata`: `dateStr` / `date`, `timeStr` / `time`, `tags`, `fileAccessor` / `file`, `fileMetadata` / `fileMetadataOrder`, `inlineMetadata`.
- `BoardData`: `settings` (per-board), `frontmatter`, `archive: Item[]`, `isSearching`, `errors`.

Mutation rules:

- State is immutable, mutated via `immutability-helper` `update()` and the helpers in `src/dnd/util/data.ts`
  (`getEntityFromPath`, `updateEntity`, `updateParentEntity`, `insertEntity`, `removeEntity`, `appendEntities`, `prependEntities`, `moveEntity`).
- `src/helpers/boardModifiers.ts` `getBoardModifiers(view, stateManager)` is the app-level mutation API used by components
  (`appendItems`, `prependItems`, `insertItems`, `replaceItem`, `splitItem`, `moveItemToTop`, `moveItemToBottom`, `addLane`, `insertLane`, `updateLane`, `archiveLane`, `archiveLaneItems`, `deleteEntity`, `updateItem`, `archiveItem`, `duplicateEntity`).
  Note there is **no** cross-lane move modifier, that only lives in the drop handler.
- Components subscribe with `stateManager.useState()` (whole board) and `stateManager.useSetting(key)`.

`StateManager.setState(stateOrFn, shouldSave = true)` (`src/StateManager.ts:138`) is the single write path:

1. If `shouldRefreshBoard(oldSettings, newSettings)` (`src/parsers/common.ts:239`) it recompiles settings and runs a full `parser.reparseBoard()`, otherwise it just assigns.
2. Refreshes each view's header buttons and preview cache.
3. Calls `saveToDisk()` unless `shouldSave` is false.
4. Notifies state receivers and per-setting notifiers.

`saveToDisk()` (`src/StateManager.ts:99`) bails out when `state.data.errors.length > 0`, then serializes with `parser.boardToMd` and pushes the string to every view (`view.data = fileStr`; only the primary view actually calls `requestSave()`).

## Markdown to model and back

Parser lives behind `BaseFormat` (`src/parsers/common.ts:15`); the only implementation is `ListFormat` in `src/parsers/List.ts`.

### Parse

1. `parseMarkdown(stateManager, md)` (`src/parsers/parseMarkdown.ts:167`):
   - `extractFrontmatter` scans the leading `---` block manually and `parseYaml`s it.
   - `extractSettingsFooter` scans **backwards** for the trailing fenced block and `JSON.parse`s it.
   - Frontmatter keys in `settingKeyLookup` become settings; everything else stays board frontmatter.
     `kanban-plugin: basic` is normalized to `board` and lands in both.
   - Calls `stateManager.compileSettings(settings)` **before** building the AST, because the micromark extensions read `date-trigger` / `time-trigger`.
   - Builds an mdast tree with custom extensions: task list, `${date-trigger}{...}`, `${date-trigger}[[...]]`, `${time-trigger}{...}`, `![[...]]`, `[[...]]`, hashtags, `^blockid`.
2. `astToUnhydratedBoard` (`src/parsers/formats/list.ts:240`):
   - Each `heading` becomes a lane; the next `list` sibling supplies its cards.
   - A `**Complete**` paragraph before the list sets `shouldMarkItemsComplete`.
   - A `***` thematic break followed by an `## Archive` heading routes that list into `board.data.archive`.
   - `parseLaneTitle` splits a trailing `(n)` into `maxItems` (`src/parsers/helpers/parser.ts:60`).
   - `listItemToItemData` (`src/parsers/formats/list.ts:51`) builds `ItemData`: `titleRaw` is the raw source text, `title` is a copy with tags/dates/times/inline-metadata ranges deleted (only when `move-tags` / `move-dates` / `move-task-metadata` / `inline-metadata-position` say so) and date/time triggers rendered to preview spans by `preprocessTitle`.
3. Hydration (`src/parsers/helpers/hydrateBoard.ts`) turns `dateStr` / `timeStr` into moments, `fileAccessor` into a `TFile`, and computes `titleSearch`.

`ListFormat.mdToBoard` (`src/parsers/List.ts`) does not just replace the board.
When a previous state exists it diffs old vs new (`diff` / `diffApply` in `src/helpers/patch.ts`), ignoring generated keys `['id', 'date', 'time', 'titleSearch', 'titleSearchRaw', 'file']`, then applies the ops.
That is what preserves entity `id`s (and therefore DOM identity, drag state, edit state) across a reparse.
`hydratePostOp` then re-hydrates only the entities whose ops touched `title` / `titleRaw` / `dateStr` / `timeStr` / `fileAccessor`.

### Serialize

`boardToMd(board)` (`src/parsers/formats/list.ts:443`):

```
frontmatter (stringifyYaml of board.data.frontmatter)
+ per lane: "## <title (maxItems)>", optional "**Complete**", "- [x] ..." lines
+ archive block ("***" + "## Archive" + items) if archive is non-empty
+ settingsToCodeblock(board)  ->  "%% kanban:settings" + fenced JSON.stringify(board.data.settings) + "%%"
```

- `itemToMd` writes `- [${checkChar}] ${addBlockId(indentNewLines(titleRaw))}`.
  Serialization always uses `titleRaw`, never `title`.
- `indentNewLines` / `dedentNewLines` and `replaceNewLines` / `replaceBrs` (`src/parsers/helpers/parser.ts`) are the round-trip pair for multi-line cards and lane titles.
- `getViewData()` returns the cached `this.data` string instead of re-serializing, because serialization is slow and Obsidian calls it often.

## Settings

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
- Resolution order, `StateManager.getSetting` (`src/StateManager.ts:264`): supplied override -> `compiledSettings` -> `getSettingRaw`.
  `getSettingRaw` (`:279`): supplied -> `state.data.settings[key]` -> global plugin settings.
  So per-board beats global, always.
- `compileSettings()` (`src/StateManager.ts:217`) precomputes derived values: merged global+local `metadata-keys`, resolved date/time formats, `show-*` flags defaulting to true, `tag-colors` / `tag-sort` / `date-colors` defaulting to `[]`, `tag-action` defaulting to `'obsidian'`.
  Read compiled settings through `getSetting`, do not read `state.data.settings` directly.
- Per-board changes: `KanbanView.getBoardSettings()` wires the modal's `onSettingsChange` to `update(board, { data: { settings: { $set: settings } } })` + `setState`, which round-trips through `boardToMd` into the codeblock.
- Global changes: the settings tab's `onSettingsChange` saves plugin settings and then calls `forceRefresh()` on every state manager.
- View-only keys live in `KanbanViewSettings` (`src/Settings.ts:95`): `kanban-plugin` (board/table/list) and `list-collapse`.
  `getViewState(key)` falls back to `stateManager.getSetting(key)`.
- A new setting needs: the key on `KanbanSettings`, an entry in `settingKeyLookup`, UI in `constructUI`, and (if it changes parsing) an entry in `shouldRefreshBoard`.

## Drag and drop, the path auto-move must reuse

Custom DnD implementation in `src/dnd/`, no external library.

Registration and gesture:

- `src/dnd/components/DndContext.tsx` creates the `DndManager` with the `onDrop` callback.
- Components wrap content in `Droppable` / `Sortable` / `DragOverlay`; see `src/components/Kanban.tsx` and `src/components/Lane/Lane.tsx` for the nesting.
- `EntityManager` (`src/dnd/managers/EntityManager.ts`) derives the entity `Path` from the DOM tree: `getPath() { return [...(this.parent?.getPath() || []), this.index] }`.
  Paths come from the rendered tree, not from the board object.
- `DragManager` (`src/dnd/managers/DragManager.ts`) handles pointer/touch (5px threshold, 500ms long press on touch) and hitbox intersection via `box-intersect`.
- `SortManager.handleDragEnd` (`src/dnd/managers/SortManager.ts`) schedules the drop and calls `dndManager.onDrop(dragEntity, primaryIntersection)`.

The drop handler is `handleDrop` in `src/DragDropApp.tsx:42`.
Three branches:

1. `dragEntity.scopeId === 'htmldnd'` (external HTML drop): builds new items and `insertEntity`s them (`:48-91`).
2. Same board (`sourceFile === destinationFile`, `:104-183`), the branch auto-move needs.
3. Cross board (`:185-257`): nests `destinationStateManager.setState` inside `sourceStateManager.setState` and honors `new-card-insertion-method`.

Same-board move, in one `stateManager.setState`:

- `moveEntity(board, dragPath, dropPath, transform, replace)` (`src/dnd/util/data.ts:83`) does the remove+insert as a single merged mutation.
- `transform` runs `maybeCompleteForMove` (`src/components/helpers.ts:36`) and takes `.next`: this flips `checked` / `checkChar` when the card crosses into or out of a `shouldMarkItemsComplete` lane, and can produce a recurring-task follow-up via `toggleTask`.
- `replace` takes `.replacement` from the same call, which is the recurring-task card left behind in the source lane.
- If the moved entity is a lane, the `list-collapse` view state array is spliced to follow it (`:149-167`).
- The destination lane's `sorted` flag is `$unset` so a manual placement is not immediately re-sorted (`:169-179`).

Reusing this for auto-move:

- `handleDrop` is a closure inside `DragDropApp`, not exported.
  Reuse means either extracting the same-board branch into a shared helper and calling it from both, or composing the same three pieces: `moveEntity` + `maybeCompleteForMove` (both callbacks) + the `sorted` `$unset`.
  Do not hand-roll remove/insert, and do not skip `maybeCompleteForMove`, or cards moved into a Complete lane will not be checked off.
- Auto-move gets its `dropPath` from board data, not from the DOM, so build it as `[laneIndex, insertIndex]` directly.
- Everything goes through `stateManager.setState`, which saves to disk for you.

## Completing a card (checkbox, auto-move)

`src/helpers/completeItem.ts` owns what happens when a card's checkbox is clicked.

- `toggleItemCheckbox(stateManager, boardModifiers, path, item)` is the whole handler;
  `ItemCheckbox` (used by both the board and the table view) just calls it.
  With the Tasks plugin it delegates to `toggleTask`, which returns `[itemStrings, checkChars, thisIndex]`
  where `thisIndex` is the **completed** occurrence — a recurring task yields two strings, the other being the newly scheduled one.
  Without Tasks it flips `checked` / `checkChar` itself.
- Both paths end in `boardModifiers.completeItem(path, items, completedIndex)`, which resolves the settings and calls `autoMoveDoneItem`.
- `autoMoveDoneItem(board, path, items, completedIndex, options)` is pure and does the replace-then-move:
  `insertEntity(removeEntity(...))` in the source lane with the items that stay, then `insertEntity` of the completed one into the done lane, then `$unset` `sorted` there.
  It short-circuits to a plain in-place replace when the feature is off, no lane matches, the card is already in the done lane, or the toggle did not leave the card complete.
- It does **not** use `moveEntity`, because the source and destination lanes are always different, and the "insertion index vs target index" adjustment `moveEntity` makes only applies to siblings.
- It deliberately does **not** run `maybeCompleteForMove` the way the drop handler does: the checkbox already decided the card's completion state, and re-deriving it from the destination lane's `shouldMarkItemsComplete` would undo the user's click.
- Settings: `auto-move-done-to-lane` (bool, default off) and `done-lane-name` (string, default `Done`, matched trimmed + case-insensitively against `lane.data.title`).
  Neither is in `compiledSettings` or `shouldRefreshBoard` — they don't affect parsing, and reading them through `getSetting` keeps a per-board change effective immediately.
  Insert position inside the done lane reuses `new-card-insertion-method`.

## Tests

`yarn test` runs vitest (`vitest.config.ts`, specs in `tests/`).

- There is no runtime `obsidian` module, so vitest aliases `obsidian` and `obsidian-dataview` to stubs in `tests/mocks/`.
  The `obsidian` stub implements `moment`, `TFile`, a flat-map `parseYaml` / `stringifyYaml`, and class stubs for everything else.
- `tests/setup.ts` installs the prototype extensions Obsidian adds (`Array.prototype.last` and friends — `dnd/util/data.ts` depends on `last()`), a `window`/`activeWindow`, and a global `app` stub.
  `stubApp({ tasksPlugin, tasksSettings })` swaps in a fake Tasks plugin, which is how the recurring-task behavior is tested.
- The environment is `jsdom`, because `Settings.ts` pulls in `choices.js`, which touches `document` at import time.
- `tests/helpers/harness.ts` boots a **real** `StateManager` over a markdown string with a `FakeKanbanView`.
  `view.saved` collects what `saveToDisk` writes, so a smoke test can assert on markdown in / markdown out through the real parser, settings resolution and serializer.
  `registerView` is async and the constructor does not await it, hence the small delay in `loadBoard`.
- The round-trip test in `tests/completeItem.smoke.test.ts` is the guard for "existing boards must keep parsing" — it asserts serialization is stable across a reparse.
- Two tests load the demo vault's board from disk, so an example that stops working fails the suite.

## Demo vault

`demo_vault/` at the repo root is a real Obsidian vault for manual testing.

- `yarn build:demo` (one-off) and `yarn dev:demo` (watch) pass `demo` to `esbuild.config.mjs`, which switches `outdir` to `demo_vault/.obsidian/plugins/<manifest.id>` and copies `manifest.json` next to the bundle — Obsidian won't see the plugin without it.
  The plugin id comes from `manifest.json`, so renaming the plugin doesn't need a build change.
- `demo_vault/.obsidian/community-plugins.json` lists the plugin so it is enabled on load.
- The built plugin folder and `workspace.json` are gitignored; the vault's notes and `community-plugins.json` are not.
- `yarn build` / `yarn dev` are unchanged and still write `main.js` + `styles.css` to the repo root.

## Gotchas

- Serialization reads `item.data.titleRaw`.
  Writing `item.data.title` changes the display only and is lost on the next save.
  To change card text, use `stateManager.updateItemContent(item, newRaw)` (which reparses) or `boardModifiers.updateItem`.
- `dropPath` is an insertion index, not a target index.
  `moveEntity` subtracts 1 when source and destination are siblings and the source sits before the destination (`getSiblingDirection` in `src/dnd/util/path.ts`).
  Off-by-one bugs in a synthetic move almost always come from ignoring this.
- Dropping onto a lane's empty area (`inDropArea`) pushes an extra index onto `dropPath` before the move; a lane path and a card path differ by length only.
- Entity `id`s are regenerated by `astToUnhydratedBoard` on every parse; they only survive because of the diff/patch step in `ListFormat.mdToBoard`.
  Never persist an `id`, and never assume it is stable across `forceRefresh()`.
- `setState` skips the disk write while `state.data.errors` is non-empty, so a parse error silently freezes saving until it clears.
- Changing any key in `shouldRefreshBoard`'s list forces a full reparse of every card, which is the expensive path.
- `compileSettings` is called by `parseMarkdown` before the AST is built, so a setting that affects parsing must be readable at that point.
- One `StateManager` serves many views of the same file; per-view state belongs in `KanbanViewSettings`, not in `BoardData`.
- `main.ts` debounces external file/metadata/dataview changes (2000ms, leading) into `onFileMetadataChange()` on the other boards, so cross-board metadata updates are not instant.
- The archive is `board.data.archive`, a flat `Item[]` outside the lane tree.
  Lane paths do not address it.
- `lane.data.sorted` is set only by `src/components/Lane/LaneMenu.tsx`, read via `SortContext` in `src/components/Lane/Lane.tsx`, and cleared on drop.
  Any programmatic insert into a sorted lane should clear it the same way.
- Markdown format changes are the one hard constraint: existing boards must keep parsing, see CLAUDE.md.
