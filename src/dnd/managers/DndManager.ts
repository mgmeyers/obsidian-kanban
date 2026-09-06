/**
 * ============================================================================
 * [실행 순서 #24] DndManager.ts — 창(Window) 단위 DnD 컨텍스트
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * Obsidian은 노트를 메인 창 외에 별도의 "팝아웃(pop-out)" 창으로도 띄울 수 있기 때문에, 드래그앤드롭
 * 엔진은 창(Window)마다 하나씩 독립된 컨텍스트를 가져야 합니다. DndManager가 바로 그 컨텍스트로,
 * 이 창 안에서 드래그의 대상이 될 수 있는 요소들(hitbox entity)과 자동 스크롤을 유발하는 스크롤
 * 가장자리 영역(scroll entity)을 Map 자료구조에 등록/해제해 주는 "등록소" 역할을 합니다.
 * 또한 ResizeObserver를 이용해 레이아웃이 바뀔 때(창 크기 변경, 카드 추가/삭제 등) 등록된 모든
 * 엔티티들의 좌표(hitbox)를 다시 계산하도록 지시합니다. 실제 드래그 동작(포인터 추적, 이동, 드롭
 * 판정)은 이 클래스가 생성해서 들고 있는 DragManager(#29)가 전담하며, DndManager는 그 DragManager가
 * 참조할 hitboxEntities/scrollEntities Map을 공유해주는 상위 컨테이너라고 볼 수 있습니다.
 * ============================================================================
 */

// EventEmitter: Node.js의 EventEmitter API를 브라우저 환경에서도 쓸 수 있게 재구현한 라이브러리.
// on/off로 리스너를 등록/해제하고 emit으로 이벤트를 발생시키는, 발행-구독(pub/sub) 패턴의 핵심 도구.
import EventEmitter from 'eventemitter3';
// debounce: Obsidian이 제공하는 유틸리티 함수. 짧은 시간 동안 연속 호출되는 함수를 하나로 묶어
// 마지막(또는 첫) 호출만 실제로 실행되게 만들어, 과도한 재계산으로 인한 성능 저하를 막아준다.
import { debounce } from 'obsidian';

import { Entity } from '../types';
import { getParentWindow } from '../util/getWindow';
// DragManager(#29): 실제 드래그 포인터 이벤트 추적/이동/드롭을 처리하는 클래스. DndManager가 이를
// 생성해서 소유(has-a)하며, hitbox/scroll 엔티티 Map을 그대로 넘겨주어 서로 같은 데이터를 공유한다.
import { DragManager } from './DragManager';

// 드래그 중이던 엔티티가 다른 엔티티 위에 드롭되었을 때 호출되는 콜백의 타입.
// dragEntity: 드래그된(집어든) 대상, dropEntity: 그 위에 놓인(떨어뜨려진) 대상.
export type DropHandler = (dragEntity: Entity, dropEntity: Entity) => void;

export class DndManager {
  // 이 매니저가 담당하는 브라우저 Window 객체. 메인 창일 수도, Obsidian의 팝아웃 창일 수도 있다.
  win: Window;
  // 이 창 스코프 안에서 일어나는 DnD 관련 이벤트(예: 'scrollResize')를 뿌리기 위한 이벤트 버스.
  emitter: EventEmitter;
  // 드래그 대상/드롭 대상이 될 수 있는 모든 요소를 담는 사전(dictionary).
  // Map<string, Entity>는 "entityId 문자열 → Entity 객체" 형태의 키-값 저장소로,
  // 일반 객체({})보다 삽입 순서 보장, 크기 조회(size), 순회(forEach) 등이 명확하다는 장점이 있다.
  hitboxEntities: Map<string, Entity>;
  // 드래그 중 포인터가 가장자리에 닿으면 자동 스크롤을 일으키는 "스크롤 트리거 영역"들의 등록소.
  scrollEntities: Map<string, Entity>;
  // 브라우저 내장 API. 관찰 대상 DOM 요소의 크기(레이아웃)가 변할 때마다 콜백을 호출해준다.
  // MutationObserver가 DOM 구조 변화를 감시한다면, ResizeObserver는 "크기" 변화만 전담해서 감시한다.
  resizeObserver: ResizeObserver;
  // 실제 포인터 드래그 로직을 담당하는 하위 매니저(#29). 생성자에서 함께 만들어진다.
  dragManager: DragManager;
  // 드롭이 성공적으로 이뤄졌을 때 바깥(호출자)에서 주입한 콜백을 저장해둔다.
  onDrop: DropHandler;

