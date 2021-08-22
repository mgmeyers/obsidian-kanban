import update from "immutability-helper";
import React from "react";

import { DataTypes, Item, Lane } from "../types";
import { c } from "../helpers";
import { Items } from "../Item/Item";
import { ItemForm } from "../Item/ItemForm";
import { LaneHeader } from "./LaneHeader";
import { KanbanContext } from "../context";
import { useDragHandle } from "src/dnd/managers/DragManager";
import { Droppable, useNestedEntityPath } from "src/dnd/components/Droppable";
import classcat from "classcat";
import { SortPlaceholder } from "src/dnd/components/SortPlaceholder";
import { Sortable } from "src/dnd/components/Sortable";
import { ScrollContainer } from "src/dnd/components/ScrollContainer";

const laneAccepts = [DataTypes.Item];

export interface DraggableLaneProps {
  lane: Lane;
  laneIndex: number;
  isStatic?: boolean;
}

export const DraggableLane = React.memo(function DraggableLane(
  props: DraggableLaneProps
) {
  const { isStatic, lane, laneIndex } = props;
  const { stateManager, boardModifiers } = React.useContext(KanbanContext);

  const path = useNestedEntityPath(laneIndex);
  const laneWidth = stateManager.getSetting("lane-width");
  const shouldMarkItemsComplete = !!lane.data.shouldMarkItemsComplete;

  const laneStyles = laneWidth ? { width: `${laneWidth}px` } : undefined;

  const elementRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const dragHandleRef = React.useRef<HTMLDivElement>(null);
  const [isSorting, setIsSorting] = React.useState(false);

  useDragHandle(measureRef, dragHandleRef);

  const addItems = (items: Item[]) => {
    boardModifiers.addItems(
      [...path, lane.children.length - 1],
      items.map((item) =>
        update(item, {
          data: {
            isComplete: {
              // Mark the item complete if we're moving into a completed lane
              $set: shouldMarkItemsComplete,
            },
          },
        })
      )
    );
  };

  const laneContent = (
    <>
      <Items
        items={lane.children}
        isStatic={isStatic}
        shouldMarkItemsComplete={shouldMarkItemsComplete}
      />
      {!isStatic && (
        <SortPlaceholder accepts={laneAccepts} index={lane.children.length} />
      )}
    </>
  );

  const laneBody = (
    <ScrollContainer
      id={lane.id}
      index={laneIndex}
      className={classcat([c("lane-items"), c("vertical")])}
      triggerTypes={laneAccepts}
      isStatic={isStatic}
    >
      {isStatic ? (
        laneContent
      ) : (
        <Sortable onSortChange={setIsSorting} axis="vertical">
          {laneContent}
        </Sortable>
      )}
    </ScrollContainer>
  );

  return (
    <div
      ref={measureRef}
      className={classcat([
        c("lane-wrapper"),
        {
          "is-dragging": isStatic,
          "is-sorting": isSorting,
        },
      ])}
      style={laneStyles}
    >
      <div ref={elementRef} className={c("lane")}>
        <LaneHeader
          dragHandleRef={dragHandleRef}
          laneIndex={laneIndex}
          lane={lane}
        />

        <div className={c("lane-items-wrapper")}>
          {props.isStatic ? (
            laneBody
          ) : (
            <Droppable
              elementRef={elementRef}
              measureRef={measureRef}
              id={props.lane.id}
              index={props.laneIndex}
              data={props.lane}
            >
              {laneBody}
            </Droppable>
          )}
        </div>

        <ItemForm addItems={addItems} />
      </div>
    </div>
  );
});

export interface Lanes {
  lanes: Lane[];
}

export const Lanes = React.memo(function Lanes({ lanes }: Lanes) {
  return (
    <>
      {lanes.map((lane, i) => {
        return <DraggableLane lane={lane} laneIndex={i} key={lane.id} />;
      })}
    </>
  );
});
