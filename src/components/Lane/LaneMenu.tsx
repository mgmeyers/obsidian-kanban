import React from "react";
import { Lane } from "../types";
import { c } from "../helpers";
import { ObsidianContext } from "../context";
import { Menu } from "obsidian";

export type LaneAction = "delete" | "archive" | "archive-items" | null;

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

export interface ConfirmActionProps {
  lane: Lane;
  action: LaneAction;
  cancel: () => void;
  onAction: () => void;
}

export function ConfirmAction({
  action,
  cancel,
  onAction,
  lane,
}: ConfirmActionProps) {
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

export interface UseSettingsMenuParams {
  setIsEditing: React.Dispatch<boolean>;
}

export function useSettingsMenu({ setIsEditing }: UseSettingsMenuParams) {
  const { view } = React.useContext(ObsidianContext);
  const [confirmAction, setConfirmAction] = React.useState<LaneAction>(null);

  const settingsMenu = React.useMemo(() => {
    return new Menu(view.app)
      .addItem((item) => {
        item
          .setIcon("pencil")
          .setTitle("Edit list")
          .onClick(() => setIsEditing(true));
      })
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
