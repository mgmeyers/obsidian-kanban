import React from 'react';

import { StateManager } from 'src/StateManager';

import { BoardModifiers } from './helpers/boardModifiers';

export interface KanbanContextProps {
  filePath?: string;
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
}

export const KanbanContext = React.createContext<KanbanContextProps>(null);
export const SearchContext = React.createContext<string | null>(null);
