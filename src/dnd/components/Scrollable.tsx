import React from 'react';

import { ScrollManager } from '../managers/ScrollManager';
import { WithChildren } from '../types';
import {
  DndManagerContext,
  ScopeIdContext,
  ScrollManagerContext,
} from './context';

interface ScrollContextProps extends WithChildren {
  scrollRef: React.MutableRefObject<HTMLElement | null>;
  triggerTypes?: string[];
}

export function Scrollable({
  scrollRef,
  triggerTypes,
  children,
}: ScrollContextProps) {
  const dndManager = React.useContext(DndManagerContext);
  const scopeId = React.useContext(ScopeIdContext);
  const parentScrollManager = React.useContext(ScrollManagerContext);

  const managerRef = React.useRef<ScrollManager>();

  const scrollManager = React.useMemo(() => {
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

  React.useEffect(() => {
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
