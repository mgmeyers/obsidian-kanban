/**
 * ============================================================================
 * [실행 순서 #69] Item.tsx — 칸반 보드의 개별 카드(Item)를 렌더링하는 드래그 가능 컴포넌트
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * 이 파일은 칸반 보드에서 카드 하나를 화면에 그리는 컴포넌트들을 모아 놓았다.
 * DraggableItem은 드래그 앤 드롭이 가능하도록 카드를 감싸는 바깥 껍데기이고,
 * 그 안에서 실제 내용을 그리는 ItemInner는 더블클릭으로 편집 모드에 진입하거나
 * 우클릭으로 컨텍스트 메뉴를 여는 등 사용자 상호작용을 처리한다. Items는 여러
 * 카드를 목록으로 렌더링하면서 검색어에 맞지 않는 카드는 걸러내는 역할도 한다.
 * 부모 컴포넌트인 Lane.tsx(#63)가 이 Items/DraggableItem을 사용해 레인(컬럼)
 * 안에 카드 목록을 구성한다.
 * ============================================================================
 */
import classcat from 'classcat';
import {
  JSX,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/compat';
// Droppable: 드래그된 아이템을 "받을 수 있는" 영역으로 만들어주는 래퍼 컴포넌트
// useNestedEntityPath: 보드 > 레인 > 아이템으로 이어지는 트리 구조에서 현재 위치(경로)를 알려주는 훅
import { Droppable, useNestedEntityPath } from 'src/dnd/components/Droppable';
import { DndManagerContext } from 'src/dnd/components/context';
import { useDragHandle } from 'src/dnd/managers/DragManager';
import { frontmatterKey } from 'src/parsers/common';

import { KanbanContext, SearchContext } from '../context';
import { c } from '../helpers';
import { EditState, EditingState, Item, isEditing } from '../types';
import { ItemCheckbox } from './ItemCheckbox';
import { ItemContent } from './ItemContent';
import { useItemMenu } from './ItemMenu';
import { ItemMenuButton } from './ItemMenuButton';
import { ItemMetadata } from './MetadataTable';
import { getItemClassModifiers } from './helpers';

// DraggableItem에 전달되는 props. itemIndex는 드래그 앤 드롭 시 순서 계산에 필요하다.
export interface DraggableItemProps {
  item: Item;
  itemIndex: number;
  isStatic?: boolean; // true면 드래그 미리보기(ghost) 등 정적인 용도로만 렌더링됨
  shouldMarkItemsComplete?: boolean; // 레인 설정에 따라 카드를 자동으로 "완료" 처리할지 여부
}

// ItemInner(카드 실제 내용)에 전달되는 props
export interface ItemInnerProps {
  item: Item;
  isStatic?: boolean;
  shouldMarkItemsComplete?: boolean;
  isMatch?: boolean; // 현재 검색어와 일치하는 카드인지 여부
  searchQuery?: string;
}

// memo로 감싸 props가 바뀌지 않으면 리렌더링을 건너뛰어 성능을 최적화한다.
// (칸반 보드는 카드 수가 많을 수 있어 불필요한 재렌더링 방지가 중요하다)
const ItemInner = memo(function ItemInner({
  item,
  shouldMarkItemsComplete,
  isMatch,
  searchQuery,
  isStatic,
}: ItemInnerProps) {
  // KanbanContext에서 stateManager(보드 데이터/설정 관리자)와
  // boardModifiers(보드 데이터를 변경하는 함수 모음)를 꺼내온다.
  // 이 두 값은 이 파일 전체에서 "보드 상태를 읽고 쓰는" 통로로 반복해서 쓰인다.
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  // editState: 이 카드가 지금 "보기 모드"인지 "편집 모드"인지, 편집 모드라면 어느 좌표에서
  // 시작됐는지를 담는 상태. 초기값 EditingState.cancel은 "편집 중이 아님"을 의미한다.
  const [editState, setEditState] = useState<EditState>(EditingState.cancel);

  // 드래그 앤 드롭 전체를 관장하는 매니저 (드래그 이벤트를 구독하기 위해 사용)
  const dndManager = useContext(DndManagerContext);

  // 다른 카드/레인을 드래그하기 시작하면, 지금 편집 중이던 카드는 강제로 편집을 취소한다.
  // (드래그 중에 인라인 에디터가 열려 있으면 레이아웃이 꼬이거나 포커스가 충돌하기 때문)
  useEffect(() => {
    const handler = () => {
      if (isEditing(editState)) setEditState(EditingState.cancel);
    };

    dndManager.dragManager.emitter.on('dragStart', handler);
    // 클린업 함수: 컴포넌트가 사라지거나 의존성이 바뀌기 전에 이벤트 리스너를 해제한다.
    return () => {
      dndManager.dragManager.emitter.off('dragStart', handler);
    };
  }, [dndManager, editState]);

  // 카드 데이터에 forceEditMode 플래그가 설정되어 있으면(예: 새로 만든 카드를 바로
  // 편집 상태로 열어주고 싶을 때) 좌표 {0,0}으로 편집 모드를 강제 진입시킨다.
  useEffect(() => {
    if (item.data.forceEditMode) {
      setEditState({ x: 0, y: 0 });
    }
  }, [item.data.forceEditMode]);

  // 현재 카드가 보드 트리에서 어디에 위치하는지(레인 인덱스, 아이템 인덱스 등)를 나타내는 경로
  const path = useNestedEntityPath();

  // 우클릭(또는 메뉴 버튼) 시 뜨는 카드 컨텍스트 메뉴를 준비하는 훅.
  // 메뉴 항목들이 setEditState를 호출할 수 있도록 넘겨준다(예: "편집" 메뉴 클릭 시 편집 모드 진입).
  const showItemMenu = useItemMenu({
    boardModifiers,
    item,
    setEditState: setEditState,
    stateManager,
    path,
  });

  // useCallback: 매 렌더링마다 새 함수를 만들지 않고, 의존성(showItemMenu, editState)이
  // 바뀔 때만 함수를 새로 생성한다. (자식에게 props로 내려줄 때 불필요한 리렌더링 방지)
  const onContextMenu: JSX.MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      // 편집 중일 때는 우클릭 메뉴 대신 브라우저/에디터 기본 동작(텍스트 선택 등)을 유지
      if (isEditing(editState)) return;
      if (
        e.targetNode.instanceOf(HTMLAnchorElement) &&
        (e.targetNode.hasClass('internal-link') || e.targetNode.hasClass('external-link'))
      ) {
        // 링크 위에서 우클릭했다면 카드 메뉴 대신 링크 자체의 메뉴/동작을 존중하고 그냥 반환
        return;
      }
      showItemMenu(e);
    },
    [showItemMenu, editState]
  );

  // 카드 본문을 더블클릭하면 클릭한 좌표({x, y})를 편집 시작 위치로 저장하며 편집 모드로 전환
  const onDoubleClick: JSX.MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => setEditState({ x: e.clientX, y: e.clientY }),
    [setEditState]
  );

  // useMemo: editState가 바뀔 때만 재계산. 편집 중일 때는 이 요소를 드래그 대상에서
  // 제외하기 위한 data-ignore-drag 속성을 만들고, 아니면 빈 객체(속성 없음)를 반환한다.
  // 아래 JSX에서 {...ignoreAttr}로 스프레드하여 조건부로 속성을 붙이는 패턴이다.
  const ignoreAttr = useMemo(() => {
    if (isEditing(editState)) {
      return {
        'data-ignore-drag': true,
      };
    }

    return {};
  }, [editState]);

  return (
    <div
      // eslint-disable-next-line react/no-unknown-property
      onDblClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={c('item-content-wrapper')}
      {...ignoreAttr}
    >
      <div className={c('item-title-wrapper')} {...ignoreAttr}>
        {/* 카드 왼쪽의 완료 체크박스 */}
        <ItemCheckbox
          boardModifiers={boardModifiers}
          item={item}
          path={path}
          shouldMarkItemsComplete={shouldMarkItemsComplete}
          stateManager={stateManager}
        />
        {/* 카드 본문(마크다운 렌더링/편집기 전환)을 담당하는 컴포넌트 (#70 ItemContent.tsx) */}
        <ItemContent
          item={item}
          searchQuery={isMatch ? searchQuery : undefined}
          setEditState={setEditState}
          editState={editState}
          isStatic={isStatic}
        />
        {/* 카드 우측 상단의 "..." 메뉴 버튼 */}
        <ItemMenuButton editState={editState} setEditState={setEditState} showMenu={showItemMenu} />
      </div>
      {/* 태그/날짜 등 메타데이터를 표시하는 테이블 영역 */}
      <ItemMetadata searchQuery={isMatch ? searchQuery : undefined} item={item} />
    </div>
  );
});

