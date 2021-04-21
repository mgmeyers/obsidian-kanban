import React from "react";
import { Item } from "../types";
import { c, generateInstanceId } from "../helpers";

interface ItemFormProps {
  addItem: (item: Item) => void;
}

export function ItemForm({ addItem }: ItemFormProps) {
  const [isInputVisible, setIsInputVisible] = React.useState(false);
  const [itemTitle, setItemTitle] = React.useState("");

  const clear = () => {
    setItemTitle("");
    setIsInputVisible(false);
  };

  const createItem = () => {
    const newItem: Item = {
      id: generateInstanceId(),
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
            ref={c => c && c.focus()}
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
        }}
      >
        <span className={c("item-button-plus")}>+</span> Add a card
      </button>
    </div>
  );
}
