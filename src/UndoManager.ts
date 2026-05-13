import { Notice, TFile, setIcon } from 'obsidian';

import type KanbanPlugin from './main';
import type { KanbanViewSettings } from './Settings';
import type { StateManager } from './StateManager';
import { Board } from './components/types';
import { t } from './lang/helpers';

interface ViewStateSnapshot {
  state: KanbanViewSettings;
}

interface UndoFileState {
  file: TFile;
  before: Board;
  beforeMd: string;
  afterMd: string;
  viewStates: ViewStateSnapshot[];
}

interface PendingFileState {
  manager: StateManager;
  before: Board;
  beforeMd: string;
  viewStates: ViewStateSnapshot[];
}

interface UndoEntry {
  id: number;
  label: string;
  files: UndoFileState[];
}

type BoardUpdater = Board | ((board: Board) => Board);

function cloneViewState(state: KanbanViewSettings): KanbanViewSettings {
  const next = { ...state };

  if (Array.isArray(next['list-collapse'])) {
    next['list-collapse'] = [...next['list-collapse']];
  }

  return next;
}

export class KanbanUndoManager {
  private stack: UndoEntry[] = [];
  private nextId = 1;
  private maxEntries = 50;
  private currentNotice: Notice | null = null;
  private currentNoticeTimer: number | null = null;

  constructor(private plugin: KanbanPlugin) {}

  canUndo() {
    return this.stack.length > 0;
  }

  capture(manager: StateManager): PendingFileState {
    return {
      manager,
      before: manager.state,
      beforeMd: manager.parser.boardToMd(manager.state),
      viewStates: Array.from(manager.viewSet).map((view) => ({
        state: cloneViewState(view.viewSettings),
      })),
    };
  }

  run(label: string, manager: StateManager, updater: BoardUpdater) {
    if (manager.getSetting('enable-undo') === false) {
      manager.setState(updater);
      return;
    }

    const before = this.capture(manager);

    manager.setState(updater);

    this.record(label, [before]);
  }

  record(label: string, beforeStates: PendingFileState[]) {
    const files: UndoFileState[] = [];

    for (const beforeState of beforeStates) {
      const { manager } = beforeState;
      const afterMd = manager.parser.boardToMd(manager.state);

      if (manager.getSetting('enable-undo') === false) continue;
      if (beforeState.beforeMd === afterMd) continue;

      files.push({
        file: manager.file,
        before: beforeState.before,
        beforeMd: beforeState.beforeMd,
        afterMd,
        viewStates: beforeState.viewStates,
      });
    }

    if (!files.length) return;

    const entry: UndoEntry = {
      id: this.nextId++,
      label,
      files,
    };

    this.stack.push(entry);

    if (this.stack.length > this.maxEntries) {
      this.stack.shift();
    }

    if (files.some((file) => this.plugin.getStateManager(file.file)?.getSetting('show-undo-notice') !== false)) {
      this.showUndoNotice(entry);
    }
  }

  async undoLast() {
    const entry = this.stack[this.stack.length - 1];

    if (!entry) {
      new Notice(t('Nothing to undo'));
      return;
    }

    if (!(await this.canApply(entry))) {
      new Notice(t('Unable to undo because the board has changed'));
      return;
    }

    for (const fileState of entry.files) {
      await this.restore(fileState);
    }

    this.stack.pop();
    this.dismissCurrentNotice();
  }

  private async canApply(entry: UndoEntry) {
    for (const fileState of entry.files) {
      const manager = this.plugin.getStateManager(fileState.file);

      if (manager) continue;

      const currentMd = await this.plugin.app.vault.cachedRead(fileState.file);

      if (currentMd !== fileState.afterMd) {
        return false;
      }
    }

    return true;
  }

  private async restore(fileState: UndoFileState) {
    const manager = this.plugin.getStateManager(fileState.file);

    if (!manager) {
      await this.plugin.app.vault.modify(fileState.file, fileState.beforeMd);
      return;
    }

    manager.setState(fileState.before);

    Array.from(manager.viewSet).forEach((view, index) => {
      const snapshot = fileState.viewStates[index];
      if (snapshot) {
        view.viewSettings = cloneViewState(snapshot.state);
      }
    });
  }

  private showUndoNotice(entry: UndoEntry) {
    this.dismissCurrentNotice(false);

    const fragment = activeDocument.createDocumentFragment();
    const chip = activeDocument.createElement('div');
    const message = activeDocument.createElement('span');
    const button = activeDocument.createElement('button');
    let notice: Notice;

    chip.addClass('kanban-plugin__undo-notice-chip');
    message.textContent = entry.label;
    message.addClass('kanban-plugin__undo-notice-label');
    button.setAttr('aria-label', `${t('Undo')} ${entry.label}`);
    button.setAttr('title', `${t('Undo')} ${entry.label}`);
    button.addClass('kanban-plugin__undo-notice-button');
    setIcon(button, 'lucide-undo-2');
    button.onclick = async () => {
      await this.undoEntry(entry);
    };

    chip.append(message, button);
    fragment.append(chip);
    notice = new Notice(fragment, 0);
    notice.noticeEl.addClass('kanban-plugin__undo-notice');
    this.currentNotice = notice;

    this.currentNoticeTimer = activeWindow.setTimeout(() => {
      if (this.currentNotice === notice) {
        this.dismissCurrentNotice();
      }
    }, 3000);
  }

  private async undoEntry(entry: UndoEntry) {
    if (this.stack[this.stack.length - 1]?.id !== entry.id) return;

    await this.undoLast();
  }

  private dismissCurrentNotice(animate: boolean = true) {
    const notice = this.currentNotice;

    if (!notice) return;

    if (this.currentNoticeTimer !== null) {
      activeWindow.clearTimeout(this.currentNoticeTimer);
      this.currentNoticeTimer = null;
    }

    this.currentNotice = null;

    if (!animate) {
      notice.hide();
      return;
    }

    notice.noticeEl.addClass('kanban-plugin__undo-notice-dismissing');
    activeWindow.setTimeout(() => {
      notice.hide();
    }, 360);
  }
}
