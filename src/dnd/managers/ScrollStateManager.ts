/**
 * ============================================================================
 * [실행 순서 #26] ScrollStateManager.ts — 스크롤 컨테이너의 스크롤 위치(x, y)를 기억했다가
 * 리마운트 시 복원해주는 상태 저장소
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * React/Preact는 리스트를 다시 그릴 때 DOM 노드를 새로 만들며(리마운트), 이 과정에서 브라우저가
 * 자체적으로 기억하고 있던 scrollTop/scrollLeft 값은 사라져 버린다. 칸반 보드에서 카드를 옮기거나
 * 필터링을 바꾸는 등으로 레인(Lane)이 리렌더링될 때마다 사용자가 보던 스크롤 위치가 맨 위로
 * 튕기면 사용 경험이 나빠지므로, 이 클래스는 스크롤 컨테이너의 id별로 마지막 스크롤 좌표(x, y)를
 * 별도의 Map에 기억해 두었다가, 같은 id의 컨테이너가 다시 마운트될 때 그 값을 그대로 복원할 수
 * 있게 해준다. 또한 어떤 id가 어떤 스코프(scope, 예: 보드 하나)에서 쓰였는지도 함께 추적해서,
 * 보드 자체가 통째로 닫힐 때(unmountScope) 더 이상 필요 없는 기록을 한꺼번에 정리해 메모리 누수를
 * 막는다.
 * ============================================================================
 */

import { CoordinateShift, initialScrollState } from '../types';

export class ScrollStateManager {
  // "스크롤 컨테이너 id" → "마지막으로 기록된 스크롤 좌표(x, y)"를 저장하는 사전.
  // Map<string, CoordinateShift> 형태로, id를 키로 삼아 언제든 O(1)에 조회할 수 있다.
  scrollStates: Map<string, CoordinateShift>;
  // "스크롤 컨테이너 id" → "그 id를 사용 중인 스코프(scopeId)들의 집합"을 저장하는 사전.
  // 값이 Set<string>인 이유: 이론상 같은 id가 여러 스코프에서 동시에 참조될 수도 있으므로,
  // 배열 대신 중복 없는 집합(Set)으로 관리해 추가/삭제를 간단히 처리한다.
  idScopes: Map<string, Set<string>>;

  constructor() {
    // 인스턴스가 생성될 때 두 Map을 모두 빈 상태로 초기화한다.
    this.scrollStates = new Map();
    this.idScopes = new Map();
  }

  // 스크롤 컨테이너(id)의 최신 스크롤 좌표(state)를 기록하고, 그 id가 어느 스코프(scopeId)에서
  // 쓰이고 있는지도 함께 등록한다. 스크롤 이벤트가 발생할 때마다(예: onScroll 핸들러) 호출된다.
  setScrollState(scopeId: string, id: string, state: CoordinateShift) {
    // Map.set(key, value): 이미 값이 있으면 덮어쓰고, 없으면 새로 추가한다.
    this.scrollStates.set(id, state);

    // 이 id가 이미 어떤 스코프에서든 한 번이라도 등록된 적이 있는지 확인한다.
    if (this.idScopes.has(id)) {
      const scopes = this.idScopes.get(id);

      // 아직 이 scopeId가 등록되어 있지 않다면 Set에 추가한다(Set.add는 중복 값은 무시하지만,
      // 여기서는 명시적으로 has()로 먼저 확인한 뒤 추가하는 방식을 쓰고 있다).
      if (!scopes.has(scopeId)) {
        scopes.add(scopeId);
      }
    } else {
      // 이 id가 처음 등록되는 경우, scopeId 하나만 담은 새 Set을 만들어 등록한다.
      // new Set([scopeId])는 배열 [scopeId]를 초기값으로 받아 Set을 생성하는 문법.
      this.idScopes.set(id, new Set([scopeId]));
    }
  }

  // 특정 id의 스크롤 컨테이너가 마지막으로 기록해둔 스크롤 좌표를 반환한다.
  // 컴포넌트가 다시 마운트될 때 이 값을 읽어와 scrollLeft/scrollTop에 그대로 대입해 복원한다.
  getScrollState(id: string): CoordinateShift {
    if (this.scrollStates.has(id)) {
      return this.scrollStates.get(id);
    }

    // 한 번도 기록된 적 없는 id라면, (0, 0)을 뜻하는 기본 상태를 대신 반환한다.
    return initialScrollState;
  }

  // 특정 스코프(예: 보드 하나) 전체가 언마운트될 때 호출되어, 그 스코프에서만 쓰이던 스크롤
  // 기록들을 정리(가비지 컬렉션)하는 메서드. 이렇게 하지 않으면 보드를 닫아도 스크롤 기록이
  // 계속 메모리에 남아 쌓이는 누수가 발생한다.
  unmountScope(scopeId: string) {
    // 실제로 완전히 삭제해야 할 id들을 모아두는 임시 배열.
    // forEach 도중에 바로 idScopes.delete(id)를 호출하면 순회 중인 Map을 함께 변경하게 되어
    // 위험할 수 있으므로, 먼저 "지울 목록"만 모아뒀다가 순회가 끝난 뒤 한꺼번에 삭제한다.
    const toRemove: string[] = [];

    // idScopes를 순회하며, 이 scopeId를 참조하고 있는 항목들에서 해당 scopeId를 제거한다.
    // Map.forEach((value, key) => ...) — 여기서는 (scopes, id) 순서로 값과 키를 받는다.
    this.idScopes.forEach((scopes, id) => {
      if (scopes.has(scopeId)) {
        // Set.delete(value): 이 스코프가 더 이상 이 id를 참조하지 않도록 제거한다.
        scopes.delete(scopeId);
        // 이 id를 참조하는 스코프가 하나도 남지 않았다면, 완전히 삭제 대상 목록에 추가한다.
        if (scopes.size === 0) {
          toRemove.push(id);
        }
      }
    });

    // 위에서 모아둔 "더 이상 아무 스코프도 쓰지 않는 id"들을 두 Map에서 모두 제거해 메모리를 회수한다.
    toRemove.forEach((id) => {
      this.idScopes.delete(id);
      this.scrollStates.delete(id);
    });
  }
}
