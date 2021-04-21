import { Board } from "./components/types";

export type DataHandler = (data: Board) => void;

export class DataBridge {
  data: Board | null;

  onExternalSetHandlers: Array<DataHandler> = [];
  onInternalSetHandlers: Array<DataHandler> = [];

  // When data has been set in obsidian land
  onExternalSet(fn: DataHandler) {
    this.onExternalSetHandlers.push(fn);
  }

  // When data has been set in react land
  onInternalSet(fn: DataHandler) {
    this.onInternalSetHandlers.push(fn);
  }

  // Set data from obsidian land
  setExternal(data: Board) {
    this.data = data;
    this.onExternalSetHandlers.forEach((fn) => fn(data));
  }

  // Set data from react land
  setInternal(data: Board) {
    this.data = data;
    this.onInternalSetHandlers.forEach((fn) => fn(data));
  }

  getData() {
    return this.data;
  }

  reset() {
    this.onExternalSetHandlers = [];
    this.onInternalSetHandlers = [];
  }
}
