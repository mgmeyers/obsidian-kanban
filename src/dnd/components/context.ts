import Preact from 'preact/compat';

import { DndManager } from '../managers/DndManager';
import { EntityManager } from '../managers/EntityManager';
import { ScrollManager } from '../managers/ScrollManager';
import { ScrollStateManager } from '../managers/ScrollStateManager';
import { SortManager } from '../managers/SortManager';

export const DndManagerContext = Preact.createContext<DndManager | null>(null);

export const ScopeIdContext = Preact.createContext<string>('');

export const ScrollManagerContext = Preact.createContext<ScrollManager | null>(null);

export const ScrollStateContext = Preact.createContext<ScrollStateManager>(
  new ScrollStateManager()
);

export const SortManagerContext = Preact.createContext<SortManager | null>(null);

export const EntityManagerContext = Preact.createContext<EntityManager | null>(null);

export const ExplicitPathContext = Preact.createContext<number[]>(null);
