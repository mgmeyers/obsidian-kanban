import { generateInstanceId } from 'src/components/helpers';

import { Axis, Entity } from '../types';
import {
  getDropDuration,
  removeStyle,
  setStyle,
  transitions,
} from '../util/animation';
import { getHitboxDimensions } from '../util/hitbox';
import { SiblingDirection, getSiblingDirection } from '../util/path';
import { DndManager } from './DndManager';
import { DragEventData } from './DragManager';

type EntityAndElement = [Entity, HTMLElement, HTMLElement];

interface Dimensions {
  width: number;
  height: number;
}

const emptyDimensions: Dimensions = {
  width: 0,
  height: 0,
};

export const dragLeaveDebounceLength = 100;

export class SortManager {
  dndManager: DndManager;
  sortables: Map<string, EntityAndElement>;
  shifted: Set<string>;
  hidden: Set<string>;
  isSorting: boolean;
  isPlaceholderActive: boolean;
  axis: Axis;
  placeholder: EntityAndElement | null;
  instanceId: string;

  sortListeners: Array<(isSorting: boolean) => void>;

  constructor(
    dndManager: DndManager,
    axis: Axis,
    onSortChange?: (isSorting: boolean) => void
  ) {
    this.instanceId = generateInstanceId();
    this.dndManager = dndManager;
    this.sortables = new Map();
    this.shifted = new Set();
    this.hidden = new Set();
    this.isSorting = false;
    this.axis = axis;
    this.placeholder = null;
    this.sortListeners = onSortChange ? [onSortChange] : [];

    dndManager.dragManager.emitter.on('dragStart', this.handleDragStart);
    dndManager.dragManager.emitter.on('dragEnd', this.handleDragEnd);
    dndManager.dragManager.emitter.on('dragEnter', this.handleDragEnter);
    dndManager.dragManager.emitter.on('dragLeave', this.handleDragLeave);
  }

  destroy() {
    this.dndManager.win.clearTimeout(this.dragLeaveTimeout);
    this.dndManager.win.clearTimeout(this.dragEndTimeout);

    this.dndManager.dragManager.emitter.off('dragStart', this.handleDragStart);
    this.dndManager.dragManager.emitter.off('dragEnd', this.handleDragEnd);
    this.dndManager.dragManager.emitter.off('dragEnter', this.handleDragEnter);
    this.dndManager.dragManager.emitter.off('dragLeave', this.handleDragLeave);
  }

  registerSortable(
    id: string,
    entity: Entity,
    el: HTMLElement,
    measureEl: HTMLElement
  ) {
    const isPlaceholder = entity.getData().type === 'placeholder';

    this.sortables.set(id, [entity, el, measureEl]);

    if (isPlaceholder) {
      this.placeholder = [entity, el, measureEl];
      measureEl.dataset.axis = this.axis;
      setStyle(measureEl, 'transition', transitions.none);
    } else {
      setStyle(el, 'transition', transitions.none);
    }
  }

  unregisterSortable(id: string) {
    this.sortables.delete(id);
  }

  hitboxDimensions = emptyDimensions;

  handleDragStart = ({
    dragEntity,
    dragEntityMargin,
    dragOriginHitbox,
  }: DragEventData) => {
    const id = dragEntity?.entityId;
    const haveDragEntity = id ? this.sortables.has(id) : null;

    if (!dragEntity || !haveDragEntity || !dragOriginHitbox) {
      return;
    }

    this.setSortState(true);

    this.hitboxDimensions = getHitboxDimensions(
      dragOriginHitbox,
      dragEntityMargin
    );

    this.activatePlaceholder(this.hitboxDimensions, transitions.none);

    this.sortables.forEach(([entity, el, measureEl]) => {
      const siblingDirection = getSiblingDirection(
        dragEntity.getPath(),
        entity.getPath()
      );
      const entityId = entity.entityId;

      if (siblingDirection === SiblingDirection.Self) {
        this.hidden.add(entityId);
        return this.hideDraggingEntity(measureEl);
      }

      if (siblingDirection === SiblingDirection.After) {
        if (!this.shifted.has(entityId)) {
          this.shifted.add(entityId);
        }

        this.shiftEl(el, transitions.none, this.hitboxDimensions);
      }
    });
  };

