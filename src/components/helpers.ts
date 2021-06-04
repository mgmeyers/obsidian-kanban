import React from "react";
import update from "immutability-helper";
import { Board, Item, Lane } from "./types";
import { KanbanView } from "src/KanbanView";
import { App, MarkdownView, TFile } from "obsidian";

export const baseClassName = "kanban-plugin";

export function c(className: string) {
  return `${baseClassName}__${className}`;
}

export function generateInstanceId(): string {
  return Math.random().toString(36).substr(2, 9);
}

interface ReorderListParams<T> {
  list: T[];
  startIndex: number;
  endIndex: number;
}

export function reorderList<T>({
  list,
  startIndex,
  endIndex,
}: ReorderListParams<T>) {
  const clone = list.slice();
  const [removed] = clone.splice(startIndex, 1);
  clone.splice(endIndex, 0, removed);

  return clone;
}

// Callback to update() a board
export type BoardMutator = (board: Board) => Board;

export function swapLanes(srcIndex: number, dstIndex: number): BoardMutator {
  return (srcIndex === dstIndex) ? null : (boardData: Board) => update(boardData, {
    lanes: (lanes) =>
      reorderList<Lane>({
        list: lanes,
        startIndex: srcIndex,
        endIndex: dstIndex,
      }),
  });
}

export function swapItems(laneIndex: number, srcIndex: number, dstIndex: number): BoardMutator {
  return (srcIndex === dstIndex) ? null : (boardData: Board) => update(boardData, {
    lanes: {
      [laneIndex]: {
        items: (items) =>
          reorderList<Item>({
            list: items,
            startIndex: srcIndex,
            endIndex: dstIndex,
          }),
      },
    },
  });
}

export function deleteLane(srcLane: number): BoardMutator {
  return (boardData: Board) => update(boardData, {
    lanes: {$splice: [[srcLane, 1]]},
  })
}

export function insertLane(dstLane: number, lane: Lane): BoardMutator {
  return (boardData: Board) => update(boardData, {
    lanes: {$splice: [[dstLane, 0, lane]]},
  });
}

export function deleteItem(srcLane: number, srcIndex: number): BoardMutator {
  return (boardData: Board) => update(boardData, {
    lanes: {
      [srcLane]: {
        items: {$splice: [[srcIndex, 1]]},
      }
    }
  })
}

export function insertItem(dstLane: number, dstIndex: number, item: Item): BoardMutator {
  return (boardData: Board) => update(boardData, {
    lanes: {
      [dstLane]: {
        items: {
          $splice: [[dstIndex, 0, item]],
        },
      },
    },
  });
}

export function maybeCompleteForMove(item: Item, fromLane: Lane, toLane: Lane): Item {
  const oldShouldComplete = fromLane.data.shouldMarkItemsComplete;
  const newShouldComplete = toLane.data.shouldMarkItemsComplete;

  // If neither the old or new lane set it complete, leave it alone
  if (!oldShouldComplete && !newShouldComplete)     return item;

  // If it already matches the new lane, leave it alone
  if (newShouldComplete === !!item.data.isComplete) return item;

  // It's different, update it
  return update(item, {
    data: {
      isComplete: {
        $set: newShouldComplete,
      },
    },
  });
}

export function moveItem(srcLane: number, srcIndex: number, dstLane: number, dstIndex: number): BoardMutator {
  return (srcLane === dstLane && srcIndex === dstIndex) ? null : (boardData: Board) => {
    let item = boardData.lanes[srcLane].items[srcIndex];
    item = maybeCompleteForMove(item, boardData.lanes[srcLane], boardData.lanes[dstLane])
    return update(boardData, {
      lanes: {
        [srcLane]: {
          items: {
            $splice: [[srcIndex, 1]],
          },
        },
        [dstLane]: {
          items: {
            $splice: [[dstIndex, 0, item]],
          },
        },
      },
    });
  }
}

export function useIMEInputProps() {
  const isComposingRef = React.useRef<boolean>(false);

  return {
    onCompositionStart: () => {
      isComposingRef.current = true;
    },
    onCompositionEnd: () => {
      isComposingRef.current = false;
    },
    getShouldIMEBlockAction: () => {
      return isComposingRef.current;
    },
  };
}

export const templaterDetectRegex = /<%/;

export async function applyTemplate(view: KanbanView, templatePath?: string) {
  const templateFile = templatePath
    ? view.app.vault.getAbstractFileByPath(templatePath)
    : null;

  if (templateFile && templateFile instanceof TFile) {
    const activeView = view.app.workspace.activeLeaf.view
    // Force the view to source mode, if needed
    if (activeView instanceof MarkdownView && activeView.getMode() !== "source") {
      await activeView.setState(
        {
          ...activeView.getState(),
          mode: "source",
        },
        {}
      );
    }

    const { templatesEnabled, templaterPlugin, templatesPlugin } =
      view.plugin.getTemplatePlugins();

    const templateContent = await view.app.vault.read(templateFile);

    // If both plugins are enabled, attempt to detect templater first
    if (templatesEnabled && templaterPlugin) {
      if (templaterDetectRegex.test(templateContent)) {
        return await templaterPlugin.append_template(templateFile);
      }

      return await templatesPlugin.instance.insertTemplate(templateFile);
    }

    if (templatesEnabled) {
      return await templatesPlugin.instance.insertTemplate(templateFile);
    }

    if (templaterPlugin) {
      return await templaterPlugin.append_template(templateFile);
    }

    // No template plugins enabled so we can just append the template to the doc
    await view.app.vault.modify(
      view.app.workspace.getActiveFile(),
      templateContent
    );
  }
}

export function getDefaultDateFormat(app: App) {
  const internalPlugins = (app as any).internalPlugins.plugins;
  const dailyNotesEnabled = internalPlugins["daily-notes"]?.enabled;
  const dailyNotesValue =
    internalPlugins["daily-notes"]?.instance.options.format;
  const nlDatesValue = (app as any).plugins.plugins["nldates-obsidian"]
    ?.settings.format;
  const templatesEnabled = internalPlugins.templates?.enabled;
  const templatesValue = internalPlugins.templates?.instance.options.dateFormat;

  return (
    (dailyNotesEnabled && dailyNotesValue) ||
    nlDatesValue ||
    (templatesEnabled && templatesValue) ||
    "YYYY-MM-DD"
  );
}

export function getDefaultTimeFormat(app: App) {
  const internalPlugins = (app as any).internalPlugins.plugins;
  const nlDatesValue = (app as any).plugins.plugins["nldates-obsidian"]
    ?.settings.timeFormat;
  const templatesEnabled = internalPlugins.templates?.enabled;
  const templatesValue = internalPlugins.templates?.instance.options.timeFormat;

  return nlDatesValue || (templatesEnabled && templatesValue) || "HH:mm";
}

const reRegExChar = /[\\^$.*+?()[\]{}|]/g;
const reHasRegExChar = RegExp(reRegExChar.source);

export function escapeRegExpStr(str: string) {
  return str && reHasRegExChar.test(str)
    ? str.replace(reRegExChar, "\\$&")
    : str || "";
}
