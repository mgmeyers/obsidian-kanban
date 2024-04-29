import classcat from 'classcat';
import update from 'immutability-helper';
import { JSX, createPortal, memo, useCallback, useMemo } from 'preact/compat';

import { KanbanView } from './KanbanView';
import { DraggableItem } from './components/Item/Item';
import { DraggableLane } from './components/Lane/Lane';
import { KanbanContext } from './components/context';
import { c, getDateColorFn, getTagColorFn, maybeCompleteForMove } from './components/helpers';
import { Board, DataTypes, Item, Lane } from './components/types';
import { DndContext } from './dnd/components/DndContext';
import { DragOverlay } from './dnd/components/DragOverlay';
import { Entity } from './dnd/types';
import {
  getEntityFromPath,
  insertEntity,
  moveEntity,
  removeEntity,
  updateEntity,
} from './dnd/util/data';
import { getBoardModifiers } from './helpers/boardModifiers';
import KanbanPlugin from './main';
import { frontmatterKey } from './parsers/common';

export function createApp(win: Window, plugin: KanbanPlugin) {
  return <DragDropApp win={win} plugin={plugin} />;
}

const View = memo(function View({ view }: { view: KanbanView }) {
  return createPortal(view.getPortal(), view.contentEl);
});

export function DragDropApp({ win, plugin }: { win: Window; plugin: KanbanPlugin }) {
  const views = plugin.useViewState(win);
  const portals: JSX.Element[] = views.map((view) => <View key={view.id} view={view} />);

  const handleDrop = useCallback(
    (dragEntity: Entity, dropEntity: Entity) => {
      if (!dragEntity || !dropEntity) {
        return;
      }

      if (dragEntity.scopeId === 'htmldnd') {
        const data = dragEntity.getData();
        const stateManager = plugin.getStateManagerFromViewID(data.viewId, data.win);
        const dropPath = dropEntity.getPath();
        const destinationParent = getEntityFromPath(stateManager.state, dropPath.slice(0, -1));

        const parseItems = (titles: string[]) => {
          return Promise.all(
            titles.map((title) => {
              return stateManager.getNewItem(title);
            })
          );
        };

        parseItems(data.content)
          .then((items) => {
            const processed = items.map((item) =>
              update(item, {
                data: {
                  isComplete: {
                    $set: !!destinationParent?.data?.shouldMarkItemsComplete,
                  },
                },
              })
            );

            return stateManager.setState((board) => insertEntity(board, dropPath, processed));
          })
          .catch((e) => {
            stateManager.setError(e);
            console.error(e);
          });

        return;
      }

      const dragPath = dragEntity.getPath();
      const dropPath = dropEntity.getPath();
      const dragEntityData = dragEntity.getData();
      const dropEntityData = dropEntity.getData();
      const [, sourceFile] = dragEntity.scopeId.split(':::');
      const [, destinationFile] = dropEntity.scopeId.split(':::');

      const inDropArea =
        dropEntityData.acceptsSort && !dropEntityData.acceptsSort.includes(dragEntityData.type);

      // Same board
      if (sourceFile === destinationFile) {
        const view = plugin.getKanbanView(dragEntity.scopeId, dragEntityData.win);
        const stateManager = plugin.stateManagers.get(view.file);

        if (inDropArea) {
          dropPath.push(0);
        }

        return stateManager.setState((board) => {
          const entity = getEntityFromPath(board, dragPath);
          let newBoard: Board = moveEntity(board, dragPath, dropPath, (entity) => {
            if (entity.type === DataTypes.Item) {
              return maybeCompleteForMove(board, dragPath, board, dropPath, entity);
            }
            return entity;
          });

          if (entity.type === DataTypes.Lane) {
            const from = dragPath.last();
            let to = dropPath.last();

            if (from < to) to -= 1;

            const collapsedState = [...(newBoard.data.settings['list-collapse'] || [])];

            collapsedState.splice(to, 0, collapsedState.splice(from, 1)[0]);
            newBoard = update<Board>(newBoard, {
              data: { settings: { 'list-collapse': { $set: collapsedState } } },
            });

            view.setViewState('list-collapse', collapsedState);

            return newBoard;
          }

          // Remove sorting in the destination lane
          const destinationParentPath = dropPath.slice(0, -1);
          const destinationParent = getEntityFromPath(board, destinationParentPath);

          if (destinationParent?.data?.sorted !== undefined) {
            return updateEntity(newBoard, destinationParentPath, {
              data: {
                $unset: ['sorted'],
              },
            });
          }

          return newBoard;
        });
      }

      const sourceView = plugin.getKanbanView(dragEntity.scopeId, dragEntityData.win);
      const sourceStateManager = plugin.stateManagers.get(sourceView.file);
      const destinationView = plugin.getKanbanView(dropEntity.scopeId, dropEntityData.win);
      const destinationStateManager = plugin.stateManagers.get(destinationView.file);

      sourceStateManager.setState((sourceBoard) => {
        const entity = getEntityFromPath(sourceBoard, dragPath);

        destinationStateManager.setState((destinationBoard) => {
          if (inDropArea) {
            const parent = getEntityFromPath(destinationStateManager.state, dropPath);
            const shouldAppend =
              (destinationStateManager.getSetting('new-card-insertion-method') || 'append') ===
              'append';

            if (shouldAppend) dropPath.push(parent.children.length);
            else dropPath.push(0);
          }

          const toInsert =
            entity.type === DataTypes.Item
              ? maybeCompleteForMove(sourceBoard, dragPath, destinationBoard, dropPath, entity)
              : [entity];

          if (entity.type === DataTypes.Lane) {
            const updated = update<Board>(insertEntity(destinationBoard, dropPath, toInsert), {
              data: { settings: { 'list-collapse': { $splice: [[dropPath.last(), 0, false]] } } },
            });
            destinationView.setViewState('list-collapse', updated.data.settings['list-collapse']);
            return updated;
          } else {
            return insertEntity(destinationBoard, dropPath, toInsert);
          }
        });

        if (entity.type === DataTypes.Lane) {
          const updated = update<Board>(removeEntity(sourceBoard, dragPath), {
            data: { settings: { 'list-collapse': { $splice: [[dragPath.last(), 1]] } } },
          });
          destinationView.setViewState('list-collapse', updated.data.settings['list-collapse']);
          return updated;
        } else {
          return removeEntity(sourceBoard, dragPath);
        }
      });
    },
    [views]
  );

  if (portals.length)
    return (
      <DndContext win={win} onDrop={handleDrop}>
        {...portals}
        <DragOverlay>
          {(entity, styles) => {
            const [data, context] = useMemo(() => {
              if (entity.scopeId === 'htmldnd') {
                return [null, null];
              }

              const overlayData = entity.getData();

              const view = plugin.getKanbanView(entity.scopeId, overlayData.win);
              const stateManager = plugin.stateManagers.get(view.file);
              const data = getEntityFromPath(stateManager.state, entity.getPath());
              const boardModifiers = getBoardModifiers(view, stateManager);
              const filePath = view.file.path;

              return [
                data,
                {
                  view,
                  stateManager,
                  boardModifiers,
                  filePath,
                  getTagColor: getTagColorFn(stateManager),
                  getDateColor: getDateColorFn(stateManager),
                },
              ];
            }, [entity]);

            if (data?.type === DataTypes.Lane) {
              const boardView =
                context?.view.viewSettings[frontmatterKey] ||
                context?.stateManager.getSetting(frontmatterKey);
              const collapseState =
                context?.view.viewSettings['list-collapse'] ||
                context?.stateManager.getSetting('list-collapse');
              const laneIndex = entity.getPath().last();

              return (
                <KanbanContext.Provider value={context}>
                  <div
                    className={classcat([
                      c('drag-container'),
                      {
                        [c('horizontal')]: boardView !== 'list',
                        [c('vertical')]: boardView === 'list',
                      },
                    ])}
                    style={styles}
                  >
                    <DraggableLane
                      lane={data as Lane}
                      laneIndex={laneIndex}
                      isStatic={true}
                      isCollapsed={!!collapseState[laneIndex]}
                      collapseDir={boardView === 'list' ? 'vertical' : 'horizontal'}
                    />
                  </div>
                </KanbanContext.Provider>
              );
            }

            if (data?.type === DataTypes.Item) {
              return (
                <KanbanContext.Provider value={context}>
                  <div className={c('drag-container')} style={styles}>
                    <DraggableItem item={data as Item} itemIndex={0} isStatic={true} />
                  </div>
                </KanbanContext.Provider>
              );
            }

            return <div />;
          }}
        </DragOverlay>
      </DndContext>
    );
}
