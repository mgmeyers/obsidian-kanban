/**
 * ============================================================================
 * [실행 순서 #27] ScrollManager.ts — 드래그 중 가장자리에 마우스가 가면 자동 스크롤을 일으키는 매니저
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 스크롤이 가능한 컨테이너(보드 전체 or 리스트 내부)마다 하나씩 생성되어, 그 컨테이너의
 * 상/하/좌/우 네 변에 얇은 "스크롤 트리거 영역(Entity)"을 만들고 DndManager에 히트박스로
 * 등록한다. #29 DragManager는 pointer 이동마다 이 트리거 영역들과 드래그 중인 카드의 히트박스가
 * 겹치는지 계산해서 'beginDragScroll' / 'updateDragScroll' / 'endDragScroll' 이벤트를 emit하고,
 * ScrollManager는 그 이벤트를 구독해 activeScroll 상태만 갱신한다. 실제 스크롤은
 * requestAnimationFrame 루프(handleDragScroll)에서 매 프레임 scrollBy()를 호출해 만들어낸다.
 * 즉 좌표/충돌 계산은 DragManager가, 그 결과로 발생하는 "스크롤"이라는 부수효과 실행은
 * ScrollManager가 맡는 역할 분담 구조다. IntersectionObserver로 중첩된 스크롤 컨테이너(보드
 * 안의 리스트처럼 부모-자식 관계인 스크롤 영역)가 화면에 보이는지도 함께 추적한다.
 * ============================================================================
 */

import { generateInstanceId } from 'src/components/helpers';

import {
  CoordinateShift,
  Entity,
  Path,
  ScrollState,
  Side,
  initialScrollShift,
  initialScrollState,
} from '../types';
import { getParentWindow } from '../util/getWindow';
import {
  adjustHitbox,
  calculateScrollHitbox,
  getElementScrollOffsets,
  numberOrZero,
} from '../util/hitbox';
import { DndManager } from './DndManager';
import { ScrollEventData } from './DragManager';

// IntersectionObserver 콜백에서 개별 대상(target)마다 실행할 핸들러의 타입.
// 여러 ScrollManager/여러 side가 하나의 IntersectionObserver를 공유하기 때문에,
// entity id -> handler 맵을 두고 라우팅하는 용도로 쓰인다.
export type IntersectionObserverHandler = (entry: IntersectionObserverEntry) => void;

// 스크롤 트리거 영역(top/right/bottom/left)의 getData().type에 쓰이는 문자열 상수.
// DragManager가 hitboxEntities를 순회할 때 "이건 스크롤 영역이구나"를 구분하는 데 쓰이지는 않고,
// 스크롤 엔티티는 별도의 scrollEntities 맵에 등록되므로 주로 디버깅/식별용 상수다.
export const scrollContainerEntityType = 'scroll-container';

// 자동 스크롤 속도(px/frame)의 기준값. handleDragScroll의 속도 계산식에서 사용된다.
const scrollStrengthModifier = 8;

// 각 스크롤 컨테이너가 가지는 4개의 변. 여러 곳에서 이 배열을 순회하며
// top/right/bottom/left 각각에 대한 처리를 반복한다.
const sides: Side[] = ['top', 'right', 'bottom', 'left'];

export class ScrollManager {
  // 이 인스턴스를 소유하는 전역 DndManager (히트박스/스크롤 엔티티 등록소이자 이벤트 버스 보유자)
  dndManager: DndManager;
  // 이 매니저(및 그 4개 변 엔티티)를 구분하는 고유 id. entityId 생성에 사용된다.
  instanceId: string;
  // 이 스크롤 컨테이너가 속한 DnD "스코프"(다른 보드/뷰와 섞이지 않도록 구분)
  scopeId: string;
  // 이 스크롤 트리거 영역이 반응할 드래그 엔티티의 타입 목록 (getData().accepts에 그대로 노출)
  triggerTypes: string[];
  // 현재 스크롤 위치/최대 스크롤 가능 범위를 캐시해 둔 상태 (매 스크롤마다 DOM을 읽지 않기 위함)
  scrollState: ScrollState;
  // 실제 스크롤이 걸리는 DOM 요소
  scrollEl: HTMLElement;
  // 중첩 관계에서의 부모 ScrollManager (예: 보드 전체 스크롤의 자식으로 리스트별 스크롤이 있는 구조)
  parent: ScrollManager | null;

