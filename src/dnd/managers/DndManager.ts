import { debounce } from 'obsidian';

import { Entity } from '../types';
import { Emitter, createEmitter } from '../util/emitter';
import { DragManager } from './DragManager';

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
      debounce(this.handleResize, 100, true)
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

  scrollResizeDebounce = 0;
  handleResize: ResizeObserverCallback = (entries) => {
    entries.forEach((e) => {
      if ((e.target as HTMLElement).dataset.scrollid) {
        clearTimeout(this.scrollResizeDebounce);

        this.scrollResizeDebounce = window.setTimeout(() => {
          this.emitter.emit('scrollResize', null);
        }, 50);
      }
    });

    this.hitboxEntities.forEach((entity) => {
      entity.recalcInitial();
    });

    this.scrollEntities.forEach((entity) => {
      entity.recalcInitial();
    });
  };

  observeResize(element: HTMLElement) {
    this.resizeObserver.observe(element, { box: 'border-box' });
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