// 실제로 드래그 가능한 카드 전체(측정용 래퍼 + 드롭 가능 영역 + 카드 내용)를 구성하는 컴포넌트
export const DraggableItem = memo(function DraggableItem(props: DraggableItemProps) {
  // elementRef: 카드의 실제 바깥 div (드롭 대상 크기/위치 측정용)
  // measureRef: 드래그 핸들 바인딩 및 크기 측정에 쓰이는 내부 래퍼
  const elementRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const search = useContext(SearchContext);

  // itemIndex는 별도로 분리해서 쓰고, 나머지 props는 그대로 ItemInner에 전달한다.
  const { itemIndex, ...innerProps } = props;

  // 이 요소를 드래그 시작 핸들로 등록한다 (요소 어디를 잡아도 드래그가 시작되도록)
  const bindHandle = useDragHandle(measureRef, measureRef);

  // 검색어가 있으면 카드 제목 검색용 문자열(titleSearch)에 검색어가 포함되는지로 매치 여부 판단
  const isMatch = search?.query ? innerProps.item.data.titleSearch.includes(search.query) : false;
  // 카드 상태(완료 여부 등)에 따라 추가로 붙일 CSS 클래스 목록
  const classModifiers: string[] = getItemClassModifiers(innerProps.item);

  return (
    <div
      ref={(el) => {
        // 하나의 DOM 엘리먼트를 measureRef에도 저장하고, 동시에 드래그 핸들로도 바인딩한다.
        measureRef.current = el;
        bindHandle(el);
      }}
      className={c('item-wrapper')}
    >
      <div ref={elementRef} className={classcat([c('item'), ...classModifiers])}>
        {/*
          삼항 연산자로 두 가지 렌더링 경로를 선택한다:
          - isStatic === true  : 드래그 중 보여지는 정적 미리보기 등에서는 Droppable로 감싸지 않고
                                  ItemInner만 그대로 렌더링 (드롭 대상이 될 필요가 없으므로)
          - isStatic === false : 실제 보드에 놓인 카드는 Droppable로 감싸서 다른 카드가
                                  이 위치에 드롭될 수 있도록 한다
        */}
        {props.isStatic ? (
          <ItemInner
            {...innerProps}
            isMatch={isMatch}
            searchQuery={search?.query}
            isStatic={true}
          />
        ) : (
          <Droppable
            elementRef={elementRef}
            measureRef={measureRef}
            id={props.item.id}
            index={itemIndex}
            data={props.item}
          >
            <ItemInner {...innerProps} isMatch={isMatch} searchQuery={search?.query} />
          </Droppable>
        )}
      </div>
    </div>
  );
});

