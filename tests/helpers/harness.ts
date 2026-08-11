import { KanbanSettings } from 'src/Settings';
import { StateManager } from 'src/StateManager';
import { Board } from 'src/components/types';
import { BoardModifiers, getBoardModifiers } from 'src/helpers/boardModifiers';

// Imported from the stub rather than from `obsidian`: that is what the alias in
// vitest.config.ts resolves to at runtime, and the stub's `TFile` takes a path,
// where the published typings declare a zero-argument constructor.
import { TFile } from '../mocks/obsidian';

/**
 * Enough of `KanbanView` for `StateManager` to drive. The board's markdown ends
 * up in `saved`, which is what a smoke test asserts on.
 */
export class FakeKanbanView {
  file: TFile;
  data = '';
  viewSettings: Record<string, any> = {};
  saved: string[] = [];

  constructor(file: TFile) {
    this.file = file;
  }

  async prerender() {}
  populateViewState() {}
  initHeaderButtons() {}
  validatePreviewCache() {}

  requestSaveToDisk(data: string) {
    this.data = data;
    this.saved.push(data);
  }

  getWindow() {
    return window;
  }

  getViewState(key: string) {
    return this.viewSettings[key];
  }

  setViewState(key: string, val: any, op?: (val: any) => any) {
    this.viewSettings[key] = op ? op(this.viewSettings[key]) : val;
  }
}

export interface Harness {
  stateManager: StateManager;
  view: FakeKanbanView;
  boardModifiers: BoardModifiers;
  /** The board as it currently stands in memory. */
  board: () => Board;
  /** The markdown last written back to disk. */
  markdown: () => string;
  errors: () => string[];
}

/**
 * Boots a real `StateManager` over `md`, so tests exercise the actual parser,
 * settings resolution, board modifiers and serializer.
 */
export async function loadBoard(md: string, globalSettings: KanbanSettings = {}): Promise<Harness> {
  const view = new FakeKanbanView(new TFile('Board.md'));

  const stateManager = new StateManager(
    (globalThis as any).app,
    view as any,
    md,
    () => {},
    () => globalSettings
  );

  // registerView() is async and the constructor doesn't await it
  await new Promise((res) => setTimeout(res, 25));

  return {
    stateManager,
    view,
    boardModifiers: getBoardModifiers(view as any, stateManager),
    board: () => stateManager.state,
    markdown: () => view.saved[view.saved.length - 1] ?? '',
    errors: () => stateManager.state.data.errors.map((e) => e.description),
  };
}

/** Path of the card with the given raw title, or undefined. */
export function findItemPath(board: Board, titleRaw: string): [number, number] | undefined {
  for (let laneIndex = 0; laneIndex < board.children.length; laneIndex++) {
    const itemIndex = board.children[laneIndex].children.findIndex((item) =>
      item.data.titleRaw.startsWith(titleRaw)
    );

    if (itemIndex !== -1) return [laneIndex, itemIndex];
  }
}
