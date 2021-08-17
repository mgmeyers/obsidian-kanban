import { moment } from "obsidian";
import update from "immutability-helper";
import React from "react";
import { Board, Item, Lane } from "../types";
import {
  getDefaultDateFormat,
  getDefaultTimeFormat,
  generateInstanceId,
} from "../helpers";
import { KanbanView } from "src/KanbanView";
import { Path } from "src/dnd/types";
import {
  appendEntities,
  getEntityFromPath,
  insertEntity,
  removeEntity,
  updateEntity,
} from "src/dnd/util/data";

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
  view: KanbanView;
  setBoardData: React.Dispatch<React.SetStateAction<Board>>;
}

export function getBoardModifiers({
  view,
  setBoardData,
}: BoardStateProps): BoardModifiers {
  const shouldAppendArchiveDate = !!view.getSetting("prepend-archive-date");
  const dateFmt =
    view.getSetting("date-format") || getDefaultDateFormat(view.app);
  const timeFmt =
    view.getSetting("time-format") || getDefaultTimeFormat(view.app);
  const archiveDateSeparator =
    (view.getSetting("prepend-archive-separator") as string) || "";
  const archiveDateFormat =
    (view.getSetting("prepend-archive-format") as string) ||
    `${dateFmt} ${timeFmt}`;

  const appendArchiveDate = (item: Item) => {
    const newTitle = [moment().format(archiveDateFormat)];

    if (archiveDateSeparator) newTitle.push(archiveDateSeparator);

    newTitle.push(item.data.titleRaw);

    const titleRaw = newTitle.join(" ");
    return view.parser.updateItem(item, titleRaw);
  };

  return {
    addItems: (parentPath: Path, items: Item[]) => {
      items.forEach((item) =>
        view.app.workspace.trigger("kanban:card-added", view.file, item)
      );

      setBoardData((boardData) => appendEntities(boardData, parentPath, items));
    },

    addLane: (lane: Lane) => {
      view.app.workspace.trigger("kanban:lane-added", view.file, lane);

      setBoardData((boardData) => appendEntities(boardData, [], [lane]));
    },

    updateLane: (path: Path, lane: Lane) => {
      view.app.workspace.trigger("kanban:lane-updated", view.file, lane);

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

        view.app.workspace.trigger("kanban:lane-archived", view.file, lane);

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

        view.app.workspace.trigger(
          "kanban:lane-cards-archived",
          view.file,
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

        view.app.workspace.trigger(
          `kanban:${entity.type}-deleted`,
          view.file,
          entity
        );

        return removeEntity(boardData, path);
      });
    },

    updateItem: (path: Path, item: Item) => {
      setBoardData((boardData) => {
        const oldItem = getEntityFromPath(boardData, path);

        view.app.workspace.trigger(
          "kanban:card-updated",
          view.file,
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

        view.app.workspace.trigger(
          "kanban:card-archived",
          view.file,
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

        view.app.workspace.trigger(
          `kanban:${entity.type}-duplicated`,
          view.file,
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
