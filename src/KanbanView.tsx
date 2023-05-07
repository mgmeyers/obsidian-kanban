import update from 'immutability-helper';
import {
  HoverParent,
  HoverPopover,
  Menu,
  TFile,
  TextFileView,
  WorkspaceLeaf,
} from 'obsidian';

import { c } from './components/helpers';
import { Kanban } from './components/Kanban';
import { Board } from './components/types';
import { Emitter, createEmitter } from './dnd/util/emitter';
import { getParentWindow } from './dnd/util/getWindow';
import {
  gotoNextDailyNote,
  gotoPrevDailyNote,
  hasFrontmatterKeyRaw,
} from './helpers';
import { t } from './lang/helpers';
import KanbanPlugin from './main';
import { SettingsModal } from './Settings';

export const kanbanViewType = 'kanban';
export const kanbanIcon = 'lucide-trello';

interface ViewEvents {
  showLaneForm: () => void;
  hotkey: (commandId: string) => void;
}

export class KanbanView extends TextFileView implements HoverParent {
  plugin: KanbanPlugin;
  hoverPopover: HoverPopover | null;
  emitter: Emitter<ViewEvents>;
  actionButtons: Record<string, HTMLElement> = {};

  constructor(leaf: WorkspaceLeaf, plugin: KanbanPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.emitter = createEmitter();

    this.emitter.on('hotkey', (commmandId) => {
      switch (commmandId) {
        case 'daily-notes:goto-prev': {
          gotoPrevDailyNote(this.app, this.file);
          break;
        }
        case 'daily-notes:goto-next': {
          gotoNextDailyNote(this.app, this.file);
          break;
        }
      }
    });

    this.register(
      this.containerEl.onWindowMigrated(() => {
        this.plugin.removeView(this);
        this.plugin.addView(this, this.data, this.isPrimary);
      })
    );
  }

  get isPrimary(): boolean {
    return this.plugin.getStateManager(this.file)?.getAView() === this;
  }

  get id(): string {
    return `${(this.leaf as any).id}:::${this.file?.path}`;
  }

  get isShiftPressed(): boolean {
    return this.plugin.isShiftPressed;
  }

  setBoard(board: Board, shouldSave: boolean = true) {
    const stateManager = this.plugin.stateManagers.get(this.file);
    stateManager.setState(board, shouldSave);
  }

  getBoard(): Board {
    const stateManager = this.plugin.stateManagers.get(this.file);
    return stateManager.state;
  }

  getViewType() {
    return kanbanViewType;
  }

  getIcon() {
    return kanbanIcon;
  }

  getDisplayText() {
    return this.file?.basename || 'Kanban';
  }

  getWindow() {
    return getParentWindow(this.containerEl) as Window & typeof globalThis;
  }

  async onLoadFile(file: TFile) {
    try {
      return await super.onLoadFile(file);
    } catch (e) {
      const stateManager = this.plugin.stateManagers.get(this.file);

      stateManager.setError(e);

      throw e;
    }
  }

  destroy() {
    // Remove draggables from render, as the DOM has already detached
    this.plugin.removeView(this);

    Object.values(this.actionButtons).forEach((b) => b.remove());
    this.actionButtons = {};
  }

  async onClose() {
    this.destroy();
  }

  async onUnloadFile(file: TFile) {
    this.destroy();
    return await super.onUnloadFile(file);
  }

  handleRename(newPath: string, oldPath: string) {
    if (this.file.path === newPath) {
      this.plugin.handleViewFileRename(this, oldPath);
    }
  }

  requestSaveToDisk(data: string) {
    if (this.data !== data && this.isPrimary) {
      this.data = data;
      this.requestSave();
    } else {
      this.data = data;
    }
  }

  getViewData() {
    // In theory, we could unparse the board here.  In practice, the board can be
    // in an error state, so we return the last good data here.  (In addition,
    // unparsing is slow, and getViewData() can be called more often than the
    // data actually changes.)
    return this.data;
  }

  setViewData(data: string, clear?: boolean) {
    if (!hasFrontmatterKeyRaw(data)) {
      this.plugin.kanbanFileModes[(this.leaf as any).id || this.file.path] =
        'markdown';
      this.plugin.removeView(this);
      this.plugin.setMarkdownView(this.leaf, false);

      return;
    }

    this.plugin.addView(this, data, !clear && this.isPrimary);
  }

  getPortal() {
    const stateManager = this.plugin.stateManagers.get(this.file);
    return <Kanban stateManager={stateManager} view={this} />;
  }

  getBoardSettings() {
    const stateManager = this.plugin.stateManagers.get(this.file);
    const board = stateManager.state;

    new SettingsModal(
      this,
      {
        onSettingsChange: (settings) => {
          const updatedBoard = update(board, {
            data: {
              settings: {
                $set: settings,
              },
            },
          });

          // Save to disk, compute text of new board
          stateManager.setState(updatedBoard);
        },
      },
      board.data.settings
    ).open();
  }


