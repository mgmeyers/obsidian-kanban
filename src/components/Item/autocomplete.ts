import { TFile, moment } from "obsidian";
import React from "react";

import { Textcomplete } from "@textcomplete/core";
import { TextareaEditor } from "@textcomplete/textarea";
import Fuse from "fuse.js";
import {
  c,
  escapeRegExpStr,
  getDefaultDateFormat,
  getDefaultTimeFormat,
  useIMEInputProps,
} from "../helpers";
import { ObsidianContext, ObsidianContextProps } from "../context";
import flatpickr from "flatpickr";

import { KanbanView } from "src/KanbanView";
import { defaultDateTrigger, defaultTimeTrigger } from "src/settingHelpers";
import { getDefaultLocale } from "./datePickerLocale";

const tagRegex = /(^|\s)#([^\s]*)$/;
const linkRegex = /(^|\s)\[\[([^\]]*)$/;

export interface ConstructAutocompleteParams {
  inputRef: React.MutableRefObject<HTMLTextAreaElement>;
  isAutocompleteVisibleRef: React.MutableRefObject<boolean>;
  obsidianContext: ObsidianContextProps;
}

function forceChangeEvent(input: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  ).set.call(input, value);

  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function applyDate(
  date: Date,
  inputRef: React.MutableRefObject<HTMLTextAreaElement>,
  view: KanbanView
) {
  const dateFormat =
    view.getSetting("date-format") || getDefaultDateFormat(view.app);
  const shouldLinkDates = view.getSetting("link-date-to-daily-note");

  const formattedDate = moment(date).format(dateFormat);
  const wrappedDate = shouldLinkDates
    ? `[[${formattedDate}]]`
    : `{${formattedDate}}`;

  forceChangeEvent(inputRef.current, `${inputRef.current.value}${wrappedDate}`);

  inputRef.current.focus();
}

interface ConstructDatePickerParams {
  div: HTMLElement;
  inputRef: React.MutableRefObject<HTMLTextAreaElement>;
  cb: (picker: flatpickr.Instance) => void;
  view: KanbanView;
}

function constructDatePicker({
  div,
  inputRef,
  cb,
  view,
}: ConstructDatePickerParams) {
  div.createEl("input", { type: "text" }, (input) => {
    setTimeout(() =>
      cb(
        flatpickr(input, {
          locale: getDefaultLocale(),
          inline: true,
          onChange: (dates) => {
            applyDate(dates[0], inputRef, view);
          },
        })
      )
    );
  });
}

function getTagSearchConfig(tagSearch: Fuse<string>) {
  return {
    id: "tag",
    match: tagRegex,
    index: 1,
    search: (
      term: string,
      callback: (results: Fuse.FuseResult<string>[]) => void
    ) => {
      callback(tagSearch.search(term));
    },
    template: (result: Fuse.FuseResult<string>) => {
      return result.item;
    },
    replace: (result: Fuse.FuseResult<string>): string => `${result.item} `,
  };
}

function getFileSearchConfig(
  fileSearch: Fuse<TFile>,
  filePath: string,
  view: KanbanView
) {
  return {
    id: "link",
    match: linkRegex,
    index: 1,
    template: (res: Fuse.FuseResult<TFile>) => {
      return view.app.metadataCache.fileToLinktext(res.item, filePath);
    },
    search: (
      term: string,
      callback: (results: Fuse.FuseResult<TFile>[]) => void
    ) => {
      callback(fileSearch.search(term));
    },
    replace: (result: Fuse.FuseResult<TFile>): string =>
      `[[${view.app.metadataCache.fileToLinktext(result.item, filePath)}]] `,
  };
}

function toPreviousMonth(date: moment.Moment) {
  const initialMonth = date.month();
  const first = date.clone().startOf("month").weekday(0);
  const diff = date.diff(first, "week");

  date.subtract(1, "month").startOf("month").weekday(6).add(diff, "week");

  let nextMonth = date.month();

  while (initialMonth === nextMonth) {
    date.subtract(1, "week");
    nextMonth = date.month();
  }

  return date;
}

function toNextMonth(date: moment.Moment) {
  const initialMonth = date.month();
  const first = date.clone().startOf("month").weekday(6);
  const diff = date.diff(first, "week");

  date.add(1, "month").startOf("month").weekday(0).add(diff, "week");

  let nextMonth = date.month();

  while (initialMonth === nextMonth) {
    date.add(1, "week");
    nextMonth = date.month();
  }

  return date;
}

export function constructAutocomplete({
  inputRef,
  isAutocompleteVisibleRef,
  obsidianContext,
}: ConstructAutocompleteParams) {
  const { view, filePath } = obsidianContext;

  let datePickerEl: null | HTMLDivElement = null;
  let datePickerInstance: flatpickr.Instance | null = null;

  const dateTrigger = view.getSetting("date-trigger") || defaultDateTrigger;
  const timeTrigger = view.getSetting("time-trigger") || defaultTimeTrigger;

  const destroyDatePicker = () => {
    isAutocompleteVisibleRef.current = false;
    datePickerInstance.destroy();
    datePickerEl.remove();
    setTimeout(() => (datePickerEl = null));
  };

  const dateTriggerRegex = new RegExp(
    `(?:^|\\s)${escapeRegExpStr(dateTrigger as string)}$`
  );

  const timeTriggerRegex = new RegExp(
    `(?:^|\\s)${escapeRegExpStr(timeTrigger as string)}$`
  );

  const tagSearch = new Fuse(
    Object.keys((view.app.metadataCache as any).getTags()).sort()
  );

  const fileSearch = new Fuse(view.app.vault.getMarkdownFiles(), {
    keys: ["name"],
  });

  const editor = new TextareaEditor(inputRef.current);
  const autocomplete = new Textcomplete(
    editor,
    [
      getTagSearchConfig(tagSearch),
      getFileSearchConfig(fileSearch, filePath, view),
    ],
    {
      dropdown: {
        className: c("autocomplete"),
        rotate: true,
        item: {
          className: c("autocomplete-item"),
          activeClassName: c("autocomplete-item-active"),
        },
      },
    }
  );

  autocomplete.on("show", () => {
    isAutocompleteVisibleRef.current = true;
  });

  autocomplete.on("hidden", () => {
    isAutocompleteVisibleRef.current = false;
  });

  const keydownHandler = (e: KeyboardEvent) => {
    if (!datePickerEl) {
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      const selectedDates = datePickerInstance.selectedDates;

      if (selectedDates.length) {
        applyDate(selectedDates[0], inputRef, view);
      } else {
        applyDate(new Date(), inputRef, view);
      }

      return destroyDatePicker();
    }

    if (e.key === "Escape") {
      e.preventDefault();
      return destroyDatePicker();
    }

    const currentDate = moment(
      datePickerInstance.selectedDates[0] || new Date()
    );

    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (currentDate.weekday() === 6) {
        datePickerInstance.setDate(toNextMonth(currentDate).toDate(), false);
      } else {
        datePickerInstance.setDate(currentDate.add(1, "day").toDate(), false);
      }
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (currentDate.weekday() === 0) {
        datePickerInstance.setDate(
          toPreviousMonth(currentDate).toDate(),
          false
        );
      } else {
        datePickerInstance.setDate(
          currentDate.subtract(1, "day").toDate(),
          false
        );
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      datePickerInstance.setDate(
        currentDate.subtract(1, "week").toDate(),
        false
      );
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      datePickerInstance.setDate(currentDate.add(1, "week").toDate(), false);
      return;
    }
  };

  inputRef.current.addEventListener("keydown", keydownHandler);

  editor.on("change", (e: CustomEvent) => {
    const beforeCursor = e.detail.beforeCursor as string;

    if (beforeCursor && dateTriggerRegex.test(beforeCursor)) {
      const position = editor.getCursorOffset();

      if (datePickerEl) {
        datePickerEl.style.left = `${position.left || 0}px`;
        datePickerEl.style.top = `${position.top || 0}px`;
      } else {
        datePickerEl = document.body.createDiv(
          { cls: c("date-picker") },
          (div) => {
            div.style.left = `${position.left || 0}px`;
            div.style.top = `${position.top || 0}px`;

            constructDatePicker({
              div,
              inputRef,
              view,
              cb: (picker) => {
                datePickerInstance = picker;
                isAutocompleteVisibleRef.current = true;
              },
            })
          }
        );
      }
    } else if (datePickerEl) {
      destroyDatePicker();
    }
  });

  return () => {
    if (inputRef.current) {
      inputRef.current.removeEventListener("keydown", keydownHandler);
    }
    
    if (datePickerEl) {
      destroyDatePicker();
    }

    autocomplete.destroy();
    editor.destroy();
  };
}

export interface UseAutocompleteInputPropsParams {
  isInputVisible: boolean;
  onEnter: () => void;
  onEscape: () => void;
}

export function useAutocompleteInputProps({
  isInputVisible,
  onEnter,
  onEscape,
}: UseAutocompleteInputPropsParams) {
  const obsidianContext = React.useContext(ObsidianContext);
  const isAutocompleteVisibleRef = React.useRef<boolean>(false);
  const inputRef = React.useRef<HTMLTextAreaElement>();
  const {
    onCompositionStart,
    onCompositionEnd,
    getShouldIMEBlockAction,
  } = useIMEInputProps();

  React.useEffect(() => {
    const input = inputRef.current;

    if (isInputVisible && input) {
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;

      return constructAutocomplete({
        inputRef,
        isAutocompleteVisibleRef,
        obsidianContext,
      });
    }
  }, [isInputVisible]);

  return {
    ref: inputRef,
    onCompositionStart,
    onCompositionEnd,
    onKeyDownCapture: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (getShouldIMEBlockAction() || isAutocompleteVisibleRef.current) {
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        onEnter();
      } else if (e.key === "Escape") {
        onEscape();
      }
    },
  };
}
