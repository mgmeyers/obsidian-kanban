import { getLinkpath, Menu, TFolder } from "obsidian";
import React from "react";

import { Item } from "../types";
import { applyTemplate, escapeRegExpStr } from "../helpers";
import { defaultDateTrigger, defaultTimeTrigger } from "src/settingHelpers";
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
  constructMenuTimePickerOnChange,
  constructTimePicker,
} from "./helpers";
import { t } from "src/lang/helpers";
import { KanbanView } from "src/KanbanView";
import { BoardModifiers } from "../helpers/boardModifiers";
import { Path } from "src/dnd/types";

const illegalCharsRegEx = /[\\/:"*?<>|]+/g;

interface UseItemMenuParams {
  setIsEditing: React.Dispatch<boolean>;
  item: Item;
  path: Path;
  boardModifiers: BoardModifiers;
  view: KanbanView;
}

export function useItemMenu({
  setIsEditing,
  item,
  path,
  boardModifiers,
  view,
}: UseItemMenuParams) {
  return React.useCallback(
    (e: MouseEvent, internalLinkPath?: string) => {
      if (internalLinkPath) {
        // @ts-ignore
        view.app.workspace.onLinkContextMenu(
          e,
          getLinkpath(internalLinkPath),
          view.file.path
        );
      } else {
        const coordinates = { x: e.clientX, y: e.clientY };
        const hasDate = !!item.data.metadata.date;
        const hasTime = !!item.data.metadata.time;

        const menu = new Menu(view.app).addItem((i) => {
          i.setIcon("pencil")
            .setTitle(t("Edit card"))
            .onClick(() => setIsEditing(true));
        });

        menu
          .addItem((i) => {
            i.setIcon("create-new")
              .setTitle(t("New note from card"))
              .onClick(async () => {
                const prevTitle = item.data.title;
                const sanitizedTitle = item.data.title.replace(
                  illegalCharsRegEx,
                  " "
                );

                const newNoteFolder = view.getSetting("new-note-folder");
                const newNoteTemplatePath =
                  view.getSetting("new-note-template");

                const targetFolder = newNoteFolder
                  ? (view.app.vault.getAbstractFileByPath(
                      newNoteFolder as string
                    ) as TFolder)
                  : view.app.fileManager.getNewFileParent(view.file.path);

                const newFile =
                  // @ts-ignore
                  await view.app.fileManager.createNewMarkdownFile(
                    targetFolder,
                    sanitizedTitle
                  );

                const newLeaf = view.app.workspace.splitActiveLeaf();

                await newLeaf.openFile(newFile);

                view.app.workspace.setActiveLeaf(newLeaf, false, true);

                await applyTemplate(
                  view,
                  newNoteTemplatePath as string | undefined
                );

                const newTitleRaw = item.data.titleRaw.replace(
                  prevTitle,
                  `[[${sanitizedTitle}]]`
                );

                boardModifiers.updateItem(
                  path,
                  view.parser.updateItem(item, newTitleRaw)
                );
              });
          })
          .addSeparator()
          .addItem((i) => {
            i.setIcon("documents")
              .setTitle(t("Duplicate card"))
              .onClick(() => boardModifiers.duplicateEntity(path));
          })
          .addItem((i) => {
            i.setIcon("sheets-in-box")
              .setTitle(t("Archive card"))
              .onClick(() => boardModifiers.archiveItem(path));
          })
          .addItem((i) => {
            i.setIcon("trash")
              .setTitle(t("Delete card"))
              .onClick(() => boardModifiers.deleteEntity(path));
          })
          .addSeparator()
          .addItem((i) => {
            i.setIcon("calendar-with-checkmark")
              .setTitle(hasDate ? t("Edit date") : t("Add date"))
              .onClick(() => {
                constructDatePicker(
                  coordinates,
                  constructMenuDatePickerOnChange({
                    view,
                    boardModifiers,
                    item,
                    hasDate,
                    path,
                  }),
                  item.data.metadata.date?.toDate()
                );
              });
          });

        if (hasDate) {
          menu.addItem((i) => {
            i.setIcon("cross")
              .setTitle(t("Remove date"))
              .onClick(() => {
                const shouldLinkDates = view.getSetting(
                  "link-date-to-daily-note"
                );
                const dateTrigger =
                  view.getSetting("date-trigger") || defaultDateTrigger;
                const contentMatch = shouldLinkDates
                  ? "\\[\\[[^}]+\\]\\]"
                  : "{[^}]+}";
                const dateRegEx = new RegExp(
                  `(^|\\s)${escapeRegExpStr(
                    dateTrigger as string
                  )}${contentMatch}`
                );

                const titleRaw = item.data.titleRaw
                  .replace(dateRegEx, "")
                  .trim();
                boardModifiers.updateItem(
                  path,
                  view.parser.updateItem(item, titleRaw)
                );
              });
          });

          menu.addItem((i) => {
            i.setIcon("clock")
              .setTitle(hasTime ? t("Edit time") : t("Add time"))
              .onClick(() => {
                constructTimePicker(
                  view,
                  coordinates,
                  constructMenuTimePickerOnChange({
                    view,
                    boardModifiers,
                    item,
                    hasTime,
                    path,
                  }),
                  item.data.metadata.time
                );
              });
          });

          if (hasTime) {
            menu.addItem((i) => {
              i.setIcon("cross")
                .setTitle(t("Remove time"))
                .onClick(() => {
                  const timeTrigger =
                    view.getSetting("time-trigger") || defaultTimeTrigger;
                  const timeRegEx = new RegExp(
                    `(^|\\s)${escapeRegExpStr(timeTrigger as string)}{([^}]+)}`
                  );

                  const titleRaw = item.data.titleRaw
                    .replace(timeRegEx, "")
                    .trim();
                  boardModifiers.updateItem(
                    path,
                    view.parser.updateItem(item, titleRaw)
                  );
                });
            });
          }
        }

        menu.showAtPosition(coordinates);
      }
    },
    [setIsEditing, item, path, boardModifiers, view]
  );
}
