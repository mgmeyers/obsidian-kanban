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
import { frontmatterKey } from 'src/parsers/common';

import { KanbanContext, SearchContext } from '../context';
import { c } from '../helpers';
import { Category, EditState, EditingState, Item, isEditing } from '../types';
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
}

export interface ItemInnerProps {
  item: Item;
  isStatic?: boolean;
  shouldMarkItemsComplete?: boolean;
  isMatch?: boolean;
  searchQuery?: string;
}

const ItemInner = memo(function ItemInner({
  item,
  shouldMarkItemsComplete,
  isMatch,
  searchQuery,
  isStatic,
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

  const onDoubleClick: JSX.MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => setEditState({ x: e.clientX, y: e.clientY }),
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
      // eslint-disable-next-line react/no-unknown-property
      onDblClick={onDoubleClick}
      onContextMenu={onContextMenu}
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
          isStatic={isStatic}
        />
        <ItemMenuButton editState={editState} setEditState={setEditState} showMenu={showItemMenu} />
      </div>
      <ItemMetadata searchQuery={isMatch ? searchQuery : undefined} item={item} />
    </div>
  );
});

export const DraggableItem = memo(function DraggableItem(props: DraggableItemProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const search = useContext(SearchContext);
  const { stateManager } = useContext(KanbanContext);

  const { itemIndex, ...innerProps } = props;

  const bindHandle = useDragHandle(measureRef, measureRef);

  const isMatch = search?.query ? innerProps.item.data.titleSearch.includes(search.query) : false;
  const classModifiers: string[] = getItemClassModifiers(innerProps.item);

  const categoryStyle = useMemo(() => {
    const catName = innerProps.item.data.metadata.category;
    if (!catName) return undefined;
    const categories = (stateManager.getSetting('categories') as Category[]) || [];
    const cat = categories.find((c) => c.name === catName);
    if (!cat) return undefined;
    return { '--category-color': cat.color } as any;
  }, [innerProps.item.data.metadata.category, stateManager]);

  return (
    <div
      ref={(el) => {
        measureRef.current = el;
        bindHandle(el);
      }}
      className={c('item-wrapper')}
    >
      <div ref={elementRef} className={classcat([c('item'), ...classModifiers])} style={categoryStyle}>
        {props.isStatic ? (
          <ItemInner
            {...innerProps}
            isMatch={isMatch}
            searchQuery={search?.query}
            isStatic={true}
          />
        ) : (
          <Droppable
            elementRef={elementRef}
            measureRef={measureRef}
            id={props.item.id}
            index={itemIndex}
            data={props.item}
          >
            <ItemInner {...innerProps} isMatch={isMatch} searchQuery={search?.query} />
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

export const Items = memo(function Items({ isStatic, items, shouldMarkItemsComplete }: ItemsProps) {
  const search = useContext(SearchContext);
  const { view } = useContext(KanbanContext);
  const boardView = view.useViewState(frontmatterKey);

  return (
    <>
      {items.map((item, i) => {
        return search?.query && !search.items.has(item) ? null : (
          <DraggableItem
            key={boardView + item.id}
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
