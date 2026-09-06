/**
 * ============================================================================
 * [실행 순서 #63] src/components/Lane/Lane.tsx — 리스트(레인) 렌더링 본체, 드래그 가능한(Draggable) 레인 컴포넌트
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * 이 파일은 칸반 보드에서 하나의 "레인(리스트)" 전체를 렌더링하는 컴포넌트를 정의한다.
 * #17(components/Kanban.tsx)이 보드에 속한 레인 배열을 순회하며 이 파일이 내보내는
 * `Lanes` 컴포넌트를 렌더링하고, `Lanes`는 각 레인마다 `DraggableLane`을 렌더링한다.
 * 레인 헤더(#64 LaneHeader.tsx), 카드 목록(Item 컴포넌트), 카드 추가 폼(ItemForm)을
 * 하나로 묶고, dnd(Drag & Drop) 하위 시스템의 Droppable/Sortable 컴포넌트로 감싸서
 * "카드를 드롭할 수 있는 영역"이자 "다른 레인들 사이에서 정렬 가능한 항목"으로 동작하게 만든다.
 * #18(components/context.ts)의 `KanbanContext`에서 stateManager(보드 상태 저장소),
 * boardModifiers(보드 데이터를 불변(immutable)하게 수정하는 헬퍼 모음), view(옵시디언 뷰 객체)를
 * useContext로 꺼내 쓰며, 카드 추가/레인 접기 같은 상호작용이 모두 이 값들을 경유해 실제
 * 마크다운 파일 데이터를 갱신한다.
 * ============================================================================
 */
import animateScrollTo from 'animated-scroll-to';
import classcat from 'classcat';
import update from 'immutability-helper';
import { Fragment, memo, useCallback, useContext, useMemo, useRef, useState } from 'preact/compat';
import {
  DraggableProps,
  Droppable,
  StaticDroppable,
  useNestedEntityPath,
} from 'src/dnd/components/Droppable';
import { ScrollContainer } from 'src/dnd/components/ScrollContainer';
import { SortPlaceholder } from 'src/dnd/components/SortPlaceholder';
import { Sortable, StaticSortable } from 'src/dnd/components/Sortable';
import { useDragHandle } from 'src/dnd/managers/DragManager';
import { frontmatterKey } from 'src/parsers/common';
import { getTaskStatusDone } from 'src/parsers/helpers/inlineMetadata';

import { Items } from '../Item/Item';
import { ItemForm } from '../Item/ItemForm';
import { KanbanContext, SearchContext, SortContext } from '../context';
import { c, generateInstanceId } from '../helpers';
import { DataTypes, EditState, EditingState, Item, Lane } from '../types';
import { LaneHeader } from './LaneHeader';

// 이 레인의 드롭 영역(Droppable)이 받아들일 수 있는 데이터 타입 목록.
// 레인 내부에는 "카드(Item)"만 드롭될 수 있음을 dnd 시스템에 알려준다.
const laneAccepts = [DataTypes.Item];

export interface DraggableLaneProps {
  lane: Lane;
  laneIndex: number;
  isStatic?: boolean; // true면 정적(드래그 불가) 렌더링 모드 — 예: 미리보기/읽기 전용 화면
  collapseDir: 'horizontal' | 'vertical'; // 보드 뷰는 가로로, 리스트 뷰는 세로로 접힘 방향이 다름
  isCollapsed?: boolean;
}

