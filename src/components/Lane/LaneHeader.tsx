import update from "immutability-helper";
import React from "react";
import { Lane } from "../types";
import { c, useIMEInputProps } from "../helpers";
import { GripIcon } from "../Icon/GripIcon";
import { Icon } from "../Icon/Icon";
import { DraggableProvidedDragHandleProps } from "react-beautiful-dnd";
import { KanbanContext, ObsidianContext } from "../context";
import { Menu } from "obsidian";

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
  const { getShouldIMEBlockAction, ...inputProps } = useIMEInputProps();

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
              onKeyDown={(e) => {
                if (getShouldIMEBlockAction()) return;
                onKeyDown(e);
              }}
              {...inputProps}
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
}

function LaneSettings({ lane, laneIndex }: LaneSettingsProps) {
  const { boardModifiers } = React.useContext(KanbanContext);

  return (
    <div className={c("lane-setting-wrapper")}>
      <div className={c("checkbox-wrapper")}>
        <div className={c("checkbox-label")}>
          Mark items in this list as complete
        </div>
        <div
          onClick={() =>
            boardModifiers.updateLane(
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
    </div>
  );
}

type LaneAction = "delete" | "archive" | "archive-items" | null;

const actionLabels = {
  delete: {
    description: "Are you sure you want to delete this list and all its cards?",
    confirm: "Yes, delete list",
  },
  archive: {
    description:
      "Are you sure you want to archive this list and all its cards?",
    confirm: "Yes, archive list",
  },
  "archive-items": {
    description: "Are you sure you want to archive all cards in this list?",
    confirm: "Yes, archive cards",
  },
};

interface ConfirmActionProps {
  lane: Lane;
  action: LaneAction;
  cancel: () => void;
  onAction: () => void;
}

function ConfirmAction({ action, cancel, onAction, lane }: ConfirmActionProps) {
  React.useEffect(() => {
    // Immediately execute action if lane is empty
    if (action && lane.items.length === 0) {
      onAction();
    }
  }, [action, lane.items.length]);

  if (!action || (action && lane.items.length === 0)) return null;

  return (
    <div className={c("action-confirm-wrapper")}>
      <div className={c("action-confirm-text")}>
        {actionLabels[action].description}
      </div>
      <div>
        <button onClick={onAction} className={c("confirm-action-button")}>
          {actionLabels[action].confirm}
        </button>
        <button onClick={cancel} className={c("cancel-action-button")}>
          Cancel
        </button>
      </div>
    </div>
  );
}

interface LaneHeaderProps {
  lane: Lane;
  laneIndex: number;
  dragHandleProps?: DraggableProvidedDragHandleProps;
}

function useSettingsMenu() {
  const { view } = React.useContext(ObsidianContext);
  const [confirmAction, setConfirmAction] = React.useState<LaneAction>(null);

  const settingsMenu = React.useMemo(() => {
    return new Menu(view.app)
      .addItem((item) => {
        item
          .setIcon("documents")
          .setTitle("Archive cards")
          .onClick(() => setConfirmAction("archive-items"));
      })
      .addSeparator()
      .addItem((item) => {
        item
          .setIcon("sheets-in-box")
          .setTitle("Archive list")
          .onClick(() => setConfirmAction("archive"));
      })
      .addItem((item) => {
        item
          .setIcon("trash")
          .setTitle("Delete list")
          .onClick(() => setConfirmAction("delete"));
      });
  }, [view, setConfirmAction]);

  return {
    settingsMenu,
    confirmAction,
    setConfirmAction,
  };
}

export function LaneHeader({
  lane,
  laneIndex,
  dragHandleProps,
}: LaneHeaderProps) {
  const { boardModifiers } = React.useContext(KanbanContext);
  const [isSettingsVisible, setIsSettingsVisible] = React.useState(false);

  const { settingsMenu, confirmAction, setConfirmAction } = useSettingsMenu();

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
            boardModifiers.updateLane(
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
            aria-label={isSettingsVisible ? "Close settings" : "Edit list"}
            className={`${c("lane-settings-button")} ${
              isSettingsVisible ? "is-enabled" : ""
            }`}
          >
            <Icon name={isSettingsVisible ? "cross" : "pencil"} />
          </button>
          <button
            aria-label="More options"
            className={c("lane-settings-button")}
            onClick={(e) => {
              settingsMenu.showAtPosition({ x: e.clientX, y: e.clientY });
            }}
          >
            <Icon name="vertical-three-dots" />
          </button>
        </div>
      </div>

      {isSettingsVisible && <LaneSettings lane={lane} laneIndex={laneIndex} />}

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
