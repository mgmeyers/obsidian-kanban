import {
  ColumnDef,
  SortingState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import classcat from 'classcat';
import update from 'immutability-helper';
import { Menu } from 'obsidian';
import Preact, {
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

import { StateManager } from '../StateManager';
import { defaultSort } from '../helpers/util';
import { Icon } from './Icon/Icon';
import { DateAndTime, RelativeDate } from './Item/DateAndTime';
import { ItemCheckbox } from './Item/ItemCheckbox';
import { ItemContent, Tags, useDatePickers } from './Item/ItemContent';
import { useItemMenu } from './Item/ItemMenu';
import { MetadataValue } from './Item/MetadataTable';
import { MarkdownPreviewRenderer } from './MarkdownRenderer';
import { KanbanContext } from './context';
import { c } from './helpers';
import { Board, Item, Lane } from './types';

interface TableItem {
  item: Item;
  lane: Lane;
  path: Path;
}

interface TableData {
  items: TableItem[];
  metadata: string[];
  fileMetadata: string[];
}

export function useTableData(board: Board): TableData {
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

        items.push({ item, lane, path: [i, j] });
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
  const { stateManager, filePath, getDateColor } =
    Preact.useContext(KanbanContext);
  const { onEditDate, onEditTime } = useDatePickers(item.item, item.path);

  return (
    <>
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
      {shouldShowRelativeDate ? (
        <RelativeDate item={item.item} stateManager={stateManager} />
      ) : null}
    </>
  );
}

const CellItem = memo(
  function CellItem({
    item,
    lane,
    path,
  }: {
    item: Item;
    lane: Lane;
    path: number[];
  }) {
    const { stateManager, boardModifiers } = useContext(KanbanContext);
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
          e.targetNode.instanceOf(HTMLAnchorElement) &&
          e.targetNode.hasClass('internal-link')
            ? e.targetNode.dataset.href
            : undefined;

        showItemMenu(e, internalLinkPath);
      },
      [showItemMenu]
    );

    const onDoubleClick: JSX.MouseEventHandler<HTMLDivElement> = useCallback(
      (e) => {
        setIsEditing({ x: e.clientX, y: e.clientY });
      },
      []
    );

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
            />
          </div>
        </div>
      </ExplicitPathContext.Provider>
    );
  },
  (prev, next) => {
    return (
      prev.lane.data.shouldMarkItemsComplete ===
        next.lane.data.shouldMarkItemsComplete &&
      isEqual(prev.item, next.item) &&
      isEqual(prev.path, next.path)
    );
  }
);

function LaneCell({ lane, path }: { lane: Lane; path: number[] }) {
  const { stateManager } = useContext(KanbanContext);
  return (
    <div className={c('cell-flex-wrapper')}>
      <MarkdownPreviewRenderer markdownString={lane.data.title} />
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
                    return moveEntity(boardData, path, [
                      i,
                      target.children.length,
                    ]);
                  });
                })
            );
          }

          menu.showAtMouseEvent(e);
        }}
        className={classcat([c('icon-wrapper'), c('lane-menu')])}
      >
        <Icon name="lucide-square-kanban" />
      </div>
    </div>
  );
}

const baseColumns = (
  sizing: Record<string, number>
): ColumnDef<TableItem, any>[] => [
  columnHelper.accessor((row) => row.item.data.title, {
    id: 'card',
    cell: (info) => {
      const { lane, item, path } = info.row.original;
      return <CellItem item={item} lane={lane} path={path} />;
    },
    header: () => t('Card'),
    sortingFn: (a, b, id) => defaultSort(a.getValue(id), b.getValue(id)),
    size: sizing.card || 272,
  }),
  columnHelper.accessor((row) => row.lane.data.title, {
    id: 'lane',
    cell: (info) => {
      const { lane, path } = info.row.original;
      return <LaneCell lane={lane} path={path} />;
    },
    header: () => t('List'),
    sortingFn: (a, b, id) => defaultSort(a.getValue(id), b.getValue(id)),
    size: sizing.lane,
  }),
];

