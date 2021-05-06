import update from "immutability-helper";
import React from "react";
import {
  DraggableProvided,
  DraggableStateSnapshot,
  DraggableRubric,
} from "react-beautiful-dnd";

import { Item } from "../types";
import { c } from "../helpers";
import { Icon } from "../Icon/Icon";
import { KanbanContext, ObsidianContext } from "../context";
import { ItemContent } from "./ItemContent";
import { useItemMenu } from "./ItemMenu";
import { processTitle } from "src/parser";

export interface DraggableItemFactoryParams {
  items: Item[];
  laneIndex: number;
}

interface GhostItemProps {
  shouldShowArchiveButton: boolean;
  item: Item;
}

export function GhostItem({ item, shouldShowArchiveButton }: GhostItemProps) {
  return (
    <div className={c("item")}>
      <div className={c("item-content-wrapper")}>
        {shouldShowArchiveButton && (
          <div className={c("item-prefix-button-wrapper")}>
            <button
              className={c("item-prefix-button")}
              aria-label="Archive item"
            >
              <Icon name="sheets-in-box" />
            </button>
          </div>
        )}
        <ItemContent isSettingsVisible={false} item={item} />
        <div className={c("item-postfix-button-wrapper")}>
          <button
            className={c("item-postfix-button")}
            aria-label="More options"
          >
            <Icon name="vertical-three-dots" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function draggableItemFactory({
  items,
  laneIndex,
}: DraggableItemFactoryParams) {
  return (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => {
    const { boardModifiers, board } = React.useContext(KanbanContext);
    const { view } = React.useContext(ObsidianContext);
    const itemIndex = rubric.source.index;
    const item = items[itemIndex];
    const lane = board.lanes[laneIndex];
    const [isEditing, setIsEditing] = React.useState(false);

    const date = item.metadata.date;
    const classModifiers: string[] = [];

    if (snapshot.isDragging) classModifiers.push("is-dragging");

    if (date) {
      if (date.isSame(new Date(), "day")) {
        classModifiers.push("is-today");
      }

      if (date.isAfter(new Date(), "day")) {
        classModifiers.push("is-future");
      }

      if (date.isBefore(new Date(), "day")) {
        classModifiers.push("is-past");
      }
    }

    const showMenu = useItemMenu({
      setIsEditing,
      item,
      laneIndex,
      itemIndex,
      boardModifiers,
    });

    return (
      <div
        className={`${c("item")} ${classModifiers.join(" ")}`}
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
      >
        <div className={c("item-content-wrapper")}>
          {lane.data.shouldMarkItemsComplete && (
            <div className={c("item-prefix-button-wrapper")}>
              <button
                onClick={() => {
                  boardModifiers.archiveItem(laneIndex, itemIndex, item);
                }}
                className={c("item-prefix-button")}
                aria-label="Archive item"
              >
                <Icon name="sheets-in-box" />
              </button>
            </div>
          )}
          <ItemContent
            isSettingsVisible={isEditing}
            setIsSettingsVisible={setIsEditing}
            item={item}
            onChange={(e) => {
              const titleRaw = e.target.value.replace(/[\r\n]+/g, " ");
              const processed = processTitle(titleRaw, view);

              boardModifiers.updateItem(
                laneIndex,
                itemIndex,
                update(item, {
                  title: { $set: processed.title },
                  titleRaw: { $set: titleRaw },
                  metadata: {
                    date: {
                      $set: processed.date,
                    },
                  },
                })
              );
            }}
          />
          <div className={c("item-postfix-button-wrapper")}>
            {isEditing ? (
              <button
                onClick={() => {
                  setIsEditing(false);
                }}
                className={`${c("item-postfix-button")} is-enabled`}
                aria-label="Cancel"
              >
                <Icon name="cross" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  showMenu(e.nativeEvent);
                }}
                className={c("item-postfix-button")}
                aria-label="More options"
              >
                <Icon name="vertical-three-dots" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };
}
