import { MarkdownRenderer, Menu } from "obsidian";
import update from "immutability-helper";
import React from "react";
import {
  DraggableProvided,
  DraggableStateSnapshot,
  DraggableRubric,
} from "react-beautiful-dnd";

import { BoardModifiers, Item } from "../types";
import { c } from "../helpers";
import { Icon } from "../Icon/Icon";
import { KanbanContext, ObsidianContext } from "../context";
import { ItemContent } from "./ItemContent";

const illegalCharsRegEx = /[\\/:"*?<>|]+/g;

interface UseItemMenuParams {
  setIsEditing: React.Dispatch<boolean>;
  item: Item;
  laneIndex: number;
  itemIndex: number;
  boardModifiers: BoardModifiers;
}

export function useItemMenu({
  setIsEditing,
  item,
  laneIndex,
  itemIndex,
  boardModifiers,
}: UseItemMenuParams) {
  const { view } = React.useContext(ObsidianContext);

  return React.useMemo(() => {
    return new Menu(view.app)
      .addItem((i) => {
        i.setIcon("pencil")
          .setTitle("Edit card")
          .onClick(() => setIsEditing(true));
      })
      .addItem((i) => {
        i.setIcon("create-new")
          .setTitle("New note from card")
          .onClick(async () => {
            const sanitizedTitle = item.title.replace(illegalCharsRegEx, " ");
            const targetFolder = view.app.fileManager.getNewFileParent(
              view.file.parent.path
            );

            // @ts-ignore
            const newFile = await view.app.fileManager.createNewMarkdownFile(
              targetFolder,
              sanitizedTitle
            );
            const newLeaf = view.app.workspace.splitActiveLeaf();

            await newLeaf.openFile(newFile);

            view.app.workspace.setActiveLeaf(newLeaf, false, true);

            boardModifiers.updateItem(
              laneIndex,
              itemIndex,
              update(item, { title: { $set: `[[${sanitizedTitle}]]` } })
            );
          });
      })
      .addSeparator()
      .addItem((i) => {
        i.setIcon("sheets-in-box")
          .setTitle("Archive card")
          .onClick(() =>
            boardModifiers.archiveItem(laneIndex, itemIndex, item)
          );
      })
      .addItem((i) => {
        i.setIcon("trash")
          .setTitle("Delete card")
          .onClick(() => boardModifiers.deleteItem(laneIndex, itemIndex));
      });
  }, [view, setIsEditing, boardModifiers, laneIndex, itemIndex, item]);
}

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
    const { boardModifiers } = React.useContext(KanbanContext);
    const itemIndex = rubric.source.index;
    const item = items[itemIndex];
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
          <div className={c("item-edit-button-wrapper")}>
            {isEditing ? (
              <button
                onClick={() => {
                  setIsEditing(false);
                }}
                className={`${c("item-edit-button")} is-enabled`}
                aria-label="Cancel"
              >
                <Icon name="cross" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  settingsMenu.showAtPosition({ x: e.clientX, y: e.clientY });
                }}
                className={c("item-edit-button")}
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
