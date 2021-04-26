import { MarkdownRenderer } from "obsidian";
import React from "react";
import { Item } from "../types";
import { c } from "../helpers";
import { ObsidianContext } from "../context";
import { useAutocompleteInputProps } from "./autocomplete";

export interface ItemContentProps {
  item: Item;
  isSettingsVisible: boolean;
  setIsSettingsVisible?: React.Dispatch<boolean>;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}

export function ItemContent({
  item,
  isSettingsVisible,
  setIsSettingsVisible,
  onChange,
}: ItemContentProps) {
  const obsidianContext = React.useContext(ObsidianContext);
  const inputRef = React.useRef<HTMLTextAreaElement>();

  const { view, filePath } = obsidianContext;

  const onAction = () => setIsSettingsVisible && setIsSettingsVisible(false);

  const autocompleteProps = useAutocompleteInputProps({
    isInputVisible: isSettingsVisible,
    onEnter: onAction,
    onEscape: onAction,
  });

  const markdownContent = React.useMemo(() => {
    const tempEl = createDiv();

    MarkdownRenderer.renderMarkdown(item.title, tempEl, filePath, view);

    return { __html: tempEl.innerHTML.toString() };
  }, [item.title, filePath, view]);

  if (isSettingsVisible) {
    return (
      <div data-replicated-value={item.title} className={c("grow-wrap")}>
        <textarea
          rows={1}
          ref={inputRef}
          className={c("item-input")}
          value={item.title}
          onChange={onChange}
          {...autocompleteProps}
        />
      </div>
    );
  }

  return (
    <div className={c("item-title")}>
      <div
        className={`markdown-preview-view ${c("item-markdown")}`}
        dangerouslySetInnerHTML={markdownContent}
      />
    </div>
  );
}