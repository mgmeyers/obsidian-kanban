import Preact from 'preact/compat';

import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';

import { BoardModifiers } from '../helpers/boardModifiers';

export interface KanbanContextProps {
  filePath?: string;
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
  view: KanbanView;
}

export const KanbanContext = Preact.createContext<KanbanContextProps>(null);
export const SearchContext = Preact.createContext<string | null>(null);
