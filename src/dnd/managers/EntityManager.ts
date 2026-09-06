/**
 * ============================================================================
 * [실행 순서 #25] EntityManager.ts — 개별 드래그 가능 요소(hitbox entity)의 등록/해제와 좌표 계산 담당
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 칸반 보드의 각 카드(Card), 레인(Lane) 같은 "드래그 가능한 낱개 요소"는 컴포넌트 하나마다
 * EntityManager 인스턴스 하나를 가진다. 이 클래스는 자신이 담당하는 DOM 노드의 화면상 위치(hitbox)를
 * 계산해 Entity 객체로 포장한 뒤, 상위 DndManager(#24)의 hitboxEntities Map에 등록/해제하는 역할을
 * 한다. 특히 스크롤 컨테이너 안에 있는 요소라면(스크롤에 의해 화면 밖으로 밀려날 수 있으므로)
 * IntersectionObserver를 활용해 "실제로 화면(스크롤 뷰포트)에 보이는 동안만" 좌표를 등록하고,
 * 화면 밖으로 나가면 등록을 해제해 불필요한 계산을 줄인다. 또한 부모-자식 관계(parent/children)를
 * 유지해 가시성(visibility) 상태를 트리 구조로 전파하고, 정렬 가능한 리스트라면 SortManager에도
 * 자신을 등록해 드래그 정렬 로직에 참여한다.
 * ============================================================================
 */

// EventEmitter: 이 엔티티만의 지역 이벤트 버스. 예를 들어 'visibility-change' 같은 이벤트를
// 발행해, 이 엔티티를 구독하는 다른 코드(리액트 훅 등)가 가시성 변화에 반응할 수 있게 한다.
import EventEmitter from 'eventemitter3';
// RefObject: Preact(React 호환) 훅에서 생성되는 { current: T } 형태의 가변 참조 컨테이너 타입.
// useRef()로 만든 값을 그대로 전달받아, 렌더링 시점과 무관하게 "최신 값"을 읽을 수 있게 해준다.
import { RefObject } from 'preact/compat';
import { generateInstanceId } from 'src/components/helpers';

import { Entity, EntityData, Path, initialScrollShift, initialScrollState } from '../types';
import { getParentWindow } from '../util/getWindow';
import { adjustHitbox, calculateHitbox, emptyDomRect } from '../util/hitbox';
import { DndManager } from './DndManager';
import { ScrollManager } from './ScrollManager';
import { SortManager } from './SortManager';

// 자식 엔티티 하나를 표현하는 내부 전용 타입.
// manager: 그 자식을 실제로 관리하는 EntityManager 인스턴스(재귀적으로 트리 구조를 이룬다).
// entity: 그 자식의 현재 위치 정보(Entity)를 캐시해 둔 것.
interface Child {
  manager: EntityManager;
  entity: Entity;
}

export class EntityManager {
  // 이 엔티티의 하위(자식) 엔티티들을 entityId로 찾을 수 있는 사전.
  // Map<string, Child> — 자식이 화면에 보이는 동안에만 여기 채워지고, 안 보이면 제거된다.
  children: Map<string, Child>;
  // 이 엔티티가 속한 창(Window) 단위의 DnD 컨텍스트(#24). hitbox 등록/해제 요청을 여기로 보낸다.
  dndManager: DndManager;
  // 실제로 드래그 시 이동/스타일링되는 DOM 노드(카드/레인 등 전체 요소).
  entityNode: HTMLElement;
  // 좌표(hitbox)를 측정할 때 기준으로 삼는 DOM 노드. entityNode와 다를 수 있다
  // (예: 드래그 중 시각적으로 변형되는 wrapper 대신, 안쪽의 크기가 안정적인 요소를 잰다).
  measureNode: HTMLElement;
  // 이 엔티티가 표현하는 실제 데이터(카드 내용, id, accepts 타입 등)를 즉시 읽어오는 함수.
  // 클로저로 RefObject를 감싸고 있어, 호출할 때마다 항상 "최신" 데이터를 반환한다.
  getEntityData: () => EntityData;
  // 부모 안에서 이 엔티티가 몇 번째(순서)인지를 나타내는 인덱스. 정렬/경로(Path) 계산에 쓰인다.
  index: number;
  // 트리 구조상 부모 엔티티. 최상위(예: 보드 전체)라면 null.
  parent: EntityManager | null;
  // 이 엔티티가 속한 스크롤 컨테이너를 관리하는 ScrollManager. 스크롤 컨테이너 밖(비-스크롤 영역)
  // 이라면 null이며, 이 경우 IntersectionObserver 없이 즉시 좌표를 등록한다.
  scrollParent: ScrollManager | null;
  // 이 엔티티가 정렬 가능한 리스트에 속해 있다면 그 정렬을 담당하는 SortManager, 아니면 null.
  sortManager: SortManager | null;
  // 현재 이 엔티티가 실제로 화면(뷰포트)에 보이는 상태인지 여부. 클래스 필드 초기값 문법으로
  // 기본값을 false로 지정했다.
  isVisible: boolean = false;
  // initNodes()가 호출되어 DOM 노드가 연결된 상태인지(마운트 여부)를 나타내는 플래그.
  mounted: boolean = false;

