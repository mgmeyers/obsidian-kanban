import Preact from 'preact/compat';

import { SortManager } from '../managers/SortManager';
import { Axis, WithChildren } from '../types';
import { DndManagerContext, SortManagerContext } from './context';

interface SortableProps extends WithChildren {
  axis: Axis;
  onSortChange?: (isSorting: boolean) => void;
}

export function Sortable({ axis, children, onSortChange }: SortableProps) {
  const dndManager = Preact.useContext(DndManagerContext);
  const managerRef = Preact.useRef<SortManager>();
  const sortManager = Preact.useMemo(() => {
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

  Preact.useEffect(() => {
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
  const sortManager = Preact.useContext(SortManagerContext);
  const [isSorting, setIsSorting] = Preact.useState(false);

  Preact.useEffect(() => {
    sortManager.addSortNotifier(setIsSorting);

    return () => {
      sortManager.removeSortNotifier(setIsSorting);
    };
  }, [sortManager]);

  return isSorting;
}
