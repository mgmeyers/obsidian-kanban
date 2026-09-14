# obsidian-kanban (fork: dukaci, branch feat/cross-board-transfer)

Fork of community-archive/obsidian-kanban 2.0.51 plus one commit (aa7b2c0):
cross-board card transfer. This is the ONLY copy of that source.

## Deploy target

    ~/OneDrive/Administration/Notes/Obsidian/General/.obsidian/plugins/obsidian-kanban/

OneDrive syncs it to albus-dw. Copy `main.js` and `styles.css` after a build.
Reload the plugin in Obsidian (Settings > Community plugins, toggle) to load it.

## Build

    npm install        # yarn is not installed; npm works with yarn.lock present
    npm run build      # esbuild production -> main.js, styles.css in repo root
    npm run typecheck

Verified 2026-09-14: build output matches the installed plugin (styles.css
byte-identical; main.js differs only by npm vs yarn dependency resolution).

## The feature (aa7b2c0)

Three parts, all in one commit:

1. Board switcher: a 52 px strip of tiles at the left of every board, one per
   Kanban file. Click = open that board. Double-click = rename the tile label
   (stored in settings `board-switcher-labels`). Drag a card onto a tile =
   move it to that board. Setting `show-board-switcher`.
   File: src/components/BoardSwitcher/BoardSwitcher.tsx
2. "Send to board" in the card right-click menu: pick board, then column.
   Setting `show-send-to-board`. File: src/components/Item/ItemMenu.ts
3. Placing mode: after a cross-board send the card follows the cursor
   (`placing-card`), crosshair over lanes, click a lane to drop it.
   File: src/components/Kanban.tsx

Glue: src/Settings.ts (two toggles), src/main.ts, src/StateManager.ts,
src/DragDropApp.tsx, src/styles.less.

## Known problem

The user reports the transfer "does not do it well". Specific failure not yet
described. Ask which part: tile drop, menu, or placing mode.