  // 이 엔티티의 논리적 id(예: 카드의 고유 id).
  id: string;
  // 같은 id를 가진 엔티티가 여러 인스턴스로 동시에 존재할 수 있는 경우(리마운트 등)를 구분하기 위한
  // 인스턴스 전용 고유 값. generateInstanceId()로 매 생성마다 새로 발급된다.
  instanceId: string;
  // entityId = `${scopeId}-${id}` 형태로 만들어지는, DndManager의 Map에서 키로 쓰이는 완전한 식별자.
  entityId: string;
  // 이 엔티티가 속한 스코프(보드 하나 단위 등)의 식별자.
  scopeId: string;
  // 이 엔티티 전용 이벤트 버스. 'visibility-change' 이벤트를 내보낼 때 사용한다.
  emitter: EventEmitter;

  constructor(
    dndManager: DndManager,
    scopeId: string,
    id: string,
    index: number,
    parent: EntityManager | null,
    scrollParent: ScrollManager | null,
    sortManager: SortManager | null,
    data: RefObject<EntityData>
  ) {
    this.id = id;
    // 이 생성자가 호출될 때마다 새로운 고유 인스턴스 id를 발급받는다.
    this.instanceId = generateInstanceId();
    this.scopeId = scopeId;
    // 문자열 템플릿으로 스코프+id를 합쳐 전역적으로 유일한 entityId를 만든다.
    this.entityId = `${scopeId}-${id}`;
    this.emitter = new EventEmitter();

    this.dndManager = dndManager;
    this.index = index;
    // 처음에는 자식이 없으므로 빈 Map으로 시작한다.
    this.children = new Map();
    this.parent = parent;
    this.scrollParent = scrollParent;
    // 화살표 함수를 필드에 대입해 클로저를 만든다: data(RefObject)를 감싸 두었다가,
    // 나중에 getEntityData()가 호출되는 "그 순간"의 data.current 값을 읽어 반환한다.
    // 이렇게 하면 리액트/Preact 리렌더링으로 data.current 내용이 바뀌어도 항상 최신값을 얻을 수 있다.
    this.getEntityData = () => data.current;
    this.sortManager = sortManager;
  }

