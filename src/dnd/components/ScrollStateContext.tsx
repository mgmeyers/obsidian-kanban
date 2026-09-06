/**
 * ============================================================================
 * [실행 순서 #39] ScrollStateContext.tsx — 스크롤 위치를 기억하고 하위에 전달하는 Context
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * dnd/managers/ScrollStateManager.ts 인스턴스를 생성해 ScrollStateContext로 공급하는
 * DndScrollState 컴포넌트와, 개별 스크롤 컨테이너(#38 ScrollContainer.tsx 등)가 자신의
 * 스크롤 위치를 저장/복원하기 위해 사용하는 useStoredScrollState 훅을 정의합니다.
 * 칸반 보드는 노트를 다시 열 때마다 컴포넌트 트리가 새로 마운트되는데, 이때 사용자가
 * 보던 스크롤 위치를 그대로 복원해주기 위해 ScrollStateManager가 스코프/엔티티 id별로
 * 스크롤 좌표를 메모리에 캐시해 둡니다. 실제 스크롤 이벤트 발생 시 위치를 rAF로
 * 쓰로틀링하여 저장하므로 렌더링 성능에 미치는 영향을 최소화합니다.
 * ============================================================================
 */
import Preact from 'preact/compat';

import { ScrollStateManager } from '../managers/ScrollStateManager';
import { WithChildren } from '../types';
import { rafThrottle } from '../util/animation';
import { ScopeIdContext, ScrollStateContext } from './context';

// #36 DndContext.tsx가 최상위에서 감싸주는 Provider 컴포넌트.
// 보드가 새로 마운트될 때마다 새 ScrollStateManager 인스턴스를 만들어 그 보드 전용
// 스크롤 위치 저장소로 사용한다.
export function DndScrollState({ children }: WithChildren) {
  // useMemo(..., [])로 최초 마운트 시 단 한 번만 ScrollStateManager를 생성하고,
  // 이후 리렌더링에서는 동일 인스턴스를 계속 재사용한다.
  const manager = Preact.useMemo(() => {
    return new ScrollStateManager();
  }, []);

  return <ScrollStateContext.Provider value={manager}>{children}</ScrollStateContext.Provider>;
}

// 개별 스크롤 컨테이너가 자신의 스크롤 위치를 저장/복원하기 위해 사용하는 커스텀 훅.
// id(엔티티 고유 id)와 index(정렬 순서, 현재는 effect 의존성으로만 사용됨)를 받는다.
export function useStoredScrollState(id: string, index: number | undefined) {
  // 현재 스코프 id(#37 Scope.tsx가 공급)와, 스크롤 위치를 실제로 저장하는
  // ScrollStateManager(위 DndScrollState가 공급)를 Context에서 꺼내온다.
  const scopeId = Preact.useContext(ScopeIdContext);
  // 실제 스크롤 대상 DOM 엘리먼트를 가리킬 ref. 초기값은 null이며, 아래 setRef 콜백과
  // useEffect 모두 이 ref를 통해 같은 DOM 노드에 접근한다.
  const scrollRef = Preact.useRef<HTMLDivElement>(null);
  const scrollStateManager = Preact.useContext(ScrollStateContext);

  // JSX의 ref={setRef} 형태로 전달되는 "콜백 ref" 함수. 일반적인 useRef 객체 대신
  // 함수를 ref로 넘기면, 엘리먼트가 DOM에 붙거나 떨어질 때마다 Preact가 이 함수를
  // 호출해준다. 여기서는 엘리먼트가 실제로 마운트되는 시점(el이 존재할 때)에
  // requestAnimationFrame을 사용해 다음 프레임에서 저장된 스크롤 상태를 조회하고,
  // 값이 있다면(0이 아니라면) scrollLeft/scrollTop을 직접 설정해 이전 스크롤 위치를
  // 복원한다. rAF를 쓰는 이유는 레이아웃이 완전히 계산된 이후에 스크롤을 적용해야
  // 정확한 위치로 복원되기 때문이다.
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

  // 스크롤 이벤트를 구독해서, 스크롤이 발생할 때마다 현재 위치를 ScrollStateManager에
  // 저장하는 effect. 의존성 배열에 scrollStateManager, id, index를 넣어두었으므로
  // 이 값들 중 하나라도 바뀌면 기존 리스너를 정리하고 새로 등록한다.
  Preact.useEffect(() => {
    const el = scrollRef.current;

    // 아직 DOM에 엘리먼트가 붙지 않았다면(예: 조건부 렌더링 등으로 el이 null인 경우)
    // 리스너를 등록하지 않고 종료한다.
    if (!el) return;

    // rafThrottle: requestAnimationFrame 주기로 호출 빈도를 제한하는 유틸리티.
    // 스크롤 이벤트는 매우 빈번하게 발생하므로, 매번 상태를 저장하면 성능 문제가
    // 생길 수 있어 프레임당 한 번으로 제한한다.
    const onScroll = rafThrottle(el.win, (e: Event) => {
      const target = e.target as HTMLElement;

      scrollStateManager.setScrollState(scopeId, id, {
        x: target.scrollLeft,
        y: target.scrollTop,
      });
    });

    el.addEventListener('scroll', onScroll);

    // cleanup 함수: effect가 재실행되기 직전이나 컴포넌트가 언마운트될 때 실행되어
    // 이전에 등록한 scroll 리스너를 반드시 제거한다. 이를 생략하면 컴포넌트가
    // 사라진 뒤에도 리스너가 남아 메모리 누수나 예기치 않은 동작을 유발할 수 있다.
    return () => {
      el.removeEventListener('scroll', onScroll);
    };
  }, [scrollStateManager, id, index]);

  return { setRef, scrollRef };
}
