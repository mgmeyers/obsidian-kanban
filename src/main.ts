import 'choices.js/public/assets/styles/choices.css';
import 'flatpickr/dist/flatpickr.min.css';

import './main.css';

import { around } from 'monkey-around';
import {
  MarkdownView,
  Menu,
  Plugin,
  TFile,
  TFolder,
  ViewState,
  WorkspaceLeaf,
} from 'obsidian';
import React from 'react';
import ReactDOM from 'react-dom';

import { createApp } from './DragDropApp';
import { KanbanView, kanbanIcon, kanbanViewType } from './KanbanView';
import { t } from './lang/helpers';
import { frontMatterKey } from './parsers/common';
import { KanbanSettings, KanbanSettingsTab } from './Settings';
import { StateManager } from './StateManager';

const basicFrontmatter = [
  '---',
  '',
  `${frontMatterKey}: basic`,
  '',
  '---',
  '',
  '',
].join('\n');

export default class KanbanPlugin extends Plugin {
  settingsTab: KanbanSettingsTab;
  settings: KanbanSettings = {};
  appEl: HTMLDivElement;

  // leafid => view mode
  kanbanFileModes: Record<string, string> = {};
  stateManagers: Map<TFile, StateManager> = new Map();
  viewMap: Map<string, KanbanView> = new Map();

  _loaded: boolean = false;

  async loadSettings() {
    this.settings = Object.assign({}, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onunload() {
    // Unmount views first
    this.stateManagers.clear();
    this.viewStateReceivers.forEach((fn) => fn(this.getKanbanViews()));

    const kanbanLeaves = this.app.workspace.getLeavesOfType(kanbanViewType);

    kanbanLeaves.forEach((leaf) => {
      this.setMarkdownView(leaf);
    });

    (this.app.workspace as any).unregisterHoverLinkSource(frontMatterKey);

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

  viewStateReceivers: Array<(views: KanbanView[]) => void> = [];

  getKanbanViews() {
    return Array.from(this.viewMap.values());
  }

  getKanbanView(id: string) {
    return this.viewMap.get(id);
  }

  getStateManager(file: TFile) {
    return this.stateManagers.get(file);
  }

  getStateManagerFromViewID(id: string) {
    return this.stateManagers.get(this.getKanbanView(id).file);
  }

  useViewState(): KanbanView[] {
    const [state, setState] = React.useState(this.getKanbanViews());

    React.useEffect(() => {
      this.viewStateReceivers.push(setState);

      return () => {
        this.viewStateReceivers.remove(setState);
      };
    }, []);

    return state;
  }

  addView(view: KanbanView, data: string) {
    if (!this.viewMap.has(view.id)) {
      this.viewMap.set(view.id, view);
    }

    const file = view.file;

    if (this.stateManagers.has(file)) {
      this.stateManagers.get(file).registerView(view, data);
    } else {
      this.stateManagers.set(
        file,
        new StateManager(
          this.app,
          view,
          data,
          () => this.stateManagers.delete(file),
          () => this.settings
        )
      );
    }

    this.viewStateReceivers.forEach((fn) => fn(this.getKanbanViews()));
  }

  removeView(view: KanbanView) {
    const file = view.file;

    if (this.viewMap.has(view.id)) {
      this.viewMap.delete(view.id);
    }

    if (this.stateManagers.has(file)) {
      this.stateManagers.get(file).unregisterView(view);
      this.viewStateReceivers.forEach((fn) => fn(this.getKanbanViews()));
    }
  }

  handleViewFileRename(view: KanbanView, oldPath: string) {
    const oldId = `${(view.leaf as any).id}:::${oldPath}`;

    if (this.viewMap.has(oldId)) {
      this.viewMap.delete(oldId);
    }

    if (!this.viewMap.has(view.id)) {
      this.viewMap.set(view.id, view);
    }
  }

  mount() {
    ReactDOM.render(
      createApp(this),
      this.appEl ?? (this.appEl = document.body.createDiv())
    );
  }

  async setMarkdownView(leaf: WorkspaceLeaf) {
    await leaf.setViewState(
      {
        type: 'markdown',
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
          this.app.workspace.getActiveFile()?.path || ''
        );

    try {
      const kanban: TFile = await (
        this.app.fileManager as any
      ).createNewMarkdownFile(targetFolder, t('Untitled Kanban'));

      await this.app.vault.modify(kanban, basicFrontmatter);
      await this.app.workspace.activeLeaf.setViewState({
        type: kanbanViewType,
        state: { file: kanban.path },
      });
    } catch (e) {
      console.error('Error creating kanban board:', e);
    }
  }

  registerEvents() {
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file: TFile) => {
        // Add a menu item to the folder context menu to create a board
        if (file instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle(t('New kanban board'))
              .setIcon(kanbanIcon)
              .onClick(() => this.newKanban(file));
          });
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        const kanbanLeaves = this.app.workspace.getLeavesOfType(kanbanViewType);

        kanbanLeaves.forEach((leaf) => {
          (leaf.view as KanbanView).handleRename(file.path, oldPath);
        });
      })
    );

    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        this.stateManagers.forEach((manager) => {
          manager.onFileMetadataChange(file);
        });
      })
    );

    this.registerEvent(
      this.app.metadataCache.on('dataview:api-ready', () => {
        this.stateManagers.forEach((manager) => {
          manager.forceRefresh();
        });
      })
    );

    this.registerEvent(
      this.app.metadataCache.on('dataview:metadata-change', (_, file) => {
        this.stateManagers.forEach((manager) => {
          manager.onFileMetadataChange(file);
        });
      })
    );

    (this.app.workspace as any).registerHoverLinkSource(frontMatterKey, {
      display: 'Kanban',
      defaultMod: true,
    });
  }

  registerCommands() {
    this.addCommand({
      id: 'create-new-kanban-board',
      name: t('Create new board'),
      callback: () => this.newKanban(),
    });

    this.addCommand({
      id: 'archive-completed-cards',
      name: t('Archive completed cards in active board'),
      checkCallback: (checking) => {
        const activeView = this.app.workspace.getActiveViewOfType(KanbanView);

        if (!activeView) return false;
        if (checking) return true;

        this.stateManagers.get(activeView.file).archiveCompletedCards();
      },
    });

    this.addCommand({
      id: 'toggle-kanban-view',
      name: t('Toggle between Kanban and markdown mode'),
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
            'markdown';
          this.setMarkdownView(activeLeaf);
        } else if (fileIsKanban) {
          this.kanbanFileModes[(activeLeaf as any).id || activeFile.path] =
            kanbanViewType;
          this.setKanbanView(activeLeaf);
        }
      },
    });

    this.addCommand({
      id: 'convert-to-kanban',
      name: t('Convert empty note to Kanban'),
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
        around((this.app as any).commands.commands['editor:open-search'], {
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
              state.type === 'markdown' &&
              state.state?.file &&
              // And the current mode of the file is not set to markdown
              self.kanbanFileModes[this.id || state.state.file] !== 'markdown'
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
                  .setTitle(t('Open as kanban board'))
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
