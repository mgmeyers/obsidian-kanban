/**
 * ============================================================================
 * [실행 순서 #35] context.ts — DnD 시스템 전역에서 공유되는 Preact Context 모음
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * 이 파일 자체는 아무 로직도 수행하지 않으며, dnd/managers 아래에 정의된 각종
 * 매니저 인스턴스를 Preact 컴포넌트 트리를 통해 하위로 "주입"하기 위한 Context
 * 객체만 모아 놓은 곳입니다. Context는 props를 한 단계씩 넘겨주지 않고도
 * (prop drilling 없이) 트리 아래 어느 컴포넌트에서든 Preact.useContext(...)로
 * 곧바로 값을 꺼내 쓸 수 있게 해주는 Preact/React의 표준 상태 전달 도구입니다.
 * DndManagerContext는 DndManager와, ScrollManagerContext는 ScrollManager와,
 * ScrollStateContext는 ScrollStateManager와, SortManagerContext는 SortManager와,
 * EntityManagerContext는 EntityManager와 각각 짝을 이룹니다. 이 Context들은
 * #36 DndContext.tsx, #37 Scope.tsx, #39 ScrollStateContext.tsx, #40 Scrollable.tsx,
 * #41 Sortable.tsx, #43 Droppable.tsx, #44 DragOverlay.tsx 등에서 Provider로
 * 값을 공급하거나 useContext로 값을 꺼내 쓰는 형태로 사용됩니다.
 * ============================================================================
 */
import Preact from 'preact/compat';

import { DndManager } from '../managers/DndManager';
import { EntityManager } from '../managers/EntityManager';
import { ScrollManager } from '../managers/ScrollManager';
import { ScrollStateManager } from '../managers/ScrollStateManager';
import { SortManager } from '../managers/SortManager';

// DndManager(보드 전체에 하나만 존재하는 최상위 드래그앤드롭 매니저) 인스턴스를 전달하는 Context.
// 기본값 null은 "아직 Provider가 없는 트리 바깥"을 의미하며, 실제 값은 #36 DndContext.tsx가 공급한다.
export const DndManagerContext = Preact.createContext<DndManager | null>(null);

// 현재 보드(스코프)를 식별하는 문자열 id를 전달하는 Context.
// 같은 페이지에 여러 개의 칸반 보드가 동시에 열려도 서로 다른 스코프 id로 엔티티가 섞이지 않도록
// #37 Scope.tsx가 값을 공급한다.
export const ScopeIdContext = Preact.createContext<string>('');

// 현재 스크롤 컨테이너를 감시/제어하는 ScrollManager 인스턴스를 전달하는 Context.
// 중첩된 스크롤 영역(예: 레인 안에 카드 목록)을 표현하기 위해 부모-자식 관계로 중첩될 수 있으며,
// #40 Scrollable.tsx가 값을 공급한다.
export const ScrollManagerContext = Preact.createContext<ScrollManager | null>(null);

// 스크롤 위치(x, y)를 영속적으로 기억해 두는 ScrollStateManager를 전달하는 Context.
// 기본값으로 new ScrollStateManager()를 즉시 생성해 넣어 두었기 때문에, Provider가 없는 상황에서도
// 항상 유효한 매니저 인스턴스를 얻을 수 있다(널 체크가 필요 없음). 실제로는 #39
// ScrollStateContext.tsx의 DndScrollState가 새 인스턴스로 값을 덮어써서 공급한다.
export const ScrollStateContext = Preact.createContext<ScrollStateManager>(
  new ScrollStateManager()
);

// 정렬 가능한 리스트를 제어하는 SortManager 인스턴스를 전달하는 Context.
// #41 Sortable.tsx가 값을 공급하며, 리스트가 정렬 불가능한 경우(StaticSortable)에는
// Provider 자체가 렌더링되지 않아 기본값 null이 그대로 전달된다.
export const SortManagerContext = Preact.createContext<SortManager | null>(null);

// 드래그/드롭 가능한 개별 엔티티(카드, 레인 등)를 관리하는 EntityManager 인스턴스를 전달하는 Context.
// 부모 EntityManager를 통해 엔티티들이 트리 구조(경로, path)를 이루게 되며, #43 Droppable.tsx가
// 값을 공급한다.
export const EntityManagerContext = Preact.createContext<EntityManager | null>(null);

// 엔티티의 경로(path)를 자동 계산 대신 명시적으로 강제 지정하고 싶을 때 사용하는 Context.
// 기본값은 null이며, 값이 주어지면 #43 Droppable.tsx의 useNestedEntityPath 훅이 EntityManager가
// 계산한 경로 대신 이 값을 우선적으로 사용한다.
export const ExplicitPathContext = Preact.createContext<number[]>(null);
