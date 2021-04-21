import ReactDOM from "react-dom";
import React from "react";
import { TextFileView, WorkspaceLeaf } from "obsidian";

import { boardToMd, mdToBoard } from "./parser";
import { Kanban } from "./components/Kanban";
import { DataBridge } from "./DataBridge";
import { Board } from "./components/types";

export const kanbanViewType = "kanban";
export const kanbanIcon = "blocks";

export class KanbanView extends TextFileView {
  dataBridge: DataBridge;

  getViewType() {
    return kanbanViewType;
  }

  getIcon() {
    return kanbanIcon;
  }

  getDisplayText() {
    return this.file?.basename || "Kanban";
  }

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.dataBridge = new DataBridge();
  }

  async onClose() {
    ReactDOM.unmountComponentAtNode(this.contentEl);
  }

  clear() {
    this.dataBridge.reset();
  }

  getViewData() {
    return boardToMd(this.dataBridge.getData());
  }

  setViewData(data: string, clear: boolean) {
    const trimmedContent = data.trim();
    const board: Board = trimmedContent
      ? mdToBoard(trimmedContent)
      : { lanes: [], archive: [] };

    if (clear) {
      this.clear();

      // Tell react we have a new board
      this.dataBridge.setExternal(board);

      // When the board has been updated by react
      this.dataBridge.onInternalSet((data) => {
        this.data = boardToMd(data);
        this.requestSave();
      });

      this.constructKanban();
    } else {
      // Tell react we have a new board
      this.dataBridge.setExternal(board);
    }
  }

  constructKanban() {
    ReactDOM.unmountComponentAtNode(this.contentEl);
    ReactDOM.render(<Kanban dataBridge={this.dataBridge} />, this.contentEl);
  }
}
