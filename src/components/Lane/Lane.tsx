import React from "react";
import {
  Droppable,
  DroppableProvided,
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
  DraggableRubric,
  DroppableStateSnapshot,
} from "react-beautiful-dnd";
import { Item, Lane } from "../types";
import { c } from "../helpers";
import { draggableItemFactory, ItemContent } from "../Item/Item";
import { ItemForm } from "../Item/ItemForm";
import { LaneHeader } from "./LaneHeader";

export interface DraggableLaneFactoryParams {
  lanes: Lane[];
  isGhost?: boolean;
  addItemToLane: (laneIndex: number, item: Item) => void;
  updateLane: (laneIndex: number, lane: Lane) => void;
  deleteLane: (laneIndex: number) => void;
}

export function draggableLaneFactory({
  lanes,
  isGhost,
  addItemToLane,
  updateLane,
  deleteLane,
}: DraggableLaneFactoryParams) {
  return (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => {
    const lane = lanes[rubric.source.index];
    const renderItem = draggableItemFactory({ items: lane.items });

    const content = isGhost ? (
      <div className={c("lane-items")}>
        {lane.items.map((item, i) => {
          return (
            <div key={i} className={c("item")}>
              <ItemContent item={item} />
            </div>
          );
        })}
      </div>
    ) : (
      <Droppable droppableId={lane.id} type="ITEM" renderClone={renderItem}>
        {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
          <div
            data-is-dragging-over={snapshot.isDraggingOver}
            className={c("lane-items")}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {lane.items.map((item, i) => {
              return (
                <Draggable draggableId={item.id} key={item.id} index={i}>
                  {renderItem}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );

    return (
      <div
        className={c("lane")}
        data-is-dragging={snapshot.isDragging}
        ref={provided.innerRef}
        {...provided.draggableProps}
      >
        <LaneHeader
          dragHandleProps={provided.dragHandleProps}
          laneIndex={rubric.source.index}
          lane={lane}
          updateLane={updateLane}
          deleteLane={deleteLane}
        />
        {content}
        <ItemForm
          addItem={(item: Item) => addItemToLane(rubric.source.index, item)}
        />
      </div>
    );
  };
}
