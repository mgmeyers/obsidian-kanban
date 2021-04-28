import update from "immutability-helper";
import React from "react";
import { Lane } from "../types";
import { c } from "../helpers";
import { GripIcon } from "../Icon/GripIcon";
import { Icon } from "../Icon/Icon";
import { DraggableProvidedDragHandleProps } from "react-beautiful-dnd";
import { KanbanContext } from "../context";
import { LaneTitle } from "./LaneTitle";
import { LaneSettings } from "./LaneSettings";
import { useSettingsMenu, ConfirmAction } from "./LaneMenu";

interface LaneHeaderProps {
  lane: Lane;
  laneIndex: number;
  dragHandleProps?: DraggableProvidedDragHandleProps;
}

export function LaneHeader({
  lane,
  laneIndex,
  dragHandleProps,
}: LaneHeaderProps) {
  const { boardModifiers } = React.useContext(KanbanContext);
  const [isEditing, setIsEditing] = React.useState(false);

  const { settingsMenu, confirmAction, setConfirmAction } = useSettingsMenu({
    setIsEditing,
  });

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
          isEditing={isEditing}
          itemCount={lane.items.length}
          title={lane.title}
          onChange={(e) =>
            boardModifiers.updateLane(
              laneIndex,
              update(lane, { title: { $set: e.target.value } })
            )
          }
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") {
              e.preventDefault();
              setIsEditing(false);
            }
          }}
        />

        <div className={c("lane-settings-button-wrapper")}>
          {isEditing ? (
            <button
              onClick={() => {
                setIsEditing(false);
              }}
              aria-label="Close"
              className={`${c("lane-settings-button")} is-enabled`}
            >
              <Icon name="cross" />
            </button>
          ) : (
            <button
              aria-label="More options"
              className={c("lane-settings-button")}
              onClick={(e) => {
                settingsMenu.showAtPosition({ x: e.clientX, y: e.clientY });
              }}
            >
              <Icon name="vertical-three-dots" />
            </button>
          )}
        </div>
      </div>

      {isEditing && <LaneSettings lane={lane} laneIndex={laneIndex} />}

      {confirmAction && (
        <ConfirmAction
          lane={lane}
          action={confirmAction}
          onAction={() => {
            switch (confirmAction) {
              case "archive":
                boardModifiers.archiveLane(laneIndex);
                break;
              case "archive-items":
                boardModifiers.archiveLaneItems(laneIndex);
                break;
              case "delete":
                boardModifiers.deleteLane(laneIndex);
                break;
            }

            setConfirmAction(null);
          }}
          cancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}
