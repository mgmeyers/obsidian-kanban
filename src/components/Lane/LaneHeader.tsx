import update from "immutability-helper";
import React from "react";
import { Lane } from "../types";
import { c } from "../helpers";
import { GripIcon } from "../Icon/GripIcon";
import { Icon } from "../Icon/Icon";
import { DraggableProvidedDragHandleProps } from "react-beautiful-dnd";

interface LaneTitleProps {
  title: string;
  isSettingsVisible: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
}

function LaneTitle({
  isSettingsVisible,
  title,
  onChange,
  onKeyDown,
}: LaneTitleProps) {
  return (
    <div className={c("lane-title")}>
      {isSettingsVisible ? (
        <div className={c("lane-title")}>
          <input
            value={title}
            className={c("lane-input")}
            type="text"
            placeholder="Enter list title..."
            onChange={onChange}
            onKeyDown={onKeyDown}
          />
        </div>
      ) : (
        title
      )}
    </div>
  );
}

interface LaneSettingsProps {
  lane: Lane;
  laneIndex: number;
  updateLane: (laneIndex: number, newLane: Lane) => void;
  deleteLane: (laneIndex: number) => void;
}

function LaneSettings({
  lane,
  laneIndex,
  updateLane,
  deleteLane,
}: LaneSettingsProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);

  const deleteButton = isConfirmingDelete ? (
    <div className={c("delete-confirm-wrapper")}>
      <div className={c("delete-confirm-text")}>
        Are you sure you want to delete this list and all its cards?
      </div>
      <div>
        <button
          onClick={() => deleteLane(laneIndex)}
          className={c("confirm-delete-button")}
        >
          Yes, delete list
        </button>
        <button
          onClick={() => setIsConfirmingDelete(false)}
          className={c("cancel-delete-button")}
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => {
        if (lane.items.length == 0) {
          deleteLane(laneIndex);
        } else {
          // Confirm if items will be deleted when the lane is deleted
          setIsConfirmingDelete(true);
        }
      }}
      className={c("delete-lane-button")}
    >
      <Icon name="trash" /> Delete List
    </button>
  );

  return (
    <div className={c("lane-setting-wrapper")}>
      <div className={c("checkbox-wrapper")}>
        <div className={c("checkbox-label")}>
          Mark items in this list as complete
        </div>
        <div
          onClick={() =>
            updateLane(
              laneIndex,
              update(lane, {
                data: { $toggle: ["shouldMarkItemsComplete"] },
              })
            )
          }
          className={`checkbox-container ${
            lane.data.shouldMarkItemsComplete ? "is-enabled" : ""
          }`}
        />
      </div>
      <div className={c("delete-lane-wrapper")}>{deleteButton}</div>
    </div>
  );
}

interface LaneHeaderProps {
  lane: Lane;
  laneIndex: number;
  dragHandleProps?: DraggableProvidedDragHandleProps;
  updateLane: (laneIndex: number, newLane: Lane) => void;
  deleteLane: (laneIndex: number) => void;
}

export function LaneHeader({
  lane,
  laneIndex,
  dragHandleProps,
  updateLane,
  deleteLane,
}: LaneHeaderProps) {
  const [isSettingsVisible, setIsSettingsVisible] = React.useState(false);

  return (
    <>
      <div className={c("lane-header-wrapper")}>
        <div
          className={c("lane-grip")}
          {...dragHandleProps}
          aria-label="Move list"
        >
          <GripIcon />
        </div>

        <LaneTitle
          isSettingsVisible={isSettingsVisible}
          title={lane.title}
          onChange={(e) =>
            updateLane(
              laneIndex,
              update(lane, { title: { $set: e.target.value } })
            )
          }
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsSettingsVisible(false);
            }
          }}
        />

        <div className={c("lane-settings-button-wrapper")}>
          <button
            onClick={() => {
              setIsSettingsVisible(!isSettingsVisible);
            }}
            aria-label="List settings"
            className={`${c("lane-settings-button")} ${
              isSettingsVisible ? "is-enabled" : ""
            }`}
          >
            <Icon name="gear" />
          </button>
        </div>
      </div>

      {isSettingsVisible && (
        <LaneSettings
          lane={lane}
          laneIndex={laneIndex}
          updateLane={updateLane}
          deleteLane={deleteLane}
        />
      )}
    </>
  );
}
