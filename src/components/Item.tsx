import React from "react";
import {
  DraggableProvided,
  DraggableStateSnapshot,
  DraggableRubric,
} from "react-beautiful-dnd";
import { Item } from "./types";
import { c } from "./helpers";

export interface ItemContentProps {
  item: Item;
}

export function ItemContent({ item }: ItemContentProps) {
  return (
    <>
      <div className={c("item-header")}>{item.title}</div>
      {item.description && (
        <div className={c("item-description")}>{item.description}</div>
      )}
    </>
  );
}

export interface DraggableItemFactoryParams {
  items: Item[];
}

export function draggableItemFactory({ items }: DraggableItemFactoryParams) {
  return (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => {
    const item = items[rubric.source.index];

    return (
      <div
        className={c("item")}
        data-is-dragging={snapshot.isDragging}
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
      >
        <ItemContent item={item} />
      </div>
    );
  };
}