  onPaneMenu(menu: Menu, source: string, callSuper: boolean = true) {
    if (source !== 'more-options') {
      super.onPaneMenu(menu, source);
      return;
    }
    // Add a menu item to force the board to markdown view
    menu
      .addItem((item) => {
        item
          .setTitle(t('Open as markdown'))
          .setIcon('lucide-file-text')
          .setSection('pane')
          .onClick(() => {
            this.plugin.kanbanFileModes[
              (this.leaf as any).id || this.file.path
            ] = 'markdown';
            this.plugin.setMarkdownView(this.leaf);
          });
      })
      .addItem((item) => {
        item
          .setTitle(t('Open board settings'))
          .setIcon('lucide-settings')
          .setSection('pane')
          .onClick(() => {
            this.getBoardSettings();
          });
      })
      .addItem((item) => {
        item
          .setTitle(t('Archive completed cards'))
          .setIcon('lucide-archive')
          .setSection('pane')
          .onClick(() => {
            const stateManager = this.plugin.stateManagers.get(this.file);
            stateManager.archiveCompletedCards();
          });
      });

    if (callSuper) {
      super.onPaneMenu(menu, source);
    }
  }

  initHeaderButtons() {
    const stateManager = this.plugin.getStateManager(this.file);

    if (!stateManager) return;

    if (
      stateManager.getSetting('show-board-settings') &&
      !this.actionButtons['show-board-settings']
    ) {
      this.actionButtons['show-board-settings'] = this.addAction(
        'lucide-settings',
        t('Open board settings'),
        () => {
          this.getBoardSettings();
        }
      );
    } else if (
      !stateManager.getSetting('show-board-settings') &&
      this.actionButtons['show-board-settings']
    ) {
      this.actionButtons['show-board-settings'].remove();
      delete this.actionButtons['show-board-settings'];
    }

    if (
      stateManager.getSetting('show-search') &&
      !this.actionButtons['show-search']
    ) {
      this.actionButtons['show-search'] = this.addAction(
        'lucide-search',
        t('Search...'),
        () => {
          this.emitter.emit('hotkey', 'editor:open-search');
        }
      );
    } else if (
      !stateManager.getSetting('show-search') &&
      this.actionButtons['show-search']
    ) {
      this.actionButtons['show-search'].remove();
      delete this.actionButtons['show-search'];
    }

    if (
      stateManager.getSetting('show-view-as-markdown') &&
      !this.actionButtons['show-view-as-markdown']
    ) {
      this.actionButtons['show-view-as-markdown'] = this.addAction(
        'lucide-file-text',
        t('Open as markdown'),
        () => {
          this.plugin.kanbanFileModes[(this.leaf as any).id || this.file.path] =
            'markdown';
          this.plugin.setMarkdownView(this.leaf);
        }
      );
    } else if (
      !stateManager.getSetting('show-view-as-markdown') &&
      this.actionButtons['show-view-as-markdown']
    ) {
      this.actionButtons['show-view-as-markdown'].remove();
      delete this.actionButtons['show-view-as-markdown'];
    }

    if (
      stateManager.getSetting('show-archive-all') &&
      !this.actionButtons['show-archive-all']
    ) {
      this.actionButtons['show-archive-all'] = this.addAction(
        'lucide-archive',
        t('Archive completed cards'),
        () => {
          const stateManager = this.plugin.stateManagers.get(this.file);
          stateManager.archiveCompletedCards();
        }
      );
    } else if (
      !stateManager.getSetting('show-archive-all') &&
      this.actionButtons['show-archive-all']
    ) {
      this.actionButtons['show-archive-all'].remove();
      delete this.actionButtons['show-archive-all'];
    }

    if (
      stateManager.getSetting('show-add-list') &&
      !this.actionButtons['show-add-list']
    ) {
      const btn = this.addAction('lucide-plus-circle', t('Add a list'), () => {
        this.emitter.emit('showLaneForm', undefined);
      });

      btn.addClass(c('ignore-click-outside'));

      this.actionButtons['show-add-list'] = btn;
    } else if (
      !stateManager.getSetting('show-add-list') &&
      this.actionButtons['show-add-list']
    ) {
      this.actionButtons['show-add-list'].remove();
      delete this.actionButtons['show-add-list'];
    }
  }

  clear() {
    /*
      Obsidian *only* calls this after unloading a file, before loading the next.
      Specifically, from onUnloadFile, which calls save(true), and then optionally
      calls clear, if and only if this.file is still non-empty.  That means that
      in this function, this.file is still the *old* file, so we should not do
      anything here that might try to use the file (including its path), so we
      should avoid doing anything that refreshes the display.  (Since that could
      use the file, and would also flash an empty pane during navigation, depending
      on how long the next file load takes.)

      Given all that, it makes more sense to clean up our state from onLoadFile, as
      following a clear there are only two possible states: a successful onLoadFile
      updates our full state via setViewData(), or else it aborts with an error
      first.  So as long as setViewData() and the error handler for onLoadFile()
      fully reset the state (to a valid load state or a valid error state),
      there's nothing to do in this method.  (We can't omit it, since it's
      abstract.)
    */
  }
}
