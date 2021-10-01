import React from 'react';

import { EntityManager } from '../managers/EntityManager';
import { EntityData, WithChildren } from '../types';
import {
  DndManagerContext,
  EntityManagerContext,
  ScopeIdContext,
  ScrollManagerContext,
  SortManagerContext,
} from './context';

interface DraggableProps extends WithChildren {
  id: string;
  index: number;
  elementRef: React.MutableRefObject<HTMLElement | null>;
  measureRef: React.MutableRefObject<HTMLElement | null>;
  data: EntityData;
}

export const Droppable = React.memo(function Droppable({
  id,
  index,
  elementRef,
  measureRef,
  children,
  data,
}: DraggableProps) {
  const dndManager = React.useContext(DndManagerContext);
  const sortManager = React.useContext(SortManagerContext);
  const scopeId = React.useContext(ScopeIdContext);
  const parentEntityManager = React.useContext(EntityManagerContext);
  const parentScrollManager = React.useContext(ScrollManagerContext);
  const dataRef = React.useRef(data);
  const managerRef = React.useRef<EntityManager>();

  dataRef.current = data;

  const entityManager = React.useMemo(() => {
    if (dndManager) {
      if (managerRef.current) {
        managerRef.current.destroy();
      }

      const manager = new EntityManager(
        dndManager,
        scopeId,
        id,
        index,
        parentEntityManager,
        parentScrollManager,
        sortManager,
        () => elementRef.current,
        () => measureRef.current,
        () => dataRef.current
      );

      managerRef.current = manager;

      return manager;
    }

    return null;
  }, [
    id,
    index,

    //
    dndManager,
    scopeId,
    parentEntityManager,
    parentScrollManager,
    sortManager,
  ]);

  React.useEffect(() => {
    return () => managerRef.current?.destroy();
  }, []);

  if (!entityManager) {
    return null;
  }

  return (
    <EntityManagerContext.Provider value={entityManager}>
      {children}
    </EntityManagerContext.Provider>
  );
});

export function useNestedEntityPath(selfIndex?: number) {
  const entityManager = React.useContext(EntityManagerContext);
  const currentPath = entityManager?.getPath() || [];

  if (selfIndex !== undefined) {
    currentPath.push(selfIndex);
  }

  return React.useMemo(() => currentPath, currentPath);
}
