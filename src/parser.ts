import { MarkdownRenderer, moment, TFile } from "obsidian";
import {
  escapeRegExpStr,
  generateInstanceId,
  getDefaultDateFormat,
  getDefaultTimeFormat,
} from "./components/helpers";
import { Board, FileMetadata, Item, Lane } from "./components/types";
import { KanbanSettings } from "./Settings";
import { defaultDateTrigger, defaultTimeTrigger } from "./settingHelpers";
import yaml from "js-yaml";
import { KanbanView } from "./KanbanView";
import { t } from "./lang/helpers";

export const frontMatterKey = "kanban-plugin";

const frontmatterRegEx = /^---([\w\W]+?)\n---/;
const newLineRegex = /[\r\n]+/g;

// Begins with one or more # followed by a space
const laneRegex = /^#+\s+(.+)$/;

/**
 * Match groups:
 *
 * 1. indent
 * 2. bulletChar
 * 3. boxChar
 * 4. content
 */
const taskRegex = /^([\s\t]*)([-+*])\s+\[([^\]]+)]\s+(.+)$/;

/**
 * Match groups:
 *
 * 1. indent
 * 2. bulletChar
 * 3. content
 */
const listRegex = /^([\s\t]*)([-+*])\s+?(.+)$/;

const completeString = `**${t("Complete")}**`;
const completeRegex = new RegExp(`^${escapeRegExpStr(completeString)}$`, "i");
const archiveString = "***";
const archiveMarkerRegex = /^\*\*\*$/;
const tagRegex = /(^|\s)(#[^#\s]+)/g;
const linkRegex = /\[\[([^\|\]]+)(?:\||\]\])/;


export type ParserSettings = {
  dateFormat: KanbanSettings["date-format"];
  timeFormat: KanbanSettings["time-format"];
  dateTrigger: KanbanSettings["date-trigger"];
  timeTrigger: KanbanSettings["time-trigger"];
  shouldLinkDate: KanbanSettings["link-date-to-daily-note"];
  shouldHideDate: KanbanSettings["hide-date-in-title"];
  shouldHideTags: KanbanSettings["hide-tags-in-title"];
  metaKeys: KanbanSettings["metadata-keys"];
  dateRegEx: RegExp;
  timeRegEx: RegExp;
}

export class KanbanParser {

  settings: ParserSettings
  constructor(public view: KanbanView) {}

  itemToMd(item: Item) {
    return `- [${item.data.isComplete ? "x" : " "}] ${item.titleRaw}`;
  }

  getSearchTitle(
    title: string,
    tags?: string[],
    fileMetadata?: FileMetadata
  ) {
    const tempEl = this.view.renderMarkdown(title);

    let searchTitle = tempEl.innerText.trim();

    if (tags?.length) {
      searchTitle += " " + tags.join(" ");
    }

    if (fileMetadata) {
      const keys = Object.keys(fileMetadata).join(" ");
      const values = Object.values(fileMetadata)
        .map((v) => {
          if (Array.isArray(v.value)) {
            return v.value.join(" ");
          }

          return v.value.toString();
        })
        .join(" ");

      searchTitle += " " + keys + " " + values;
    }

    return searchTitle;
  }

  extractDates(
    title: string,
  ) {
    let date: undefined | moment.Moment = undefined;
    let time: undefined | moment.Moment = undefined;
    let processedTitle = title;

    const dateMatch = this.settings.dateRegEx.exec(title);
    const timeMatch = this.settings.timeRegEx.exec(title);

    if (dateMatch) {
      date = moment(dateMatch[1], this.settings.dateFormat as string);
    }

    if (timeMatch) {
      time = moment(timeMatch[1], this.settings.timeFormat as string);

      if (date) {
        date.hour(time.hour());
        date.minute(time.minute());

        time = date.clone();
      }
    }

    if (this.settings.shouldHideDate) {
      processedTitle = processedTitle
        .replace(this.settings.dateRegEx, "")
        .replace(this.settings.timeRegEx, "");
    }

    return {
      date,
      time,
      processedTitle,
    };
  }