  constructor(win: Window, onDrop: DropHandler) {
    this.win = win;
    // new EventEmitter(): 아직 아무 리스너도 없는 빈 이벤트 버스를 생성한다.
    this.emitter = new EventEmitter();
    // new Map(): 비어 있는 Map을 생성한다. 이후 register/unregister 메서드로 채워지고 비워진다.
    this.hitboxEntities = new Map();
    this.scrollEntities = new Map();
    this.onDrop = onDrop;

    // ResizeObserver 생성자에 넘기는 콜백은 리사이즈가 감지될 때마다 즉시 실행되는데,
    // 리사이즈 이벤트는 매우 빈번하게(연속으로) 발생할 수 있으므로 debounce로 감싸서
    // "100ms 동안 추가 호출이 없을 때(또는 첫 호출 직후, 세 번째 인자 true=leading 옵션)만"
    // 실제 handleResize 로직이 실행되도록 최적화한다.
    this.resizeObserver = new ResizeObserver(debounce(this.handleResize, 100, true));
    // DragManager(#29)를 생성하며 이 창(win), 이벤트 버스(emitter), 그리고 위에서 만든 두 Map을
    // 그대로 전달한다. 즉 DndManager와 DragManager는 같은 Map 인스턴스를 참조(공유)하게 되어,
    // 한쪽에서 등록한 엔티티를 다른 쪽에서도 곧바로 조회할 수 있다.
    this.dragManager = new DragManager(win, this.emitter, this.hitboxEntities, this.scrollEntities);
  }

  // 이 매니저가 더 이상 필요 없을 때(컴포넌트 언마운트 등) 호출되는 정리(clean-up) 메서드.
  // ResizeObserver.disconnect()는 지금까지 observe()로 등록한 모든 요소에 대한 감시를 한 번에 끊는다.
  destroy() {
    this.resizeObserver.disconnect();
  }

  // scrollResizeDebounce: setTimeout이 반환하는 타이머 ID를 저장해두는 필드.
  // 클래스 필드 초기값 문법(= 0)으로 선언과 동시에 기본값을 지정했다.
  scrollResizeDebounce = 0;
  // handleResize: ResizeObserverCallback 타입의 화살표 함수 필드.
  // 화살표 함수로 선언했기 때문에 this가 항상 DndManager 인스턴스에 고정되며(클래스 메서드처럼
  // 호출부에 따라 this가 바뀌는 문제가 없다), ResizeObserver 콜백으로 그대로 넘겨도 안전하다.
  handleResize: ResizeObserverCallback = (entries) => {
    // 이번 콜백 호출에서 "이 창(this.win)"에 속한 요소가 실제로 리사이즈됐는지 추적하는 플래그.
    let thisDidResize = false;
    // entries: 이번에 크기가 변한 모든 관찰 대상 요소들의 목록(ResizeObserverEntry[]).
    // 여러 창(팝아웃 포함)이 동시에 열려 있어도 ResizeObserver 콜백은 하나로 합쳐서 올 수 있으므로,
    // 각 엔트리마다 "이 요소가 어느 창 소속인지"를 확인해 걸러내야 한다.
    entries.forEach((e) => {
      // getParentWindow: 이 DOM 요소가 실제로 속한 Window(메인 창 또는 팝아웃 창)를 찾아준다.
      const win = getParentWindow(e.target);

      // 지금 리사이즈된 요소가 이 DndManager가 담당하는 창의 것이 아니면 무시하고 다음 엔트리로.
      if (this.win !== win) return;

      thisDidResize = true;

      // dataset.scrollid: 이 요소가 스크롤 컨테이너(ScrollManager가 관리하는 스크롤 영역)임을
      // 나타내는 표식(data-scrollid 속성)이 붙어 있는지 확인한다.
      if ((e.target as HTMLElement).dataset.scrollid) {
        // 스크롤 컨테이너의 크기가 바뀌면 스크롤 가능 범위(maxX/maxY)도 바뀔 수 있으므로,
        // 'scrollResize' 이벤트를 알려야 한다. 다만 리사이즈가 연속으로 여러 번 감지될 수 있어
        // 이전에 예약해둔 타이머가 있다면 clearTimeout으로 취소하고 새로 50ms 뒤로 다시 예약한다
        // (직접 구현한 간이 디바운스 패턴).
        this.win.clearTimeout(this.scrollResizeDebounce);

        this.scrollResizeDebounce = this.win.setTimeout(() => {
          // listenerCount: 'scrollResize' 이벤트에 실제로 귀 기울이고 있는 리스너가 있는지 확인.
          // 리스너가 없다면 이벤트를 emit해봤자 아무 효과가 없으므로 불필요한 emit을 생략한다.
          if (this.emitter.listenerCount('scrollResize')) {
            this.emitter.emit('scrollResize', null);
          }
        }, 50);
      }
    });

    // 이 창에 속한 요소가 하나도 리사이즈되지 않았다면(다른 창에서 발생한 리사이즈였다면)
    // 아래의 좌표 재계산은 의미가 없으므로 여기서 종료한다.
    if (!thisDidResize) return;

    // 등록된 모든 hitbox 엔티티에게 "네 위치를 다시 측정해라"라고 지시한다.
    // Map.forEach((value, key) => ...) 형태로 순회하며, 여기서는 값(entity)만 사용한다.
    this.hitboxEntities.forEach((entity) => {
      entity.recalcInitial();
    });

    // 스크롤 트리거 엔티티들도 마찬가지로 좌표를 다시 계산하게 한다.
    this.scrollEntities.forEach((entity) => {
      entity.recalcInitial();
    });
  };

