import { MarkdownRenderer, getLinkpath } from "obsidian";
import React from "react";
import { Item } from "../types";
import { c, getDefaultDateFormat } from "../helpers";
import { KanbanContext, ObsidianContext } from "../context";
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
  const dateFormat =
    view.getSetting("date-format") || getDefaultDateFormat(view.app);
  const dateDisplayFormat =
    view.getSetting("date-display-format") || dateFormat;
  const shouldLinkDate = view.getSetting("link-date-to-daily-note");

  const onAction = () => setIsSettingsVisible && setIsSettingsVisible(false);

  const autocompleteProps = useAutocompleteInputProps({
    isInputVisible: isSettingsVisible,
    onEnter: onAction,
    onEscape: onAction,
  });

  const markdownContent = React.useMemo(() => {
    const tempEl = createDiv();
    MarkdownRenderer.renderMarkdown(item.title, tempEl, filePath, view);

    return {
      innerHTML: { __html: tempEl.innerHTML.toString() },
    };
  }, [item, filePath, dateFormat, view]);

  if (isSettingsVisible) {
    return (
      <div data-replicated-value={item.titleRaw} className={c("grow-wrap")}>
        <textarea
          rows={1}
          ref={inputRef}
          className={c("item-input")}
          value={item.titleRaw}
          onChange={onChange}
          {...autocompleteProps}
        />
      </div>
    );
  }

  const dateStr = item.metadata.date?.format(dateFormat);
  const dateDisplayStr = item.metadata.date?.format(dateDisplayFormat);

  const datePath = dateStr ? getLinkpath(dateStr) : null;
  const isResolved = dateStr
    ? view.app.metadataCache.getFirstLinkpathDest(datePath, filePath)
    : null;
  const date =
    datePath && shouldLinkDate ? (
      <a
        href={datePath}
        data-href={datePath}
        className={`internal-link ${isResolved ? "" : "is-unresolved"}`}
        target="blank"
        rel="noopener"
      >
        {dateDisplayStr}
      </a>
    ) : (
      dateDisplayStr
    );

  return (
    <div className={c("item-title")}>
      <div
        className={`markdown-preview-view ${c("item-markdown")}`}
        dangerouslySetInnerHTML={markdownContent.innerHTML}
      />
      <div className={c("item-metadata")}>
        {dateStr && <span className={c("item-metadata-date")}>{date}</span>}
      </div>
    </div>
  );
}
