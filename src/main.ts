import {
  Plugin,
  WorkspaceLeaf,
  TFile,
  TFolder,
  ViewState,
  MarkdownView,
  Menu,
} from "obsidian";
import { around } from "monkey-around";

import { kanbanIcon, KanbanView, kanbanViewType } from "./KanbanView";
import { createApp } from "./DragDropApp";
import { frontMatterKey } from "./parsers/common";
import { KanbanSettings, KanbanSettingsTab } from "./Settings";
import ReactDOM from "react-dom";

// import { KanbanEmbed } from "./KanbanEmbed";

import "choices.js/public/assets/styles/choices.css";
import "flatpickr/dist/flatpickr.min.css";
import "./main.css";
import { t } from "./lang/helpers";
import { DataBridge } from "./DataBridge";
import update from "immutability-helper";

const basicFrontmatter = [
  "---",
  "",
  `${frontMatterKey}: basic`,
  "",
  "---",
  "",
  "",
].join("\n");

export default class KanbanPlugin extends Plugin {
  settingsTab: KanbanSettingsTab;
  settings: KanbanSettings = {};
  appEl: HTMLDivElement;
  viewBridge: DataBridge<Map<string, KanbanView>> = new DataBridge(new Map());
  _loaded: boolean = false;

  // leafid => view mode
  kanbanFileModes: Record<string, string> = {};

