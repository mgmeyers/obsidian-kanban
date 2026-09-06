/**
 * ============================================================================
 * [실행 순서 #80] src/components/Table/Table.tsx — '표(table)' 보기 모드 메인 컴포넌트
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * Kanban.tsx가 boardView === 'table'일 때 렌더링하는 최상위 컴포넌트입니다.
 * helpers.tsx의 useTableColumns()로 얻은 데이터/컬럼을 @tanstack/react-table의
 * useReactTable()에 주입해 헤더 그룹(getHeaderGroups)과 행 모델(getRowModel)을
 * 얻고, 그것을 <table>/<thead>/<tbody> DOM으로 그립니다. 컬럼 리사이즈(드래그로 폭
 * 조절), 정렬 토글, 전역 퍼지 필터가 모두 이 컴포넌트에서 react-table의 기능을 통해
 * 연결됩니다. 또한 표 안의 마크다운 프리뷰(카드/리스트 셀)를 가상화(화면 밖이면
 * 렌더링 건너뛰기)하기 위한 IntersectionObserver 컨텍스트도 여기서 만들어 하위
 * MarkdownRenderer들에 제공합니다.
 * ============================================================================
 */
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import classcat from 'classcat';
import update from 'immutability-helper';
import { useEffect, useMemo, useRef } from 'preact/compat';
import { IntersectionObserverHandler } from 'src/dnd/managers/ScrollManager';

import { StateManager } from '../../StateManager';
import { Icon } from '../Icon/Icon';
import { IntersectionObserverContext } from '../context';
import { c } from '../helpers';
import { Board } from '../types';
import { fuzzyAnyFilter, useTableColumns } from './helpers';

// 표 전체를 감싸는 스크롤 컨테이너 하나에 대해 단 하나의 IntersectionObserver를 만들어
// 공유하는 훅. 표 안에는 수백 개의 마크다운 프리뷰 셀이 있을 수 있는데, 각 셀마다
// observer를 새로 만들면 비용이 크므로, 하나의 observer에 여러 엘리먼트를 등록(observe)하고
// 콜백을 WeakMap으로 라우팅하는 방식으로 최적화한다.
function useIntersectionObserver() {
  const observerRef = useRef<IntersectionObserver>();
  const targetRef = useRef<HTMLElement>(); // observer의 root로 지정된 스크롤 컨테이너 엘리먼트
  // 각 관찰 대상 엘리먼트 -> 해당 엘리먼트가 화면에 나타나거나 사라질 때 실행할 콜백
  const handlers = useRef<WeakMap<HTMLElement, IntersectionObserverHandler>>(new WeakMap());
  // observer가 아직 생성되기 전에 등록 요청이 들어온 엘리먼트들을 잠시 담아두는 대기열
  const queueRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    // 컴포넌트가 언마운트될 때 observer 연결을 끊고 참조를 정리해 메모리 누수를 방지
    return () => {
      observerRef.current?.disconnect();
      handlers.current = null;
      queueRef.current.length = 0;
    };
  }, []);

  // 표를 감싸는 실제 DOM 엘리먼트(el)가 마운트되면 그것을 root로 하는 IntersectionObserver를 생성.
  // ref 콜백 형태로 쓰여 <div ref={bindObserver}>처럼 연결된다.
  const bindObserver = (el: HTMLElement) => {
    if (!el) return;
    if (targetRef.current === el) return; // 이미 같은 엘리먼트에 바인딩되어 있으면 재생성하지 않음
    if (observerRef.current) observerRef.current.disconnect();

    const style = getComputedStyle(el);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // 이 대상에 등록된 핸들러가 없으면 무시 (이미 unregister된 엘리먼트일 수 있음)
          if (!handlers.current.has(entry.target as HTMLElement)) return;
          const handler = handlers.current.get(entry.target as HTMLElement);
          handler(entry); // 등록된 콜백에게 "보이거나 안 보이게 됨" 이벤트를 위임
        });
      },
      {
        root: el, // 뷰포트 전체가 아니라 표 스크롤 컨테이너 기준으로 교차 여부 판단
        threshold: 0.01, // 1%만 보여도 "교차함"으로 간주 (거의 즉시 반응)
        // 컨테이너의 padding만큼 관찰 여백을 보정 (padding 영역까지 자연스럽게 포함)
        rootMargin: `${style.paddingTop} 0px ${style.paddingBottom} 0px`,
      }
    );

    targetRef.current = el;
    // observer 생성 전에 대기 중이던 엘리먼트들을 이제서야 실제로 observe 시작
    queueRef.current.forEach((el) => observerRef.current.observe(el));
    queueRef.current.length = 0;
  };

  // 하위 컴포넌트(MarkdownRenderer 등)가 사용할 등록/해제 API.
  // useMemo로 감싸 매 렌더마다 새 객체를 만들지 않도록 해서, 이 컨텍스트 값을 구독하는
  // 자식들이 불필요하게 리렌더링되는 것을 막는다.
  const context = useMemo(
    () => ({
      registerHandler: (el: HTMLElement, handler: IntersectionObserverHandler) => {
        if (!el) return;
        handlers.current.set(el, handler);
        if (!observerRef.current) {
          // observer가 아직 없다면(초기 렌더 타이밍) 나중에 처리하도록 대기열에 적재
          queueRef.current.push(el);
          return;
        }
        observerRef.current.observe(el);
      },
      unregisterHandler: (el: HTMLElement) => {
        if (!el) return;
        handlers.current?.delete(el);
        if (queueRef.current?.length) {
          queueRef.current = queueRef.current.filter((q) => q !== el);
        }
        observerRef.current?.unobserve(el);
      },
    }),
    []
  );

  return { bindObserver, context };
}