  resetSelf({
    maintainHidden,
    maintainPlaceholder,
    shiftTransition,
    placeholderTransition,
  }: {
    maintainHidden?: boolean;
    maintainPlaceholder?: boolean;
    shiftTransition?: string;
    placeholderTransition?: string;
  }) {
    if (this.isSorting) {
      this.setSortState(false);
    }

    if (this.isPlaceholderActive && !maintainPlaceholder) {
      this.deactivatePlaceholder(placeholderTransition);
    }

    if (this.shifted.size > 0) {
      this.shifted.forEach((entityId) => {
        if (this.sortables.has(entityId)) {
          const [, el] = this.sortables.get(entityId);
          this.resetEl(el, shiftTransition);
        }
      });

      this.shifted.clear();
    }

    if (!maintainHidden && this.hidden.size > 0) {
      this.hidden.forEach((entityId) => {
        if (this.sortables.has(entityId)) {
          const [, , measure] = this.sortables.get(entityId);
          this.resetEl(measure, shiftTransition);
        }
      });

      this.hidden.clear();
    }
  }

  private dragEndTimeout = 0;
  handleDragEnd = ({
    primaryIntersection,
    dragPosition,
    dragOriginHitbox,
    dragEntity,
  }: DragEventData) => {
    if (!this.isSorting || !dragPosition || !dragOriginHitbox || !dragEntity) {
      if (
        !primaryIntersection &&
        dragEntity &&
        this.sortables.has(dragEntity.entityId)
      ) {
        return this.resetSelf({ maintainHidden: false });
      }

      if (primaryIntersection && dragEntity) {
        const dropHitbox = primaryIntersection?.getHitbox() || dragOriginHitbox;
        const dropDuration = getDropDuration({
          position: dragPosition,
          destination: {
            x: dropHitbox[0],
            y: dropHitbox[1],
          },
        });

        return this.dndManager.win.setTimeout(() => {
          this.resetSelf({ maintainHidden: false });
        }, dropDuration);
      }

      return this.resetSelf({ maintainHidden: true });
    }

    this.dndManager.win.clearTimeout(this.dragEnterTimeout);
    this.dndManager.win.clearTimeout(this.dragLeaveTimeout);
    this.dndManager.win.clearTimeout(this.dragEndTimeout);

    const dropHitbox = primaryIntersection?.getHitbox() || dragOriginHitbox;
    const dropDuration =
      dragEntity.scopeId === 'htmldnd'
        ? 0
        : getDropDuration({
            position: dragPosition,
            destination: {
              x: dropHitbox[0],
              y: dropHitbox[1],
            },
          });

    this.dragEndTimeout = this.dndManager.win.setTimeout(() => {
      const dragEntityId = dragEntity.entityId.split(':::').pop();
      const primaryIntersectionId = primaryIntersection?.entityId
        .split(':::')
        .pop();

      if (
        primaryIntersection &&
        this.sortables.has(primaryIntersection.entityId) &&
        primaryIntersectionId !== dragEntityId
      ) {
        this.dndManager.onDrop(dragEntity, primaryIntersection);
      }

      this.resetSelf({
        maintainHidden: false,
        shiftTransition: transitions.none,
        placeholderTransition: transitions.none,
      });
    }, dropDuration);

    this.hitboxDimensions = emptyDimensions;
  };

