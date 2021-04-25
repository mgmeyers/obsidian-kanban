import React from "react";
import update from "immutability-helper";
import { DropResult } from "react-beautiful-dnd";
import { Board, Item, Lane } from "./types";

export const baseClassName = "kanban-plugin";

export function c(className: string) {
  return `${baseClassName}__${className}`;
}

export function generateInstanceId(): string {
  return Math.random().toString(36).substr(2, 9);
}

interface ReorderListParams<T> {
  list: T[];
  startIndex: number;
  endIndex: number;
}

export function reorderList<T>({
  list,
  startIndex,
  endIndex,
}: ReorderListParams<T>) {
  const clone = list.slice();
  const [removed] = clone.splice(startIndex, 1);
  clone.splice(endIndex, 0, removed);

  return clone;
}

export interface BoardDropMutationParams {
  boardData: Board;
  dropResult: DropResult;
}

export function swapLanes({ boardData, dropResult }: BoardDropMutationParams) {
  return update(boardData, {
    lanes: (lanes) =>
      reorderList<Lane>({
        list: lanes,
        startIndex: dropResult.source.index,
        endIndex: dropResult.destination.index,
      }),
  });
}

export function swapItems({ boardData, dropResult }: BoardDropMutationParams) {
  const laneIndex = boardData.lanes.findIndex(
    (lane) => lane.id === dropResult.source.droppableId
  );

  return update(boardData, {
    lanes: {
      [laneIndex]: {
        items: (items) =>
          reorderList<Item>({
            list: items,
            startIndex: dropResult.source.index,
            endIndex: dropResult.destination.index,
          }),
      },
    },
  });
}

export function moveItem({ boardData, dropResult }: BoardDropMutationParams) {
  const { lanes } = boardData;

  const sourceLaneIndex = lanes.findIndex(
    (lane) => lane.id === dropResult.source.droppableId
  );
  const destinationLaneIndex = lanes.findIndex(
    (lane) => lane.id === dropResult.destination.droppableId
  );

  const shouldMarkAsComplete = !!lanes[destinationLaneIndex].data
    .shouldMarkItemsComplete;

  let item = lanes[sourceLaneIndex].items[dropResult.source.index];

  if (shouldMarkAsComplete !== item.data.isComplete) {
    item = update(item, {
      data: {
        isComplete: {
          $set: shouldMarkAsComplete,
        },
      },
    });
  }

  return update(boardData, {
    lanes: {
      [sourceLaneIndex]: {
        items: {
          $splice: [[dropResult.source.index, 1]],
        },
      },
      [destinationLaneIndex]: {
        items: {
          $splice: [[dropResult.destination.index, 0, item]],
        },
      },
    },
  });
}

export function useIMEInputProps() {
  const isComposingRef = React.useRef<boolean>(false);

  return {
    onCompositionStart: () => {
      isComposingRef.current = true;
    },
    onCompositionEnd: () => {
      isComposingRef.current = false;
    },
    getShouldIMEBlockAction: () => {
      return isComposingRef.current;
    },
  };
}
