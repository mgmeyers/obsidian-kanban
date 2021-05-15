import React from "react";
import useOnclickOutside from "react-cool-onclickoutside";

import { Item } from "../types";
import { c, generateInstanceId } from "../helpers";
import { useAutocompleteInputProps } from "./autocomplete";
import { ObsidianContext } from "../context";
import { processTitle } from "src/parser";
import { t } from "src/lang/helpers";

interface ItemFormProps {
  addItem: (item: Item) => void;
}

export function ItemForm({ addItem }: ItemFormProps) {
  const [isInputVisible, setIsInputVisible] = React.useState(false);
  const [itemTitle, setItemTitle] = React.useState("");
  const { view } = React.useContext(ObsidianContext);

  const clickOutsideRef = useOnclickOutside(
    () => {
      setIsInputVisible(false);
    },
    {
      ignoreClass: c("ignore-click-outside"),
    }
  );

  const clear = () => {
    setItemTitle("");
    setIsInputVisible(false);
  };

  const createItem = () => {
    const title = itemTitle.trim();
    const processed = processTitle(title, view);

    if (title) {
      const newItem: Item = {
        id: generateInstanceId(),
        title: processed.title,
        titleRaw: title,
        data: {},
        metadata: {
          date: processed.date,
          time: processed.time,
        },
      };

      addItem(newItem);
      setItemTitle("");
    }
  };

  const autocompleteProps = useAutocompleteInputProps({
    isInputVisible,
    onEnter: createItem,
    onEscape: clear,
  });

  if (isInputVisible) {
    return (
      <div ref={clickOutsideRef}>
        <div className={c("item-input-wrapper")}>
          <div data-replicated-value={itemTitle} className={c("grow-wrap")}>
            <textarea
              rows={1}
              value={itemTitle}
              className={c("item-input")}
              placeholder={t("Item title...")}
              onChange={(e) =>
                setItemTitle(e.target.value.replace(/[\r\n]+/g, " "))
              }
              {...autocompleteProps}
            />
          </div>
        </div>
        <div className={c("item-input-actions")}>
          <button className={c("item-action-add")} onClick={createItem}>
            {t("Add item")}
          </button>
          <button className={c("item-action-cancel")} onClick={clear}>
            {t("Cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={c("item-button-wrapper")}>
      <button
        className={c("new-item-button")}
        onClick={() => setIsInputVisible(true)}
      >
        <span className={c("item-button-plus")}>+</span> {t("Add a card")}
      </button>
    </div>
  );
}
