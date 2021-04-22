import { Plugin, WorkspaceLeaf, TFile, TFolder } from "obsidian";
import { kanbanIcon, KanbanView, kanbanViewType } from "./KanbanView";
import "./main.css";

// TODO: settings
interface KanbanPluginSettings {}
const DEFAULT_SETTINGS: KanbanPluginSettings = {};

export default class KanbanPlugin extends Plugin {
  settings: KanbanPluginSettings;

  async onload() {
    // Which view to use as the default for kanban boards
    // Users can switch between `kanbanViewType` and `markdown` via
    // the more options menu
    let defaultViewType = kanbanViewType;

    this.addCommand({
      id: "create-new-kanban-board",
      name: "Create new board",
      callback: () => this.newKanban(),
    });

    this.registerView(kanbanViewType, (leaf) => new KanbanView(leaf));

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        const activeLeaf = this.app.workspace.activeLeaf;
        const activeViewType = activeLeaf.view.getViewType();

        this.app.workspace.getLeavesOfType("markdown");

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

        if (cache?.frontmatter && cache.frontmatter['kanban-plugin']) {
          this.setKanbanView(activeLeaf);
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file: TFile, source, leaf) => {
        // Add a menu item to force the board to markdown view
        if (leaf?.view.getViewType() === kanbanViewType) {
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
        if (leaf?.view.getViewType() === "markdown") {
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
    const frontmatter = ["---", "", "kanban-plugin: basic", "", "---", "", ""].join(
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
    const kanbanLeaves = this.app.workspace.getLeavesOfType(kanbanViewType);

    kanbanLeaves.forEach((leaf) => {
      leaf.setViewState({
        type: "markdown",
        state: {
          file: leaf.getViewState().state?.file,
          mode: "source",
        },
      });
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
