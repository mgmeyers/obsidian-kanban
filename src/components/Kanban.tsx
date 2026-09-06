/**
 * ============================================================================
 * [실행 순서 #17] Kanban.tsx — 보드 최상위 Preact 컴포넌트
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * KanbanView.tsx의 getPortal()에 의해 렌더링되는 칸반 보드의 루트 컴포넌트이다.
 * 검색(search) 상태, 새 레인(lane) 추가 폼의 표시 여부, board/table/list 뷰 모드
 * 분기 등 보드 전체에 걸친 UI 상태와 이벤트 처리를 담당한다. StateManager로부터
 * 보드 데이터를 구독(useState)하고, KanbanContext/SearchContext를 통해 하위의
 * 모든 Lane/Item 컴포넌트가 필요로 하는 상태와 함수를 Provider로 전달한다.
 * 여러 개의 useEffect가 각각 독립적인 부수효과(단축키 구독, 디바운스, 아카이브
 * 정리 등)를 담당하므로 각 훅의 의존성 배열을 눈여겨보면 이해에 도움이 된다.
 * ============================================================================
 */
import animateScrollTo from 'animated-scroll-to';
import classcat from 'classcat';
import update from 'immutability-helper';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/compat';
import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';
import { useIsAnythingDragging } from 'src/dnd/components/DragOverlay';
import { ScrollContainer } from 'src/dnd/components/ScrollContainer';
import { SortPlaceholder } from 'src/dnd/components/SortPlaceholder';
import { Sortable } from 'src/dnd/components/Sortable';
import { createHTMLDndHandlers } from 'src/dnd/managers/DragManager';
import { t } from 'src/lang/helpers';

import { DndScope } from '../dnd/components/Scope';
import { getBoardModifiers } from '../helpers/boardModifiers';
import { frontmatterKey } from '../parsers/common';
import { Icon } from './Icon/Icon';
import { Lanes } from './Lane/Lane';
import { LaneForm } from './Lane/LaneForm';
import { TableView } from './Table/Table';
import { KanbanContext, SearchContext } from './context';
import { baseClassName, c, useSearchValue } from './helpers';
import { DataTypes } from './types';

// 보드 스크롤 컨테이너(ScrollContainer) 안에서 스크롤 자동 트리거 대상이 되는 드래그 타입 목록
// - 아이템이나 레인을 드래그해 화면 밖으로 나가면 이 타입들에 한해 자동 스크롤이 동작한다.
const boardScrollTiggers = [DataTypes.Item, DataTypes.Lane];
// 보드 최상위 Sortable 컨테이너가 드롭을 허용하는 타입 목록 - 최상위에는 레인(Lane)만 놓일 수 있다.
const boardAccepts = [DataTypes.Lane];

// Kanban 컴포넌트가 받는 props 타입: 현재 Obsidian 뷰 인스턴스와 이 보드의 상태 관리자
interface KanbanProps {
  stateManager: StateManager;
  view: KanbanView;
}

// frontmatter의 cssclass/cssclasses 필드(배열 또는 문자열 둘 다 허용)를 읽어
// 보드 루트 엘리먼트에 추가로 적용할 CSS 클래스 이름 배열을 만들어 반환한다.
function getCSSClass(frontmatter: Record<string, any>): string[] {
  const classes = [];
  if (Array.isArray(frontmatter.cssclass)) {
    classes.push(...frontmatter.cssclass);
  } else if (typeof frontmatter.cssclass === 'string') {
    classes.push(frontmatter.cssclass);
  }
  if (Array.isArray(frontmatter.cssclasses)) {
    classes.push(...frontmatter.cssclasses);
  } else if (typeof frontmatter.cssclasses === 'string') {
    classes.push(frontmatter.cssclasses);
  }

  return classes;
}

