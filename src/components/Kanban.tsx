import animateScrollTo from 'animated-scroll-to';
import classcat from 'classcat';
import update from 'immutability-helper';
import { TFile, moment } from 'obsidian';
import {
  appHasDailyNotesPluginLoaded,
  createDailyNote,
} from 'obsidian-daily-notes-interface';
import Preact from 'preact/compat';

import { useIsAnythingDragging } from 'src/dnd/components/DragOverlay';
import { ScrollContainer } from 'src/dnd/components/ScrollContainer';
import { Sortable } from 'src/dnd/components/Sortable';
import { SortPlaceholder } from 'src/dnd/components/SortPlaceholder';
import { createHTMLDndHandlers } from 'src/dnd/managers/DragManager';
import { getNormalizedPath } from 'src/helpers/renderMarkdown';
import { KanbanView } from 'src/KanbanView';
import { t } from 'src/lang/helpers';
import { StateManager } from 'src/StateManager';

import { DndScope } from '../dnd/components/Scope';
import { getBoardModifiers } from '../helpers/boardModifiers';
import { frontMatterKey } from '../parsers/common';
import { KanbanContext, SearchContext } from './context';
import { baseClassName, c } from './helpers';
import { Icon } from './Icon/Icon';
import { Lanes } from './Lane/Lane';
import { LaneForm } from './Lane/LaneForm';
import { DataTypes } from './types';

const boardScrollTiggers = [DataTypes.Item, DataTypes.Lane];
const boardAccepts = [DataTypes.Lane];

interface KanbanProps {
  stateManager: StateManager;
  view: KanbanView;
}

