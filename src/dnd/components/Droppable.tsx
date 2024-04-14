import { RefObject, memo, useContext, useMemo, useRef } from 'preact/compat';
import { useOnMount } from 'src/components/helpers';

import { EntityManager } from '../managers/EntityManager';
import { EntityData, WithChildren } from '../types';
import {
  DndManagerContext,
  EntityManagerContext,
  ExplicitPathContext,
  ScopeIdContext,
  ScrollManagerContext,
  SortManagerContext,
} from './context';

export interface DraggableProps extends WithChildren {
  id: string;
  index: number;
  elementRef: RefObject<HTMLElement | null>;
  measureRef: RefObject<HTMLElement | null>;
  data: EntityData;
}

export function StaticDroppable(props: DraggableProps) {
  return <>{props.children}</>;
}

export const Droppable = memo(function Droppable({
  id,
  index,
  elementRef,
  measureRef,
  children,
  data,
}: DraggableProps) {
  const dndManager = useContext(DndManagerContext);
  const sortManager = useContext(SortManagerContext);
  const scopeId = useContext(ScopeIdContext);
  const parentEntityManager = useContext(EntityManagerContext);
  const parentScrollManager = useContext(ScrollManagerContext);
  const dataRef = useRef(data);
  const managerRef = useRef<EntityManager>();

  dataRef.current = data;

  const entityManager = useMemo(() => {
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
        dataRef
      );

      if (elementRef.current && measureRef.current) {
        manager.initNodes(elementRef.current, measureRef.current);
      }

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

  useOnMount(
    [elementRef, measureRef],
    () => {
      managerRef.current?.initNodes(elementRef.current, measureRef.current);
    },
    () => {
      managerRef.current?.destroy();
    }
  );

  if (!entityManager) {
    return null;
  }

  return (
    <EntityManagerContext.Provider value={entityManager}>{children}</EntityManagerContext.Provider>
  );
});

export function useNestedEntityPath(selfIndex?: number) {
  const entityManager = useContext(EntityManagerContext);
  const explicitPath = useContext(ExplicitPathContext);
  const currentPath = explicitPath ?? entityManager?.getPath() ?? [];

  if (selfIndex !== undefined) {
    currentPath.push(selfIndex);
  }

  return useMemo(() => currentPath, currentPath);
}
