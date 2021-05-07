import { Menu, TFolder, moment, ButtonComponent } from "obsidian";
import update from "immutability-helper";
import React from "react";

import { BoardModifiers, Item } from "../types";
import {
  applyTemplate,
  c,
  escapeRegExpStr,
  getDefaultDateFormat,
} from "../helpers";
import { ObsidianContext } from "../context";
import flatpickr from "flatpickr";
import { processTitle } from "src/parser";
import { defaultDateTrigger } from "src/settingHelpers";
import { getDefaultLocale } from "./datePickerLocale";

const illegalCharsRegEx = /[\\/:"*?<>|]+/g;

interface UseItemMenuParams {
  setIsEditing: React.Dispatch<boolean>;
  item: Item;
  laneIndex: number;
  itemIndex: number;
  boardModifiers: BoardModifiers;
}

function constructDatePicker(
  coordinates: { x: number; y: number },
  onChange: (dates: Date[]) => void,
  date?: Date
) {
  return document.body.createDiv({ cls: c("date-picker") }, (div) => {
    div.style.left = `${coordinates.x || 0}px`;
    div.style.top = `${coordinates.y || 0}px`;

    div.createEl("input", { type: "text" }, (input) => {
      setTimeout(() => {
        let picker: flatpickr.Instance | null = null;

        const clickHandler = (e: MouseEvent) => {
          if (
            e.target instanceof HTMLElement &&
            e.target.closest(`.${c("date-picker")}`) === null
          ) {
            selfDestruct();
          }
        };

        const keyHandler = (e: KeyboardEvent) => {
          if (e.key === "Escape") {
            selfDestruct();
          }
        };

        const selfDestruct = () => {
          picker.destroy();
          div.remove();
          document.body.removeEventListener("click", clickHandler);
          document.removeEventListener("keydown", keyHandler);
        };

        picker = flatpickr(input, {
          locale: getDefaultLocale(),
          defaultDate: date,
          inline: true,
          onChange: (dates) => {
            onChange(dates);
            selfDestruct();
          },
        });

        document.body.addEventListener("click", clickHandler);
        document.addEventListener("keydown", keyHandler);
      });
    });
  });
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

    const menu = new Menu(view.app)
      .addItem((i) => {
        i.setIcon("pencil")
          .setTitle("Edit card")
          .onClick(() => setIsEditing(true));
      })
      .addItem((i) => {
        const hasDate = !!item.metadata.date;

        i.setIcon("calendar-with-checkmark")
          .setTitle(hasDate ? "Edit date" : "Add date")
          .onClick(() => {
            const dateFormat =
              view.getSetting("date-format") || getDefaultDateFormat(view.app);
            const shouldLinkDates = view.getSetting("link-date-to-daily-note");
            const dateTrigger =
              view.getSetting("date-trigger") || defaultDateTrigger;
            const contentMatch = shouldLinkDates
              ? "\\[\\[([^}]+)\\]\\]"
              : "{([^}]+)}";
            const dateRegEx = new RegExp(
              `(^|\\s)${escapeRegExpStr(dateTrigger as string)}${contentMatch}`
            );

            constructDatePicker(
              coordinates,
              (dates) => {
                const date = dates[0];
                const formattedDate = moment(date).format(dateFormat);
                const wrappedDate = shouldLinkDates
                  ? `[[${formattedDate}]]`
                  : `{${formattedDate}}`;

                let titleRaw = item.titleRaw;

                if (hasDate) {
                  titleRaw = item.titleRaw.replace(
                    dateRegEx,
                    `$1${dateTrigger}${wrappedDate}`
                  );
                } else {
                  titleRaw = `${item.titleRaw} ${dateTrigger}${wrappedDate}`;
                }

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
              },
              item.metadata.date?.toDate()
            );
          });
      })
      .addItem((i) => {
        i.setIcon("create-new")
          .setTitle("New note from card")
          .onClick(async () => {
            const sanitizedTitle = item.title.replace(illegalCharsRegEx, " ");

            const newNoteFolder = view.getSetting("new-note-folder");
            const newNoteTemplatePath = view.getSetting("new-note-template");

            const targetFolder = newNoteFolder
              ? (view.app.vault.getAbstractFileByPath(
                  newNoteFolder as string
                ) as TFolder)
              : view.app.fileManager.getNewFileParent(view.file.parent.path);

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

    return (e: MouseEvent) => {
      coordinates.x = e.clientX;
      coordinates.y = e.clientY;

      menu.showAtPosition(coordinates);
    };
  }, [view, setIsEditing, boardModifiers, laneIndex, itemIndex, item]);
}
