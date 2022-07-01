import { debounce } from 'obsidian';

import { Entity } from '../types';
import { Emitter, createEmitter } from '../util/emitter';
import { getParentWindow } from '../util/getWindow';
import { DragManager } from './DragManager';

export type DropHandler = (dragEntity: Entity, dropEntity: Entity) => void;

export class DndManager {
  emitter: Emitter;
  hitboxEntities: Map<Window, Map<string, Entity>>;
  scrollEntities: Map<Window, Map<string, Entity>>;
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
    const resizedWindows = new Set<Window>();

    entries.forEach((e) => {
      const win = getParentWindow(e.target);

      if (!resizedWindows.has(win)) {
        resizedWindows.add(win);
      }

      if ((e.target as HTMLElement).dataset.scrollid) {
        clearTimeout(this.scrollResizeDebounce);

        this.scrollResizeDebounce = window.setTimeout(() => {
          this.emitter.emit('scrollResize', null);
        }, 50);
      }
    });

    resizedWindows.forEach((win) => {
      if (this.hitboxEntities.has(win)) {
        this.hitboxEntities.get(win).forEach((entity) => {
          entity.recalcInitial();
        });
      }

      if (this.scrollEntities.has(win)) {
        this.scrollEntities.get(win).forEach((entity) => {
          entity.recalcInitial();
        });
      }
    });

    resizedWindows.clear();
  };

  observeResize(element: HTMLElement) {
    this.resizeObserver.observe(element, { box: 'border-box' });
  }

  unobserveResize(element: HTMLElement) {
    this.resizeObserver.unobserve(element);
  }

  registerHitboxEntity(id: string, entity: Entity, win: Window) {
    if (!this.hitboxEntities.has(win)) {
      this.hitboxEntities.set(win, new Map());
    }

    this.hitboxEntities.get(win).set(id, entity);
  }

  registerScrollEntity(id: string, entity: Entity, win: Window) {
    if (!this.scrollEntities.has(win)) {
      this.scrollEntities.set(win, new Map());
    }

    this.scrollEntities.get(win).set(id, entity);
  }

  unregisterHitboxEntity(id: string, win: Window) {
    if (!this.hitboxEntities.has(win)) {
      return;
    }

    const entities = this.hitboxEntities.get(win);

    entities.delete(id);

    if (entities.size === 0) {
      this.hitboxEntities.delete(win);
    }
  }

  unregisterScrollEntity(id: string, win: Window) {
    if (!this.scrollEntities.has(win)) {
      return;
    }

    const entities = this.scrollEntities.get(win);

    entities.delete(id);

    if (entities.size === 0) {
      this.scrollEntities.delete(win);
    }
  }
}
