import update from "immutability-helper";
import ReactDOM from "react-dom";
import React from "react";
import {
  HoverParent,
  HoverPopover,
  Menu,
  TextFileView,
  WorkspaceLeaf,
} from "obsidian";

import { boardToMd, mdToBoard } from "./parser";
import { Kanban } from "./components/Kanban";
import { DataBridge } from "./DataBridge";
import { Board } from "./components/types";
import KanbanPlugin from "./main";
import { KanbanSettings, SettingsModal } from "./Settings";

export const kanbanViewType = "kanban";
export const kanbanIcon = "blocks";

export class KanbanView extends TextFileView implements HoverParent {
  plugin: KanbanPlugin;
  dataBridge: DataBridge;
  hoverPopover: HoverPopover | null;

  getViewType() {
    return kanbanViewType;
  }

  getIcon() {
    return kanbanIcon;
  }

  getDisplayText() {
    return this.file?.basename || "Kanban";
  }

  constructor(leaf: WorkspaceLeaf, plugin: KanbanPlugin) {
    super(leaf);
    this.dataBridge = new DataBridge();
    this.plugin = plugin;
  }

  async onClose() {
    ReactDOM.unmountComponentAtNode(this.contentEl);
  }

  getSetting(key: keyof KanbanSettings) {
    const localSetting = this.dataBridge.getData().settings[key]

    if (localSetting) return localSetting;
    
    const globalSetting = this.plugin.settings[key];

    if (globalSetting) return globalSetting;

    return null
  }

  onMoreOptionsMenu(menu: Menu) {
    // Add a menu item to force the board to markdown view
    menu
      .addItem((item) => {
        item
          .setTitle("Open as markdown")
          .setIcon("document")
          .onClick(() => {
            this.plugin.kanbanFileModes[
              (this.leaf as any).id || this.file.path
            ] = "markdown";
            this.plugin.setMarkdownView(this.leaf);
          });
      })
      .addItem((item) => {
        item
          .setTitle("Open board settings")
          .setIcon("gear")
          .onClick(() => {
            const board = this.dataBridge.getData();

            new SettingsModal(
              this,
              {
                onSettingsChange: (settings) => {
                  this.dataBridge.setExternal(
                    update(board, {
                      settings: {
                        $set: settings,
                      },
                    })
                  );
                },
              },
              board.settings
            ).open();
          });
      })
      .addSeparator();

    super.onMoreOptionsMenu(menu);
  }

  clear() {
    this.dataBridge.reset();
  }

  getViewData() {
    return boardToMd(this.dataBridge.getData());
  }

  setViewData(data: string, clear: boolean) {
    const trimmedContent = data.trim();
    const board: Board = trimmedContent
      ? mdToBoard(trimmedContent)
      : { lanes: [], archive: [], settings: { "kanban-plugin": "basic" } };

    if (clear) {
      this.clear();

      // Tell react we have a new board
      this.dataBridge.setExternal(board);

      // When the board has been updated by react
      this.dataBridge.onInternalSet((data) => {
        this.data = boardToMd(data);
        this.requestSave();
      });

      this.constructKanban();
    } else {
      // Tell react we have a new board
      this.dataBridge.setExternal(board);
    }
  }

  constructKanban() {
    ReactDOM.unmountComponentAtNode(this.contentEl);
    ReactDOM.render(
      <Kanban
        dataBridge={this.dataBridge}
        filePath={this.file?.path}
        view={this}
      />,
      this.contentEl
    );
  }
}
