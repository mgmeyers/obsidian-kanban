import React from "react";

import { Item } from "../types";
import { c } from "../helpers";
import { KanbanContext } from "../context";
import { useAutocompleteInputProps } from "./autocomplete";
import { MarkdownRenderer } from "../MarkdownRenderer";
import { DateAndTime, RelativeDate } from "./DateAndTime";

export interface ItemContentProps {
  item: Item;
  isSettingsVisible: boolean;
  setIsSettingsVisible?: React.Dispatch<boolean>;
  searchQuery?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onEditDate?: React.MouseEventHandler;
  onEditTime?: React.MouseEventHandler;
}

export const ItemContent = React.memo(
  ({
    item,
    isSettingsVisible,
    setIsSettingsVisible,
    searchQuery,
    onChange,
    onEditDate,
    onEditTime,
  }: ItemContentProps) => {
    const { stateManager, filePath } = React.useContext(KanbanContext);
    const inputRef = React.useRef<HTMLTextAreaElement>();
    const onAction = () => setIsSettingsVisible && setIsSettingsVisible(false);
    const hideTagsDisplay = stateManager.getSetting("hide-tags-display");

    const autocompleteProps = useAutocompleteInputProps({
      isInputVisible: isSettingsVisible,
      onEnter: onAction,
      onEscape: onAction,
    });

    if (isSettingsVisible) {
      return (
        <div
          data-replicated-value={item.data.titleRaw}
          className={c("grow-wrap")}
        >
          <textarea
            rows={1}
            ref={inputRef}
            className={c("item-input")}
            value={item.data.titleRaw}
            onChange={onChange}
            {...autocompleteProps}
          />
        </div>
      );
    }

    return (
      <div className={c("item-title")}>
        <MarkdownRenderer
          className={c("item-markdown")}
          dom={item.data.dom}
          searchQuery={searchQuery}
        />
        <div className={c("item-metadata")}>
          <RelativeDate item={item} stateManager={stateManager} />
          <DateAndTime
            item={item}
            stateManager={stateManager}
            filePath={filePath}
            onEditDate={onEditDate}
            onEditTime={onEditTime}
          />
          {!hideTagsDisplay && !!item.data.metadata.tags?.length && (
            <div className={c("item-tags")}>
              {item.data.metadata.tags.map((tag, i) => {
                return (
                  <a
                    href={tag}
                    key={i}
                    className={`tag ${c("item-tag")} ${
                      tag.toLocaleLowerCase().contains(searchQuery)
                        ? "is-search-match"
                        : ""
                    }`}
                  >
                    <span>{tag[0]}</span>
                    {tag.slice(1)}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
);
