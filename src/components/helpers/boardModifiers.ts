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

export interface BoardModifiers {
  addItemsToLane: (laneIndex: number, items: Item[]) => void;
  addLane: (lane: Lane) => void;
  archiveItem: (laneIndex: number, itemIndex: number, item: Item) => void;
  archiveLane: (laneIndex: number) => void;
  archiveLaneItems: (laneIndex: number) => void;
  deleteItem: (laneIndex: number, itemIndex: number) => void;
  deleteLane: (laneIndex: number) => void;
  duplicateItem: (laneIndex: number, itemIndex: number) => void;
  updateItem: (laneIndex: number, itemIndex: number, item: Item) => void;
  updateLane: (laneIndex: number, lane: Lane) => void;
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

    newTitle.push(item.titleRaw);

    const titleRaw = newTitle.join(" ");
    return view.parser.updateItem(item, titleRaw);
  };

  return {
    addItemsToLane: (laneIndex: number, items: Item[]) => {
      items.forEach((item) =>
        view.app.workspace.trigger("kanban:card-added", view.file, item)
      );

      setBoardData((boardData) =>
        update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $push: items,
              },
            },
          },
        })
      );
    },

    addLane: (lane: Lane) => {
      view.app.workspace.trigger("kanban:lane-added", view.file, lane);

      setBoardData((boardData) =>
        update(boardData, {
          lanes: {
            $push: [lane],
          },
        })
      );
    },

    updateLane: (laneIndex: number, lane: Lane) => {
      view.app.workspace.trigger("kanban:lane-updated", view.file, lane);

      setBoardData((boardData) =>
        update(boardData, {
          lanes: {
            [laneIndex]: {
              $set: lane,
            },
          },
        })
      );
    },

    deleteLane: (laneIndex: number) => {
      setBoardData((boardData) => {
        view.app.workspace.trigger(
          "kanban:lane-deleted",
          view.file,
          boardData.lanes[laneIndex]
        );

        return update(boardData, {
          lanes: {
            $splice: [[laneIndex, 1]],
          },
        });
      });
    },

    archiveLane: (laneIndex: number) => {
      setBoardData((boardData) => {
        view.app.workspace.trigger(
          "kanban:lane-archived",
          view.file,
          boardData.lanes[laneIndex]
        );

        const items = boardData.lanes[laneIndex].items;

        return update(boardData, {
          lanes: {
            $splice: [[laneIndex, 1]],
          },
          archive: {
            $push: shouldAppendArchiveDate
              ? items.map(appendArchiveDate)
              : items,
          },
        });
      });
    },

    archiveLaneItems: (laneIndex: number) => {
      setBoardData((boardData) => {
        const items = boardData.lanes[laneIndex].items;
        view.app.workspace.trigger(
          "kanban:lane-cards-archived",
          view.file,
          items
        );

        return update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $set: [],
              },
            },
          },
          archive: {
            $push: shouldAppendArchiveDate
              ? items.map(appendArchiveDate)
              : items,
          },
        });
      });
    },

    deleteItem: (laneIndex: number, itemIndex: number) => {
      setBoardData((boardData) => {
        view.app.workspace.trigger(
          "kanban:card-deleted",
          view.file,
          boardData.lanes[laneIndex].items[itemIndex]
        );

        return update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $splice: [[itemIndex, 1]],
              },
            },
          },
        });
      });
    },

    updateItem: (laneIndex: number, itemIndex: number, item: Item) => {
      setBoardData((boardData) => {
        view.app.workspace.trigger(
          "kanban:card-updated",
          view.file,
          boardData.lanes[laneIndex],
          item
        );

        return update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                [itemIndex]: {
                  $set: item,
                },
              },
            },
          },
        });
      });
    },

    archiveItem: (laneIndex: number, itemIndex: number, item: Item) => {
      setBoardData((boardData) => {
        view.app.workspace.trigger(
          "kanban:card-archived",
          view.file,
          boardData.lanes[laneIndex],
          item
        );

        return update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $splice: [[itemIndex, 1]],
              },
            },
          },
          archive: {
            $push: [shouldAppendArchiveDate ? appendArchiveDate(item) : item],
          },
        });
      });
    },

    duplicateItem: (laneIndex: number, itemIndex: number) => {
      setBoardData((boardData) => {
        view.app.workspace.trigger(
          "kanban:card-duplicated",
          view.file,
          boardData.lanes[laneIndex],
          itemIndex
        );

        const itemWithNewID = update(
          boardData.lanes[laneIndex].items[itemIndex],
          {
            id: {
              $set: generateInstanceId(),
            },
          }
        );

        return update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $splice: [[itemIndex, 0, itemWithNewID]],
              },
            },
          },
        });
      });
    },
  };
}