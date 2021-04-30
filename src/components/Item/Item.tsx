import { Menu, TFolder } from "obsidian";
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
import { KanbanContext } from "../context";
import { ItemContent } from "./ItemContent";
import { useItemMenu } from "./ItemMenu";

export interface DraggableItemFactoryParams {
  items: Item[];
  laneIndex: number;
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
    const itemIndex = rubric.source.index;
    const item = items[itemIndex];
    const lane = board.lanes[laneIndex];
    const [isEditing, setIsEditing] = React.useState(false);

    const settingsMenu = useItemMenu({
      setIsEditing,
      item,
      laneIndex,
      itemIndex,
      boardModifiers,
    });

    return (
      <div
        className={`${c("item")} ${snapshot.isDragging ? "is-dragging" : ""}`}
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
            onChange={(e) =>
              boardModifiers.updateItem(
                laneIndex,
                itemIndex,
                update(item, { title: { $set: e.target.value } })
              )
            }
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
                  settingsMenu.showAtPosition({ x: e.clientX, y: e.clientY });
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
