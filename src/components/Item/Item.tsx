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
import { Path } from 'src/dnd/types';
import { frontmatterKey } from 'src/parsers/common';

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

  const { itemIndex, ...innerProps } = props;

  const bindHandle = useDragHandle(measureRef, measureRef);

  const isMatch = search?.query ? innerProps.item.data.titleSearch.includes(search.query) : false;
  const classModifiers: string[] = getItemClassModifiers(innerProps.item);

  return (
    <div
      ref={(el) => {
        measureRef.current = el;
        bindHandle(el);
      }}
      className={c('item-wrapper')}
    >
      <div ref={elementRef} className={classcat([c('item'), ...classModifiers])}>
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

interface ItemInserterProps {
  laneIndex: number;
  insertIndex: number;
}

// Thin hover zone rendered inline between cards. Shows a '+' button to insert a
// new card at that position. Marked data-ignore-drag so a press here is ignored
// by the drag system (same mechanism the card's menu button uses) rather than
// blocking drag-and-drop.
function ItemInserter({ laneIndex, insertIndex }: ItemInserterProps) {
  const { boardModifiers, stateManager } = useContext(KanbanContext);

  const handleInsert = useCallback(() => {
    const path: Path = [laneIndex, insertIndex];
    boardModifiers.insertItems(path, [stateManager.getNewItem('', ' ', true)]);
  }, [boardModifiers, stateManager, laneIndex, insertIndex]);

  return (
    <div className={c('item-inserter')} data-ignore-drag={true}>
      <button
        className={c('item-inserter-button')}
        onClick={handleInsert}
        aria-label="Insert card here"
      >
        +
      </button>
    </div>
  );
}

interface ItemsProps {
  isStatic?: boolean;
  items: Item[];
  shouldMarkItemsComplete: boolean;
  laneIndex: number;
}

export const Items = memo(function Items({
  isStatic,
  items,
  shouldMarkItemsComplete,
  laneIndex,
}: ItemsProps) {
  const search = useContext(SearchContext);
  const { view, stateManager } = useContext(KanbanContext);
  const boardView = view.useViewState(frontmatterKey);
  const insertButtonEnabled = stateManager.useSetting('show-insert-card-button');

  // Inserters are opt-in (setting), and skipped in static/search views (indices
  // would be unreliable while filtered, and drag isn't active there anyway).
  const showInserters = !!insertButtonEnabled && !isStatic && !search?.query;

  return (
    <>
      {items.map((item, i) => {
        if (search?.query && !search.items.has(item)) return null;
        return [
          showInserters && (
            <ItemInserter key={`inserter-${item.id}`} laneIndex={laneIndex} insertIndex={i} />
          ),
          <DraggableItem
            key={boardView + item.id}
            item={item}
            itemIndex={i}
            shouldMarkItemsComplete={shouldMarkItemsComplete}
            isStatic={isStatic}
          />,
        ];
      })}
      {/* Trailing inserter after the last card (insert at end). */}
      {showInserters && items.length > 0 && (
        <ItemInserter key="inserter-end" laneIndex={laneIndex} insertIndex={items.length} />
      )}
    </>
  );
});
