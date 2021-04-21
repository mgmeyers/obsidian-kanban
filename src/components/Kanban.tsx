import update from "immutability-helper";
import React from "react";
import { DataBridge } from "../DataBridge";
import {
  DragDropContext,
  Droppable,
  DroppableProvided,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import { Board, Item, Lane } from "./types";
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

interface KanbanProps {
  dataBridge: DataBridge;
}

interface CreateBoardDragHandlerParams {
  boardData: Board;
  setBoardData: React.Dispatch<Board>;
}

export function createBoardDragHandler({
  boardData,
  setBoardData,
}: CreateBoardDragHandlerParams) {
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

export const Kanban = (props: KanbanProps) => {
  const [boardData, setBoardData] = React.useState<Board | null>(
    props.dataBridge.data
  );

  React.useEffect(() => {
    props.dataBridge.onExternalSet((data) => {
      setBoardData(data);
    });
  }, []);

  React.useEffect(() => {
    if (boardData !== null) {
      props.dataBridge.setInternal(boardData);
    }
  }, [boardData]);

  if (boardData === null) return null;

  const addItemToLane = (laneIndex: number, item: Item) => {
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
  };

  const addLane = (lane: Lane) => {
    setBoardData(
      update(boardData, {
        lanes: {
          $push: [lane],
        },
      })
    );
  };

  const updateLane = (laneIndex: number, lane: Lane) => {
    setBoardData(
      update(boardData, {
        lanes: {
          [laneIndex]: {
            $set: lane,
          },
        },
      })
    );
  };

  const deleteLane = (laneIndex: number) => {
    setBoardData(
      update(boardData, {
        lanes: {
          $splice: [[laneIndex, 1]],
        },
      })
    );
  };

  const deleteItem = (laneIndex: number, itemIndex: number) => {
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
  };

  const updateItem = (laneIndex: number, itemIndex: number, item: Item) => {
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
  };

  const archiveItem = (laneIndex: number, itemIndex: number, item: Item) => {
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
  };

  const onDragEnd = createBoardDragHandler({ boardData, setBoardData });

  const laneFactoryParams: DraggableLaneFactoryParams = {
    lanes: boardData.lanes,
    addItemToLane,
    updateLane,
    deleteLane,
    updateItem,
    deleteItem,
    archiveItem,
  };

  const renderLane = draggableLaneFactory(laneFactoryParams);
  const renderLaneGhost = draggableLaneFactory({
    ...laneFactoryParams,
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
      <LaneForm addLane={addLane} />
    </div>
  );

  return (
    <div className={baseClassName}>
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
  );
};
