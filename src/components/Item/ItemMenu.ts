import { getLinkpath, Menu, TFolder } from "obsidian";
import update from "immutability-helper";
import React from "react";

import { BoardModifiers, Item } from "../types";
import { applyTemplate, escapeRegExpStr } from "../helpers";
import { ObsidianContext } from "../context";
import { processTitle } from "src/parser";
import { defaultDateTrigger, defaultTimeTrigger } from "src/settingHelpers";
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
  constructMenuTimePickerOnChange,
  constructTimePicker,
} from "./helpers";
import { t } from "src/lang/helpers";

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
    const coordinates = { x: 0, y: 0 };

    const hasDate = !!item.metadata.date;
    const hasTime = !!item.metadata.time;

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
            const prevTitle = item.title;
            const sanitizedTitle = item.title.replace(illegalCharsRegEx, " ");

            const newNoteFolder = view.getSetting("new-note-folder");
            const newNoteTemplatePath = view.getSetting("new-note-template");

            const targetFolder = newNoteFolder
              ? (view.app.vault.getAbstractFileByPath(
                  newNoteFolder as string
                ) as TFolder)
              : view.app.fileManager.getNewFileParent(view.file.path);

            // @ts-ignore
            const newFile = await view.app.fileManager.createNewMarkdownFile(
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

            const newTitleRaw = item.titleRaw.replace(
              prevTitle,
              `[[${sanitizedTitle}]]`
            );
            const processed = processTitle(newTitleRaw, view);

            boardModifiers.updateItem(
              laneIndex,
              itemIndex,
              update(item, {
                title: { $set: processed.title },
                titleRaw: { $set: newTitleRaw },
                titleSearch: { $set: processed.titleSearch },
              })
            );
          });
      })
      .addSeparator()
      .addItem((i) => {
        i.setIcon("documents")
          .setTitle(t("Duplicate card"))
          .onClick(() => boardModifiers.duplicateItem(laneIndex, itemIndex));
      })
      .addItem((i) => {
        i.setIcon("sheets-in-box")
          .setTitle(t("Archive card"))
          .onClick(() =>
            boardModifiers.archiveItem(laneIndex, itemIndex, item)
          );
      })
      .addItem((i) => {
        i.setIcon("trash")
          .setTitle(t("Delete card"))
          .onClick(() => boardModifiers.deleteItem(laneIndex, itemIndex));
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
                laneIndex,
                itemIndex,
              }),
              item.metadata.date?.toDate()
            );
          });
      });

    if (hasDate) {
      menu.addItem((i) => {
        i.setIcon("cross")
          .setTitle(t("Remove date"))
          .onClick(() => {
            const shouldLinkDates = view.getSetting("link-date-to-daily-note");
            const dateTrigger =
              view.getSetting("date-trigger") || defaultDateTrigger;
            const contentMatch = shouldLinkDates
              ? "\\[\\[[^}]+\\]\\]"
              : "{[^}]+}";
            const dateRegEx = new RegExp(
              `(^|\\s)${escapeRegExpStr(dateTrigger as string)}${contentMatch}`
            );

            const titleRaw = item.titleRaw.replace(dateRegEx, "").trim();
            const processed = processTitle(titleRaw, view);

            boardModifiers.updateItem(
              laneIndex,
              itemIndex,
              update(item, {
                title: { $set: processed.title },
                titleRaw: { $set: titleRaw },
                titleSearch: { $set: processed.titleSearch },
                metadata: {
                  date: {
                    $set: processed.date,
                  },
                  time: {
                    $set: processed.time,
                  },
                  tags: {
                    $set: processed.tags,
                  },
                  file: {
                    $set: processed.file,
                  }
                },
              })
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
                laneIndex,
                itemIndex,
              }),
              item.metadata.time
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

              const titleRaw = item.titleRaw.replace(timeRegEx, "").trim();
              const processed = processTitle(titleRaw, view);

              boardModifiers.updateItem(
                laneIndex,
                itemIndex,
                update(item, {
                  title: { $set: processed.title },
                  titleRaw: { $set: titleRaw },
                  titleSearch: { $set: processed.titleSearch },
                  metadata: {
                    date: {
                      $set: processed.date,
                    },
                    time: {
                      $set: processed.time,
                    },
                    tags: {
                      $set: processed.tags,
                    },
                    file: {
                      $set: processed.file,
                    }
                  },
                })
              );
            });
        });
      }
    }

    return (e: MouseEvent, internalLinkPath?: string) => {
      coordinates.x = e.clientX;
      coordinates.y = e.clientY;

      if (internalLinkPath) {
        // @ts-ignore
        view.app.workspace.onLinkContextMenu(
          e,
          getLinkpath(internalLinkPath),
          view.file.path
        );
      } else {
        menu.showAtPosition(coordinates);
      }
    };
  }, [view, setIsEditing, boardModifiers, laneIndex, itemIndex, item]);
}
