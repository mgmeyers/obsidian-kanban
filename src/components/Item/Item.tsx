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
import { KanbanContext, ObsidianContext, SearchContext } from "../context";
import { ItemContent } from "./ItemContent";
import { useItemMenu } from "./ItemMenu";
import { processTitle } from "src/parser";
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
  constructMenuTimePickerOnChange,
  constructTimePicker,
} from "./helpers";
import { t } from "src/lang/helpers";
import { fuzzySearch } from "obsidian";

export interface DraggableItemFactoryParams {
  items: Item[];
  laneIndex: number;
}

interface GhostItemProps {
  shouldShowArchiveButton: boolean;
  item: Item;
}

function getClassModifiers(item: Item) {
  const date = item.metadata.date;
  const classModifiers: string[] = [];

  if (date) {
    if (date.isSame(new Date(), "day")) {
      classModifiers.push("is-today");
    }

    if (date.isAfter(new Date(), "day")) {
      classModifiers.push("is-future");
    }

    if (date.isBefore(new Date(), "day")) {
      classModifiers.push("is-past");
    }
  }

  if (item.data.isComplete) {
    classModifiers.push("is-complete");
  }

  return classModifiers;
}

export function GhostItem({ item, shouldShowArchiveButton }: GhostItemProps) {
  const { view } = React.useContext(ObsidianContext);
  const classModifiers = getClassModifiers(item);
  const shouldShowCheckbox = view.getSetting("show-checkboxes");

  return (
    <div className={`${c("item")} ${classModifiers.join(" ")}`}>
      <div className={c("item-content-wrapper")}>
        {(shouldShowArchiveButton || shouldShowCheckbox) && (
          <div className={c("item-prefix-button-wrapper")}>
            {shouldShowCheckbox && (
              <input
                readOnly
                type="checkbox"
                className="task-list-item-checkbox"
                checked={!!item.data.isComplete}
              />
            )}
            {shouldShowArchiveButton && (
              <button
                className={c("item-prefix-button")}
                aria-label={t("Archive item")}
              >
                <Icon name="sheets-in-box" />
              </button>
            )}
          </div>
        )}
        <ItemContent isSettingsVisible={false} item={item} />
        <div className={c("item-postfix-button-wrapper")}>
          <button
            className={c("item-postfix-button")}
            aria-label={t("More options")}
          >
            <Icon name="vertical-three-dots" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function draggableItemFactory({
  items,
  laneIndex,
}: DraggableItemFactoryParams) {
  return (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => {
    const { boardModifiers, board } = React.useContext(KanbanContext);
    const { view } = React.useContext(ObsidianContext);
    const { query } = React.useContext(SearchContext);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isCtrlHoveringCheckbox, setIsCtrlHoveringCheckbox] =
      React.useState(false);
    const [isHoveringCheckbox, setIsHoveringCheckbox] = React.useState(false);

    React.useEffect(() => {
      if (isHoveringCheckbox) {
        const handler = (e: KeyboardEvent) => {
          if (e.metaKey || e.ctrlKey) {
            setIsCtrlHoveringCheckbox(true);
          } else {
            setIsCtrlHoveringCheckbox(false);
          }
        };

        window.addEventListener("keydown", handler);
        window.addEventListener("keyup", handler);

        return () => {
          window.removeEventListener("keydown", handler);
          window.removeEventListener("keyup", handler);
        };
      }
    }, [isHoveringCheckbox]);

    const itemIndex = rubric.source.index;
    const item = items[itemIndex];
    const lane = board.lanes[laneIndex];
    const shouldShowCheckbox = view.getSetting("show-checkboxes");
    const shouldMarkItemsComplete = lane.data.shouldMarkItemsComplete;
    const queryResults = query ? fuzzySearch(query, item.titleSearch) : null;

    const classModifiers: string[] = getClassModifiers(item);

    if (snapshot.isDragging) classModifiers.push("is-dragging");
    if (query) {
      if (queryResults) {
        classModifiers.push("is-search-hit");
      } else {
        classModifiers.push("is-search-miss");
      }
    }

    const showMenu = useItemMenu({
      setIsEditing,
      item,
      laneIndex,
      itemIndex,
      boardModifiers,
    });

    return (
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();

          const internalLinkPath =
            e.target instanceof HTMLAnchorElement &&
            e.target.hasClass("internal-link")
              ? e.target.dataset.href
              : undefined;

          showMenu(e.nativeEvent, internalLinkPath);
        }}
        onDoubleClick={() => {
          setIsEditing(true);
        }}
        className={`${c("item")} ${classModifiers.join(" ")}`}
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
      >
        <div className={c("item-content-wrapper")}>
          {(shouldMarkItemsComplete || shouldShowCheckbox) && (
            <div
              onMouseEnter={(e) => {
                setIsHoveringCheckbox(true);

                if (e.ctrlKey || e.metaKey) {
                  setIsCtrlHoveringCheckbox(true);
                }
              }}
              onMouseLeave={() => {
                setIsHoveringCheckbox(false);

                if (isCtrlHoveringCheckbox) {
                  setIsCtrlHoveringCheckbox(false);
                }
              }}
              className={c("item-prefix-button-wrapper")}
            >
              {shouldShowCheckbox && !isCtrlHoveringCheckbox && (
                <input
                  onChange={() => {
                    boardModifiers.updateItem(
                      laneIndex,
                      itemIndex,
                      update(item, {
                        data: {
                          $toggle: ["isComplete"],
                        },
                      })
                    );
                  }}
                  type="checkbox"
                  className="task-list-item-checkbox"
                  checked={!!item.data.isComplete}
                />
              )}
              {(isCtrlHoveringCheckbox ||
                (!shouldShowCheckbox && shouldMarkItemsComplete)) && (
                <button
                  onClick={() => {
                    boardModifiers.archiveItem(laneIndex, itemIndex, item);
                  }}
                  className={c("item-prefix-button")}
                  aria-label={
                    isCtrlHoveringCheckbox ? undefined : "Archive item"
                  }
                >
                  <Icon name="sheets-in-box" />
                </button>
              )}
            </div>
          )}
          <ItemContent
            isSettingsVisible={isEditing}
            setIsSettingsVisible={setIsEditing}
            item={item}
            searchResult={queryResults}
            onEditDate={(e) => {
              constructDatePicker(
                { x: e.clientX, y: e.clientY },
                constructMenuDatePickerOnChange({
                  view,
                  boardModifiers,
                  item,
                  hasDate: true,
                  laneIndex,
                  itemIndex,
                }),
                item.metadata.date?.toDate()
              );
            }}
            onEditTime={(e) => {
              constructTimePicker(
                view,
                { x: e.clientX, y: e.clientY },
                constructMenuTimePickerOnChange({
                  view,
                  boardModifiers,
                  item,
                  hasTime: true,
                  laneIndex,
                  itemIndex,
                }),
                item.metadata.time
              );
            }}
            onChange={(e) => {
              const titleRaw = e.target.value.replace(/[\r\n]+/g, " ");
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
                  },
                })
              );
            }}
          />
          <div className={c("item-postfix-button-wrapper")}>
            {isEditing ? (
              <button
                onClick={() => {
                  setIsEditing(false);
                }}
                className={`${c("item-postfix-button")} is-enabled`}
                aria-label={t("Cancel")}
              >
                <Icon name="cross" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  showMenu(e.nativeEvent);
                }}
                className={c("item-postfix-button")}
                aria-label={t("More options")}
              >
                <Icon name="vertical-three-dots" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };
}