function DraggableLaneRaw({
  isStatic,
  lane,
  laneIndex,
  collapseDir,
  isCollapsed = false,
}: DraggableLaneProps) {
  // 레인 상단의 "카드 추가" 인라인 입력 폼이 열려 있는지/편집 중인지를 나타내는 상태.
  // EditingState.cancel은 "닫혀 있음"을 의미하는 특수 값.
  const [editState, setEditState] = useState<EditState>(EditingState.cancel);
  // 현재 이 레인 내부에서 카드가 드래그로 정렬 중인지 여부. Sortable의 onSortChange 콜백으로 갱신되며,
  // 정렬 중일 때 CSS 클래스(is-sorting)를 붙여 스타일을 다르게 줄 수 있다.
  const [isSorting, setIsSorting] = useState(false);

  // #18 KanbanContext에서 보드 상태 관리자(stateManager), 보드 데이터 수정 헬퍼(boardModifiers),
  // 옵시디언 뷰 인스턴스(view)를 꺼낸다. 이 세 값은 대부분의 칸반 컴포넌트가 공통으로 사용하는
  // "전역 의존성 주입" 통로다 — props로 일일이 내려주지 않고 Context로 공급된다.
  const { stateManager, boardModifiers, view } = useContext(KanbanContext);
  // 검색 중일 때 검색어/일치 항목 정보를 담은 SearchContext. 검색어가 있으면 검색 결과에
  // 포함되지 않은 레인/카드 입력 UI를 숨기는 데 사용한다(아래 `search?.query` 체크).
  const search = useContext(SearchContext);

  // 옵시디언 뷰(frontmatter)에 저장된 "board" | "list" 뷰 모드를 구독하는 훅.
  // view 객체가 값이 바뀔 때마다 리렌더를 트리거하는 커스텀 훅이다(useState와 유사한 역할).
  const boardView = view.useViewState(frontmatterKey);
  // dnd 트리 구조에서 "이 레인"의 경로(path)를 계산한다. 중첩된 엔티티(레인 > 카드) 트리에서
  // boardModifiers가 정확한 위치를 찾아 수정할 수 있도록 경로 배열을 제공한다.
  const path = useNestedEntityPath(laneIndex);
  // stateManager.useSetting(...)은 플러그인 설정 값을 구독하는 훅으로, 설정이 바뀌면 리렌더된다.
  const laneWidth = stateManager.useSetting('lane-width');
  const fullWidth = boardView === 'list' && stateManager.useSetting('full-list-lane-width');
  const insertionMethod = stateManager.useSetting('new-card-insertion-method');
  // 레인의 인라인 스타일(너비)을 계산. useMemo로 감싸 laneWidth/fullWidth/isCollapsed가
  // 바뀔 때만 재계산하고, 그 외 리렌더에서는 이전 객체 참조를 재사용해 불필요한 스타일 재계산을 막는다.
  const laneStyles = useMemo(
    () =>
      !(isCollapsed && collapseDir === 'horizontal') && (fullWidth || laneWidth)
        ? { width: fullWidth ? '100%' : `${laneWidth}px` }
        : undefined,
    [fullWidth, laneWidth, isCollapsed]
  );

  // DOM 요소 참조들. Preact의 useRef는 리렌더되어도 유지되는 가변 박스를 만든다.
  const elementRef = useRef<HTMLDivElement>(null); // 레인 카드 목록의 실제 DOM(스크롤/드롭 대상 측정용)
  const measureRef = useRef<HTMLDivElement>(null); // 레인 wrapper — 드래그 시 크기/위치 측정용
  const dragHandleRef = useRef<HTMLDivElement>(null); // 드래그를 시작시키는 손잡이(grip) 영역

  // dnd 매니저 훅: measureRef(측정 대상 요소)와 dragHandleRef(드래그를 시작할 손잡이)를 연결해서
  // "손잡이를 눌러 드래그하면 measureRef 요소 전체가 움직인다"는 동작을 구성한다.
  // 반환된 bindHandle을 LaneHeader의 grip 엘리먼트 ref로 넘겨 실제 DOM에 이벤트를 바인딩한다.
  const bindHandle = useDragHandle(measureRef, dragHandleRef);

  // 레인 데이터에서 파생되는 불리언 플래그들.
  const shouldMarkItemsComplete = !!lane.data.shouldMarkItemsComplete; // 이 레인에 들어오는 카드를 자동으로 "완료" 처리할지
  const isCompactPrepend = insertionMethod === 'prepend-compact'; // 새 카드를 맨 위에 추가 + 축약형 UI
  const shouldPrepend = isCompactPrepend || insertionMethod === 'prepend'; // 새 카드를 맨 위/맨 아래 중 어디에 추가할지

  // 레인 접기/펼치기 토글 콜백. useCallback으로 메모이즈하여 stateManager/laneIndex가
  // 바뀌지 않는 한 동일한 함수 참조를 유지한다(자식 컴포넌트의 불필요한 리렌더 방지).
  const toggleIsCollapsed = useCallback(() => {
    // stateManager.setState는 보드 전체 상태를 업데이트하는 함수형 setState 패턴.
    stateManager.setState((board) => {
      // 뷰(view)에 저장된 "list-collapse" 상태 배열을 복사해서 이 레인 인덱스의 값을 반전시킨다.
      const collapseState = [...view.getViewState('list-collapse')];
      collapseState[laneIndex] = !collapseState[laneIndex];
      // 뷰 상태(파일에 저장되지 않는 임시 UI 상태)에도 즉시 반영.
      view.setViewState('list-collapse', collapseState);
      // immutability-helper의 update()로 board 객체를 불변 방식으로 갱신해 반환.
      // (board.data.settings['list-collapse']를 새 배열로 교체)
      return update(board, {
        data: { settings: { 'list-collapse': { $set: collapseState } } },
      });
    });
  }, [stateManager, laneIndex]);

  // 새 카드를 이 레인에 추가하는 콜백. ItemForm이 사용자가 입력을 제출하면 이 함수를 호출한다.
  const addItems = useCallback(
    (items: Item[]) => {
      // boardModifiers는 KanbanContext에서 꺼낸 "보드 수정 헬퍼" 모음이다.
      // shouldPrepend 여부에 따라 prependItems(맨 앞에 삽입) 또는 appendItems(맨 뒤에 삽입)를 호출.
      // 경로는 [...path, lane.children.length - 1]로 "이 레인의 마지막 카드 위치"를 가리킨다.
      boardModifiers[shouldPrepend ? 'prependItems' : 'appendItems'](
        [...path, lane.children.length - 1],
        items.map((item) =>
          update(item, {
            data: {
              checked: {
                // Mark the item complete if we're moving into a completed lane
                $set: shouldMarkItemsComplete,
              },
              checkChar: {
                $set: shouldMarkItemsComplete ? getTaskStatusDone() : ' ',
              },
            },
          })
        )
      );

      // TODO: can we find a less brute force way to do this?
      // 카드가 추가된 직후, DOM이 갱신될 시간을 주기 위해 setTimeout(0)으로 다음 틱까지 미룬 뒤
      // 레인의 카드 목록 스크롤 컨테이너를 찾아 새로 추가된 카드 쪽(맨 위/맨 아래)으로 부드럽게 스크롤한다.
      view.getWindow().setTimeout(() => {
        const laneItems = elementRef.current?.getElementsByClassName(c('lane-items'));

        if (laneItems.length) {
          animateScrollTo([0, shouldPrepend ? 0 : laneItems[0].scrollHeight], {
            elementToScroll: laneItems[0],
            speed: 200,
            minDuration: 150,
            easing: (x: number) => {
              return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
            },
          });
        }
      });
    },
    [boardModifiers, path, lane, shouldPrepend]
  );

  // isStatic(정적 모드) 여부에 따라 실제 드래그 가능한 컴포넌트 대신 정적(non-interactive) 버전을 사용한다.
  // 예: 아카이브 보기나 인쇄용 렌더링처럼 드래그가 필요 없는 화면에서 사용.
  const DroppableComponent = isStatic ? StaticDroppable : Droppable;
  const SortableComponent = isStatic ? StaticSortable : Sortable;
  // 레인이 접혀 있고(isCollapsed) 정적 모드가 아닐 때만, 접힌 레인 자체도 카드를 받을 수 있는
  // Droppable 영역으로 만든다. 그 외에는 아무 것도 하지 않는 Fragment로 감싼다.
  const CollapsedDropArea = !isCollapsed || isStatic ? Fragment : Droppable;
  // 접힌 상태에서 Droppable에 넘길 props(드래그 데이터 정의)를 계산.
  // isCollapsed가 아니거나 static이면 빈 객체를 반환해 Fragment에 무해하게 전달되도록 한다.
  const dropAreaProps: DraggableProps = useMemo(() => {
    if (!isCollapsed || isStatic) return {} as any;
    const data = {
      id: generateInstanceId(), // 이 드롭 영역의 고유 인스턴스 id
      type: 'lane',
      accepts: [DataTypes.Item], // 카드 드롭을 허용
      acceptsSort: [DataTypes.Lane], // 레인끼리의 정렬(드래그로 순서 변경)도 허용
    };
    return {
      elementRef: elementRef,
      measureRef: measureRef,
      id: data.id,
      index: laneIndex,
      data: data,
    };
  }, [isCollapsed, laneIndex, isStatic]);

  return (
    // SortContext.Provider: 이 레인 내부 카드 목록이 어떤 기준으로 정렬되어 있는지(lane.data.sorted)를
    // 하위 트리(Items, 각 Item)에 공급한다. 정렬된 레인에서는 드래그 정렬을 다르게 처리하기 위함.
    <SortContext.Provider value={lane.data.sorted ?? null}>
      <div
        ref={measureRef}
        className={classcat([
          c('lane-wrapper'),
          {
            'is-sorting': isSorting,
            'collapse-horizontal': isCollapsed && collapseDir === 'horizontal',
            'collapse-vertical': isCollapsed && collapseDir === 'vertical',
          },
        ])}
        style={laneStyles}
      >
        <div
          data-count={lane.children.length}
          ref={elementRef}
          className={classcat([c('lane'), { 'will-prepend': shouldPrepend }])}
        >
          {/* CollapsedDropArea: 접힌 레인이면 Droppable(카드를 드롭하면 접힌 레인이 펼쳐지지 않고도
              바로 카드를 받을 수 있게), 아니면 그냥 Fragment로 자식만 렌더링 */}
          <CollapsedDropArea {...dropAreaProps}>
            {/* #64 LaneHeader — 제목, 카드 수, 접기/메뉴 버튼. bindHandle을 넘겨 grip 요소에
                드래그 시작 이벤트를 바인딩할 수 있게 한다. */}
            <LaneHeader
              bindHandle={bindHandle}
              laneIndex={laneIndex}
              lane={lane}
              setIsItemInputVisible={isCompactPrepend ? setEditState : undefined}
              isCollapsed={isCollapsed}
              toggleIsCollapsed={toggleIsCollapsed}
            />

            {/* 검색 중이 아니고, 접히지 않았고, "맨 앞에 추가" 모드일 때만 상단에 카드 입력 폼 표시 */}
            {!search?.query && !isCollapsed && shouldPrepend && (
              <ItemForm
                addItems={addItems}
                hideButton={isCompactPrepend}
                editState={editState}
                setEditState={setEditState}
              />
            )}

            {/* 접히지 않은 레인만 실제 카드 목록(Droppable + Sortable)을 렌더링 */}
            {!isCollapsed && (
              <DroppableComponent
                elementRef={elementRef}
                measureRef={measureRef}
                id={lane.id}
                index={laneIndex}
                data={lane}
              >
                {/* ScrollContainer: 카드가 많아지면 세로 스크롤이 생기는 영역이면서,
                    드래그 중 화면 밖으로 나간 포인터에 반응해 자동 스크롤을 트리거하는 역할도 겸함 */}
                <ScrollContainer
                  className={classcat([c('lane-items'), c('vertical')])}
                  id={lane.id}
                  index={laneIndex}
                  isStatic={isStatic}
                  triggerTypes={laneAccepts}
                >
                  {/* Sortable: 이 안의 자식들(Items)이 드래그로 순서를 바꿀 수 있게 만든다.
                      onSortChange로 isSorting 상태를 갱신해 정렬 중 스타일을 토글한다. */}
                  <SortableComponent onSortChange={setIsSorting} axis="vertical">
                    <Items
                      items={lane.children}
                      isStatic={isStatic}
                      shouldMarkItemsComplete={shouldMarkItemsComplete}
                    />
                    {/* 정렬 중 드래그 카드가 놓일 자리를 시각적으로 보여주는 플레이스홀더.
                        index를 lane.children.length로 주어 "목록 맨 끝"에 위치시킴 */}
                    <SortPlaceholder
                      accepts={laneAccepts}
                      index={lane.children.length}
                      isStatic={isStatic}
                    />
                  </SortableComponent>
                </ScrollContainer>
              </DroppableComponent>
            )}

            {/* "맨 뒤에 추가" 모드일 때는 카드 목록 아래에 입력 폼을 표시 */}
            {!search?.query && !isCollapsed && !shouldPrepend && (
              <ItemForm addItems={addItems} editState={editState} setEditState={setEditState} />
            )}
          </CollapsedDropArea>
        </div>
      </div>
    </SortContext.Provider>
  );
}

