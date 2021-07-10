import ReactDOM from "react-dom";
import React from "react";
import update from "immutability-helper";
import { Icon } from "./components/Icon/Icon";
import { c, generateInstanceId, useIMEInputProps } from "./components/helpers";
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  Droppable,
  DroppableProvided,
  DropResult,
} from "react-beautiful-dnd";
import { t } from "./lang/helpers";
import { DataKey } from "./components/types";

interface ItemProps {
  metadataKey: string;
  label: string;
  shouldHideLabel: boolean;
  containsMarkdown: boolean;
  draggableProvided: DraggableProvided;
  deleteKey: () => void;
  toggleShouldHideLabel: () => void;
  toggleContainsMarkdown: () => void;
  updateKey: (value: string) => void;
  updateLabel: (value: string) => void;
}

function Item({
  draggableProvided,
  metadataKey,
  label,
  shouldHideLabel,
  containsMarkdown,
  toggleShouldHideLabel,
  toggleContainsMarkdown,
  deleteKey,
  updateKey,
  updateLabel,
}: ItemProps) {
  return (
    <div
      ref={draggableProvided.innerRef}
      {...draggableProvided.draggableProps}
      className={c("setting-item")}
    >
      <div className={c("setting-controls-wrapper")}>
        <div className={c("setting-input-wrapper")}>
          <div>
            <div className={c("setting-item-label")}>{t("Metadata key")}</div>
            <input
              type="text"
              value={metadataKey}
              onChange={(e) => updateKey(e.target.value)}
            />
          </div>
          <div>
            <div className={c("setting-item-label")}>{t("Display label")}</div>
            <input
              type="text"
              value={label}
              onChange={(e) => updateLabel(e.target.value)}
            />
          </div>
        </div>
        <div className={c("setting-toggle-wrapper")}>
          <div>
            <div
              className={`checkbox-container ${
                shouldHideLabel ? "is-enabled" : ""
              }`}
              onClick={toggleShouldHideLabel}
              aria-label={t("Hide label")}
            />
            <div className={c("setting-item-label")}>{t("Hide label")}</div>
          </div>
          <div>
            <div
              className={`checkbox-container ${
                containsMarkdown ? "is-enabled" : ""
              }`}
              onClick={toggleContainsMarkdown}
              aria-label={t("Field contains markdown")}
            />
            <div className={c("setting-item-label")}>
              {t("Field contains markdown")}
            </div>
          </div>
        </div>
      </div>
      <div className={c("setting-button-wrapper")}>
        <div onClick={deleteKey} aria-label={t("Delete")}>
          <Icon name="cross" />
        </div>
        <div
          className="mobile-option-setting-drag-icon"
          aria-label={t("Drag to rearrange")}
          {...draggableProvided.dragHandleProps}
        >
          <Icon name="three-horizontal-bars" />
        </div>
      </div>
    </div>
  );
}

interface MetadataSettingsProps {
  dataKeys: DataKey[];
  onChange(keys: DataKey[]): void;
}

interface UseKeyModifiersParams {
  onChange(keys: DataKey[]): void;
  inputValue: string;
  keys: DataKey[];
  setKeys: React.Dispatch<React.SetStateAction<DataKey[]>>;
}

function useKeyModifiers({
  onChange,
  inputValue,
  keys,
  setKeys,
}: UseKeyModifiersParams) {
  const updateKeys = (keys: DataKey[]) => {
    onChange(keys);
    setKeys(keys);
  };

  return {
    updateKey: (i: number) => (value: string) => {
      updateKeys(
        update(keys, {
          [i]: {
            metadataKey: {
              $set: value,
            },
          },
        })
      );
    },

    updateLabel: (i: number) => (value: string) => {
      updateKeys(
        update(keys, {
          [i]: {
            label: {
              $set: value,
            },
          },
        })
      );
    },

    toggleShouldHideLabel: (i: number) => () => {
      updateKeys(
        update(keys, {
          [i]: {
            $toggle: ["shouldHideLabel"],
          },
        })
      );
    },

    toggleContainsMarkdown: (i: number) => () => {
      updateKeys(
        update(keys, {
          [i]: {
            $toggle: ["containsMarkdown"],
          },
        })
      );
    },

    deleteKey: (i: number) => () => {
      updateKeys(
        update(keys, {
          $splice: [[i, 1]],
        })
      );
    },

    newKey: () => {
      updateKeys(
        update(keys, {
          $push: [
            {
              id: generateInstanceId(),
              metadataKey: inputValue,
              label: "",
              shouldHideLabel: false,
              containsMarkdown: false,
            },
          ],
        })
      );
    },

    moveKey: (result: DropResult) => {
      if (!result.destination) {
        return;
      }

      if (result.destination.index === result.source.index) {
        return;
      }

      const clone = keys.slice();
      const [removed] = clone.splice(result.source.index, 1);
      clone.splice(result.destination.index, 0, removed);

      updateKeys(clone);
    },
  };
}

