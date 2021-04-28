import { Menu, TFolder } from "obsidian";
import update from "immutability-helper";
import React from "react";

import { BoardModifiers, Item } from "../types";
import { applyTemplate } from "../helpers";
import { ObsidianContext } from "../context";

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

            const newNoteFolder = view.getSetting("new-note-folder");
            const newNoteTemplatePath = view.getSetting("new-note-template");

            const targetFolder = newNoteFolder
              ? (view.app.vault.getAbstractFileByPath(newNoteFolder as string) as TFolder)
              : view.app.fileManager.getNewFileParent(view.file.parent.path);

            // @ts-ignore
            const newFile = await view.app.fileManager.createNewMarkdownFile(
              targetFolder,
              sanitizedTitle
            );

            const newLeaf = view.app.workspace.splitActiveLeaf();

            await newLeaf.openFile(newFile);

            view.app.workspace.setActiveLeaf(newLeaf, false, true);

            await applyTemplate(view, newNoteTemplatePath as string | undefined);

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
