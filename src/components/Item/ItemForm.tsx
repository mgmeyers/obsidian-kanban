import React from "react";

import { Item } from "../types";
import { c, generateInstanceId } from "../helpers";
import { ObsidianContext } from "../context";
import { constructAutocomplete } from "./autocomplete";

interface ItemFormProps {
  addItem: (item: Item) => void;
}

export function ItemForm({ addItem }: ItemFormProps) {
  const obsidianContext = React.useContext(ObsidianContext);

  const [isInputVisible, setIsInputVisible] = React.useState(false);
  const [itemTitle, setItemTitle] = React.useState("");

  const autocompleteVisibilityRef = React.useRef<boolean>(false);
  const inputRef = React.useRef<HTMLTextAreaElement>();

  React.useEffect(() => {
    if (isInputVisible && inputRef.current) {
      inputRef.current.focus();

      return constructAutocomplete({
        inputRef,
        autocompleteVisibilityRef,
        obsidianContext,
      });
    }
  }, [isInputVisible]);

  const clear = () => {
    setItemTitle("");
    setIsInputVisible(false);
  };

  const createItem = () => {
    const title = itemTitle.trim();

    if (title) {
      const newItem: Item = {
        id: generateInstanceId(),
        title,
        data: {},
      };

      addItem(newItem);
    }
  };

  if (isInputVisible) {
    return (
      <>
        <div className={c("item-input-wrapper")}>
          <div data-replicated-value={itemTitle} className={c("grow-wrap")}>
            <textarea
              rows={1}
              value={itemTitle}
              ref={inputRef}
              className={c("item-input")}
              placeholder="Item title..."
              onChange={(e) => setItemTitle(e.target.value)}
              onKeyDownCapture={(e) => {
                // Using onKeyDownCapture to take precedence over autocomplete
                if (autocompleteVisibilityRef.current) return;

                if (e.key === "Enter") {
                  e.preventDefault();
                  createItem();
                } else if (e.key === "Escape") {
                  clear();
                }
              }}
            />
          </div>
        </div>
        <div className={c("item-input-actions")}>
          <button className={c("item-action-add")} onClick={createItem}>
            Add item
          </button>
          <button className={c("item-action-cancel")} onClick={clear}>
            Cancel
          </button>
        </div>
      </>
    );
  }

  return (
    <div className={c("item-button-wrapper")}>
      <button
        className={c("new-item-button")}
        onClick={() => setIsInputVisible(true)}
      >
        <span className={c("item-button-plus")}>+</span> Add a card
      </button>
    </div>
  );
}
