import { RefObject, useContext, useMemo, useRef } from 'preact/compat';
import { useOnMount } from 'src/components/helpers';

import { ScrollManager } from '../managers/ScrollManager';
import { WithChildren } from '../types';
import { DndManagerContext, ScopeIdContext, ScrollManagerContext } from './context';

interface ScrollContextProps extends WithChildren {
  scrollRef: RefObject<HTMLElement | null>;
  triggerTypes?: string[];
}

export function Scrollable({ scrollRef, triggerTypes, children }: ScrollContextProps) {
  const dndManager = useContext(DndManagerContext);
  const scopeId = useContext(ScopeIdContext);
  const parentScrollManager = useContext(ScrollManagerContext);

  const managerRef = useRef<ScrollManager>();

  const scrollManager = useMemo(() => {
    if (dndManager) {
      if (managerRef.current) {
        managerRef.current.destroy();
      }

      const manager = new ScrollManager(
        dndManager,
        scopeId,
        triggerTypes || ([] as string[]),
        parentScrollManager
      );

      managerRef.current = manager;

      return manager;
    }

    return null;
  }, [dndManager, scopeId, scrollRef, triggerTypes, parentScrollManager]);

  useOnMount(
    [scrollRef],
    () => managerRef.current?.initNodes(scrollRef.current),
    () => managerRef.current?.destroy()
  );

  if (!scrollManager) {
    return null;
  }

  return (
    <ScrollManagerContext.Provider value={scrollManager}>{children}</ScrollManagerContext.Provider>
  );
}
