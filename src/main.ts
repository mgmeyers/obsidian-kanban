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
import { frontMatterKey } from "./parser";
import { KanbanSettings, KanbanSettingsTab } from "./Settings";

// import { KanbanEmbed } from "./KanbanEmbed";

import "choices.js/public/assets/styles/choices.css";
import "flatpickr/dist/flatpickr.min.css";
import "./main.css";

export default class KanbanPlugin extends Plugin {
  settingsTab: KanbanSettingsTab;
  settings: KanbanSettings = {};
  kanbanFileModes: { [file: string]: string } = {};
  dbTimers: { [id: string]: number } = {};
  hasSet: { [id: string]: boolean } = {};

  async onload() {
    const self = this;

    await this.loadSettings();

    this.settingsTab = new KanbanSettingsTab(
      this.app,
      this,
      {
        onSettingsChange: async (newSettings) => {
          this.settings = newSettings;
          await this.saveSettings();

          // Force a complete re-render when settings change
          this.app.workspace.getLeavesOfType(kanbanViewType).forEach((leaf) => {
            const view = leaf.view as KanbanView;
            view.setViewData(view.data, true);
          });
        },
      },
      this.settings
    );

    this.addSettingTab(this.settingsTab);

    // @ts-ignore
    this.app.workspace.registerHoverLinkSource(frontMatterKey, {
      display: "Kanban",
      defaultMod: true,
    });

    // TODO: embedded kanban:
    // this.registerMarkdownPostProcessor((el, ctx) => {
    //   if (ctx.frontmatter && ctx.frontmatter[frontMatterKey]) {
    //     clearTimeout(this.dbTimers[ctx.docId]);

    //     this.dbTimers[ctx.docId] = window.setTimeout(() => {
    //       delete this.dbTimers[ctx.docId];

    //       if (!el.parentNode) return;

    //       const container = el.closest(".markdown-embed-content");

    //       if (container) {
    //         container.empty();
    //         ctx.addChild(
    //           new KanbanEmbed(ctx.sourcePath, container as HTMLElement)
    //         );
    //       }
    //     }, 50);
    //   }
    // });

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
                  .setTitle("Open as kanban board")
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

    this.registerView(kanbanViewType, (leaf) => new KanbanView(leaf, this));

    this.addCommand({
      id: "create-new-kanban-board",
      name: "Create new board",
      callback: () => this.newKanban(),
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file: TFile, source, leaf) => {
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
      : this.app.fileManager.getNewFileParent(
          this.app.workspace.getActiveFile().path
        );

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

      const view = new KanbanView(this.app.workspace.activeLeaf, this);

      await view.setState({ file: kanban.path }, {});
      await this.app.workspace.activeLeaf.open(view);
    } catch (e) {
      console.error("Error creating kanban board:", e);
    }
  }

  onunload() {
    const kanbanLeaves = this.app.workspace.getLeavesOfType(kanbanViewType);

    kanbanLeaves.forEach((leaf) => {
      this.setMarkdownView(leaf);
    });

    // @ts-ignore
    this.app.workspace.unregisterHoverLinkSource(frontMatterKey);
  }

  async loadSettings() {
    this.settings = Object.assign({}, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getTemplatePlugins() {
    // @ts-ignore
    const templatesPlugin = this.app.internalPlugins.plugins.templates;
    const templatesEnabled = templatesPlugin.enabled;
    // @ts-ignore
    const templaterPlugin = this.app.plugins.plugins["templater-obsidian"];

    const templateFolder = templatesEnabled
      ? templatesPlugin.instance.options.folder
      : templaterPlugin
      ? templaterPlugin.settings.template_folder
      : undefined;

    return {
      templatesPlugin,
      templaterPlugin,
      templatesEnabled,
      templateFolder,
    };
  }
}
