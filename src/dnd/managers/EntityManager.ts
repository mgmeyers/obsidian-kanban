import { adjustHitbox, calculateHitbox, emptyDomRect } from "../util/hitbox";
import {
  Entity,
  EntityData,
  initialScrollShift,
  initialScrollState,
  Path,
} from "../types";
import { ScrollManager } from "./ScrollManager";
import { SortManager } from "./SortManager";
import { DndManager } from "./DndManager";

interface Child {
  manager: EntityManager;
  entity: Entity;
}

export class EntityManager {
  children: Map<string, Child>;
  dndManager: DndManager;
  entityNode: HTMLElement;
  measureNode: HTMLElement;
  getEntityData: () => EntityData;
  index: number;
  parent: EntityManager | null;
  scrollParent: ScrollManager | null;
  sortManager: SortManager | null;
  isVisible: boolean = false;

  id: string;
  entityId: string;
  scopeId: string;

  constructor(
    dndManager: DndManager,
    entityNode: HTMLElement,
    measureNode: HTMLElement,
    scopeId: string,
    id: string,
    index: number,
    parent: EntityManager | null,
    scrollParent: ScrollManager | null,
    sortManager: SortManager | null,
    getEntityData: () => EntityData
  ) {
    this.id = id;
    this.scopeId = scopeId;
    this.entityId = `${scopeId}-${id}`;

    this.dndManager = dndManager;
    this.index = index;
    this.children = new Map();
    this.parent = parent;
    this.scrollParent = scrollParent;
    this.entityNode = entityNode;
    this.measureNode = measureNode;
    this.getEntityData = getEntityData;
    this.sortManager = sortManager;

    measureNode.dataset.hitboxid = this.entityId;
    sortManager?.registerSortable(
      this.entityId,
      this.getEntity(emptyDomRect),
      entityNode,
      measureNode
    );

    if (this.scrollParent) {
      this.scrollParent.registerObserverHandler(
        this.entityId,
        measureNode,
        (entry) => {
          if (entry.isIntersecting) {
            const entity = this.getEntity(entry.boundingClientRect);
            parent?.children.set(this.entityId, {
              entity,
              manager: this,
            });

            dndManager.observeResize(measureNode);

            if (!parent || parent.isVisible) {
              dndManager.registerHitboxEntity(this.entityId, entity);
              this.children.forEach((child, childId) => {
                dndManager.registerHitboxEntity(childId, child.entity);
              });
              this.setVisibility(true);
            }
          } else {
            dndManager.unregisterHitboxEntity(this.entityId);
            this.children.forEach((_, childId) => {
              dndManager.unregisterHitboxEntity(childId);
            });
            parent?.children.delete(this.entityId);
            dndManager.unobserveResize(measureNode);
            this.setVisibility(false);
          }
        }
      );
    } else {
      const entity = this.getEntity(measureNode.getBoundingClientRect());
      dndManager.observeResize(measureNode);
      dndManager.registerHitboxEntity(this.entityId, entity);
      parent?.children.set(this.entityId, {
        entity,
        manager: this,
      });
      this.setVisibility(true);
    }
  }

  setVisibility(isVisible: boolean) {
    this.isVisible = isVisible;
    this.children.forEach((child) => {
      child.manager.setVisibility(isVisible);
    });
  }

  destroy() {
    this.dndManager.unobserveResize(this.measureNode);
    this.sortManager?.unregisterSortable(this.entityId);
    this.scrollParent?.unregisterObserverHandler(
      this.entityId,
      this.measureNode
    );
    this.dndManager.unregisterHitboxEntity(this.entityId);
    this.parent?.children.delete(this.entityId);
  }

  getPath(): Path {
    return [...(this.parent?.getPath() || []), this.index];
  }

  getEntity(rect: DOMRectReadOnly): Entity {
    const manager = this;
    return {
      scopeId: this.scopeId,
      entityId: this.entityId,
      initial: calculateHitbox(
        rect,
        manager.scrollParent?.scrollState || initialScrollState,
        manager.scrollParent?.getScrollShift() || initialScrollShift,
        null
      ),
      getParentScrollState() {
        return manager.scrollParent?.scrollState || initialScrollState;
      },
      getParentScrollShift() {
        return manager.scrollParent?.getScrollShift() || initialScrollShift;
      },
      recalcInitial() {
        this.initial = calculateHitbox(
          manager.measureNode.getBoundingClientRect(),
          manager.scrollParent?.scrollState || initialScrollState,
          manager.scrollParent?.getScrollShift() || initialScrollShift,
          null
        );
      },
      getHitbox() {
        return adjustHitbox(
          this.initial[0],
          this.initial[1],
          this.initial[2],
          this.initial[3],
          this.getParentScrollState(),
          this.getParentScrollShift()
        );
      },
      getPath() {
        return manager.getPath();
      },
      getData() {
        return {
          ...manager.getEntityData(),
          sortAxis: manager.sortManager?.axis,
        };
      },
    };
  }
}
