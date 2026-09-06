/**
 * ============================================================================
 * [실행 순서 #28] SortManager.ts — 같은 리스트 안에서 드래그 중인 항목이 들어갈 위치(정렬)를 계산
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 리스트(세로) 또는 보드(가로)처럼 "형제 항목들을 순서대로 나열하는" 컨테이너 하나마다 생성되어,
 * 그 안에 등록된 모든 카드(sortable)와 자리표시자(placeholder)를 관리한다. #29 DragManager가
 * pointer 이동 중 계산해서 emit하는 dragStart/dragEnter/dragLeave/dragEnd 이벤트를 구독해서,
 * 드래그 중인 카드가 어느 형제의 앞/뒤에 위치하는지(getSiblingDirection)를 판정하고, 그 판정에
 * 따라 나머지 카드들을 CSS transform으로 밀어내며(shiftEl) placeholder(빈 자리) 크기를 드래그 중인
 * 카드 크기에 맞춰 늘린다. 이 클래스는 실제로 데이터 순서를 바꾸지는 않고, 드롭이 확정되는 순간
 * (handleDragEnd)에야 dndManager.onDrop을 호출해 상위(#24 DndManager)에게 실제 데이터 반영을
 * 위임한다. 그 사이의 모든 시각적 애니메이션(밀림/자리표시자 전환)은 SortManager 혼자 담당하며,
 * ScrollManager와는 서로 독립적으로 동작하되 둘 다 같은 DragManager가 계산한 좌표/교차 결과
 * (DragEventData)를 이벤트로 전달받아 사용한다는 점에서 협력한다.
 * ============================================================================
 */

import { generateInstanceId } from 'src/components/helpers';

import { Axis, Entity } from '../types';
import { getDropDuration, removeStyle, setStyle, transitions } from '../util/animation';
import { getHitboxDimensions } from '../util/hitbox';
import { SiblingDirection, getSiblingDirection } from '../util/path';
import { DndManager } from './DndManager';
import { DragEventData } from './DragManager';

// 하나의 정렬 대상(sortable)을 표현하는 튜플: [엔티티(위치/데이터 정보), 실제 변형(transform)이
// 적용되는 요소, 크기 측정에 쓰이는 요소]. el과 measureEl이 분리되어 있는 이유는 placeholder처럼
// "밀리는 애니메이션"과 "크기를 늘리는 애니메이션"을 서로 다른 요소에 적용해야 하는 경우가 있어서다.
type EntityAndElement = [Entity, HTMLElement, HTMLElement];

interface Dimensions {
  width: number;
  height: number;
}

// 드래그 중이 아닐 때 placeholder 크기 계산의 기본값으로 쓰이는 "크기 없음" 상수
const emptyDimensions: Dimensions = {
  width: 0,
  height: 0,
};

// dragLeave 이후 실제로 상태를 리셋하기까지 기다리는 디바운스 시간(ms).
// 마우스가 아주 짧게 다른 영역을 스쳐 지나가는 경우까지 매번 리셋하면 애니메이션이 깜빡이므로,
// 이 시간 동안 새로운 dragEnter가 없을 때만 진짜로 리셋한다.
export const dragLeaveDebounceLength = 100;

export class SortManager {
  dndManager: DndManager;
  // 이 컨테이너에 등록된 모든 정렬 대상: entityId -> [Entity, el, measureEl]
  sortables: Map<string, EntityAndElement>;
  // 현재 "밀려난(shift)" 상태로 표시되고 있는 entityId 집합
  shifted: Set<string>;
  // 현재 "숨겨진(hidden)" 상태로 표시되고 있는 entityId 집합 (보통 드래그 중인 원본 카드 자신)
  hidden: Set<string>;
  // 이 컨테이너 내에서 현재 정렬 상호작용(드래그로 인한 밀림 등)이 진행 중인지 여부
  isSorting: boolean;
  // placeholder(빈 자리 표시자)가 현재 활성화(크기가 부여된 상태)되어 있는지 여부
  isPlaceholderActive: boolean;
  // 이 컨테이너의 배치 축: 'horizontal'(가로로 나열, 보드의 리스트들) 또는 'vertical'(세로로 나열, 카드들)
  axis: Axis;
  // 이 컨테이너에 등록된 placeholder 엔티티 (없을 수도 있음)
  placeholder: EntityAndElement | null;
  instanceId: string;

