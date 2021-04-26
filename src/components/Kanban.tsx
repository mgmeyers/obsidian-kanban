import update from "immutability-helper";
import React, { useCallback } from "react";
import { DataBridge } from "../DataBridge";
import {
  DragDropContext,
  Droppable,
  DroppableProvided,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import { Board, BoardModifiers, Item, Lane } from "./types";
import {
  c,
  baseClassName,
  BoardDropMutationParams,
  swapLanes,
  swapItems,
  moveItem,
} from "./helpers";
import { draggableLaneFactory, DraggableLaneFactoryParams } from "./Lane/Lane";
import { LaneForm } from "./Lane/LaneForm";
import { KanbanContext, ObsidianContext } from "./context";
import { KanbanView } from "src/KanbanView";

interface KanbanProps {
  dataBridge: DataBridge;
  filePath?: string;
  view: KanbanView;
}

interface BoardStateProps {
  boardData: Board;
  setBoardData: React.Dispatch<Board>;
}

export function getBoardDragHandler({
  boardData,
  setBoardData,
}: BoardStateProps) {
  return (dropResult: DropResult) => {
    const { source, destination } = dropResult;

    // Bail out early if we're not dropping anywhere
    if (
      !destination ||
      (source.droppableId === destination.droppableId &&
        source.index === destination.index)
    ) {
      return;
    }

    const mutationParams: BoardDropMutationParams = {
      boardData,
      dropResult,
    };

    // Swap lanes
    if (dropResult.type === "LANE") {
      setBoardData(swapLanes(mutationParams));
      return;
    }

    // Swap items within a lane
    if (source.droppableId === destination.droppableId) {
      setBoardData(swapItems(mutationParams));
      return;
    }

    // Move item from one lane to another
    setBoardData(moveItem(mutationParams));
  };
}

function getBoardModifiers({
  boardData,
  setBoardData,
}: BoardStateProps): BoardModifiers {
  return {
    addItemToLane: (laneIndex: number, item: Item) => {
      setBoardData(
        update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $push: [item],
              },
            },
          },
        })
      );
    },

    addLane: (lane: Lane) => {
      setBoardData(
        update(boardData, {
          lanes: {
            $push: [lane],
          },
        })
      );
    },

    updateLane: (laneIndex: number, lane: Lane) => {
      setBoardData(
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
      setBoardData(
        update(boardData, {
          lanes: {
            $splice: [[laneIndex, 1]],
          },
        })
      );
    },

    archiveLane: (laneIndex: number) => {
      const items = boardData.lanes[laneIndex].items;

      setBoardData(
        update(boardData, {
          lanes: {
            $splice: [[laneIndex, 1]],
          },
          archive: {
            $push: items,
          },
        })
      );
    },

    archiveLaneItems: (laneIndex: number) => {
      const items = boardData.lanes[laneIndex].items;

      setBoardData(
        update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $set: [],
              },
            },
          },
          archive: {
            $push: items,
          },
        })
      );
    },

    deleteItem: (laneIndex: number, itemIndex: number) => {
      setBoardData(
        update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $splice: [[itemIndex, 1]],
              },
            },
          },
        })
      );
    },

    updateItem: (laneIndex: number, itemIndex: number, item: Item) => {
      setBoardData(
        update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                [itemIndex]: {
                  $set: item,
                },
              },
            },
          },
        })
      );
    },

    archiveItem: (laneIndex: number, itemIndex: number, item: Item) => {
      setBoardData(
        update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $splice: [[itemIndex, 1]],
              },
            },
          },
          archive: {
            $push: [item],
          },
        })
      );
    },
  };
}

export const Kanban = ({ filePath, view, dataBridge }: KanbanProps) => {
  const [boardData, setBoardData] = React.useState<Board | null>(
    dataBridge.data
  );

  React.useEffect(() => {
    dataBridge.onExternalSet((data) => {
      setBoardData(data);
    });
  }, []);

  React.useEffect(() => {
    if (boardData !== null) {
      dataBridge.setInternal(boardData);
    }
  }, [boardData]);

  const boardModifiers = React.useMemo(() => {
    return getBoardModifiers({ boardData, setBoardData });
  }, [boardData, setBoardData]);

  const onDragEnd = React.useMemo(() => {
    return getBoardDragHandler({ boardData, setBoardData });
  }, [boardData, setBoardData]);

  if (boardData === null) return null;

  const renderLane = draggableLaneFactory({
    lanes: boardData.lanes,
  });

  const renderLaneGhost = draggableLaneFactory({
    lanes: boardData.lanes,
    isGhost: true,
  });

  const renderLanes = (provided: DroppableProvided) => (
    <div
      className={c("board")}
      ref={provided.innerRef}
      {...provided.droppableProps}
    >
      {boardData.lanes.map((lane, i) => {
        return (
          <Draggable draggableId={lane.id} key={lane.id} index={i}>
            {renderLane}
          </Draggable>
        );
      })}
      {provided.placeholder}
      <LaneForm />
    </div>
  );

  const onMouseOver = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const targetEl = e.target as HTMLElement;

      if (targetEl.tagName !== "A") return;

      if (targetEl.hasClass("internal-link")) {
        view.app.workspace.trigger("hover-link", {
          event: e.nativeEvent,
          source: "kanban-plugin",
          hoverParent: view,
          targetEl,
          linktext: targetEl.getAttr("href"),
          sourcePath: view.file.path,
        });
      }
    },
    [view]
  );

  const onClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const targetEl = e.target as HTMLElement;

      if (targetEl.tagName !== "A") return;

      // Open an internal link in a new pane
      if (targetEl.hasClass("internal-link")) {
        e.preventDefault();

        view.app.workspace.openLinkText(
          targetEl.getAttr("href"),
          filePath,
          true
        );

        return;
      }

      // Open a tag search
      if (targetEl.hasClass("tag")) {
        e.preventDefault();

        (view.app as any).internalPlugins
          .getPluginById("global-search")
          .instance.openGlobalSearch(`tag:${targetEl.getAttr("href")}`);

        return;
      }

      // Open external link
      if (targetEl.hasClass("external-link")) {
        e.preventDefault();
        window.open(targetEl.getAttr("href"), "_blank");
      }
    },
    [view, filePath]
  );

  return (
    <ObsidianContext.Provider value={{ filePath, view }}>
      <KanbanContext.Provider value={{ boardModifiers, board: boardData }}>
        <div
          className={baseClassName}
          onMouseOver={onMouseOver}
          onClick={onClick}
        >
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable
              droppableId="board"
              type="LANE"
              direction="horizontal"
              ignoreContainerClipping={false}
              renderClone={renderLaneGhost}
            >
              {renderLanes}
            </Droppable>
          </DragDropContext>
        </div>
      </KanbanContext.Provider>
    </ObsidianContext.Provider>
  );
};
