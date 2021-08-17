import React from "react";
import { WithChildren } from "../types";
import { ScrollManager } from "../managers/ScrollManager";
import {
  DndManagerContext,
  ScopeIdContext,
  ScrollManagerContext,
} from "./context";

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
  const [scrollManager, setScrollManager] = React.useState<ScrollManager>();

  // ok

  React.useEffect(() => {
    if (dndManager && scrollRef.current) {
      const manager = new ScrollManager(
        dndManager,
        scopeId,
        scrollRef.current,
        triggerTypes || ([] as string[]),
        parentScrollManager
      );

      setScrollManager(manager);

      return () => {
        setTimeout(() => {
          manager.destroy();
        })
      }
    }
  }, [dndManager, scopeId, scrollRef, triggerTypes, parentScrollManager]);

  if (!scrollManager) {
    return null;
  }

  return (
    <ScrollManagerContext.Provider value={scrollManager}>
      {children}
    </ScrollManagerContext.Provider>
  );
}
