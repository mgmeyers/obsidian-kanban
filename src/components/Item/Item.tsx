import classcat from 'classcat';
import React from 'react';

import { DndManagerContext } from 'src/dnd/components/context';
import { Droppable, useNestedEntityPath } from 'src/dnd/components/Droppable';
import { useDragHandle } from 'src/dnd/managers/DragManager';

import { KanbanContext, SearchContext } from '../context';
import { c } from '../helpers';
import { Item } from '../types';
import { getItemClassModifiers } from './helpers';
import { ItemCheckbox } from './ItemCheckbox';
import { ItemContent } from './ItemContent';
import { useItemMenu } from './ItemMenu';
import { ItemMenuButton } from './ItemMenuButton';
import { ItemMetadata } from './MetadataTable';

export interface DraggableItemProps {
  item: Item;
  itemIndex: number;
  isStatic?: boolean;
  shouldMarkItemsComplete?: boolean;
}

export interface ItemInnerProps {
  item: Item;
  isStatic?: boolean;
  shouldMarkItemsComplete?: boolean;
  isMatch?: boolean;
  searchQuery?: string;
}

const ItemInner = React.memo(function ItemInner({
  item,
  shouldMarkItemsComplete,
  isMatch,
  searchQuery,
}: ItemInnerProps) {
  const { stateManager, boardModifiers } = React.useContext(KanbanContext);
  const [isEditing, setIsEditing] = React.useState(false);

  const dndManager = React.useContext(DndManagerContext);

  React.useEffect(() => {
    const handler = () => {
      if (isEditing) setIsEditing(false);
    };

    dndManager.dragManager.emitter.on('dragStart', handler);

    return () => {
      dndManager.dragManager.emitter.off('dragStart', handler);
    };
  }, [dndManager, isEditing]);

  const path = useNestedEntityPath();

  const showItemMenu = useItemMenu({
    boardModifiers,
    item,
    setIsEditing,
    stateManager,
    path,
  });

  const onContextMenu: React.MouseEventHandler = React.useCallback(
    (e) => {
      if (e.target instanceof HTMLTextAreaElement) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const internalLinkPath =
        e.target instanceof HTMLAnchorElement &&
        e.target.hasClass('internal-link')
          ? e.target.dataset.href
          : undefined;

      showItemMenu(e.nativeEvent, internalLinkPath);
    },
    [showItemMenu]
  );

  const onDoubleClick: React.MouseEventHandler = React.useCallback(() => {
    setIsEditing(true);
  }, [setIsEditing]);

  const ignoreAttr = React.useMemo(() => {
    if (isEditing) {
      return {
        'data-ignore-drag': true,
      };
    }

    return {};
  }, [isEditing]);

  return (
    <div
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      className={c('item-content-wrapper')}
      {...ignoreAttr}
    >
      <div className={c('item-title-wrapper')} {...ignoreAttr}>
        <ItemCheckbox
          boardModifiers={boardModifiers}
          item={item}
          path={path}
          shouldMarkItemsComplete={shouldMarkItemsComplete}
          stateManager={stateManager}
        />
        <ItemContent
          isEditing={isEditing}
          item={item}
          searchQuery={isMatch ? searchQuery : undefined}
          setIsEditing={setIsEditing}
        />
        <ItemMenuButton
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          showMenu={showItemMenu}
        />
      </div>
      <ItemMetadata
        searchQuery={isMatch ? searchQuery : undefined}
        isSettingsVisible={isEditing}
        item={item}
      />
    </div>
  );
});

export const DraggableItem = React.memo(function DraggableItem(
  props: DraggableItemProps
) {
  const elementRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const searchQuery = React.useContext(SearchContext);

  const { itemIndex, ...innerProps } = props;

  useDragHandle(measureRef, measureRef);

  const isMatch = searchQuery
    ? innerProps.item.data.titleSearch.contains(searchQuery)
    : false;

  const classModifiers: string[] = getItemClassModifiers(innerProps.item);

  if (searchQuery) {
    if (isMatch) {
      classModifiers.push('is-search-hit');
    } else {
      classModifiers.push('is-search-miss');
    }
  }

  return (
    <div ref={measureRef} className={c('item-wrapper')}>
      <div
        ref={elementRef}
        className={classcat([c('item'), ...classModifiers])}
      >
        {props.isStatic ? (
          <ItemInner
            {...innerProps}
            isMatch={isMatch}
            searchQuery={searchQuery}
          />
        ) : (
          <Droppable
            elementRef={elementRef}
            measureRef={measureRef}
            id={props.item.id}
            index={itemIndex}
            data={props.item}
          >
            <ItemInner
              {...innerProps}
              isMatch={isMatch}
              searchQuery={searchQuery}
            />
          </Droppable>
        )}
      </div>
    </div>
  );
});

interface ItemsProps {
  isStatic?: boolean;
  items: Item[];
  shouldMarkItemsComplete: boolean;
}

export const Items = React.memo(function Items({
  isStatic,
  items,
  shouldMarkItemsComplete,
}: ItemsProps) {
  return (
    <>
      {items.map((item, i) => {
        return (
          <DraggableItem
            key={item.id}
            item={item}
            itemIndex={i}
            shouldMarkItemsComplete={shouldMarkItemsComplete}
            isStatic={isStatic}
          />
        );
      })}
    </>
  );
});
