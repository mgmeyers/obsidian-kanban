/**
 * ============================================================================
 * [실행 순서 #41] Sortable.tsx — 정렬 가능한 리스트 컨테이너(레인/카드 목록에 사용)
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * dnd/managers/SortManager.ts 인스턴스를 생성해 SortManagerContext로 공급하는
 * 컴포넌트입니다. SortManager는 드래그 중인 항목이 리스트 내부의 다른 위치로 이동할 때
 * 나머지 항목들을 옆으로 밀어내는 애니메이션, 플레이스홀더 활성화, 드롭 시 최종 순서
 * 결정 등 "정렬" 관련 로직을 전담합니다. 리스트가 정렬 기능이 필요 없는 경우를 위한
 * StaticSortable(아무 것도 하지 않는 패스스루 컴포넌트)도 함께 정의되어 있으며,
 * 정렬 진행 여부(isSorting)를 구독하는 useIsSorting 훅도 이 파일에 있습니다.
 * ============================================================================
 */
import { useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { SortManager } from '../managers/SortManager';
import { Axis, WithChildren } from '../types';
import { DndManagerContext, SortManagerContext } from './context';

interface SortableProps extends WithChildren {
  axis: Axis;
  onSortChange?: (isSorting: boolean) => void;
}

// 정렬 기능이 필요 없는 리스트를 위한 "가짜" Sortable. SortManager를 생성하지 않고
// children을 그대로 렌더링만 하는 패스스루 컴포넌트로, Sortable과 동일한 위치에서
// 조건부로 바꿔 끼울 수 있도록 인터페이스를 맞춰 두었다.
export function StaticSortable(props: SortableProps) {
  return <>{props.children}</>;
}

export function Sortable({ axis, children, onSortChange }: SortableProps) {
  // 전역 DndManager를 Context에서 읽어온다. 이 값이 없으면(Provider 바깥) SortManager를
  // 만들 수 없다.
  const dndManager = useContext(DndManagerContext);
  // useMemo 바깥에서도(정리 시) 최근 생성된 SortManager를 참조하기 위한 ref.
  const managerRef = useRef<SortManager>();
  // dndManager, axis(정렬 축: 수평/수직), onSortChange 중 하나라도 바뀌면 새
  // SortManager를 생성한다. 이때 이전에 만들어둔 매니저가 있다면 destroy()로 먼저
  // 정리해 이벤트 리스너가 중복 등록되지 않게 한다.
  const sortManager = useMemo(() => {
    if (dndManager) {
      if (managerRef.current) {
        managerRef.current.destroy();
      }

      const manager = new SortManager(dndManager, axis, onSortChange);

      managerRef.current = manager;

      return manager;
    }

    return null;
  }, [dndManager, axis, onSortChange]);

  // 의존성 배열이 빈 배열([])이므로, 이 effect는 컴포넌트가 마운트/언마운트될 때만
  // 실행된다. 즉, 리렌더링 도중 sortManager가 여러 번 새로 만들어지더라도
  // (managerRef.current를 통해 이전 매니저는 위 useMemo 안에서 이미 destroy됨)
  // 이 cleanup은 컴포넌트가 최종적으로 사라질 때 "가장 마지막" 매니저를 한 번 더
  // 정리하는 안전장치 역할을 한다.
  useEffect(() => {
    return () => managerRef.current?.destroy();
  }, []);

  // dndManager가 없어 sortManager를 만들지 못했다면 아무것도 렌더링하지 않는다.
  if (!sortManager) {
    return null;
  }

  // SortManagerContext.Provider로 sortManager를 하위 트리(레인/카드 등)에 공급한다.
  return <SortManagerContext.Provider value={sortManager}>{children}</SortManagerContext.Provider>;
}

// 현재 리스트가 "정렬 진행 중"인지 여부를 구독하는 훅.
// SortManager는 EventEmitter 대신 자체적인 리스너 배열(sortListeners)을 통해
// isSorting 상태 변화를 알리는데, addSortNotifier/removeSortNotifier가 그 등록/해제
// 함수에 해당한다.
export function useIsSorting() {
  const sortManager = useContext(SortManagerContext);
  const [isSorting, setIsSorting] = useState(false);

  useEffect(() => {
    // setIsSorting 자체를 리스너 함수로 등록한다. SortManager가 setSortState()를
    // 호출할 때마다 이 컴포넌트의 isSorting 상태도 함께 갱신되어 리렌더링이 발생한다.
    sortManager.addSortNotifier(setIsSorting);
    // cleanup: 컴포넌트가 언마운트되거나 sortManager가 바뀌면 반드시 리스너를
    // 제거해야, 사라진 컴포넌트의 setState를 호출하는 것을 방지할 수 있다.
    return () => sortManager.removeSortNotifier(setIsSorting);
  }, [sortManager]);

  return isSorting;
}
