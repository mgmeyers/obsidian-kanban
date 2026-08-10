# Top-level wiring

How the plugin's objects fit together, and the path a change takes from markdown to screen and back.
All paths are relative to the repo root.

## The four objects

- `src/main.ts` is the plugin entry.
  Owns `stateManagers: Map<TFile, StateManager>` (one per open kanban file, shared by all views of that file) and `windowRegistry` (per-window view lists + a mounted Preact app).
- `src/KanbanView.tsx` is the Obsidian `TextFileView`.
  Multiple views can point at the same file, so view-level state is separate from board state.
  `view.id = ${leaf.id}:::${file.path}`, and the drag-and-drop scope id is that same string.
- `src/DragDropApp.tsx` renders one Preact tree per window, with each view portaled into `view.contentEl`.
  It also holds the global drop handler, see [drag-and-drop.md](drag-and-drop.md).
- `src/StateManager.ts` is the hub: holds the parsed board, resolves settings, reparses, and writes back to disk.

## Data flow

```
file md -> StateManager.setState / parser.mdToBoard -> Board (in memory)
        -> components read via stateManager.useState()
        -> mutations call stateManager.setState(board => newBoard)
        -> parser.boardToMd(board) -> view.requestSaveToDisk -> file md
```

See [board-state.md](board-state.md) for the model and the write path, [parsing.md](parsing.md) for both parser directions.

## Gotchas

- Several modules (`main.ts`, `parsers/helpers/inlineMetadata.ts`, `parsers/helpers/parser.ts`) read a bare global `app`.
  Obsidian sets it up at runtime but its published typings don't declare it, so `src/types.d.ts` carries `declare const app: import('obsidian').App`.
  Without that declaration `yarn typecheck` fails with `Cannot find name 'app'`.
- One `StateManager` serves many views of the same file; per-view state belongs in `KanbanViewSettings`, not in `BoardData`.
  See [settings.md](settings.md).
- `main.ts` debounces external file/metadata/dataview changes (2000ms, leading) into `onFileMetadataChange()` on the other boards, so cross-board metadata updates are not instant.
