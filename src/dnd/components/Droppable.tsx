import Preact from 'preact/compat';

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
  elementRef: Preact.RefObject<HTMLElement | null>;
  measureRef: Preact.RefObject<HTMLElement | null>;
  data: EntityData;
}

export const Droppable = Preact.memo(function Droppable({
  id,
  index,
  elementRef,
  measureRef,
  children,
  data,
}: DraggableProps) {
  const dndManager = Preact.useContext(DndManagerContext);
  const sortManager = Preact.useContext(SortManagerContext);
  const scopeId = Preact.useContext(ScopeIdContext);
  const parentEntityManager = Preact.useContext(EntityManagerContext);
  const parentScrollManager = Preact.useContext(ScrollManagerContext);
  const dataRef = Preact.useRef(data);
  const managerRef = Preact.useRef<EntityManager>();

  dataRef.current = data;

  const entityManager = Preact.useMemo(() => {
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

  Preact.useEffect(() => {
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
  const entityManager = Preact.useContext(EntityManagerContext);
  const currentPath = entityManager?.getPath() || [];

  if (selfIndex !== undefined) {
    currentPath.push(selfIndex);
  }

  return Preact.useMemo(() => currentPath, currentPath);
}
