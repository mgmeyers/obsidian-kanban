import { getLinkpath, moment } from "obsidian";
import React from "react";
import useBus from "use-bus";

import { Item, PageData } from "../types";
import { c, getDefaultDateFormat, getDefaultTimeFormat } from "../helpers";
import { ObsidianContext } from "../context";
import { useAutocompleteInputProps } from "./autocomplete";
import { KanbanView } from "src/KanbanView";
import { t } from "src/lang/helpers";
import { MarkdownRenderer } from "../MarkdownRenderer";

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

interface MetadataValueProps {
  data: PageData;
  searchQuery: string;
}

function MetadataValue({ data, searchQuery }: MetadataValueProps) {
  if (Array.isArray(data.value)) {
    return (
      <span className={c("meta-value")}>
        {data.value.map((v, i, arr) => {
          const str = `${v}`;
          const linkPath = typeof v === "object" && (v as any).path;
          const isMatch = str.toLocaleLowerCase().contains(searchQuery);

          return (
            <>
              {linkPath || data.containsMarkdown ? (
                <MarkdownRenderer
                  className="inline"
                  markdownString={linkPath ? `[[${linkPath}]]` : str}
                  searchQuery={searchQuery}
                />
              ) : isMatch ? (
                <span className="is-search-match">{str}</span>
              ) : (
                str
              )}
              {i < arr.length - 1 ? <span>{", "}</span> : ""}
            </>
          );
        })}
      </span>
    );
  }

  const str = `${data.value}`;
  const isMatch = str.toLocaleLowerCase().contains(searchQuery);
  const linkPath = typeof data.value === "object" && (data.value as any).path;

  return (
    <span
      className={`${c("meta-value")} ${
        isMatch && !data.containsMarkdown ? "is-search-match" : ""
      }`}
    >
      {data.containsMarkdown || !!linkPath ? (
        <MarkdownRenderer
          markdownString={linkPath ? `[[${linkPath}]]` : str}
          searchQuery={searchQuery}
        />
      ) : (
        str
      )}
    </span>
  );
}

interface LinkedPageMetadataProps {
  metadata: { [k: string]: PageData } | null;
  searchQuery?: string;
}

function LinkedPageMetadata({
  metadata,
  searchQuery,
}: LinkedPageMetadataProps) {
  if (!metadata) return null;

  return (
    <table className={c("meta-table")}>
      <tbody>
        {Object.keys(metadata).map((k) => {
          const data = metadata[k];
          return (
            <tr key={k} className={c("meta-row")}>
              {!data.shouldHideLabel && (
                <td
                  className={`${c("meta-key")} ${
                    (data.label || k).toLocaleLowerCase().contains(searchQuery)
                      ? "is-search-match"
                      : ""
                  }`}
                  data-key={k}
                >
                  <span>{data.label || k}</span>
                </td>
              )}
              <td
                colSpan={data.shouldHideLabel ? 2 : 1}
                className={c("meta-value-wrapper")}
                data-value={
                  Array.isArray(data.value)
                    ? data.value.join(", ")
                    : `${data.value}`
                }
              >
                {k === "tags" ? (
                  (data.value as string[]).map((tag, i) => {
                    return (
                      <a
                        href={tag}
                        key={i}
                        className={`tag ${c("item-tag")} ${
                          tag.toLocaleLowerCase().contains(searchQuery)
                            ? "is-search-match"
                            : ""
                        }`}
                      >
                        <span>{tag[0]}</span>
                        {tag.slice(1)}
                      </a>
                    );
                  })
                ) : (
                  <MetadataValue data={data} searchQuery={searchQuery} />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export interface ItemMetadataProps {
  item: Item;
  isSettingsVisible: boolean;
  searchQuery?: string;
  refreshItem: () => void;
}

export function ItemMetadata({
  item,
  isSettingsVisible,
  refreshItem,
  searchQuery,
}: ItemMetadataProps) {
  useBus(
    `metadata:update:${item.metadata.file?.path || "null"}`,
    () => refreshItem(),
    [item.metadata.file]
  );

  if (isSettingsVisible || !item.metadata.fileMetadata) return null;

  return (
    <div className={c("item-metadata-wrapper")}>
      <LinkedPageMetadata
        metadata={item.metadata.fileMetadata}
        searchQuery={searchQuery}
      />
    </div>
  );
}

export interface ItemContentProps {
  item: Item;
  isSettingsVisible: boolean;
  setIsSettingsVisible?: React.Dispatch<boolean>;
  searchQuery?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onEditDate?: React.MouseEventHandler;
  onEditTime?: React.MouseEventHandler;
}

export const ItemContent = React.memo(
  ({
    item,
    isSettingsVisible,
    setIsSettingsVisible,
    searchQuery,
    onChange,
    onEditDate,
    onEditTime,
  }: ItemContentProps) => {
    const { view, filePath } = React.useContext(ObsidianContext);
    const inputRef = React.useRef<HTMLTextAreaElement>();
    const onAction = () => setIsSettingsVisible && setIsSettingsVisible(false);
    const hideTagsDisplay = view.getSetting("hide-tags-display");

    const autocompleteProps = useAutocompleteInputProps({
      isInputVisible: isSettingsVisible,
      onEnter: onAction,
      onEscape: onAction,
    });

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
        <MarkdownRenderer
          className={c("item-markdown")}
          markdownString={item.title}
          searchQuery={searchQuery}
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
          {!hideTagsDisplay && !!item.metadata.tags?.length && (
            <div className={c("item-tags")}>
              {item.metadata.tags.map((tag, i) => {
                return (
                  <a
                    href={tag}
                    key={i}
                    className={`tag ${c("item-tag")} ${
                      tag.toLocaleLowerCase().contains(searchQuery)
                        ? "is-search-match"
                        : ""
                    }`}
                  >
                    <span>{tag[0]}</span>
                    {tag.slice(1)}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
);
