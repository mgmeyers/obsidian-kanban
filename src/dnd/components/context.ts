import React from 'react';

import { DndManager } from '../managers/DndManager';
import { EntityManager } from '../managers/EntityManager';
import { ScrollManager } from '../managers/ScrollManager';
import { ScrollStateManager } from '../managers/ScrollStateManager';
import { SortManager } from '../managers/SortManager';

export const DndManagerContext = React.createContext<DndManager | null>(null);

export const ScopeIdContext = React.createContext<string>('');

export const ScrollManagerContext = React.createContext<ScrollManager | null>(
  null
);

export const ScrollStateContext = React.createContext<ScrollStateManager>(
  new ScrollStateManager()
);

export const SortManagerContext = React.createContext<SortManager | null>(null);

export const EntityManagerContext = React.createContext<EntityManager | null>(
  null
);
