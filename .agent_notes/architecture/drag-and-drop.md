# Drag and drop

Custom DnD implementation in `src/dnd/`, no external library.
This is also the reference implementation for any synthetic (non-user-initiated) card move.

## Registration and gesture

- `src/dnd/components/DndContext.tsx` creates the `DndManager` with the `onDrop` callback.
- Components wrap content in `Droppable` / `Sortable` / `DragOverlay`; see `src/components/Kanban.tsx` and `src/components/Lane/Lane.tsx` for the nesting.
- `EntityManager` (`src/dnd/managers/EntityManager.ts`) derives the entity `Path` from the DOM tree: `getPath() { return [...(this.parent?.getPath() || []), this.index] }`.
  Paths come from the rendered tree, not from the board object.
- `DragManager` (`src/dnd/managers/DragManager.ts`) handles pointer/touch (5px threshold, 500ms long press on touch) and hitbox intersection via `box-intersect`.
- `SortManager.handleDragEnd` (`src/dnd/managers/SortManager.ts`) schedules the drop and calls `dndManager.onDrop(dragEntity, primaryIntersection)`.

## The drop handler

`handleDrop` in `src/DragDropApp.tsx:42`, three branches:

1. `dragEntity.scopeId === 'htmldnd'` (external HTML drop): builds new items and `insertEntity`s them (`:48-91`).
2. Same board (`sourceFile === destinationFile`, `:104-183`).
3. Cross board (`:185-257`): nests `destinationStateManager.setState` inside `sourceStateManager.setState` and honors `new-card-insertion-method`.

Same-board move, in one `stateManager.setState`:

- `moveEntity(board, dragPath, dropPath, transform, replace)` (`src/dnd/util/data.ts:83`) does the remove+insert as a single merged mutation.
- `transform` runs `maybeCompleteForMove` (`src/components/helpers.ts:36`) and takes `.next`: this flips `checked` / `checkChar` when the card crosses into or out of a `shouldMarkItemsComplete` lane, and can produce a recurring-task follow-up via `toggleTask`.
- `replace` takes `.replacement` from the same call, which is the recurring-task card left behind in the source lane.
- If the moved entity is a lane, the `list-collapse` view state array is spliced to follow it (`:149-167`).
- The destination lane's `sorted` flag is `$unset` so a manual placement is not immediately re-sorted (`:169-179`).

## Reusing this for a synthetic move

- `handleDrop` is a closure inside `DragDropApp`, not exported.
  Reuse means either extracting the same-board branch into a shared helper and calling it from both, or composing the same three pieces: `moveEntity` + `maybeCompleteForMove` (both callbacks) + the `sorted` `$unset`.
  Do not hand-roll remove/insert, and do not skip `maybeCompleteForMove`, or cards moved into a Complete lane will not be checked off.
- A synthetic move gets its `dropPath` from board data, not from the DOM, so build it as `[laneIndex, insertIndex]` directly.
- Everything goes through `stateManager.setState`, which saves to disk for you.

The auto-move-on-complete feature deliberately does **not** reuse `moveEntity`; see [card-completion.md](card-completion.md) for why.

## Gotchas

- `dropPath` is an insertion index, not a target index.
  `moveEntity` subtracts 1 when source and destination are siblings and the source sits before the destination (`getSiblingDirection` in `src/dnd/util/path.ts`).
  Off-by-one bugs in a synthetic move almost always come from ignoring this.
- Dropping onto a lane's empty area (`inDropArea`) pushes an extra index onto `dropPath` before the move; a lane path and a card path differ by length only.
- Any programmatic insert into a sorted lane should clear `lane.data.sorted` the same way the drop handler does.