  // isSorting 상태가 바뀔 때마다 알림을 받을 콜백들 (예: React 쪽에서 재렌더링 트리거용)
  sortListeners: Array<(isSorting: boolean) => void>;

  constructor(dndManager: DndManager, axis: Axis, onSortChange?: (isSorting: boolean) => void) {
    this.instanceId = generateInstanceId();
    this.dndManager = dndManager;
    this.sortables = new Map();
    this.shifted = new Set();
    this.hidden = new Set();
    this.isSorting = false;
    this.axis = axis;
    this.placeholder = null;
    // onSortChange가 주어졌다면 초기 리스너 목록의 첫 항목으로 등록
    this.sortListeners = onSortChange ? [onSortChange] : [];

    // DragManager의 emitter에서 이 컨테이너와 관련된 4가지 생명주기 이벤트를 구독한다.
    // (on의 세 번째 인자를 생략했으므로 컨텍스트 필터링 없이 이벤트 타입 전체를 구독)
    dndManager.dragManager.emitter.on('dragStart', this.handleDragStart);
    dndManager.dragManager.emitter.on('dragEnd', this.handleDragEnd);
    dndManager.dragManager.emitter.on('dragEnter', this.handleDragEnter);
    dndManager.dragManager.emitter.on('dragLeave', this.handleDragLeave);
  }

  // 컴포넌트 언마운트 시 대기 중인 타이머와 이벤트 구독을 모두 정리한다.
  destroy() {
    this.dndManager.win.clearTimeout(this.dragLeaveTimeout);
    this.dndManager.win.clearTimeout(this.dragEndTimeout);

    this.dndManager.dragManager.emitter.off('dragStart', this.handleDragStart);
    this.dndManager.dragManager.emitter.off('dragEnd', this.handleDragEnd);
    this.dndManager.dragManager.emitter.off('dragEnter', this.handleDragEnter);
    this.dndManager.dragManager.emitter.off('dragLeave', this.handleDragLeave);
  }

  // 컨테이너 안의 카드(또는 placeholder) 하나를 정렬 대상으로 등록한다.
  registerSortable(id: string, entity: Entity, el: HTMLElement, measureEl: HTMLElement) {
    const type = entity.getData().type;

    this.sortables.set(id, [entity, el, measureEl]);

    if (type === 'placeholder') {
      // placeholder는 별도 필드에도 보관해 두어 activatePlaceholder/deactivatePlaceholder에서
      // 빠르게 접근할 수 있게 한다. 또한 어느 축으로 늘어나야 하는지 CSS가 알 수 있도록
      // data-axis 속성을 심어둔다.
      this.placeholder = [entity, el, measureEl];
      measureEl.dataset.axis = this.axis;
      // 등록 직후에는 애니메이션 없이(transitions.none) 즉시 배치되도록 트랜지션을 꺼둔다
      setStyle(measureEl, 'transition', transitions.none);
    } else {
      setStyle(el, 'transition', transitions.none);
    }
  }

  // 등록 해제 (예: 카드가 실제로 리스트에서 제거되었을 때)
  unregisterSortable(id: string) {
    this.sortables.delete(id);
  }

  // 현재 드래그 중인 카드의 히트박스 크기(margin 포함)를 저장해 두는 필드.
  // placeholder 크기 조정과 shiftEl의 이동 거리 계산에 공통으로 재사용된다.
  hitboxDimensions = emptyDimensions;