  // 실제 DOM 노드가 마운트된 뒤 호출되어, 좌표 등록/관찰을 시작하는 메서드.
  initNodes(entityNode: HTMLElement, measureNode: HTMLElement) {
    this.mounted = true;
    this.entityNode = entityNode;
    this.measureNode = measureNode;

    // dataset.hitboxid: 이 DOM 요소에 data-hitboxid 속성을 심어, 나중에 IntersectionObserver
    // 콜백(ScrollManager 쪽)에서 "이 DOM 요소가 어떤 entityId에 대응하는지"를 역으로 찾을 수 있게 한다.
    measureNode.dataset.hitboxid = this.entityId;
    // 이 엔티티가 정렬 가능한 리스트의 일원이라면, SortManager에 자신을 등록해 드래그 정렬(순서 바꾸기)
    // 계산에 참여시킨다. emptyDomRect를 넘겨 아직 실제 좌표를 재지 않은 "빈" Entity를 우선 전달한다.
    this.sortManager?.registerSortable(
      this.entityId,
      this.getEntity(emptyDomRect),
      entityNode,
      measureNode
    );

    if (this.scrollParent) {
      // 스크롤 컨테이너 안에 있는 엔티티라면, 스크롤에 의해 화면 밖으로 밀려날 수 있다.
      // ScrollManager가 내부적으로 IntersectionObserver를 운용하고 있으므로, 여기서는 그
      // observer에 "이 요소가 뷰포트와 교차하는지 여부가 바뀔 때" 실행할 핸들러만 등록해 둔다.
      this.scrollParent.registerObserverHandler(this.entityId, measureNode, (entry) => {
        // entry.target(교차가 감지된 실제 DOM 요소)이 어느 창에 속하는지 알아둔다.
        const win = getParentWindow(entry.target);

        // entry.isIntersecting: 이 요소가 현재 스크롤 뷰포트와 겹쳐서(=화면에 보여서) 있는지.
        if (entry.isIntersecting) {
          // 지금 막 보이게 됐으므로, measureNode의 현재 바운딩 박스를 기준으로 Entity를 새로 만든다.
          const entity = this.getEntity(entry.boundingClientRect);
          // 부모의 children Map에 "나(entityId)는 이런 Entity다"라고 등록해 둔다.
          this.parent?.children.set(this.entityId, {
            entity,
            manager: this,
          });

          // 이제부터 이 요소의 크기 변화도 감시 대상에 포함시킨다.
          this.dndManager.observeResize(measureNode);

          // 부모가 없거나(최상위) 부모가 이미 보이는 상태라면, 나 자신과 내 자식들까지 함께
          // DndManager의 hitboxEntities Map에 실제로 등록해 드래그 대상/드롭 대상으로 활성화한다.
          if (!this.parent || this.parent.isVisible) {
            this.dndManager.registerHitboxEntity(this.entityId, entity, win);
            // Map.forEach((value, key) => ...): 자식들도 순회하며 함께 등록한다.
            this.children.forEach((child, childId) => {
              this.dndManager.registerHitboxEntity(childId, child.entity, win);
            });
            this.setVisibility(true);
          }
        } else {
          // 화면 밖으로 나갔으므로, 더 이상 드래그 대상/드롭 대상일 필요가 없다 → 등록 해제.
          this.dndManager.unregisterHitboxEntity(this.entityId, win);
          this.children.forEach((_, childId) => {
            this.dndManager.unregisterHitboxEntity(childId, win);
          });
          // 부모의 children 목록에서도 나를 제거한다.
          this.parent?.children.delete(this.entityId);
          // 더 이상 보이지 않으니 크기 변화를 감시할 필요도 없다.
          this.dndManager.unobserveResize(measureNode);
          this.setVisibility(false);
        }
      });
    } else {
      // 스크롤 컨테이너에 속하지 않은 엔티티(항상 화면에 존재한다고 가정)라면,
      // IntersectionObserver 없이 곧바로 현재 바운딩 박스를 측정해 등록한다.
      const entity = this.getEntity(measureNode.getBoundingClientRect());
      this.dndManager.observeResize(measureNode);
      this.dndManager.registerHitboxEntity(this.entityId, entity, getParentWindow(entityNode));
      this.parent?.children.set(this.entityId, {
        entity,
        manager: this,
      });
      this.setVisibility(true);
    }
  }

  // 가시성 상태를 갱신하고, 이 변화를 자식들에게도 재귀적으로 전파(cascade)하는 메서드.
  setVisibility(isVisible: boolean) {
    // 'visibility-change' 이벤트를 발행해, 이 엔티티를 구독 중인 리액트 훅 등에 알린다.
    this.emitter.emit('visibility-change', isVisible);
    this.isVisible = isVisible;
    // 부모의 가시성이 바뀌면 자식들도 같은 상태로 맞춰야 하므로, 트리를 따라 재귀 호출한다.
    this.children.forEach((child) => {
      child.manager.setVisibility(isVisible);
    });
  }

  // 이 엔티티가 언마운트될 때 호출되는 정리(clean-up) 메서드.
  destroy() {
    // 아직 마운트되지 않았다면(initNodes가 호출된 적 없다면) 정리할 것이 없으므로 즉시 반환.
    if (!this.mounted) return;
    this.mounted = true;
    this.dndManager.unobserveResize(this.measureNode);
    this.sortManager?.unregisterSortable(this.entityId);
    this.scrollParent?.unregisterObserverHandler(this.entityId, this.measureNode);
    if (this.entityNode) {
      this.dndManager.unregisterHitboxEntity(this.entityId, getParentWindow(this.entityNode));
    }
    this.parent?.children.delete(this.entityId);
  }