  private dragEnterTimeout = 0;
  handleDragEnter = ({
    dragEntity,
    dragEntityMargin,
    dragOriginHitbox,
    primaryIntersection,
  }: DragEventData) => {
    const id = primaryIntersection?.entityId;
    const haveSortable = id ? this.sortables.has(id) : null;

    if (
      !dragEntity ||
      !primaryIntersection ||
      !haveSortable ||
      !dragOriginHitbox
    ) {
      if (!haveSortable && this.isSorting) {
        this.resetSelf({ maintainHidden: true, maintainPlaceholder: true });
      }

      return;
    }

    if (dragEntity.entityId === primaryIntersection.entityId) {
      return;
    }

    this.dndManager.win.clearTimeout(this.dragLeaveTimeout);
    this.dndManager.win.clearTimeout(this.dragEnterTimeout);

    this.dragEnterTimeout = this.dndManager.win.setTimeout(() => {
      this.setSortState(true);
      this.hitboxDimensions = getHitboxDimensions(
        dragOriginHitbox,
        dragEntityMargin
      );
      this.activatePlaceholder(this.hitboxDimensions, transitions.placeholder);
      this.sortables.forEach(([entity, el]) => {
        const siblingDirection = getSiblingDirection(
          primaryIntersection.getPath(),
          entity.getPath()
        );

        const entityId = entity.entityId;

        if (
          !this.hidden.has(entityId) &&
          (siblingDirection === SiblingDirection.Self ||
            siblingDirection === SiblingDirection.After)
        ) {
          if (!this.shifted.has(entityId)) {
            this.shifted.add(entityId);
            this.shiftEl(el, transitions.outOfTheWay, this.hitboxDimensions);
          }
        } else if (this.shifted.has(entityId)) {
          this.shifted.delete(entityId);
          this.resetEl(el);
        }
      });
    }, 10);
  };

  private dragLeaveTimeout = 0;
  handleDragLeave = () => {
    if (!this.isSorting) return;

    this.dndManager.win.clearTimeout(this.dragLeaveTimeout);
    this.dndManager.win.clearTimeout(this.dragEnterTimeout);
    this.dragLeaveTimeout = this.dndManager.win.setTimeout(() => {
      this.resetSelf({ maintainHidden: true, maintainPlaceholder: true });
    }, dragLeaveDebounceLength);

    this.hitboxDimensions = emptyDimensions;
  };

  activatePlaceholder(
    dimensions: { width: number; height: number },
    transition: string
  ) {
    if (this.placeholder) {
      const isHorizontal = this.axis === 'horizontal';
      const [, , measure] = this.placeholder;

      setStyle(measure, 'transition', transition);
      setStyle(
        measure,
        isHorizontal ? 'width' : 'height',
        `${isHorizontal ? dimensions.width : dimensions.height}px`
      );

      this.isPlaceholderActive = true;
    }
  }

  deactivatePlaceholder(transition: string = transitions.placeholder) {
    if (this.placeholder) {
      const [, , measure] = this.placeholder;

      setStyle(measure, 'transition', transition);
      removeStyle(measure, 'width');
      removeStyle(measure, 'height');

      this.isPlaceholderActive = false;
    }
  }

  hideDraggingEntity(el: HTMLElement) {
    setStyle(el, 'display', 'none');
  }

  shiftEl(
    el: HTMLElement,
    transition: string,
    dimensions: { width: number; height: number }
  ) {
    const shift =
      this.axis === 'horizontal'
        ? `translate3d(${dimensions.width}px, 0, 0)`
        : `translate3d(0, ${dimensions.height}px, 0)`;

    setStyle(el, 'transition', transition);
    setStyle(el, 'transform', shift);
  }

  resetEl(el: HTMLElement, transition: string = transitions.outOfTheWay) {
    setStyle(el, 'transition', transition);
    setStyle(el, 'transform', 'translate3d(0, 0, 0)');
    removeStyle(el, 'display');
  }

  addSortNotifier(fn: (isSorting: boolean) => void) {
    this.sortListeners.push(fn);
  }

  removeSortNotifier(fn: (isSorting: boolean) => void) {
    this.sortListeners = this.sortListeners.filter(
      (listener) => listener !== fn
    );
  }

  setSortState(isSorting: boolean) {
    if (this.isSorting !== isSorting) {
      this.isSorting = isSorting;
      this.sortListeners.forEach((fn) => fn(isSorting));
    }
  }
}
