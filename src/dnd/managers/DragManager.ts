import boxIntersect from 'box-intersect';
import rafSchd from 'raf-schd';
import React from 'react';

import { DndManagerContext } from '../components/context';
import { Coordinates, Entity, Hitbox, Side } from '../types';
import { Emitter } from '../util/emitter';
import {
  adjustHitboxForMovement,
  distanceBetween,
  getBestIntersect,
  getScrollIntersection,
} from '../util/hitbox';

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

  dragMove(e: PointerEvent) {
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

      e.stopPropagation();
      e.preventDefault();

      const initialEvent = e;
      const initialPosition: Coordinates = {
        x: e.pageX,
        y: e.pageY,
      };

      let isDragging = false;
      let dragStarted = false;

      const onMove = rafSchd((e: PointerEvent) => {
        if (!dragStarted) {
          if (
            distanceBetween(initialPosition, {
              x: e.pageX,
              y: e.pageY,
            }) > 5
          ) {
            dndManager.dragManager.dragStart(initialEvent, droppable);
            isDragging = true;
            dragStarted = true;
          }
        } else if (isDragging) {
          dndManager.dragManager.dragMove(e);
        }
      });

      const onEnd = (e: PointerEvent) => {
        isDragging = false;
        dragStarted = false;

        dndManager.dragManager.dragEnd(e);

        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    };

    handle.addEventListener('pointerdown', onPointerDown);

    return () => {
      handle.removeEventListener('pointerdown', onPointerDown);
    };
  }, [droppableElement, handleElement, dndManager]);
}
