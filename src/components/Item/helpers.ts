import { moment, setIcon } from "obsidian";
import update from "immutability-helper";

import { BoardModifiers, Item } from "../types";
import {
  c,
  escapeRegExpStr,
  getDefaultDateFormat,
  getDefaultTimeFormat,
} from "../helpers";

import flatpickr from "flatpickr";
import { processTitle } from "src/parser";
import { defaultDateTrigger, defaultTimeTrigger } from "src/settingHelpers";
import { getDefaultLocale } from "./datePickerLocale";
import { KanbanView } from "src/KanbanView";

export function constructDatePicker(
  coordinates: { x: number; y: number },
  onChange: (dates: Date[]) => void,
  date?: Date
) {
  return document.body.createDiv(
    { cls: `${c("date-picker")} ${c("ignore-click-outside")}` },
    (div) => {
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

          setTimeout(() => {
            const height = div.clientHeight;
            const width = div.clientWidth;

            if (coordinates.y + height > window.innerHeight) {
              div.style.top = `${(coordinates.y || 0) - height}px`;
            }

            if (coordinates.x + width > window.innerWidth) {
              div.style.left = `${(coordinates.x || 0) - width}px`;
            }
          });

          document.body.addEventListener("click", clickHandler);
          document.addEventListener("keydown", keyHandler);
        });
      });
    }
  );
}

interface ConstructMenuDatePickerOnChangeParams {
  view: KanbanView;
  boardModifiers: BoardModifiers;
  item: Item;
  hasDate: boolean;
  laneIndex: number;
  itemIndex: number;
}

export function constructMenuDatePickerOnChange({
  view,
  boardModifiers,
  item,
  hasDate,
  laneIndex,
  itemIndex,
}: ConstructMenuDatePickerOnChangeParams) {
  const dateFormat =
    view.getSetting("date-format") || getDefaultDateFormat(view.app);
  const shouldLinkDates = view.getSetting("link-date-to-daily-note");
  const dateTrigger = view.getSetting("date-trigger") || defaultDateTrigger;
  const contentMatch = shouldLinkDates ? "\\[\\[([^}]+)\\]\\]" : "{([^}]+)}";
  const dateRegEx = new RegExp(
    `(^|\\s)${escapeRegExpStr(dateTrigger as string)}${contentMatch}`
  );

  return (dates: Date[]) => {
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
  };
}

export function buildTimeArray(view: KanbanView) {
  const format =
    view.getSetting("time-format") || getDefaultTimeFormat(view.app);
  const time: string[] = [];

  for (let i = 0; i < 24; i++) {
    time.push(moment({ hour: i }).format(format));
    time.push(moment({ hour: i, minute: 15 }).format(format));
    time.push(moment({ hour: i, minute: 30 }).format(format));
    time.push(moment({ hour: i, minute: 45 }).format(format));
  }

  return time;
}

export function constructTimePicker(
  view: KanbanView,
  coordinates: { x: number; y: number },
  onSelect: (opt: string) => void,
  time?: moment.Moment
) {
  const pickerClassName = c("time-picker");
  const timeFormat =
    view.getSetting("time-format") || getDefaultTimeFormat(view.app);
  const selected = time?.format(timeFormat);

  document.body.createDiv(
    { cls: `${pickerClassName} ${c("ignore-click-outside")}` },
    (div) => {
      const options = buildTimeArray(view);

      const clickHandler = (e: MouseEvent) => {
        if (
          e.target instanceof HTMLElement &&
          e.target.hasClass(c("time-picker-item")) &&
          e.target.dataset.value
        ) {
          onSelect(e.target.dataset.value);
          selfDestruct();
        }
      };

      const clickOutsideHandler = (e: MouseEvent) => {
        if (
          e.target instanceof HTMLElement &&
          e.target.closest(`.${pickerClassName}`) === null
        ) {
          selfDestruct();
        }
      };

      const escHandler = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          selfDestruct();
        }
      };

      const selfDestruct = () => {
        div.remove();
        div.removeEventListener("click", clickHandler);
        document.body.removeEventListener("click", clickOutsideHandler);
        document.removeEventListener("keydown", escHandler);
      };

      div.style.left = `${coordinates.x || 0}px`;
      div.style.top = `${coordinates.y || 0}px`;

      let selectedItem: HTMLDivElement = null;
      let middleItem: HTMLDivElement = null;

      options.forEach((opt, index) => {
        const isSelected = opt === selected;
        div.createDiv(
          {
            cls: `${c("time-picker-item")} ${isSelected ? "is-selected" : ""}`,
            text: opt,
          },
          (item) => {
            item.createEl(
              "span",
              { cls: c("time-picker-check"), prepend: true },
              (span) => {
                setIcon(span, "checkmark");
              }
            );

            if (index % 4 === 0) {
              item.addClass("is-hour");
            }
            
            item.dataset.value = opt;
            
            if (isSelected) selectedItem = item;
            if (index === Math.floor(options.length / 2)) {
              middleItem = item;
            }
          }
        );
      });

      setTimeout(() => {
        const height = div.clientHeight;
        const width = div.clientWidth;

        if (coordinates.y + height > window.innerHeight) {
          div.style.top = `${(coordinates.y || 0) - height}px`;
        }

        if (coordinates.x + width > window.innerWidth) {
          div.style.left = `${(coordinates.x || 0) - width}px`;
        }

        (selectedItem || middleItem)?.scrollIntoView({
          block: "center",
          inline: "nearest",
        });

        div.addEventListener("click", clickHandler);
        document.body.addEventListener("click", clickOutsideHandler);
        document.addEventListener("keydown", escHandler);
      });
    }
  );
}

interface ConstructMenuTimePickerOnChangeParams {
  view: KanbanView;
  boardModifiers: BoardModifiers;
  item: Item;
  hasTime: boolean;
  laneIndex: number;
  itemIndex: number;
}

export function constructMenuTimePickerOnChange({
  view,
  boardModifiers,
  item,
  hasTime,
  laneIndex,
  itemIndex,
}: ConstructMenuTimePickerOnChangeParams) {
  const timeTrigger = view.getSetting("time-trigger") || defaultTimeTrigger;
  const timeRegEx = new RegExp(
    `(^|\\s)${escapeRegExpStr(timeTrigger as string)}{([^}]+)}`
  );

  return (time: string) => {
    let titleRaw = item.titleRaw;

    if (hasTime) {
      titleRaw = item.titleRaw.replace(timeRegEx, `$1${timeTrigger}{${time}}`);
    } else {
      titleRaw = `${item.titleRaw} ${timeTrigger}{${time}}`;
    }

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
  };
}