  // 자식 스크롤 컨테이너가 뷰포트(root)에 보이는지 관찰하는 옵저버
  observer: IntersectionObserver;
  // entity id -> IntersectionObserver 콜백 매핑 (여러 대상을 하나의 observer로 관찰하기 위한 라우팅 테이블)
  observerHandlers: Map<string, IntersectionObserverHandler>;

  // 네 변 각각에 대응하는 히트박스 Entity (createScrollEntity로 생성)
  top: Entity;
  right: Entity;
  bottom: Entity;
  left: Entity;

  // (선언만 되어 있고 별도 로직에서 직접 사용되지는 않는 프레임 카운터 자리 - rAF id 저장 용도로 예약된 필드)
  scrollFrame: number = 0;
  // 현재 활성화되어 자동 스크롤 중인 side -> 스크롤 강도(strength, 값이 클수록 가장자리 깊이 들어온 것) 맵
  activeScroll: Map<Side, number>;

  constructor(
    dndManager: DndManager,
    scopeId: string,
    triggerTypes: string[],
    parent: ScrollManager | null
  ) {
    this.dndManager = dndManager;
    // 이 인스턴스 전용 고유 id 발급 (side별 entity id의 접두어로 사용됨)
    this.instanceId = generateInstanceId();
    this.scopeId = scopeId;
    this.triggerTypes = triggerTypes;
    // 아직 실제 DOM을 측정하기 전이므로 0으로 초기화된 기본 스크롤 상태를 사용
    this.scrollState = initialScrollState;
    this.parent = parent;
    // 처음에는 스크롤 중인 방향이 없음
    this.activeScroll = new Map();
    this.observerHandlers = new Map();
  }

