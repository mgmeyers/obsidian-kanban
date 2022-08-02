import boxIntersect from 'box-intersect';
import Preact from 'preact/compat';

import { handleDragOrPaste } from 'src/components/Item/helpers';
import { StateManager } from 'src/StateManager';

import { DndManagerContext } from '../components/context';
import { Coordinates, Entity, Hitbox, Side } from '../types';
import { rafThrottle } from '../util/animation';
import { createHTMLDndEntity } from '../util/createHTMLDndEntity';
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
  win: Window;
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
    win: Window,
    emitter: Emitter,
    hitboxEntities: Map<string, Entity>,
    scrollEntities: Map<string, Entity>
  ) {
    this.win = win;
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
    const entity = createHTMLDndEntity(e.pageX, e.pageY, [], viewId, e.view);

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
      this.dragEntity = createHTMLDndEntity(
        e.pageX,
        e.pageY,
        content,
        viewId,
        e.view
      );
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
    this.win.clearTimeout(this.dragOverTimeout);
    this.dragOverTimeout = this.win.setTimeout(callback, 351);
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

    const { type, win } = this.dragEntity.getData();

    const hitboxEntities: Entity[] = [];
    const hitboxHitboxes: Hitbox[] = [];
    const scrollEntities: Entity[] = [];
    const scrollHitboxes: Hitbox[] = [];

    this.hitboxEntities.forEach((entity) => {
      const data = entity.getData();

      if (win === data.win && data.accepts.includes(type)) {
        hitboxEntities.push(entity);
        hitboxHitboxes.push(entity.getHitbox());
      }
    });

    this.scrollEntities.forEach((entity) => {
      const data = entity.getData();

      if (win === data.win && data.accepts.includes(type)) {
        scrollEntities.push(entity);
        scrollHitboxes.push(entity.getHitbox());
      }
    });

    if (hitboxEntities.length === 0 && scrollEntities.length === 0) {
      return;
    }

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
  droppableElement: Preact.RefObject<HTMLElement | null>,
  handleElement: Preact.RefObject<HTMLElement | null>
) {
  const dndManager = Preact.useContext(DndManagerContext);

  Preact.useEffect(() => {
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

      const win = e.view;
      const isTouchEvent = ['pen', 'touch'].includes(e.pointerType);

      if (!isTouchEvent) {
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

      if (isTouchEvent) {
        win.addEventListener('contextmenu', cancelEvent, true);

        longPressTimeout = win.setTimeout(() => {
          dndManager.dragManager.dragStart(initialEvent, droppable);
          isDragging = true;
          win.addEventListener('touchmove', cancelEvent, {
            passive: false,
          });
        }, 500);
      }

      const onMove = rafThrottle(win, (e: PointerEvent) => {
        if (isTouchEvent) {
          if (!isDragging) {
            if (
              distanceBetween(initialPosition, {
                x: e.pageX,
                y: e.pageY,
              }) > 5
            ) {
              win.clearTimeout(longPressTimeout);
              win.removeEventListener('touchmove', cancelEvent);
              win.removeEventListener('contextmenu', cancelEvent, true);
              win.removeEventListener('pointermove', onMove);
              win.removeEventListener('pointerup', onEnd);
              win.removeEventListener('pointercancel', onEnd);
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
        win.clearTimeout(longPressTimeout);
        isDragging = false;

        dndManager.dragManager.dragEnd(e);

        win.removeEventListener('pointermove', onMove);
        win.removeEventListener('pointerup', onEnd);
        win.removeEventListener('pointercancel', onEnd);

        if (isTouchEvent) {
          win.removeEventListener('contextmenu', cancelEvent, true);
          win.removeEventListener('touchmove', cancelEvent);
        }
      };

      win.addEventListener('pointermove', onMove);
      win.addEventListener('pointerup', onEnd);
      win.addEventListener('pointercancel', onEnd);
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
  const dndManager = Preact.useContext(DndManagerContext);
  const onDragOver = Preact.useCallback(
    (e: DragEvent) => {
      if (dndManager.dragManager.isHTMLDragging) {
        e.preventDefault();
        dndManager.dragManager.dragMoveHTML(e);
      } else {
        dndManager.dragManager.dragStartHTML(e, stateManager.getAView().id);
      }

      dndManager.dragManager.onHTMLDragLeave(() => {
        dndManager.dragManager.dragEndHTML(
          e,
          stateManager.getAView().id,
          [],
          true
        );
      });
    },
    [dndManager, stateManager]
  );

  const onDrop = Preact.useCallback(
    async (e: DragEvent) => {
      dndManager.dragManager.dragEndHTML(
        e,
        stateManager.getAView().id,
        await handleDragOrPaste(
          stateManager,
          e,
          activeWindow as Window & typeof globalThis
        ),
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
