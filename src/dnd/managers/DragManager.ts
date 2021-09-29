import boxIntersect from 'box-intersect';
import { Platform } from 'obsidian';
import rafSchd from 'raf-schd';
import React from 'react';

import { handleDragOrPaste } from 'src/components/Item/helpers';
import { StateManager } from 'src/StateManager';

import { DndManagerContext } from '../components/context';
import { Coordinates, Entity, Hitbox, Side } from '../types';
import { Emitter } from '../util/emitter';
import {
  adjustHitboxForMovement,
  distanceBetween,
  getBestIntersect,
  getScrollIntersection,
} from '../util/hitbox';
import { createHTMLDndEntity } from './createHTMLDndEntity';

export interface DragEventData {
  dragEntity?: Entity;
  dragEntityId?: string;
  dragEntityMargin?: Hitbox;
  dragOrigin?: Coordinates;
  dragOriginHitbox?: Hitbox;
  dragPosition?: Coordinates;
  primaryIntersection?: Entity;
  scrollIntersections?: [Entity, number][];
}

export interface ScrollEventData extends DragEventData {
  scrollEntity: Entity;
  scrollEntityId: string;
  scrollEntitySide: Side;
  scrollStrength: number;
}

interface Events {
  dragStart(data: DragEventData): void;
  dragMove(data: DragEventData): void;
  dragEnd(data: DragEventData): void;
  beginDragScroll(data: ScrollEventData): void;
  updateDragScroll(data: ScrollEventData): void;
  endDragScroll(data: ScrollEventData): void;
  dragEnter(data: DragEventData): void;
  dragLeave(data: DragEventData): void;
}

export class DragManager {
  emitter: Emitter<Events>;
  hitboxEntities: Map<string, Entity>;
  scrollEntities: Map<string, Entity>;

  dragEntity?: Entity;
  dragEntityId?: string;
  dragEntityMargin?: Hitbox;
  dragOrigin?: Coordinates;
  dragOriginHitbox?: Hitbox;
  dragPosition?: Coordinates;

  primaryIntersection?: Entity;
  scrollIntersection?: [Entity, number];

  isHTMLDragging: boolean = false;
  dragOverTimeout: number = 0;

  constructor(
    emitter: Emitter,
    hitboxEntities: Map<string, Entity>,
    scrollEntities: Map<string, Entity>
  ) {
    this.hitboxEntities = hitboxEntities;
    this.scrollEntities = scrollEntities;
    this.emitter = emitter;
  }

  getDragEventData() {
    return {
      dragEntity: this.dragEntity,
      dragEntityId: this.dragEntityId,
      dragEntityMargin: this.dragEntityMargin,
      dragOrigin: this.dragOrigin,
      dragOriginHitbox: this.dragOriginHitbox,
      dragPosition: this.dragPosition,
      primaryIntersection: this.primaryIntersection,
      scrollIntersection: this.scrollIntersection,
    };
  }

  dragStart(e: PointerEvent, referenceElement?: HTMLElement) {
    const id =
      referenceElement?.dataset.hitboxid ||
      (e.currentTarget as HTMLElement).dataset.hitboxid;

    if (!id) return;

    const styles = getComputedStyle(
      referenceElement || (e.currentTarget as HTMLElement)
    );

    this.dragEntityId = id;
    this.dragOrigin = { x: e.pageX, y: e.pageY };
    this.dragPosition = { x: e.pageX, y: e.pageY };
    this.dragEntity = this.hitboxEntities.get(id);
    this.dragOriginHitbox = this.dragEntity?.getHitbox();
    this.dragEntityMargin = [
      parseFloat(styles.marginLeft) || 0,
      parseFloat(styles.marginTop) || 0,
      parseFloat(styles.marginRight) || 0,
      parseFloat(styles.marginBottom) || 0,
    ];

    this.emitter.emit('dragStart', this.getDragEventData());
  }

  dragStartHTML(e: DragEvent, viewId: string) {
    this.isHTMLDragging = true;
    const entity = createHTMLDndEntity(e.pageX, e.pageY, [], viewId);

    this.dragEntityId = entity.entityId;
    this.dragOrigin = { x: e.pageX, y: e.pageY };
    this.dragPosition = { x: e.pageX, y: e.pageY };
    this.dragEntity = entity;
    this.dragOriginHitbox = entity.getHitbox();
    this.dragEntityMargin = [0, 0, 0, 0];

    this.emitter.emit('dragStart', this.getDragEventData());
  }

  dragMove(e: PointerEvent) {
    this.dragPosition = { x: e.pageX, y: e.pageY };
    this.emitter.emit('dragMove', this.getDragEventData());
    this.calculateDragIntersect();
  }

