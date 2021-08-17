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
import { useRefSetter } from "src/dnd/util/useRefSetter";

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
  const { view, boardModifiers } = React.useContext(KanbanContext);

  const laneParentPath = useNestedEntityPath();
  const laneWidth = view.getSetting("lane-width");
  const shouldMarkItemsComplete = !!lane.data.shouldMarkItemsComplete;

  const laneStyles = laneWidth ? { width: `${laneWidth}px` } : undefined;

  const elementRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [dragHandleRef, setDragHandleRef] = useRefSetter<HTMLDivElement>(null);

  useDragHandle(measureRef, dragHandleRef);

  const addItems = React.useCallback(
    (items: Item[]) => {
      boardModifiers.addItems(
        [...laneParentPath, laneIndex],
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
    },
    [boardModifiers, laneParentPath, laneIndex, shouldMarkItemsComplete]
  );

  const classList = [c("lane-wrapper")];

  if (isStatic) {
    classList.push("is-dragging");
  }

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
        <Sortable axis="vertical">{laneContent}</Sortable>
      )}
    </ScrollContainer>
  );

  return (
    <div ref={measureRef} className={classcat(classList)} style={laneStyles}>
      <div ref={elementRef} className={c("lane")}>
        <LaneHeader
          setDragHandleRef={setDragHandleRef}
          laneIndex={laneIndex}
          lane={lane}
        />

        <div className={c("lane-items")}>
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
  isStatic?: boolean;
}

export function Lanes({ lanes, isStatic }: Lanes) {
  return (
    <>
      {lanes.map((lane, i) => {
        return (
          <DraggableLane
            lane={lane}
            laneIndex={i}
            key={lane.id}
            isStatic={isStatic}
          />
        );
      })}
    </>
  );
}
