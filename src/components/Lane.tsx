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
import { Item, Lane } from "./types";
import { c, generateTempId } from "./helpers";
import { draggableItemFactory, ItemContent } from "./Item";

export interface DraggableLaneFactoryParams {
  lanes: Lane[];
  isGhost?: boolean;
  addItemToLane: (item: Item, laneId: string) => void;
}

interface AddItemButtonProps {
  addItem: (item: Item) => void;
}

function AddItemButton({ addItem }: AddItemButtonProps) {
  const [isInputVisible, setIsInputVisible] = React.useState(false);

  if (isInputVisible) {
    return (
      <>
        <input
          className={c("item-input")}
          type="text"
          placeholder="Item title..."
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              const item: Item = {
                id: generateTempId(),
                title: (e.target as HTMLInputElement).value,
              };

              (e.target as HTMLInputElement).value = "";

              addItem(item);
            }
          }}
        />
        <button className={c("close-button")} onClick={() => setIsInputVisible(false)}>X</button>
      </>
    );
  } else {
    return <button className={c("new-item-button")} onClick={() => setIsInputVisible(true)}>+ New Item</button>;
  }
}

export function draggableLaneFactory({
  lanes,
  isGhost,
  addItemToLane,
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
        <div
          className={c("lane-header")}
          data-is-dragging={snapshot.isDragging}
          {...provided.dragHandleProps}
          aria-label="Drag Lane"
        >
          {lane.title}
        </div>
        <div className={c("item-input-wrapper")}>
          <AddItemButton
            addItem={(item: Item) => addItemToLane(item, lane.id)}
          />
        </div>
        {content}
      </div>
    );
  };
}