  // 특정 DOM 요소의 크기 변화를 ResizeObserver가 감시하도록 등록한다.
  observeResize(element: HTMLElement) {
    // instanceOf: Obsidian이 각 창의 프로토타입 체인 문제(팝아웃 창은 별도의 HTMLElement
    // 생성자를 가질 수 있음)를 피하기 위해 제공하는 커스텀 instanceof 헬퍼.
    // 진짜 HTMLElement가 아니면(예: 이미 제거된 노드 등) 아무 것도 하지 않고 반환한다.
    if (!element.instanceOf(HTMLElement)) return;
    // observe(element, { box: 'border-box' }): border(테두리)까지 포함한 박스 모델 기준으로
    // 크기 변화를 감시하겠다는 옵션. content-box(기본값)와 달리 padding/border 변화도 감지한다.
    this.resizeObserver.observe(element, { box: 'border-box' });
  }

  // 더 이상 감시할 필요가 없어진 요소를 ResizeObserver 감시 목록에서 제거한다.
  unobserveResize(element: HTMLElement) {
    if (!element.instanceOf(HTMLElement)) return;
    this.resizeObserver.unobserve(element);
  }

  // 드래그/드롭 대상이 될 수 있는 엔티티 하나를 hitboxEntities Map에 등록한다.
  registerHitboxEntity(id: string, entity: Entity, win: Window) {
    // 이 엔티티가 속한 창이 이 DndManager가 담당하는 창과 다르면 등록을 무시한다.
    // (창마다 별도의 DndManager 인스턴스가 있으므로, 엉뚱한 창의 엔티티가 섞이지 않게 막는 안전장치)
    if (win !== this.win) return;
    // Map.set(key, value): 이미 같은 id가 있으면 값을 덮어쓰고, 없으면 새로 추가한다.
    this.hitboxEntities.set(id, entity);
  }

  // 자동 스크롤을 유발하는 스크롤 트리거 엔티티를 scrollEntities Map에 등록한다.
  registerScrollEntity(id: string, entity: Entity, win: Window) {
    if (win !== this.win) return;
    this.scrollEntities.set(id, entity);
  }

  // hitbox 엔티티 등록을 해제한다(예: 요소가 화면에서 사라지거나 언마운트될 때).
  unregisterHitboxEntity(id: string, win: Window) {
    if (win !== this.win) return;
    // Map.delete(key): 해당 키가 있으면 제거하고, 없으면 아무 일도 일어나지 않는다.
    this.hitboxEntities.delete(id);
  }

  // 스크롤 트리거 엔티티 등록을 해제한다.
  unregisterScrollEntity(id: string, win: Window) {
    if (win !== this.win) return;
    this.scrollEntities.delete(id);
  }
}
