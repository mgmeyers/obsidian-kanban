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
  id: string;
  index: number;
  parent: EntityManager | null;
  scopeId: string;
  scrollParent: ScrollManager | null;
  sortManager: SortManager | null;
  isVisible: boolean = false;

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
    this.dndManager = dndManager;
    this.id = id;
    this.index = index;
    this.scopeId = scopeId;
    this.children = new Map();
    this.parent = parent;
    this.scrollParent = scrollParent;
    this.entityNode = entityNode;
    this.measureNode = measureNode;
    this.getEntityData = getEntityData;
    this.sortManager = sortManager;

    measureNode.dataset.hitboxid = id;
    sortManager?.registerSortable(id, this.getEntity(emptyDomRect), entityNode, measureNode);

    if (this.scrollParent) {
      this.scrollParent.registerObserverHandler(id, measureNode, (entry) => {
        if (entry.isIntersecting) {
          const entity = this.getEntity(entry.boundingClientRect);
          parent?.children.set(id, {
            entity,
            manager: this,
          });

          dndManager.observeResize(measureNode);

          if (!parent || parent.isVisible) {
            dndManager.registerHitboxEntity(id, entity);
            this.children.forEach((child, childId) => {
              dndManager.registerHitboxEntity(childId, child.entity);
            });
            this.setVisibility(true);
          }
        } else {
          dndManager.unregisterHitboxEntity(id);
          this.children.forEach((_, childId) => {
            dndManager.unregisterHitboxEntity(childId);
          });
          parent?.children.delete(id);
          dndManager.unobserveResize(measureNode);
          this.setVisibility(false);
        }
      });
    } else {
      const entity = this.getEntity(measureNode.getBoundingClientRect());
      dndManager.observeResize(measureNode);
      dndManager.registerHitboxEntity(id, entity);
      parent?.children.set(id, {
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
    this.sortManager?.unregisterSortable(this.id);
    this.scrollParent?.unregisterObserverHandler(this.id, this.measureNode);
    this.dndManager.unregisterHitboxEntity(this.id);
    this.parent?.children.delete(this.id);
  }

  getPath(): Path {
    return [...(this.parent?.getPath() || []), this.index];
  }

  getEntity(rect: DOMRectReadOnly): Entity {
    const manager = this;
    return {
      scopeId: this.scopeId,
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
