import { compare } from 'fast-json-patch';
import { JSONPatchDocument, immutableJSONPatch } from 'immutable-json-patch';

import { Board, Item } from 'src/components/types';
import { StateManager } from 'src/StateManager';

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

  newItem(content: string, isComplete?: boolean) {
    return newItem(this.stateManager, content, isComplete);
  }

  updateItemContent(item: Item, content: string) {
    return updateItemContent(this.stateManager, item, content);
  }

  boardToMd(board: Board) {
    return boardToMd(board);
  }

  mdToBoard(md: string) {
    const { ast, settings } = parseMarkdown(this.stateManager, md);

    const newBoard = astToUnhydratedBoard(this.stateManager, settings, ast, md);

    if (this.stateManager.state) {
      const ops = compare(this.stateManager.state, newBoard);
      const filtered = ops.filter((op) =>
        ['/id', '/dom', '/date', '/time', '/titleSearch', '/file'].every(
          (postFix) => !op.path.endsWith(postFix)
        )
      );

      const patchedBoard = immutableJSONPatch(
        this.stateManager.state,
        filtered as JSONPatchDocument
      ) as Board;

      return hydratePostOp(this.stateManager, patchedBoard, filtered);
    }

    return hydrateBoard(this.stateManager, newBoard);
  }

  reparseBoard() {
    return reparseBoard(this.stateManager, this.stateManager.state);
  }
}
