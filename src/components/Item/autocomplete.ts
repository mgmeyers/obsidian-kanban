import { TFile } from "obsidian";
import React from "react";

import { Textcomplete } from "@textcomplete/core";
import { TextareaEditor } from "@textcomplete/textarea";
import Fuse from "fuse.js";
import { c, useIMEInputProps } from "../helpers";
import { ObsidianContext, ObsidianContextProps } from "../context";

export interface ConstructAutocompleteParams {
  inputRef: React.MutableRefObject<HTMLTextAreaElement>;
  isAutocompleteVisibleRef: React.MutableRefObject<boolean>;
  obsidianContext: ObsidianContextProps;
}

export function constructAutocomplete({
  inputRef,
  isAutocompleteVisibleRef,
  obsidianContext,
}: ConstructAutocompleteParams) {
  const { view, filePath } = obsidianContext;

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
      {
        id: "tag",
        match: /\B#([^\s]*)$/,
        index: 1,
        search: async (
          term: string,
          callback: (results: Fuse.FuseResult<string>[]) => void
        ) => {
          callback(tagSearch.search(term));
        },
        template: (result: Fuse.FuseResult<string>) => {
          return result.item;
        },
        replace: (result: Fuse.FuseResult<string>): string => `${result.item} `,
      },
      {
        id: "link",
        match: /\B\[\[([^\]]*)$/,
        index: 1,
        template: (res: Fuse.FuseResult<TFile>) => {
          return view.app.metadataCache.fileToLinktext(res.item, filePath);
        },
        search: async (
          term: string,
          callback: (results: Fuse.FuseResult<TFile>[]) => void
        ) => {
          callback(fileSearch.search(term));
        },
        replace: (result: Fuse.FuseResult<TFile>): string =>
          `[[${view.app.metadataCache.fileToLinktext(
            result.item,
            filePath
          )}]] `,
      },
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

  return () => {
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
      if (
        getShouldIMEBlockAction() ||
        isAutocompleteVisibleRef.current
      ) {
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
