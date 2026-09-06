/**
 * ============================================================================
 * [실행 순서 #44] DragOverlay.tsx — 드래그 중 마우스를 따라다니는 카드/레인 프리뷰 오버레이
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * dnd/managers/DragManager.ts(DndManager 내부의 this.dragManager)가 발생시키는
 * dragStart/dragMove/dragEnd 이벤트를 구독해, 현재 드래그 중인 엔티티와 그 위치/크기
 * 스타일을 상태로 관리하고, children으로 전달된 렌더 함수(render props 패턴)를 호출해
 * 실제 프리뷰 UI를 그려주는 컴포넌트입니다. #16 DragDropApp.tsx가 이 컴포넌트를 사용해
 * "드래그 중인 카드/레인이 마우스를 따라다니는" 시각 효과를 구현합니다. 렌더링 결과는
 * createPortal을 통해 원래 DOM 트리 밖(엔티티가 속한 window의 document.body)으로
 * 옮겨져, 부모 요소의 overflow: hidden이나 z-index 제약을 받지 않고 항상 최상단에
 * 표시될 수 있습니다.
 * ============================================================================
 */
import { JSX } from 'preact';
import { CSSProperties, createPortal, useContext, useEffect, useState } from 'preact/compat';

import { DragEventData } from '../managers/DragManager';
import { Coordinates, Entity, Hitbox } from '../types';
import { getDropDuration, transforms, transitions } from '../util/animation';
import { emptyHitbox } from '../util/hitbox';
import { DndManagerContext } from './context';

export interface DragOverlayProps {
  // children이 일반적인 Preact 노드가 아니라 "함수"로 선언되어 있다.
  // 이것이 바로 render props(렌더 프롭) 패턴으로, 부모(DragOverlay)가 계산한 데이터
  // (현재 드래그 중인 entity와 위치 계산이 끝난 styles)를 사용자가 원하는 방식으로
  // 자유롭게 렌더링할 수 있도록 위임하는 방식이다. 즉, <DragOverlay>{(entity, styles) =>
  // <MyPreview .../>}</DragOverlay> 형태로 사용하며, DragOverlay는 "언제, 어떤 데이터로"
  // 렌더링할지만 책임지고, "무엇을" 렌더링할지는 호출하는 쪽(children 함수)에 맡긴다.
  children(entity: Entity, styles: JSX.CSSProperties): JSX.Element;
}

// 오버레이(프리뷰)에 적용할 CSS를 계산하는 순수 함수.
// position(현재 마우스/포인터 위치)과 origin(드래그 시작 위치)의 차이만큼 translate3d로
// 이동시키고, 원본 엔티티의 hitbox(위치/크기)에 margin을 가감해 최종 크기를 결정한다.
function getDragOverlayStyles(
  position: Coordinates,
  origin: Coordinates,
  originHitbox: Hitbox,
  margin: Hitbox,
  transition?: string,
  transform?: string
): CSSProperties {
  const adjustedHitbox = [
    originHitbox[0] - margin[0],
    originHitbox[1] - margin[1],
    originHitbox[2] + margin[2],
    originHitbox[3] + margin[3],
  ];

  return {
    // transform 인자가 명시적으로 주어지면(드롭 애니메이션 등) 그것을 우선 사용하고,
    // 없으면 포인터 이동량만큼 translate3d로 이동시키는 값을 계산한다.
    transform:
      transform ||
      `translate3d(${position.x - origin.x + adjustedHitbox[0]}px, ${
        position.y - origin.y + adjustedHitbox[1]
      }px, 0px)`,
    width: `${adjustedHitbox[2] - adjustedHitbox[0]}px`,
    height: `${adjustedHitbox[3] - adjustedHitbox[1]}px`,
    transition,
  };
}