  extractItemTags(
    title: string,
    settings?: KanbanSettings
  ) {
    const tags: string[] = [];

    let processedTitle = title;
    let match = tagRegex.exec(title);

    while (match != null) {
      tags.push(match[2]);
      match = tagRegex.exec(title);
    }

    if (this.settings.shouldHideTags) {
      processedTitle = processedTitle.replace(tagRegex, "$1");
    }

    return {
      processedTitle,
      tags,
    };
  }

  extractFirstLinkedFile(
    title: string,
  ) {
    if (!this.settings.metaKeys.length) {
      return null;
    }

    const match = title.match(linkRegex);

    if (!match) {
      return null;
    }

    const path = match[1];
    const file = this.view.app.metadataCache.getFirstLinkpathDest(
      path,
      this.view.file.path
    );

    if (!file) {
      return null;
    }

    return file;
  }

  getDataViewCache(file: TFile) {
    if (
      (this.view.app as any).plugins.enabledPlugins.has("dataview") &&
      (this.view.app as any).plugins?.plugins?.dataview?.api
    ) {
      return (this.view.app as any).plugins.plugins.dataview.api.page(
        file.path,
        this.view.file.path
      );
    }
  }

  getLinkedPageMetadata(
    file: TFile | null | undefined,
    settings?: KanbanSettings
  ): FileMetadata | undefined {

    if (!this.settings.metaKeys.length) {
      return;
    }

    if (!file) {
      return;
    }

    const cache = this.view.app.metadataCache.getFileCache(file);
    const dataviewCache = this.getDataViewCache(file);

    if (!cache && !dataviewCache) {
      return;
    }

    const metadata: FileMetadata = {};
    const seenTags: { [k: string]: boolean } = {};
    const seenKey: { [k: string]: boolean } = {};

    let haveData = false;

    this.settings.metaKeys.forEach((k) => {
      if (seenKey[k.metadataKey]) return;

      seenKey[k.metadataKey] = true;

      if (k.metadataKey === "tags") {
        let tags = cache?.tags || [];

        if (cache?.frontmatter?.tags) {
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

      if (cache?.frontmatter && cache.frontmatter[k.metadataKey]) {
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

    return haveData ? metadata : undefined;
  }

  processTitle(
    title: string,
    settings?: KanbanSettings
  ) {
    const date = this.extractDates(title);
    const tags = this.extractItemTags(date.processedTitle);
    const file = this.extractFirstLinkedFile(tags.processedTitle);
    const fileMetadata = this.getLinkedPageMetadata(file);

    return {
      title: tags.processedTitle.trim(),
      titleSearch: this.getSearchTitle(
        tags.processedTitle,
        tags.tags,
        fileMetadata
      ),
      metadata: {
        date: date.date,
        time: date.time,
        tags: tags.tags,
        file,
        fileMetadata,
      },
    };
  }

  mdToItem(
    itemMd: string,
    isListItem?: boolean
  ): Item {
    let titleRaw = "";
    let isComplete = false;

    if (isListItem) {
      const match = itemMd.match(listRegex);

      titleRaw = match[3];
      isComplete = false;
    } else {
      const match = itemMd.match(taskRegex);

      titleRaw = match[4];
      isComplete = match[3] !== " ";
    }

    const processed = this.processTitle(titleRaw);

    return {
      id: generateInstanceId(),
      title: processed.title,
      titleSearch: processed.titleSearch,
      titleRaw,
      data: {
        isComplete,
      },
      metadata: processed.metadata,
    };
  }

  laneToMd(lane: Lane) {
    const lines: string[] = [];

    lines.push(`## ${lane.title}`);

    lines.push("");

    if (lane.data.shouldMarkItemsComplete) {
      lines.push(completeString);
    }

    lane.items.forEach((item) => {
      lines.push(this.itemToMd(item));
    });

    lines.push("");
    lines.push("");
    lines.push("");

    return lines.join("\n");
  }

  archiveToMd(archive: Item[]) {
    if (archive.length) {
      const lines: string[] = [archiveString, "", `## ${t("Archive")}`, ""];

      archive.forEach((item) => {
        lines.push(this.itemToMd(item));
      });

      return lines.join("\n");
    }

    return "";
  }

  settingsToFrontmatter(settings: KanbanSettings): string {
    return ["---", "", yaml.dump(settings), "---", "", ""].join("\n");
  }

  boardToMd(board: Board) {
    const lanes = board.lanes.reduce((md, lane) => {
      return md + this.laneToMd(lane);
    }, "");

    return (
      this.settingsToFrontmatter(board.settings) + lanes + this.archiveToMd(board.archive)
    );
  }

  mdToSettings(boardMd: string): KanbanSettings {
    const match = boardMd.match(frontmatterRegEx);

    if (match) {
      return yaml.load(match[1].trim()) as KanbanSettings;
    }

    return { "kanban-plugin": "basic" };
  }

  mdToBoard(boardMd: string): Board {
    const settings = this.mdToSettings(boardMd);
    const lines = boardMd.replace(frontmatterRegEx, "").split(newLineRegex);
    const lanes: Lane[] = [];
    const archive: Item[] = [];

    const globalKeys = this.view.getGlobalSetting("metadata-keys") || [];
    const localKeys = this.view.getSetting("metadata-keys", settings) || [];

    const dateTrigger = this.view.getSetting("date-trigger", settings) || defaultDateTrigger;
    const timeTrigger = this.view.getSetting("time-trigger", settings) || defaultTimeTrigger;
    const shouldLinkDate = this.view.getSetting("link-date-to-daily-note", settings);
    const contentMatch = shouldLinkDate ? "\\[\\[([^}]+)\\]\\]" : "{([^}]+)}";

    this.settings = {
      dateFormat:     this.view.getSetting("date-format", settings) || getDefaultDateFormat(this.view.app),
      timeFormat:     this.view.getSetting("time-format", settings) || getDefaultTimeFormat(this.view.app),
      dateTrigger,
      timeTrigger,
      shouldLinkDate,
      shouldHideDate: this.view.getSetting("hide-date-in-title", settings),
      shouldHideTags: this.view.getSetting("hide-tags-in-title", settings),
      metaKeys:       [...globalKeys, ...localKeys],
      dateRegEx: new RegExp(
        `(?:^|\\s)${escapeRegExpStr(dateTrigger)}${contentMatch}`
      ),
      timeRegEx: new RegExp(
        `(?:^|\\s)${escapeRegExpStr(timeTrigger as string)}{([^}]+)}`
      ),
    }

    let haveSeenArchiveMarker = false;

    let currentLane: Lane | null = null;

    lines.forEach((line) => {
      if (archiveMarkerRegex.test(line)) {
        haveSeenArchiveMarker = true;
      }

      // New lane
      if (!haveSeenArchiveMarker && laneRegex.test(line)) {
        if (currentLane !== null) {
          lanes.push(currentLane);
        }

        const match = line.match(laneRegex);

        currentLane = {
          id: generateInstanceId(),
          items: [],
          title: match[1],
          data: {},
        };

        return;
      }

      // Check if this is a completed lane
      if (!haveSeenArchiveMarker && completeRegex.test(line)) {
        currentLane.data.shouldMarkItemsComplete = true;
        return;
      }

      const isTask = taskRegex.test(line);
      const isListItem = !isTask && listRegex.test(line);

      // Create an item from tasks
      if (isTask || isListItem) {
        if (haveSeenArchiveMarker) {
          archive.push(this.mdToItem(line, settings, isListItem));
        } else {
          currentLane.items.push(this.mdToItem(line, settings, isListItem));
        }
      }
    });

    // Push the last lane
    if (currentLane) {
      lanes.push(currentLane);
    }

    return {
      settings,
      lanes,
      archive,
      isSearching: false,
    };
  }
}