  // scrollEl(실제 스크롤 DOM)이 마운트된 이후 호출되어 관찰/이벤트 구독 등 실질적인 초기화를 수행한다.
  initNodes(scrollEl: HTMLElement) {
    this.scrollEl = scrollEl;
    // DOM의 data-* 속성에 인스턴스 id를 심어 두면, 이후 이벤트 핸들러에서 e.currentTarget.dataset로
    // "이 DOM이 어떤 히트박스/스크롤 엔티티에 대응하는지"를 역으로 찾아낼 수 있다.
    this.scrollEl.dataset.hitboxid = this.instanceId;
    this.scrollEl.dataset.scrollid = this.instanceId;

    // 네 변 각각의 스크롤 트리거 히트박스 엔티티를 생성해 필드에 저장
    this.top = this.createScrollEntity('top');
    this.right = this.createScrollEntity('right');
    this.bottom = this.createScrollEntity('bottom');
    this.left = this.createScrollEntity('left');

    // DragManager가 emit하는 beginDragScroll/updateDragScroll/endDragScroll/dragEnd 구독 시작
    this.bindScrollHandlers();

    // scrollEl 내부에 있는 자식 스크롤 컨테이너(중첩된 ScrollManager들)가 뷰포트에
    // 보이는지(isIntersecting) 감지하기 위한 IntersectionObserver.
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // 어떤 DOM 요소가 교차했는지는 그 요소에 심어둔 dataset.hitboxid로 역추적한다.
          const targetId = (entry.target as HTMLElement).dataset?.hitboxid;

          if (targetId && this.observerHandlers.has(targetId)) {
            const handler = this.observerHandlers.get(targetId);
            handler && handler(entry);
          }
        });
      },
      {
        // scrollEl 자신을 관찰 기준(viewport) 삼아 "이 스크롤 영역 안에서 보이는지"를 판단
        root: scrollEl,
        // 10% 이상 겹쳐야 교차한 것으로 간주 (지터 방지)
        threshold: 0.1,
      }
    );

    // observer가 아직 없던 시점(위 코드 실행 전)에 등록 요청이 먼저 들어왔을 수 있으므로,
    // 그런 요청들을 임시로 쌓아두는 큐(observerQueue)를 여기서 한 번에 실제 관찰로 반영한다.
    const { observerQueue } = this;
    this.observerQueue = [];

    observerQueue.forEach(([id, element, handler]) => {
      this.observerHandlers.set(id, handler);
      this.observer.observe(element);
    });

    // 실제 스크롤(사용자의 휠 조작 등)이 발생하면 onScroll로 최신 스크롤 위치를 다시 읽어온다.
    // passive: true는 브라우저가 스크롤을 막지 않고 곧바로 처리할 수 있게 해 성능을 높인다.
    this.scrollEl.addEventListener('scroll', this.onScroll, {
      passive: true,
      capture: false,
    });

    // 리사이즈로 인해 최대 스크롤 범위가 바뀌었을 수 있으므로, 'scrollResize' 이벤트에도 onScroll을 연결
    this.dndManager.emitter.on('scrollResize', this.onScroll);

    // 다음 이벤트 루프 틱에 한 번 onScroll을 호출해, 레이아웃이 완전히 잡힌 뒤의 초기 스크롤
    // 상태(scrollState)를 정확히 측정한다. (마운트 직후에는 아직 크기가 확정되지 않았을 수 있음)
    this.scrollEl.win.setTimeout(() => this.onScroll());
    // ResizeObserver로 scrollEl의 크기 변화를 감시하도록 DndManager에 위임
    this.dndManager.observeResize(this.scrollEl);

    if (this.parent) {
      // 부모가 있는 중첩 스크롤 컨테이너라면, 부모의 IntersectionObserver에
      // "내가 화면에 보이는지"를 감시해 달라고 등록한다.
      this.parent.registerObserverHandler(this.instanceId, this.scrollEl, (entry) => {
        if (entry.isIntersecting) {
          // 보이기 시작하면 스크롤 트리거 엔티티들을 다시 등록(재활성화)
          this.handleEntityRegistration();
        } else {
          // 화면 밖으로 나가면 불필요한 충돌 계산을 막기 위해 등록 해제
          this.handleEntityUnregistration();
        }
      });
    } else {
      // 최상위(부모 없음) 컨테이너는 항상 보이는 것으로 간주하고 바로 등록
      this.handleEntityRegistration();
    }
  }

  // 컴포넌트 언마운트 시 호출되어 모든 구독/관찰/타이머를 정리하는 클린업 메서드
  destroy() {
    if (!this.scrollEl && !this.observer) return;

    this.observerQueue.length = 0;
    this.handleEntityUnregistration();
    this.observer.disconnect();
    this.unbindScrollHandlers();
    this.scrollEl.removeEventListener('scroll', this.onScroll);
    this.dndManager.emitter.off('scrollResize', this.onScroll);
    this.parent?.unregisterObserverHandler(this.instanceId, this.scrollEl);
    this.dndManager.unobserveResize(this.scrollEl);
  }

  // 네 변 중 "아직 그 방향으로 더 스크롤할 여지가 있는" 변만 DndManager의 scrollEntities에 등록하고,
  // 이미 한계(끝)에 도달한 변은 등록을 해제한다. 이렇게 하면 예를 들어 이미 맨 위까지 스크롤된
  // 상태에서는 top 트리거가 더 이상 충돌 계산 대상이 되지 않아 불필요한 연산을 줄일 수 있다.
  handleEntityRegistration() {
    sides.forEach((side) => {
      const win = getParentWindow(this.scrollEl);
      const id = this.getId(side);

      const hasId = this.dndManager.scrollEntities.has(id);
      const isDoneScrolling = this.isDoneScrolling(side);

      if (!isDoneScrolling && !hasId) {
        // 아직 스크롤 여지가 있는데 등록 안 돼 있으면 등록
        this.dndManager.registerScrollEntity(id, this[side], win);
      } else if (isDoneScrolling && hasId) {
        // 이미 한계에 도달했는데 등록돼 있으면 해제
        this.dndManager.unregisterScrollEntity(id, win);
      }
    });
  }

  // 네 변 모두를 DndManager의 scrollEntities에서 무조건 해제 (컨테이너가 화면 밖이거나 destroy될 때)
  handleEntityUnregistration() {
    sides.forEach((side) => {
      const win = getParentWindow(this.scrollEl);
      const id = this.getId(side);
      this.dndManager.unregisterScrollEntity(id, win);
    });
  }

  // observer가 아직 만들어지기 전에 registerObserverHandler가 호출된 경우를 대비한 대기열.
  // (초기화 순서 문제를 해결하기 위한 전형적인 "큐잉" 패턴)
  observerQueue: [string, HTMLElement, IntersectionObserverHandler][] = [];

  // 자식(또는 다른 대상) 요소를 이 매니저의 IntersectionObserver가 관찰하도록 등록한다.
  registerObserverHandler(id: string, element: HTMLElement, handler: IntersectionObserverHandler) {
    if (!this.observer) {
      // observer가 아직 없으면 나중에(initNodes에서) 처리하도록 큐에 쌓아둔다
      this.observerQueue.push([id, element, handler]);
    } else {
      this.observerHandlers.set(id, handler);
      this.observer.observe(element);
    }
  }

  // 등록했던 관찰을 해제한다. observer가 아직 없다면 큐에서 해당 항목만 걸러낸다.
  unregisterObserverHandler(id: string, element: HTMLElement) {
    if (!this.observer) {
      this.observerQueue = this.observerQueue.filter((q) => q[0] !== id);
    } else {
      this.observerHandlers.delete(id);
      this.observer.unobserve(element);
    }
  }

  // DragManager가 계산해서 emit하는 스크롤 관련 이벤트 3종 + dragEnd를 구독한다.
  // eventemitter3의 on(event, fn, context) 시그니처에서 세 번째 인자(id)는 "context"로 쓰이는데,
  // handleBeginDragScroll 등이 이미 화살표 함수(인스턴스에 바인딩됨)라 실제 this 바인딩에는
  // 영향이 없고, 대신 off() 시 "정확히 이 side로 등록했던 리스너"를 짚어 제거할 수 있게 해준다.
  // side마다 동일한 핸들러를 반복 등록하므로, 이벤트가 한 번 emit되면 side 개수(4번)만큼
  // 같은 핸들러가 호출되지만, 핸들러 내부는 실제 이벤트 데이터의 side 값으로만 동작하므로
  // 여러 번 호출돼도 결과는 멱등적(idempotent)이라 문제가 되지 않는다.
  bindScrollHandlers() {
    sides.forEach((side) => {
      const id = this.getId(side);
      this.dndManager.dragManager.emitter.on('beginDragScroll', this.handleBeginDragScroll, id);
      this.dndManager.dragManager.emitter.on('updateDragScroll', this.handleUpdateDragScroll, id);
      this.dndManager.dragManager.emitter.on('endDragScroll', this.handleEndDragScroll, id);
      this.dndManager.dragManager.emitter.on('dragEnd', this.onDragEnd);
    });
  }

  // bindScrollHandlers에서 등록한 리스너들을 동일한 순서/동일한 context로 제거한다.
  unbindScrollHandlers() {
    sides.forEach((side) => {
      const id = this.getId(side);
      this.dndManager.dragManager.emitter.off('beginDragScroll', this.handleBeginDragScroll, id);
      this.dndManager.dragManager.emitter.off('updateDragScroll', this.handleUpdateDragScroll, id);
      this.dndManager.dragManager.emitter.off('endDragScroll', this.handleEndDragScroll, id);
      this.dndManager.dragManager.emitter.off('dragEnd', this.onDragEnd);
    });
  }

  // 클래스 필드로 화살표 함수를 정의하면 별도의 .bind(this) 없이도 addEventListener/emitter.on에
  // 그대로 넘겨서 사용할 수 있다 (this가 항상 이 인스턴스를 가리킴).
  onScroll = () => {
    // activeScroll이 비어있다는 것은 "지금 우리가 자동 스크롤을 실행 중이 아니다"라는 뜻이다.
    // 이 조건이 없으면 handleDragScroll이 호출하는 scrollBy() 자체가 다시 'scroll' 이벤트를
    // 발생시켜 onScroll -> ... 무한 루프/중복 계산으로 이어질 수 있어 이를 방지한다.
    if (this.activeScroll.size === 0) {
      this.scrollState = getElementScrollOffsets(this.scrollEl);
      this.handleEntityRegistration();
    }
  };

  // 드래그가 끝나면 활성 스크롤 상태를 모두 지워 자동 스크롤 루프를 멈춘다.
  onDragEnd = () => {
    this.activeScroll.clear();
  };

  // 드래그 중인 카드가 어떤 변의 트리거 영역에 "처음" 들어왔을 때 DragManager가 emit하는 이벤트 핸들러.
  handleBeginDragScroll = ({ scrollEntitySide, scrollStrength }: ScrollEventData) => {
    // 이미 그 방향으로는 더 스크롤할 수 없다면(가장자리 끝) 무시
    if (this.isDoneScrolling(scrollEntitySide)) return;

    // 해당 side를 활성 스크롤 목록에 추가(강도 저장)하고, 아직 rAF 루프가 안 돌고 있다면 시작시킨다.
    this.activeScroll.set(scrollEntitySide, scrollStrength);
    this.handleDragScroll();
  };

  // 이미 트리거 영역 안에 있는 상태에서 포인터가 더 움직여 강도(깊이)만 바뀌었을 때 호출된다.
  handleUpdateDragScroll = ({ scrollEntitySide, scrollStrength }: ScrollEventData) => {
    if (this.isDoneScrolling(scrollEntitySide)) return;

    // 이미 실행 중인 rAF 루프가 다음 프레임에 이 최신 강도를 읽어가므로 별도 재시작은 필요 없다.
    this.activeScroll.set(scrollEntitySide, scrollStrength);
  };

  // 포인터가 트리거 영역을 벗어났을 때 해당 side의 자동 스크롤을 중지시킨다.
  handleEndDragScroll = ({ scrollEntitySide }: ScrollEventData) => {
    this.activeScroll.delete(scrollEntitySide);
  };

  // 주어진 side 방향으로 이미 스크롤 한계(끝)에 도달했는지 확인한다.
  isDoneScrolling(side: Side) {
    switch (side) {
      case 'top':
        // 세로 스크롤이 맨 위(0)에 있으면 더 위로 스크롤할 수 없음
        return this.scrollState.y === 0;
      case 'right':
        // 가로 스크롤이 오른쪽 끝(maxX)에 있으면 더 오른쪽으로 스크롤할 수 없음
        return this.scrollState.x === this.scrollState.maxX;
      case 'bottom':
        return this.scrollState.y === this.scrollState.maxY;
      case 'left':
        return this.scrollState.x === 0;
    }
  }

  // requestAnimationFrame을 이용해 "매 프레임마다 한 번씩" 실제 스크롤을 진행시키는 자기 재귀 루프.
  // activeScroll에 등록된 side가 있는 한 계속 다음 프레임을 예약하고, 비게 되면 자연스럽게 멈춘다.
  handleDragScroll() {
    if (this.activeScroll.size === 0) {
      // 활성 side가 없으면(모두 endDragScroll 되었거나 애초에 없었다면) 루프를 시작/계속하지 않고 종료
      return;
    }

    this.scrollEl.win.requestAnimationFrame(() => {
      // 이번 프레임에 가로/세로로 얼마나 스크롤할지 누적할 객체
      const scrollBy = {
        left: 0,
        top: 0,
      };

      this.activeScroll.forEach((strength, side) => {
        if (this.isDoneScrolling(side)) {
          // 프레임 도중 이미 한계에 도달했다면 더 이상 처리하지 않고 활성 목록에서 제거
          return this.activeScroll.delete(side);
        }

        // left/right는 가로축(left) 스크롤, top/bottom은 세로축(top) 스크롤에 대응
        const scrollKey = ['left', 'right'].includes(side) ? 'left' : 'top';
        // right/bottom 방향은 스크롤 값을 증가시켜야(양의 방향) 그 방향으로 이동한다
        const shouldIncreaseScroll = ['right', 'bottom'].includes(side);

        // 스크롤 속도 계산식: strength(0~35, 가장자리에 얼마나 깊이 들어왔는지)가 클수록
        // (scrollStrengthModifier * strength) / 35 값이 커져서, 최종 속도(scrollStrengthModifier에서
        // 이 값을 뺀 값)는 오히려 작아진다. 즉 "가장자리 얕게 들어갔을 때 더 빠르게, 깊이 들어갈수록
        // 느려지는" 방식이 아니라 이 구현에서는 strength가 클수록 속도가 줄어드는 형태로 계산된다.
        // Math.max(...,0)/Math.min(...,0)은 값이 음수(반대 방향)로 넘어가지 않도록 방향별로 clamp한다.
        scrollBy[scrollKey] = shouldIncreaseScroll
          ? Math.max(scrollStrengthModifier - (scrollStrengthModifier * strength) / 35, 0)
          : Math.min(-scrollStrengthModifier + (scrollStrengthModifier * strength) / 35, 0);
      });

      // 이번 프레임 몫만큼 실제로 DOM을 스크롤시킨다
      this.scrollEl.scrollBy(scrollBy);
      // 스크롤 후의 최신 위치를 다시 읽어 캐시 갱신
      this.scrollState = getElementScrollOffsets(this.scrollEl);
      // 새 위치 기준으로 어떤 변이 한계에 도달했는지 재판정해 등록 상태 갱신
      this.handleEntityRegistration();
      // 다음 프레임에도 계속 스크롤하도록 자기 자신을 다시 호출(재귀적 rAF 루프)
      this.handleDragScroll();
    });
  }

  // side별로 구분되는 entity id 문자열 생성 (인스턴스 id + side 조합)
  getId(side: Side) {
    return `${this.instanceId}-${side}`;
  }

  // 이 스크롤 컨테이너(또는 그 특정 side)의 트리 상 "경로(Path)"를 계산한다.
  // 중첩된 스크롤 컨테이너 구조에서 side별로 0(top)/1(right)/2(bottom)/3(left) 인덱스를 부여해
  // 부모의 경로 뒤에 이어붙인다. 이는 형제/부모-자식 관계 판정(getSiblingDirection 등)에 사용된다.
  getPath(side?: Side): Path {
    switch (side) {
      case 'right':
        return [...(this.parent?.getPath() || []), 1];
      case 'bottom':
        return [...(this.parent?.getPath() || []), 2];
      case 'left':
        return [...(this.parent?.getPath() || []), 3];
    }

    // top
    return [...(this.parent?.getPath() || []), 0];
  }

  // 부모 체인을 따라 스크롤 오프셋을 누적한 값을 계산한다. 중첩된 스크롤 컨테이너가 있을 때,
  // 화면상의 실제 좌표를 구하려면 "내 스크롤"뿐 아니라 "부모의 스크롤"까지 함께 보정해야 하므로,
  // 부모의 scrollState.x/y와 부모의 getScrollShift() 결과를 재귀적으로 더해 최종 보정값을 만든다.
  getScrollShift(): CoordinateShift {
    const parentShift = this.parent?.getScrollShift();

    return {
      x: numberOrZero(this.parent?.scrollState.x) + numberOrZero(parentShift?.x),
      y: numberOrZero(this.parent?.scrollState.y) + numberOrZero(parentShift?.y),
    };
  }

  // 지정한 side에 대응하는 스크롤 트리거 히트박스 Entity를 만들어 반환한다.
  // 화살표 함수/메서드 내부에서 manager(=this)를 클로저로 캡처해서, Entity 객체의 각 메서드가
  // 나중에 호출되더라도(예: DragManager가 한참 뒤에 getHitbox()를 호출) 항상 최신 this 상태를
  // 참조할 수 있게 한다.
  createScrollEntity(side: Side): Entity {
    const manager = this;

    return {
      scopeId: this.scopeId,
      entityId: manager.getId(side),
      // 최초 생성 시점의 히트박스(스크롤/이동 보정 전 raw 좌표)를 미리 계산해 둔다
      initial: calculateScrollHitbox(
        this.scrollEl.getBoundingClientRect(),
        this.parent?.scrollState || initialScrollState,
        this.parent?.getScrollShift() || initialScrollShift,
        side
      ),
      // 부모가 있으면 부모의 현재 스크롤 상태를, 없으면 기본값(0)을 반환
      getParentScrollState() {
        return manager.parent?.scrollState || initialScrollState;
      },
      // 부모가 있으면 부모의 누적 스크롤 보정값을, 없으면 기본값(0)을 반환
      getParentScrollShift() {
        return manager.parent?.getScrollShift() || initialScrollShift;
      },
      // 리사이즈 등으로 실제 DOM 위치/크기가 바뀌었을 때 initial 히트박스를 다시 계산한다
      // (DndManager.handleResize에서 모든 entity에 대해 호출됨)
      recalcInitial() {
        this.initial = calculateScrollHitbox(
          manager.scrollEl.getBoundingClientRect(),
          manager.parent?.scrollState || initialScrollState,
          manager.parent?.getScrollShift() || initialScrollShift,
          side
        );
      },
      // 실제 충돌 판정에 쓰이는 "현재" 히트박스. initial(고정 좌표)에 부모의 스크롤 상태/보정값을
      // 반영해 최종 좌표로 변환한다 (부모가 스크롤되면 자식 트리거 영역의 화면상 위치도 따라 움직이므로).
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
      getPath() {
        return manager.getPath(side);
      },
      // DragManager가 hitboxEntities/scrollEntities를 순회하며 참조하는 메타데이터.
      // accepts: 이 트리거 영역이 반응할 드래그 엔티티 타입 목록.
      getData() {
        return {
          id: manager.getId(side),
          type: scrollContainerEntityType,
          side: side,
          accepts: manager.triggerTypes || [],
          scrollContainer: manager.scrollEl,
          win: getParentWindow(manager.scrollEl),
        };
      },
    };
  }
}
