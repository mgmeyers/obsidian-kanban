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

export const columnHelper = createColumnHelper<TableItem>();

export const fuzzyAnyFilter: FilterFn<TableItem> = (row, columnId, search, addMeta) => {
  const val = row.getValue(columnId) as any;

  if (val === null) return false;

  const stateManager = row.original.stateManager;
  const str = val.value ? anyToString(val.value, stateManager) : anyToString(val, stateManager);
  const itemRank = rankItem(str, search, {
    threshold: rankings.CONTAINS,
  });
  addMeta({ itemRank });
  return itemRank.passed;
};

export const fuzzySort: SortingFn<any> = (rowA, rowB, columnId) => {
  if (!rowA.columnFiltersMeta[columnId] && !rowB.columnFiltersMeta[columnId]) return null;
  if (!rowA.columnFiltersMeta[columnId]) return -1;
  if (!rowB.columnFiltersMeta[columnId]) return 1;

  return compareItems(
    (rowA.columnFiltersMeta[columnId] as any)?.itemRank,
    (rowB.columnFiltersMeta[columnId] as any)?.itemRank
  );
};

export function useTableData(board: Board, stateManager: StateManager): TableData {
  return useMemo<TableData>(() => {
    const items: TableItem[] = [];
    const metadata: Set<string> = new Set();
    const fileMetadata: Set<string> = new Set();
    const inlineMetadata: Set<string> = new Set();
    const metadataLabels: Map<string, string> = new Map();
    const lanes: Lane[] = board?.children || [];
    const metadataKeys = stateManager.getSetting('metadata-keys');
    const moveInlineMetadata = stateManager.getSetting('inline-metadata-position') !== 'body';

    for (let i = 0, len = lanes.length; i < len; i++) {
      const lane = lanes[i];
      for (let j = 0, len = lane.children.length; j < len; j++) {
        const item = lane.children[j];
        const itemMetadata = item.data.metadata;
        const itemfileMetadata = itemMetadata.fileMetadata || {};
        const fileMetaOrder = itemMetadata.fileMetadataOrder || [];
        const itemInlineMetadata = itemMetadata.inlineMetadata;

        if (!metadata.has('date') && itemMetadata.date) {
          metadata.add('date');
        }
        if (!metadata.has('tags') && itemMetadata.tags?.length) {
          metadata.add('tags');
        }

        for (const key of fileMetaOrder) {
          if (!fileMetadata.has(key) && itemfileMetadata[key]) {
            fileMetadata.add(key);
            metadataLabels.set(key, itemfileMetadata[key].label || key);
          }
        }

        if (itemInlineMetadata && moveInlineMetadata) {
          itemInlineMetadata.forEach((m) => {
            if (!inlineMetadata.has(m.key)) {
              inlineMetadata.add(m.key);
              if (!metadataLabels.has(m.key)) {
                if (taskFields.has(m.key)) metadataLabels.set(m.key, lableToName(m.key));
                else {
                  const key = metadataKeys.find((k) => k.metadataKey === m.key);
                  metadataLabels.set(m.key, key?.label || m.key);
                }
              }
            }
          });
        }

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

export const baseColumns = (sizing: Record<string, number>): ColumnDef<TableItem, any>[] => [
  columnHelper.accessor((row) => row.item.data.title, {
    id: 'card',
    cell: (info) => {
      const { lane, item, path } = info.row.original;
      return <ItemCell item={item} lane={lane} path={path} />;
    },
    header: () => t('Card'),
    sortingFn: (a, b, id) => {
      const sorted = fuzzySort(a, b, id);
      if (sorted === null) {
        return defaultSort(a.getValue(id), b.getValue(id));
      }
      return sorted;
    },
    size: sizing.card || 272,
  }),
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

export function useTableColumns(boardData: Board, stateManager: StateManager) {
  const search = useContext(SearchContext);

  const [sorting, setSortingRaw] = useState<SortingState>([]);
  const shouldShowRelativeDate = stateManager.useSetting('show-relative-date');
  const moveDates = stateManager.useSetting('move-dates');
  const moveTags = stateManager.useSetting('move-tags');
  const moveInlineMetadata = stateManager.useSetting('inline-metadata-position') !== 'body';
  const moveTaskMetadata = stateManager.useSetting('move-task-metadata');
  const tableSizing = stateManager.useSetting('table-sizing') || {};

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
  const state = useMemo(() => ({ sorting, globalFilter: search?.query }), [sorting, search?.query]);

  const { items, metadata, fileMetadata, inlineMetadata, metadataLabels } = useTableData(
    boardData,
    stateManager
  );

  const withMetadata: ColumnDef<TableItem, any>[] = useMemo(() => {
    const columns = [...baseColumns(tableSizing)];
    for (const key of metadata) {
      switch (key) {
        case 'date':
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
                sortUndefined: false,
                sortingFn: (a, b, id) => {
                  const sorted = fuzzySort(a, b, id);
                  if (sorted === null) {
                    const dateA = a.getValue(id) as moment.Moment;
                    const dateB = b.getValue(id) as moment.Moment;

                    if (!dateA && !dateB) return 0;
                    if (!dateA) return desc.current ? -1 : 1;
                    if (!dateB) return desc.current ? 1 : -1;

                    return dateA.valueOf() - dateB.valueOf();
                  }
                  return sorted;
                },
                sortDescFirst: false,
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
  }, [shouldShowRelativeDate, moveDates, moveTags, ...metadata]);

  const withInlineMetadata = useMemo(() => {
    const columns = [...withMetadata];
    for (const key of inlineMetadata) {
      columns.push(
        columnHelper.accessor(
          (row) => {
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
              if (!moveTaskMetadata && isTaskMetadata) return null;
              if (!moveInlineMetadata && !isTaskMetadata) return null;

              const isEmoji = m.wrapping === 'emoji-shorthand';
              const val = getDataviewPlugin()?.api?.parse(m.value) ?? m.value;
              const isEmojiPriority = isEmoji && m.key === 'priority';
              const isDate = !!val?.ts;

              return (
                <span
                  className={classcat([
                    c('item-task-inline-metadata-item'),
                    m.key.replace(/[^a-z0-9]/g, '-'),
                    {
                      'is-task-metadata': isTaskMetadata,
                      'is-emoji': isEmoji,
                      'is-date': isDate,
                    },
                  ])}
                >
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
  }, [withMetadata, ...inlineMetadata, ...metadataLabels.values()]);

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

  return { data: items, columns: withFileMetadata, state, setSorting };
}
