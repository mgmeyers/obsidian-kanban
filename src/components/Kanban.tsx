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
import { HorizontalLane, Lanes } from './Lane/Lane';
import { LaneForm } from './Lane/LaneForm';
import { TableView } from './Table/Table';
import { KanbanContext, SearchContext } from './context';
import { baseClassName, c, useSearchValue } from './helpers';
import { DataTypes } from './types';

const boardScrollTiggers = [DataTypes.Item, DataTypes.Lane];
const boardAccepts = [DataTypes.Lane];

interface KanbanProps {
  stateManager: StateManager;
  view: KanbanView;
}

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
  const boardData = stateManager.useState();
  const isAnythingDragging = useIsAnythingDragging();

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const [isLaneFormVisible, setIsLaneFormVisible] = useState<boolean>(
    boardData?.children.length === 0
  );

  const filePath = stateManager.file.path;
  const maxArchiveLength = stateManager.useSetting('max-archive-size');
  const dateColors = stateManager.useSetting('date-colors');
  const tagColors = stateManager.useSetting('tag-colors');
  const boardView = view.useViewState(frontmatterKey);

  const closeLaneForm = useCallback(() => {
    if (boardData?.children.length > 0) {
      setIsLaneFormVisible(false);
    }
  }, [boardData?.children.length]);

  useEffect(() => {
    if (boardData?.children.length === 0 && !stateManager.hasError()) {
      setIsLaneFormVisible(true);
    }
  }, [boardData?.children.length, stateManager]);

  const onNewLane = useCallback(() => {
    rootRef.current?.win.setTimeout(() => {
      const board = rootRef.current?.getElementsByClassName(c('board'));

      if (board?.length) {
        animateScrollTo([board[0].scrollWidth, 0], {
          elementToScroll: board[0],
          speed: 300,
          minDuration: 150,
          easing: (x: number) => {
            return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
          },
        });
      }
    });
  }, []);

  useEffect(() => {
    const onSearchHotkey = (data: { commandId: string; data: string }) => {
      if (data.commandId === 'editor:open-search') {
        if (typeof data.data === 'string') {
          setIsSearching(true);
          setSearchQuery(data.data);
          setDebouncedSearchQuery(data.data);
        } else {
          setIsSearching((val) => !val);
        }
      }
    };

    const showLaneForm = () => {
      setIsLaneFormVisible(true);
    };

    view.emitter.on('hotkey', onSearchHotkey);
    view.emitter.on('showLaneForm', showLaneForm);

    return () => {
      view.emitter.off('hotkey', onSearchHotkey);
      view.emitter.off('showLaneForm', showLaneForm);
    };
  }, [view]);

  useEffect(() => {
    if (isSearching) {
      searchRef.current?.focus();
    }
  }, [isSearching]);

  useEffect(() => {
    const win = view.getWindow();
    const trimmed = searchQuery.trim();
    let id: number;

    if (trimmed) {
      id = win.setTimeout(() => {
        setDebouncedSearchQuery(trimmed);
      }, 250);
    } else {
      setDebouncedSearchQuery('');
    }

    return () => {
      win.clearTimeout(id);
    };
  }, [searchQuery, view]);

  useEffect(() => {
    if (maxArchiveLength === undefined || maxArchiveLength === -1) {
      return;
    }

    if (typeof maxArchiveLength === 'number' && boardData?.data.archive.length > maxArchiveLength) {
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

  const boardModifiers = useMemo(() => {
    return getBoardModifiers(view, stateManager);
  }, [stateManager, view]);

  const kanbanContext = useMemo(() => {
    return {
      view,
      stateManager,
      boardModifiers,
      filePath,
    };
  }, [view, stateManager, boardModifiers, filePath, dateColors, tagColors]);

  const html5DragHandlers = createHTMLDndHandlers(stateManager);

  if (boardData === null || boardData === undefined)
    return (
      <div className={c('loading')}>
        <div className="sk-pulse"></div>
      </div>
    );

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

  const axis = boardView === 'list' ? 'vertical' : 'horizontal';
  const searchValue = useSearchValue(
    boardData,
    debouncedSearchQuery,
    setSearchQuery,
    setDebouncedSearchQuery,
    setIsSearching
  );

  const verticalLanes = useMemo(
    () => boardData.children.filter((l) => !l.data.isHorizontal),
    [boardData.children]
  );
  const horizontalLane = useMemo(
    () => boardData.children.find((l) => l.data.isHorizontal),
    [boardData.children]
  );
  const horizontalLaneIndex = useMemo(
    () => boardData.children.findIndex((l) => l.data.isHorizontal),
    [boardData.children]
  );

  return (
    <DndScope id={view.id}>
      <KanbanContext.Provider value={kanbanContext}>
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
            {(isLaneFormVisible || boardData.children.length === 0) && (
              <LaneForm onNewLane={onNewLane} closeLaneForm={closeLaneForm} />
            )}
            {isSearching && (
              <div className={c('search-wrapper')}>
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery((e.target as HTMLInputElement).value);
                  }}
                  onKeyDown={(e) => {
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
                    'has-backlog': !!horizontalLane,
                  },
                ])}
                triggerTypes={boardScrollTiggers}
              >
                <div>
                  <Sortable axis={axis}>
                    <Lanes lanes={verticalLanes} collapseDir={axis} />
                    <SortPlaceholder
                      accepts={boardAccepts}
                      className={c('lane-placeholder')}
                      index={boardData.children.length}
                    />
                  </Sortable>
                </div>
                {horizontalLane && (
                  <HorizontalLane
                    lane={horizontalLane}
                    laneIndex={horizontalLaneIndex}
                  />
                )}
              </ScrollContainer>
            )}
          </div>
        </SearchContext.Provider>
      </KanbanContext.Provider>
    </DndScope>
  );
};
