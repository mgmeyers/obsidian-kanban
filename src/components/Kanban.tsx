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
import { c, baseClassName, reorderList, generateTempId } from "./helpers";
import { draggableLaneFactory } from "./Lane";

interface KanbanProps {
  dataBridge: DataBridge;
}

const DEMO_BOARD: Board = {
  lanes: [
    {
      id: "staging",
      title: "Staging",
      description: "This is staging",
      items: [
        {
          id: "some-item",
          title: "Some Item",
          description: "This is an item",
        },
        {
          id: "some-item-2",
          title: "Another Item",
          description: "This is another item",
        },
      ],
    },
    {
      id: "whoever",
      title: "Doing",
      description: "This is doing",
      items: [
        {
          id: "some-item-doing",
          title: "Some Item being done",
          description: "This is an item being done",
        },
        {
          id: "some-item-doing-2",
          title: "Another Item being done",
          description: "This is another item being done",
        },
      ],
    },
  ],
};

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

    const lanes = [...boardData.lanes];
    const sourceLaneIndex = lanes.findIndex(
      (lane) => lane.id === source.droppableId
    );
    const destinationLaneIndex = lanes.findIndex(
      (lane) => lane.id === destination.droppableId
    );
    const item = lanes[sourceLaneIndex].items[source.index];

    const sourceItems = [...lanes[sourceLaneIndex].items];
    const destinationItems = [...lanes[destinationLaneIndex].items];

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
  const [boardData, setBoardData] = React.useState<Board | null>(props.dataBridge.data);

  React.useEffect(() => {
    props.dataBridge.onExternalSet((data) => {
      setBoardData(data);
    });
  }, []);

  React.useEffect(() => {
    if (boardData !== null) {
      props.dataBridge.setInternal(boardData)
    }
  }, [boardData])

  if (boardData === null) return null;

  const addItemToLane = (item: Item, laneId: string) => {
    const lanes = [...boardData.lanes];
    const laneIndex = lanes.findIndex((lane) => lane.id === laneId);

    lanes[laneIndex] = {
      ...lanes[laneIndex],
      items: [item, ...lanes[laneIndex].items],
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
    console.log('todo')
  }

  const deleteLane = () => {
    console.log('todo')
  }

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
          {(provided: DroppableProvided) => (
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
              <div className={c("lane-input-wrapper")}>
                <input
                  className={c("lane-input")}
                  type="text"
                  placeholder="lane title..."
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      const newLane: Lane = {
                        id: generateTempId(),
                        title: (e.target as HTMLInputElement).value,
                        items: [],
                      };

                      (e.target as HTMLInputElement).value = "";

                      addLane(newLane);
                    }
                  }}
                />
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};