  // 루트부터 이 엔티티까지 내려오는 인덱스 경로를 배열로 반환한다.
  // 예: 보드(레인 index=1) 안의 카드(index=2)라면 [1, 2].
  getPath(): Path {
    // 스프레드 연산자(...)로 부모의 경로 배열을 펼친 뒤, 자신의 index를 맨 끝에 덧붙인다.
    // 부모가 없다면(최상위) parent?.getPath()가 undefined이므로 `|| []`로 빈 배열을 대신 사용한다.
    return [...(this.parent?.getPath() || []), this.index];
  }

  // 주어진 DOMRect를 바탕으로, DnD 엔진이 다루는 공통 인터페이스인 Entity 객체를 만들어 반환한다.
  // 이 메서드는 "Entity 팩토리"로, 반환되는 객체의 메서드들은 모두 클로저로 이 EntityManager
  // 인스턴스(변수명 manager)를 캡처해 최신 상태를 참조한다.
  getEntity(rect: DOMRectReadOnly): Entity {
    // this를 별도 변수(manager)에 담아두는 이유: 아래 객체 리터럴의 메서드들은 일반 함수(단축
    // 메서드 문법)로 정의되어 있어, 그 안에서의 this는 "이 Entity 객체 자신"을 가리키게 된다.
    // 따라서 EntityManager 인스턴스를 참조하려면 별도 변수(manager)로 클로저에 담아둬야 한다.
    const manager = this;
    return {
      scopeId: this.scopeId,
      entityId: this.entityId,
      // 처음 측정한 원본 좌표(hitbox). 스크롤 상태/이동값을 반영해 절대 좌표로 환산해 둔다.
      // calculateHitbox(rect, 스크롤위치, 스크롤보정값, 수동보정값)
      initial: calculateHitbox(
        rect,
        manager.scrollParent?.scrollState || initialScrollState,
        manager.scrollParent?.getScrollShift() || initialScrollShift,
        null
      ),
      // 부모 스크롤 컨테이너의 현재 스크롤 상태(x, y, maxX, maxY)를 반환. 없다면 기본값(0,0,0,0).
      getParentScrollState() {
        return manager.scrollParent?.scrollState || initialScrollState;
      },
      // 중첩된 스크롤 컨테이너들이 누적시킨 스크롤 보정값(shift)을 반환.
      getParentScrollShift() {
        return manager.scrollParent?.getScrollShift() || initialScrollShift;
      },
      // 레이아웃이 바뀌었을 때(리사이즈 등) measureNode의 실제 위치를 다시 재서 initial을 갱신한다.
      // this.initial = ... 형태로, 이 Entity 객체 자신의 initial 필드를 덮어쓴다.
      recalcInitial() {
        this.initial = calculateHitbox(
          manager.measureNode.getBoundingClientRect(),
          manager.scrollParent?.scrollState || initialScrollState,
          manager.scrollParent?.getScrollShift() || initialScrollShift,
          null
        );
      },
      // 마지막으로 측정한 initial 좌표에, "그 이후로 스크롤이 얼마나 더 움직였는지"를 반영해
      // 실시간에 가까운 현재 hitbox를 계산해 돌려준다(매번 getBoundingClientRect를 다시 재는
      // 비싼 연산 대신, 캐시된 initial + 스크롤 차이만 계산하는 최적화).
      getHitbox() {
        return adjustHitbox(
          this.initial[0],
          this.initial[1],
          this.initial[2],
          this.initial[3],
          this.getParentScrollState(),
          this.getParentScrollShift()
        );
      },
      // 이 엔티티까지의 인덱스 경로를 EntityManager.getPath()에 위임해 반환한다.
      getPath() {
        return manager.getPath();
      },
      // 이 엔티티가 표현하는 실제 데이터(카드 데이터 등)에 부가 정보(정렬 축, 소속 창)를 덧붙여 반환.
      getData() {
        return {
          // 스프레드 연산자로 getEntityData()가 반환한 원본 데이터의 모든 필드를 복사해 온 뒤,
          ...manager.getEntityData(),
          // 정렬 방향(가로/세로) 정보를 추가로 얹는다. sortManager가 없다면 undefined.
          sortAxis: manager.sortManager?.axis,
          // 이 엔티티가 실제로 속한 Window 객체(팝아웃 창 지원을 위해 항상 함께 전달).
          win: getParentWindow(manager.measureNode),
        };
      },
    };
  }
}
