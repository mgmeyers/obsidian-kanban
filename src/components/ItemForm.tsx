import React from "react";
import { Item } from "./types";
import { c, generateTempId } from "./helpers";

interface ItemFormProps {
  addItem: (item: Item) => void;
}

export function ItemForm({ addItem }: ItemFormProps) {
  const [isInputVisible, setIsInputVisible] = React.useState(false);
  const [itemTitle, setItemTitle] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>();

  const clear = () => {
    setItemTitle("");
    setIsInputVisible(false);
  };

  const createItem = () => {
    const newItem: Item = {
      id: generateTempId(),
      title: itemTitle,
      data: {},
    };

    addItem(newItem);
  };

  if (isInputVisible) {
    return (
      <>
        <div className={c("item-input-wrapper")}>
          <input
            value={itemTitle}
            ref={inputRef}
            className={c("item-input")}
            type="text"
            placeholder="Item title..."
            onChange={(e) => setItemTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                createItem();
                setItemTitle("");
              } else if (e.key === "Escape") {
                clear();
              }
            }}
          />
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
        onClick={() => {
          setIsInputVisible(true);
          setTimeout(() => inputRef.current?.focus());
        }}
      >
        <span className={c("item-button-plus")}>+</span> Add a card
      </button>
    </div>
  );
}
