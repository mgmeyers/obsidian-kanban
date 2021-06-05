import { App, Notice } from "obsidian";
import React from "react";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import * as helpers from "./components/helpers";
import { Board } from "./components/types";
import { KanbanView, kanbanViewType } from "./KanbanView";

export function DragDropApp(app: App) {
  const portals = allViews().map((view) => view.getPortal());
  
  if (portals.length) {
    return (
      <DragDropContext onDragEnd={onDragEnd}>{...portals}</DragDropContext>
    );
  }

  function allViews(): KanbanView[] {
    return app.workspace
      .getLeavesOfType(kanbanViewType)
      .map((leaf) => leaf.view as KanbanView);
  }

  function onDragEnd(dropResult: DropResult) {
    // Bail out early if we're not dropping anywhere
    const { source, destination } = dropResult;
    if (!destination) return;

    const srcLoc = boardContextFor(dropResult, source.droppableId);
    const dstLoc = boardContextFor(dropResult, destination.droppableId);
    if (!srcLoc || !dstLoc)
      return new Notice("Invalid source or destination for drop");

    let srcMutator: helpers.BoardMutator;
    let dstMutator: helpers.BoardMutator;

    if (srcLoc.file !== dstLoc.file) {
      // Two different files
      if (dropResult.type === "LANE") {
        srcMutator = helpers.deleteLane(source.index);
        dstMutator = helpers.insertLane(
          destination.index,
          srcLoc.getData().lanes[source.index]
        );
      } else {
        const srcLane = srcLoc.getData().lanes[srcLoc.laneIndex];
        const dstLane = dstLoc.getData().lanes[dstLoc.laneIndex];
        const item = helpers.maybeCompleteForMove(
          srcLane.items[source.index],
          srcLane,
          dstLane
        );
        srcMutator = helpers.deleteItem(srcLoc.laneIndex, source.index);
        dstMutator = helpers.insertItem(
          dstLoc.laneIndex,
          destination.index,
          item
        );
      }
    } else {
      if (srcLoc.view !== dstLoc.view) {
        // drag between two views on the same file, might need to fudge position (due to the copy of src in dst)
        if (destination.index > source.index) --destination.index;
      }
      // Nominal case: same file, same view
      if (dropResult.type === "LANE") {
        // Swap lanes
        srcMutator = dstMutator = helpers.swapLanes(
          source.index,
          destination.index
        );
      } else if (srcLoc.laneIndex === dstLoc.laneIndex) {
        // Swap items within a lane
        srcMutator = dstMutator = helpers.swapItems(
          srcLoc.laneIndex,
          source.index,
          destination.index
        );
      } else {
        // Move item from one lane to another
        srcMutator = dstMutator = helpers.moveItem(
          srcLoc.laneIndex,
          source.index,
          dstLoc.laneIndex,
          destination.index
        );
        const lanes = srcLoc.getData().lanes;
        const item = lanes[srcLoc.laneIndex].items[source.index];
        app.workspace.trigger(
          "kanban:card-moved",
          srcLoc.file,
          lanes[srcLoc.laneIndex],
          lanes[dstLoc.laneIndex],
          item
        );
      }
    }

    // Apply changes at destination view first, so UI changes immediately
    //   (but only if there's more than one view involved)
    if (srcLoc.view !== dstLoc.view && dstMutator) {
      // if it's the same file+change, just update the display; the change will be saved
      //   when it's applied to the source, below.
      dstLoc.mutate(
        dstMutator,
        srcMutator === dstMutator && srcLoc.file === dstLoc.file
      );
    }

    // Apply changes to source (if any), and always save it
    if (srcMutator) srcLoc.mutate(srcMutator);
  }

  function boardContextFor(dropResult: DropResult, id: string) {
    for (const view of allViews()) {
      if (dropResult.type === "LANE" && (view.leaf as any).id === id)
        return boardContext(view);
      const index = view.dataBridge.data.lanes.findIndex(
        (lane) => lane.id === id
      );
      if (index >= 0) return boardContext(view, index);
    }
  }

  function boardContext(view: KanbanView, laneIndex?: number) {
    return {
      view,
      laneIndex,
      file: view.file,
      mutate(mutator: helpers.BoardMutator, preview = false) {
        const bridge = view.dataBridge;
        const board = mutator(bridge.getData());
        // Save the change unless we're previewing
        if (!preview) bridge.setInternal(board);
        // And always Update the display
        bridge.setExternal(board);
      },
      getData(): Board {
        return view.dataBridge.getData();
      },
    };
  }
}
