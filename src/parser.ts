import { generateTempId } from "./components/helpers";
import { Board, Item, Lane } from "./components/types";

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
const completeRegex = /^Complete:$/i;

function itemToMd(item: Item) {
  return `- [${item.data.isComplete ? "x" : " "}] ${item.title}`;
}

function mdToItem(itemMd: string): Item {
  const match = itemMd.match(taskRegex);

  return {
    id: generateTempId(),
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
    lines.push("Complete:");
  }

  lane.items.forEach((item) => {
    lines.push(itemToMd(item));
  });

  lines.push("");
  lines.push("");
  lines.push("");

  return lines.join("\n");
}

export function boardToMd(board: Board) {
  return board.lanes.reduce((md, lane) => {
    return md + laneToMd(lane);
  }, "");
}

export function mdToBoard(boardMd: string): Board {
  const lines = boardMd.split(newLineRegex);
  const lanes: Lane[] = [];

  let currentLane: Lane | null = null;

  lines.forEach((line) => {
    // New lane
    if (laneRegex.test(line)) {
      if (currentLane !== null) {
        lanes.push(currentLane);
      }

      const match = line.match(laneRegex);

      currentLane = {
        id: generateTempId(),
        items: [],
        title: match[1],
        data: {},
      };

      return;
    }

    // Check if this is a completed lane
    if (completeRegex.test(line)) {
      currentLane.data.shouldMarkItemsComplete = true;
      return;
    }

    // Create an item from tasks
    if (taskRegex.test(line)) {
      return currentLane.items.push(mdToItem(line));
    }
  });

  // Push the last lane
  if (currentLane) {
    lanes.push(currentLane);
  }

  return {
    lanes,
  };
}
