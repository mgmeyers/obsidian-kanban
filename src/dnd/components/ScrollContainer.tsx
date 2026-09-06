/**
 * ============================================================================
 * [실행 순서 #38] ScrollContainer.tsx — 스크롤 가능한 컨테이너이자 스크롤 엔티티 등록 지점
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * 보드/레인 등에서 실제로 스크롤이 발생하는 DOM 요소를 렌더링하고, #39
 * ScrollStateContext.tsx의 useStoredScrollState 훅을 통해 이 요소의 이전 스크롤
 * 위치를 복원하고 이후 스크롤 변화를 ScrollStateManager에 저장합니다. isStatic이
 * 아닌 경우에는 내부를 #40 Scrollable.tsx로 한 번 더 감싸서 실제 드래그앤드롭 중
 * 자동 스크롤(가장자리로 드래그 시 스크롤되는 기능)을 담당하는 ScrollManager와
 * 연결합니다. isStatic이 true이면 스크롤 로직 없이 children만 그대로 렌더링합니다.
 * ============================================================================
 */
import classcat from 'classcat';
import { ComponentChildren } from 'preact';
import { c } from 'src/components/helpers';

import { useStoredScrollState } from './ScrollStateContext';
import { Scrollable } from './Scrollable';

interface ScrollContainerProps {
  children?: ComponentChildren;
  className?: string;
  triggerTypes: string[];
  isStatic?: boolean;
  id: string;
  index?: number;
}

export function ScrollContainer({
  className,
  children,
  triggerTypes,
  isStatic,
  id,
  index,
}: ScrollContainerProps) {
  // useStoredScrollState(#39)에서 두 가지를 받아온다.
  // - setRef: 실제 DOM 엘리먼트가 마운트될 때 호출될 ref 콜백(스크롤 위치 복원 담당)
  // - scrollRef: 해당 DOM 엘리먼트를 가리키는 ref 객체(스크롤 이벤트 리스너 등록에 사용됨)
  const { setRef, scrollRef } = useStoredScrollState(id, index);

  return (
    // ref에 setRef 콜백을 전달해, 이 div가 실제 DOM에 붙는 시점에 이전에 저장된
    // 스크롤 위치(x, y)를 복원할 수 있도록 한다.
    <div ref={setRef} className={classcat([className, c('scroll-container')])}>
      {isStatic ? (
        // 정적(static) 컨테이너인 경우 자동 스크롤/드래그 관련 로직이 필요 없으므로
        // Scrollable 래퍼 없이 children을 그대로 렌더링한다.
        children
      ) : (
        // 정적이 아닌 경우 #40 Scrollable로 감싸, 드래그 중 가장자리에 마우스가 위치하면
        // 자동으로 스크롤되는 기능(ScrollManager)과 연결한다.
        <Scrollable scrollRef={scrollRef} triggerTypes={triggerTypes}>
          {children}
        </Scrollable>
      )}
    </div>
  );
}
