import classcat from 'classcat';
import React from 'react';

import { Droppable, useNestedEntityPath } from 'src/dnd/components/Droppable';
import { useDragHandle } from 'src/dnd/managers/DragManager';
import { Path } from 'src/dnd/types';
import { StateManager } from 'src/StateManager';

import { KanbanContext, SearchContext } from '../context';
import { c } from '../helpers';
import { BoardModifiers } from '../helpers/boardModifiers';
import { Item } from '../types';
import { getItemClassModifiers } from './helpers';
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
  constructMenuTimePickerOnChange,
  constructTimePicker,
} from './helpers';
import { ItemCheckbox } from './ItemCheckbox';
import { ItemContent } from './ItemContent';
import { useItemMenu } from './ItemMenu';
import { ItemMenuButton } from './ItemMenuButton';
import { ItemMetadata } from './MetadataTable';

interface UseItemContentEventsParams {
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
  path: Path;
  item: Item;
}

function useItemContentEvents({
  boardModifiers,
  path,
  item,
  stateManager,
}: UseItemContentEventsParams) {
  return React.useMemo(() => {
    const onContentChange: React.ChangeEventHandler<HTMLTextAreaElement> = (
      e
    ) => {
      boardModifiers.updateItem(
        path,
        stateManager.parser.updateItem(item, e.target.value)
      );
    };

    const onEditDate: React.MouseEventHandler = (e) => {
      constructDatePicker(
        { x: e.clientX, y: e.clientY },
        constructMenuDatePickerOnChange({
          stateManager,
          boardModifiers,
          item,
          hasDate: true,
          path,
        }),
        item.data.metadata.date?.toDate()
      );
    };

    const onEditTime: React.MouseEventHandler = (e) => {
      constructTimePicker(
        stateManager,
        { x: e.clientX, y: e.clientY },
        constructMenuTimePickerOnChange({
          stateManager,
          boardModifiers,
          item,
          hasTime: true,
          path,
        }),
        item.data.metadata.time
      );
    };

    return {
      onContentChange,
      onEditDate,
      onEditTime,
    };
  }, [boardModifiers, path, item, stateManager]);
}

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

  const path = useNestedEntityPath();

  const showItemMenu = useItemMenu({
    boardModifiers,
    item,
    setIsEditing,
    stateManager,
    path,
  });

  const contentEvents = useItemContentEvents({
    boardModifiers,
    item,
    path,
    stateManager,
  });

  const onContextMenu: React.MouseEventHandler = React.useCallback(
    (e) => {
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
          isSettingsVisible={isEditing}
          item={item}
          onChange={contentEvents.onContentChange}
          onEditDate={contentEvents.onEditDate}
          onEditTime={contentEvents.onEditTime}
          searchQuery={isMatch ? searchQuery : undefined}
          setIsSettingsVisible={setIsEditing}
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
