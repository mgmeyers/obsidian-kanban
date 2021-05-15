import { moment } from "obsidian";
import {
  escapeRegExpStr,
  generateInstanceId,
  getDefaultDateFormat,
  getDefaultTimeFormat,
} from "./components/helpers";
import { Board, Item, Lane } from "./components/types";
import { KanbanSettings } from "./Settings";
import { defaultDateTrigger, defaultTimeTrigger } from "./settingHelpers";
import yaml from "js-yaml";
import { KanbanView } from "./KanbanView";
import { t } from "./lang/helpers";

export const frontMatterKey = "kanban-plugin";

const frontmatterRegEx = /^---([\w\W]+?)---/;
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

function itemToMd(item: Item) {
  return `- [${item.data.isComplete ? "x" : " "}] ${item.titleRaw}`;
}

export function processTitle(
  title: string,
  view: KanbanView,
  settings?: KanbanSettings
) {
  const dateFormat =
    view.getSetting("date-format", settings) || getDefaultDateFormat(view.app);
  const dateTrigger =
    view.getSetting("date-trigger", settings) || defaultDateTrigger;
  const timeFormat =
    view.getSetting("time-format", settings) || getDefaultTimeFormat(view.app);
  const timeTrigger =
    view.getSetting("time-trigger", settings) || defaultTimeTrigger;
  const shouldHideDate = view.getSetting("hide-date-in-title", settings);
  const shouldLinkDate = view.getSetting("link-date-to-daily-note", settings);

  let date: undefined | moment.Moment = undefined;
  let time: undefined | moment.Moment = undefined;
  let processedTitle = title;

  const contentMatch = shouldLinkDate ? "\\[\\[([^}]+)\\]\\]" : "{([^}]+)}";
  const dateRegEx = new RegExp(
    `(?:^|\\s)${escapeRegExpStr(dateTrigger as string)}${contentMatch}`
  );
  const timeRegEx = new RegExp(
    `(?:^|\\s)${escapeRegExpStr(timeTrigger as string)}{([^}]+)}`
  );

  const dateMatch = dateRegEx.exec(title);
  const timeMatch = timeRegEx.exec(title);

  if (dateMatch) {
    date = moment(dateMatch[1], dateFormat as string);
  }

  if (timeMatch) {
    time = moment(timeMatch[1], timeFormat as string);

    if (date) {
      date.hour(time.hour())
      date.minute(time.minute())

      time = date.clone();
    }
  }

  if (shouldHideDate) {
    processedTitle = processedTitle
      .replace(dateRegEx, "")
      .replace(timeRegEx, "");
  }

  return {
    title: processedTitle,
    date,
    time,
  };
}

function mdToItem(
  itemMd: string,
  view: KanbanView,
  settings: KanbanSettings,
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

  const processed = processTitle(titleRaw, view, settings);

  return {
    id: generateInstanceId(),
    title: processed.title,
    titleRaw,
    data: {
      isComplete,
    },
    metadata: {
      date: processed.date,
      time: processed.time,
    },
  };
}

function laneToMd(lane: Lane) {
  const lines: string[] = [];

  lines.push(`## ${lane.title}`);

  lines.push("");

  if (lane.data.shouldMarkItemsComplete) {
    lines.push(completeString);
  }

  lane.items.forEach((item) => {
    lines.push(itemToMd(item));
  });

  lines.push("");
  lines.push("");
  lines.push("");

  return lines.join("\n");
}

function archiveToMd(archive: Item[]) {
  if (archive.length) {
    const lines: string[] = [archiveString, "", `## ${t("Archive")}`, ""];

    archive.forEach((item) => {
      lines.push(itemToMd(item));
    });

    return lines.join("\n");
  }

  return "";
}

export function settingsToFrontmatter(settings: KanbanSettings): string {
  return ["---", "", yaml.dump(settings), "---", "", ""].join("\n");
}

export function boardToMd(board: Board) {
  const lanes = board.lanes.reduce((md, lane) => {
    return md + laneToMd(lane);
  }, "");

  return (
    settingsToFrontmatter(board.settings) + lanes + archiveToMd(board.archive)
  );
}

export function mdToSettings(boardMd: string): KanbanSettings {
  const match = boardMd.match(frontmatterRegEx);

  if (match) {
    return yaml.load(match[1].trim()) as KanbanSettings;
  }

  return { "kanban-plugin": "basic" };
}

export function mdToBoard(boardMd: string, view: KanbanView): Board {
  const settings = mdToSettings(boardMd);
  const lines = boardMd.split(newLineRegex);
  const lanes: Lane[] = [];
  const archive: Item[] = [];

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
        archive.push(mdToItem(line, view, settings, isListItem));
      } else {
        currentLane.items.push(mdToItem(line, view, settings, isListItem));
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
  };
}
