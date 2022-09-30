import Preact from 'preact/compat';

import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';

import { BoardModifiers } from '../helpers/boardModifiers';
import { DateColorKey, TagColorKey } from './types';

export interface KanbanContextProps {
  filePath?: string;
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
  view: KanbanView;
  getTagColor: (tag: string) => TagColorKey;
  getDateColor: (date: moment.Moment) => DateColorKey;
}

export const KanbanContext = Preact.createContext<KanbanContextProps>(null);
export const SearchContext = Preact.createContext<string | null>(null);
