import animateScrollTo from 'animated-scroll-to';
import classcat from 'classcat';
import update from 'immutability-helper';
import { Fragment, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/compat';
import {
  DraggableProps,
  Droppable,
  StaticDroppable,
  useNestedEntityPath,
} from 'src/dnd/components/Droppable';
import { ExplicitPathContext } from 'src/dnd/components/context';
import { ScrollContainer } from 'src/dnd/components/ScrollContainer';
import { SortPlaceholder } from 'src/dnd/components/SortPlaceholder';
import { Sortable, StaticSortable } from 'src/dnd/components/Sortable';
import { useDragHandle } from 'src/dnd/managers/DragManager';
import { frontmatterKey } from 'src/parsers/common';
import { getTaskStatusDone } from 'src/parsers/helpers/inlineMetadata';
import { t } from 'src/lang/helpers';

import { Items } from '../Item/Item';
import { ItemForm } from '../Item/ItemForm';
import { Icon } from '../Icon/Icon';
import { KanbanContext, SearchContext, SortContext } from '../context';
import { c, generateInstanceId } from '../helpers';
import { DataTypes, EditState, EditingState, Item, Lane } from '../types';
import { LaneHeader } from './LaneHeader';
import { useSettingsMenu } from './LaneMenu';

const laneAccepts = [DataTypes.Item];

export interface DraggableLaneProps {
  lane: Lane;
  laneIndex: number;
  isStatic?: boolean;
  collapseDir: 'horizontal' | 'vertical';
  isCollapsed?: boolean;
}

function DraggableLaneRaw({
  isStatic,
  lane,
  laneIndex,
  collapseDir,
  isCollapsed = false,
}: DraggableLaneProps) {
  const [editState, setEditState] = useState<EditState>(EditingState.cancel);
  const [isSorting, setIsSorting] = useState(false);

  const { stateManager, boardModifiers, view } = useContext(KanbanContext);
  const search = useContext(SearchContext);

  const boardView = view.useViewState(frontmatterKey);
  const path = useNestedEntityPath(laneIndex);
  const laneWidth = stateManager.useSetting('lane-width');
  const fullWidth = boardView === 'list' && stateManager.useSetting('full-list-lane-width');
  const insertionMethod = stateManager.useSetting('new-card-insertion-method');
  const laneStyles = useMemo(
    () =>
      !(isCollapsed && collapseDir === 'horizontal') && (fullWidth || laneWidth)
        ? { width: fullWidth ? '100%' : `${laneWidth}px` }
        : undefined,
    [fullWidth, laneWidth, isCollapsed]
  );

  const elementRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const bindHandle = useDragHandle(measureRef, dragHandleRef);

  const shouldMarkItemsComplete = !!lane.data.shouldMarkItemsComplete;
  const isCompactPrepend = insertionMethod === 'prepend-compact';
  const shouldPrepend = isCompactPrepend || insertionMethod === 'prepend';

  const toggleIsCollapsed = useCallback(() => {
    stateManager.setState((board) => {
      const collapseState = [...view.getViewState('list-collapse')];
      collapseState[laneIndex] = !collapseState[laneIndex];
      view.setViewState('list-collapse', collapseState);
      return update(board, {
        data: { settings: { 'list-collapse': { $set: collapseState } } },
      });
    });
  }, [stateManager, laneIndex]);

  const addItems = useCallback(
    (items: Item[]) => {
      boardModifiers[shouldPrepend ? 'prependItems' : 'appendItems'](
        [...path, lane.children.length - 1],
        items.map((item) =>
          update(item, {
            data: {
              checked: {
                // Mark the item complete if we're moving into a completed lane
                $set: shouldMarkItemsComplete,
              },
              checkChar: {
                $set: shouldMarkItemsComplete ? getTaskStatusDone() : ' ',
              },
            },
          })
        )
      );

      // TODO: can we find a less brute force way to do this?
      view.getWindow().setTimeout(() => {
        const laneItems = elementRef.current?.getElementsByClassName(c('lane-items'));

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
    },
    [boardModifiers, path, lane, shouldPrepend]
  );

  const DroppableComponent = isStatic ? StaticDroppable : Droppable;
  const SortableComponent = isStatic ? StaticSortable : Sortable;
  const CollapsedDropArea = !isCollapsed || isStatic ? Fragment : Droppable;
  const dropAreaProps: DraggableProps = useMemo(() => {
    if (!isCollapsed || isStatic) return {} as any;
    const data = {
      id: generateInstanceId(),
      type: 'lane',
      accepts: [DataTypes.Item],
      acceptsSort: [DataTypes.Lane],
    };
    return {
      elementRef: elementRef,
      measureRef: measureRef,
      id: data.id,
      index: laneIndex,
      data: data,
    };
  }, [isCollapsed, laneIndex, isStatic]);

  return (
    <SortContext.Provider value={lane.data.sorted ?? null}>
      <div
        ref={measureRef}
        className={classcat([
          c('lane-wrapper'),
          {
            'is-sorting': isSorting,
            'collapse-horizontal': isCollapsed && collapseDir === 'horizontal',
            'collapse-vertical': isCollapsed && collapseDir === 'vertical',
          },
        ])}
        style={laneStyles}
      >
        <div
          data-count={lane.children.length}
          ref={elementRef}
          className={classcat([c('lane'), { 'will-prepend': shouldPrepend }])}
        >
          <CollapsedDropArea {...dropAreaProps}>
            <LaneHeader
              bindHandle={bindHandle}
              laneIndex={laneIndex}
              lane={lane}
              setIsItemInputVisible={isCompactPrepend ? setEditState : undefined}
              isCollapsed={isCollapsed}
              toggleIsCollapsed={toggleIsCollapsed}
            />

            {!search?.query && !isCollapsed && shouldPrepend && (
              <ItemForm
                addItems={addItems}
                hideButton={isCompactPrepend}
                editState={editState}
                setEditState={setEditState}
              />
            )}

            {!isCollapsed && (
              <DroppableComponent
                elementRef={elementRef}
                measureRef={measureRef}
                id={lane.id}
                index={laneIndex}
                data={lane}
              >
                <ScrollContainer
                  className={classcat([c('lane-items'), c('vertical')])}
                  id={lane.id}
                  index={laneIndex}
                  isStatic={isStatic}
                  triggerTypes={laneAccepts}
                >
                  <SortableComponent onSortChange={setIsSorting} axis="vertical">
                    <Items
                      items={lane.children}
                      isStatic={isStatic}
                      shouldMarkItemsComplete={shouldMarkItemsComplete}
                    />
                    <SortPlaceholder
                      accepts={laneAccepts}
                      index={lane.children.length}
                      isStatic={isStatic}
                    />
                  </SortableComponent>
                </ScrollContainer>
              </DroppableComponent>
            )}

            {!search?.query && !isCollapsed && !shouldPrepend && (
              <ItemForm addItems={addItems} editState={editState} setEditState={setEditState} />
            )}
          </CollapsedDropArea>
        </div>
      </div>
    </SortContext.Provider>
  );
}

export const DraggableLane = memo(DraggableLaneRaw);

export interface HorizontalLaneProps {
  lane: Lane;
  laneIndex: number;
}

function HorizontalLaneRaw({ lane, laneIndex }: HorizontalLaneProps) {
  const [editState, setEditState] = useState<EditState>(EditingState.cancel);
  const [isSorting, setIsSorting] = useState(false);

  const { stateManager, boardModifiers, view } = useContext(KanbanContext);
  const search = useContext(SearchContext);

  const explicitPath = useMemo(() => [laneIndex], [laneIndex]);

  const shouldMarkItemsComplete = !!lane.data.shouldMarkItemsComplete;

  const { settingsMenu } = useSettingsMenu({
    setEditState,
    path: explicitPath,
    lane,
  });

  const elementRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const scrollContainer = wrapper.closest(`.${c('scroll-container')}`) as HTMLElement;
    if (!scrollContainer) return;

    const updateWidth = () => {
      wrapper.style.setProperty('--backlog-width', `${scrollContainer.clientWidth}px`);
    };
    updateWidth();

    const ro = new ResizeObserver(updateWidth);
    ro.observe(scrollContainer);
    return () => ro.disconnect();
  }, []);

  const addItems = useCallback(
    (items: Item[]) => {
      boardModifiers.appendItems(
        [...explicitPath, lane.children.length - 1],
        items.map((item) =>
          update(item, {
            data: {
              checked: { $set: shouldMarkItemsComplete },
              checkChar: { $set: shouldMarkItemsComplete ? getTaskStatusDone() : ' ' },
            },
          })
        )
      );
    },
    [boardModifiers, explicitPath, lane, shouldMarkItemsComplete]
  );

  return (
    <ExplicitPathContext.Provider value={explicitPath}>
      <SortContext.Provider value={lane.data.sorted ?? null}>
        <div ref={wrapperRef} className={c('horizontal-lane')}>
          <div className={c('horizontal-lane-header')}>
            <span className={c('horizontal-lane-title')}>{lane.data.title}</span>
            <span className={c('horizontal-lane-count')}>{lane.children.length}</span>
            <a
              aria-label={t('More options')}
              className={`${c('lane-settings-button')} clickable-icon`}
              onClick={(e) => settingsMenu.showAtMouseEvent(e)}
            >
              <Icon name="lucide-more-vertical" />
            </a>
          </div>
          <div className={c('horizontal-lane-body')}>
            <div className={c('horizontal-lane-sidebar')} />
            <div className={c('horizontal-lane-content')} ref={elementRef}>
              <Droppable
                elementRef={elementRef}
                measureRef={elementRef}
                id={lane.id}
                index={laneIndex}
                data={lane}
              >
                <Sortable onSortChange={setIsSorting} axis="vertical">
                  <Items
                    items={lane.children}
                    isStatic={false}
                    shouldMarkItemsComplete={shouldMarkItemsComplete}
                  />
                  <SortPlaceholder
                    accepts={laneAccepts}
                    index={lane.children.length}
                  />
                </Sortable>
              </Droppable>
              {!search?.query && (
                <ItemForm addItems={addItems} editState={editState} setEditState={setEditState} />
              )}
            </div>
          </div>
        </div>
      </SortContext.Provider>
    </ExplicitPathContext.Provider>
  );
}

export const HorizontalLane = memo(HorizontalLaneRaw);

export interface LanesProps {
  lanes: Lane[];
  collapseDir: 'horizontal' | 'vertical';
}

function LanesRaw({ lanes, collapseDir }: LanesProps) {
  const search = useContext(SearchContext);
  const { view } = useContext(KanbanContext);
  const boardView = view.useViewState(frontmatterKey) || 'board';
  const collapseState = view.useViewState('list-collapse') || [];

  return (
    <>
      {lanes.map((lane, i) => {
        return (
          <DraggableLane
            collapseDir={collapseDir}
            isCollapsed={(search?.query && !search.lanes.has(lane)) || !!collapseState[i]}
            key={boardView + lane.id}
            lane={lane}
            laneIndex={i}
          />
        );
      })}
    </>
  );
}

export const Lanes = memo(LanesRaw);
