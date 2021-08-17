import { createEmitter, Emitter } from "../util/emitter";
import { Entity } from "../types";
import { DragManager } from "./DragManager";
import { debounce } from "obsidian";

export type DropHandler = (dragEntity: Entity, dropEntity: Entity) => void;

export class DndManager {
  emitter: Emitter;
  hitboxEntities: Map<string, Entity>;
  scrollEntities: Map<string, Entity>;
  resizeObserver: ResizeObserver;
  dragManager: DragManager;
  onDrop: DropHandler;

  constructor(onDrop: DropHandler) {
    this.emitter = createEmitter();
    this.hitboxEntities = new Map();
    this.scrollEntities = new Map();
    this.onDrop = onDrop;

    this.resizeObserver = new ResizeObserver(
      debounce(this.recalcVisibleHitboxes, 100, true)
    );
    this.dragManager = new DragManager(
      this.emitter,
      this.hitboxEntities,
      this.scrollEntities
    );
  }

  destroy() {
    this.resizeObserver.disconnect();
  }

  recalcVisibleHitboxes = () => {
    this.hitboxEntities.forEach((entity) => {
      entity.recalcInitial();
    });
    this.scrollEntities.forEach((entity) => {
      entity.recalcInitial();
    });
  };

  observeResize(element: HTMLElement) {
    this.resizeObserver.observe(element, { box: "border-box" });
  }

  unobserveResize(element: HTMLElement) {
    this.resizeObserver.unobserve(element);
  }

  registerHitboxEntity(id: string, entity: Entity) {
    this.hitboxEntities.set(id, entity);
  }

  registerScrollEntity(id: string, entity: Entity) {
    this.scrollEntities.set(id, entity);
  }

  unregisterHitboxEntity(id: string) {
    this.hitboxEntities.delete(id);
  }

  unregisterScrollEntity(id: string) {
    this.scrollEntities.delete(id);
  }
}
