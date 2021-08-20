import { moment } from "obsidian";
import update from "immutability-helper";
import React from "react";
import { Board, Item, Lane } from "../types";
import {
  getDefaultDateFormat,
  getDefaultTimeFormat,
  generateInstanceId,
} from "../helpers";
import { Path } from "src/dnd/types";
import {
  appendEntities,
  getEntityFromPath,
  insertEntity,
  removeEntity,
  updateEntity,
} from "src/dnd/util/data";
import { StateManager } from "src/StateManager";

export interface BoardModifiers {
  addItems: (path: Path, items: Item[]) => void;
  addLane: (lane: Lane) => void;
  updateLane: (path: Path, lane: Lane) => void;
  archiveLane: (path: Path) => void;
  archiveLaneItems: (path: Path) => void;
  deleteEntity: (path: Path) => void;
  updateItem: (path: Path, item: Item) => void;
  archiveItem: (path: Path) => void;
  duplicateEntity: (path: Path) => void;
}

interface BoardStateProps {
  stateManager: StateManager;
  setBoardData: React.Dispatch<React.SetStateAction<Board>>;
}

export function getBoardModifiers({
  stateManager,
  setBoardData,
}: BoardStateProps): BoardModifiers {
  const shouldAppendArchiveDate = !!stateManager.getSetting(
    "prepend-archive-date"
  );
  const archiveDateSeparator = stateManager.getSetting("prepend-archive-separator");
  const archiveDateFormat = stateManager.getSetting("prepend-archive-format");

  const appendArchiveDate = (item: Item) => {
    const newTitle = [moment().format(archiveDateFormat)];

    if (archiveDateSeparator) newTitle.push(archiveDateSeparator);

    newTitle.push(item.data.titleRaw);

    const titleRaw = newTitle.join(" ");
    return stateManager.parser.updateItem(item, titleRaw);
  };

  return {
    addItems: (parentPath: Path, items: Item[]) => {
      items.forEach((item) =>
        stateManager.app.workspace.trigger(
          "kanban:card-added",
          stateManager.file,
          item
        )
      );

      setBoardData((boardData) => appendEntities(boardData, parentPath, items));
    },

    addLane: (lane: Lane) => {
      stateManager.app.workspace.trigger(
        "kanban:lane-added",
        stateManager.file,
        lane
      );

      setBoardData((boardData) => appendEntities(boardData, [], [lane]));
    },

    updateLane: (path: Path, lane: Lane) => {
      stateManager.app.workspace.trigger(
        "kanban:lane-updated",
        stateManager.file,
        lane
      );

      setBoardData((boardData) =>
        updateEntity(boardData, path.slice(0, -1), {
          children: {
            [path[path.length - 1]]: {
              $set: lane,
            },
          },
        })
      );
    },

    archiveLane: (path: Path) => {
      setBoardData((boardData) => {
        const lane = getEntityFromPath(boardData, path);
        const items = lane.children;

        stateManager.app.workspace.trigger(
          "kanban:lane-archived",
          stateManager.file,
          lane
        );

        return update(removeEntity(boardData, path), {
          data: {
            archive: {
              $push: shouldAppendArchiveDate
                ? items.map(appendArchiveDate)
                : items,
            },
          },
        });
      });
    },

    archiveLaneItems: (path: Path) => {
      setBoardData((boardData) => {
        const lane = getEntityFromPath(boardData, path);
        const items = lane.children;

        stateManager.app.workspace.trigger(
          "kanban:lane-cards-archived",
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
                $push: shouldAppendArchiveDate
                  ? items.map(appendArchiveDate)
                  : items,
              },
            },
          }
        );
      });
    },

    deleteEntity: (path: Path) => {
      setBoardData((boardData) => {
        const entity = getEntityFromPath(boardData, path);

        console.log("deleteEntity", ...path, entity);

        stateManager.app.workspace.trigger(
          `kanban:${entity.type}-deleted`,
          stateManager.file,
          entity
        );

        return removeEntity(boardData, path);
      });
    },

    updateItem: (path: Path, item: Item) => {
      setBoardData((boardData) => {
        const oldItem = getEntityFromPath(boardData, path);

        stateManager.app.workspace.trigger(
          "kanban:card-updated",
          stateManager.file,
          oldItem,
          item
        );

        return updateEntity(boardData, path.slice(0, -1), {
          children: {
            [path[path.length - 1]]: {
              $set: item,
            },
          },
        });
      });
    },

    archiveItem: (path: Path) => {
      setBoardData((boardData) => {
        const item = getEntityFromPath(boardData, path);

        stateManager.app.workspace.trigger(
          "kanban:card-archived",
          stateManager.file,
          path,
          item
        );

        return update(removeEntity(boardData, path), {
          data: {
            archive: {
              $push: [shouldAppendArchiveDate ? appendArchiveDate(item) : item],
            },
          },
        });
      });
    },

    duplicateEntity: (path: Path) => {
      setBoardData((boardData) => {
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
