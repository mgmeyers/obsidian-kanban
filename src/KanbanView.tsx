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

  clear() {
    this.dataBridge.reset();
  }

  getViewData() {
    return boardToMd(this.dataBridge.getData());
  }

  setViewData(data: string, clear: boolean) {
    const trimmedContent = data.trim();
    const board: Board = data.trim()
      ? mdToBoard(trimmedContent)
      : { lanes: [], archive: [] };

    if (clear) {
      this.clear();

      this.dataBridge.setExternal(board);
      this.dataBridge.onInternalSet((data) => {
        this.data = boardToMd(data);
        this.requestSave();
      });

      this.constructKanban();
    } else {
      this.dataBridge.setExternal(board);
    }
  }

  constructKanban() {
    ReactDOM.unmountComponentAtNode(this.contentEl);
    ReactDOM.render(<Kanban dataBridge={this.dataBridge} />, this.contentEl);
  }
}
