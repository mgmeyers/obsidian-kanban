import classcat from 'classcat';
import update from 'immutability-helper';
import { JSX, createPortal, memo, useCallback, useMemo } from 'preact/compat';

import { KanbanView } from './KanbanView';
import { DraggableItem } from './components/Item/Item';
import { DraggableLane } from './components/Lane/Lane';
import { KanbanContext } from './components/context';
import { c, getDateColorFn, getTagColorFn, maybeCompleteForMove } from './components/helpers';
import { DataTypes, Item, Lane } from './components/types';
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
        const stateManager = plugin.getStateManagerFromViewID(
          dragEntity.scopeId,
          dragEntityData.win
        );

        if (inDropArea) {
          dropPath.push(0);
        }

        plugin.app.workspace.trigger(
          'kanban:card-moved',
          stateManager.file,
          dragPath,
          dropPath,
          dragEntityData
        );

        return stateManager.setState((board) => {
          let didMoveItem = false;

          const newBoard = moveEntity(board, dragPath, dropPath, (entity) => {
            if (entity.type === DataTypes.Item) {
              didMoveItem = true;
              return maybeCompleteForMove(board, dragPath, board, dropPath, entity);
            }

            return entity;
          });

          if (!didMoveItem) {
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

      const sourceStateManager = plugin.getStateManagerFromViewID(
        dragEntity.scopeId,
        dragEntityData.win
      );
      const destinationStateManager = plugin.getStateManagerFromViewID(
        dropEntity.scopeId,
        dropEntityData.win
      );

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
          return insertEntity(destinationBoard, dropPath, toInsert);
        });

        return removeEntity(sourceBoard, dragPath);
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
              const boardModifiers = getBoardModifiers(stateManager);
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

            const boardView = context?.stateManager.getSetting(frontmatterKey);

            if (data?.type === DataTypes.Lane) {
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
                      laneIndex={0}
                      isStatic={true}
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
