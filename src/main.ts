import { Plugin, WorkspaceLeaf, TFile, TFolder, MarkdownView } from "obsidian";
import { kanbanIcon, KanbanView, kanbanViewType } from "./KanbanView";
import "./main.css";
import { frontMatterKey } from "./parser";

// TODO: settings
interface KanbanPluginSettings {}
const DEFAULT_SETTINGS: KanbanPluginSettings = {};

export default class KanbanPlugin extends Plugin {
  settings: KanbanPluginSettings;

  async onload() {
    this.registerView(kanbanViewType, (leaf) => new KanbanView(leaf));

    this.addCommand({
      id: "create-new-kanban-board",
      name: "Create new board",
      callback: () => this.newKanban(),
    });

    /**
     *
     * TODO: How can we force the kanban view for files matching
     * the kanban frontmatter key without messing up:
     *
     * 1. localgraph, backlink, and outline views
     * 2. forward/back navigation
     *
     */

    /*

    // Which view to use as the default for kanban boards
    // Users can switch between `kanbanViewType` and `markdown` via
    // the more options menu
    let defaultViewType = kanbanViewType;
    
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        const activeLeaf = this.app.workspace.activeLeaf;
        const activeViewType = activeLeaf.view.getViewType();

        if (
          // We don't have a file
          !file ||
          // The file is opened in a special view (eg. localgraph)
          activeViewType !== "markdown" ||
          // The default view for kanbans is markdown
          defaultViewType === "markdown"
        ) {
          return;
        }

        const cache = this.app.metadataCache.getFileCache(file);

        if (cache?.frontmatter && cache.frontmatter[frontMatterKey]) {
          this.setKanbanView(activeLeaf);
        }
      })
    );
    
    */

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file: TFile, source, leaf) => {
        // Add a menu item to force the board to markdown view
        if (leaf?.view.getViewType() === kanbanViewType) {
          menu.addItem((item) => {
            item
              .setTitle("Open as markdown")
              .setIcon("document")
              .onClick(() => {
                // defaultViewType = "markdown";
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
                  // defaultViewType = kanbanViewType;
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
      state: {
        file: leaf.view.getState()?.file,
        mode: "source",
      },
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
