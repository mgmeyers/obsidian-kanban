/**
 * ============================================================================
 * [실행 순서 #82] src/components/Table/helpers.tsx — 테이블 컬럼 정의 및 데이터 변환 헬퍼
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * 표(table) 보기 모드의 "두뇌" 역할을 하는 파일입니다. 칸반 보드(레인+아이템 트리)를
 * react-table이 이해할 수 있는 평탄한 행 배열(TableItem[])로 변환하는 useTableData(),
 * 그리고 @tanstack/react-table의 createColumnHelper로 각 컬럼(카드/리스트/날짜/태그/
 * 파일 메타데이터/인라인 메타데이터)을 정의하고 정렬/검색 로직까지 묶어주는
 * useTableColumns()가 핵심입니다. 퍼지 검색(fuzzyAnyFilter)과 퍼지 정렬(fuzzySort)은
 * @tanstack/match-sorter-utils 라이브러리를 사용해 "정확히 일치하지 않아도 유사한 것"을
 * 찾아주는 필터/정렬 함수입니다. 컬럼 목록은 보드 설정(날짜/태그를 컬럼으로 옮길지 등)에
 * 따라 동적으로 늘어나며, 각 단계는 useMemo로 캐싱되어 불필요한 재계산을 막습니다.
 * ============================================================================
 */
import { compareItems, rankItem, rankings } from '@tanstack/match-sorter-utils';
import {
  ColumnDef,
  FilterFn,
  OnChangeFn,
  SortingFn,
  SortingState,
  createColumnHelper,
} from '@tanstack/react-table';
import classcat from 'classcat';
import moment from 'moment';
import { useCallback, useContext, useMemo, useRef, useState } from 'preact/hooks';
import { StateManager } from 'src/StateManager';
import { c } from 'src/components/helpers';
import { defaultSort } from 'src/helpers/util';
import { t } from 'src/lang/helpers';
import { getDataviewPlugin, lableToName, taskFields } from 'src/parsers/helpers/inlineMetadata';

import { Tags } from '../Item/ItemContent';
import { MetadataValue, anyToString } from '../Item/MetadataTable';
import { SearchContext } from '../context';
import { Board, Lane } from '../types';
import { DateCell, ItemCell, LaneCell } from './Cells';
import { TableData, TableItem } from './types';

// createColumnHelper<TableItem>(): react-table이 제공하는 타입 안전 빌더.
// TableItem을 제네릭으로 넘기면 이후 columnHelper.accessor(...)에서
// row 매개변수의 타입이 자동으로 TableItem으로 추론되어, 오타/타입 실수를 컴파일 타임에 잡아준다.
export const columnHelper = createColumnHelper<TableItem>();

// react-table의 FilterFn 타입을 만족하는 "전역 검색(global filter)" 함수.
// 사용자가 검색창에 입력한 문자열(search)과 각 셀 값을 비교해 "느슨하게 일치하는지" 판단한다.
// rankItem(): match-sorter-utils가 제공하는 퍼지 매칭 함수로, 단순 포함 여부(threshold: CONTAINS)
// 이상의 매칭 점수(itemRank)를 계산해 준다. addMeta로 이 점수를 row에 저장해두면
// 아래 fuzzySort에서 "검색어와 얼마나 잘 맞는지" 순으로 정렬하는 데 재사용할 수 있다.
export const fuzzyAnyFilter: FilterFn<TableItem> = (row, columnId, search, addMeta) => {
  const val = row.getValue(columnId) as any;

  if (val === null) return false;

  const stateManager = row.original.stateManager;
  // 셀 값이 { value, ... } 형태(메타데이터)면 value를, 아니면 값 자체를 문자열로 변환
  const str = val.value ? anyToString(val.value, stateManager) : anyToString(val, stateManager);
  const itemRank = rankItem(str, search, {
    threshold: rankings.CONTAINS,
  });
  addMeta({ itemRank }); // 이 행이 이 컬럼에서 얻은 매칭 점수를 row.columnFiltersMeta에 기록
  return itemRank.passed; // 임계값을 통과했으면(=검색어와 관련 있으면) true
};

