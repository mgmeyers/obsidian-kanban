import Preact from 'preact/compat';

import { ScrollStateManager } from '../managers/ScrollStateManager';
import { WithChildren } from '../types';
import { rafThrottle } from '../util/animation';
import { ScopeIdContext, ScrollStateContext } from './context';

export function DndScrollState({ children }: WithChildren) {
  const manager = Preact.useMemo(() => {
    return new ScrollStateManager();
  }, []);

  return (
    <ScrollStateContext.Provider value={manager}>
      {children}
    </ScrollStateContext.Provider>
  );
}

export function useStoredScrollState(id: string, index: number | undefined) {
  const scopeId = Preact.useContext(ScopeIdContext);
  const scrollRef = Preact.useRef<HTMLDivElement>(null);
  const scrollStateManager = Preact.useContext(ScrollStateContext);

  const setRef = (el: HTMLDivElement) => {
    scrollRef.current = el;

    if (scrollRef.current) {
      el.win.requestAnimationFrame(() => {
        const state = scrollStateManager.getScrollState(id);

        if (state && (state.x !== 0 || state.y !== 0)) {
          scrollRef.current.scrollLeft = state.x;
          scrollRef.current.scrollTop = state.y;
        }
      });
    }
  };

  Preact.useEffect(() => {
    const el = scrollRef.current;

    if (!el) return;

    const onScroll = rafThrottle(el.win, (e: Event) => {
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
