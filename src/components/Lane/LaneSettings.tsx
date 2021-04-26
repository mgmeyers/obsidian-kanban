import update from "immutability-helper";
import React from "react";
import { Lane } from "../types";
import { c } from "../helpers";
import { KanbanContext } from "../context";

export interface LaneSettingsProps {
  lane: Lane;
  laneIndex: number;
}

export function LaneSettings({ lane, laneIndex }: LaneSettingsProps) {
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
