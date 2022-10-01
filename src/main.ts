import 'choices.js/public/assets/styles/choices.css';

import './components/Editor/flatpickr/flatpickr.min.css';
import './main.less';

import { around } from 'monkey-around';
import {
  MarkdownView,
  Platform,
  Plugin,
  TFile,
  TFolder,
  ViewState,
  WorkspaceLeaf,
  debounce,
} from 'obsidian';
import Preact from 'preact/compat';

import { getParentWindow } from './dnd/util/getWindow';
import { createApp } from './DragDropApp';
import { hasFrontmatterKey } from './helpers';
import { KanbanView, kanbanIcon, kanbanViewType } from './KanbanView';
import { t } from './lang/helpers';
import { basicFrontmatter, frontMatterKey } from './parsers/common';
import { KanbanSettings, KanbanSettingsTab } from './Settings';
import { StateManager } from './StateManager';

interface WindowRegistry {
  viewMap: Map<string, KanbanView>;
  viewStateReceivers: Array<(views: KanbanView[]) => void>;
  appRoot: HTMLElement;
}

export default class KanbanPlugin extends Plugin {
  settingsTab: KanbanSettingsTab;
  settings: KanbanSettings = {};

  // leafid => view mode
  kanbanFileModes: Record<string, string> = {};
  stateManagers: Map<TFile, StateManager> = new Map();

  windowRegistry: Map<Window, WindowRegistry> = new Map();

  _loaded: boolean = false;

  isShiftPressed: boolean = false;