// '표' 보기 모드의 최상위 컴포넌트. Kanban.tsx가 boardView === 'table'일 때 이 컴포넌트를 그린다.
export function TableView({
  boardData,
  stateManager,
}: {
  boardData: Board;
  stateManager: StateManager;
}) {
  const { bindObserver, context } = useIntersectionObserver();
  // helpers.tsx에서 조립한 데이터/컬럼/정렬 상태를 가져온다
  const { data, columns, state, setSorting } = useTableColumns(boardData, stateManager);

  // useReactTable: @tanstack/react-table의 핵심 훅. data(행 데이터)와 columns(컬럼 정의)를
  // 넘기면 헤더 그룹, 행 모델, 정렬/필터링 상태 등을 계산해 반환하는 "테이블 인스턴스"를 만든다.
  // 실제 DOM은 전혀 그리지 않고 순수하게 상태/로직만 제공하는 headless 라이브러리다.
  const table = useReactTable({
    data,
    columns,
    state, // 정렬/전역 필터 상태를 이 컴포넌트가 controlled로 관리(react-table 내부 상태 대신 사용)
    globalFilterFn: fuzzyAnyFilter, // 상단 검색어에 대해 퍼지 매칭으로 필터링
    getColumnCanGlobalFilter: () => true, // 모든 컬럼이 전역 검색 대상이 되도록 허용
    enableColumnResizing: true, // 헤더 경계를 드래그해 컬럼 폭을 조절할 수 있게 함
    columnResizeMode: 'onChange', // 드래그하는 동안 실시간으로 폭이 갱신되도록(디바운스 없이) 설정
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // Obsidian의 RTL(오른쪽에서 왼쪽) 언어 설정을 반영해 리사이즈 핸들의 방향을 결정
    columnResizeDirection: stateManager.app.vault.getConfig('rightToLeft') ? 'rtl' : 'ltr',
    onSortingChange: setSorting, // 헤더 클릭 등으로 정렬이 바뀌면 이 콜백을 통해 로컬 state에 반영
    // 아래 세 getXxxRowModel은 react-table의 "플러그인" 방식 API —
    // 필요한 기능(기본 행 모델/정렬/필터링)을 명시적으로 조합해서 활성화한다.
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  const tableState = table.getState();

  // 컬럼 폭을 사용자가 드래그로 조절하면(tableState.columnSizing 변경) 그 값을
  // 보드 설정('table-sizing')에 디바운스(500ms)로 저장해, 다음에 열었을 때도 유지되게 한다.
  const dbTimer = useRef(-1);
  useEffect(() => {
    if (dbTimer.current === -1) {
      // 최초 마운트 시점의 변경은 "사용자가 방금 조절한 것"이 아니므로 저장을 건너뜀
      dbTimer.current = 0;
      return;
    }
    activeWindow.clearTimeout(dbTimer.current);
    dbTimer.current = activeWindow.setTimeout(() => {
      if (!stateManager.getAView()) return; // 뷰가 이미 닫혔으면 저장하지 않음
      stateManager.setState((board) => {
        // immutability-helper의 update()로 board.data.settings['table-sizing']만 불변 갱신
        return update(board, {
          data: {
            settings: {
              'table-sizing': {
                $set: tableState.columnSizing,
              },
            },
          },
        });
      });
    }, 500);
  }, [tableState.columnSizing]);

  // 모든 컬럼 폭의 합 = 표 전체 너비. 컬럼 폭이 바뀔 때만 재계산(useMemo)
  const tableWidth = table.getCenterTotalSize();
  const tableStyle = useMemo(() => {
    return {
      width: tableWidth,
    };
  }, [tableWidth]);

  return (
    <div className={`markdown-rendered ${c('table-wrapper')}`} ref={bindObserver}>
      {/* 이 컨텍스트를 통해 하위의 MarkdownRenderer들이 "화면에 보일 때만 렌더링"하도록
          가상화(virtualization) 신호를 받을 수 있다 */}
      <IntersectionObserverContext.Provider value={context}>
        <table style={tableStyle}>
          <thead>
            {/* getHeaderGroups(): 보통 헤더가 한 줄이면 그룹도 하나지만, 헤더 그룹핑(다단 헤더)을
                지원하기 위한 API. 이 프로젝트에서는 단순히 한 줄의 헤더를 그리는 데 사용 */}
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  // getIsSorted(): 이 컬럼의 현재 정렬 방향('asc' | 'desc' | false)
                  const sort = header.column.getIsSorted();
                  return (
                    <th key={header.id} className="mod-has-icon">
                      <div
                        className={c('table-cell-wrapper')}
                        style={{
                          width: header.getSize(), // 이 컬럼의 현재 폭(px)
                        }}
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            className={c('table-header')}
                            // getToggleSortingHandler(): 클릭 시 오름차순 -> 내림차순 -> 해제 순으로
                            // 순환하는 핸들러를 react-table이 자동 생성해준다
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <div>
                              {/* flexRender: 컬럼 정의의 header가 문자열이든 함수든 컴포넌트든
                                  상관없이 올바르게 렌더링해주는 react-table의 범용 렌더 헬퍼 */}
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </div>
                            <div className={c('table-header-sort')}>
                              {/* 현재 정렬 방향에 따라 위/아래/양방향 화살표 아이콘을 교체 표시 */}
                              {sort === 'asc' ? (
                                <Icon name="lucide-chevron-up" />
                              ) : sort === 'desc' ? (
                                <Icon name="lucide-chevron-down" />
                              ) : (
                                <Icon name="lucide-chevrons-up-down" />
                              )}
                            </div>
                          </div>
                        )}
                        <div
                          {...{
                            onDoubleClick: () => header.column.resetSize(), // 더블클릭하면 기본 폭으로 복원
                            onMouseDown: header.getResizeHandler(), // 마우스로 드래그 리사이즈 시작
                            onTouchStart: header.getResizeHandler(), // 터치로도 동일하게 리사이즈 지원
                            className: `resizer ${table.options.columnResizeDirection} ${
                              header.column.getIsResizing() ? 'isResizing' : ''
                            }`,
                          }}
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {/* getRowModel(): 현재 정렬/필터링이 모두 적용된 최종 행 목록 */}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {/* getVisibleCells(): 숨김 처리되지 않은 컬럼들의 셀만 반환 */}
                {row.getVisibleCells().map((cell) => {
                  return (
                    <td
                      key={cell.id}
                      className={classcat({
                        'mod-has-icon': cell.column.id === 'lane',
                        // 검색어와 이 셀이 매칭되었는지(fuzzyAnyFilter가 addMeta로 남긴 정보)를
                        // 읽어 매칭된 셀에 하이라이트 클래스를 부여
                        'mod-search-match': row.columnFiltersMeta[cell.column.id]
                          ? (row.columnFiltersMeta[cell.column.id] as any).itemRank.passed
                          : false,
                      })}
                    >
                      <div
                        className={c('table-cell-wrapper')}
                        style={{
                          width: cell.column.getSize(),
                        }}
                      >
                        {/* 각 셀의 실제 콘텐츠(컬럼 정의의 cell 옵션)를 렌더링 */}
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </IntersectionObserverContext.Provider>
    </div>
  );
}
