import { MarkdownRenderer } from "obsidian";
import update from "immutability-helper";
import React from "react";
import {
  DraggableProvided,
  DraggableStateSnapshot,
  DraggableRubric,
} from "react-beautiful-dnd";

import { Item } from "../types";
import { c } from "../helpers";
import { Icon } from "../Icon/Icon";
import { KanbanContext, ObsidianContext } from "../context";
import { constructAutocomplete } from "./autocomplete";

export interface ItemContentProps {
  item: Item;
  isSettingsVisible: boolean;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}

export function ItemContent({
  item,
  isSettingsVisible,
  onChange,
  onKeyDown,
}: ItemContentProps) {
  const obsidianContext = React.useContext(ObsidianContext);
  const inputRef = React.useRef<HTMLTextAreaElement>();
  const autocompleteVisibilityRef = React.useRef<boolean>(false);

  const { view, filePath } = obsidianContext;

  React.useEffect(() => {
    if (isSettingsVisible && inputRef.current) {
      const input = inputRef.current;

      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;

      return constructAutocomplete({
        inputRef,
        autocompleteVisibilityRef,
        obsidianContext,
      });
    }
  }, [isSettingsVisible]);

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
    },
    [view, filePath]
  );

  const markdownContent = React.useMemo(() => {
    const tempEl = createDiv();

    MarkdownRenderer.renderMarkdown(
      item.title,
      tempEl,
      filePath,
      view
    );

    return { __html: tempEl.innerHTML.toString() }
  }, [item.title, filePath, view])

  if (isSettingsVisible) {
    return (
      <div data-replicated-value={item.title} className={c("grow-wrap")}>
        <textarea
          rows={1}
          ref={inputRef}
          className={c("item-input")}
          value={item.title}
          onChange={onChange}
          onKeyDown={(e) => {
            if (autocompleteVisibilityRef.current) return;
            onKeyDown(e);
          }}
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

export interface DraggableItemFactoryParams {
  items: Item[];
  laneIndex: number;
  shouldShowArchiveButton: boolean;
}

export function draggableItemFactory({
  items,
  laneIndex,
  shouldShowArchiveButton,
}: DraggableItemFactoryParams) {
  return (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => {
    const { boardModifiers } = React.useContext(KanbanContext);
    const itemIndex = rubric.source.index;
    const item = items[itemIndex];
    const [isSettingsVisible, setIsSettingsVisible] = React.useState(false);

    return (
      <div
        className={`${c("item")} ${snapshot.isDragging ? "is-dragging" : ""}`}
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
      >
        <div className={c("item-content-wrapper")}>
          <ItemContent
            isSettingsVisible={isSettingsVisible}
            item={item}
            onChange={(e) =>
              boardModifiers.updateItem(
                laneIndex,
                itemIndex,
                update(item, { title: { $set: e.target.value } })
              )
            }
            onKeyDown={(e) => {
              if (e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                setIsSettingsVisible(false);
              }
            }}
          />
          <div className={c("item-edit-button-wrapper")}>
            <button
              onClick={() => {
                setIsSettingsVisible(!isSettingsVisible);
              }}
              className={`${c("item-edit-button")} ${
                isSettingsVisible ? "is-enabled" : ""
              }`}
              aria-label={isSettingsVisible ? "Close" : "Edit item"}
            >
              <Icon name={isSettingsVisible ? "cross" : "pencil"} />
            </button>
            {shouldShowArchiveButton && (
              <button
                onClick={() => {
                  boardModifiers.archiveItem(laneIndex, itemIndex, item);
                }}
                className={c("item-edit-archive-button")}
                aria-label="Archive item"
              >
                <Icon name="sheets-in-box" />
              </button>
            )}
          </div>
        </div>
        {isSettingsVisible && (
          <div className={c("item-settings")}>
            <div className={c("item-settings-actions")}>
              <button
                onClick={() => boardModifiers.deleteItem(laneIndex, itemIndex)}
                className={c("item-button-delete")}
              >
                <Icon name="trash" /> Delete
              </button>
              <button
                onClick={() =>
                  boardModifiers.archiveItem(laneIndex, itemIndex, item)
                }
                className={c("item-button-archive")}
              >
                <Icon name="sheets-in-box" /> Archive
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };
}
