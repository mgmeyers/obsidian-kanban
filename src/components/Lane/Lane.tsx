import animateScrollTo from 'animated-scroll-to';
import classcat from 'classcat';
import update from 'immutability-helper';
import Preact from 'preact/compat';

import { Droppable, useNestedEntityPath } from 'src/dnd/components/Droppable';
import { ScrollContainer } from 'src/dnd/components/ScrollContainer';
import { Sortable } from 'src/dnd/components/Sortable';
import { SortPlaceholder } from 'src/dnd/components/SortPlaceholder';
import { useDragHandle } from 'src/dnd/managers/DragManager';

import { KanbanContext, SearchContext } from '../context';
import { c } from '../helpers';
import { Items } from '../Item/Item';
import { ItemForm } from '../Item/ItemForm';
import { DataTypes, Item, Lane } from '../types';
import { LaneHeader } from './LaneHeader';

const laneAccepts = [DataTypes.Item];

export interface DraggableLaneProps {
  lane: Lane;
  laneIndex: number;
  isStatic?: boolean;
}
export const DraggableLane = Preact.memo(function DraggableLane({
  isStatic,
  lane,
  laneIndex,
}: DraggableLaneProps) {
  const { stateManager, boardModifiers, view } =
    Preact.useContext(KanbanContext);
  const searchQuery = Preact.useContext(SearchContext);
  const [isItemInputVisible, setIsItemInputVisible] = Preact.useState(false);

  const path = useNestedEntityPath(laneIndex);
  const laneWidth = stateManager.useSetting('lane-width');
  const insertionMethod = stateManager.useSetting('new-card-insertion-method');
  const cardsBehaviorOnSearch = stateManager.useSetting(
    'cards-behavior-on-search'
  );
  const shouldMarkItemsComplete = !!lane.data.shouldMarkItemsComplete;

  const laneStyles = laneWidth ? { width: `${laneWidth}px` } : undefined;

  const elementRef = Preact.useRef<HTMLDivElement>(null);
  const measureRef = Preact.useRef<HTMLDivElement>(null);
  const dragHandleRef = Preact.useRef<HTMLDivElement>(null);
  const [isSorting, setIsSorting] = Preact.useState(false);

  const childrenAfterFiltering = Preact.useMemo(() => {
    if (cardsBehaviorOnSearch !== 'hide' || !searchQuery) return lane.children;
    const searchQueryLowercase = searchQuery.toLowerCase();
    return lane.children.filter((child) =>
      child.data.titleSearch.toLowerCase().includes(searchQueryLowercase)
    );
  }, [cardsBehaviorOnSearch, searchQuery, lane.children]);

  const isCompactPrepend = insertionMethod === 'prepend-compact';
  const shouldPrepend = isCompactPrepend || insertionMethod === 'prepend';

  useDragHandle(measureRef, dragHandleRef);

  const addItems = (items: Item[]) => {
    boardModifiers[shouldPrepend ? 'prependItems' : 'appendItems'](
      [...path, lane.children.length - 1],
      items.map((item) =>
        update(item, {
          data: {
            isComplete: {
              // Mark the item complete if we're moving into a completed lane
              $set: shouldMarkItemsComplete,
            },
          },
        })
      )
    );

    // TODO: can we find a less brute force way to do this?
    view.getWindow().setTimeout(() => {
      const laneItems = elementRef.current?.getElementsByClassName(
        c('lane-items')
      );

      if (laneItems.length) {
        animateScrollTo([0, shouldPrepend ? 0 : laneItems[0].scrollHeight], {
          elementToScroll: laneItems[0],
          speed: 200,
          minDuration: 150,
          easing: (x: number) => {
            return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
          },
        });
      }
    });
  };

  const laneContent = (
    <>
      <Items
        items={childrenAfterFiltering}
        isStatic={isStatic}
        shouldMarkItemsComplete={shouldMarkItemsComplete}
      />
      <SortPlaceholder
        accepts={laneAccepts}
        index={lane.children.length}
        isStatic={isStatic}
      />
    </>
  );

  const laneBody = (
    <ScrollContainer
      id={lane.id}
      index={laneIndex}
      className={classcat([c('lane-items'), c('vertical')])}
      triggerTypes={laneAccepts}
      isStatic={isStatic}
    >
      {isStatic ? (
        laneContent
      ) : (
        <Sortable onSortChange={setIsSorting} axis="vertical">
          {laneContent}
        </Sortable>
      )}
    </ScrollContainer>
  );

  return (
    <div
      ref={measureRef}
      className={classcat([
        c('lane-wrapper'),
        {
          'is-sorting': isSorting,
        },
      ])}
      style={laneStyles}
    >
      <div
        data-count={lane.children.length}
        ref={elementRef}
        className={classcat([c('lane'), { 'will-prepend': shouldPrepend }])}
      >
        <LaneHeader
          dragHandleRef={dragHandleRef}
          laneIndex={laneIndex}
          lane={lane}
          setIsItemInputVisible={
            isCompactPrepend ? setIsItemInputVisible : undefined
          }
        />

        {shouldPrepend && (
          <ItemForm
            addItems={addItems}
            hideButton={isCompactPrepend}
            isInputVisible={isItemInputVisible}
            setIsInputVisible={setIsItemInputVisible}
          />
        )}

        {isStatic ? (
          laneBody
        ) : (
          <Droppable
            elementRef={elementRef}
            measureRef={measureRef}
            id={lane.id}
            index={laneIndex}
            data={lane}
          >
            {laneBody}
          </Droppable>
        )}

        {!shouldPrepend && (
          <ItemForm
            addItems={addItems}
            isInputVisible={isItemInputVisible}
            setIsInputVisible={setIsItemInputVisible}
          />
        )}
      </div>
    </div>
  );
});

export interface Lanes {
  lanes: Lane[];
}

export const Lanes = Preact.memo(function Lanes({ lanes }: Lanes) {
  return (
    <>
      {lanes.map((lane, i) => {
        return <DraggableLane lane={lane} laneIndex={i} key={lane.id} />;
      })}
    </>
  );
});
