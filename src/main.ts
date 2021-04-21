import { Plugin, WorkspaceLeaf, TFile, TFolder } from "obsidian";
import { kanbanIcon, KanbanView, kanbanViewType } from "./KanbanView";
import "./main.css";

// TODO: settings
interface KanbanPluginSettings {}
const DEFAULT_SETTINGS: KanbanPluginSettings = {};

export default class KanbanPlugin extends Plugin {
  settings: KanbanPluginSettings;

  async onload() {
    let defaultViewType = kanbanViewType;

    this.addCommand({
      id: "create-new-kanban-board",
      name: "Create new board",
      callback: () => this.newKanban(),
    });

    this.registerView(kanbanViewType, (leaf) => new KanbanView(leaf));

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (!file || defaultViewType === "markdown") return;

        const cache = this.app.metadataCache.getFileCache(file);

        if (cache?.frontmatter?.kanban) {
          this.setKanbanView(this.app.workspace.activeLeaf);
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file: TFile, source, leaf) => {
        // Add a menu item to force the board to markdown view
        if (leaf?.getViewState().type === kanbanViewType) {
          menu.addItem((item) => {
            item
              .setTitle("Open as markdown")
              .setIcon("document")
              .onClick(() => {
                const viewState = leaf.getViewState();

                defaultViewType = "markdown";

                leaf.setViewState({
                  type: "markdown",
                  state: {
                    file: viewState.state.file,
                    mode: "source",
                  },
                });
              });
          });

          return;
        }

        // Add a menu item to go back to kanban view
        if (leaf?.getViewState().type === "markdown") {
          const cache = this.app.metadataCache.getFileCache(file);

          if (cache?.frontmatter?.kanban) {
            menu.addItem((item) => {
              item
                .setTitle("Open as kanban board")
                .setIcon(kanbanIcon)
                .onClick(() => {
                  defaultViewType = kanbanViewType;

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

  async newKanban(folder?: TFolder) {
    const targetFolder = folder
      ? folder
      : this.app.fileManager.getNewFileParent("");

    // Forcing frontmatter for now until more options are available
    const frontmatter = ["---", "", "kanban: simple", "", "---", "", ""].join(
      "\n"
    );

    try {
      // @ts-ignore
      const kanban: TFile = await this.app.fileManager.createNewMarkdownFile(
        targetFolder,
        "Untitled"
      );

      await this.app.vault.modify(kanban, frontmatter);
      await this.app.workspace.activeLeaf.openFile(kanban);
      await this.setKanbanView(this.app.workspace.activeLeaf);
    } catch (e) {
      console.log("Error creating kanban board:", e);
    }
  }

  async setKanbanView(leaf: WorkspaceLeaf) {
    await leaf.setViewState({
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