// memo()로 감싸 props가 얕은 비교(shallow equal)로 동일하면 리렌더를 건너뛰게 최적화.
// 레인 수가 많을 때 매 리렌더마다 모든 레인을 다시 그리지 않도록 하기 위함.
export const DraggableLane = memo(DraggableLaneRaw);

export interface LanesProps {
  lanes: Lane[];
  collapseDir: 'horizontal' | 'vertical';
}

// 보드에 속한 레인 배열 전체를 렌더링하는 컴포넌트. #17 Kanban.tsx가 이 컴포넌트를 사용해
// board.children(레인 목록)을 화면에 그린다.
function LanesRaw({ lanes, collapseDir }: LanesProps) {
  const search = useContext(SearchContext);
  // 여기서는 view만 필요하므로 KanbanContext에서 view만 구조 분해.
  const { view } = useContext(KanbanContext);
  const boardView = view.useViewState(frontmatterKey) || 'board';
  const collapseState = view.useViewState('list-collapse') || [];

  return (
    <>
      {lanes.map((lane, i) => {
        return (
          <DraggableLane
            collapseDir={collapseDir}
            // 검색 중이면서 이 레인이 검색 결과에 없거나, 사용자가 수동으로 접었으면 isCollapsed=true
            isCollapsed={(search?.query && !search.lanes.has(lane)) || !!collapseState[i]}
            // key에 boardView를 포함시켜 뷰 모드(board/list)가 바뀔 때 컴포넌트를 강제로 새로
            // 마운트시킨다(레이아웃이 크게 달라지므로 상태를 이어받지 않고 초기화하기 위함).
            key={boardView + lane.id}
            lane={lane}
            laneIndex={i}
          />
        );
      })}
    </>
  );
}

export const Lanes = memo(LanesRaw);
