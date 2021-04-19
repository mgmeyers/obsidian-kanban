import ReactDOM from "react-dom";
import React from "react";
import { TextFileView, WorkspaceLeaf } from "obsidian";

import { kanbanToMd, mdToKanban } from "./parser";
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
    return JSON.stringify(this.dataBridge.getData(), null, 2);
  }

  setViewData(data: string, clear: boolean) {
    const board: Board = data.trim() ?  JSON.parse(data) as Board : { lanes: [] }
    
    if (clear) {
      this.clear();

      console.log('this.dataBridge.setExternal', board)

      this.dataBridge.setExternal(board);
      this.dataBridge.onInternalSet((data) => {
        this.data = JSON.stringify(data, null, 2);
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
