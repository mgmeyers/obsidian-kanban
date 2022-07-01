import classcat from 'classcat';
import Preact from 'preact/compat';

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

const ItemInner = Preact.memo(function ItemInner({
  item,
  shouldMarkItemsComplete,
  isMatch,
  searchQuery,
}: ItemInnerProps) {
  const { stateManager, boardModifiers } = Preact.useContext(KanbanContext);
  const [isEditing, setIsEditing] = Preact.useState(false);

  const dndManager = Preact.useContext(DndManagerContext);

  Preact.useEffect(() => {
    const handler = () => {
      if (isEditing) setIsEditing(false);
    };

    dndManager.dragManager.emitter.on('dragStart', handler);

    return () => {
      dndManager.dragManager.emitter.off('dragStart', handler);
    };
  }, [dndManager, isEditing]);

  Preact.useEffect(() => {
    if (item.data.forceEditMode) {
      setIsEditing(true);
    }
  }, [item.data.forceEditMode]);

  const path = useNestedEntityPath();

  const showItemMenu = useItemMenu({
    boardModifiers,
    item,
    setIsEditing,
    stateManager,
    path,
  });

  const onContextMenu: Preact.JSX.MouseEventHandler<HTMLDivElement> =
    Preact.useCallback(
      (e) => {
        if (
          e.target instanceof
          (e.view as Window & typeof globalThis).HTMLTextAreaElement
        ) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const internalLinkPath =
          e.target instanceof
            (e.view as Window & typeof globalThis).HTMLAnchorElement &&
          e.target.hasClass('internal-link')
            ? e.target.dataset.href
            : undefined;

        showItemMenu(e, internalLinkPath);
      },
      [showItemMenu]
    );

  const onDoubleClick: Preact.JSX.MouseEventHandler<HTMLDivElement> =
    Preact.useCallback(() => {
      setIsEditing(true);
    }, [setIsEditing]);

  const ignoreAttr = Preact.useMemo(() => {
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

export const DraggableItem = Preact.memo(function DraggableItem(
  props: DraggableItemProps
) {
  const elementRef = Preact.useRef<HTMLDivElement>(null);
  const measureRef = Preact.useRef<HTMLDivElement>(null);
  const searchQuery = Preact.useContext(SearchContext);

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

export const Items = Preact.memo(function Items({
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
