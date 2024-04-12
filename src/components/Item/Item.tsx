import classcat from 'classcat';
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
import { Droppable, useNestedEntityPath } from 'src/dnd/components/Droppable';
import { DndManagerContext } from 'src/dnd/components/context';
import { useDragHandle } from 'src/dnd/managers/DragManager';

import { KanbanContext, SearchContext } from '../context';
import { c } from '../helpers';
import { EditState, EditingState, Item, isEditing } from '../types';
import { ItemCheckbox } from './ItemCheckbox';
import { ItemContent } from './ItemContent';
import { useItemMenu } from './ItemMenu';
import { ItemMenuButton } from './ItemMenuButton';
import { ItemMetadata } from './MetadataTable';
import { getItemClassModifiers } from './helpers';

export interface DraggableItemProps {
  item: Item;
  itemIndex: number;
  isStatic?: boolean;
  shouldMarkItemsComplete?: boolean;
  priority: number;
}

export interface ItemInnerProps {
  item: Item;
  isStatic?: boolean;
  shouldMarkItemsComplete?: boolean;
  isMatch?: boolean;
  searchQuery?: string;
  priority: number;
}

const ItemInner = memo(function ItemInner({
  item,
  shouldMarkItemsComplete,
  isMatch,
  searchQuery,
  priority,
}: ItemInnerProps) {
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const [editState, setEditState] = useState<EditState>(EditingState.cancel);

  const dndManager = useContext(DndManagerContext);

  useEffect(() => {
    const handler = () => {
      if (isEditing(editState)) setEditState(EditingState.cancel);
    };

    dndManager.dragManager.emitter.on('dragStart', handler);

    return () => {
      dndManager.dragManager.emitter.off('dragStart', handler);
    };
  }, [dndManager, editState]);

  useEffect(() => {
    if (item.data.forceEditMode) {
      setEditState({ x: 0, y: 0 });
    }
  }, [item.data.forceEditMode]);

  const path = useNestedEntityPath();

  const showItemMenu = useItemMenu({
    boardModifiers,
    item,
    setEditState: setEditState,
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
      setEditState({ x: e.clientX, y: e.clientY });
    },
    [setEditState]
  );

  const ignoreAttr = useMemo(() => {
    if (isEditing(editState)) {
      return {
        'data-ignore-drag': true,
      };
    }

    return {};
  }, [editState]);

  return (
    <div
      onContextMenu={onContextMenu}
      // eslint-disable-next-line react/no-unknown-property
      onDblClick={onDoubleClick}
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
          item={item}
          searchQuery={isMatch ? searchQuery : undefined}
          setEditState={setEditState}
          editState={editState}
          priority={priority}
        />
        <ItemMenuButton
          editState={editState}
          setEditState={setEditState}
          showMenu={showItemMenu}
        />
      </div>
      <ItemMetadata
        searchQuery={isMatch ? searchQuery : undefined}
        isSettingsVisible={!!editState}
        item={item}
      />
    </div>
  );
});

export const DraggableItem = memo(function DraggableItem(
  props: DraggableItemProps
) {
  const elementRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const searchQuery = useContext(SearchContext);

  const { itemIndex, ...innerProps } = props;

  useDragHandle(measureRef, measureRef);

  const isMatch = searchQuery
    ? innerProps.item.data.title.contains(searchQuery)
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
            priority={1000}
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

export const Items = memo(function Items({
  isStatic,
  items,
  shouldMarkItemsComplete,
}: ItemsProps) {
  const len = items.length;
  return (
    <>
      {items.map((item, i) => {
        return (
          <DraggableItem
            key={item.id}
            item={item}
            itemIndex={i}
            priority={len - i}
            shouldMarkItemsComplete={shouldMarkItemsComplete}
            isStatic={isStatic}
          />
        );
      })}
    </>
  );
});
