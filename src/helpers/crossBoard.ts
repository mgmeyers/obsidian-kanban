import update from 'immutability-helper';
import { App, TFile } from 'obsidian';
import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import { removeEntity } from 'src/dnd/util/data';
import { t } from 'src/lang/helpers';
import KanbanPlugin from 'src/main';
import { completeString, frontmatterKey } from 'src/parsers/common';
import { indentNewLines } from 'src/parsers/helpers/parser';

import { Item } from '../components/types';

export function getBoardLabel(plugin: KanbanPlugin, file: TFile) {
  return plugin.settings['board-switcher-labels']?.[file.path] || file.basename;
}

export function getKanbanFiles(app: App, exclude?: string) {
  return app.vault
    .getMarkdownFiles()
    .filter((f) => {
      if (f.path === exclude) return false;
      const cache = app.metadataCache.getFileCache(f);
      return cache?.frontmatter && cache.frontmatter[frontmatterKey];
    })
    .sort((a, b) => a.basename.localeCompare(b.basename));
}

// Lane names of a board that may not be open, read from the metadata cache.
export function getLaneNames(app: App, file: TFile): string[] {
  const cache = app.metadataCache.getFileCache(file);
  return (cache?.headings || [])
    .filter((h) => h.level === 2 && h.heading !== t('Archive'))
    .map((h) => h.heading);
}

// Insert the item line at the top of lane `laneIdx` in raw markdown.
function insertIntoMarkdown(content: string, laneIdx: number, line: string) {
  const lines = content.split('\n');
  let lane = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^## (.+)$/);
    if (!m || m[1] === t('Archive')) continue;
    if (++lane !== laneIdx) continue;
    let ins = i + 1;
    while (ins < lines.length && lines[ins].trim() === '') ins++;
    if (lines[ins] === completeString) ins++;
    lines.splice(ins, 0, line);
    return lines.join('\n');
  }
  return null;
}

// Move an item from the current board to the top of a lane on another board.
// An open target board is updated through its StateManager; a closed one
// through its file.
export function sendItemToBoard(
  sourceSM: StateManager,
  sourcePath: Path,
  item: Item,
  targetFile: TFile,
  laneIdx: number
) {
  const plugin = sourceSM.getAView().plugin;
  const targetSM = plugin.stateManagers.get(targetFile);
  const { titleRaw, checkChar } = item.data;

  if (targetSM) {
    targetSM.setState((board) => {
      if (!board.children[laneIdx]) return board;
      return update(board, {
        children: {
          [laneIdx]: { children: { $unshift: [targetSM.getNewItem(titleRaw, checkChar)] } },
        },
      });
    });
  } else {
    const line = `- [${checkChar}] ${indentNewLines(titleRaw)}`;
    plugin.app.vault.read(targetFile).then((content) => {
      const next = insertIntoMarkdown(content, laneIdx, line);
      if (next !== null) plugin.app.vault.modify(targetFile, next);
    });
  }

  sourceSM.setState((board) => removeEntity(board, sourcePath));
}
