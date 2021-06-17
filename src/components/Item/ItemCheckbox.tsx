import update from "immutability-helper";
import React from "react";

import { Item } from "../types";
import { c } from "../helpers";
import { Icon } from "../Icon/Icon";
import { KanbanView } from "src/KanbanView";
import { BoardModifiers } from "../helpers/boardModifiers";

interface ItemCheckboxProps {
  laneIndex?: number;
  itemIndex?: number;
  item: Item;
  shouldMarkItemsComplete: boolean;
  view: KanbanView;
  boardModifiers: BoardModifiers;
}

export const ItemCheckbox = React.memo(
  ({
    shouldMarkItemsComplete,
    laneIndex,
    itemIndex,
    item,
    view,
    boardModifiers,
  }: ItemCheckboxProps) => {
    const shouldShowCheckbox = view.getSetting("show-checkboxes");

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

    if (!(shouldMarkItemsComplete || shouldShowCheckbox)) {
      return null;
    }

    return (
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
            aria-label={isCtrlHoveringCheckbox ? undefined : "Archive item"}
          >
            <Icon name="sheets-in-box" />
          </button>
        )}
      </div>
    );
  }
);