// react-table의 SortingFn 타입을 만족하는 "검색 결과 우선 정렬" 함수.
// 검색 중(global filter 활성 상태)일 때는 매칭 점수가 높은 행을 위로 올리고,
// 검색 중이 아니면(columnFiltersMeta가 없으면) null을 반환해 "이 정렬 기준으로는 판단할 수
// 없음"을 알린다 — 호출부(baseColumns 등)는 null이면 자체 fallback 정렬(defaultSort 등)을 쓴다.
export const fuzzySort: SortingFn<any> = (rowA, rowB, columnId) => {
  if (!rowA.columnFiltersMeta[columnId] && !rowB.columnFiltersMeta[columnId]) return null;
  if (!rowA.columnFiltersMeta[columnId]) return -1;
  if (!rowB.columnFiltersMeta[columnId]) return 1;

  // compareItems: 두 매칭 점수(itemRank)를 비교해 더 관련도 높은 쪽을 우선시하는
  // match-sorter-utils의 비교자
  return compareItems(
    (rowA.columnFiltersMeta[columnId] as any)?.itemRank,
    (rowB.columnFiltersMeta[columnId] as any)?.itemRank
  );
};

// 칸반 보드(레인 -> 아이템의 2단 트리)를 표 형태로 쓰기 위해 평탄화(flatten)하는 훅.
// 동시에 "이 보드에 어떤 종류의 메타데이터(날짜/태그/파일 메타데이터/인라인 메타데이터)가
// 실제로 존재하는지"를 한 번 훑으면서 수집한다 — 이 목록을 바탕으로 useTableColumns가
// 필요한 컬럼만 동적으로 추가한다. board가 바뀔 때만 재계산하도록 useMemo로 감쌌다.
export function useTableData(board: Board, stateManager: StateManager): TableData {
  return useMemo<TableData>(() => {
    const items: TableItem[] = [];
    const metadata: Set<string> = new Set(); // 'date' | 'tags' 같은 내장 메타데이터 종류
    const fileMetadata: Set<string> = new Set(); // 프론트매터 등에서 온 파일 메타데이터 키
    const inlineMetadata: Set<string> = new Set(); // 본문 인라인(예: 'due::', '📅') 메타데이터 키
    const metadataLabels: Map<string, string> = new Map(); // 키 -> 표시용 라벨
    const lanes: Lane[] = board?.children || [];
    const metadataKeys = stateManager.getSetting('metadata-keys');
    // 'inline-metadata-position' 설정이 'body'가 아니면, 인라인 메타데이터를
    // 본문에서 분리해 별도 컬럼으로 옮긴다는 뜻
    const moveInlineMetadata = stateManager.getSetting('inline-metadata-position') !== 'body';

    // 레인 -> 아이템 이중 for문으로 보드 트리를 순회하며 평탄화
    for (let i = 0, len = lanes.length; i < len; i++) {
      const lane = lanes[i];
      for (let j = 0, len = lane.children.length; j < len; j++) {
        const item = lane.children[j];
        const itemMetadata = item.data.metadata;
        const itemfileMetadata = itemMetadata.fileMetadata || {};
        const fileMetaOrder = itemMetadata.fileMetadataOrder || [];
        const itemInlineMetadata = itemMetadata.inlineMetadata;

        // 날짜/태그 메타데이터가 하나라도 있는 카드를 발견하면 해당 종류를 기록
        if (!metadata.has('date') && itemMetadata.date) {
          metadata.add('date');
        }
        if (!metadata.has('tags') && itemMetadata.tags?.length) {
          metadata.add('tags');
        }

        // 파일(프론트매터) 메타데이터 키들을 정의된 순서(fileMetaOrder)대로 수집
        for (const key of fileMetaOrder) {
          if (!fileMetadata.has(key) && itemfileMetadata[key]) {
            fileMetadata.add(key);
            metadataLabels.set(key, itemfileMetadata[key].label || key);
          }
        }

        // 인라인 메타데이터를 별도 컬럼으로 옮기는 설정일 때만 키를 수집
        if (itemInlineMetadata && moveInlineMetadata) {
          itemInlineMetadata.forEach((m) => {
            if (!inlineMetadata.has(m.key)) {
              inlineMetadata.add(m.key);
              if (!metadataLabels.has(m.key)) {
                // 태스크 관련 필드(우선순위, 마감일 등)는 전용 라벨 변환 함수를 사용
                if (taskFields.has(m.key)) metadataLabels.set(m.key, lableToName(m.key));
                else {
                  // 그 외에는 사용자가 설정에서 지정한 라벨을 찾아 사용, 없으면 키 그대로
                  const key = metadataKeys.find((k) => k.metadataKey === m.key);
                  metadataLabels.set(m.key, key?.label || m.key);
                }
              }
            }
          });
        }

        // 이 카드를 표의 한 행으로 등록 (path: [레인 인덱스, 아이템 인덱스])
        items.push({ item, lane, path: [i, j], stateManager });
      }
    }

    return {
      items,
      metadataLabels,
      metadata: Array.from(metadata),
      fileMetadata: Array.from(fileMetadata),
      inlineMetadata: Array.from(inlineMetadata),
    };
  }, [board]);
}

