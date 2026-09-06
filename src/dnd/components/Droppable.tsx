/**
 * ============================================================================
 * [실행 순서 #43] Droppable.tsx — 드롭 가능 영역을 감싸는 컴포넌트
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * dnd/managers/EntityManager.ts 인스턴스를 생성해 EntityManagerContext로 공급하는
 * 컴포넌트로, 카드/레인처럼 "드래그되거나 드롭을 받을 수 있는" 모든 요소의 최하단
 * 공통 로직을 담당합니다. EntityManager는 이 요소의 hitbox(위치/크기) 계산, 부모
 * EntityManager와의 트리 구조(경로) 관리, SortManager/ScrollManager와의 연동을
 * 전담합니다. 성능을 위해 Preact의 memo()로 감싸 props가 바뀌지 않으면 리렌더링을
 * 건너뛰도록 했고, 정렬 기능이 필요 없는 경우를 위한 StaticDroppable 패스스루도
 * 함께 정의되어 있습니다. 트리 안에서의 위치(path)를 계산하는 useNestedEntityPath
 * 훅도 이 파일에 있습니다.
 * ============================================================================
 */
import { RefObject, memo, useContext, useMemo, useRef } from 'preact/compat';
import { useOnMount } from 'src/components/helpers';

import { EntityManager } from '../managers/EntityManager';
import { EntityData, WithChildren } from '../types';
import {
  DndManagerContext,
  EntityManagerContext,
  ExplicitPathContext,
  ScopeIdContext,
  ScrollManagerContext,
  SortManagerContext,
} from './context';

export interface DraggableProps extends WithChildren {
  id: string;
  index: number;
  elementRef: RefObject<HTMLElement | null>;
  measureRef: RefObject<HTMLElement | null>;
  data: EntityData;
}

// 드롭 판정 로직이 필요 없는 상황을 위한 패스스루 컴포넌트.
// EntityManager를 생성하지 않고 children만 그대로 렌더링한다.
export function StaticDroppable(props: DraggableProps) {
  return <>{props.children}</>;
}

