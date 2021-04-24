import { TFile } from "obsidian";
import React from "react";

import { Textcomplete } from "@textcomplete/core";
import { TextareaEditor } from "@textcomplete/textarea";
import Fuse from "fuse.js";
import { c } from "../helpers";
import { ObsidianContextProps } from "../context";

export interface ConstructAutocompleteParams {
  inputRef: React.MutableRefObject<HTMLTextAreaElement>;
  autocompleteVisibilityRef: React.MutableRefObject<boolean>;
  obsidianContext: ObsidianContextProps;
}

export function constructAutocomplete({
  inputRef,
  autocompleteVisibilityRef,
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
        match: /\B#(.*)$/,
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
        match: /\B\[\[(.*)$/,
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

  autocomplete.on("shown", () => {
    autocompleteVisibilityRef.current = true;
  });

  autocomplete.on("hide", () => {
    autocompleteVisibilityRef.current = false;
  });

  return () => {
    autocomplete.destroy();
    editor.destroy();
  };
}
