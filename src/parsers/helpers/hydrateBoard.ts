import { Operation } from 'fast-json-patch';
import { moment } from 'obsidian';

import { Board, DataTypes, Item, Lane } from 'src/components/types';
import { Path } from 'src/dnd/types';
import { getEntityFromPath } from 'src/dnd/util/data';
import { renderMarkdown } from 'src/helpers/renderMarkdown';
import { StateManager } from 'src/StateManager';

import { getSearchValue } from '../common';

export async function hydrateLane(stateManager: StateManager, lane: Lane) {
  const laneTitleDom = await renderMarkdown(
    stateManager.getAView(),
    lane.data.title
  );

  lane.data.dom = laneTitleDom;

  return lane;
}

export async function hydrateItem(stateManager: StateManager, item: Item) {
  const itemTitleDom = await renderMarkdown(
    stateManager.getAView(),
    item.data.title
  );

  item.data.dom = itemTitleDom;
  item.data.titleSearch = getSearchValue(
    itemTitleDom,
    item.data.metadata.tags,
    item.data.metadata.fileMetadata
  );

  const { dateStr, timeStr, fileAccessor } = item.data.metadata;

  if (dateStr) {
    item.data.metadata.date = moment(
      dateStr,
      stateManager.getSetting('date-format')
    );
  }

  if (timeStr) {
    let time = moment(timeStr, stateManager.getSetting('time-format'));

    if (item.data.metadata.date) {
      const date = item.data.metadata.date;

      date.hour(time.hour());
      date.minute(time.minute());

      time = date.clone();
    }

    item.data.metadata.time = time;
  }

  if (fileAccessor) {
    const file = stateManager.app.metadataCache.getFirstLinkpathDest(
      fileAccessor.target,
      stateManager.file.path
    );

    if (file) {
      item.data.metadata.file = file;
    }
  }

  return item;
}

export async function hydrateBoard(
  stateManager: StateManager,
  board: Board
): Promise<Board> {
  await Promise.all(
    board.children.map(async (lane) => {
      await hydrateLane(stateManager, lane);
      await Promise.all(
        lane.children.map(async (item) => {
          await hydrateItem(stateManager, item);
        })
      );
    })
  );

  return board;
}

function opAffectsHydration(op: Operation) {
  return (
    (op.op === 'add' || op.op === 'replace') &&
    [
      '/title',
      '/titleRaw',
      '/dateStr',
      '/timeStr',
      /\d$/,
      /\/fileAccessor\/.+$/,
    ].some((postFix) => {
      if (typeof postFix === 'string') {
        return op.path.endsWith(postFix);
      } else {
        return postFix.test(op.path);
      }
    })
  );
}

export async function hydratePostOp(
  stateManager: StateManager,
  board: Board,
  ops: Operation[]
): Promise<Board> {
  const seen: Record<string, boolean> = {};
  const toHydrate = ops.reduce((paths, op) => {
    if (!opAffectsHydration(op)) {
      return paths;
    }

    const path = op.path.split('/').reduce((path, segment) => {
      if (/\d+/.test(segment)) {
        path.push(Number(segment));
      }

      return path;
    }, [] as Path);

    const key = path.join(',');

    if (!seen[key]) {
      seen[key] = true;
      paths.push(path);
    }

    return paths;
  }, [] as Path[]);

  await Promise.all(
    toHydrate.map(async (path) => {
      const entity = getEntityFromPath(board, path);

      if (entity.type === DataTypes.Lane) {
        return await hydrateLane(stateManager, entity);
      }

      if (entity.type === DataTypes.Item) {
        return await hydrateItem(stateManager, entity);
      }
    })
  );

  return board;
}
