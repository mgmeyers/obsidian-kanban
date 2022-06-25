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
  debounce,
} from 'obsidian';
import Preact from 'preact/compat';

import { createApp } from './DragDropApp';
import { KanbanView, kanbanIcon, kanbanViewType } from './KanbanView';
import { t } from './lang/helpers';
import { basicFrontmatter, frontMatterKey } from './parsers/common';
import { KanbanSettings, KanbanSettingsTab } from './Settings';
import { StateManager } from './StateManager';

export default class KanbanPlugin extends Plugin {
  settingsTab: KanbanSettingsTab;
  settings: KanbanSettings = {};

  // leafid => view mode
  kanbanFileModes: Record<string, string> = {};
  stateManagers: Map<TFile, StateManager> = new Map();

  viewMap: Map<Window, Map<string, KanbanView>> = new Map();
  appRootMap: Map<Window, HTMLElement> = new Map();

  _loaded: boolean = false;

  isShiftPressed: boolean = false;

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

    for (const win of this.appRootMap.keys()) {
      this.unmount(win);
    }

    this.unmount(window);

    this.appRootMap.clear();
    this.viewMap.clear();

    window.removeEventListener('keydown', this.handleShift);
    window.removeEventListener('keyup', this.handleShift);
  }

  async onload() {
    await this.loadSettings();

    this.registerEvent(
      app.workspace.on('window-open', (_, win) => {
        this.mount(win);
      })
    );

    this.registerEvent(
      app.workspace.on('window-close', (_, win) => {
        this.unmount(win);
      })
    );

    this.settingsTab = new KanbanSettingsTab(this, {
      onSettingsChange: async (newSettings) => {
        this.settings = newSettings;
        await this.saveSettings();

        // Force a complete re-render when settings change
        this.stateManagers.forEach((stateManager) => {
          stateManager.forceRefresh();
        });
      },
    });

    this.addSettingTab(this.settingsTab);

    this.registerView(kanbanViewType, (leaf) => new KanbanView(leaf, this));
    this.registerMonkeyPatches();
    this.registerCommands();
    this.registerEvents();

    // Mount an empty component to start; views will be added as we go
    this.mount(window);

    window.addEventListener('keydown', this.handleShift);
    window.addEventListener('keyup', this.handleShift);
  }

  handleShift = (e: KeyboardEvent) => {
    this.isShiftPressed = e.shiftKey;
  };

  viewStateReceivers: Array<(views: KanbanView[]) => void> = [];

  getKanbanViews() {
    return Array.from(this.viewMap.values()).reduce<KanbanView[]>(
      (allViews, current) => {
        return allViews.concat(Array.from(current.values()));
      },
      []
    );
  }

  getKanbanView(id: string, win: Window) {
    if (win && this.viewMap.has(win)) {
      return this.viewMap.get(win).get(id);
    }

    for (const viewMap of this.viewMap.values()) {
      if (viewMap.has(id)) {
        return viewMap.get(id);
      }
    }

    return null;
  }

  getStateManager(file: TFile) {
    return this.stateManagers.get(file);
  }

  getStateManagerFromViewID(id: string, win: Window) {
    const view = this.getKanbanView(id, win);

    if (!view) {
      return null;
    }

    return this.stateManagers.get(view.file);
  }

  useViewState(): KanbanView[] {
    const [state, setState] = Preact.useState(this.getKanbanViews());

    Preact.useEffect(() => {
      this.viewStateReceivers.push(setState);

      return () => {
        this.viewStateReceivers.remove(setState);
      };
    }, []);

    return state;
  }

  addView(view: KanbanView, data: string, shouldParseData: boolean) {
    const win = view.getWindow();

    if (!this.viewMap.has(win)) {
      this.viewMap.set(win, new Map());
    }

    const viewMap = this.viewMap.get(win);

    if (!viewMap.has(view.id)) {
      viewMap.set(view.id, view);
    }

    const file = view.file;

    if (this.stateManagers.has(file)) {
      this.stateManagers.get(file).registerView(view, data, shouldParseData);
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
    const win = view.getWindow();

    if (!this.viewMap.has(win)) {
      return;
    }

    const viewMap = this.viewMap.get(win);
    const file = view.file;

    if (viewMap.has(view.id)) {
      viewMap.delete(view.id);
    }

    if (viewMap.size === 0) {
      this.viewMap.delete(win);
    }

    if (this.stateManagers.has(file)) {
      this.stateManagers.get(file).unregisterView(view);
      this.viewStateReceivers.forEach((fn) => fn(this.getKanbanViews()));
    }
  }

  handleViewFileRename(view: KanbanView, oldPath: string) {
    const win = view.getWindow();
    if (!this.viewMap.has(win)) {
      return;
    }

    const viewMap = this.viewMap.get(win);
    const oldId = `${(view.leaf as any).id}:::${oldPath}`;

    if (viewMap.has(oldId)) {
      viewMap.delete(oldId);
    }

    if (!viewMap.has(view.id)) {
      viewMap.set(view.id, view);
    }

    if (view.isPrimary) {
      this.getStateManager(view.file).softRefresh();
    }
  }

  mount(win: Window) {
    if (this.appRootMap.has(win)) {
      return;
    }

    const el = win.document.body.createDiv();

    this.appRootMap.set(win, el);

    Preact.render(createApp(this), el);
  }

  unmount(win: Window) {
    if (!this.appRootMap.has(win)) {
      return;
    }

    const viewMap = this.viewMap.get(win);

    if (viewMap) {
      for (const view of viewMap.values()) {
        view.destroy();
      }
    }

    const el = this.appRootMap.get(win);

    Preact.unmountComponentAtNode(el);
  }

  async setMarkdownView(leaf: WorkspaceLeaf, focus: boolean = true) {
    await leaf.setViewState(
      {
        type: 'markdown',
        state: leaf.view.getState(),
        popstate: true,
      } as ViewState,
      { focus }
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

    const notifyFileChange = debounce(
      (file: TFile) => {
        this.stateManagers.forEach((manager) => {
          if (manager.file !== file) {
            manager.onFileMetadataChange();
          }
        });
      },
      2000,
      true
    );

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile) {
          notifyFileChange(file);
        }
      })
    );

    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        notifyFileChange(file);
      })
    );

    this.registerEvent(
      this.app.metadataCache.on('dataview:metadata-change', (_, file) => {
        notifyFileChange(file);
      })
    );

    this.registerEvent(
      this.app.metadataCache.on('dataview:api-ready', () => {
        this.stateManagers.forEach((manager) => {
          manager.forceRefresh();
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
          this.app.vault
            .modify(activeFile, basicFrontmatter)
            .then(() => {
              this.setKanbanView(activeLeaf);
            })
            .catch((e) => console.error(e));
        }
      },
    });

    this.addCommand({
      id: 'add-kanban-lane',
      name: t('Add a list'),
      checkCallback: (checking) => {
        const activeLeaf = this.app.workspace.activeLeaf;

        if (checking) {
          return activeLeaf.view instanceof KanbanView;
        }

        (activeLeaf.view as KanbanView).emitter.emit('showLaneForm', undefined);
      },
    });
  }

  registerMonkeyPatches() {
    const self = this;

    this.app.workspace.onLayoutReady(() => {
      this.register(
        around((this.app as any).commands, {
          executeCommandById(next) {
            return function (command: string) {
              const view = self.app.workspace.getActiveViewOfType(KanbanView);

              if (view) {
                view.emitter.emit('hotkey', command);
              }

              return next.call(this, command);
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
