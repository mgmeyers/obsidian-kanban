/**
 * ============================================================================
 * [실행 순서 #18] context.ts — Preact Context 정의 모음
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * KanbanContext(view/stateManager/boardModifiers 등 보드 전역 의존성), SearchContext
 * (검색 결과 상태), SortContext(레인 정렬 기준), IntersectionObserverContext(가시성
 * 관찰 등록 함수) 등, 컴포넌트 트리 하위 전체에서 공유되어야 하는 값들을 Preact의
 * Context API로 정의하는 파일이다. 하위의 모든 Lane/Item 컴포넌트는 이 Context들을
 * useContext()로 구독함으로써, props를 여러 단계에 걸쳐 일일이 전달(prop drilling)하지
 * 않고도 필요한 값에 곧바로 접근할 수 있다.
 * ============================================================================
 */
import { createContext } from 'preact/compat'; // Preact가 제공하는 Context 생성 API (React의 createContext와 동일한 역할)
import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';
import { IntersectionObserverHandler } from 'src/dnd/managers/ScrollManager';

import { BoardModifiers } from '../helpers/boardModifiers';
import { Item, Lane, LaneSort } from './types';

// KanbanContext를 통해 하위로 전달되는 값들의 타입
export interface KanbanContextProps {
  filePath?: string; // 현재 보드가 저장된 마크다운 파일 경로 (선택적 필드)
  stateManager: StateManager; // 보드 데이터/설정을 읽고 쓰는 상태 관리자 인스턴스
  boardModifiers: BoardModifiers; // 레인/아이템 추가·삭제·이동 등 보드를 조작하는 함수 모음
  view: KanbanView; // 이 보드를 표시하는 Obsidian ItemView 인스턴스
}

// KanbanContext: 보드 전역에서 필요한 핵심 의존성(view/stateManager 등)을 하위 트리 전체에 전달하는 컨텍스트.
// createContext<T>(null) 문법 설명:
//   - 제네릭 타입 인자 <KanbanContextProps>로 이 컨텍스트가 담을 값의 타입을 지정한다.
//   - 인자로 넘긴 null은 "기본값(default value)"으로, <KanbanContext.Provider>로 감싸지지 않은 곳에서
//     useContext(KanbanContext)를 호출했을 때 반환되는 값이다.
//   - 실제로 유효한 값은 반드시 Kanban.tsx 등에서 <KanbanContext.Provider value={...}>로 감싼
//     하위 컴포넌트에서만 사용 가능하며, 타입 상으로는 null이 아니라고 선언되어 있으므로
//     Provider 없이 사용하는 실수를 코드 상에서 미리 방지하려는 의도가 담겨 있다.
export const KanbanContext = createContext<KanbanContextProps>(null);

// SearchContext를 통해 하위로 전달되는 값들의 타입
export interface SearchContextProps {
  query: string; // 현재 적용 중인 검색어 (소문자로 정규화된 문자열)
  items: Set<Item>; // 검색어에 매칭된 아이템들의 집합
  lanes: Set<Lane>; // 매칭된 아이템을 하나 이상 포함하는 레인들의 집합
  search: (query: string, immediate?: boolean) => void; // 검색어를 갱신하는 함수. immediate가 true면 디바운스 없이 즉시 반영
}

// SearchContext: 검색 매칭 결과(items/lanes)와 검색어 갱신 함수를 하위 Lane/Item에 전달.
// 타입이 `SearchContextProps | null`로 선언되어, "아직 Provider가 없어 값이 없을 수 있음"을
// 타입 시스템 상으로도 명시적으로 표현한다 (KanbanContext와 달리 null 가능성을 인정한 형태).
export const SearchContext = createContext<SearchContextProps | null>(null);

// SortContext: 현재 레인에 적용된 정렬 기준을 하위 Item에 전달한다.
// 값은 LaneSort enum(내장 정렬 기준) 또는 커스텀 정렬을 나타내는 문자열, 혹은 정렬 없음(null) 중 하나.
export const SortContext = createContext<LaneSort | string | null>(null);

// IntersectionObserverContext: 가상 스크롤/지연 렌더링 등을 위해 특정 엘리먼트의 화면 가시성
// 변화를 감지하는 IntersectionObserver 핸들러를 등록/해제하는 함수 쌍을 하위 트리에 전달한다.
// 인라인 객체 타입으로 정의되어 있으며(별도 interface로 분리되지 않음), 기본값은 null.
export const IntersectionObserverContext = createContext<{
  registerHandler: (el: HTMLElement, handler: IntersectionObserverHandler) => void; // 특정 엘리먼트에 가시성 변화 콜백을 등록
  unregisterHandler: (el: HTMLElement) => void; // 등록된 핸들러를 해제
} | null>(null);
