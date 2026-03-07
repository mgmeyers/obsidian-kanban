import { App, SuggestModal } from 'obsidian';
import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import { moveEntity } from 'src/dnd/util/data';
import { t } from 'src/lang/helpers';

interface ColumnSuggestion {
  title: string;
  index: number;
}

export class MoveToColumnModal extends SuggestModal<ColumnSuggestion> {
  private readonly currentPath: Path;
  private readonly stateManager: StateManager;

  constructor(app: App, stateManager: StateManager, path: Path) {
    super(app);
    this.currentPath = path;
    this.stateManager = stateManager;
    this.setPlaceholder(t('Move to column'));
    this.emptyStateText = t('No other columns available');
  }

  getSuggestions(query: string): ColumnSuggestion[] {
    const normalizedQuery = query.trim().toLowerCase();
    return this.stateManager.state.children
      .map((lane, index) => ({
        index,
        title: lane.data.title,
      }))
      .filter(
        ({ index, title }) =>
          index !== this.currentPath[0] &&
          (!normalizedQuery || title.toLowerCase().includes(normalizedQuery))
      );
  }

  renderSuggestion(value: ColumnSuggestion, el: HTMLElement) {
    el.setText(value.title);
  }

  onChooseSuggestion(value: ColumnSuggestion): void {
    this.stateManager.setState((boardData) => {
      const targetLane = boardData.children[value.index];
      const destinationPath: Path = [value.index, targetLane.children.length];
      return moveEntity(boardData, this.currentPath, destinationPath);
    });
  }
}
