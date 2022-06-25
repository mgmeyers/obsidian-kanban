import update from 'immutability-helper';
import Preact from 'preact/compat';

import { KanbanContext } from './components/context';
import { c, maybeCompleteForMove } from './components/helpers';
import { DraggableItem } from './components/Item/Item';
import { DraggableLane } from './components/Lane/Lane';
import { DataTypes, Item, Lane } from './components/types';
import { DndContext } from './dnd/components/DndContext';
import { DragOverlay } from './dnd/components/DragOverlay';
import { Entity } from './dnd/types';
import {
  getEntityFromPath,
  insertEntity,
  moveEntity,
  removeEntity,
} from './dnd/util/data';
import { getBoardModifiers } from './helpers/boardModifiers';
import { KanbanView } from './KanbanView';
import KanbanPlugin from './main';

export function createApp(plugin: KanbanPlugin) {
  return <DragDropApp plugin={plugin} />;
}

const View = Preact.memo(function View({ view }: { view: KanbanView }) {
  return Preact.createPortal(view.getPortal(), view.contentEl);
});

export function DragDropApp({ plugin }: { plugin: KanbanPlugin }) {
  const views = plugin.useViewState();
  const portals: Preact.JSX.Element[] = views.map((view) => (
    <View key={view.id} view={view} />
  ));

  const handleDrop = Preact.useCallback(
    (dragEntity: Entity, dropEntity: Entity) => {
      if (!dragEntity || !dropEntity) {
        return;
      }

      if (dragEntity.scopeId === 'htmldnd') {
        const data = dragEntity.getData();
        const stateManager = plugin.getStateManagerFromViewID(
          data.viewId,
          data.win
        );
        const dropPath = dropEntity.getPath();
        const destinationParent = getEntityFromPath(
          stateManager.state,
          dropPath.slice(0, -1)
        );

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

            return stateManager.setState((board) =>
              insertEntity(board, dropPath, processed)
            );
          })
          .catch((e) => {
            stateManager.setError(e);
            console.error(e);
          });

        return;
      }

      const dragPath = dragEntity.getPath();
      const dropPath = dropEntity.getPath();

      const [, sourceFile] = dragEntity.scopeId.split(':::');
      const [, destinationFile] = dropEntity.scopeId.split(':::');

      const dragEntityData = dragEntity.getData();
      const dropEntityData = dropEntity.getData();

      // Same board
      if (sourceFile === destinationFile) {
        const stateManager = plugin.getStateManagerFromViewID(
          dragEntity.scopeId,
          dragEntityData.win
        );

        plugin.app.workspace.trigger(
          'kanban:card-moved',
          stateManager.file,
          dragPath,
          dropPath,
          dragEntityData
        );

        return stateManager.setState((board) => {
          return moveEntity(board, dragPath, dropPath, (entity) => {
            if (entity.type === DataTypes.Item) {
              return maybeCompleteForMove(
                board,
                dragPath,
                board,
                dropPath,
                entity
              );
            }

            return entity;
          });
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
          const toInsert =
            entity.type === DataTypes.Item
              ? maybeCompleteForMove(
                  sourceBoard,
                  dragPath,
                  destinationBoard,
                  dropPath,
                  entity
                )
              : entity;
          return insertEntity(destinationBoard, dropPath, [toInsert]);
        });

        return removeEntity(sourceBoard, dragPath);
      });
    },
    [views]
  );

  if (portals.length)
    return (
      <DndContext onDrop={handleDrop}>
        {...portals}
        <DragOverlay>
          {(entity, styles) => {
            const [data, context] = Preact.useMemo(() => {
              if (entity.scopeId === 'htmldnd') {
                return [null, null];
              }

              const overlayData = entity.getData();

              const view = plugin.getKanbanView(
                entity.scopeId,
                overlayData.win
              );
              const stateManager = plugin.stateManagers.get(view.file);
              const data = getEntityFromPath(
                stateManager.state,
                entity.getPath()
              );
              const boardModifiers = getBoardModifiers(stateManager);
              const filePath = view.file.path;

              return [
                data,
                {
                  view,
                  stateManager,
                  boardModifiers,
                  filePath,
                },
              ];
            }, [entity]);

            if (data?.type === DataTypes.Lane) {
              return (
                <KanbanContext.Provider value={context}>
                  <div className={c('drag-container')} style={styles}>
                    <DraggableLane
                      lane={data as Lane}
                      laneIndex={0}
                      isStatic={true}
                    />
                  </div>
                </KanbanContext.Provider>
              );
            }

            if (data?.type === DataTypes.Item) {
              return (
                <KanbanContext.Provider value={context}>
                  <div className={c('drag-container')} style={styles}>
                    <DraggableItem
                      item={data as Item}
                      itemIndex={0}
                      isStatic={true}
                    />
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
