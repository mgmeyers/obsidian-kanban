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
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
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
          <div data-replicated-value={title} className={c("grow-wrap")}>
            <textarea
              rows={1}
              value={title}
              className={c("lane-input")}
              placeholder="Enter list title..."
              onChange={onChange}
              onKeyDown={onKeyDown}
            />
          </div>
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
  archiveLane: (laneIndex: number) => void;
}

function LaneSettings({
  lane,
  laneIndex,
  updateLane,
  deleteLane,
  archiveLane,
}: LaneSettingsProps) {
  const [confirmAction, setConfirmAction] = React.useState<
    "delete" | "archive" | null
  >(null);

  const actionButtons = confirmAction ? (
    <div className={c("action-confirm-wrapper")}>
      <div className={c("action-confirm-text")}>
        Are you sure you want to {confirmAction} this list and all its cards?
      </div>
      <div>
        <button
          onClick={() => {
            if (confirmAction === "delete") deleteLane(laneIndex);
            if (confirmAction === "archive") archiveLane(laneIndex);
          }}
          className={c("confirm-action-button")}
        >
          Yes, {confirmAction} list
        </button>
        <button
          onClick={() => setConfirmAction(null)}
          className={c("cancel-action-button")}
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <>
      <button
        onClick={() => {
          if (lane.items.length == 0) {
            deleteLane(laneIndex);
          } else {
            // Confirm if items will be deleted when the lane is deleted
            setConfirmAction("delete");
          }
        }}
        className={c("delete-lane-button")}
      >
        <Icon name="trash" /> Delete List
      </button>
      <button
        onClick={() => {
          if (lane.items.length == 0) {
            deleteLane(laneIndex);
          } else {
            // Confirm if items will be deleted when the lane is deleted
            setConfirmAction("archive");
          }
        }}
        className={c("archive-lane-button")}
      >
        <Icon name="sheets-in-box" /> Archive List
      </button>
    </>
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
      <div className={c("lane-action-wrapper")}>{actionButtons}</div>
    </div>
  );
}

interface LaneHeaderProps {
  lane: Lane;
  laneIndex: number;
  dragHandleProps?: DraggableProvidedDragHandleProps;
  updateLane: (laneIndex: number, newLane: Lane) => void;
  deleteLane: (laneIndex: number) => void;
  archiveLane: (laneIndex: number) => void;
}

export function LaneHeader({
  lane,
  laneIndex,
  dragHandleProps,
  updateLane,
  deleteLane,
  archiveLane,
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
            if (e.key === "Escape" || e.key === "Enter") {
              e.preventDefault();
              setIsSettingsVisible(false);
            }
          }}
        />

        <div className={c("lane-settings-button-wrapper")}>
          <button
            onClick={() => {
              setIsSettingsVisible(!isSettingsVisible);
            }}
            aria-label={isSettingsVisible ? "Close settings" : "List settings"}
            className={`${c("lane-settings-button")} ${
              isSettingsVisible ? "is-enabled" : ""
            }`}
          >
            <Icon name={isSettingsVisible ? "cross" : "gear"} />
          </button>
        </div>
      </div>

      {isSettingsVisible && (
        <LaneSettings
          lane={lane}
          laneIndex={laneIndex}
          updateLane={updateLane}
          deleteLane={deleteLane}
          archiveLane={archiveLane}
        />
      )}
    </>
  );
}
