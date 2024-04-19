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

function useIntersectionObserver() {
  const observerRef = useRef<IntersectionObserver>();
  const targetRef = useRef<HTMLElement>();
  const handlers = useRef<WeakMap<HTMLElement, IntersectionObserverHandler>>(new WeakMap());
  const queueRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      handlers.current = null;
      queueRef.current.length = 0;
    };
  }, []);

  const bindObserver = (el: HTMLElement) => {
    if (!el) return;
    if (targetRef.current === el) return;
    if (observerRef.current) observerRef.current.disconnect();

    const style = getComputedStyle(el);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!handlers.current.has(entry.target as HTMLElement)) return;
          const handler = handlers.current.get(entry.target as HTMLElement);
          handler(entry);
        });
      },
      {
        root: el,
        threshold: 0.01,
        rootMargin: `${style.paddingTop} 0px ${style.paddingBottom} 0px`,
      }
    );

    targetRef.current = el;
    queueRef.current.forEach((el) => observerRef.current.observe(el));
    queueRef.current.length = 0;
  };

  const context = useMemo(
    () => ({
      registerHandler: (el: HTMLElement, handler: IntersectionObserverHandler) => {
        if (!el) return;
        handlers.current.set(el, handler);
        if (!observerRef.current) {
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

export function TableView({
  boardData,
  stateManager,
}: {
  boardData: Board;
  stateManager: StateManager;
}) {
  const { bindObserver, context } = useIntersectionObserver();
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

  const tableWidth = table.getCenterTotalSize();
  const tableStyle = useMemo(() => {
    return {
      width: tableWidth,
    };
  }, [tableWidth]);

  return (
    <div className={`markdown-rendered ${c('table-wrapper')}`} ref={bindObserver}>
      <IntersectionObserverContext.Provider value={context}>
        <table style={tableStyle}>
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
      </IntersectionObserverContext.Provider>
    </div>
  );
}