export const Kanban = ({ view, stateManager }: KanbanProps) => {
  // StateManager가 내부적으로 관리하는 보드 데이터(Board 트리)를 구독하는 커스텀 훅.
  // 보드 데이터가 갱신될 때마다(레인/아이템 추가·삭제 등) 이 컴포넌트가 리렌더링된다.
  const boardData = stateManager.useState();
  // dnd 시스템 전역에서 현재 무언가(아이템/레인 등)가 드래그되고 있는지 여부를 구독
  const isAnythingDragging = useIsAnythingDragging();

  // 보드 루트 div의 DOM 참조 - onNewLane에서 board 엘리먼트를 찾아 스크롤 위치를 조작하는 데 사용
  const rootRef = useRef<HTMLDivElement>(null);
  // 검색 입력창(input) DOM 참조 - 검색 모드 진입 시 자동 포커스를 주기 위해 사용
  const searchRef = useRef<HTMLInputElement>(null);
  // 사용자가 실시간으로 타이핑 중인(디바운스 적용 전) 검색어 상태
  const [searchQuery, setSearchQuery] = useState<string>('');
  // 250ms 디바운스가 적용되어 실제 레인/아이템 필터링에 쓰이는 검색어 상태
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  // 검색 입력창 UI가 열려 있는지 여부
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // 새 레인 추가 폼의 표시 여부. 최초 렌더 시 보드에 레인이 하나도 없다면
  // 곧바로 폼을 보여주도록 초기값을 boardData?.children.length === 0 조건으로 설정한다.
  const [isLaneFormVisible, setIsLaneFormVisible] = useState<boolean>(
    boardData?.children.length === 0
  );

  const filePath = stateManager.file.path; // 이 보드가 저장된 마크다운 파일의 경로
  const maxArchiveLength = stateManager.useSetting('max-archive-size'); // "아카이브 최대 보관 개수" 설정값 구독
  const dateColors = stateManager.useSetting('date-colors'); // "날짜 색상 규칙" 설정값 구독
  const tagColors = stateManager.useSetting('tag-colors'); // "태그 색상 규칙" 설정값 구독
  const boardView = view.useViewState(frontmatterKey); // frontmatter에 저장된 보드 뷰 모드('board' | 'table' | 'list') 구독

  // 레인 추가 폼을 닫는 콜백. 단, 레인이 하나도 없는 상태에서는 강제로 폼을 계속 보여줘야 하므로
  // (children.length > 0일 때만) 실제로 닫는다.
  // 의존성 배열: [boardData?.children.length] - 레인 개수가 바뀔 때만 함수를 새로 생성
  const closeLaneForm = useCallback(() => {
    if (boardData?.children.length > 0) {
      setIsLaneFormVisible(false);
    }
  }, [boardData?.children.length]);

  // 레인이 모두 삭제되어 0개가 되었고 보드에 에러가 없는 경우, 자동으로 레인 추가 폼을 다시 표시한다.
  // 의존성 배열: [boardData?.children.length, stateManager] - 레인 개수 또는 stateManager 인스턴스가 바뀔 때 재실행
  useEffect(() => {
    if (boardData?.children.length === 0 && !stateManager.hasError()) {
      setIsLaneFormVisible(true);
    }
  }, [boardData?.children.length, stateManager]);

  // 새 레인이 추가된 직후 호출되는 콜백. 다음 이벤트 루프 틱(setTimeout)에서 board 엘리먼트의
  // scrollWidth를 읽어 가로 스크롤을 맨 끝(새 레인이 보이는 위치)까지 부드럽게 이동시킨다.
  // 의존성 배열이 빈 배열([])이므로 컴포넌트 생명주기 동안 함수가 한 번만 생성된다.
  const onNewLane = useCallback(() => {
    rootRef.current?.win.setTimeout(() => {
      const board = rootRef.current?.getElementsByClassName(c('board'));

      if (board?.length) {
        animateScrollTo([board[0].scrollWidth, 0], {
          elementToScroll: board[0],
          speed: 300,
          minDuration: 150,
          easing: (x: number) => {
            // ease-out 형태의 커스텀 easing 함수. x가 정확히 1일 때만 1을 반환해 끝에서 값이 튀지 않게 한다.
            return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
          },
        });
      }
    });
  }, []);

  // Obsidian 커맨드(단축키)로 트리거되는 검색 열기 이벤트와, 다른 곳에서 발생시키는
  // "레인 추가 폼 표시" 이벤트를 view의 이벤트 emitter에 구독한다.
  // 의존성 배열: [view] - view 인스턴스가 바뀔 때만 재구독(클린업에서 기존 리스너 해제)
  useEffect(() => {
    const onSearchHotkey = (data: { commandId: string; data: string }) => {
      if (data.commandId === 'editor:open-search') {
        if (typeof data.data === 'string') {
          // 특정 검색어 문자열과 함께 호출된 경우 - 검색어를 즉시 세팅하고 검색 모드를 켠다.
          setIsSearching(true);
          setSearchQuery(data.data);
          setDebouncedSearchQuery(data.data);
        } else {
          // 검색어 없이 단축키만 호출된 경우 - 검색창 표시 여부를 토글한다.
          setIsSearching((val) => !val);
        }
      }
    };

    const showLaneForm = () => {
      setIsLaneFormVisible(true);
    };

    view.emitter.on('hotkey', onSearchHotkey);
    view.emitter.on('showLaneForm', showLaneForm);

    // 클린업 함수: 컴포넌트 언마운트 또는 view 변경 시 이벤트 리스너를 반드시 해제하여 메모리 누수를 방지
    return () => {
      view.emitter.off('hotkey', onSearchHotkey);
      view.emitter.off('showLaneForm', showLaneForm);
    };
  }, [view]);

  // 검색 모드가 켜지는 순간(isSearching이 true가 될 때) 검색 입력창에 자동으로 포커스를 준다.
  // 의존성 배열: [isSearching]
  useEffect(() => {
    if (isSearching) {
      searchRef.current?.focus();
    }
  }, [isSearching]);

  // 검색어 입력에 250ms 디바운스를 적용하는 이펙트.
  // 사용자가 타이핑할 때마다 이전 타이머를 취소(클린업 함수)하고 새 타이머를 설정하여,
  // 입력이 250ms 동안 멈췄을 때만 실제 필터링에 쓰이는 debouncedSearchQuery를 갱신한다.
  // (레인/아이템이 많을 때 매 타이핑마다 필터링을 다시 계산하는 비용을 줄이기 위한 성능 최적화)
  // 의존성 배열: [searchQuery, view] - 검색어 또는 view가 바뀔 때마다 재실행
  useEffect(() => {
    const win = view.getWindow();
    const trimmed = searchQuery.trim();
    let id: number;

    if (trimmed) {
      id = win.setTimeout(() => {
        setDebouncedSearchQuery(trimmed);
      }, 250);
    } else {
      // 검색어가 비어있으면 디바운스 없이 즉시 초기화한다.
      setDebouncedSearchQuery('');
    }

    return () => {
      win.clearTimeout(id);
    };
  }, [searchQuery, view]);

  // 아카이브에 쌓인 아이템 개수가 설정된 최대 개수(max-archive-size)를 초과하면
  // 오래된 항목부터 잘라내어 개수를 제한 이내로 유지하는 이펙트.
  // maxArchiveLength가 -1이거나 미설정이면 "제한 없음"을 의미하므로 아무 작업도 하지 않는다.
  // 의존성 배열: [boardData?.data.archive.length, maxArchiveLength]
  useEffect(() => {
    if (maxArchiveLength === undefined || maxArchiveLength === -1) {
      return;
    }

    if (typeof maxArchiveLength === 'number' && boardData?.data.archive.length > maxArchiveLength) {
      // immutability-helper의 update()를 사용해 불변성을 유지하면서 배열의 뒤쪽 maxArchiveLength개만 남긴다.
      stateManager.setState((board) =>
        update(board, {
          data: {
            archive: {
              $set: board.data.archive.slice(maxArchiveLength * -1),
            },
          },
        })
      );
    }
  }, [boardData?.data.archive.length, maxArchiveLength]);

  // 보드 조작 함수 모음(레인/아이템 추가·삭제·이동 등)을 생성하는 메모이제이션.
  // view와 stateManager가 동일하게 유지되는 한 같은 객체 참조를 반환하여
  // 이 값을 사용하는 하위 컴포넌트가 불필요하게 리렌더링되지 않도록 한다.
  // 의존성 배열: [stateManager, view]
  const boardModifiers = useMemo(() => {
    return getBoardModifiers(view, stateManager);
  }, [stateManager, view]);

  // KanbanContext.Provider에 내려줄 값 객체를 메모이제이션.
  // 주의: dateColors/tagColors는 반환 객체에 직접 포함되지 않지만 의존성 배열에는 들어있다.
  // 즉 이 값들이 바뀌면 (실제로는 동일한 view/stateManager/boardModifiers/filePath라도)
  // 컨텍스트 값 객체 자체가 새로 생성되어 색상 설정 변경이 하위 트리에도 전파(리렌더링)되게 한다.
  const kanbanContext = useMemo(() => {
    return {
      view,
      stateManager,
      boardModifiers,
      filePath,
    };
  }, [view, stateManager, boardModifiers, filePath, dateColors, tagColors]);

  // 파일(이미지 등)을 브라우저의 기본 드래그&드롭 방식으로 보드 위에 끌어다 놓았을 때 처리할
  // 이벤트 핸들러 모음 (dnd 라이브러리의 자체 드래그 시스템과는 별개의 HTML5 네이티브 드래그 처리)
  const html5DragHandlers = createHTMLDndHandlers(stateManager);

  // 보드 데이터가 아직 로드되지 않은 경우 - 로딩 스피너만 표시하고 조기 반환(early return)
  if (boardData === null || boardData === undefined)
    return (
      <div className={c('loading')}>
        <div className="sk-pulse"></div>
      </div>
    );

  // 보드(마크다운) 파싱 중 에러가 발생한 경우 - 에러 설명과 스택트레이스를 나열하고 조기 반환
  if (boardData.data.errors.length > 0) {
    return (
      <div>
        <div>Error:</div>
        {boardData.data.errors.map((e, i) => {
          return (
            <div key={i}>
              <div>{e.description}</div>
              <pre>{e.stack}</pre>
            </div>
          );
        })}
      </div>
    );
  }

  // list 뷰 모드일 때는 레인을 세로(vertical)로, 그 외(board 모드)는 가로(horizontal)로 정렬한다.
  const axis = boardView === 'list' ? 'vertical' : 'horizontal';
  // 디바운스된 검색어를 기준으로 매칭되는 레인/아이템 집합과 검색 갱신 함수를 계산하는 훅
  // (구현은 helpers.ts의 useSearchValue 참고 - 내부적으로 useMemo로 메모이제이션됨)
  const searchValue = useSearchValue(
    boardData,
    debouncedSearchQuery,
    setSearchQuery,
    setDebouncedSearchQuery,
    setIsSearching
  );

  return (
    // DndScope: 이 보드 전용 드래그앤드롭 스코프(범위)를 생성한다. view.id로 다른 보드의 dnd 상태와 구분된다.
    <DndScope id={view.id}>
      {/* KanbanContext.Provider: 하위의 모든 컴포넌트가 useContext(KanbanContext)로
          view/stateManager/boardModifiers/filePath에 접근할 수 있게 한다. */}
      <KanbanContext.Provider value={kanbanContext}>
        {/* SearchContext.Provider: 하위 Lane/Item 컴포넌트가 검색 매칭 여부를 조회할 수 있게 한다. */}
        <SearchContext.Provider value={searchValue}>
          <div
            ref={rootRef}
            className={classcat([
              baseClassName,
              {
                'something-is-dragging': isAnythingDragging,
              },
              ...getCSSClass(boardData.data.frontmatter),
            ])}
            {...html5DragHandlers}
          >
            {/* 레인이 하나도 없거나 명시적으로 폼이 열려있을 때 새 레인 추가 폼을 표시 */}
            {(isLaneFormVisible || boardData.children.length === 0) && (
              <LaneForm onNewLane={onNewLane} closeLaneForm={closeLaneForm} />
            )}
            {/* 검색 모드일 때만 검색 입력창과 취소 버튼을 표시 */}
            {isSearching && (
              <div className={c('search-wrapper')}>
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery((e.target as HTMLInputElement).value);
                  }}
                  onKeyDown={(e) => {
                    // ESC 키 입력 시 검색을 완전히 초기화하고 검색 모드를 종료
                    if (e.key === 'Escape') {
                      setSearchQuery('');
                      setDebouncedSearchQuery('');
                      (e.target as HTMLInputElement).blur();
                      setIsSearching(false);
                    }
                  }}
                  type="text"
                  className={c('filter-input')}
                  placeholder={t('Search...')}
                />
                <a
                  className={`${c('search-cancel-button')} clickable-icon`}
                  onClick={() => {
                    // 취소(X) 버튼 클릭 시에도 검색을 완전히 초기화
                    setSearchQuery('');
                    setDebouncedSearchQuery('');
                    setIsSearching(false);
                  }}
                  aria-label={t('Cancel')}
                >
                  <Icon name="lucide-x" />
                </a>
              </div>
            )}
            {/* 보드 뷰 모드에 따라 테이블 뷰 또는 (board/list) 레인 스크롤 컨테이너로 분기 렌더링 */}
            {boardView === 'table' ? (
              <TableView boardData={boardData} stateManager={stateManager} />
            ) : (
              <ScrollContainer
                id={view.id}
                className={classcat([
                  c('board'),
                  {
                    [c('horizontal')]: boardView !== 'list',
                    [c('vertical')]: boardView === 'list',
                    'is-adding-lane': isLaneFormVisible,
                  },
                ])}
                triggerTypes={boardScrollTiggers}
              >
                <div>
                  {/* Sortable: 레인들을 axis 방향으로 드래그하여 순서를 바꿀 수 있게 감싸는 컨테이너 */}
                  <Sortable axis={axis}>
                    <Lanes lanes={boardData.children} collapseDir={axis} />
                    {/* 레인 목록의 맨 끝에 위치하는 드롭 플레이스홀더 - 레인을 맨 뒤로 옮길 때 드롭 대상이 됨 */}
                    <SortPlaceholder
                      accepts={boardAccepts}
                      className={c('lane-placeholder')}
                      index={boardData.children.length}
                    />
                  </Sortable>
                </div>
              </ScrollContainer>
            )}
          </div>
        </SearchContext.Provider>
      </KanbanContext.Provider>
    </DndScope>
  );
};
