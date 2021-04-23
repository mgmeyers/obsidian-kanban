import { Plugin, WorkspaceLeaf, TFile, TFolder, ViewState } from "obsidian";
import { around } from "monkey-around";

import { kanbanIcon, KanbanView, kanbanViewType } from "./KanbanView";
import { frontMatterKey } from "./parser";

import "./main.css";

// TODO: settings
interface KanbanPluginSettings {}
const DEFAULT_SETTINGS: KanbanPluginSettings = {};

export default class KanbanPlugin extends Plugin {
  settings: KanbanPluginSettings;
  kanbanFileModes: { [file: string]: string } = {};

  async onload() {
    const self = this;

    // Monkey patch WorkspaceLeaf to open Kanbans with KanbanView by default
    this.register(
      around(WorkspaceLeaf.prototype, {

        // Kanbans can be viewed as markdown or kanban, and we keep track of the mode
        // while the file is open. When the file closes, we no longer need to keep track of it.
        detach(originalDetach) {
          return function () {
            const state = this.view?.getState();

            if (state?.file && self.kanbanFileModes[state.file]) {
              delete self.kanbanFileModes[state.file];
            }

            return originalDetach.apply(this);
          };
        },

        setViewState(originalSetViewState) {
          return function (state: ViewState, ...rest: any[]) {
            if (
              // If we have a markdown file
              state.type === "markdown" &&
              state.state?.file &&

              // And the current mode of the file is not set to markdown
              self.kanbanFileModes[state.state.file] !== "markdown"
            ) {
              // Then check for the kanban frontMatterKey
              const cache = self.app.metadataCache.getCache(state.state.file);

              if (cache?.frontmatter && cache.frontmatter[frontMatterKey]) {
                // If we have it, force the view type to kanban
                const newState = {
                  ...state,
                  type: kanbanViewType,
                };

                self.kanbanFileModes[state.state.file] = kanbanViewType

                return originalSetViewState.apply(this, [newState, ...rest]);
              }
            }

            return originalSetViewState.apply(this, [state, ...rest]);
          };
        },
      })
    );

    this.registerView(kanbanViewType, (leaf) => new KanbanView(leaf));

    this.addCommand({
      id: "create-new-kanban-board",
      name: "Create new board",
      callback: () => this.newKanban(),
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file: TFile, source, leaf) => {
        // Add a menu item to force the board to markdown view
        if (leaf?.view.getViewType() === kanbanViewType) {
          menu.addItem((item) => {
            item
              .setTitle("Open as markdown")
              .setIcon("document")
              .onClick(() => {
                this.kanbanFileModes[file.path] = "markdown";
                this.setMarkdownView(leaf);
              });
          });

          return;
        }

        // Add a menu item to go back to kanban view
        if (leaf?.view.getViewType() === "markdown") {
          const cache = this.app.metadataCache.getFileCache(file);

          if (cache?.frontmatter && cache.frontmatter[frontMatterKey]) {
            menu.addItem((item) => {
              item
                .setTitle("Open as kanban board")
                .setIcon(kanbanIcon)
                .onClick(() => {
                  this.kanbanFileModes[file.path] = kanbanViewType;
                  this.setKanbanView(leaf);
                });
            });
          }

          return;
        }

        // Add a menu item to the folder context menu to create a board
        if (file instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle("New kanban board")
              .setIcon(kanbanIcon)
              .onClick(() => this.newKanban(file));
          });
        }
      })
    );
  }

  async setMarkdownView(leaf: WorkspaceLeaf) {
    await leaf.setViewState({
      type: "markdown",
      state: leaf.view.getState(),
    });
  }

  async setKanbanView(leaf: WorkspaceLeaf) {
    await leaf.setViewState({
      type: kanbanViewType,
      state: leaf.view.getState(),
    });
  }

  async newKanban(folder?: TFolder) {
    const targetFolder = folder
      ? folder
      : this.app.fileManager.getNewFileParent("");

    // Forcing frontmatter for now until more options are available
    const frontmatter = [
      "---",
      "",
      `${frontMatterKey}: basic`,
      "",
      "---",
      "",
      "",
    ].join("\n");

    try {
      // @ts-ignore
      const kanban: TFile = await this.app.fileManager.createNewMarkdownFile(
        targetFolder,
        "Untitled Kanban"
      );

      await this.app.vault.modify(kanban, frontmatter);

      const view = new KanbanView(this.app.workspace.activeLeaf);

      await view.setState({ file: kanban.path }, {});
      await this.app.workspace.activeLeaf.open(view);
    } catch (e) {
      console.log("Error creating kanban board:", e);
    }
  }

  onunload() {
    const kanbanLeaves = this.app.workspace.getLeavesOfType(kanbanViewType);

    kanbanLeaves.forEach((leaf) => {
      this.setMarkdownView(leaf);
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
