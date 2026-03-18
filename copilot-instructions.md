# Obsidian Kanban Plugin - Copilot Instructions

**Last Updated:** January 2025  
**Repository:** https://github.com/mgmeyers/obsidian-kanban  
**Status:** Looking for new maintainers (see MAINTAINERS.md)

---

## 1. BUILD SYSTEM & TOOLING

### Bundler: esbuild
- **Config:** esbuild.config.mjs (custom configuration)
- **Entry points:** src/main.ts, src/styles.less
- **Output:** main.js (CJS format), styles.css (compiled from LESS)
- Tree-shaking, inline source maps (dev), custom replace plugin, external dependencies
- Polyfill for Node.js buffer module

### CSS: LESS
- **Main file:** src/styles.less
- **Methodology:** BEM with kanban-plugin base class
- Uses Obsidian CSS variables (--background-primary, --tag-padding-x, etc.)

### TypeScript
- **Target:** ES2018
- **JSX:** React-JSX via Preact
- **jsxImportSource:** preact
- **Path aliases:** react and react-dom map to preact/compat

### Scripts
- dev: Watch build
- build: Production bundle (minified)
- lint, prettier, clean scripts

---

## 2. ARCHITECTURE OVERVIEW

### Plugin Entry: src/main.ts (extends Plugin)
- Register kanban view type
- Manage StateManager instances (Map by TFile)
- Multi-window support via windowRegistry
- Settings management, commands, events

### StateManager: src/StateManager.ts
- Bridge between UI and data
- Parse markdown to Board state
- Serialize Board to markdown
- Hierarchy: board-level > global settings
- Event broadcasting via stateReceivers, settingsNotifiers
- Hooks: useState(), useSetting()

### View Layer: src/KanbanView.tsx (extends TextFileView)
- Obsidian file integration
- Render Preact portal to view.contentEl
- Header buttons, preview caching
- View lifecycle management

### Root Component: src/DragDropApp.tsx
- Renders KanbanView portals for window
- Handles drop events
- Multi-view coordination

### Rendering: Preact (not React)
- Lightweight React alternative
- preact/compat for hook compatibility
- Configured in tsconfig.json and package.json

### Markdown <-> State
- File is source of truth
- Bidirectional: markdown <-> Board state
- Uses mdast AST from micromark ecosystem
- Custom extensions for dates, times, tags, block IDs

---

## 3. PARSER SYSTEM

### Parsing: Markdown to Board

**4-stage pipeline:**
1. parseMarkdown() - Extract frontmatter/settings, create AST
2. Extensions - Micromark syntax (checkboxes, tags, dates, times, links, block IDs)
3. astToUnhydratedBoard() - Map AST to structure
4. hydrateBoard() - Parse metadata, resolve files, build search fields

### Serialization: Board to Markdown
- YAML frontmatter
- Lanes as headings with items as lists
- Archive section
- Settings JSON footer

### Data Structures

**ItemData:**
- blockId, checked, checkChar, title, titleRaw
- titleSearch, titleSearchRaw
- metadata: date, time, tags, file, fileMetadata, inlineMetadata
- forceEditMode

**LaneData:**
- title, shouldMarkItemsComplete, maxItems, sorted

**Nestable (base):**
- id, type, accepts, children[], data

**BoardData:**
- isSearching, settings, frontmatter, archive[], errors[]

---

## 4. COMPONENT PATTERNS

### Location: src/components/
**Subdirectories:** Item/, Lane/, Table/, Editor/, Icon/, MarkdownRenderer/

### Hooks
- stateManager.useState() - board state
- stateManager.useSetting(key) - specific setting
- view.useViewState(key) - view state
- Preact hooks: useState, useMemo, useCallback, useContext

### Memoization
- memo() for Item, Lane, Items components
- Prevents re-renders when parent changes but props same

### Context API
- **KanbanContext:** stateManager, boardModifiers, view
- **SearchContext:** query, items, lanes, search function
- **SortContext:** LaneSort value
- **IntersectionObserverContext:** Scroll observer management

### CSS: BEM in src/styles.less
- Base class: kanban-plugin
- Pattern: .kanban-plugin__element
- Obsidian CSS variables for theming

---

## 5. DRAG-AND-DROP SYSTEM

### Custom Implementation (no third-party library)
Precise control over Obsidian's window/viewport handling

### Manager Classes
- **DndManager:** Orchestrator, ResizeObserver
- **DragManager:** Mouse/touch interaction
- **EntityManager:** Entity registration
- **ScrollManager:** Auto-scroll during drag
- **SortManager:** Sorting operations
- **ScrollStateManager:** Scroll position tracking

### Entity System
- getPath() returns [boardIdx, laneIdx, itemIdx]
- getHitbox() returns [minX, minY, maxX, maxY]
- scopeId (window), entityId (UUID)

### Component Integration
- DndContext win={window} onDrop={handler}
- Droppable - drop targets
- Draggable - draggable elements
- DragOverlay - renders dragged clone

### Operations
- moveEntity() - move source to destination
- insertEntity() - insert at position
- removeEntity() - delete
- updateEntity() - update data
- getEntityFromPath() - navigate by path

---

## 6. SETTINGS SYSTEM

### Global (Plugin-level)
- File: src/Settings.ts
- 30+ settings in KanbanSettings
- Stored in plugin data

