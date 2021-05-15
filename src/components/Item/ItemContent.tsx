import { MarkdownRenderer, getLinkpath, moment } from "obsidian";
import React from "react";
import { Item } from "../types";
import { c, getDefaultDateFormat, getDefaultTimeFormat } from "../helpers";
import { ObsidianContext } from "../context";
import { useAutocompleteInputProps } from "./autocomplete";
import { KanbanView } from "src/KanbanView";
import { t } from "src/lang/helpers";

function getRelativeDate(date: moment.Moment, time: moment.Moment) {
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

interface MetadataProps {
  item: Item;
  view: KanbanView;
}

function RelativeDate({ item, view }: MetadataProps) {
  const shouldShowRelativeDate = view.getSetting("show-relative-date");

  if (!shouldShowRelativeDate || !item.metadata.date) {
    return null;
  }

  const relativeDate = getRelativeDate(item.metadata.date, item.metadata.time);

  return (
    <span className={c("item-metadata-date-relative")}>{relativeDate}</span>
  );
}

interface DateAndTimeProps {
  onEditDate?: React.MouseEventHandler;
  onEditTime?: React.MouseEventHandler;
  filePath: string;
}

function DateAndTime({
  item,
  view,
  filePath,
  onEditDate,
  onEditTime,
}: MetadataProps & DateAndTimeProps) {
  const hideDateDisplay = view.getSetting("hide-date-display");

  if (hideDateDisplay || !item.metadata.date) return null;

  const dateFormat =
    view.getSetting("date-format") || getDefaultDateFormat(view.app);
  const timeFormat =
    view.getSetting("time-format") || getDefaultTimeFormat(view.app);
  const dateDisplayFormat =
    view.getSetting("date-display-format") || dateFormat;
  const shouldLinkDate = view.getSetting("link-date-to-daily-note");

  const dateStr = item.metadata.date.format(dateFormat);

  if (!dateStr) return null;

  const hasTime = !!item.metadata.time;
  const dateDisplayStr = item.metadata.date.format(dateDisplayFormat);
  const timeDisplayStr = !hasTime
    ? null
    : item.metadata.time.format(timeFormat);

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

export interface ItemContentProps {
  item: Item;
  isSettingsVisible: boolean;
  setIsSettingsVisible?: React.Dispatch<boolean>;
  onEditDate?: React.MouseEventHandler;
  onEditTime?: React.MouseEventHandler;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}

export function ItemContent({
  item,
  isSettingsVisible,
  setIsSettingsVisible,
  onEditDate,
  onEditTime,
  onChange,
}: ItemContentProps) {
  const obsidianContext = React.useContext(ObsidianContext);
  const inputRef = React.useRef<HTMLTextAreaElement>();

  const { view, filePath } = obsidianContext;

  const onAction = () => setIsSettingsVisible && setIsSettingsVisible(false);

  const autocompleteProps = useAutocompleteInputProps({
    isInputVisible: isSettingsVisible,
    onEnter: onAction,
    onEscape: onAction,
  });

  const markdownContent = React.useMemo(() => {
    const tempEl = createDiv();
    MarkdownRenderer.renderMarkdown(item.title, tempEl, filePath, view);

    return {
      innerHTML: { __html: tempEl.innerHTML.toString() },
    };
  }, [item, filePath, view]);

  if (isSettingsVisible) {
    return (
      <div data-replicated-value={item.titleRaw} className={c("grow-wrap")}>
        <textarea
          rows={1}
          ref={inputRef}
          className={c("item-input")}
          value={item.titleRaw}
          onChange={onChange}
          {...autocompleteProps}
        />
      </div>
    );
  }

  return (
    <div className={c("item-title")}>
      <div
        className={`markdown-preview-view ${c("item-markdown")}`}
        dangerouslySetInnerHTML={markdownContent.innerHTML}
      />
      <div className={c("item-metadata")}>
        <RelativeDate item={item} view={view} />
        <DateAndTime
          item={item}
          view={view}
          filePath={filePath}
          onEditDate={onEditDate}
          onEditTime={onEditTime}
        />
      </div>
    </div>
  );
}
