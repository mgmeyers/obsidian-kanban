import { debounce } from 'obsidian';

import { Entity } from '../types';
import { Emitter, createEmitter } from '../util/emitter';
import { getParentWindow } from '../util/getWindow';
import { DragManager } from './DragManager';

export type DropHandler = (dragEntity: Entity, dropEntity: Entity) => void;

export class DndManager {
  win: Window;
  emitter: Emitter;
  hitboxEntities: Map<string, Entity>;
  scrollEntities: Map<string, Entity>;
  resizeObserver: ResizeObserver;
  dragManager: DragManager;
  onDrop: DropHandler;

  constructor(win: Window, onDrop: DropHandler) {
    this.win = win;
    this.emitter = createEmitter();
    this.hitboxEntities = new Map();
    this.scrollEntities = new Map();
    this.onDrop = onDrop;

    this.resizeObserver = new ResizeObserver(
      debounce(this.handleResize, 100, true)
    );
    this.dragManager = new DragManager(
      win,
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
    let thisDidResize = false;
    entries.forEach((e) => {
      const win = getParentWindow(e.target);

      if (this.win !== win) return;

      thisDidResize = true;

      if ((e.target as HTMLElement).dataset.scrollid) {
        this.win.clearTimeout(this.scrollResizeDebounce);

        this.scrollResizeDebounce = this.win.setTimeout(() => {
          if (this.emitter.events.scrollResize?.length) {
            this.emitter.emit('scrollResize', null);
          }
        }, 50);
      }
    });

    if (!thisDidResize) return;

    this.hitboxEntities.forEach((entity) => {
      entity.recalcInitial();
    });

    this.scrollEntities.forEach((entity) => {
      entity.recalcInitial();
    });
  };

  observeResize(element: HTMLElement) {
    if (!element.instanceOf(HTMLElement)) return;
    this.resizeObserver.observe(element, { box: 'border-box' });
  }

  unobserveResize(element: HTMLElement) {
    if (!element.instanceOf(HTMLElement)) return;
    this.resizeObserver.unobserve(element);
  }

  registerHitboxEntity(id: string, entity: Entity, win: Window) {
    if (win !== this.win) return;
    this.hitboxEntities.set(id, entity);
  }

  registerScrollEntity(id: string, entity: Entity, win: Window) {
    if (win !== this.win) return;
    this.scrollEntities.set(id, entity);
  }

  unregisterHitboxEntity(id: string, win: Window) {
    if (win !== this.win) return;
    this.hitboxEntities.delete(id);
  }

  unregisterScrollEntity(id: string, win: Window) {
    if (win !== this.win) return;
    this.scrollEntities.delete(id);
  }
}