  // 드래그가 "시작"될 때 호출된다. 드래그 시작 위치가 바로 이 컨테이너 안이라면(자기 자신의
  // 리스트에서 드래그를 시작한 경우), 원본 카드를 즉시 숨기고 그 뒤(형제)에 있는 카드들을
  // 미리 밀어내 자리를 만들어 둔다.
  handleDragStart = ({ dragEntity, dragEntityMargin, dragOriginHitbox }: DragEventData) => {
    const id = dragEntity?.entityId;
    // 드래그 시작 엔티티가 "이 컨테이너 소속"인지 확인 (다른 리스트에서 시작된 드래그면 무시)
    const haveDragEntity = id ? this.sortables.has(id) : null;

    if (!dragEntity || !haveDragEntity || !dragOriginHitbox) {
      return;
    }

    this.setSortState(true);
    // margin까지 포함한 실제 차지 공간(width/height)을 계산 - 다른 카드를 얼마나 밀어야 할지 기준값
    this.hitboxDimensions = getHitboxDimensions(dragOriginHitbox, dragEntityMargin);
    // 드래그 시작과 동시에 자리표시자를 활성화(단, 이 시점엔 애니메이션 없이 즉시 크기 적용)
    this.activatePlaceholder(this.hitboxDimensions, transitions.none);

    this.sortables.forEach(([entity, el, measureEl]) => {
      // 드래그 중인 카드(dragEntity) 기준으로, 이 카드(entity)가 그보다 앞인지/뒤인지/자기 자신인지 판정
      const siblingDirection = getSiblingDirection(dragEntity.getPath(), entity.getPath());
      const entityId = entity.entityId;

      if (siblingDirection === SiblingDirection.Self) {
        // 드래그 중인 원본 카드 자신은 화면에서 숨긴다 (마우스를 따라다니는 오버레이가 대신 보여짐)
        this.hidden.add(entityId);
        return this.hideDraggingEntity(measureEl);
      }

      if (siblingDirection === SiblingDirection.After) {
        // 원본 카드보다 뒤에 있던 형제들은, 원본이 빠진 자리만큼 앞으로 당겨줘야 하므로
        // 미리 밀어내(shift) 애니메이션 없이 최종 위치로 배치해 둔다.
        if (!this.shifted.has(entityId)) {
          this.shifted.add(entityId);
        }

        this.shiftEl(el, transitions.none, this.hitboxDimensions);
      }
    });
  };

  // 드래그 종료/취소/영역 이탈 등 다양한 상황에서 공통으로 호출되어, 밀림/숨김/자리표시자 상태를
  // 원래대로 되돌리는 헬퍼. 옵션으로 특정 상태(hidden/placeholder)는 유지할 수 있다.
  resetSelf({
    maintainHidden,
    maintainPlaceholder,
    shiftTransition,
    placeholderTransition,
  }: {
    maintainHidden?: boolean;
    maintainPlaceholder?: boolean;
    shiftTransition?: string;
    placeholderTransition?: string;
  }) {
    if (this.isSorting) {
      this.setSortState(false);
    }

    if (this.isPlaceholderActive && !maintainPlaceholder) {
      this.deactivatePlaceholder(placeholderTransition);
    }

    if (this.shifted.size > 0) {
      // 밀려나 있던 카드들을 모두 원래 위치(transform 제거)로 되돌린다
      this.shifted.forEach((entityId) => {
        if (this.sortables.has(entityId)) {
          const [, el] = this.sortables.get(entityId);
          this.resetEl(el, shiftTransition);
        }
      });

      this.shifted.clear();
    }

    if (!maintainHidden && this.hidden.size > 0) {
      // 숨겨져 있던 카드(보통 드래그 원본)를 다시 보이게 한다
      this.hidden.forEach((entityId) => {
        if (this.sortables.has(entityId)) {
          const [, , measure] = this.sortables.get(entityId);
          this.resetEl(measure, shiftTransition);
        }
      });

      this.hidden.clear();
    }
  }

