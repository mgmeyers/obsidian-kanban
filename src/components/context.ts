import { createContext } from 'preact/compat';
import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';

import { BoardModifiers } from '../helpers/boardModifiers';
import { DateColorKey, Item, Lane, TagColorKey } from './types';

export interface KanbanContextProps {
  filePath?: string;
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
  view: KanbanView;
  getTagColor: (tag: string) => TagColorKey;
  getDateColor: (date: moment.Moment) => DateColorKey;
}

export const KanbanContext = createContext<KanbanContextProps>(null);

export interface SearchContextProps {
  query: string;
  items: Set<Item>;
  lanes: Set<Lane>;
  search: (query: string, immediate?: boolean) => void;
}

export const SearchContext = createContext<SearchContextProps | null>(null);
