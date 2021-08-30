import update from 'immutability-helper';
import {
  HoverParent,
  HoverPopover,
  Menu,
  TFile,
  TextFileView,
  WorkspaceLeaf,
} from 'obsidian';
import React from 'react';

import { c } from './components/helpers';
import { Kanban } from './components/Kanban';
import { Board } from './components/types';
import { Emitter, createEmitter } from './dnd/util/emitter';
import { t } from './lang/helpers';
import KanbanPlugin from './main';
import { SettingsModal } from './Settings';

export const kanbanViewType = 'kanban';
export const kanbanIcon = 'blocks';

interface ViewEvents {
  showLaneForm(data: { referenceRect: DOMRect }): void;
  toggleSearch(): void;
}

export class KanbanView extends TextFileView implements HoverParent {
  plugin: KanbanPlugin;
  hoverPopover: HoverPopover | null;
  emitter: Emitter<ViewEvents>;

  constructor(leaf: WorkspaceLeaf, plugin: KanbanPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.emitter = createEmitter();

    this.addAction('gear', 'Board settings', () => {
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
    });

    this.addAction('document', 'View board as markdown', () => {
      this.plugin.kanbanFileModes[(this.leaf as any).id || this.file.path] =
        'markdown';
      this.plugin.setMarkdownView(this.leaf);
    });

    this.addAction('sheets-in-box', 'Archive all completed cards', () => {
      const stateManager = this.plugin.stateManagers.get(this.file);
      stateManager.archiveCompletedCards();
    });

    this.addAction('plus-with-circle', 'Add list', (e) => {
      this.emitter.emit('showLaneForm', {
        referenceRect: (e.target as HTMLElement).getBoundingClientRect(),
      });
    }).addClass(c('ignore-click-outside'));
  }

  get id(): string {
    return `${(this.leaf as any).id}:::${this.file?.path}`;
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

  async onClose() {
    // Remove draggables from render, as the DOM has already detached
    this.plugin.removeView(this);
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

  async onUnloadFile(file: TFile) {
    this.plugin.removeView(this);
    return await super.onUnloadFile(file);
  }

  handleRename(newPath: string, oldPath: string) {
    if (this.file.path === newPath) {
      this.plugin.handleViewFileRename(this, oldPath);
    }
  }

  requestSaveToDisk(data: string) {
    if (this.data !== data) {
      this.data = data;
      this.requestSave();
    }
  }

  getViewData() {
    // In theory, we could unparse the board here.  In practice, the board can be
    // in an error state, so we return the last good data here.  (In addition,
    // unparsing is slow, and getViewData() can be called more often than the
    // data actually changes.)
    return this.data;
  }

  setViewData(data: string) {
    this.plugin.addView(this, data);
  }

  getPortal() {
    const stateManager = this.plugin.stateManagers.get(this.file);

    return <Kanban stateManager={stateManager} view={this} />;
  }

  toggleSearch() {
    this.emitter.emit('toggleSearch', null);
  }

  onMoreOptionsMenu(menu: Menu) {
    // Add a menu item to force the board to markdown view
    menu
      .addItem((item) => {
        item
          .setTitle(t('Open as markdown'))
          .setIcon('document')
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
          .setIcon('gear')
          .onClick(() => {
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
          });
      })
      .addItem((item) => {
        item
          .setTitle(t('Archive completed cards'))
          .setIcon('sheets-in-box')
          .onClick(() => {
            const stateManager = this.plugin.stateManagers.get(this.file);
            stateManager.archiveCompletedCards();
          });
      })
      .addSeparator();

    super.onMoreOptionsMenu(menu);
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
