import { compare } from 'fast-json-patch';
import { JSONPatchDocument, immutableJSONPatch } from 'immutable-json-patch';
import { moment } from 'obsidian';
import { TFile } from 'obsidian';
import { StateManager } from 'src/StateManager';
import { Board, Item } from 'src/components/types';

import { BaseFormat } from './common';
import {
  astToUnhydratedBoard,
  boardToMd,
  newItem,
  reparseBoard,
  updateItemContent,
} from './formats/list';
import { hydrateBoard, hydratePostOp } from './helpers/hydrateBoard';
import { parseMarkdown } from './parseMarkdown';

export class ListFormat implements BaseFormat {
  stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  newItem(content: string, isComplete?: boolean, forceEdit?: boolean) {
    return newItem(this.stateManager, content, isComplete, forceEdit);
  }

  updateItemContent(item: Item, content: string) {
    return updateItemContent(this.stateManager, item, content);
  }

  boardToMd(board: Board) {
    return boardToMd(board);
  }

  mdToBoard(md: string) {
    const { ast, settings, frontmatter } = parseMarkdown(this.stateManager, md);
    const newBoard = astToUnhydratedBoard(this.stateManager, settings, frontmatter, ast, md);
    const { state } = this.stateManager;

    if (!this.stateManager.hasError() && state) {
      const ops = compare(state, newBoard);
      const filtered = ops.filter((op) => {
        const path = op.path.split('/');

        if (['id', 'dom', 'date', 'time', 'titleSearch', 'file'].includes(path.last())) {
          return false;
        }

        let obj: any = state;
        for (const p of path) {
          if (!p || !obj[p]) continue;
          obj = obj[p];

          if (typeof obj === 'function') return false;
          if (
            typeof obj === 'object' &&
            !Array.isArray(obj) &&
            !Object.prototype.isPrototypeOf.call(Object.getPrototypeOf(obj), Object)
          ) {
            return false;
          }
          if (obj instanceof TFile) return false;
          if (obj instanceof Date) return false;
          if (moment.isMoment(obj)) return false;
          if (obj.toMillis) return false;
        }

        return true;
      });

      const patchedBoard = immutableJSONPatch(state, filtered as JSONPatchDocument) as Board;

      return hydratePostOp(this.stateManager, patchedBoard, filtered);
    }

    return hydrateBoard(this.stateManager, newBoard);
  }

  reparseBoard() {
    return reparseBoard(this.stateManager, this.stateManager.state);
  }
}
