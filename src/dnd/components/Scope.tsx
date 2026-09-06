/**
 * ============================================================================
 * [실행 순서 #37] Scope.tsx — 보드 단위로 DnD 스코프(scope)를 구분하는 컴포넌트
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * 하나의 페이지 안에 여러 개의 칸반 보드가 동시에 열려 있을 수 있기 때문에, 각 보드의
 * 카드/레인 엔티티가 서로 뒤섞이지 않도록 고유한 scopeId를 발급하고 ScopeIdContext를
 * 통해 하위 트리에 공급하는 역할을 합니다. scopeId는 #43 Droppable.tsx의 EntityManager,
 * #40 Scrollable.tsx의 ScrollManager 등이 엔티티 id를 만들 때 접두어처럼 사용합니다.
 * 또한 언마운트 시 ScrollStateManager(스크롤 위치 저장소)에서 이 스코프와 관련된
 * 기록을 정리(unmountScope)하여 메모리 누수를 방지합니다.
 * ============================================================================
 */
import Preact from 'preact/compat';
import { generateInstanceId } from 'src/components/helpers';

import { WithChildren } from '../types';
import { ScopeIdContext, ScrollStateContext } from './context';

interface ScopeProps extends WithChildren {
  id?: string;
}

export function DndScope({ id, children }: ScopeProps) {
  // 상위(#39 ScrollStateContext.tsx가 공급한) ScrollStateManager를 useContext로 꺼내온다.
  // 이 매니저는 스코프별 스크롤 위치를 기억하고 있으며, 아래 useEffect의 cleanup에서
  // 이 스코프의 기록을 정리하는 데 사용된다.
  const scrollStateManager = Preact.useContext(ScrollStateContext);
  // id prop이 주어지지 않았다면 generateInstanceId()로 고유 id를 새로 생성한다.
  // useMemo를 사용해 id가 바뀌지 않는 한 동일한 scopeId를 재사용하도록 한다
  // (매 렌더마다 새 id가 생성되면 하위 컴포넌트들이 매번 다른 스코프로 인식하게 되어버린다).
  const scopeId = Preact.useMemo(() => id || generateInstanceId(), [id]);

  // 컴포넌트(즉, 이 보드)가 언마운트되거나 id가 변경될 때 실행되는 cleanup 로직.
  // ScrollStateManager.unmountScope(id)를 호출해, 더 이상 존재하지 않는 스코프에 대한
  // 스크롤 위치 기록을 제거한다. 의존성 배열이 [id]이므로 id가 바뀔 때마다
  // 이전 id 기준으로 정리가 한 번 실행된다.
  Preact.useEffect(() => {
    return () => {
      scrollStateManager.unmountScope(id);
    };
  }, [id]);

  // ScopeIdContext.Provider로 scopeId를 하위 트리에 공급한다. 이 컴포넌트 자체는
  // DOM을 렌더링하지 않고 children을 그대로 통과시키는 "투명한" Provider 역할만 한다.
  return <ScopeIdContext.Provider value={scopeId}>{children}</ScopeIdContext.Provider>;
}