// memo()로 감싸 props(id, index, elementRef, measureRef, children, data)가 얕은 비교
// 상으로 바뀌지 않으면 리렌더링을 건너뛴다. 카드/레인 목록은 항목 수가 많을 수 있어
// 이런 최적화가 렌더링 성능에 중요하다.
export const Droppable = memo(function Droppable({
  id,
  index,
  elementRef,
  measureRef,
  children,
  data,
}: DraggableProps) {
  // 이 엔티티가 속한 여러 매니저/컨텍스트를 한꺼번에 읽어온다.
  // - dndManager: 전역 DnD 매니저
  // - sortManager: 이 엔티티가 속한 정렬 가능 리스트의 매니저(없을 수도 있음)
  // - scopeId: 현재 보드 스코프 id
  // - parentEntityManager: 바로 위 계층의 EntityManager(트리 구조 구성을 위함)
  // - parentScrollManager: 이 엔티티가 속한 스크롤 컨테이너의 매니저
  const dndManager = useContext(DndManagerContext);
  const sortManager = useContext(SortManagerContext);
  const scopeId = useContext(ScopeIdContext);
  const parentEntityManager = useContext(EntityManagerContext);
  const parentScrollManager = useContext(ScrollManagerContext);
  // data(카드/레인의 실제 내용을 담은 객체)를 ref에 담아 "항상 최신 값"을 참조하도록
  // 한다. 아래 useMemo의 의존성 배열에는 data를 포함하지 않았기 때문에(주석 참고),
  // data가 바뀔 때마다 EntityManager를 새로 만들지 않고, 대신 EntityManager
  // 생성자에 dataRef(참조)를 넘겨 매번 최신 data를 읽어가도록 한다.
  const dataRef = useRef(data);
  // useMemo 밖에서도(useOnMount의 cleanup 등에서) 최근 생성된 EntityManager를
  // 참조하기 위한 ref.
  const managerRef = useRef<EntityManager>();

  dataRef.current = data;

  // id, index, dndManager, scopeId, parentEntityManager, parentScrollManager,
  // sortManager 중 하나라도 바뀌면 새 EntityManager를 생성한다. 이전 매니저가
  // 있었다면 먼저 destroy()로 정리한다.
  const entityManager = useMemo(() => {
    if (dndManager) {
      if (managerRef.current) {
        managerRef.current.destroy();
      }

      const manager = new EntityManager(
        dndManager,
        scopeId,
        id,
        index,
        parentEntityManager,
        parentScrollManager,
        sortManager,
        dataRef
      );

      // 이미 DOM 노드가 준비되어 있다면(예: 리렌더링으로 인해 매니저가 재생성되는
      // 경우) 곧바로 initNodes를 호출해 hitbox 등록을 이어간다. 최초 마운트 시에는
      // 아직 ref가 비어 있을 수 있으므로, 그 경우는 아래 useOnMount가 담당한다.
      if (elementRef.current && measureRef.current) {
        manager.initNodes(elementRef.current, measureRef.current);
      }

      managerRef.current = manager;

      return manager;
    }

    return null;
  }, [
    id,
    index,

    //
    dndManager,
    scopeId,
    parentEntityManager,
    parentScrollManager,
    sortManager,
  ]);

  // useOnMount: elementRef와 measureRef 두 DOM 노드가 모두 실제로 삽입된 뒤에야
  // initNodes를 호출해 hitbox 측정을 시작하고, 언마운트 시 destroy()로 정리한다.
  // 위 useMemo 안에서도 initNodes를 호출하는 경로가 있지만, 그것은 "이미 마운트된
  // 상태에서 매니저가 재생성되는" 경우를 위한 것이고, 이 useOnMount는 "최초 마운트"
  // 시점을 안전하게 처리하기 위한 것이다(두 시점 모두 대응해야 하는 이유는 useMemo와
  // ref 콜백의 실행 순서가 항상 보장되지는 않기 때문).
  useOnMount(
    [elementRef, measureRef],
    () => {
      managerRef.current?.initNodes(elementRef.current, measureRef.current);
    },
    () => {
      managerRef.current?.destroy();
    }
  );

  // dndManager가 없어 entityManager를 만들지 못했다면 아무것도 렌더링하지 않는다.
  if (!entityManager) {
    return null;
  }

  // EntityManagerContext.Provider로 entityManager를 하위 트리에 공급한다.
  // 이렇게 하면 이 Droppable 내부에 중첩된 또 다른 Droppable이 parentEntityManager로
  // 이 매니저를 받아 엔티티 트리(부모-자식 경로)를 구성할 수 있다.
  return (
    <EntityManagerContext.Provider value={entityManager}>{children}</EntityManagerContext.Provider>
  );
});

// 현재 엔티티의 트리 상 경로(path, 예: [0, 2, 1]처럼 각 계층에서 몇 번째인지를
// 나타내는 배열)를 계산하는 훅.
export function useNestedEntityPath(selfIndex?: number) {
  const entityManager = useContext(EntityManagerContext);
  // ExplicitPathContext에 값이 지정되어 있다면(#35 참고) EntityManager가 계산한
  // 경로 대신 이 값을 명시적으로 우선 사용한다. 두 값 모두 없으면 빈 배열(최상위)로
  // 취급한다.
  const explicitPath = useContext(ExplicitPathContext);
  const currentPath = explicitPath ?? entityManager?.getPath() ?? [];

  // 이 엔티티 자신의 인덱스(selfIndex)가 주어졌다면, 부모까지의 경로 뒤에
  // 자기 자신의 위치를 이어 붙인다.
  if (selfIndex !== undefined) {
    currentPath.push(selfIndex);
  }

  // useMemo(..., currentPath): 배열 자체가 아니라 배열의 각 원소를 의존성으로
  // 사용해, 경로를 구성하는 숫자들이 실제로 바뀔 때만 새 배열 참조를 반환하도록 한다
  // (currentPath가 매 렌더마다 새로 계산되어도 내용이 같으면 동일 참조를 유지해
  // 하위 컴포넌트의 불필요한 리렌더링을 막기 위함).
  return useMemo(() => currentPath, currentPath);
}