export function DragOverlay({ children }: DragOverlayProps) {
  const dndManager = useContext(DndManagerContext);

  // 현재 드래그 중인 엔티티(카드/레인)와, 그 엔티티에 적용할 CSS 스타일을 상태로
  // 관리한다. 둘 다 undefined면 "현재 드래그 중이 아님"을 의미하며 아무것도
  // 렌더링하지 않는다.
  const [dragEntity, setDragEntity] = useState<Entity | undefined>();
  const [styles, setStyles] = useState<CSSProperties | undefined>();

  useEffect(() => {
    // dndManager가 아직 없다면(Provider 바깥) 구독할 대상이 없으므로 종료한다.
    if (!dndManager) return;

    // 드래그가 시작된 시점의 hitbox(위치/크기)를 클로저에 보관해 두고, 드래그가
    // 진행되는 동안(dragMove) 계속 재사용한다. useState가 아니라 일반 지역 변수를
    // 쓰는 이유는 이 값이 바뀔 때마다 리렌더링을 유발할 필요는 없고, 단지 다음
    // dragMove/dragEnd 핸들러 호출 시 참조할 수 있으면 되기 때문이다.
    let dragOriginHitbox: Hitbox = emptyHitbox;

    // dragStart 이벤트 핸들러: 드래그가 시작되면 드래그 대상 엔티티와 시작 위치를
    // 기록하고, 초기 오버레이 스타일을 계산해 상태에 반영한다.
    const dragStart = ({
      dragEntity,
      dragOrigin,
      dragPosition,
      dragEntityMargin,
    }: DragEventData) => {
      if (!dragEntity || !dragPosition || !dragOrigin) {
        return;
      }
      dragOriginHitbox = dragEntity.getHitbox();
      setDragEntity(dragEntity);
      setStyles(getDragOverlayStyles(dragPosition, dragOrigin, dragOriginHitbox, dragEntityMargin));
    };

    // dragMove 이벤트 핸들러: 포인터가 이동할 때마다 호출되어, 갱신된 포인터 위치를
    // 기준으로 오버레이 스타일(주로 transform)을 다시 계산한다.
    const dragMove = ({ dragOrigin, dragPosition, dragEntityMargin }: DragEventData) => {
      if (!dragPosition || !dragOrigin) {
        return;
      }
      setStyles(getDragOverlayStyles(dragPosition, dragOrigin, dragOriginHitbox, dragEntityMargin));
    };

    // dragEnd 이벤트 핸들러: 드래그가 끝나면, 드롭될 위치(primaryIntersection)가
    // 있는 경우 그 위치로 부드럽게 이동하는 "드롭 애니메이션" 스타일을 적용한 뒤,
    // 애니메이션 지속 시간(dropDuration) 이후에 상태를 초기화(undefined)해 오버레이를
    // 사라지게 한다. 교차 대상이 없다면(원래 자리로 되돌아가는 경우 등) 즉시 초기화한다.
    const dragEnd = ({
      dragOrigin,
      primaryIntersection,
      dragPosition,
      dragEntityMargin,
    }: DragEventData) => {
      if (primaryIntersection && dragPosition && dragOrigin) {
        const dropHitbox = primaryIntersection.getHitbox();
        const dropDestination = {
          x: dropHitbox[0],
          y: dropHitbox[1],
        };
        const dropDuration = getDropDuration({
          position: dragPosition,
          destination: dropDestination,
        });

        const transition = transitions.drop(dropDuration);
        const transform = transforms.drop(dropDestination);

        setStyles(
          getDragOverlayStyles(
            dragPosition,
            dragOrigin,
            dragOriginHitbox,
            dragEntityMargin,
            transition,
            transform
          )
        );

        // setTimeout으로 드롭 애니메이션이 끝날 시점(dropDuration 이후)에 맞춰
        // 상태를 초기화한다. activeWindow는 Obsidian이 제공하는 현재 활성 윈도우
        // 참조로, 팝아웃 창 환경에서도 올바른 window의 타이머를 사용하기 위함이다.
        activeWindow.setTimeout(() => {
          setDragEntity(undefined);
          setStyles(undefined);
        }, dropDuration);
      } else {
        setDragEntity(undefined);
        setStyles(undefined);
      }
    };

    // DndManager 내부의 dragManager가 제공하는 EventEmitter를 구독한다.
    const { emitter } = dndManager.dragManager;
    emitter.on('dragStart', dragStart);
    emitter.on('dragMove', dragMove);
    emitter.on('dragEnd', dragEnd);

    // cleanup 함수: 컴포넌트가 언마운트되거나 dndManager가 바뀌면(의존성 배열 참고)
    // 등록했던 세 리스너를 모두 해제한다. 이를 생략하면 컴포넌트가 사라진 뒤에도
    // 이벤트가 계속 전달되어 오류나 메모리 누수가 발생할 수 있다.
    return () => {
      emitter.off('dragStart', dragStart);
      emitter.off('dragMove', dragMove);
      emitter.off('dragEnd', dragEnd);
    };
  }, [dndManager]);

  // 드래그 중이 아니라면(엔티티나 스타일이 아직 없다면) 아무것도 렌더링하지 않는다.
  if (!dragEntity || !styles) {
    return null;
  }

  // createPortal: 실제 DOM에는 이 컴포넌트가 위치한 자리가 아니라, 드래그 중인
  // 엔티티가 속한 window의 document.body 바로 아래에 렌더링 결과를 이식(portal)한다.
  // 이렇게 하면 상위 요소의 overflow: hidden, position, z-index 등에 영향을 받지 않고
  // 항상 화면 최상단에 오버레이를 표시할 수 있다. children(dragEntity, styles)을
  // 호출해 실제 렌더링은 사용 측(render props)에 위임한다.
  return createPortal(children(dragEntity, styles), dragEntity.getData().win.document.body);
}

// 현재 이 DndManager 범위 안에서 "무언가가 드래그되고 있는지" 여부만 알고 싶을 때
// 사용하는 간단한 훅. DragOverlay와 마찬가지로 dragStart/dragEnd 이벤트를 구독하지만,
// 실제 엔티티나 스타일 계산 없이 boolean 상태만 다룬다.
export function useIsAnythingDragging() {
  const dndManager = useContext(DndManagerContext);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const onDragStart = () => setIsDragging(true);
    // 드래그가 끝나도 곧바로 false로 바꾸지 않고, 드롭 애니메이션이 끝나는
    // 시점(dropDuration 이후)에 맞춰 false로 전환한다. 이렇게 하면 드롭 애니메이션이
    // 재생되는 동안에도 isDragging이 true로 유지되어, 애니메이션 중 UI가 어색하게
    // 바뀌는 것을 방지할 수 있다.
    const onDragEnd = ({ primaryIntersection, dragPosition }: DragEventData) => {
      const dropHitbox = primaryIntersection?.getHitbox() || [0, 0];
      const dropDestination = {
        x: dropHitbox[0],
        y: dropHitbox[1],
      };
      const dropDuration = getDropDuration({
        position: dragPosition || dropDestination,
        destination: dropDestination,
      });

      activeWindow.setTimeout(() => setIsDragging(false), dropDuration);
    };

    const { emitter } = dndManager.dragManager;

    emitter.on('dragStart', onDragStart);
    emitter.on('dragEnd', onDragEnd);

    // cleanup: 컴포넌트가 언마운트되거나 dndManager가 바뀌면 리스너를 해제한다.
    return () => {
      emitter.off('dragStart', onDragStart);
      emitter.off('dragEnd', onDragEnd);
    };
  }, [dndManager]);

  return isDragging;
}
