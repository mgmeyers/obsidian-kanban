import React from "react";

import { createPortal } from "react-dom";
import { Item, Lane } from "./components/types";
import { KanbanView } from "./KanbanView";
import { DragOverlay } from "./dnd/components/DragOverlay";
import { DndContext } from "./dnd/components/DndContext";
import { DraggableLane } from "./components/Lane/Lane";
import { DraggableItem } from "./components/Item/Item";
import {
  getEntityFromPath,
  insertEntity,
  moveEntity,
  removeEntity,
} from "./dnd/util/data";
import { getBoardModifiers } from "./components/helpers/boardModifiers";
import { KanbanContext } from "./components/context";
import KanbanPlugin from "./main";
import { c } from "./components/helpers";
import { DndScrollState } from "./dnd/components/ScrollStateContext";

export function createApp(plugin: KanbanPlugin) {
  return <DragDropApp plugin={plugin} />;
}

const View = React.memo(({ view }: { view: KanbanView }) => {
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

      const [, sourceFile] = dragEntity.scopeId.split(":::");
      const [, destinationFile] = dropEntity.scopeId.split(":::");

      // Same board
      if (sourceFile === destinationFile) {
        const stateManager = plugin.getStateManagerFromViewID(
          dragEntity.scopeId
        );

        plugin.app.workspace.trigger(
          "kanban:card-moved",
          stateManager.file,
          dragPath,
          dropPath,
          dragEntity.getData()
        );

        return stateManager.setState((board) => {
          return moveEntity(board, dragPath, dropPath);
        });
      }

      const sourceStateManager = plugin.getStateManagerFromViewID(
        dragEntity.scopeId
      );
      const destinationStateManager = plugin.getStateManagerFromViewID(
        dropEntity.scopeId
      );

      sourceStateManager.setState((board) => {
        const entity = getEntityFromPath(board, dragPath);

        destinationStateManager.setState((board) => {
          return insertEntity(board, dropPath, entity);
        });

        return removeEntity(board, dragPath);
      });
    },
    [views]
  );

  if (portals.length)
    return (
      <DndContext onDrop={handleDrop}>
        <DndScrollState>
          {...portals}
          <DragOverlay>
            {(entity, styles) => {
              // TODO: mock this, instead?
              const [data, context] = React.useMemo(() => {
                const view = plugin.getKanbanView(entity.scopeId);
                const stateManager = plugin.stateManagers.get(view.file);
                const data = getEntityFromPath(
                  stateManager.state,
                  entity.getPath()
                );
                const boardModifiers = getBoardModifiers(stateManager);
                const filePath = view.file.path;

                return [data, { view, stateManager, boardModifiers, filePath }];
              }, [entity]);

              if (data.type === "lane") {
                return (
                  <KanbanContext.Provider value={context}>
                    <div className={c("drag-container")} style={styles}>
                      <DraggableLane
                        lane={data as Lane}
                        laneIndex={0}
                        isStatic={true}
                      />
                    </div>
                  </KanbanContext.Provider>
                );
              }

              if (data.type === "item") {
                return (
                  <KanbanContext.Provider value={context}>
                    <div className={c("drag-container")} style={styles}>
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
        </DndScrollState>
      </DndContext>
    );
}
