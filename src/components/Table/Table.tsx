import { compareItems, rankItem, rankings } from '@tanstack/match-sorter-utils';
import {
  ColumnDef,
  FilterFn,
  OnChangeFn,
  SortingFn,
  SortingState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import classcat from 'classcat';
import update from 'immutability-helper';
import moment from 'moment';
import { Menu } from 'obsidian';
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
import isEqual from 'react-fast-compare';
import { ExplicitPathContext } from 'src/dnd/components/context';
import { Path } from 'src/dnd/types';
import { moveEntity } from 'src/dnd/util/data';
import { t } from 'src/lang/helpers';

import { StateManager } from '../../StateManager';
import { defaultSort } from '../../helpers/util';
import { Icon } from '../Icon/Icon';
import { DateAndTime, RelativeDate } from '../Item/DateAndTime';
import { ItemCheckbox } from '../Item/ItemCheckbox';
import { ItemContent, Tags, useDatePickers } from '../Item/ItemContent';
import { useItemMenu } from '../Item/ItemMenu';
import { MetadataValue, anyToString } from '../Item/MetadataTable';
import { StaticMarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer';
import { KanbanContext, SearchContext } from '../context';
import { c } from '../helpers';
import { Board, Item, Lane } from '../types';

interface TableItem {
  item: Item;
  lane: Lane;
  path: Path;
  stateManager: StateManager;
}

interface TableData {
  items: TableItem[];
  metadata: string[];
  fileMetadata: string[];
}

export function useTableData(board: Board, stateManager: StateManager): TableData {
  return useMemo<TableData>(() => {
    const items: TableItem[] = [];
    const metadata: Set<string> = new Set();
    const fileMetadata: Set<string> = new Set();
    const lanes: Lane[] = board?.children || [];

    for (let i = 0, len = lanes.length; i < len; i++) {
      const lane = lanes[i];
      for (let j = 0, len = lane.children.length; j < len; j++) {
        const item = lane.children[j];
        const itemMetadata = item.data.metadata;
        const itemfileMetadata = itemMetadata.fileMetadata || {};
        const fileMetaOrder = itemMetadata.fileMetadataOrder || [];

        if (!metadata.has('date') && itemMetadata.date) {
          metadata.add('date');
        }
        if (!metadata.has('tags') && itemMetadata.tags?.length) {
          metadata.add('tags');
        }

        for (const key of fileMetaOrder) {
          if (!fileMetadata.has(key) && itemfileMetadata[key]) {
            fileMetadata.add(key);
          }
        }

        items.push({ item, lane, path: [i, j], stateManager });
      }
    }

    return {
      items,
      metadata: Array.from(metadata),
      fileMetadata: Array.from(fileMetadata),
    };
  }, [board]);
}

const columnHelper = createColumnHelper<TableItem>();

function DateCell({
  item,
  hideDateDisplay,
  shouldShowRelativeDate,
}: {
  item: TableItem;
  hideDateDisplay: boolean;
  shouldShowRelativeDate: boolean;
}) {
  const { stateManager, filePath, getDateColor } = useContext(KanbanContext);
  const { onEditDate, onEditTime } = useDatePickers(item.item, item.path);

  return (
    <>
      {shouldShowRelativeDate ? (
        <RelativeDate item={item.item} stateManager={stateManager} />
      ) : null}
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
}

const CellItem = memo(
  function CellItem({ item, lane, path }: { item: Item; lane: Lane; path: number[] }) {
    const { stateManager, boardModifiers } = useContext(KanbanContext);
    const search = useContext(SearchContext);
    const [editCoords, setIsEditing] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const shouldMarkItemsComplete = !!lane.data.shouldMarkItemsComplete;

    const showItemMenu = useItemMenu({
      boardModifiers,
      item,
      setEditState: setIsEditing,
      stateManager,
      path,
    });

    const onContextMenu: JSX.MouseEventHandler<HTMLDivElement> = useCallback(
      (e) => {
        if (e.targetNode.instanceOf(HTMLTextAreaElement)) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const internalLinkPath =
          e.targetNode.instanceOf(HTMLAnchorElement) && e.targetNode.hasClass('internal-link')
            ? e.targetNode.dataset.href
            : undefined;

        showItemMenu(e, internalLinkPath);
      },
      [showItemMenu]
    );

    const onDoubleClick: JSX.MouseEventHandler<HTMLDivElement> = useCallback((e) => {
      setIsEditing({ x: e.clientX, y: e.clientY });
    }, []);

    return (
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
            <ItemContent
              editState={editCoords}
              item={item}
              setEditState={setIsEditing}
              showMetadata={false}
              searchQuery={search?.query}
              isStatic={false}
            />
          </div>
        </div>
      </ExplicitPathContext.Provider>
    );
  },
  (prev, next) => {
    return (
      prev.lane.data.shouldMarkItemsComplete === next.lane.data.shouldMarkItemsComplete &&
      isEqual(prev.item, next.item) &&
      isEqual(prev.path, next.path)
    );
  }
);

function LaneCell({ lane, path }: { lane: Lane; path: number[] }) {
  const { stateManager } = useContext(KanbanContext);
  const search = useContext(SearchContext);
  return (
    <div className={c('cell-flex-wrapper')}>
      <StaticMarkdownRenderer searchQuery={search?.query} markdownString={lane.data.title} />
      <div
        onClick={(e) => {
          const menu = new Menu();
          const lanes = stateManager.state.children;

          for (let i = 0, len = lanes.length; i < len; i++) {
            const l = lanes[i];
            menu.addItem((item) =>
              item
                .setChecked(lane === l)
                .setTitle(l.data.title)
                .onClick(() => {
                  if (lane === l) return;
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
}

const baseColumns = (sizing: Record<string, number>): ColumnDef<TableItem, any>[] => [
  columnHelper.accessor((row) => row.item.data.title, {
    id: 'card',
    cell: (info) => {
      const { lane, item, path } = info.row.original;
      return <CellItem item={item} lane={lane} path={path} />;
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

const fuzzyAnyFilter: FilterFn<TableItem> = (row, columnId, search, addMeta) => {
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

const fuzzySort: SortingFn<any> = (rowA, rowB, columnId) => {
  if (!rowA.columnFiltersMeta[columnId] && !rowB.columnFiltersMeta[columnId]) return null;
  if (!rowA.columnFiltersMeta[columnId]) return -1;
  if (!rowB.columnFiltersMeta[columnId]) return 1;

  return compareItems(
    (rowA.columnFiltersMeta[columnId] as any)?.itemRank,
    (rowB.columnFiltersMeta[columnId] as any)?.itemRank
  );
};

function useTableColumns(boardData: Board, stateManager: StateManager) {
  const search = useContext(SearchContext);

  const [sorting, setSortingRaw] = useState<SortingState>([]);
  const shouldShowRelativeDate = stateManager.useSetting('show-relative-date');
  const hideDateDisplay = stateManager.useSetting('hide-date-display');
  const hideTagsDisplay = stateManager.useSetting('hide-tags-display');
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
  const state = useMemo(() => ({ sorting, globalFilter: search?.query }), [sorting, search]);

  const { items, metadata, fileMetadata } = useTableData(boardData, stateManager);
  const withMetadata: ColumnDef<TableItem, any>[] = useMemo(() => {
    const columns = [...baseColumns(tableSizing)];
    for (const key of metadata) {
      switch (key) {
        case 'date':
          if (shouldShowRelativeDate || !hideDateDisplay) {
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
                      hideDateDisplay={hideDateDisplay}
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
          if (!hideTagsDisplay) {
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
  }, metadata);

  const withFileMetadata = useMemo(() => {
    const columns = [...withMetadata];
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
            cell: (info) => {
              const val = info.getValue();
              if (!val) return null;
              const searchQuery = info.table.getState().globalFilter;
              if (key === 'tags') {
                return (
                  <Tags searchQuery={searchQuery} tags={val.value as string[]} isDisplay={false} />
                );
              }
              return <MetadataValue data={val} searchQuery={searchQuery} />;
            },
            sortingFn: (a, b, id) => {
              const valA = a.getValue(id) as any;
              const valB = b.getValue(id) as any;

              if (!valA?.value && !valB?.value) return 0;
              if (!valA?.value) return desc.current ? -1 : 1;
              if (!valB?.value) return desc.current ? 1 : -1;

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
  }, [withMetadata, ...fileMetadata]);

  return { data: items, columns: withFileMetadata, state, setSorting };
}

export function TableView({
  boardData,
  stateManager,
}: {
  boardData: Board;
  stateManager: StateManager;
}) {
  const { data, columns, state, setSorting } = useTableColumns(boardData, stateManager);
  const table = useReactTable({
    data,
    columns,
    state,
    globalFilterFn: fuzzyAnyFilter,
    getColumnCanGlobalFilter: () => true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    columnResizeDirection: stateManager.app.vault.getConfig('rightToLeft') ? 'rtl' : 'ltr',
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  const tableState = table.getState();

  const dbTimer = useRef(-1);
  useEffect(() => {
    if (dbTimer.current === -1) {
      dbTimer.current = 0;
      return;
    }
    activeWindow.clearTimeout(dbTimer.current);
    dbTimer.current = activeWindow.setTimeout(() => {
      if (!stateManager.getAView()) return;
      stateManager.setState((board) => {
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

  return (
    <div className={`markdown-rendered ${c('table-wrapper')}`}>
      <table
        style={{
          width: table.getCenterTotalSize(),
        }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sort = header.column.getIsSorted();
                return (
                  <th key={header.id} className="mod-has-icon">
                    <div
                      className={c('table-cell-wrapper')}
                      style={{
                        width: header.getSize(),
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={c('table-header')}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <div>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </div>
                          <div className={c('table-header-sort')}>
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
                          onDoubleClick: () => header.column.resetSize(),
                          onMouseDown: header.getResizeHandler(),
                          onTouchStart: header.getResizeHandler(),
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
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => {
                return (
                  <td
                    key={cell.id}
                    className={classcat({
                      'mod-has-icon': cell.column.id === 'lane',
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
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
