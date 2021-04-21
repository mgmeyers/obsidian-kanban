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
import { Icon } from "../Icon/Icon";

export interface DraggableLaneFactoryParams {
  lanes: Lane[];
  isGhost?: boolean;
  addItemToLane: (laneIndex: number, item: Item) => void;
  updateLane: (laneIndex: number, lane: Lane) => void;
  deleteLane: (laneIndex: number) => void;
  deleteItem: (laneIndex: number, itemIndex: number) => void;
  updateItem: (laneIndex: number, itemIndex: number, item: Item) => void;
  archiveItem: (laneIndex: number, itemIndex: number, item: Item) => void;
}

export function draggableLaneFactory({
  lanes,
  isGhost,
  addItemToLane,
  updateLane,
  deleteLane,
  updateItem,
  deleteItem,
  archiveItem,
}: DraggableLaneFactoryParams) {
  return (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => {
    const lane = lanes[rubric.source.index];
    const shouldShowArchiveButton = !!lane.data.shouldMarkItemsComplete
    
    const renderItem = draggableItemFactory({
      laneIndex: rubric.source.index,
      items: lane.items,
      updateItem,
      deleteItem,
      archiveItem,
      shouldShowArchiveButton,
    });

    const content = isGhost ? (
      <div className={c("lane-items")}>
        {lane.items.map((item, i) => {
          return (
            <div key={i} className={c("item")}>
              <div className={c("item-content-wrapper")}>
                <ItemContent isSettingsVisible={false} item={item} />
                <div className={c("item-edit-button-wrapper")}>
                  {shouldShowArchiveButton && <button className={`${c("item-edit-button")}`}>
                    <Icon name="sheets-in-box" />
                  </button>}
                  <button className={`${c("item-edit-button")}`}>
                    <Icon name="pencil" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <Droppable droppableId={lane.id} type="ITEM" renderClone={renderItem}>
        {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
          <div
            className={`${c("lane-items")} ${
              snapshot.isDraggingOver ? "is-dragging-over" : ""
            }`}
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
        className={`${c("lane")} ${snapshot.isDragging ? "is-dragging" : ""}`}
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