  // 드롭 확정 애니메이션이 끝난 뒤 실제 상태를 리셋하기 위한 setTimeout id (클로저 밖 필드로 보관해
  // 중복 예약을 clearTimeout으로 취소할 수 있게 함)
  private dragEndTimeout = 0;
  // 드래그가 끝났을 때(마우스를 뗐을 때) 호출되어, 최종적으로 드롭을 확정하고 상태를 리셋한다.
  // 이 컨테이너가 실제 드롭 대상이 아니었던 경우/취소된 경우/실제로 드롭된 경우를 모두 분기 처리한다.
  handleDragEnd = ({
    primaryIntersection,
    dragPosition,
    dragOriginHitbox,
    dragEntity,
  }: DragEventData) => {
    // 드롭 영역(acceptsSort로 특정 타입만 받는 영역)에 남아있던 'is-dropping' 강조 클래스를 정리
    const resetDroparea = () => {
      if (primaryIntersection && dragEntity) {
        const { acceptsSort } = primaryIntersection.getData();
        const inDroparea = acceptsSort && !acceptsSort.includes(dragEntity.getData().type);
        if (inDroparea) {
          const sortable = this.sortables.get(primaryIntersection.entityId);
          if (sortable) sortable[2].removeClass('is-dropping');
        }
      }
    };

    // 이 컨테이너에서 정렬 상호작용이 진행 중이 아니었거나 필요한 정보가 없는 경우
    if (!this.isSorting || !dragPosition || !dragOriginHitbox || !dragEntity) {
      resetDroparea();

      // 어디에도 드롭되지 않았고(교차 대상 없음), 드래그 원본이 이 컨테이너 소속이라면
      // 애니메이션 없이 즉시 원래 상태로 복구(단, hidden은 이미 해제 대상이므로 false)
      if (!primaryIntersection && dragEntity && this.sortables.has(dragEntity.entityId)) {
        return this.resetSelf({ maintainHidden: false });
      }

      if (primaryIntersection && dragEntity) {
        // 다른 컨테이너 위에 드롭된 경우: 드롭 대상의 히트박스 위치로 "날아가는" 것처럼 보이도록
        // 이동 거리 기반의 드롭 애니메이션 시간을 계산한다.
        const dropHitbox = primaryIntersection?.getHitbox() || dragOriginHitbox;
        const dropDuration = getDropDuration({
          position: dragPosition,
          destination: {
            x: dropHitbox[0],
            y: dropHitbox[1],
          },
        });

        // 드롭 애니메이션 재생 시간만큼 기다렸다가 상태를 리셋한다
        return this.dndManager.win.setTimeout(() => {
          this.resetSelf({ maintainHidden: false });
        }, dropDuration);
      }

      // 그 외의 경우(이 컨테이너와 무관한 드래그)에는 hidden 상태만 유지한 채 나머지만 리셋
      return this.resetSelf({ maintainHidden: true });
    }

    // 여기부터는 "이 컨테이너 안에서 실제로 정렬 상호작용이 진행 중이었던" 경우의 처리.
    const { win } = this.dndManager;
    // 이전에 예약돼 있던 enter/leave/end 관련 타이머들을 모두 취소하고 새로 시작
    win.clearTimeout(this.dragEnterTimeout);
    win.clearTimeout(this.dragLeaveTimeout);
    win.clearTimeout(this.dragEndTimeout);

    const dropHitbox = primaryIntersection?.getHitbox() || dragOriginHitbox;
    // htmldnd(외부 HTML 드래그, 예: 파일 드롭)는 애니메이션 없이 즉시(0ms) 처리
    const dropDuration =
      dragEntity.scopeId === 'htmldnd'
        ? 0
        : getDropDuration({
            position: dragPosition,
            destination: {
              x: dropHitbox[0],
              y: dropHitbox[1],
            },
          });

    // 드롭 애니메이션 시간만큼 기다린 뒤, 실제 데이터 이동(onDrop)을 실행하고 시각 상태를 리셋한다.
    // 애니메이션이 끝나기 전에 데이터를 먼저 바꿔버리면(리렌더링 등으로) 애니메이션이 끊겨 보이므로
    // 이렇게 시간차를 두는 것이 자연스러운 드롭 연출의 핵심이다.
    this.dragEndTimeout = win.setTimeout(() => {
      // entityId는 흔히 "scope:::실제id" 형식이라, ':::' 뒤쪽(실제id)만 비교에 사용한다
      const dragEntityId = dragEntity.entityId.split(':::').pop();
      const primaryIntersectionId = primaryIntersection?.entityId.split(':::').pop();

      resetDroparea();

      if (
        primaryIntersection &&
        this.sortables.has(primaryIntersection.entityId) &&
        primaryIntersectionId !== dragEntityId
      ) {
        // 드롭 대상이 자기 자신이 아닌 실제 다른 위치라면, 상위 DndManager에 실제 데이터 이동을 위임
        this.dndManager.onDrop(dragEntity, primaryIntersection);
      }

      // 데이터 반영 이후에는 이번에는 애니메이션 없이(transitions.none) 즉시 시각 상태를 리셋한다
      // (데이터가 바뀌면서 재렌더링될 것이므로 굳이 다시 트랜지션을 태울 필요가 없음)
      this.resetSelf({
        maintainHidden: false,
        shiftTransition: transitions.none,
        placeholderTransition: transitions.none,
      });
    }, dropDuration);

    this.hitboxDimensions = emptyDimensions;
  };

