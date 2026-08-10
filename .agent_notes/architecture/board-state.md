# Board state model and the write path

The in-memory board, how to mutate it, and how `setState` gets it back to disk.

## Shape

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

## Mutation rules

- State is immutable, mutated via `immutability-helper` `update()` and the helpers in `src/dnd/util/data.ts`
  (`getEntityFromPath`, `updateEntity`, `updateParentEntity`, `insertEntity`, `removeEntity`, `appendEntities`, `prependEntities`, `moveEntity`).
- `src/helpers/boardModifiers.ts` `getBoardModifiers(view, stateManager)` is the app-level mutation API used by components
  (`appendItems`, `prependItems`, `insertItems`, `replaceItem`, `splitItem`, `moveItemToTop`, `moveItemToBottom`, `addLane`, `insertLane`, `updateLane`, `archiveLane`, `archiveLaneItems`, `deleteEntity`, `updateItem`, `archiveItem`, `duplicateEntity`).
  Note there is **no** cross-lane move modifier, that only lives in the drop handler.
  See [drag-and-drop.md](drag-and-drop.md).
- Components subscribe with `stateManager.useState()` (whole board) and `stateManager.useSetting(key)`.

## setState, the single write path

`StateManager.setState(stateOrFn, shouldSave = true)` (`src/StateManager.ts:138`):

1. If `shouldRefreshBoard(oldSettings, newSettings)` (`src/parsers/common.ts:239`) it recompiles settings and runs a full `parser.reparseBoard()`, otherwise it just assigns.
2. Refreshes each view's header buttons and preview cache.
3. Calls `saveToDisk()` unless `shouldSave` is false.
4. Notifies state receivers and per-setting notifiers.

`saveToDisk()` (`src/StateManager.ts:99`) bails out when `state.data.errors.length > 0`, then serializes with `parser.boardToMd` and pushes the string to every view (`view.data = fileStr`; only the primary view actually calls `requestSave()`).

## Gotchas

- `setState` skips the disk write while `state.data.errors` is non-empty, so a parse error silently freezes saving until it clears.
- The archive is `board.data.archive`, a flat `Item[]` outside the lane tree.
  Lane paths do not address it.
- `lane.data.sorted` is set only by `src/components/Lane/LaneMenu.tsx`, read via `SortContext` in `src/components/Lane/Lane.tsx`, and cleared on drop.
  Any programmatic insert into a sorted lane should clear it the same way.
- Serialization reads `item.data.titleRaw`, not `title`.
  See [parsing.md](parsing.md).
