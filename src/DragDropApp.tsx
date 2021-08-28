import React from 'react';
import { createPortal } from 'react-dom';

import { KanbanContext } from './components/context';
import { c, maybeCompleteForMove } from './components/helpers';
import { getBoardModifiers } from './components/helpers/boardModifiers';
import { DraggableItem } from './components/Item/Item';
import { DraggableLane } from './components/Lane/Lane';
import { DataTypes, Item, Lane } from './components/types';
import { DndContext } from './dnd/components/DndContext';
import { DragOverlay } from './dnd/components/DragOverlay';
import {
  getEntityFromPath,
  insertEntity,
  moveEntity,
  removeEntity,
} from './dnd/util/data';
import { KanbanView } from './KanbanView';
import KanbanPlugin from './main';

export function createApp(plugin: KanbanPlugin) {
  return <DragDropApp plugin={plugin} />;
}

const View = React.memo(function View({ view }: { view: KanbanView }) {
  return createPortal(view.getPortal(), view.contentEl);
});

export function DragDropApp({ plugin }: { plugin: KanbanPlugin }) {
  const views = plugin.useViewState();
  const portals: JSX.Element[] = views.map((view) => (
    <View key={view.id} view={view} />
  ));

  const handleDrop = React.useCallback(
    (dragEntity, dropEntity) => {
      const dragPath = dragEntity.getPath();
      const dropPath = dropEntity.getPath();

      const [, sourceFile] = dragEntity.scopeId.split(':::');
      const [, destinationFile] = dropEntity.scopeId.split(':::');

      // Same board
      if (sourceFile === destinationFile) {
        const stateManager = plugin.getStateManagerFromViewID(
          dragEntity.scopeId
        );

        plugin.app.workspace.trigger(
          'kanban:card-moved',
          stateManager.file,
          dragPath,
          dropPath,
          dragEntity.getData()
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
        dragEntity.scopeId
      );
      const destinationStateManager = plugin.getStateManagerFromViewID(
        dropEntity.scopeId
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
          return insertEntity(destinationBoard, dropPath, toInsert);
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
            const [data, context] = React.useMemo(() => {
              const view = plugin.getKanbanView(entity.scopeId);
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

            if (data.type === DataTypes.Lane) {
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

            if (data.type === DataTypes.Item) {
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
