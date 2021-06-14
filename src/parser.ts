import { moment, TFile } from "obsidian";
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
import update from "immutability-helper";

export const frontMatterKey = "kanban-plugin";

const newLineRegex = /[\r\n]+/g;

// Begins with one or more # followed by a space
const laneRegex = /^#+\s+(.+)$/;

const itemRegex = new RegExp([
  /^\s*/,               // leading whitespace
  /[-+*]\s*/,           // bullet and its whitespace
  /(?:\[([^\]])\]\s+)/, // task marker and whitespace (group 1)
  /(.*)$/,              // Text (group 2)
].map(r => r.source).join(""));


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
    dom: HTMLDivElement,
    title: string,
    tags?: string[],
    fileMetadata?: FileMetadata
  ) {
    let searchTitle = dom.innerText.trim();

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

    return searchTitle.toLocaleLowerCase();
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

  newItem(titleRaw: string): Item {
    const processed = this.processTitle(titleRaw);
    return  {
      id: generateInstanceId(),
      title: processed.title,
      titleRaw: titleRaw,
      titleSearch: processed.titleSearch,
      data: {},
      metadata: processed.metadata,
      dom: processed.dom,
    }
  }

  updateItem(item: Item, titleRaw: string) {
    const processed = this.processTitle(titleRaw);
    return update(item, {
      title: { $set: processed.title },
      titleRaw: { $set: titleRaw },
      titleSearch: { $set: processed.titleSearch },
      metadata: { $set: processed.metadata },
      dom: { $set: processed.dom },
    });
  }

  private processTitle(
    title: string,
  ) {
    const date = this.extractDates(title);
    const tags = this.extractItemTags(date.processedTitle);
    const file = this.extractFirstLinkedFile(tags.processedTitle);
    const fileMetadata = this.getLinkedPageMetadata(file);
    const dom = this.view.renderMarkdown(tags.processedTitle);

    return {
      title: tags.processedTitle.trim(),
      titleSearch: this.getSearchTitle(
        dom,
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
      dom
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


  lastFrontMatter: string
  lastSettings: KanbanSettings
  lastGlobalSettings: KanbanSettings
  lastItems: Map<string, Item[]> = new Map;
  lastLanes: Map<string, Lane> = new Map;

  // we use a string instead of a file, because a file changing path could change the meaning of links
  lastParsedPath: string;

  mdToBoard(boardMd: string, filePath: string): Board {

    /*
    Steps:

    1. Split front matter from board
    2. If it's the same as the last, reuse the local settings calc
    3. If the file path, global and local settings are all the same as before, reuse them
    4. Otherwise, recalc settings and clear the cache

    Issues:
    * Should we track linked files for modify / rename / delete? (map file => item id, update accordingly)
    * Should internal link be resolved from DOM instead of regex?
    */

    const [beforeFrontMatter, frontMatter, body] = boardMd.split(/^---\r?$\n?/m, 3);

    if (beforeFrontMatter.trim()) throw new Error("Invalid Kanban file: problems parsing frontmatter ")

    const settings = (frontMatter === this.lastFrontMatter) ?
      this.lastSettings :
      yaml.load(frontMatter) as KanbanSettings
    ;

    const globalSettings = this.view.plugin.settings || {};

    if (settings !== this.lastSettings || globalSettings !== this.lastGlobalSettings || this.lastParsedPath !== filePath) {
      this.lastItems.clear(); // Settings changed, must re-parse items

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
    }

    const lines = body.split(newLineRegex);
    const lanes: Lane[] = [];
    const archive: Item[] = [];
    const thisItems: Map<string,Item[]> = new Map;
    const thisLanes: Map<string,Lane> = new Map;
    const lastLanes = this.lastLanes;

    let haveSeenArchiveMarker = false;

    let currentLane: Lane | null = null;

    let item: Item;

    for (const line of lines) {
      const itemMatch = line.match(itemRegex);
      if (itemMatch) {
        item = this.lastItems.get(line)?.shift();
        if (!item) {
          const [_full, marker, titleRaw] = itemMatch;
          const processed = this.processTitle(titleRaw);
          item = {
            id: generateInstanceId(),
            title: processed.title,
            titleSearch: processed.titleSearch,
            titleRaw,
            data: {
              isComplete: marker !== " ",
            },
            metadata: processed.metadata,
            dom: processed.dom
          }
        }

        thisItems.has(line) ? thisItems.get(line).push(item) : thisItems.set(line, [item]);

        if (haveSeenArchiveMarker) {
          archive.push(item);
        } else {
          currentLane.items.push(item);
        }
        continue
      }

      // New lane
      if (!haveSeenArchiveMarker && laneRegex.test(line)) {
        if (currentLane !== null) pushLane();

        const match = line.match(laneRegex);

        currentLane = {
          id: generateInstanceId(),
          items: [],
          title: match[1],
          data: {},
        };

        continue;
      }

      if (archiveMarkerRegex.test(line)) {
        haveSeenArchiveMarker = true;
        continue
      }

      // Check if this is a completed lane
      if (!haveSeenArchiveMarker && completeRegex.test(line)) {
        currentLane.data.shouldMarkItemsComplete = true;
        continue;
      }
    };

    // Push the last lane
    if (currentLane !== null) pushLane();

    function pushLane() {
      // Don't replace lanes and items more than necessary
      const laneKey = `${currentLane.data.shouldMarkItemsComplete} ${currentLane.items.map(item => item.id).join(",")}`;
      const oldLane = lastLanes.get(laneKey);
      if (oldLane) {
        if (oldLane.title === currentLane.title) {
          // Title is the only thing that isn't in the key
          currentLane = oldLane
        } else {
          // At least save the items and other props
          currentLane.items = oldLane.items;
          currentLane.data = oldLane.data;
          currentLane.id = oldLane.id;
        }
      }
      thisLanes.set(laneKey, currentLane);
      lanes.push(currentLane);
    }

    this.lastItems = thisItems;
    this.lastLanes = thisLanes;
    this.lastSettings = settings;
    this.lastGlobalSettings = globalSettings;
    this.lastFrontMatter = frontMatter;
    this.lastParsedPath = filePath;

    return {
      settings,
      lanes,
      archive,
      isSearching: false,
    };
  }
}