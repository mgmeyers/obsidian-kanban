import { App } from "obsidian";
import React from "react";

import { createPortal } from "react-dom";
import { Board, Item, Lane } from "./components/types";
import { DataBridge } from "./DataBridge";
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

export function createApp(
  app: App,
  dataBridge: DataBridge<Map<string, KanbanView>>
) {
  return <DragDropApp app={app} dataBridge={dataBridge} />;
}

const View = React.memo(({ view }: { view: KanbanView }) => {
  return createPortal(view.getPortal(), view.contentEl);
});

function mutateView(
  view: KanbanView,
  mutator: (board: Board) => Board,
  isDupe: boolean = false
) {
  const bridge = view.dataBridge;
  const board = mutator(bridge.getData());

  if (!isDupe) bridge.setInternal(board);
  bridge.setExternal(board);
}

export function DragDropApp({
  app,
  dataBridge,
}: {
  app: App;
  dataBridge: DataBridge<Map<string, KanbanView>>;
}) {
  const [views, _] = dataBridge.useState();
  const portals = [...views].map(([_id, view]) => <View view={view} />);

  const handleDrop = React.useCallback(
    (dragEntity, dropEntity) => {
      const dragPath = dragEntity.getPath();
      const dropPath = dropEntity.getPath();

      // Same board
      if (dragEntity.scopeId === dropEntity.scopeId) {
        const view = views.get(dragEntity.scopeId);

        app.workspace.trigger(
          "kanban:card-moved",
          view.file,
          dragPath,
          dropPath,
          dragEntity.getData()
        );

        return mutateView(views.get(dragEntity.scopeId), (board) => {
          return moveEntity(board, dragEntity.getPath(), dropEntity.getPath());
        });
      }

      const [, sourceFile] = dragEntity.scopeId.split(":::");
      const [, destinationFile] = dropEntity.scopeId.split(":::");

      // Different views, same file
      if (sourceFile === destinationFile) {
        const sourceView = views.get(dragEntity.scopeId);

        app.workspace.trigger(
          "kanban:card-moved",
          sourceView.file,
          dragPath,
          dropPath,
          dragEntity.getData()
        );

        // Drop to the destination but don't set internal
        mutateView(
          views.get(dropEntity.scopeId),
          (board) => {
            return moveEntity(
              board,
              dragEntity.getPath(),
              dropEntity.getPath()
            );
          },
          true
        );

        // Update the source
        return mutateView(sourceView, (board) => {
          return moveEntity(board, dragEntity.getPath(), dropEntity.getPath());
        });
      }

      // Move from one board to another
      mutateView(views.get(dragEntity.scopeId), (board) => {
        const dragPath = dragEntity.getPath();
        const entity = getEntityFromPath(board, dragPath);

        mutateView(views.get(dropEntity.scopeId), (board) => {
          return insertEntity(board, dropEntity.getPath(), entity);
        });

        return removeEntity(board, dragPath);
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
            const data = entity.getData();
            const view = views.get(entity.scopeId);
            const boardModifiers = getBoardModifiers({
              view,
              setBoardData: () => {},
            });
            const filePath = view.file.path;
            const context = { view, boardModifiers, filePath };

            if (data.type === "lane") {
              return (
                <KanbanContext.Provider value={context}>
                  <div style={styles}>
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
                  <div style={styles}>
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
