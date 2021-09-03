import React from 'react';

import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';

import { BoardModifiers } from './helpers/boardModifiers';

export interface KanbanContextProps {
  filePath?: string;
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
  view: KanbanView;
}

export const KanbanContext = React.createContext<KanbanContextProps>(null);
export const SearchContext = React.createContext<string | null>(null);
