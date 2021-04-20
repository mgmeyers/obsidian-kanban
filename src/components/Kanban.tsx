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
import { c, baseClassName, reorderList } from "./helpers";
import { draggableLaneFactory } from "./Lane";
import { LaneForm } from './LaneForm';

interface KanbanProps {
  dataBridge: DataBridge;
}

interface CreateOnDragEndParams {
  boardData: Board;
  setBoardData: React.Dispatch<Board>;
}

function createOnDragEnd({ boardData, setBoardData }: CreateOnDragEndParams) {
  return (data: DropResult) => {
    const { source, destination } = data;

    // Bail out early if we're not dropping anywhere
    if (
      !destination ||
      (source.droppableId === destination.droppableId &&
        source.index === destination.index)
    ) {
      return;
    }

    // Swap lanes
    if (data.type === "LANE") {
      return setBoardData({
        ...boardData,
        lanes: reorderList<Lane>(
          boardData.lanes,
          source.index,
          destination.index
        ),
      });
    }

    // Swap items within a lane
    if (source.droppableId === destination.droppableId) {
      const lanes = [...boardData.lanes];
      const laneIndex = lanes.findIndex(
        (lane) => lane.id === source.droppableId
      );

      lanes[laneIndex] = {
        ...lanes[laneIndex],
        items: reorderList<Item>(
          lanes[laneIndex].items,
          source.index,
          destination.index
        ),
      };

      return setBoardData({
        ...boardData,
        lanes,
      });
    }

    // Move items from one lane to another
    const lanes = boardData.lanes.slice();
    const sourceLaneIndex = lanes.findIndex(
      (lane) => lane.id === source.droppableId
    );
    const destinationLaneIndex = lanes.findIndex(
      (lane) => lane.id === destination.droppableId
    );
    
    const sourceItems = lanes[sourceLaneIndex].items.slice();
    const destinationItems = lanes[destinationLaneIndex].items.slice();

    const item: Item = { 
      ...lanes[sourceLaneIndex].items[source.index],
      data: {
        ...lanes[sourceLaneIndex].items[source.index].data,
        isComplete: !!lanes[destinationLaneIndex].data.shouldMarkItemsComplete
      }
    };

    sourceItems.splice(source.index, 1);
    destinationItems.splice(destination.index, 0, item);

    lanes[sourceLaneIndex] = {
      ...lanes[sourceLaneIndex],
      items: sourceItems,
    };

    lanes[destinationLaneIndex] = {
      ...lanes[destinationLaneIndex],
      items: destinationItems,
    };

    setBoardData({
      ...boardData,
      lanes,
    });
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

  const addItemToLane = (item: Item, laneId: string) => {
    const lanes = boardData.lanes.slice();
    const laneIndex = lanes.findIndex((lane) => lane.id === laneId);

    lanes[laneIndex] = {
      ...lanes[laneIndex],
      items: [...lanes[laneIndex].items, item],
    };

    setBoardData({
      ...boardData,
      lanes,
    });
  };

  const addLane = (lane: Lane) => {
    setBoardData({
      ...boardData,
      lanes: [...boardData.lanes, lane],
    });
  };

  const deleteItem = () => {
    console.log("todo");
  };

  const deleteLane = () => {
    console.log("todo");
  };

  const onDragEnd = createOnDragEnd({ boardData, setBoardData });
  const renderLane = draggableLaneFactory({
    lanes: boardData.lanes,
    addItemToLane,
  });
  const renderLaneGhost = draggableLaneFactory({
    lanes: boardData.lanes,
    isGhost: true,
    addItemToLane,
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
  )

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
