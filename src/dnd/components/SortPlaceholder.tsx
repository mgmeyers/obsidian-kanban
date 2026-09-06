/**
 * ============================================================================
 * [실행 순서 #42] SortPlaceholder.tsx — 드래그 중 드롭될 위치를 표시하는 빈 플레이스홀더
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * 카드/레인 목록의 맨 끝(또는 중간)에 항상 존재하는 "빈 자리" 컴포넌트로, 평소에는
 * 크기가 0에 가깝지만 드래그 중 dnd/managers/SortManager.ts가 이 자리의 크기를 조절해
 * 드래그 중인 항목이 놓일 자리를 시각적으로 보여주는 역할을 합니다. 내부적으로는
 * #43 Droppable.tsx를 사용해 이 자리 자체도 하나의 드롭 가능한 엔티티로 등록하며,
 * EntityManager를 통해 SortManager에 등록되어 activatePlaceholder/deactivatePlaceholder
 * 호출 시 크기가 애니메이션됩니다. isStatic이 true면 Droppable 없이 children만 렌더링합니다.
 * ============================================================================
 */
import classcat from 'classcat';
import { useMemo, useRef } from 'preact/compat';
import { c, generateInstanceId } from 'src/components/helpers';

import { EntityData, WithChildren } from '../types';
import { Droppable } from './Droppable';

export interface SortPlaceholderProps extends WithChildren {
  index: number;
  accepts: string[];
  className?: string;
  isStatic?: boolean;
}

export function SortPlaceholder({
  index,
  accepts,
  className,
  isStatic,
  children,
}: SortPlaceholderProps) {
  // elementRef: 실제 hitbox(드롭 판정 영역) 역할을 하는 안쪽 div를 가리킨다.
  // measureRef: SortManager가 width/height를 직접 조작해 애니메이션을 적용하는
  // 바깥쪽 div(측정/애니메이션 대상)를 가리킨다. 두 개의 ref로 나눠 둔 이유는
  // Droppable에 넘겨줄 "판정용 엘리먼트"와 "크기 측정/스타일 적용용 엘리먼트"를
  // 구분하기 위함이다.
  const elementRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // 이 플레이스홀더를 하나의 엔티티로 취급하기 위한 데이터 객체.
  // type: 'placeholder'로 지정해 SortManager.registerSortable 내부에서
  // 일반 카드/레인과 다르게 특별 취급(this.placeholder에 저장)되도록 한다.
  // 참고: 두 번째 인자로 의존성 "배열"이 아니라 accepts(문자열 배열)를 그대로
  // 넘기고 있다. useMemo는 각 원소를 개별 의존성으로 비교하므로, accepts 배열
  // 안의 문자열 개수/값이 바뀔 때만 재계산되는 것과 비슷하게 동작한다(배열
  // 참조 자체가 바뀌어도 원소 값이 같으면 재계산되지 않을 수 있는 다소 특이한
  // 패턴이다).
  const data = useMemo<EntityData>(() => {
    return {
      id: generateInstanceId(),
      type: 'placeholder',
      accepts,
    };
  }, accepts);

  return (
    // 바깥쪽 div(measureRef)는 SortManager가 width/height 스타일을 직접 조작해
    // 드래그 중 자리 크기를 넓히거나 좁히는 애니메이션의 대상이 된다.
    <div ref={measureRef} className={classcat([className, c('placeholder')])}>
      {/* 안쪽 div(elementRef)는 실제 드롭 판정을 담당하는 hitbox 엘리먼트다. */}
      <div ref={elementRef}>
        {!isStatic ? (
          // 정적이 아닌 경우, 이 플레이스홀더도 #43 Droppable로 감싸 하나의 드롭
          // 가능 엔티티로 등록한다. index/accepts/data를 그대로 전달해 다른 카드와
          // 동일한 EntityManager 등록 절차를 거치게 한다.
          <Droppable
            elementRef={elementRef}
            measureRef={measureRef}
            id={data.id}
            index={index}
            data={data}
          >
            {children}
          </Droppable>
        ) : (
          // 정적인 경우 드롭 판정이 필요 없으므로 Droppable 없이 children만 렌더링한다.
          children
        )}
      </div>
    </div>
  );
}
