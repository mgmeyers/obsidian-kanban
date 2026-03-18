# Obsidian Kanban Plugin — Copilot Instructions

## Build & Development

```bash
yarn install          # Install dependencies
yarn build            # Production build (minified, no sourcemaps)
yarn dev              # Watch mode with inline sourcemaps
yarn typecheck        # Type-check without emitting (tsc --noemit)
yarn lint             # ESLint on src/**/*.{ts,tsx}
yarn lint:fix         # ESLint autofix
yarn prettier         # Format src/**/*.{ts,tsx}
yarn clean            # prettier + lint:fix combined
```

Build uses **esbuild** (not webpack/vite). Entry points are `src/main.ts` and `src/styles.less`. Output is `main.js` + `styles.css` in the repo root (Obsidian plugin format, CJS, ES2018 target). There are no tests.

## Architecture Overview

This is an [Obsidian](https://obsidian.md/) plugin that provides Kanban boards backed by markdown files. The core data flow is:

```
Markdown file ↔ Parser (AST) ↔ StateManager (Board tree) ↔ Preact components
```

### Rendering: Preact, not React

The plugin uses **Preact** with the React compat layer. Imports look like React but resolve to Preact:
- `tsconfig.json` sets `jsxImportSource: "preact"` and path aliases for `react`/`react-dom`
- `package.json` maps `react` → `@preact/compat`
- Import hooks from `preact/compat` or `preact/hooks`, not `react`

### Data Model: Nestable Tree

Everything is a `Nestable<Data, Child>` (defined in `src/dnd/types.ts`):

```
Board (Nestable<BoardData, Lane>)
  └── Lane (Nestable<LaneData, Item>)
       └── Item (Nestable<ItemData>)
```

- `Board.data` holds settings, frontmatter, archive, and errors
- `Lane.data` holds title, maxItems, shouldMarkItemsComplete, sort order
- `Item.data` holds titleRaw (markdown source), rendered title, metadata (dates, tags, inline fields, linked file data), and checkbox state

### StateManager — Central State Hub

`src/StateManager.ts` is the single source of truth. Key patterns:
- **`setState(board | updaterFn, shouldSave?)`** — Updates state, notifies all views, optionally saves to disk
- **`useState()`** — Preact hook to subscribe to board state changes
- **`useSetting(key)`** — Preact hook to subscribe to a specific setting
- **`getSetting(key)`** — Reads a compiled setting (merged local + global)
- All state updates use **`immutability-helper`** (`update()`) for immutable mutations

### Settings Hierarchy

Settings merge in priority order: board-local (in markdown) > compiled (merged) > global (plugin-wide). Board settings are stored in a JSON code block at the bottom of the markdown file inside `%% kanban:settings ... %%`.

### Parser System

Located in `src/parsers/`. The pipeline:

1. **`parseMarkdown.ts`** — Parses markdown into an mdast AST using custom micromark extensions for dates (`📅{date}`), times (`⏰{time}`), wikilinks (`[[link]]`), hashtags (`#tag`), block IDs (`^id`), and task checkboxes
2. **`formats/list.ts`** — Converts AST ↔ Board tree. Key functions:
   - `listItemToItemData()` — Extracts metadata from a parsed list item
   - `newItem()` / `updateItemContent()` — Create/update items
   - `boardToMd()` — Serializes the board back to markdown
3. **`helpers/hydrateBoard.ts`** — Post-parse hydration: resolves dates to moment.js, fetches linked file metadata, pre-processes titles for rendering

### Board Modifiers

`src/helpers/boardModifiers.ts` provides the mutation API (`BoardModifiers` interface). All board mutations (add/move/archive/delete items and lanes) go through this layer, which delegates to `stateManager.setState()`.

### Drag & Drop

`src/dnd/` is a **fully custom** DnD implementation (no external library). Architecture:
- **Managers** (`DndManager`, `DragManager`, `SortManager`, `ScrollManager`) handle orchestration, pointer events, sorting, and auto-scroll
- **Components** (`Sortable`, `Droppable`, `DragOverlay`, `ScrollContainer`) integrate DnD with Preact
- Hitbox-based collision detection; path-based entity addressing (`Path = number[]`, e.g., `[laneIdx, itemIdx]`)
- All code is **window-aware** for Obsidian's iframe/popout scenarios — use `activeWindow` instead of bare `window`/`setTimeout`

## Key Conventions

### CSS Class Names

Use the `c()` helper (`src/components/helpers.ts`) which produces BEM-style names with a `kanban-plugin__` prefix:

```typescript
import { c } from '../helpers';
<div className={c('item-title')} />  // → "kanban-plugin__item-title"
```

Styles are in `src/styles.less`. Use Obsidian's CSS custom properties (`--background-primary`, `--text-normal`, etc.) for theme compatibility.

### Internationalization

All user-facing strings must go through the `t()` function from `src/lang/helpers.ts`:

```typescript
import { t } from 'src/lang/helpers';
const label = t('Archive');  // Type-safe — key must exist in src/lang/locale/en.ts
```

To add a new string: add the key+value to `src/lang/locale/en.ts`, then use `t('key')`. Other locales in `src/lang/locale/` provide `Partial<Lang>` overrides — missing keys fall back to English.

### Import Paths

Uses **`src/` base path** aliases (configured in `tsconfig.json` with `baseUrl: "."`). Imports use `src/` prefix for cross-directory references:

```typescript
import { StateManager } from 'src/StateManager';
import { c } from 'src/components/helpers';
```

Relative imports are used within the same directory/subdirectory.

### Component Patterns

- Components use `memo()` from `preact/compat` for memoization
- Context access via `useContext(KanbanContext)` for stateManager, boardModifiers, view, filePath
- `SearchContext` and `SortContext` for search/sort state
- Settings-rendering components follow a `Component + renderFn + cleanupFn` pattern (see `src/settings/`)

### State Updates

Always use `immutability-helper`'s `update()` for state mutations:

```typescript
import update from 'immutability-helper';
stateManager.setState((board) =>
  update(board, { children: { [laneIdx]: { children: { $push: [newItem] } } } })
);
```

### Markdown Serialization Round-Trip

Item content lives in `item.data.titleRaw`. When modifying items programmatically:
1. Build new content string
2. Call `stateManager.updateItemContent(item, newContent)` — re-parses and hydrates
3. Push update via `boardModifiers.updateItem(path, updatedItem)`

The markdown format is: `- [checkChar] titleRaw ^blockId`, with multi-line content indented.
