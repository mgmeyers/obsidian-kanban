import { moment } from "obsidian";
import {
  escapeRegExpStr,
  generateInstanceId,
  getDefaultDateFormat,
} from "./components/helpers";
import { Board, Item, Lane } from "./components/types";
import {KanbanSettings} from "./Settings";
import { defaultDateTrigger } from "./settingHelpers";
import yaml from "js-yaml";
import { KanbanView } from "./KanbanView";

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

const completeString = "**Complete**";
const completeRegex = /^\*\*Complete\*\*$/i;
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
  const dateTrigger = view.getSetting("date-trigger", settings) || defaultDateTrigger;
  const shouldHideDate = view.getSetting("hide-date-in-title", settings);
  const shouldLinkDate = view.getSetting("link-date-to-daily-note", settings);

  let date: undefined | moment.Moment = undefined;
  let processedTitle = title;

  const contentMatch = shouldLinkDate ? "\\[\\[([^}]+)\\]\\]" : "{([^}]+)}";
  const dateRegEx = new RegExp(
    `(?:^|\\s)${escapeRegExpStr(dateTrigger as string)}${contentMatch}`,
    "g"
  );

  const match = dateRegEx.exec(title);

  if (match) {
    date = moment(match[1], dateFormat as string);
  }


  if (shouldHideDate) {
    processedTitle = processedTitle.replace(dateRegEx, "");
  }

  return {
    title: processedTitle,
    date,
  };
}

function mdToItem(
  itemMd: string,
  view: KanbanView,
  settings: KanbanSettings
): Item {
  const match = itemMd.match(taskRegex);
  const processed = processTitle(match[4], view, settings);

  return {
    id: generateInstanceId(),
    title: processed.title,
    titleRaw: match[4],
    data: {
      isComplete: match[3] !== " ",
    },
    metadata: {
      date: processed.date,
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
    const lines: string[] = [archiveString, "", "## Archive", ""];

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

    // Create an item from tasks
    if (taskRegex.test(line)) {
      if (haveSeenArchiveMarker) {
        archive.push(mdToItem(line, view, settings));
      } else {
        currentLane.items.push(mdToItem(line, view, settings));
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
