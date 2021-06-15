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
import { DraggableItem, GhostItem } from "../Item/Item";
import { ItemForm } from "../Item/ItemForm";
import { LaneHeader } from "./LaneHeader";
import { ObsidianContext } from "../context";

export interface DraggableLaneProps {
  lane: Lane;
  laneIndex: number;
  isGhost?: boolean;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
}

interface LaneItemsProps {
  isGhost?: boolean;
  items: Item[];
  laneId: string;
  laneIndex: number;
  shouldMarkItemsComplete: boolean;
}

function LaneItems({
  isGhost,
  items,
  laneId,
  laneIndex,
  shouldMarkItemsComplete,
}: LaneItemsProps) {

  const renderItem = React.useCallback((
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => (
    <DraggableItem
      item={items[rubric.source.index]}
      itemIndex={rubric.source.index}
      laneIndex={laneIndex}
      shouldMarkItemsComplete={shouldMarkItemsComplete}
      provided={provided} snapshot={snapshot}
    />
  ), [laneIndex, items, shouldMarkItemsComplete]);

  if (isGhost) {
    return (
      <div className={c("lane-items")}>
        {items.map((item, i) => {
          return (
            <GhostItem
              item={item}
              key={item.id}
              shouldMarkItemsComplete={shouldMarkItemsComplete}
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

export function DraggableLane({
  lane,
  laneIndex,
  isGhost,
  provided,
  snapshot,
}: DraggableLaneProps) {
    const { view, boardModifiers } = React.useContext(ObsidianContext);
    const shouldMarkItemsComplete = !!lane.data.shouldMarkItemsComplete;
    const laneWidth = view.getSetting("lane-width");

    const settingStyles = laneWidth ? { width: `${laneWidth}px` } : undefined;
    const style = {
      ...provided.draggableProps.style,
      ...settingStyles,
    };

    const classList = [c("lane")];

    if (snapshot.isDragging) {
      classList.push("is-dragging");
    }

    return (
      <div
        className={classList.join(" ")}
        ref={provided.innerRef}
        {...provided.draggableProps}
        style={style}
      >
        <LaneHeader
          dragHandleProps={provided.dragHandleProps}
          laneIndex={laneIndex}
          lane={lane}
        />
        <LaneItems
          laneId={lane.id}
          items={lane.items}
          laneIndex={laneIndex}
          isGhost={isGhost}
          shouldMarkItemsComplete={shouldMarkItemsComplete}
        />
        <ItemForm
          addItems={(items: Item[]) => {
            boardModifiers.addItemsToLane(
              laneIndex,
              items.map((item) =>
                update(item, {
                  data: {
                    isComplete: {
                      // Mark the item complete if we're moving into a completed lane
                      $set: !!lane.data.shouldMarkItemsComplete,
                    },
                  },
                })
              )
            );
          }}
        />
      </div>
    );
}
