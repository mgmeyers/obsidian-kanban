import update from "immutability-helper";
import React from "react";
import { Lane } from "../types";
import { c } from "../helpers";
import { ObsidianContext } from "../context";
import { t } from "src/lang/helpers";

export interface LaneSettingsProps {
  lane: Lane;
  laneIndex: number;
}

export function LaneSettings({ lane, laneIndex }: LaneSettingsProps) {
  const { boardModifiers } = React.useContext(ObsidianContext);

  return (
    <div className={c("lane-setting-wrapper")}>
      <div className={c("checkbox-wrapper")}>
        <div className={c("checkbox-label")}>
          {t("Mark items in this list as complete")}
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
