import { generateInstanceId } from "./components/helpers";
import { Board, Item, Lane } from "./components/types";
import { KanbanSettings } from "./Settings";
import yaml from "js-yaml";

export const frontMatterKey = "kanban-plugin";

const frontmatterRegEx = /^---([\w\W]+)---/;
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
  return `- [${item.data.isComplete ? "x" : " "}] ${item.title}`;
}

function mdToItem(itemMd: string): Item {
  const match = itemMd.match(taskRegex);

  return {
    id: generateInstanceId(),
    title: match[4],
    data: {
      isComplete: match[3] !== " ",
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

export function mdToBoard(boardMd: string): Board {
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
        archive.push(mdToItem(line));
      } else {
        currentLane.items.push(mdToItem(line));
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
