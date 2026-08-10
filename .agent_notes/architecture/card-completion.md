# Completing a card (checkbox, auto-move)

`src/helpers/completeItem.ts` owns what happens when a card's checkbox is clicked.
Fork-specific behavior, see the changelog entry for auto-move-to-done.

- `toggleItemCheckbox(stateManager, boardModifiers, path, item)` is the whole handler;
  `ItemCheckbox` (used by both the board and the table view) just calls it.
  With the Tasks plugin it delegates to `toggleTask`, which returns `[itemStrings, checkChars, thisIndex]`
  where `thisIndex` is the **completed** occurrence — a recurring task yields two strings, the other being the newly scheduled one.
  Without Tasks it flips `checked` / `checkChar` itself.
- Both paths end in `boardModifiers.completeItem(path, items, completedIndex)`, which resolves the settings and calls `autoMoveDoneItem`.
- `autoMoveDoneItem(board, path, items, completedIndex, options)` is pure and does the replace-then-move:
  `insertEntity(removeEntity(...))` in the source lane with the items that stay, then `insertEntity` of the completed one into the done lane, then `$unset` `sorted` there.
  It short-circuits to a plain in-place replace when the feature is off, no lane matches, the card is already in the done lane, or the toggle did not leave the card complete.

## Why it does not reuse the drop handler

- It does **not** use `moveEntity`, because the source and destination lanes are always different, and the "insertion index vs target index" adjustment `moveEntity` makes only applies to siblings.
  See [drag-and-drop.md](drag-and-drop.md).
- It deliberately does **not** run `maybeCompleteForMove` the way the drop handler does: the checkbox already decided the card's completion state, and re-deriving it from the destination lane's `shouldMarkItemsComplete` would undo the user's click.

## Settings

`auto-move-done-to-lane` (bool, default off) and `done-lane-name` (string, default `Done`, matched trimmed + case-insensitively against `lane.data.title`).
Neither is in `compiledSettings` or `shouldRefreshBoard` — they don't affect parsing, and reading them through `getSetting` keeps a per-board change effective immediately.
Insert position inside the done lane reuses `new-card-insertion-method`.