  private dragEnterTimeout = 0;
  // 드래그 중인 카드가 이 컨테이너 안의 특정 대상(primaryIntersection) 위로 "새로 진입"했을 때 호출.
  // 실제 밀림 계산은 약간의 지연(10ms) 후에 수행해, 마우스가 여러 카드를 빠르게 스쳐 지나갈 때
  // 매번 계산하지 않고 마지막 진입만 반영되도록 한다(rapid-fire 방지용 디바운스와 유사).
  handleDragEnter = ({
    dragEntity,
    dragEntityMargin,
    dragOriginHitbox,
    primaryIntersection,
  }: DragEventData) => {
    const id = primaryIntersection?.entityId;
    const haveSortable = id ? this.sortables.has(id) : null;

    if (!dragEntity || !primaryIntersection || !haveSortable || !dragOriginHitbox) {
      // 교차 대상이 이 컨테이너 소속이 아니라면, 혹시 이전까지 정렬 중이었다면 hidden/placeholder는
      // 유지한 채(다른 곳으로 이동 중일 뿐일 수 있으므로) 밀림 상태만 리셋
      if (!haveSortable && this.isSorting) {
        this.resetSelf({ maintainHidden: true, maintainPlaceholder: true });
      }

      return;
    }

    if (dragEntity.entityId === primaryIntersection.entityId) {
      // 자기 자신 위에 진입한 것은 의미 있는 이동이 아니므로 무시
      return;
    }

    const { win } = this.dndManager;

    // 이전에 예약된 leave/enter 타이머를 취소하고 이번 진입에 대해 새로 예약한다
    win.clearTimeout(this.dragLeaveTimeout);
    win.clearTimeout(this.dragEnterTimeout);

    this.dragEnterTimeout = win.setTimeout(() => {
      // 드래그 카드의 차지 공간을 다시 계산해(placeholder 크기, 밀림 거리 산정 기준) 저장
      const dims = (this.hitboxDimensions = getHitboxDimensions(
        dragOriginHitbox,
        dragEntityMargin
      ));
      this.setSortState(true);
      // 이번엔 부드러운 전환(transitions.placeholder)으로 placeholder 크기를 키운다
      this.activatePlaceholder(dims, transitions.placeholder);

      // acceptsSort가 지정된 "드롭 전용 영역"(예: 리스트 자체에 드롭해서 다른 타입으로 변환하는 등)
      // 위에 있고, 그 영역이 지금 드래그 중인 타입을 정렬 대상으로 받아들이지 않는 경우를 판별
      const { acceptsSort } = primaryIntersection.getData();
      const inDroparea = acceptsSort && !acceptsSort.includes(dragEntity.getData().type);

      if (inDroparea) {
        // 정렬이 아니라 "이 영역에 통째로 드롭"하는 상황이므로, 시각적으로 강조 클래스를 붙이고
        const sortable = this.sortables.get(primaryIntersection.entityId);
        if (sortable) sortable[2].addClass('is-dropping');

        // 기존에 밀려나 있던 카드들은 더 이상 밀릴 이유가 없으니 모두 원위치로 되돌린다
        this.sortables.forEach(([entity, el]) => {
          const entityId = entity.entityId;
          if (this.shifted.has(entityId)) {
            this.shifted.delete(entityId);
            this.resetEl(el);
          }
        });
        return;
      }

      // 일반적인 "형제 사이에 끼워 넣기" 상황: 교차 대상 기준으로 그 이후(또는 자기 자신 위치, 즉
      // 끼워 넣을 지점)에 해당하는 형제들은 밀어내고, 더 이상 밀릴 이유가 없는 카드는 원위치로.
      this.sortables.forEach(([entity, el]) => {
        const siblingDirection = getSiblingDirection(
          primaryIntersection.getPath(),
          entity.getPath()
        );

        const entityId = entity.entityId;

        if (
          !this.hidden.has(entityId) &&
          (siblingDirection === SiblingDirection.Self ||
            siblingDirection === SiblingDirection.After)
        ) {
          // 교차 대상 자신이거나 그보다 뒤에 있는 형제는, 드래그 카드가 그 앞에 끼어들 것이므로 밀어냄
          if (!this.shifted.has(entityId)) {
            this.shifted.add(entityId);
            this.shiftEl(el, transitions.outOfTheWay, dims);
          }
        } else if (this.shifted.has(entityId)) {
          // 더 이상 밀려있을 이유가 없는 카드는 원위치로 복귀
          this.shifted.delete(entityId);
          this.resetEl(el);
        }
      });
    }, 10);
  };

