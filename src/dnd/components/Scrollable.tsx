import Preact from 'preact/compat';

import { ScrollManager } from '../managers/ScrollManager';
import { WithChildren } from '../types';
import {
  DndManagerContext,
  ScopeIdContext,
  ScrollManagerContext,
} from './context';

interface ScrollContextProps extends WithChildren {
  scrollRef: Preact.RefObject<HTMLElement | null>;
  triggerTypes?: string[];
}

export function Scrollable({
  scrollRef,
  triggerTypes,
  children,
}: ScrollContextProps) {
  const dndManager = Preact.useContext(DndManagerContext);
  const scopeId = Preact.useContext(ScopeIdContext);
  const parentScrollManager = Preact.useContext(ScrollManagerContext);

  const managerRef = Preact.useRef<ScrollManager>();

  const scrollManager = Preact.useMemo(() => {
    if (dndManager) {
      if (managerRef.current) {
        managerRef.current.destroy();
      }

      const manager = new ScrollManager(
        dndManager,
        scopeId,
        triggerTypes || ([] as string[]),
        parentScrollManager,
        () => scrollRef.current
      );

      managerRef.current = manager;

      return manager;
    }

    return null;
  }, [dndManager, scopeId, scrollRef, triggerTypes, parentScrollManager]);

  Preact.useEffect(() => {
    return () => managerRef.current?.destroy();
  }, []);

  if (!scrollManager) {
    return null;
  }

  return (
    <ScrollManagerContext.Provider value={scrollManager}>
      {children}
    </ScrollManagerContext.Provider>
  );
}