  dragMoveHTML(e: DragEvent) {
    this.dragPosition = { x: e.pageX, y: e.pageY };
    this.emitter.emit('dragMove', this.getDragEventData());
    this.calculateDragIntersect();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dragEnd(e: PointerEvent) {
    this.emitter.emit('dragEnd', this.getDragEventData());
    this.dragEntityMargin = undefined;
    this.dragEntity = undefined;
    this.dragEntityId = undefined;
    this.dragOrigin = undefined;
    this.dragOriginHitbox = undefined;
    this.dragPosition = undefined;
    this.scrollIntersection = undefined;
    this.primaryIntersection = undefined;
  }

  dragEndHTML(
    e: DragEvent,
    viewId: string,
    content: string[],
    isLeave?: boolean
  ) {
    this.isHTMLDragging = false;
    if (!isLeave) {
      this.dragEntity = createHTMLDndEntity(e.pageX, e.pageY, content, viewId);
      this.emitter.emit('dragEnd', this.getDragEventData());
    }

    this.dragEntityMargin = undefined;
    this.dragEntity = undefined;
    this.dragEntityId = undefined;
    this.dragOrigin = undefined;
    this.dragOriginHitbox = undefined;
    this.dragPosition = undefined;
    this.scrollIntersection = undefined;
    this.primaryIntersection = undefined;

    if (isLeave) {
      this.emitter.emit('dragEnd', this.getDragEventData());
    }
  }

  onHTMLDragLeave(callback: () => void) {
    clearTimeout(this.dragOverTimeout);
    this.dragOverTimeout = window.setTimeout(callback, 100);
  }

  calculateDragIntersect() {
    if (
      !this.dragEntity ||
      !this.dragPosition ||
      !this.dragOrigin ||
      !this.dragOriginHitbox
    ) {
      return;
    }

    const { type } = this.dragEntity.getData();

    const hitboxEntities: Entity[] = [];
    const hitboxHitboxes: Hitbox[] = [];
    const scrollEntities: Entity[] = [];
    const scrollHitboxes: Hitbox[] = [];

    this.hitboxEntities.forEach((entity) => {
      if (entity.getData().accepts.includes(type)) {
        hitboxEntities.push(entity);
        hitboxHitboxes.push(entity.getHitbox());
      }
    });

    this.scrollEntities.forEach((entity) => {
      if (entity.getData().accepts.includes(type)) {
        scrollEntities.push(entity);
        scrollHitboxes.push(entity.getHitbox());
      }
    });

    const dragHitbox = adjustHitboxForMovement(
      this.dragOriginHitbox,
      this.dragOrigin,
      this.dragPosition
    );

    const isScrolling = this.handleScrollIntersect(
      dragHitbox,
      this.dragEntity.entityId,
      scrollHitboxes,
      scrollEntities
    );

    if (!isScrolling) {
      this.handleHitboxIntersect(
        dragHitbox,
        this.dragEntity.entityId,
        hitboxHitboxes,
        hitboxEntities
      );
    }
  }

  handleScrollIntersect(
    dragHitbox: Hitbox,
    dragId: string,
    hitboxes: Hitbox[],
    hitboxEntities: Entity[]
  ) {
    const scrollHits: Entity[] = boxIntersect([dragHitbox], hitboxes).map(
      (match) => hitboxEntities[match[1]]
    );

    const scrollIntersection = getScrollIntersection(
      scrollHits,
      dragHitbox,
      dragId
    );

    if (
      this.scrollIntersection &&
      (!scrollIntersection ||
        scrollIntersection[0] !== this.scrollIntersection[0])
    ) {
      const [scrollEntity, scrollStrength] = this.scrollIntersection;
      const scrollEntityData = scrollEntity.getData();
      const scrollEntityId = scrollEntity.entityId;
      const scrollEntitySide = scrollEntityData.side;

      this.emitter.emit(
        'endDragScroll',
        {
          ...this.getDragEventData(),
          scrollEntity,
          scrollEntityId,
          scrollEntitySide,
          scrollStrength,
        },
        scrollEntityId
      );

      this.scrollIntersection = undefined;
    }

    if (
      scrollIntersection &&
      (!this.scrollIntersection ||
        this.scrollIntersection[0] !== scrollIntersection[0])
    ) {
      const [scrollEntity, scrollStrength] = scrollIntersection;
      const scrollEntityData = scrollEntity.getData();
      const scrollEntityId = scrollEntity.entityId;
      const scrollEntitySide = scrollEntityData.side;

      this.emitter.emit(
        'beginDragScroll',
        {
          ...this.getDragEventData(),
          scrollEntity,
          scrollEntityId,
          scrollEntitySide,
          scrollStrength,
        },
        scrollEntityId
      );

      this.scrollIntersection = scrollIntersection;
    } else if (
      scrollIntersection &&
      this.scrollIntersection &&
      scrollIntersection[0] === this.scrollIntersection[0]
    ) {
      const [scrollEntity, scrollStrength] = scrollIntersection;
      const scrollEntityData = scrollEntity.getData();
      const scrollEntityId = scrollEntity.entityId;
      const scrollEntitySide = scrollEntityData.side;

      this.emitter.emit(
        'updateDragScroll',
        {
          ...this.getDragEventData(),
          scrollEntity,
          scrollEntityId,
          scrollEntitySide,
          scrollStrength,
        },
        scrollEntityId
      );

      this.scrollIntersection = scrollIntersection;
    }

    return !!scrollIntersection;
  }

  handleHitboxIntersect(
    dragHitbox: Hitbox,
    dragId: string,
    hitboxes: Hitbox[],
    hitboxEntities: Entity[]
  ) {
    const hits: Entity[] = boxIntersect([dragHitbox], hitboxes).map(
      (match) => hitboxEntities[match[1]]
    );

    const primaryIntersection = getBestIntersect(hits, dragHitbox, dragId);

    if (
      this.primaryIntersection &&
      this.primaryIntersection !== primaryIntersection
    ) {
      this.emitter.emit(
        'dragLeave',
        this.getDragEventData(),
        this.primaryIntersection.entityId
      );
      this.primaryIntersection = undefined;
    }

    if (
      primaryIntersection &&
      this.primaryIntersection !== primaryIntersection
    ) {
      this.emitter.emit(
        'dragEnter',
        {
          ...this.getDragEventData(),
          primaryIntersection,
        },
        primaryIntersection.entityId
      );
      this.primaryIntersection = primaryIntersection;
    }
  }
}

const cancelEvent = (e: TouchEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export function useDragHandle(
  droppableElement: React.MutableRefObject<HTMLElement | null>,
  handleElement: React.MutableRefObject<HTMLElement | null>
) {
  const dndManager = React.useContext(DndManagerContext);

  React.useEffect(() => {
    const droppable = droppableElement.current;
    const handle = handleElement.current;

    if (!dndManager || !droppable || !handle) {
      return;
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.defaultPrevented || (e.target as HTMLElement).dataset.ignoreDrag) {
        return;
      }

      // We only care about left mouse / touch contact
      // https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events#determining_button_states
      if (e.button !== 0 && e.buttons !== 1) {
        return;
      }

      const isMobile = Platform.isMobile;

      if (!isMobile) {
        e.stopPropagation();
        e.preventDefault();
      }

      const initialEvent = e;
      const initialPosition: Coordinates = {
        x: e.pageX,
        y: e.pageY,
      };

      let isDragging = false;
      let longPressTimeout = 0;

      if (isMobile) {
        window.addEventListener('contextmenu', cancelEvent, true);

        longPressTimeout = window.setTimeout(() => {
          dndManager.dragManager.dragStart(initialEvent, droppable);
          isDragging = true;
          window.addEventListener('touchmove', cancelEvent, {
            passive: false,
          });
        }, 500);
      }

      const onMove = rafSchd((e: PointerEvent) => {
        if (isMobile) {
          if (!isDragging) {
            if (
              distanceBetween(initialPosition, {
                x: e.pageX,
                y: e.pageY,
              }) > 5
            ) {
              clearTimeout(longPressTimeout);
              window.removeEventListener('touchmove', cancelEvent);
              window.removeEventListener('contextmenu', cancelEvent, true);
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onEnd);
              window.removeEventListener('pointercancel', onEnd);
            }
          } else {
            dndManager.dragManager.dragMove(e);
          }
        } else {
          if (!isDragging) {
            if (
              distanceBetween(initialPosition, {
                x: e.pageX,
                y: e.pageY,
              }) > 5
            ) {
              dndManager.dragManager.dragStart(initialEvent, droppable);
              isDragging = true;
            }
          } else {
            dndManager.dragManager.dragMove(e);
          }
        }
      });

      const onEnd = (e: PointerEvent) => {
        clearTimeout(longPressTimeout);
        isDragging = false;

        dndManager.dragManager.dragEnd(e);

        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);

        if (isMobile) {
          window.removeEventListener('contextmenu', cancelEvent, true);
          window.removeEventListener('touchmove', cancelEvent);
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    };

    const swallowTouchEvent = (e: TouchEvent) => {
      e.stopPropagation();
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('touchstart', swallowTouchEvent);

    return () => {
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('touchstart', swallowTouchEvent);
    };
  }, [droppableElement, handleElement, dndManager]);
}

export function createHTMLDndHandlers(stateManager: StateManager) {
  const dndManager = React.useContext(DndManagerContext);
  const onDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (dndManager.dragManager.isHTMLDragging) {
        e.preventDefault();
        dndManager.dragManager.dragMoveHTML(e.nativeEvent);
      } else {
        dndManager.dragManager.dragStartHTML(
          e.nativeEvent,
          stateManager.getAView().id
        );
      }

      dndManager.dragManager.onHTMLDragLeave(() => {
        dndManager.dragManager.dragEndHTML(
          e.nativeEvent,
          stateManager.getAView().id,
          [],
          true
        );
      });
    },
    [dndManager]
  );

  const onDrop = React.useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      dndManager.dragManager.dragEndHTML(
        e.nativeEvent,
        stateManager.getAView().id,
        await handleDragOrPaste(stateManager, e.nativeEvent),
        false
      );
    },
    [dndManager, stateManager]
  );

  return {
    onDragOver,
    onDrop,
  };
}