function MetadataSettings(props: MetadataSettingsProps) {
  const [keys, setKeys] = React.useState(props.dataKeys);
  const [inputValue, setInputValue] = React.useState("");
  const { getShouldIMEBlockAction, ...inputProps } = useIMEInputProps();

  const {
    updateKey,
    updateLabel,
    toggleShouldHideLabel,
    toggleContainsMarkdown,
    deleteKey,
    newKey,
    moveKey,
  } = useKeyModifiers({
    onChange: props.onChange,
    inputValue,
    keys,
    setKeys,
  });

  return (
    <>
      <DragDropContext onDragEnd={moveKey}>
        <Droppable
          droppableId="keys"
          renderClone={(draggableProvided, _, rubric) => {
            const i = rubric.source.index;
            const k = keys[i];
            return (
              <Item
                draggableProvided={draggableProvided}
                metadataKey={k.metadataKey}
                label={k.label}
                shouldHideLabel={k.shouldHideLabel}
                containsMarkdown={k.containsMarkdown}
                updateKey={updateKey(i)}
                updateLabel={updateLabel(i)}
                toggleShouldHideLabel={toggleShouldHideLabel(i)}
                toggleContainsMarkdown={toggleContainsMarkdown(i)}
                deleteKey={deleteKey(i)}
              />
            );
          }}
        >
          {(dropProvided: DroppableProvided) => (
            <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
              {keys.map((k, i) => {
                return (
                  <Draggable draggableId={k.id} index={i} key={k.id}>
                    {(draggableProvided: DraggableProvided) => (
                      <Item
                        draggableProvided={draggableProvided}
                        metadataKey={k.metadataKey}
                        label={k.label}
                        shouldHideLabel={k.shouldHideLabel}
                        containsMarkdown={k.containsMarkdown}
                        updateKey={updateKey(i)}
                        updateLabel={updateLabel(i)}
                        toggleShouldHideLabel={toggleShouldHideLabel(i)}
                        toggleContainsMarkdown={toggleContainsMarkdown(i)}
                        deleteKey={deleteKey(i)}
                      />
                    )}
                  </Draggable>
                );
              })}
              {dropProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <div className={c("setting-key-input-wrapper")}>
        <input
          placeholder={t("Metadata key")}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (getShouldIMEBlockAction()) return;

            if (e.key === "Enter") {
              newKey();
              setInputValue("");
              const target = e.target as HTMLInputElement;

              setTimeout(() => {
                target.scrollIntoView();
              });
              return;
            }

            if (e.key === "Escape") {
              setInputValue("");
              (e.target as HTMLInputElement).blur();
            }
          }}
          {...inputProps}
        />
        <button
          onClick={(e) => {
            newKey();
            setInputValue("");
            const target = e.target as HTMLElement;

            setTimeout(() => {
              target.scrollIntoView();
            });
            return;
          }}
        >
          {t("Add key")}
        </button>
      </div>
    </>
  );
}

export function renderMetadataSettings(
  containerEl: HTMLElement,
  keys: DataKey[],
  onChange: (key: DataKey[]) => void
) {
  ReactDOM.render(
    <MetadataSettings dataKeys={keys} onChange={onChange} />,
    containerEl
  );
}

export function cleanupMetadataSettings(containerEl: HTMLElement) {
  ReactDOM.unmountComponentAtNode(containerEl);
}
