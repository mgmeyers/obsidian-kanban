/**
 * ============================================================================
 * [실행 순서 #36] DndContext.tsx — DndManager를 생성해 Context로 공급하는 최상위 컴포넌트
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * 보드(칸반 뷰) 하나당 단 한 번 마운트되어, DnD 엔진의 두뇌 역할을 하는 DndManager
 * (src/dnd/managers/DndManager.ts) 인스턴스를 생성하고, 이를 DndManagerContext를 통해
 * 하위의 모든 DnD 관련 컴포넌트(#37~#44 등)에 공급합니다. 또한 스크롤 위치를 기억하는
 * ScrollStateManager를 제공하는 #39 ScrollStateContext.tsx의 DndScrollState로 children을
 * 한 번 더 감싸서, 이 보드 하위 트리 전체가 스크롤 상태 Context에도 접근할 수 있게 합니다.
 * DndManager는 win(윈도우 객체)과 드롭 완료 콜백(onDrop)을 받아 생성되며, 컴포넌트가
 * 언마운트될 때 반드시 destroy()를 호출해 리소스(ResizeObserver 등)를 정리해야 합니다.
 * ============================================================================
 */
import { useEffect, useMemo, useRef } from 'preact/compat';

import { DndManager } from '../managers/DndManager';
import { Entity, WithChildren } from '../types';
import { DndScrollState } from './ScrollStateContext';
import { DndManagerContext } from './context';

interface DndContextProps extends WithChildren {
  win: Window;
  onDrop(dragEntity: Entity, dropEntity: Entity): void;
}

export function DndContext({ win, children, onDrop }: DndContextProps) {
  // onDrop 콜백을 ref에 담아 "항상 최신 함수"를 참조하도록 만든다.
  // 아래 useMemo가 최초 렌더링 시 단 한 번만 실행되기 때문에, 만약 onDrop을 그대로
  // 클로저에 캡처해버리면 이후 리렌더링 시 props.onDrop이 바뀌어도 DndManager 내부에서는
  // "오래된(stale)" onDrop만 호출되는 문제가 생긴다. ref를 매 렌더마다 갱신해두면
  // DndManager는 항상 onDropRef.current를 통해 최신 콜백을 호출할 수 있다.
  const onDropRef = useRef(onDrop);

  onDropRef.current = onDrop;

  // useMemo(..., [])는 컴포넌트가 최초로 마운트될 때 단 한 번만 DndManager를 생성하고,
  // 이후 리렌더링에서는 같은 인스턴스를 재사용하도록 보장한다(의존성 배열이 빈 배열이므로
  // 다시 계산되지 않음). DndManager 생성자에는 실제 onDrop 대신 onDropRef.current를
  // 호출하는 래퍼 함수를 넘겨, 위에서 설명한 stale closure 문제를 피한다.
  const dndManager = useMemo(() => {
    return new DndManager(win, (dragEntity: Entity, dropEntity: Entity) => {
      return onDropRef.current(dragEntity, dropEntity);
    });
  }, []);

  // 컴포넌트가 언마운트될 때(cleanup 함수 실행 시) dndManager.destroy()를 호출해
  // ResizeObserver 등 내부에서 등록한 리소스를 정리한다. 의존성 배열에 dndManager를
  // 넣어두었지만 dndManager는 useMemo로 고정된 값이라 사실상 마운트/언마운트 시에만 실행된다.
  useEffect(() => {
    return () => {
      dndManager.destroy();
    };
  }, [dndManager]);

  // DndManagerContext.Provider로 dndManager를 하위 트리에 공급하고, 그 안쪽을 다시
  // DndScrollState(#39)로 감싸 스크롤 상태 저장소(ScrollStateManager) Context도 함께 제공한다.
  return (
    <DndManagerContext.Provider value={dndManager}>
      <DndScrollState>{children}</DndScrollState>
    </DndManagerContext.Provider>
  );
}