  async loadSettings() {
    this.settings = Object.assign({}, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  unload(): void {
    Promise.all(
      app.workspace.getLeavesOfType(kanbanViewType).map((leaf) => {
        this.kanbanFileModes[(leaf as any).id] = 'markdown';
        return this.setMarkdownView(leaf);
      })
    ).then(() => {
      super.unload();
    });
  }

  onunload() {
    this.windowRegistry.forEach((reg, win) => {
      reg.viewStateReceivers.forEach((fn) => fn([]));
      this.unmount(win);
    });

    this.unmount(window);

    this.stateManagers.clear();
    this.windowRegistry.clear();
    this.kanbanFileModes = {};

    window.removeEventListener('keydown', this.handleShift);
    window.removeEventListener('keyup', this.handleShift);
    (app.workspace as any).unregisterHoverLinkSource(frontMatterKey);
  }

  async onload() {
    await this.loadSettings();

    this.registerEvent(
      app.workspace.on('window-open', (_: any, win: Window) => {
        this.mount(win);
      })
    );

    this.registerEvent(
      app.workspace.on('window-close', (_: any, win: Window) => {
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

    (app.workspace as any).floatingSplit?.children?.forEach((c: any) => {
      this.mount(c.win);
    });

    window.addEventListener('keydown', this.handleShift);
    window.addEventListener('keyup', this.handleShift);
  }

  handleShift = (e: KeyboardEvent) => {
    this.isShiftPressed = e.shiftKey;
  };

  getKanbanViews(win: Window) {
    const reg = this.windowRegistry.get(win);

    if (reg) {
      return Array.from(reg.viewMap.values());
    }

    return [];
  }

  getKanbanView(id: string, win: Window) {
    const reg = this.windowRegistry.get(win);

    if (reg?.viewMap.has(id)) {
      return reg.viewMap.get(id);
    }

    for (const reg of this.windowRegistry.values()) {
      if (reg.viewMap.has(id)) {
        return reg.viewMap.get(id);
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

  useViewState(win: Window): KanbanView[] {
    const [state, setState] = Preact.useState(this.getKanbanViews(win));

    Preact.useEffect(() => {
      const reg = this.windowRegistry.get(win);

      reg?.viewStateReceivers.push(setState);

      return () => {
        reg?.viewStateReceivers.remove(setState);
      };
    }, [win]);

    return state;
  }

  addView(view: KanbanView, data: string, shouldParseData: boolean) {
    const win = view.getWindow();
    const reg = this.windowRegistry.get(win);

    if (!reg) {
      return;
    }

    if (!reg.viewMap.has(view.id)) {
      reg.viewMap.set(view.id, view);
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

    reg.viewStateReceivers.forEach((fn) => fn(this.getKanbanViews(win)));
  }

  removeView(view: KanbanView) {
    const entry = Array.from(this.windowRegistry.entries()).find(([, reg]) => {
      return reg.viewMap.has(view.id);
    }, []);

    if (!entry) {
      return;
    }

    const [win, reg] = entry;
    const file = view.file;

    if (reg.viewMap.has(view.id)) {
      reg.viewMap.delete(view.id);
    }

    if (this.stateManagers.has(file)) {
      this.stateManagers.get(file).unregisterView(view);
      reg.viewStateReceivers.forEach((fn) => fn(this.getKanbanViews(win)));
    }
  }

  handleViewFileRename(view: KanbanView, oldPath: string) {
    const win = view.getWindow();
    if (!this.windowRegistry.has(win)) {
      return;
    }

    const reg = this.windowRegistry.get(win);
    const oldId = `${(view.leaf as any).id}:::${oldPath}`;

    if (reg.viewMap.has(oldId)) {
      reg.viewMap.delete(oldId);
    }

    if (!reg.viewMap.has(view.id)) {
      reg.viewMap.set(view.id, view);
    }

    if (view.isPrimary) {
      this.getStateManager(view.file).softRefresh();
    }
  }

  mount(win: Window) {
    if (this.windowRegistry.has(win)) {
      return;
    }

    const el = win.document.body.createDiv();

    this.windowRegistry.set(win, {
      viewMap: new Map(),
      viewStateReceivers: [],
      appRoot: el,
    });

    Preact.render(createApp(win, this), el);
  }

  unmount(win: Window) {
    if (!this.windowRegistry.has(win)) {
      return;
    }

    const reg = this.windowRegistry.get(win);

    for (const view of reg.viewMap.values()) {
      view.destroy();
    }

    Preact.unmountComponentAtNode(reg.appRoot);

    reg.appRoot.remove();
    reg.viewMap.clear();
    reg.viewStateReceivers.length = 0;
    reg.appRoot = null;

    this.windowRegistry.delete(win);
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
      : app.fileManager.getNewFileParent(
          app.workspace.getActiveFile()?.path || ''
        );

    try {
      const kanban: TFile = await (
        app.fileManager as any
      ).createNewMarkdownFile(targetFolder, t('Untitled Kanban'));

      await app.vault.modify(kanban, basicFrontmatter);
      await app.workspace.getLeaf().setViewState({
        type: kanbanViewType,
        state: { file: kanban.path },
      });
    } catch (e) {
      console.error('Error creating kanban board:', e);
    }
  }

  registerEvents() {
    this.registerEvent(
      app.workspace.on('file-menu', (menu, file, source, leaf) => {
        // Add a menu item to the folder context menu to create a board
        if (file instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle(t('New kanban board'))
              .setIcon(kanbanIcon)
              .onClick(() => this.newKanban(file));
          });

          return;
        }

        if (
          !Platform.isMobile &&
          file instanceof TFile &&
          leaf &&
          source === 'sidebar-context-menu' &&
          hasFrontmatterKey(file)
        ) {
          const views = this.getKanbanViews(
            getParentWindow(leaf.view.containerEl)
          );
          let haveKanbanView = false;

          for (const view of views) {
            if (view.file === file) {
              view.onPaneMenu(menu, 'more-options', false);
              haveKanbanView = true;
              break;
            }
          }

          if (!haveKanbanView) {
            menu.addItem((item) => {
              item
                .setTitle(t('Open as kanban board'))
                .setIcon(kanbanIcon)
                .setSection('pane')
                .onClick(() => {
                  this.kanbanFileModes[(leaf as any).id || file.path] =
                    kanbanViewType;
                  this.setKanbanView(leaf);
                });
            });

            return;
          }
        }

        if (
          leaf?.view instanceof MarkdownView &&
          file instanceof TFile &&
          source === 'pane-more-options' &&
          hasFrontmatterKey(file)
        ) {
          menu.addItem((item) => {
            item
              .setTitle(t('Open as kanban board'))
              .setIcon(kanbanIcon)
              .setSection('pane')
              .onClick(() => {
                this.kanbanFileModes[(leaf as any).id || file.path] =
                  kanbanViewType;
                this.setKanbanView(leaf);
              });
          });
        }
      })
    );

    this.registerEvent(
      app.vault.on('rename', (file, oldPath) => {
        const kanbanLeaves = app.workspace.getLeavesOfType(kanbanViewType);

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
      app.vault.on('modify', (file) => {
        if (file instanceof TFile) {
          notifyFileChange(file);
        }
      })
    );

    this.registerEvent(
      app.metadataCache.on('changed', (file) => {
        notifyFileChange(file);
      })
    );

    this.registerEvent(
      app.metadataCache.on('dataview:metadata-change', (_, file) => {
        notifyFileChange(file);
      })
    );

    this.registerEvent(
      app.metadataCache.on('dataview:api-ready', () => {
        this.stateManagers.forEach((manager) => {
          manager.forceRefresh();
        });
      })
    );

    (app.workspace as any).registerHoverLinkSource(frontMatterKey, {
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
        const activeView = app.workspace.getActiveViewOfType(KanbanView);

        if (!activeView) return false;
        if (checking) return true;

        this.stateManagers.get(activeView.file).archiveCompletedCards();
      },
    });

    this.addCommand({
      id: 'toggle-kanban-view',
      name: t('Toggle between Kanban and markdown mode'),
      checkCallback: (checking) => {
        const activeFile = app.workspace.getActiveFile();

        if (!activeFile) return false;

        const fileCache = app.metadataCache.getFileCache(activeFile);
        const fileIsKanban =
          !!fileCache?.frontmatter && !!fileCache.frontmatter[frontMatterKey];

        if (checking) {
          return fileIsKanban;
        }

        const activeView = app.workspace.getActiveViewOfType(KanbanView);

        if (activeView) {
          this.kanbanFileModes[(activeView.leaf as any).id || activeFile.path] =
            'markdown';
          this.setMarkdownView(activeView.leaf);
        } else if (fileIsKanban) {
          const activeView = app.workspace.getActiveViewOfType(MarkdownView);

          if (activeView) {
            this.kanbanFileModes[
              (activeView.leaf as any).id || activeFile.path
            ] = kanbanViewType;
            this.setKanbanView(activeView.leaf);
          }
        }
      },
    });

    this.addCommand({
      id: 'convert-to-kanban',
      name: t('Convert empty note to Kanban'),
      checkCallback: (checking) => {
        const activeView = app.workspace.getActiveViewOfType(MarkdownView);

        if (!activeView) return false;

        const isFileEmpty = activeView.file.stat.size === 0;

        if (checking) return isFileEmpty;
        if (isFileEmpty) {
          app.vault
            .modify(activeView.file, basicFrontmatter)
            .then(() => {
              this.setKanbanView(activeView.leaf);
            })
            .catch((e) => console.error(e));
        }
      },
    });

    this.addCommand({
      id: 'add-kanban-lane',
      name: t('Add a list'),
      checkCallback: (checking) => {
        const view = app.workspace.getActiveViewOfType(KanbanView);

        if (checking) {
          return view && view instanceof KanbanView;
        }

        if (view && view instanceof KanbanView) {
          view.emitter.emit('showLaneForm', undefined);
        }
      },
    });
  }

  registerMonkeyPatches() {
    const self = this;

    app.workspace.onLayoutReady(() => {
      this.register(
        around((app as any).commands, {
          executeCommand(next) {
            return function (command: any) {
              const view = app.workspace.getActiveViewOfType(KanbanView);

              if (view && command?.id) {
                view.emitter.emit('hotkey', command.id);
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
  }
}