function useTableColumns(boardData: Board, stateManager: StateManager) {
  const [sorting, setSorting] = Preact.useState<SortingState>([]);
  const shouldShowRelativeDate = stateManager.useSetting('show-relative-date');
  const hideDateDisplay = stateManager.useSetting('hide-date-display');
  const hideTagsDisplay = stateManager.useSetting('hide-tags-display');
  const tableSizing = stateManager.useSetting('table-sizing') || {};

  const state = useMemo(() => ({ sorting }), [sorting]);

  const { desc } = state.sorting[0] ?? {};

  const { items, metadata, fileMetadata } = useTableData(boardData);
  const withMetadata: ColumnDef<TableItem, any>[] = useMemo(() => {
    const columns = [...baseColumns(tableSizing)];
    for (const key of metadata) {
      switch (key) {
        case 'date':
          if (shouldShowRelativeDate || !hideDateDisplay) {
            columns.push(
              columnHelper.accessor(
                (row) => row.item.data.metadata?.date || null,
                {
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
                  sortingFn: (a, b, id) => {
                    const dateA = a.getValue(id) as moment.Moment;
                    const dateB = b.getValue(id) as moment.Moment;

                    if (!dateA && !dateB) return 0;
                    if (!dateA) return desc ? -1 : 1;
                    if (!dateB) return desc ? 1 : -1;

                    return dateA.valueOf() - dateB.valueOf();
                  },
                  sortDescFirst: false,
                }
              )
            );
          }
          break;
        case 'tags':
          if (!hideTagsDisplay) {
            columns.push(
              columnHelper.accessor(
                (row) => row.item.data.metadata?.tags || null,
                {
                  header: () => t('Card tags'),
                  id: 'card-tags',
                  size: tableSizing['card-tags'],
                  cell: (info) => {
                    const tags = info.getValue();
                    if (!tags?.length) return null;
                    return <Tags tags={tags} />;
                  },
                  sortingFn: (a, b, id) => {
                    const tagsA = a.getValue(id) as string[];
                    const tagsB = b.getValue(id) as string[];

                    if (!tagsA?.length && !tagsB?.length) return 0;
                    if (!tagsA?.length) return desc ? -1 : 1;
                    if (!tagsB?.length) return desc ? 1 : -1;

                    return defaultSort(tagsA.join(''), tagsB.join(''));
                  },
                }
              )
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
              if (key === 'tags') {
                return <Tags tags={val.value as string[]} isDisplay={false} />;
              }
              return <MetadataValue data={val} />;
            },
            sortingFn: (a, b, id) => {
              const valA = a.getValue(id) as any;
              const valB = b.getValue(id) as any;

              if (!valA?.value && !valB?.value) return 0;
              if (!valA?.value) return desc ? -1 : 1;
              if (!valB?.value) return desc ? 1 : -1;

              if (id === 'tags') {
                return defaultSort(valA.value.join(''), valB.value.join(''));
              }

              if (Array.isArray(valA.value) && Array.isArray(valB.value)) {
                return defaultSort(
                  (valA.value as any[])
                    .reduce((str, cur) => {
                      if (typeof cur === 'object') {
                        if (cur.ts) return str + cur.ts.toString();
                        if (cur.path) return str + (cur.display || cur.path);
                      }
                      return str + `${cur}`;
                    }, '')
                    .join(''),
                  (valB.value as any[])
                    .reduce((str, cur) => {
                      if (typeof cur === 'object') {
                        if (cur.ts) return str + cur.ts.toString();
                        if (cur.path) return str + (cur.display || cur.path);
                      }
                      return str + `${cur}`;
                    }, '')
                    .join('')
                );
              }

              let aStr = '';
              let bStr = '';

              if (typeof valA.value === 'object') {
                if (valA.value.ts) aStr = valA.value.ts.toString();
                else if (valA.value.path)
                  aStr = valA.value.display || valA.value.path;
              } else {
                aStr = `${valA.value}`;
              }

              if (typeof valB.value === 'object') {
                if (valB.value.ts) aStr = valB.value.ts.toString();
                else if (valB.value.path)
                  aStr = valB.value.display || valB.value.path;
              } else {
                bStr = `${valB.value}`;
              }

              return defaultSort(aStr, bStr);
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
  const { data, columns, state, setSorting } = useTableColumns(
    boardData,
    stateManager
  );
  const table = useReactTable({
    data,
    columns,
    state,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    columnResizeDirection: stateManager.app.vault.getConfig('rightToLeft')
      ? 'rtl'
      : 'ltr',
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
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
                          className: `resizer ${
                            table.options.columnResizeDirection
                          } ${
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
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={
                    cell.column.id === 'lane' ? 'mod-has-icon' : undefined
                  }
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
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