### Board-level
- YAML frontmatter or settings JSON footer
- Override global settings
- Per-board customization

### View-level (Ephemeral)
- Obsidian workspace.json storage
- Collapsed lanes, table widths, scroll position
- NOT persisted to file

### Hierarchy
1. View-specific (workspace.json)
2. Board-level (file frontmatter)
3. Global (plugin)
4. Defaults

### StateManager.compileSettings()
- Merge all levels
- Apply defaults
- Compute derived settings
- Broadcast via settingsNotifiers

---

## 7. INTERNATIONALIZATION

**File:** src/lang/helpers.ts  
**Pattern:** t('key') returns translation or English fallback  
**Languages:** 20+ (English, Spanish, French, German, Italian, Japanese, Chinese, Korean, Russian, Polish, Czech, Dutch, Norwegian, Danish, Arabic, Hindi, Indonesian, Romanian, Turkish, Albanian, Ukrainian)  
**Structure:** src/lang/locale/{lang}.ts

---

## 8. KEY CONVENTIONS

### Import Paths
- Absolute: import { X } from 'src/...' (cross-directory)
- Relative: import { X } from './X' (same directory)

### Type Organization
- types.ts at directory root
- Utilities in helpers.ts
- Implementation in feature files

### State Updates: immutability-helper
- Library: immutability-helper (NOT Immer)
- Pattern: update(oldState, { path: { dollar-set: value } })
- Operations: dollar-set, dollar-push, dollar-unshift, dollar-splice, dollar-merge

### Component Naming
- PascalCase: Item.tsx, ItemCheckbox.tsx (components)
- kebab-case: list.ts, board-modifiers.ts (utilities)

### Error Handling
- Errors in board.data.errors[]
- Prevents saving if errors exist
- stateManager.hasError()
- User can switch to markdown view to fix

---

## 9. EXISTING AI CONFIG FILES

**NONE FOUND.** This is the first copilot-instructions.md.

Checked for: .cursorrules, .cursor/rules/, CLAUDE.md, .windsurfrules, CONVENTIONS.md, AIDER_CONVENTIONS.md, .clinerules, .cline_rules, AGENTS.md

---

## 10. DOCUMENTATION & RESOURCES

### README.md
- Brief overview, links to docs
- Note: Looking for new maintainers

### MAINTAINERS.md
- Code quality needs improvement
- Complexity: LLMs may struggle with parsing/DnD
- Should code WITHOUT LLMs to reduce bugs
- Respect the community, don't impose changes

### ANALYSIS.md
- Pre-existing analysis of parsers & state management
- Detailed parsing flow

### Online
- https://publish.obsidian.md/kanban/ - User docs
- https://github.com/mgmeyers/obsidian-kanban/issues
- GitHub projects/1 - Roadmap

---

## 11. IMPORTANT DEVELOPMENT NOTES

### Performance
- Use memo() for item/lane components
- Only subscribe to needed settings
- Search results debounced
- PreviewCache for markdown

### Multi-Window Support
- WindowRegistry per window
- StateManager per file (shared)
- DnD system per window

### File I/O Safety
- Obsidian's requestSave() API
- Prevents save if errors
- Maintains last-good-data

### Browser Compatibility
- ES2018 target
- ResizeObserver, IntersectionObserver
- window.activeWindow for timers

### Pitfalls
- Don't mutate objects, use update()
- Careful with hook dependencies
- Path: [boardIdx, laneIdx, itemIdx]
- Window reference for multi-window

---

## 12. CODE PATTERNS

### Creating Item
dollar-dollar-dollar typescript
const item = stateManager.getNewItem('text', 'x', true);
dollar-dollar-dollar

### Moving Item
dollar-dollar-dollar typescript
const updated = moveEntity(state, sourcePath, destPath);
stateManager.setState(updated);
dollar-dollar-dollar

### Accessing Setting
dollar-dollar-dollar typescript
const setting = stateManager.getSetting('date-format');
const compiled = stateManager.compiledSettings['date-format'];
const reactive = stateManager.useSetting('date-format');
dollar-dollar-dollar

### Rendering with Context
dollar-dollar-dollar typescript
const c = useContext(KanbanContext);
const board = stateManager.useState();
dollar-dollar-dollar

### Persisting Changes
dollar-dollar-dollar typescript
stateManager.setState(updated, true);  // true = save
stateManager.setState(updated, false); // false = state only
stateManager.saveToDisk();
dollar-dollar-dollar

---

## Quick Reference: Key Files

| File | Purpose |
|------|---------|
| src/main.ts | Plugin entry point |
| src/StateManager.ts | State management |
| src/KanbanView.tsx | Obsidian integration |
| src/DragDropApp.tsx | Root component |
| src/components/Kanban.tsx | Board UI |
| src/parsers/parseMarkdown.ts | Markdown parsing |
| src/parsers/formats/list.ts | Board structure |
| src/parsers/helpers/hydrateBoard.ts | Data enrichment |
| src/dnd/managers/DndManager.ts | DnD system |
| src/components/context.ts | Context definitions |
| src/Settings.ts | Settings UI |
| src/styles.less | Styling |

---

**NOTE:** Replace dollar-dollar-dollar with three backticks and dollar-set with dollar followed by 'set'