interface ItemsProps {
  isStatic?: boolean;
  items: Item[];
  shouldMarkItemsComplete: boolean;
}

// 레인 하나에 속한 카드 배열 전체를 렌더링하는 컴포넌트. Lane.tsx가 이 컴포넌트를 사용한다.
export const Items = memo(function Items({ isStatic, items, shouldMarkItemsComplete }: ItemsProps) {
  const search = useContext(SearchContext);
  const { view } = useContext(KanbanContext);
  // frontmatter(문서 상단 메타데이터)가 바뀔 때마다 값이 갱신되는 상태.
  // 아래 key에 사용되어, frontmatter가 바뀌면 카드들을 강제로 다시 마운트시킨다
  // (마크다운 렌더러 내부 캐시 등을 초기화하기 위한 트릭).
  const boardView = view.useViewState(frontmatterKey);

  return (
    <>
      {items.map((item, i) => {
        // 조건부 렌더링: 검색어가 있고(search?.query) 그 검색 결과 집합(search.items)에
        // 이 카드가 포함되어 있지 않다면 null을 반환해 화면에서 숨긴다.
        // 그렇지 않으면(검색 중이 아니거나, 검색 결과에 포함된 경우) DraggableItem을 렌더링한다.
        return search?.query && !search.items.has(item) ? null : (
          <DraggableItem
            // key에 boardView(=frontmatter 상태)와 item.id를 합쳐 사용:
            // item.id만으로는 frontmatter 변경 시 리렌더링이 안 될 수 있어 강제 리마운트를 유도
            key={boardView + item.id}
            item={item}
            itemIndex={i}
            shouldMarkItemsComplete={shouldMarkItemsComplete}
            isStatic={isStatic}
          />
        );
      })}
    </>
  );
});
