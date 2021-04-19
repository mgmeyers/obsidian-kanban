import { Board } from "./components/types";

export type DataHandler = (data: Board) => void;

export class DataBridge {
  data: Board | null;

  onExternalSetHandlers: Array<DataHandler> = [];
  onInternalSetHandlers: Array<DataHandler> = [];

  onExternalSet(fn: DataHandler) {
    this.onExternalSetHandlers.push(fn);
  }

  onInternalSet(fn: DataHandler) {
    this.onInternalSetHandlers.push(fn);
  }

  setExternal(data: Board) {
    this.data = data;
    this.onExternalSetHandlers.forEach((fn) => fn(data));
  }

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
