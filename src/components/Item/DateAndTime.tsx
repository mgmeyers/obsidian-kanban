import { getLinkpath, moment } from "obsidian";
import React from "react";

import { Item } from "../types";
import { c, getDefaultDateFormat, getDefaultTimeFormat } from "../helpers";
import { KanbanView } from "src/KanbanView";
import { t } from "src/lang/helpers";

export function getRelativeDate(date: moment.Moment, time: moment.Moment) {
  if (time) {
    return time.from(moment());
  }

  const today = moment().startOf("day");

  if (today.isSame(date, "day")) {
    return t("today");
  }

  const diff = date.diff(today, "day");

  if (diff === -1) {
    return t("yesterday");
  }

  if (diff === 1) {
    return t("tomorrow");
  }

  return date.from(today);
}

interface DateProps {
  item: Item;
  view: KanbanView;
}

export function RelativeDate({ item, view }: DateProps) {
  const shouldShowRelativeDate = view.getSetting("show-relative-date");

  if (!shouldShowRelativeDate || !item.data.metadata.date) {
    return null;
  }

  const relativeDate = getRelativeDate(
    item.data.metadata.date,
    item.data.metadata.time
  );

  return (
    <span className={c("item-metadata-date-relative")}>{relativeDate}</span>
  );
}

interface DateAndTimeProps {
  onEditDate?: React.MouseEventHandler;
  onEditTime?: React.MouseEventHandler;
  filePath: string;
}

export function DateAndTime({
  item,
  view,
  filePath,
  onEditDate,
  onEditTime,
}: DateProps & DateAndTimeProps) {
  const hideDateDisplay = view.getSetting("hide-date-display");

  if (hideDateDisplay || !item.data.metadata.date) return null;

  const dateFormat =
    view.getSetting("date-format") || getDefaultDateFormat(view.app);
  const timeFormat =
    view.getSetting("time-format") || getDefaultTimeFormat(view.app);
  const dateDisplayFormat =
    view.getSetting("date-display-format") || dateFormat;
  const shouldLinkDate = view.getSetting("link-date-to-daily-note");

  const dateStr = item.data.metadata.date.format(dateFormat);

  if (!dateStr) return null;

  const hasTime = !!item.data.metadata.time;
  const dateDisplayStr = item.data.metadata.date.format(dateDisplayFormat);
  const timeDisplayStr = !hasTime
    ? null
    : item.data.metadata.time.format(timeFormat);

  const datePath = dateStr ? getLinkpath(dateStr) : null;
  const isResolved = dateStr
    ? view.app.metadataCache.getFirstLinkpathDest(datePath, filePath)
    : null;
  const date =
    datePath && shouldLinkDate ? (
      <a
        href={datePath}
        data-href={datePath}
        className={`internal-link ${isResolved ? "" : "is-unresolved"}`}
        target="blank"
        rel="noopener"
      >
        {dateDisplayStr}
      </a>
    ) : (
      dateDisplayStr
    );

  const dateProps: React.HTMLAttributes<HTMLSpanElement> = {};

  if (!shouldLinkDate) {
    dateProps["aria-label"] = t("Change date");
    dateProps.onClick = onEditDate;
  }

  return (
    <span className={c("item-metadata-date-wrapper")}>
      <span
        {...dateProps}
        className={`${c("item-metadata-date")} ${
          !shouldLinkDate ? "is-button" : ""
        }`}
      >
        {date}
      </span>{" "}
      {hasTime && (
        <span
          onClick={onEditTime}
          className={`${c("item-metadata-time")} is-button`}
          aria-label={t("Change time")}
        >
          {timeDisplayStr}
        </span>
      )}
    </span>
  );
}
