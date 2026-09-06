/**
 * ============================================================================
 * [실행 순서 #81] src/components/Table/Cells.tsx — 테이블 셀(칸) 렌더링 컴포넌트 모음
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * 표(table) 보기 모드에서 각 열(column)의 "셀 콘텐츠"를 실제로 그려주는 Preact
 * 컴포넌트들을 모아 둔 파일입니다. helpers.tsx의 columnHelper.accessor(...) 안
 * cell 옵션에서 이 컴포넌트들을 사용합니다. DateCell은 날짜/상대 날짜 표시,
 * ItemCell은 카드 제목(체크박스+본문, 칸반 보기와 동일한 편집 UX)을, LaneCell은
 * 카드가 속한 리스트 이름과 "다른 리스트로 이동" 메뉴를 담당합니다. 세 컴포넌트
 * 모두 memo로 감싸 불필요한 리렌더링을 줄이고, 일부는 커스텀 비교 함수까지 사용합니다.
 * ============================================================================
 */
import classcat from 'classcat';
import { Menu } from 'obsidian';
import { JSX, memo, useCallback, useContext, useState } from 'preact/compat';
import isEqual from 'react-fast-compare';
import { ExplicitPathContext } from 'src/dnd/components/context';
import { moveEntity } from 'src/dnd/util/data';

