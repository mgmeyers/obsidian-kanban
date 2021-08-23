import rafSchd from "raf-schd";
import React from "react";
import { CoordinateShift, WithChildren } from "../types";
import { ScrollStateContext } from "./context";

export function DndScrollState({ children }: WithChildren) {
  const manager = React.useMemo(() => {
    return new Map<string, CoordinateShift>();
  }, []);

  return (
    <ScrollStateContext.Provider value={manager}>
      {children}
    </ScrollStateContext.Provider>
  );
}

export function useStoredScrollState(id: string, index: number | undefined) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const scrollStates = React.useContext(ScrollStateContext);
  
  const setRef = (el: HTMLDivElement) => {
    scrollRef.current = el;

    if (scrollRef.current) {
      requestAnimationFrame(() => {
        const state = scrollStates.get(id);

        if (state && (state.x !== 0 || state.y !== 0)) {
          scrollRef.current.scrollLeft = state.x;
          scrollRef.current.scrollTop = state.y;
        }
      });
    }
  };

  React.useEffect(() => {
    const el = scrollRef.current;

    if (!el) return;

    const onScroll = rafSchd((e: Event) => {
      const target = e.target as HTMLElement;

      scrollStates.set(id, {
        x: target.scrollLeft,
        y: target.scrollTop,
      });
    });

    el.addEventListener("scroll", onScroll);

    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [scrollStates, id, index]);

  return { setRef, scrollRef };
}
