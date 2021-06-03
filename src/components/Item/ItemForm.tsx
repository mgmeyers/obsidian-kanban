import React from "react";
import {MarkdownSourceView, parseLinktext, TFile} from "obsidian";
import useOnclickOutside from "react-cool-onclickoutside";

import { Item } from "../types";
import { c, generateInstanceId } from "../helpers";
import { useAutocompleteInputProps } from "./autocomplete";
import { ObsidianContext } from "../context";
import { processTitle } from "src/parser";
import { t } from "src/lang/helpers";

interface ItemFormProps {
  addItems: (items: Item[]) => void;
}

export function ItemForm({ addItems }: ItemFormProps) {
  const [isInputVisible, setIsInputVisible] = React.useState(false);
  const [itemTitle, setItemTitle] = React.useState("");
  const { view, filePath } = React.useContext(ObsidianContext);

  const clickOutsideRef = useOnclickOutside(
    () => {
      setIsInputVisible(false);
    },
    {
      ignoreClass: c("ignore-click-outside"),
    }
  );

  const clear = () => {
    setItemTitle("");
    setIsInputVisible(false);
  };

  const createItem = () => {
    const title = itemTitle.trim();

    if (title) {
      addItemsFromStrings([title]);
      setItemTitle("");
    }
  };

  const addItemsFromStrings = (titles: string[]) => {
    addItems(titles.map(title => {
      const processed = processTitle(title, view);
      const newItem: Item = {
        id: generateInstanceId(),
        title: processed.title,
        titleRaw: title,
        titleSearch: processed.titleSearch,
        data: {},
        metadata: {
          date: processed.date,
          time: processed.time,
          tags: processed.tags,
          file: processed.file,
        },
      };
      return newItem;
    }));
  };

  const autocompleteProps = useAutocompleteInputProps({
    isInputVisible,
    onEnter: createItem,
    onEscape: clear,
  });

  function linkTo(f: TFile, subpath?: string) {
    // Generate a link relative to this Kanban board, respecting user link type preferences
    return view.app.fileManager.generateMarkdownLink(f, filePath, subpath);
  }

  function getMarkdown(transfer: DataTransfer ) {
    // crude hack to use Obsidian's html-to-markdown converter (replace when Obsidian exposes it in API):
    return (MarkdownSourceView.prototype as any).handleDataTransfer.call({app: view.app}, transfer)
  }

  function fixBulletsAndLInks(text: string) {
    // Internal links from e.g. dataview plugin incorrectly begin with `app://obsidian.md/`, and
    // we also want to remove bullet points and task markers from text and markdown
    return text.replace(/^\s*[-+*]\s+(\[.]\s+)?/, "").trim().replace(/^\[(.*)\]\(app:\/\/obsidian.md\/(.*)\)$/, "[$1]($2)");
  }

  function dropAction(transfer: DataTransfer) {
    // Return a 'copy' or 'link' action according to the content types, or undefined if no recognized type
    if (transfer.types.includes('text/uri-list')) return 'link';
    if (['file', 'files', 'link'].includes((view.app as any).dragManager.draggable?.type)) return 'link';
    if (transfer.types.includes('text/html') || transfer.types.includes('text/plain')) return 'copy';
  }

  if (isInputVisible) {
    return (
      <div ref={clickOutsideRef}>
        <div className={c("item-input-wrapper")}>
          <div data-replicated-value={itemTitle} className={c("grow-wrap")}>
            <textarea
              rows={1}
              value={itemTitle}
              className={c("item-input")}
              placeholder={t("Item title...")}
              onChange={(e) =>
                setItemTitle(e.target.value.replace(/[\r\n]+/g, " "))
              }
              onDragOver={e => {
                const action = dropAction(e.dataTransfer);
                if (action) {
                  e.dataTransfer.dropEffect = action;
                  e.preventDefault();
                  return false;
                }
              }}
              onDragLeave={() => { if (!itemTitle) setIsInputVisible(false); }}
              onDrop={e => {
                const draggable = (view.app as any).dragManager.draggable;
                const html  = e.dataTransfer.getData("text/html");
                const plain = e.dataTransfer.getData("text/plain");
                const uris  = e.dataTransfer.getData("text/uri-list");

                if (draggable?.type === "file") {
                  addItemsFromStrings([linkTo(draggable.file)]);
                } else if (draggable?.type === "files") {
                  addItemsFromStrings(draggable.files.map(linkTo));
                } else if (draggable?.type === "link") {
                  let link = draggable.file ? linkTo(draggable.file, parseLinktext(draggable.linktext).subpath) : `[[${draggable.linktext}]]`;
                  let alias = new DOMParser().parseFromString(html, "text/html").documentElement.textContent;  // Get raw text
                  link = link.replace(/]]$/, `|${alias}]]`).replace(/^\[[^\]].+]\(/, `[${alias}](`);
                  addItemsFromStrings([link]);
                } else {
                  // shift key to force plain text, the same way Obsidian does it
                  const text = e.shiftKey ? (plain||html) : getMarkdown(e.dataTransfer);

                  // Split lines and strip leading bullets/task indicators
                  const lines: string[] = (text || html || uris || plain || "").split(/\r\n?|\n/).map(fixBulletsAndLInks);
                  addItemsFromStrings(lines.filter(line => line));
                }
                if (!itemTitle) setIsInputVisible(false);
              }}
              {...autocompleteProps}
            />
          </div>
        </div>
        <div className={c("item-input-actions")}>
          <button className={c("item-action-add")} onClick={createItem}>
            {t("Add item")}
          </button>
          <button className={c("item-action-cancel")} onClick={clear}>
            {t("Cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={c("item-button-wrapper")}>
      <button
        className={c("new-item-button")}
        onClick={() => setIsInputVisible(true)}
        onDragOver={e => { if (dropAction(e.dataTransfer)) setIsInputVisible(true); }}
      >
        <span className={c("item-button-plus")}>+</span> {t("Add a card")}
      </button>
    </div>
  );
}
