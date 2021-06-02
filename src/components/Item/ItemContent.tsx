import { MarkdownRenderer, getLinkpath, moment, TFile } from "obsidian";
import React from "react";
import Mark from "mark.js";
import useBus from "use-bus";

import { Item } from "../types";
import { c, getDefaultDateFormat, getDefaultTimeFormat } from "../helpers";
import { ObsidianContext } from "../context";
import { useAutocompleteInputProps } from "./autocomplete";
import { KanbanView } from "src/KanbanView";
import { t } from "src/lang/helpers";
import { DataKey } from "src/MetadataSettings";

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

interface PageData extends DataKey {
  value: string | number | Array<string | number>;
}

function getDataViewCache(view: KanbanView, file: TFile) {
  if (
    (view.app as any).plugins.enabledPlugins.has("dataview") &&
    (view.app as any).plugins?.plugins?.dataview?.api
  ) {
    return (view.app as any).plugins.plugins.dataview.api.page(
      file.path,
      view.file.path
    );
  }
}

function getLinkedPageMetadata(
  file: TFile | null | undefined,
  view: KanbanView
) {
  const globalKeys =
    (view.getGlobalSetting("metadata-keys") as DataKey[]) || [];
  const localKeys = (view.getSetting("metadata-keys") as DataKey[]) || [];
  const keys = [...globalKeys, ...localKeys];

  if (!keys.length) {
    return null;
  }

  if (!file) {
    return null;
  }

  const cache = view.app.metadataCache.getFileCache(file);
  const dataviewCache = getDataViewCache(view, file);

  if (!cache && !dataviewCache) {
    return false;
  }

  const metadata: { [k: string]: PageData } = {};
  const seenTags: { [k: string]: boolean } = {};
  const seenKey: { [k: string]: boolean } = {};

  let haveData = false;

  keys.forEach((k) => {
    if (seenKey[k.metadataKey]) return;

    seenKey[k.metadataKey] = true;

    if (k.metadataKey === "tags") {
      let tags = cache.tags || [];

      if (cache.frontmatter?.tags) {
        tags = [].concat(
          tags,
          cache.frontmatter.tags.map((tag: string) => ({ tag: `#${tag}` }))
        );
      }

      if (tags?.length === 0) return;

      metadata.tags = {
        ...k,
        value: tags
          .map((t) => t.tag)
          .filter((t) => {
            if (seenTags[t]) {
              return false;
            }

            seenTags[t] = true;
            return true;
          }),
      };

      haveData = true;
      return;
    }

    if (cache.frontmatter && cache.frontmatter[k.metadataKey]) {
      metadata[k.metadataKey] = {
        ...k,
        value: cache.frontmatter[k.metadataKey],
      };
      haveData = true;
    } else if (dataviewCache && dataviewCache[k.metadataKey]) {
      metadata[k.metadataKey] = {
        ...k,
        value: dataviewCache[k.metadataKey],
      };
      haveData = true;
    }
  });

  return haveData ? metadata : null;
}

function LinkedPageMetadata({
  metadata,
}: {
  metadata: { [k: string]: PageData } | null;
}) {
  if (!metadata) return null;

  return (
    <table className={c("meta-table")}>
      <tbody>
        {Object.keys(metadata).map((k) => {
          const data = metadata[k];
          return (
            <tr key={k} className={c("meta-row")}>
              {!data.shouldHideLabel && (
                <td className={c("meta-key")}>{data.label || k}</td>
              )}
              <td
                colSpan={data.shouldHideLabel ? 2 : 1}
                className={c("meta-value")}
              >
                {k === "tags"
                  ? (data.value as string[]).map((tag, i) => {
                      return (
                        <a
                          href={tag}
                          key={i}
                          className={`tag ${c("item-tag")}`}
                        >
                          {tag}
                        </a>
                      );
                    })
                  : data.value.toString()}
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
}

export const ItemMetadata = React.memo(
  ({ item, isSettingsVisible }: ItemMetadataProps) => {
    const [, forceUpdate] = React.useState(Date.now());
    const { view } = React.useContext(ObsidianContext);

    useBus(
      `metadata:update:${item.metadata.file?.path || "null"}`,
      () => forceUpdate(Date.now()),
      [item.metadata.file]
    );

    const metadata = getLinkedPageMetadata(item.metadata.file, view);

    if (isSettingsVisible || !metadata) return null;

    return (
      <div className={c("item-metadata-wrapper")}>
        <LinkedPageMetadata metadata={metadata} />
      </div>
    );
  }
);

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

    const markdownContent = React.useMemo(() => {
      const tempEl = createDiv();
      MarkdownRenderer.renderMarkdown(item.title, tempEl, filePath, view);

      tempEl.findAll(".internal-embed").forEach(el => {
        const src = el.getAttribute("src");
        const target = typeof src === "string" && view.app.metadataCache.getFirstLinkpathDest(src, filePath);
        if (target instanceof TFile && target.extension !== "md") {
          el.innerText = '';
          el.createEl("img", {attr: {src: view.app.vault.getResourcePath(target)}}, img => {
            if (el.hasAttribute("width")) img.setAttribute("width", el.getAttribute("width"));
            if (el.hasAttribute("alt"))   img.setAttribute("alt",   el.getAttribute("alt"));
          })
          el.addClasses(["image-embed", "is-loaded"]);
        }
      });

      if (searchQuery) {
        new Mark(tempEl).mark(searchQuery);
      }

      return {
        innerHTML: { __html: tempEl.innerHTML.toString() },
      };
    }, [item, filePath, view, searchQuery]);

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
          {!hideTagsDisplay && !!item.metadata.tags?.length && (
            <div className={c("item-tags")}>
              {item.metadata.tags.map((tag, i) => {
                return (
                  <a href={tag} key={i} className={`tag ${c("item-tag")}`}>
                    {tag}
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