export const Kanban = ({ view, stateManager }: KanbanProps) => {
  const boardData = stateManager.useState();
  const isAnythingDragging = useIsAnythingDragging();

  const rootRef = Preact.useRef<HTMLDivElement>(null);
  const searchRef = Preact.useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = Preact.useState<string>('');
  const [isSearching, setIsSearching] = Preact.useState<boolean>(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] =
    Preact.useState<string>('');

  const [isLaneFormVisible, setIsLaneFormVisible] = Preact.useState<boolean>(
    boardData?.children.length === 0
  );

  const filePath = stateManager.file.path;
  const maxArchiveLength = stateManager.useSetting('max-archive-size');

  const closeLaneForm = Preact.useCallback(() => {
    if (boardData?.children.length > 0) {
      setIsLaneFormVisible(false);
    }
  }, [boardData?.children.length]);

  Preact.useEffect(() => {
    if (boardData?.children.length === 0) {
      setIsLaneFormVisible(true);
    }
  }, [boardData?.children.length]);

  const onNewLane = Preact.useCallback(() => {
    setTimeout(() => {
      const board = rootRef.current?.getElementsByClassName(c('board'));

      if (board.length) {
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

  Preact.useEffect(() => {
    const onSearchHotkey = (e: string) => {
      if (e === 'editor:open-search') {
        setIsSearching((val) => !val);
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

  Preact.useEffect(() => {
    if (isSearching) {
      searchRef.current?.focus();
    }
  }, [isSearching]);

  Preact.useEffect(() => {
    const trimmed = searchQuery.trim();
    let id: number;

    if (trimmed) {
      id = window.setTimeout(() => {
        setDebouncedSearchQuery(trimmed);
      }, 250);
    } else {
      setDebouncedSearchQuery('');
    }

    return () => {
      window.clearTimeout(id);
    };
  }, [searchQuery]);

  Preact.useEffect(() => {
    if (maxArchiveLength === undefined || maxArchiveLength === -1) {
      return;
    }

    if (
      typeof maxArchiveLength === 'number' &&
      boardData?.data.archive.length > maxArchiveLength
    ) {
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

  const boardModifiers = Preact.useMemo(() => {
    return getBoardModifiers(stateManager);
  }, [stateManager]);

  const onMouseOver = Preact.useCallback(
    (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement;

      if (targetEl.tagName !== 'A') return;

      if (targetEl.hasClass('internal-link')) {
        view.app.workspace.trigger('hover-link', {
          event: e,
          source: frontMatterKey,
          hoverParent: view,
          targetEl,
          linktext: targetEl.getAttr('href'),
          sourcePath: view.file.path,
        });
      }
    },
    [view]
  );

  const onClick = Preact.useCallback(
    async (e: MouseEvent) => {
      if (e.type === 'auxclick' && e.button == 2) {
        return;
      }

      const targetEl = e.target as HTMLElement;
      const closestAnchor =
        targetEl.tagName === 'A' ? targetEl : targetEl.closest('a');

      if (!closestAnchor) return;

      if (closestAnchor.hasClass('file-link')) {
        e.preventDefault();
        const href = closestAnchor.getAttribute('href');
        const normalizedPath = getNormalizedPath(href);
        const target =
          typeof href === 'string' &&
          view.app.metadataCache.getFirstLinkpathDest(
            normalizedPath.root,
            view.file.path
          );

        if (!target) return;

        (stateManager.app as any).openWithDefaultApp(target.path);

        return;
      }

      // Open an internal link in a new pane
      if (closestAnchor.hasClass('internal-link')) {
        e.preventDefault();
        const destination = closestAnchor.getAttr('href');
        const inNewLeaf = e.button === 1 || e.ctrlKey || e.metaKey;
        const isUnresolved = closestAnchor.hasClass('is-unresolved');

        if (isUnresolved && appHasDailyNotesPluginLoaded()) {
          const dateFormat = stateManager.getSetting('date-format');
          const parsed = moment(destination, dateFormat, true);

          if (parsed.isValid()) {
            try {
              const dailyNote = await createDailyNote(parsed);
              const leaf = inNewLeaf
                ? view.app.workspace.splitActiveLeaf()
                : view.app.workspace.getUnpinnedLeaf();

              await leaf.openFile(dailyNote as TFile, { active: true });
            } catch (e) {
              console.error(e);
              stateManager.setError(e);
            }
            return;
          }
        }

        stateManager.app.workspace.openLinkText(
          destination,
          filePath,
          inNewLeaf
        );

        return;
      }

      // Open a tag search
      if (closestAnchor.hasClass('tag')) {
        e.preventDefault();
        (stateManager.app as any).internalPlugins
          .getPluginById('global-search')
          .instance.openGlobalSearch(`tag:${closestAnchor.getAttr('href')}`);

        return;
      }

      // Open external link
      if (closestAnchor.hasClass('external-link')) {
        e.preventDefault();
        window.open(closestAnchor.getAttr('href'), '_blank');
      }
    },
    [stateManager, filePath]
  );

  const kanbanContext = Preact.useMemo(() => {
    return {
      view,
      stateManager,
      boardModifiers,
      filePath,
    };
  }, [view, stateManager, boardModifiers, filePath]);

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

  return (
    <DndScope id={view.id}>
      <KanbanContext.Provider value={kanbanContext}>
        <SearchContext.Provider
          value={
            debouncedSearchQuery
              ? debouncedSearchQuery.toLocaleLowerCase()
              : null
          }
        >
          <div
            ref={rootRef}
            className={classcat([
              baseClassName,
              {
                'something-is-dragging': isAnythingDragging,
              },
            ])}
            onMouseOver={onMouseOver}
            onClick={onClick}
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            onAuxClick={onClick}
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
                <button
                  className={c('search-cancel-button')}
                  onClick={() => {
                    setSearchQuery('');
                    setDebouncedSearchQuery('');
                    setIsSearching(false);
                  }}
                  aria-label={t('Cancel')}
                >
                  <Icon name="cross" />
                </button>
              </div>
            )}
            <ScrollContainer
              id={view.id}
              className={classcat([
                c('board'),
                c('horizontal'),
                {
                  'is-adding-lane': isLaneFormVisible,
                },
              ])}
              triggerTypes={boardScrollTiggers}
            >
              <div>
                <Sortable axis="horizontal">
                  <Lanes lanes={boardData.children} />
                  <SortPlaceholder
                    className={c('lane-placeholder')}
                    accepts={boardAccepts}
                    index={boardData.children.length}
                  />
                </Sortable>
              </div>
            </ScrollContainer>
          </div>
        </SearchContext.Provider>
      </KanbanContext.Provider>
    </DndScope>
  );
};
