import { createContext } from 'preact/compat';
import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';
import { IntersectionObserverHandler } from 'src/dnd/managers/ScrollManager';

import { BoardModifiers } from '../helpers/boardModifiers';
import { DateColor, Item, Lane, LaneSort, TagColor } from './types';

export interface KanbanContextProps {
  filePath?: string;
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
  view: KanbanView;
  getTagColor: (tag: string) => TagColor;
  getDateColor: (date: moment.Moment) => DateColor;
}

export const KanbanContext = createContext<KanbanContextProps>(null);

export interface SearchContextProps {
  query: string;
  items: Set<Item>;
  lanes: Set<Lane>;
  search: (query: string, immediate?: boolean) => void;
}

export const SearchContext = createContext<SearchContextProps | null>(null);
export const SortContext = createContext<LaneSort | null>(null);
export const IntersectionObserverContext = createContext<{
  registerHandler: (el: HTMLElement, handler: IntersectionObserverHandler) => void;
  unregisterHandler: (el: HTMLElement) => void;
} | null>(null);
