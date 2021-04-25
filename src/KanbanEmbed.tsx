import { Component } from "obsidian";
import { DataBridge } from "./DataBridge";

export class KanbanEmbed extends Component {
    filePath: string;
    dataBridge: DataBridge;
    containerEl: HTMLElement;
  
    constructor(filePath: string, containerEl: HTMLElement) {
      super()
  
      this.filePath = filePath;
      this.containerEl = containerEl;
      this.dataBridge = new DataBridge();
    }
  
    load() {
      this.containerEl.appendText('hihihihiihiih')
    }
    onload() {}
    unload() {}
    onunload() {}
  }