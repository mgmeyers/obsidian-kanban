import React from 'react';

import { SortManager } from '../managers/SortManager';
import { Axis, WithChildren } from '../types';
import { DndManagerContext, SortManagerContext } from './context';

interface SortableProps extends WithChildren {
  axis: Axis;
  onSortChange?: (isSorting: boolean) => void;
}

export function Sortable({ axis, children, onSortChange }: SortableProps) {
  const dndManager = React.useContext(DndManagerContext);
  const managerRef = React.useRef<SortManager>();
  const sortManager = React.useMemo(() => {
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

  React.useEffect(() => {
    return () => managerRef.current?.destroy();
  }, []);

  if (!sortManager) {
    return null;
  }

  return (
    <SortManagerContext.Provider value={sortManager}>
      {children}
    </SortManagerContext.Provider>
  );
}

export function useIsSorting() {
  const sortManager = React.useContext(SortManagerContext);
  const [isSorting, setIsSorting] = React.useState(false);

  React.useEffect(() => {
    sortManager.addSortNotifier(setIsSorting);

    return () => {
      sortManager.removeSortNotifier(setIsSorting);
    };
  }, [sortManager]);

  return isSorting;
}
