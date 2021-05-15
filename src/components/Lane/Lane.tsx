import update from "immutability-helper";
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
import { draggableItemFactory, GhostItem } from "../Item/Item";
import { ItemForm } from "../Item/ItemForm";
import { LaneHeader } from "./LaneHeader";
import { KanbanContext, ObsidianContext } from "../context";

export interface DraggableLaneFactoryParams {
  lanes: Lane[];
  isGhost?: boolean;
}

interface LaneItemsProps {
  isGhost?: boolean;
  items: Item[];
  laneId: string;
  laneIndex: number;
  shouldShowArchiveButton: boolean;
}

function LaneItems({
  isGhost,
  items,
  laneId,
  laneIndex,
  shouldShowArchiveButton,
}: LaneItemsProps) {
  const renderItem = draggableItemFactory({
    laneIndex,
    items,
  });

  if (isGhost) {
    return (
      <div className={c("lane-items")}>
        {items.map((item, i) => {
          return (
            <GhostItem
              item={item}
              shouldShowArchiveButton={shouldShowArchiveButton}
            />
          );
        })}
      </div>
    );
  }

  return (
    <Droppable droppableId={laneId} type="ITEM" renderClone={renderItem}>
      {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
        <div
          className={`${c("lane-items")} ${
            snapshot.isDraggingOver ? "is-dragging-over" : ""
          }`}
          ref={provided.innerRef}
          {...provided.droppableProps}
        >
          {items.map((item, i) => {
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
}

export function draggableLaneFactory({
  lanes,
  isGhost,
}: DraggableLaneFactoryParams) {
  return (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => {
    const { boardModifiers } = React.useContext(KanbanContext);
    const { view } = React.useContext(ObsidianContext);
    const lane = lanes[rubric.source.index];
    const shouldShowArchiveButton = !!lane.data.shouldMarkItemsComplete;
    const laneWidth = view.getSetting("lane-width");

    const settingStyles = laneWidth ? { width: `${laneWidth}px` } : undefined;
    const style = {
      ...provided.draggableProps.style,
      ...settingStyles,
    };

    return (
      <div
        className={`${c("lane")} ${snapshot.isDragging ? "is-dragging" : ""}`}
        ref={provided.innerRef}
        {...provided.draggableProps}
        style={style}
      >
        <LaneHeader
          dragHandleProps={provided.dragHandleProps}
          laneIndex={rubric.source.index}
          lane={lane}
        />
        <LaneItems
          laneId={lane.id}
          items={lane.items}
          laneIndex={rubric.source.index}
          isGhost={isGhost}
          shouldShowArchiveButton={shouldShowArchiveButton}
        />
        <ItemForm
          addItem={(item: Item) => {
            boardModifiers.addItemToLane(
              rubric.source.index,
              update(item, {
                data: {
                  isComplete: {
                    // Mark the item complete if we're moving into a completed lane
                    $set: !!lane.data.shouldMarkItemsComplete,
                  },
                },
              })
            );
          }}
        />
      </div>
    );
  };
}