// 항상 존재하는 기본 두 컬럼('card', 'lane')을 정의하는 팩토리 함수.
// sizing은 사용자가 이전에 드래그로 조절해 저장해둔 컬럼 너비(state.table-sizing)이다.
export const baseColumns = (sizing: Record<string, number>): ColumnDef<TableItem, any>[] => [
  // 'card' 컬럼: accessor 함수로 정렬/필터링에 쓸 원시 값(카드 제목)을 뽑아내고,
  // cell 함수로 실제 화면에 그릴 내용(ItemCell 컴포넌트)을 지정한다.
  columnHelper.accessor((row) => row.item.data.title, {
    id: 'card',
    cell: (info) => {
      // info.row.original: 이 셀이 속한 행의 원본 TableItem 데이터
      const { lane, item, path } = info.row.original;
      return <ItemCell item={item} lane={lane} path={path} />;
    },
    header: () => t('Card'), // 헤더 텍스트도 함수로 지정 가능 (다국어 t() 함수 사용)
    sortingFn: (a, b, id) => {
      // 검색 중이면 퍼지 매칭 점수로, 아니면 문자열 기본 정렬(defaultSort)로 비교
      const sorted = fuzzySort(a, b, id);
      if (sorted === null) {
        return defaultSort(a.getValue(id), b.getValue(id));
      }
      return sorted;
    },
    size: sizing.card || 272, // 저장된 너비가 없으면 기본값 272px
  }),
  // 'lane' 컬럼: 카드가 속한 리스트 이름
  columnHelper.accessor((row) => row.lane.data.title, {
    id: 'lane',
    cell: (info) => {
      const { lane, path } = info.row.original;
      return <LaneCell lane={lane} path={path} />;
    },
    header: () => t('List'),
    sortingFn: (a, b, id) => {
      const sorted = fuzzySort(a, b, id);
      if (sorted === null) {
        return defaultSort(a.getValue(id), b.getValue(id));
      }
      return sorted;
    },
    size: sizing.lane,
  }),
];

