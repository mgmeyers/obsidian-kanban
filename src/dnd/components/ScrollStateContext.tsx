import rafSchd from 'raf-schd';
import React from 'react';

import { ScrollStateManager } from '../managers/ScrollStateManager';
import { WithChildren } from '../types';
import { ScopeIdContext, ScrollStateContext } from './context';

export function DndScrollState({ children }: WithChildren) {
  const manager = React.useMemo(() => {
    return new ScrollStateManager();
  }, []);

  return (
    <ScrollStateContext.Provider value={manager}>
      {children}
    </ScrollStateContext.Provider>
  );
}

export function useStoredScrollState(id: string, index: number | undefined) {
  const scopeId = React.useContext(ScopeIdContext);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const scrollStateManager = React.useContext(ScrollStateContext);

  const setRef = (el: HTMLDivElement) => {
    scrollRef.current = el;

    if (scrollRef.current) {
      requestAnimationFrame(() => {
        const state = scrollStateManager.getScrollState(id);

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

      scrollStateManager.setScrollState(scopeId, id, {
        x: target.scrollLeft,
        y: target.scrollTop,
      });
    });

    el.addEventListener('scroll', onScroll);

    return () => {
      el.removeEventListener('scroll', onScroll);
    };
  }, [scrollStateManager, id, index]);

  return { setRef, scrollRef };
}
