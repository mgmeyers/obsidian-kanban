import React from "react";
import { Lane } from "../types";
import { c, generateInstanceId, useIMEInputProps } from "../helpers";
import { KanbanContext } from "../context";
import useOnclickOutside from "react-cool-onclickoutside";

export function LaneForm() {
  const { boardModifiers } = React.useContext(KanbanContext);
  const [isInputVisible, setIsInputVisible] = React.useState(false);
  const [shouldMarkAsComplete, setShouldMarkAsComplete] = React.useState(false);
  const [laneTitle, setLaneTitle] = React.useState("");

  const inputRef = React.useRef<HTMLTextAreaElement>();
  const clickOutsideRef = useOnclickOutside(
    () => {
      setIsInputVisible(false);
    },
    {
      ignoreClass: c("ignore-click-outside"),
    }
  );

  const { getShouldIMEBlockAction, ...inputProps } = useIMEInputProps();

  React.useEffect(() => {
    if (isInputVisible) {
      inputRef.current?.focus();
    }
  }, [isInputVisible]);

  const clear = () => {
    setLaneTitle("");
    setShouldMarkAsComplete(false);
    setIsInputVisible(false);
  };

  const createLane = () => {
    const newLane: Lane = {
      id: generateInstanceId(),
      title: laneTitle,
      items: [],
      data: {
        shouldMarkItemsComplete: shouldMarkAsComplete,
      },
    };

    boardModifiers.addLane(newLane);
    clear();
  };

  if (isInputVisible) {
    return (
      <div ref={clickOutsideRef} className={c("lane")}>
        <div className={c("lane-input-wrapper")}>
          <div data-replicated-value={laneTitle} className={c("grow-wrap")}>
            <textarea
              rows={1}
              value={laneTitle}
              ref={inputRef}
              className={c("lane-input")}
              placeholder="Enter list title..."
              onChange={(e) => setLaneTitle(e.target.value)}
              onKeyDown={(e) => {
                if (getShouldIMEBlockAction()) return;

                if (e.key === "Enter") {
                  e.preventDefault();
                  createLane();
                } else if (e.key === "Escape") {
                  clear();
                }
              }}
              {...inputProps}
            />
          </div>
        </div>
        <div className={c("checkbox-wrapper")}>
          <div className={c("checkbox-label")}>
            Mark items in this list as complete
          </div>
          <div
            onClick={() => setShouldMarkAsComplete(!shouldMarkAsComplete)}
            className={`checkbox-container ${
              shouldMarkAsComplete ? "is-enabled" : ""
            }`}
          />
        </div>
        <div className={c("lane-input-actions")}>
          <button className={c("lane-action-add")} onClick={createLane}>
            Add list
          </button>
          <button className={c("lane-action-cancel")} onClick={clear}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={c("new-lane-button-wrapper")}>
      <button
        className={c("new-lane-button")}
        onClick={() => setIsInputVisible(true)}
      >
        <span className={c("new-lane-button-plus")}>+</span> Add a list
      </button>
    </div>
  );
}
