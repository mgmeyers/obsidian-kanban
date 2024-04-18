import { useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { SortManager } from '../managers/SortManager';
import { Axis, WithChildren } from '../types';
import { DndManagerContext, SortManagerContext } from './context';

interface SortableProps extends WithChildren {
  axis: Axis;
  onSortChange?: (isSorting: boolean) => void;
}

export function StaticSortable(props: SortableProps) {
  return <>{props.children}</>;
}

export function Sortable({ axis, children, onSortChange }: SortableProps) {
  const dndManager = useContext(DndManagerContext);
  const managerRef = useRef<SortManager>();
  const sortManager = useMemo(() => {
    if (dndManager) {
      if (managerRef.current) {
        managerRef.current.destroy();
      }

      const manager = new SortManager(dndManager, axis, onSortChange);

      managerRef.current = manager;

      return manager;
    }

    return null;
  }, [dndManager, axis, onSortChange]);

  useEffect(() => {
    return () => managerRef.current?.destroy();
  }, []);

  if (!sortManager) {
    return null;
  }

  return <SortManagerContext.Provider value={sortManager}>{children}</SortManagerContext.Provider>;
}

export function useIsSorting() {
  const sortManager = useContext(SortManagerContext);
  const [isSorting, setIsSorting] = useState(false);

  useEffect(() => {
    sortManager.addSortNotifier(setIsSorting);
    return () => sortManager.removeSortNotifier(setIsSorting);
  }, [sortManager]);

  return isSorting;
}