  private dragLeaveTimeout = 0;
  // 드래그 중인 카드가 이 컨테이너의 대상 영역을 벗어났을 때 호출. 즉시 리셋하지 않고
  // dragLeaveDebounceLength(100ms) 뒤에 리셋을 예약해, 짧게 스쳐 지나가는 경우의 깜빡임을 줄인다.
  handleDragLeave = ({ dragEntity, primaryIntersection }: DragEventData) => {
    if (!this.isSorting) return;

    const { acceptsSort } = primaryIntersection.getData();
    const inDroparea = acceptsSort && !acceptsSort.includes(dragEntity.getData().type);
    if (inDroparea) {
      // 드롭 전용 영역을 벗어났다면 강조 클래스도 함께 제거
      const sortable = this.sortables.get(primaryIntersection.entityId);
      if (sortable) sortable[2].removeClass('is-dropping');
    }

    const { win } = this.dndManager;
    win.clearTimeout(this.dragLeaveTimeout);
    win.clearTimeout(this.dragEnterTimeout);
    this.dragLeaveTimeout = win.setTimeout(() => {
      // hidden/placeholder는 유지한 채(원본 카드는 여전히 드래그 중이므로) 밀림만 리셋
      this.resetSelf({ maintainHidden: true, maintainPlaceholder: true });
    }, dragLeaveDebounceLength);

    this.hitboxDimensions = emptyDimensions;
  };

  // placeholder(빈 자리 표시자) 요소의 폭 또는 높이를 드래그 중인 카드 크기에 맞춰 늘린다.
  // axis가 'horizontal'이면 width를, 아니면 height를 사용한다(리스트는 세로 나열이므로 height,
  // 보드의 리스트들은 가로 나열이므로 width가 "카드가 차지하는 자리 크기"가 된다).
  activatePlaceholder(dimensions: { width: number; height: number }, transition: string) {
    if (this.placeholder) {
      const isHorizontal = this.axis === 'horizontal';
      const [, , measure] = this.placeholder;

      setStyle(measure, 'transition', transition);
      setStyle(
        measure,
        isHorizontal ? 'width' : 'height',
        `${isHorizontal ? dimensions.width : dimensions.height}px`
      );

      this.isPlaceholderActive = true;
    }
  }

  // placeholder 크기를 다시 0으로 되돌려 자리표시자를 비활성화한다
  deactivatePlaceholder(transition: string = transitions.placeholder) {
    if (this.placeholder) {
      const [, , measure] = this.placeholder;

      setStyle(measure, 'transition', transition);
      removeStyle(measure, 'width');
      removeStyle(measure, 'height');

      this.isPlaceholderActive = false;
    }
  }

  // 드래그 중인 원본 카드를 화면에서 완전히 숨긴다(display: none)
  hideDraggingEntity(el: HTMLElement) {
    setStyle(el, 'display', 'none');
  }

  // 카드를 드래그 중인 카드의 크기만큼 이동시켜(translate3d) "자리를 비켜주는" 애니메이션을 만든다.
  // translate3d를 쓰는 이유는 GPU 가속을 받는 컴포지팅 레이어로 처리되어 top/left를 바꾸는 것보다
  // 부드럽고(리플로우 없이) 저렴하게 애니메이션할 수 있기 때문이다.
  shiftEl(el: HTMLElement, transition: string, dimensions: { width: number; height: number }) {
    const shift =
      this.axis === 'horizontal'
        ? `translate3d(${dimensions.width}px, 0, 0)`
        : `translate3d(0, ${dimensions.height}px, 0)`;

    setStyle(el, 'transition', transition);
    setStyle(el, 'transform', shift);
  }

  // 밀려났던(또는 숨겨졌던) 요소를 원래의 위치/보이는 상태로 되돌린다
  resetEl(el: HTMLElement, transition: string = transitions.outOfTheWay) {
    setStyle(el, 'transition', transition);
    setStyle(el, 'transform', 'translate3d(0, 0, 0)');
    removeStyle(el, 'display');
  }

  // isSorting 상태 변화를 구독하고 싶은 외부 콜백(예: React 컴포넌트)을 등록
  addSortNotifier(fn: (isSorting: boolean) => void) {
    this.sortListeners.push(fn);
  }

  // 등록했던 콜백을 해제
  removeSortNotifier(fn: (isSorting: boolean) => void) {
    this.sortListeners = this.sortListeners.filter((listener) => listener !== fn);
  }

  // isSorting 값이 실제로 바뀔 때만 리스너들에게 알린다(불필요한 중복 알림 방지)
  setSortState(isSorting: boolean) {
    if (this.isSorting !== isSorting) {
      this.isSorting = isSorting;
      this.sortListeners.forEach((fn) => fn(isSorting));
    }
  }
}
