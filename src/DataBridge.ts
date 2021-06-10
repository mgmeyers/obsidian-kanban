import { useState, useEffect, useCallback } from "react";

export type DataHandler<T> = (data: T) => void;
export type Reducer<T> = ((old: T) => T)

export class DataBridge<T> {

  constructor(public data?: T) {}

  // A two-way link version of useState
  useState(): [T, DataHandler<T>] {
    // The actual state used on the react end
    const [state, setState] = useState(this.getData());

    // Which is updated whenever the outside changes
    useEffect(() => this.onExternalSet(setState), [this]);

    // And we return a setter that updates the outside and inside
    const updateState = useCallback((state: T|Reducer<T>) => {
      if (typeof state === "function") {
        // Reducer: capture the result of the change
        setState((oldState: T) => state = (state as Reducer<T>)(oldState));
      } else {
        // Value: just pass it on
        setState(state);
      }
      this.setInternal(state as T);
    }, [this, setState])

    return [state, updateState];
  }

  onExternalSetHandlers: Array<DataHandler<T>> = [];
  onInternalSetHandlers: Array<DataHandler<T>> = [];

  // When data has been set in obsidian land
  onExternalSet(fn: DataHandler<T>) {
    this.onExternalSetHandlers.push(fn);
    return () => this.onExternalSetHandlers.remove(fn);
  }

  // When data has been set in react land
  onInternalSet(fn: DataHandler<T>) {
    this.onInternalSetHandlers.push(fn);
    return () => this.onExternalSetHandlers.remove(fn);
  }

  // Set data from obsidian land
  setExternal(data: T) {
    this.data = data;
    this.onExternalSetHandlers.forEach((fn) => fn(data));
  }

  // Set data from react land
  setInternal(data: T) {
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
