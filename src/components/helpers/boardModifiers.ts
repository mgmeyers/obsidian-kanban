import update from 'immutability-helper';
import { moment } from 'obsidian';

import { Path } from 'src/dnd/types';
import {
  appendEntities,
  getEntityFromPath,
  insertEntity,
  prependEntities,
  removeEntity,
  updateEntity,
  updateParentEntity,
} from 'src/dnd/util/data';
import { StateManager } from 'src/StateManager';

import { generateInstanceId } from '../helpers';
import { Item, Lane } from '../types';

export interface BoardModifiers {
  appendItems: (path: Path, items: Item[]) => void;
  prependItems: (path: Path, items: Item[]) => void;
  addLane: (lane: Lane) => void;
  updateLane: (path: Path, lane: Lane) => void;
  archiveLane: (path: Path) => void;
  archiveLaneItems: (path: Path) => void;
  deleteEntity: (path: Path) => void;
  updateItem: (path: Path, item: Item) => void;
  archiveItem: (path: Path) => void;
  duplicateEntity: (path: Path) => void;
}

export function getBoardModifiers(stateManager: StateManager): BoardModifiers {
  const appendArchiveDate = (item: Item) => {
    const archiveDateFormat = stateManager.getSetting('prepend-archive-format');
    const archiveDateSeparator = stateManager.getSetting(
      'prepend-archive-separator'
    );
    const newTitle = [moment().format(archiveDateFormat)];

    if (archiveDateSeparator) newTitle.push(archiveDateSeparator);

    newTitle.push(item.data.titleRaw);

    const titleRaw = newTitle.join(' ');
    return stateManager.parser.updateItem(item, titleRaw);
  };

  return {
    appendItems: (path: Path, items: Item[]) => {
      items.forEach((item) =>
        stateManager.app.workspace.trigger(
          'kanban:card-added',
          stateManager.file,
          item
        )
      );

      stateManager.setState((boardData) =>
        appendEntities(boardData, path, items)
      );
    },

    prependItems: (path: Path, items: Item[]) => {
      items.forEach((item) =>
        stateManager.app.workspace.trigger(
          'kanban:card-added',
          stateManager.file,
          item
        )
      );

      stateManager.setState((boardData) =>
        prependEntities(boardData, path, items)
      );
    },

    addLane: (lane: Lane) => {
      stateManager.app.workspace.trigger(
        'kanban:lane-added',
        stateManager.file,
        lane
      );

      stateManager.setState((boardData) =>
        appendEntities(boardData, [], [lane])
      );
    },

    updateLane: (path: Path, lane: Lane) => {
      stateManager.app.workspace.trigger(
        'kanban:lane-updated',
        stateManager.file,
        lane
      );

      stateManager.setState((boardData) =>
        updateParentEntity(boardData, path, {
          children: {
            [path[path.length - 1]]: {
              $set: lane,
            },
          },
        })
      );
    },

    archiveLane: (path: Path) => {
      stateManager.setState((boardData) => {
        const lane = getEntityFromPath(boardData, path);
        const items = lane.children;

        stateManager.app.workspace.trigger(
          'kanban:lane-archived',
          stateManager.file,
          lane
        );

        return update(removeEntity(boardData, path), {
          data: {
            archive: {
              $unshift: stateManager.getSetting('prepend-archive-date')
                ? items.map(appendArchiveDate)
                : items,
            },
          },
        });
      });
    },

    archiveLaneItems: (path: Path) => {
      stateManager.setState((boardData) => {
        const lane = getEntityFromPath(boardData, path);
        const items = lane.children;

        stateManager.app.workspace.trigger(
          'kanban:lane-cards-archived',
          stateManager.file,
          items
        );

        return update(
          updateEntity(boardData, path, {
            children: {
              $set: [],
            },
          }),
          {
            data: {
              archive: {
                $unshift: stateManager.getSetting('prepend-archive-date')
                  ? items.map(appendArchiveDate)
                  : items,
              },
            },
          }
        );
      });
    },

    deleteEntity: (path: Path) => {
      stateManager.setState((boardData) => {
        const entity = getEntityFromPath(boardData, path);

        stateManager.app.workspace.trigger(
          `kanban:${entity.type}-deleted`,
          stateManager.file,
          entity
        );

        return removeEntity(boardData, path);
      });
    },

    updateItem: (path: Path, item: Item) => {
      stateManager.setState((boardData) => {
        const oldItem = getEntityFromPath(boardData, path);

        stateManager.app.workspace.trigger(
          'kanban:card-updated',
          stateManager.file,
          oldItem,
          item
        );

        return updateParentEntity(boardData, path, {
          children: {
            [path[path.length - 1]]: {
              $set: item,
            },
          },
        });
      });
    },

    archiveItem: (path: Path) => {
      stateManager.setState((boardData) => {
        const item = getEntityFromPath(boardData, path);

        stateManager.app.workspace.trigger(
          'kanban:card-archived',
          stateManager.file,
          path,
          item
        );

        return update(removeEntity(boardData, path), {
          data: {
            archive: {
              $push: [
                stateManager.getSetting('prepend-archive-date')
                  ? appendArchiveDate(item)
                  : item,
              ],
            },
          },
        });
      });
    },

    duplicateEntity: (path: Path) => {
      stateManager.setState((boardData) => {
        const entity = getEntityFromPath(boardData, path);

        stateManager.app.workspace.trigger(
          `kanban:${entity.type}-duplicated`,
          stateManager.file,
          path,
          entity
        );

        const entityWithNewID = update(entity, {
          id: {
            $set: generateInstanceId(),
          },
        });

        return insertEntity(boardData, path, entityWithNewID);
      });
    },
  };
}
