/**
 * ============================================================================
 * [실행 순서 #40] Scrollable.tsx — 스크롤 가능 엘리먼트를 ScrollManager와 연결하는 래퍼
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * dnd/managers/ScrollManager.ts 인스턴스를 생성해 ScrollManagerContext로 하위에 공급하는
 * 컴포넌트입니다. ScrollManager는 드래그 중 마우스/포인터가 스크롤 영역의 가장자리에
 * 다가가면 자동으로 스크롤을 발생시키는 로직(자동 스크롤)과, 부모-자식 스크롤 컨테이너의
 * 중첩 관계를 추적하는 역할을 담당합니다. 부모 DndManager, 현재 스코프 id, 그리고 상위
 * ScrollManager(중첩된 스크롤 컨테이너일 경우)를 Context에서 읽어와 새 ScrollManager를
 * 구성하며, useOnMount 훅으로 실제 DOM 노드가 삽입된 뒤 initNodes를 호출합니다.
 * ============================================================================
 */
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
  // 상위 Context들에서 필요한 값들을 꺼내온다.
  // - dndManager: 전역 DnD 매니저(#35의 DndManagerContext)
  // - scopeId: 현재 보드 스코프 id(#37 Scope.tsx가 공급)
  // - parentScrollManager: 이 스크롤 컨테이너보다 바깥쪽에 스크롤 컨테이너가 있다면
  //   그 ScrollManager. 중첩 스크롤(예: 보드 전체 스크롤 안에 레인별 스크롤)을 표현하기 위함.
  const dndManager = useContext(DndManagerContext);
  const scopeId = useContext(ScopeIdContext);
  const parentScrollManager = useContext(ScrollManagerContext);

  // 생성된 ScrollManager 인스턴스를 useMemo 밖에서도(예: cleanup 시점에) 참조할 수 있도록
  // ref에 보관해 둔다. useMemo의 반환값을 그대로 쓰지 않고 ref에 별도로 저장하는 이유는,
  // useOnMount의 cleanup 콜백이나 재생성 로직에서 "가장 최근에 만든" 매니저를
  // 안정적으로 참조하기 위해서다.
  const managerRef = useRef<ScrollManager>();

  // dndManager나 scopeId, triggerTypes, parentScrollManager 중 하나라도 바뀌면
  // 새로운 ScrollManager를 생성한다. 이때 기존에 만들어둔 매니저가 있다면 먼저
  // destroy()로 정리해 이벤트 리스너/옵저버가 중복 등록되지 않도록 한다.
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

    // dndManager가 아직 없다면(Provider 바깥에서 렌더링된 경우 등) ScrollManager를
    // 만들 수 없으므로 null을 반환한다.
    return null;
  }, [dndManager, scopeId, scrollRef, triggerTypes, parentScrollManager]);

  // useOnMount(src/components/helpers.ts): 전달한 ref들([scrollRef])이 가리키는
  // DOM 노드가 실제로 화면에 삽입된 뒤에야 첫 번째 콜백(initNodes 호출)을 실행하고,
  // 컴포넌트가 언마운트될 때 두 번째 콜백(destroy 호출)을 실행하는 헬퍼 훅이다.
  // 단순히 ref가 null이 아닌지만 확인하는 것이 아니라 실제 DOM 삽입 이벤트를 기다리기
  // 때문에, 스크롤 엘리먼트의 크기/위치를 정확히 측정해야 하는 initNodes 호출 시점을
  // 안전하게 보장할 수 있다.
  useOnMount(
    [scrollRef],
    () => managerRef.current?.initNodes(scrollRef.current),
    () => managerRef.current?.destroy()
  );

  // dndManager가 없어 scrollManager를 만들지 못했다면 아무것도 렌더링하지 않는다.
  if (!scrollManager) {
    return null;
  }

  // ScrollManagerContext.Provider로 새로 만든 scrollManager를 하위 트리에 공급한다.
  // 이렇게 하면 이 Scrollable 내부에 중첩된 또 다른 Scrollable은 parentScrollManager로
  // 이 매니저를 받아 스크롤 중첩 관계를 구성할 수 있다.
  return (
    <ScrollManagerContext.Provider value={scrollManager}>{children}</ScrollManagerContext.Provider>
  );
}