// TableView(Table.tsx)에서 사용하는 최상위 훅: react-table에 넘길 최종
// { data, columns, state, setSorting }을 조립해서 반환한다.
// 컬럼 목록은 baseColumns -> withMetadata -> withInlineMetadata -> withFileMetadata 순으로
// 단계적으로 확장되며, 각 단계는 useMemo로 감싸 의존성이 바뀔 때만 재계산된다.
export function useTableColumns(boardData: Board, stateManager: StateManager) {
  const search = useContext(SearchContext);

  // react-table의 정렬 상태(SortingState)는 컴포넌트 로컬 state로 직접 관리한다
  // (react-table은 controlled 모드로 동작 — state를 밖에서 주입하고 onSortingChange로 갱신받음)
  const [sorting, setSortingRaw] = useState<SortingState>([]);
  // 보드 설정값들을 구독하는 훅들 — 설정이 바뀌면 컴포넌트가 자동으로 리렌더링된다
  const shouldShowRelativeDate = stateManager.useSetting('show-relative-date');
  const moveDates = stateManager.useSetting('move-dates');
  const moveTags = stateManager.useSetting('move-tags');
  const moveInlineMetadata = stateManager.useSetting('inline-metadata-position') !== 'body';
  const moveTaskMetadata = stateManager.useSetting('move-task-metadata');
  const tableSizing = stateManager.useSetting('table-sizing') || {};

  // 정렬 방향(내림차순 여부)을 ref로도 따로 추적한다 — sortingFn 콜백 안에서
  // "undefined 값을 오름/내림차순 중 어느 쪽 끝에 둘지" 판단할 때 최신 값을 즉시 참조하기 위함
  // (state는 클로저에 갇혀 오래된 값을 참조할 수 있지만, ref.current는 항상 최신값)
  const desc = useRef<boolean>(false);
  const setSorting = useCallback<OnChangeFn<SortingState>>(
    (onChange: (old: SortingState) => SortingState) => {
      setSortingRaw((old) => {
        const newState = onChange(old);
        if (newState.length) desc.current = newState[0].desc;
        return newState;
      });
    },
    [setSortingRaw]
  );
  // react-table에 주입할 controlled state 객체. globalFilter는 상단 검색창의 검색어.
  const state = useMemo(() => ({ sorting, globalFilter: search?.query }), [sorting, search?.query]);

  // 보드 트리를 평탄화한 행 데이터 + 존재하는 메타데이터 키 목록
  const { items, metadata, fileMetadata, inlineMetadata, metadataLabels } = useTableData(
    boardData,
    stateManager
  );

  // 1단계: 기본 컬럼(card, lane) + 설정에 따라 'date'/'tags' 컬럼을 추가
  const withMetadata: ColumnDef<TableItem, any>[] = useMemo(() => {
    const columns = [...baseColumns(tableSizing)];
    for (const key of metadata) {
      switch (key) {
        case 'date':
          // "상대 날짜를 보여주거나" 혹은 "날짜를 본문에서 옮기도록" 설정된 경우에만 날짜 컬럼 추가
          if (shouldShowRelativeDate || moveDates) {
            columns.push(
              columnHelper.accessor((row) => row.item.data.metadata?.date || null, {
                header: () => t('Date'),
                id: 'date',
                size: tableSizing.date,
                cell: (info) => {
                  const date = info.getValue();
                  if (!date) return null;
                  return (
                    <DateCell
                      item={info.row.original}
                      shouldShowRelativeDate={shouldShowRelativeDate}
                      hideDateDisplay={!moveDates}
                    />
                  );
                },
                sortUndefined: false, // undefined 값에 대한 react-table의 기본 처리를 끄고 아래에서 직접 처리
                sortingFn: (a, b, id) => {
                  const sorted = fuzzySort(a, b, id);
                  if (sorted === null) {
                    const dateA = a.getValue(id) as moment.Moment;
                    const dateB = b.getValue(id) as moment.Moment;

                    // 날짜가 없는 카드는 항상 "정렬 방향과 무관하게 마지막"에 오도록 처리
                    if (!dateA && !dateB) return 0;
                    if (!dateA) return desc.current ? -1 : 1;
                    if (!dateB) return desc.current ? 1 : -1;

                    return dateA.valueOf() - dateB.valueOf(); // moment 값의 타임스탬프 비교
                  }
                  return sorted;
                },
                sortDescFirst: false, // 이 컬럼 헤더를 처음 클릭했을 때 오름차순부터 시작
              })
            );
          }
          break;
        case 'tags':
          if (moveTags) {
            columns.push(
              columnHelper.accessor((row) => row.item.data.metadata?.tags || null, {
                header: () => t('Tags'),
                id: 'card-tags',
                size: tableSizing['card-tags'],
                cell: (info) => {
                  // globalFilter(검색어)를 셀에 전달해 태그 안의 일치 부분을 하이라이트
                  const searchQuery = info.table.getState().globalFilter;
                  const tags = info.getValue();
                  if (!tags?.length) return null;
                  return <Tags tags={tags} searchQuery={searchQuery} />;
                },
                sortUndefined: false,
                sortingFn: (a, b, id) => {
                  const sorted = fuzzySort(a, b, id);
                  if (sorted === null) {
                    const tagsA = a.getValue<string[] | undefined>(id);
                    const tagsB = b.getValue<string[] | undefined>(id);

                    if (!tagsA?.length && !tagsB?.length) return 0;
                    if (!tagsA?.length) return desc.current ? -1 : 1;
                    if (!tagsB?.length) return desc.current ? 1 : -1;

                    // 설정에 정의된 "태그 정렬 우선순위" 목록을 참고해 지정된 태그를 먼저 배치
                    const tagSortOrder = stateManager.getSetting('tag-sort');
                    const aSortOrder =
                      tagSortOrder?.findIndex((sort) => tagsA.includes(sort.tag)) ?? -1;
                    const bSortOrder =
                      tagSortOrder?.findIndex((sort) => tagsB.includes(sort.tag)) ?? -1;

                    if (aSortOrder > -1 && bSortOrder < 0) return -1;
                    if (bSortOrder > -1 && aSortOrder < 0) return 1;
                    if (aSortOrder > -1 && bSortOrder > -1) {
                      return aSortOrder - bSortOrder;
                    }

                    // 우선순위 태그가 없으면 태그를 이어붙인 문자열로 기본 정렬
                    return defaultSort(tagsA.join(''), tagsB.join(''));
                  }
                  return sorted;
                },
                sortDescFirst: false,
              })
            );
          }
          break;
      }
    }

    return columns;
    // metadata 배열의 각 항목까지 의존성에 펼쳐 넣어(스프레드) 배열 내용이 바뀌면 재계산되게 함
  }, [shouldShowRelativeDate, moveDates, moveTags, ...metadata]);

  // 2단계: withMetadata에 이어서, 본문에서 분리된 인라인 메타데이터(태스크 필드 등) 컬럼들을 추가
  const withInlineMetadata = useMemo(() => {
    const columns = [...withMetadata];
    for (const key of inlineMetadata) {
      columns.push(
        columnHelper.accessor(
          (row) => {
            // 이 카드의 인라인 메타데이터 배열에서 현재 key와 일치하는 항목을 찾음
            const data = row.item.data.metadata.inlineMetadata?.find((m) => m.key === key);
            if (data) return data;
            return null;
          },
          {
            id: key,
            header: metadataLabels.get(key) ?? key,
            cell: (info) => {
              const m = info.getValue();
              if (!m) return null;

              const isTaskMetadata = taskFields.has(m.key);
              // 설정상 이 종류의 메타데이터를 컬럼으로 옮기지 않기로 했다면 셀을 비워둔다
              if (!moveTaskMetadata && isTaskMetadata) return null;
              if (!moveInlineMetadata && !isTaskMetadata) return null;

              const isEmoji = m.wrapping === 'emoji-shorthand'; // 예: 📅 형태의 이모지 단축 표기
              // Dataview 플러그인이 설치되어 있으면 그 파서로 값을 해석(날짜 등 타입 인식), 없으면 원본 값 사용
              const val = getDataviewPlugin()?.api?.parse(m.value) ?? m.value;
              const isEmojiPriority = isEmoji && m.key === 'priority';
              const isDate = !!val?.ts; // Dataview가 날짜로 인식했으면 ts(타임스탬프) 필드가 존재

              return (
                <span
                  className={classcat([
                    c('item-task-inline-metadata-item'),
                    m.key.replace(/[^a-z0-9]/g, '-'), // CSS 클래스로 쓸 수 있도록 키를 정규화
                    {
                      'is-task-metadata': isTaskMetadata,
                      'is-emoji': isEmoji,
                      'is-date': isDate,
                    },
                  ])}
                >
                  {/* 이모지로 표시되는 우선순위는 별도 아이콘으로 그려지므로 텍스트 값은 생략 */}
                  {!isEmojiPriority && (
                    <span className={c('item-task-inline-metadata-item-value')}>
                      <MetadataValue
                        searchQuery={search?.query}
                        data={{
                          value: val,
                          label: '',
                          metadataKey: m.key,
                          shouldHideLabel: false,
                          containsMarkdown: false,
                        }}
                      />
                    </span>
                  )}
                </span>
              );
            },
            sortDescFirst: false,
            sortingFn: (a, b, id) => {
              const valA = a.getValue(id) as any;
              const valB = b.getValue(id) as any;

              if (valA === null && valB === null) return 0;
              if (valA === null) return desc.current ? -1 : 1;
              if (valB === null) return desc.current ? 1 : -1;

              const sorted = fuzzySort(a, b, id);
              if (sorted === null) {
                return defaultSort(
                  anyToString(valA.value, stateManager),
                  anyToString(valB.value, stateManager)
                );
              }
              return sorted;
            },
          }
        )
      );
    }
    return columns;
    // metadataLabels는 Map이라 참조 비교가 무의미하므로 .values()를 펼쳐 넣어 내용 변화 감지
  }, [withMetadata, ...inlineMetadata, ...metadataLabels.values()]);

  // 3단계: withInlineMetadata에 이어서, 파일(프론트매터) 메타데이터 컬럼들을 추가 — 최종 컬럼 목록
  const withFileMetadata = useMemo(() => {
    const columns = [...withInlineMetadata];
    for (const key of fileMetadata) {
      columns.push(
        columnHelper.accessor(
          (row) => {
            const metadata = row.item.data.metadata?.fileMetadata;
            if (metadata && metadata[key]) {
              return metadata[key];
            }
            return null;
          },
          {
            id: key,
            header: metadataLabels.get(key) ?? key,
            cell: (info) => {
              const val = info.getValue();
              if (!val) return null;
              const searchQuery = info.table.getState().globalFilter;
              // 프론트매터의 'tags' 필드는 일반 메타데이터 값과 다르게 태그 전용 컴포넌트로 표시
              if (key === 'tags') {
                return <Tags searchQuery={searchQuery} tags={val.value as string[]} alwaysShow />;
              }
              return <MetadataValue data={val} searchQuery={searchQuery} />;
            },
            sortDescFirst: false,
            sortingFn: (a, b, id) => {
              const valA = a.getValue(id) as any;
              const valB = b.getValue(id) as any;

              if (!valA?.value && !valB?.value) return 0;
              if (!valA?.value) return desc.current ? -1 : 1;
              if (!valB?.value) return desc.current ? 1 : -1;

              const sorted = fuzzySort(a, b, id);
              if (sorted === null) {
                if (id === 'tags') {
                  const tagSortOrder = stateManager.getSetting('tag-sort');
                  const aSortOrder =
                    tagSortOrder?.findIndex((sort) => valA.value.includes(sort.tag)) ?? -1;
                  const bSortOrder =
                    tagSortOrder?.findIndex((sort) => valB.value.includes(sort.tag)) ?? -1;

                  if (aSortOrder > -1 && bSortOrder < 0) return -1;
                  if (bSortOrder > -1 && aSortOrder < 0) return 1;
                  if (aSortOrder > -1 && bSortOrder > -1) {
                    return aSortOrder - bSortOrder;
                  }
                }

                return defaultSort(
                  anyToString(valA.value, stateManager),
                  anyToString(valB.value, stateManager)
                );
              }
              return sorted;
            },
          }
        )
      );
    }
    return columns;
  }, [withInlineMetadata, ...fileMetadata, ...metadataLabels.values()]);

  // TableView가 useReactTable(...)에 그대로 스프레드해서 넘길 최종 결과물
  return { data: items, columns: withFileMetadata, state, setSorting };
}