import { Icon } from '../Icon/Icon';
import { DateAndTime, RelativeDate } from '../Item/DateAndTime';
import { ItemCheckbox } from '../Item/ItemCheckbox';
import { ItemContent, useDatePickers } from '../Item/ItemContent';
import { useItemMenu } from '../Item/ItemMenu';
import { MarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer';
import { KanbanContext, SearchContext } from '../context';
import { c, useGetDateColorFn } from '../helpers';
import { EditState, Item, Lane, isEditing } from '../types';
import { TableItem } from './types';

// 'date' 컬럼의 셀. 카드에 날짜 메타데이터가 있을 때 상대 날짜("3일 전")와/또는
// 실제 날짜+시간 편집 UI를 보여준다. memo로 감싸 item 참조가 바뀌지 않으면 재렌더링을 건너뛴다.
export const DateCell = memo(function DateCell({
  item,
  hideDateDisplay,
  shouldShowRelativeDate,
}: {
  item: TableItem;
  hideDateDisplay: boolean;
  shouldShowRelativeDate: boolean;
}) {
  const { stateManager, filePath } = useContext(KanbanContext);
  // useDatePickers: 날짜/시간 클릭 시 여는 데이트피커 핸들러들을 만들어주는 커스텀 훅
  const { onEditDate, onEditTime } = useDatePickers(item.item, item.path);
  // 설정에 정의된 "날짜별 색상 규칙"을 적용하기 위한 헬퍼
  const getDateColor = useGetDateColorFn(stateManager);

  return (
    <>
      {/* 설정에서 "상대 날짜 표시"가 켜져 있으면 상대 날짜(RelativeDate)를 함께 보여준다 */}
      {shouldShowRelativeDate ? (
        <RelativeDate item={item.item} stateManager={stateManager} />
      ) : null}
      {/* hideDateDisplay가 false일 때만(즉 '날짜를 본문에서 이 컬럼으로 옮김' 설정일 때만)
          실제 날짜+시간 표시/편집 UI를 그린다 */}
      {!hideDateDisplay ? (
        <DateAndTime
          item={item.item}
          stateManager={stateManager}
          filePath={filePath ?? ''}
          onEditDate={onEditDate}
          onEditTime={onEditTime}
          getDateColor={getDateColor}
        />
      ) : null}
    </>
  );
});

// 'card' 컬럼의 셀. 칸반 보드의 카드와 동일하게 체크박스 + 마크다운 본문(ItemContent)을
// 표시하며, 우클릭 컨텍스트 메뉴와 더블클릭 편집 진입을 지원한다.
// 두 번째 인자로 커스텀 비교 함수를 넘겨 memo의 얕은 비교 대신 깊은 비교(isEqual)를 수행 —
// item/path가 구조적으로 동일하면 리렌더링을 생략해 대량의 카드가 있어도 성능을 유지한다.
export const ItemCell = memo(
  function ItemCell({ item, lane, path }: { item: Item; lane: Lane; path: number[] }) {
    const { stateManager, boardModifiers } = useContext(KanbanContext);
    const search = useContext(SearchContext);
    // 이 카드가 현재 편집 중인지(그리고 어떤 방식으로 편집 중인지)를 담는 로컬 상태
    const [editState, setEditState] = useState<EditState>(null);
    const shouldMarkItemsComplete = !!lane.data.shouldMarkItemsComplete;

    // 우클릭 시 보여줄 카드 컨텍스트 메뉴(삭제/아카이브/날짜 지정 등)를 만드는 훅
    const showItemMenu = useItemMenu({
      boardModifiers,
      item,
      setEditState,
      stateManager,
      path,
    });

    // 우클릭 핸들러: 이미 편집 중이거나, 클릭 대상이 링크(내부/외부 링크)면
    // 메뉴를 띄우지 않고 기본 동작(링크 열기 등)에 맡긴다.
    const onContextMenu: JSX.MouseEventHandler<HTMLDivElement> = useCallback(
      (e) => {
        if (isEditing(editState)) return;
        if (
          e.targetNode.instanceOf(HTMLAnchorElement) &&
          (e.targetNode.hasClass('internal-link') || e.targetNode.hasClass('external-link'))
        ) {
          return;
        }

        showItemMenu(e);
      },
      [showItemMenu, editState]
    );

    // 더블클릭하면 클릭 좌표를 기준으로 인라인 편집 상태로 전환
    const onDoubleClick: JSX.MouseEventHandler<HTMLDivElement> = useCallback((e) => {
      setEditState({ x: e.clientX, y: e.clientY });
    }, []);

    return (
      // ExplicitPathContext: 하위 컴포넌트(체크박스, 메뉴 등)가 "이 카드가 트리의 어디에
      // 있는지"를 알 수 있도록 path를 컨텍스트로 내려준다 (드래그앤드롭 없이도 위치 참조 가능)
      <ExplicitPathContext.Provider value={path}>
        <div
          onContextMenu={onContextMenu}
          // eslint-disable-next-line react/no-unknown-property
          onDblClick={onDoubleClick}
          className={c('item-content-wrapper')}
        >
          <div className={c('item-title-wrapper')}>
            <ItemCheckbox
              boardModifiers={boardModifiers}
              item={item}
              path={path}
              shouldMarkItemsComplete={shouldMarkItemsComplete}
              stateManager={stateManager}
            />
            {/* showMetadata={false}: 표 모드에서는 메타데이터(날짜/태그 등)를
                본문 안이 아니라 별도 컬럼(DateCell 등)으로 분리해서 보여주기 때문에
                ItemContent 자체는 제목/본문만 렌더링하도록 지시한다 */}
            <ItemContent
              editState={editState}
              item={item}
              setEditState={setEditState}
              showMetadata={false}
              searchQuery={search?.query}
              isStatic={false}
            />
          </div>
        </div>
      </ExplicitPathContext.Provider>
    );
  },
  // memo의 커스텀 비교 함수: prev/next props가 "값 기준으로" 같으면 true를 반환해
  // 리렌더링을 건너뛴다. shouldMarkItemsComplete은 원시값 비교, item/path는
  // react-fast-compare의 isEqual로 깊은 비교(참조가 달라도 내용이 같으면 동일하다고 간주)한다.
  (prev, next) => {
    return (
      prev.lane.data.shouldMarkItemsComplete === next.lane.data.shouldMarkItemsComplete &&
      isEqual(prev.item, next.item) &&
      isEqual(prev.path, next.path)
    );
  }
);

// 'lane' 컬럼의 셀. 이 카드가 속한 리스트(레인)의 제목을 마크다운으로 렌더링하고,
// 옆의 아이콘을 클릭하면 "다른 리스트로 이동" 메뉴(Obsidian Menu)를 띄운다.
export const LaneCell = memo(function LaneCell({ lane, path }: { lane: Lane; path: number[] }) {
  const { stateManager } = useContext(KanbanContext);
  const search = useContext(SearchContext);
  return (
    <div className={c('cell-flex-wrapper')}>
      {/* 리스트 제목도 마크다운 문법(굵게, 링크 등)을 지원하므로 공용 MarkdownRenderer 사용 */}
      <MarkdownRenderer searchQuery={search?.query} markdownString={lane.data.title} />
      <div
        onClick={(e) => {
          // Obsidian 네이티브 Menu API로 "리스트 이동" 드롭다운을 구성한다
          const menu = new Menu();
          const lanes = stateManager.state.children;

          for (let i = 0, len = lanes.length; i < len; i++) {
            const l = lanes[i];
            menu.addItem((item) =>
              item
                .setChecked(lane === l) // 현재 속한 리스트에는 체크 표시
                .setTitle(l.data.title)
                .onClick(() => {
                  if (lane === l) return; // 같은 리스트를 선택하면 아무 것도 하지 않음
                  // moveEntity로 보드 트리를 갱신: 현재 path의 카드를
                  // i번째 레인의 맨 끝(target.children.length)으로 옮긴다
                  stateManager.setState((boardData) => {
                    const target = boardData.children[i];
                    return moveEntity(boardData, path, [i, target.children.length]);
                  });
                })
            );
          }

          menu.showAtMouseEvent(e);
        }}
        className={classcat(['clickable-icon', c('icon-wrapper'), c('lane-menu')])}
      >
        <Icon name="lucide-square-kanban" />
      </div>
    </div>
  );
});