  async loadSettings() {
    this.settings = Object.assign({}, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onunload() {
    // Unmount views from the display first, so we don't get intermediate render thrashing
    this.viewBridge.setExternal(new Map());

    const kanbanLeaves = this.app.workspace.getLeavesOfType(kanbanViewType);

    kanbanLeaves.forEach((leaf) => {
      this.setMarkdownView(leaf);
    });

    // @ts-ignore
    this.app.workspace.unregisterHoverLinkSource(frontMatterKey);

    if (this.appEl) {
      ReactDOM.unmountComponentAtNode(this.appEl);
      this.appEl.detach();
    }
  }

  async onload() {
    await this.loadSettings();

    this.settingsTab = new KanbanSettingsTab(this, {
      onSettingsChange: async (newSettings) => {
        this.settings = newSettings;
        await this.saveSettings();

        // Force a complete re-render when settings change
        this.app.workspace.getLeavesOfType(kanbanViewType).forEach((leaf) => {
          const view = leaf.view as KanbanView;
          view.setViewData(view.data);
        });
      },
    });

    this.addSettingTab(this.settingsTab);

    this.registerView(kanbanViewType, (leaf) => new KanbanView(leaf, this));
    this.registerMonkeyPatches();
    this.registerCommands();
    this.registerEvents();

    // Mount an empty component to start; views will be added as we go
    this.mount();
  }

  addView(view: KanbanView) {
    const views = this.viewBridge.getData();

    if (!views.has(view.id)) {
      this.viewBridge.setExternal(update(views, { $add: [[view.id, view]] }));
    }
  }

  removeView(view: KanbanView) {
    const views = this.viewBridge.getData();

    if (views.has(view.id)) {
      this.viewBridge.setExternal(update(views, { $remove: [view.id] }));
    }
  }

  mount() {
    ReactDOM.render(
      createApp(this.app, this.viewBridge),
      this.appEl ?? (this.appEl = document.body.createDiv())
    );
  }

  async setMarkdownView(leaf: WorkspaceLeaf) {
    await leaf.setViewState(
      {
        type: "markdown",
        state: leaf.view.getState(),
        popstate: true,
      } as ViewState,
      { focus: true }
    );
  }

  async setKanbanView(leaf: WorkspaceLeaf) {
    await leaf.setViewState({
      type: kanbanViewType,
      state: leaf.view.getState(),
      popstate: true,
    } as ViewState);
  }

  async newKanban(folder?: TFolder) {
    const targetFolder = folder
      ? folder
      : this.app.fileManager.getNewFileParent(
          this.app.workspace.getActiveFile()?.path || ""
        );

    try {
      // @ts-ignore
      const kanban: TFile = await this.app.fileManager.createNewMarkdownFile(
        targetFolder,
        t("Untitled Kanban")
      );

      await this.app.vault.modify(kanban, basicFrontmatter);
      await this.app.workspace.activeLeaf.setViewState({
        type: kanbanViewType,
        state: { file: kanban.path },
      });
    } catch (e) {
      console.error("Error creating kanban board:", e);
    }
  }

  registerEvents() {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file: TFile) => {
        // Add a menu item to the folder context menu to create a board
        if (file instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle(t("New kanban board"))
              .setIcon(kanbanIcon)
              .onClick(() => this.newKanban(file));
          });
        }
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        this.app.workspace.getLeavesOfType(kanbanViewType).forEach((leaf) => {
          const view = leaf.view as KanbanView;
          view.onFileMetadataChange(file);
        });
      })
    );

    // @ts-ignore
    this.app.workspace.registerHoverLinkSource(frontMatterKey, {
      display: "Kanban",
      defaultMod: true,
    });
  }

  registerCommands() {
    this.addCommand({
      id: "create-new-kanban-board",
      name: t("Create new board"),
      callback: () => this.newKanban(),
    });

    this.addCommand({
      id: "archive-completed-cards",
      name: t("Archive completed cards in active board"),
      checkCallback: (checking) => {
        const activeView = this.app.workspace.getActiveViewOfType(KanbanView);

        if (!activeView) return false;
        if (checking) return true;

        activeView.archiveCompletedCards();
      },
    });

    this.addCommand({
      id: "toggle-kanban-view",
      name: t("Toggle between Kanban and markdown mode"),
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();

        if (!activeFile) return false;

        const fileCache = this.app.metadataCache.getFileCache(activeFile);
        const fileIsKanban =
          !!fileCache?.frontmatter && !!fileCache.frontmatter[frontMatterKey];

        if (checking) {
          return fileIsKanban;
        }

        const activeLeaf = this.app.workspace.activeLeaf;

        if (activeLeaf?.view && activeLeaf.view instanceof KanbanView) {
          this.kanbanFileModes[(activeLeaf as any).id || activeFile.path] =
            "markdown";
          this.setMarkdownView(activeLeaf);
        } else if (fileIsKanban) {
          this.kanbanFileModes[(activeLeaf as any).id || activeFile.path] =
            kanbanViewType;
          this.setKanbanView(activeLeaf);
        }
      },
    });

    this.addCommand({
      id: "convert-to-kanban",
      name: t("Convert empty note to Kanban"),
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        const activeLeaf = this.app.workspace.activeLeaf;

        if (!activeFile || !activeLeaf) return false;

        const isFileEmpty = activeFile.stat.size === 0;

        if (checking) return isFileEmpty;
        if (isFileEmpty) {
          this.app.vault.modify(activeFile, basicFrontmatter).then(() => {
            this.setKanbanView(activeLeaf);
          });
        }
      },
    });
  }

  registerMonkeyPatches() {
    const self = this;

    this.app.workspace.onLayoutReady(() => {
      this.register(
        around((this.app as any).commands.commands["editor:open-search"], {
          checkCallback(next) {
            return function (isChecking: boolean) {
              if (isChecking) {
                return next.call(this, isChecking);
              }
              const view = self.app.workspace.getActiveViewOfType(KanbanView);

              if (view) {
                view.toggleSearch();
              } else {
                next.call(this, false);
              }
            };
          },
        })
      );
    });

    // Monkey patch WorkspaceLeaf to open Kanbans with KanbanView by default
    this.register(
      around(WorkspaceLeaf.prototype, {
        // Kanbans can be viewed as markdown or kanban, and we keep track of the mode
        // while the file is open. When the file closes, we no longer need to keep track of it.
        detach(next) {
          return function () {
            const state = this.view?.getState();

            if (state?.file && self.kanbanFileModes[this.id || state.file]) {
              delete self.kanbanFileModes[this.id || state.file];
            }

            return next.apply(this);
          };
        },

        setViewState(next) {
          return function (state: ViewState, ...rest: any[]) {
            if (
              // Don't force kanban mode during shutdown
              self._loaded &&
              // If we have a markdown file
              state.type === "markdown" &&
              state.state?.file &&
              // And the current mode of the file is not set to markdown
              self.kanbanFileModes[this.id || state.state.file] !== "markdown"
            ) {
              // Then check for the kanban frontMatterKey
              const cache = self.app.metadataCache.getCache(state.state.file);

              if (cache?.frontmatter && cache.frontmatter[frontMatterKey]) {
                // If we have it, force the view type to kanban
                const newState = {
                  ...state,
                  type: kanbanViewType,
                };

                self.kanbanFileModes[state.state.file] = kanbanViewType;

                return next.apply(this, [newState, ...rest]);
              }
            }

            return next.apply(this, [state, ...rest]);
          };
        },
      })
    );

    // Add a menu item to go back to kanban view
    this.register(
      around(MarkdownView.prototype, {
        onMoreOptionsMenu(next) {
          return function (menu: Menu) {
            const file = this.file;
            const cache = file
              ? self.app.metadataCache.getFileCache(file)
              : null;

            if (
              !file ||
              !cache?.frontmatter ||
              !cache.frontmatter[frontMatterKey]
            ) {
              return next.call(this, menu);
            }

            menu
              .addItem((item) => {
                item
                  .setTitle(t("Open as kanban board"))
                  .setIcon(kanbanIcon)
                  .onClick(() => {
                    self.kanbanFileModes[this.leaf.id || file.path] =
                      kanbanViewType;
                    self.setKanbanView(this.leaf);
                  });
              })
              .addSeparator();

            next.call(this, menu);
          };
        },
      })
    );
  }
}
