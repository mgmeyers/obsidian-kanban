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

  const onClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const targetEl = e.target as HTMLElement;

      // Open an internal link in a new pane
      if (targetEl.hasClass("internal-link")) {
        e.preventDefault();

        view.app.workspace.openLinkText(
          targetEl.getAttr("href"),
          filePath,
          true
        );

        return;
      }

      // Open a tag search
      if (targetEl.hasClass("tag")) {
        e.preventDefault();

        (view.app as any).internalPlugins
          .getPluginById("global-search")
          .instance.openGlobalSearch(`tag:${targetEl.getAttr("href")}`);

        return;
      }

      // Open external link
      if (targetEl.hasClass("external-link")) {
        e.preventDefault();
        window.open(targetEl.getAttr("href"), "_blank");
      }
    },
    [view, filePath]
  );

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
    <div onClick={onClick} className={c("item-title")}>
      <div
        className={`markdown-preview-view ${c("item-markdown")}`}
        dangerouslySetInnerHTML={markdownContent}
      />
    </div>
  );
}