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
  const { onEditDate, onEditTime } = useDatePickers(item.item, item.path);
  const getDateColor = useGetDateColorFn(stateManager);

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
});

export const ItemCell = memo(
  function ItemCell({ item, lane, path }: { item: Item; lane: Lane; path: number[] }) {
    const { stateManager, boardModifiers } = useContext(KanbanContext);
    const search = useContext(SearchContext);
    const [editState, setEditState] = useState<EditState>(null);
    const shouldMarkItemsComplete = !!lane.data.shouldMarkItemsComplete;

    const showItemMenu = useItemMenu({
      boardModifiers,
      item,
      setEditState,
      stateManager,
      path,
    });

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

    const onDoubleClick: JSX.MouseEventHandler<HTMLDivElement> = useCallback((e) => {
      setEditState({ x: e.clientX, y: e.clientY });
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
  (prev, next) => {
    return (
      prev.lane.data.shouldMarkItemsComplete === next.lane.data.shouldMarkItemsComplete &&
      isEqual(prev.item, next.item) &&
      isEqual(prev.path, next.path)
    );
  }
);

export const LaneCell = memo(function LaneCell({ lane, path }: { lane: Lane; path: number[] }) {
  const { stateManager } = useContext(KanbanContext);
  const search = useContext(SearchContext);
  return (
    <div className={c('cell-flex-wrapper')}>
      <MarkdownRenderer searchQuery={search?.query} markdownString={lane.data.title} />
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
});
