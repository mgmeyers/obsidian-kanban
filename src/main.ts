import { Plugin, WorkspaceLeaf, TFile } from "obsidian";

import { kanbanIcon, KanbanView, kanbanViewType } from "./KanbanView";

import "./main.css";

interface MyPluginSettings {
  mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  mySetting: "default",
};

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    this.registerView(kanbanViewType, (leaf) => new KanbanView(leaf));
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file: TFile, _, leaf) => {
        if (!leaf || !file || file.extension !== "md") {
          return;
        }

        menu.addItem((item) => {
          item
            .setTitle("Open as kanban")
            .setIcon(kanbanIcon)
            .onClick(() => {
              this.openKanban(leaf);
            });
        });
      })
    );
  }

  async openKanban(leaf: WorkspaceLeaf) {
    leaf.setViewState({
      type: kanbanViewType,
      state: { file: leaf.getViewState().state.file },
    });
  }

  onunload() {
    console.log("unloading plugin");
    console.log("todo: close all kanban leaves");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
