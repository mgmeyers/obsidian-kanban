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

export function useStoredScrollState(
  id: string,
  index: number | undefined,
  scrollRef: React.RefObject<HTMLElement>
) {
  const scrollStates = React.useContext(ScrollStateContext);

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

    const state = scrollStates.get(id);

    if (state && (state.x !== 0 || state.y !== 0)) {
      el.scrollLeft = state.x;
      el.scrollTop = state.y;
    }

    el.addEventListener("scroll", onScroll);

    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [scrollStates, id, index, scrollRef]);
}
