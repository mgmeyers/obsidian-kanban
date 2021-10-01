import {
  CoordinateShift,
  Coordinates,
  Entity,
  Hitbox,
  ScrollState,
  Side,
} from '../types';

export const emptyDomRect: DOMRectReadOnly = {
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  x: 0,
  y: 0,
  toJSON() {},
};

export const emptyHitbox: Hitbox = [0, 0, 0, 0];

export function numberOrZero(n?: number) {
  return n === undefined ? 0 : n;
}

export function noop() {}

export function calculateHitbox(
  rect: DOMRectReadOnly,
  scroll: ScrollState | null,
  scrollShift: CoordinateShift | null,
  manualShift: CoordinateShift | null
): Hitbox {
  return [
    // minx
    rect.left +
      numberOrZero(scroll?.x) +
      numberOrZero(scrollShift?.x) -
      numberOrZero(manualShift?.x),
    // miny
    rect.top +
      numberOrZero(scroll?.y) +
      numberOrZero(scrollShift?.y) -
      numberOrZero(manualShift?.y),

    // maxx
    rect.left +
      rect.width +
      numberOrZero(scroll?.x) +
      numberOrZero(scrollShift?.x) -
      numberOrZero(manualShift?.x),
    // maxy
    rect.top +
      rect.height +
      numberOrZero(scroll?.y) +
      numberOrZero(scrollShift?.y) -
      numberOrZero(manualShift?.y),
  ];
}

export function calculateScrollHitbox(
  rect: DOMRectReadOnly,
  scroll: ScrollState | null,
  scrollShift: CoordinateShift | null,
  side: Side
): Hitbox {
  const hitbox = calculateHitbox(rect, scroll, scrollShift, null);

  if (side === 'top') {
    hitbox[3] = hitbox[1] + 35;
    return hitbox;
  }

  if (side === 'right') {
    hitbox[0] = hitbox[0] + rect.width - 35;
    return hitbox;
  }

  if (side === 'bottom') {
    hitbox[1] = hitbox[1] + rect.height - 35;
    return hitbox;
  }

  // left
  hitbox[2] = hitbox[0] + 35;
  return hitbox;
}

export function adjustHitbox(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  scroll: ScrollState | null,
  scrollShift: CoordinateShift | null
): Hitbox {
  return [
    minX - numberOrZero(scroll?.x) - numberOrZero(scrollShift?.x),
    minY - numberOrZero(scroll?.y) - numberOrZero(scrollShift?.y),
    maxX - numberOrZero(scroll?.x) - numberOrZero(scrollShift?.x),
    maxY - numberOrZero(scroll?.y) - numberOrZero(scrollShift?.y),
  ];
}

export const getMaxValueIndex = (array: number[]) =>
  getValueIndex(array, (value, tracked) => value > tracked);

export const getMinValueIndex = (array: number[]) =>
  getValueIndex(array, (value, tracked) => value < tracked);

export function getValueIndex(
  array: number[],
  comparator: (value: number, tracked: number) => boolean
) {
  if (array.length === 0) {
    return -1;
  }

  let tracked = array[0];
  let index = 0;

  for (let i = 1; i < array.length; i++) {
    if (comparator(array[i], tracked)) {
      index = i;
      tracked = array[i];
    }
  }

  return index;
}

function getIntersectionRatio(hitboxA: Hitbox, hitboxB: Hitbox): number {
  const aWidth = hitboxA[2] - hitboxA[0];
  const bWidth = hitboxB[2] - hitboxB[0];
  const aHeight = hitboxA[3] - hitboxA[1];
  const bHeight = hitboxB[3] - hitboxB[1];
  const top = Math.max(hitboxB[1], hitboxA[1]);
  const left = Math.max(hitboxB[0], hitboxA[0]);
  const right = Math.min(hitboxB[2], hitboxA[2]);
  const bottom = Math.min(hitboxB[3], hitboxA[3]);
  const width = right - left;
  const height = bottom - top;

  if (left < right && top < bottom) {
    const targetArea = bWidth * bHeight;
    const entryArea = aWidth * aHeight;
    const intersectionArea = width * height;
    const intersectionRatio =
      intersectionArea / (targetArea + entryArea - intersectionArea);

    return Number(intersectionRatio.toFixed(4));
  }

  return 0;
}

export function rectIntersection(entities: Entity[], target: Hitbox) {
  const intersections = entities.map((entity) =>
    getIntersectionRatio(entity.getHitbox(), target)
  );

  const maxValueIndex = getMaxValueIndex(intersections);

  if (intersections[maxValueIndex] <= 0) {
    return null;
  }

  return entities[maxValueIndex] ? entities[maxValueIndex] : null;
}

export function getScrollIntersection(
  entities: Entity[],
  target: Hitbox,
  dragId: string
): [Entity, number] {
  const primary = getBestIntersect(entities, target, dragId);

  if (!primary) return null;

  const side = primary.getData().side as Side;
  const hitbox = primary.getHitbox();

  let targetIndex = 0;
  let hitboxIndex = 0;

  if (side === 'left') {
    targetIndex = 0;
    hitboxIndex = 2;
  } else if (side === 'right') {
    targetIndex = 2;
    hitboxIndex = 0;
  } else if (side === 'top') {
    targetIndex = 1;
    hitboxIndex = 3;
  } else if (side === 'bottom') {
    targetIndex = 3;
    hitboxIndex = 1;
  }

  const distance = Math.abs(target[targetIndex] - hitbox[hitboxIndex]);
  const max = Math.abs(hitbox[targetIndex] - hitbox[hitboxIndex]);

  return [primary, max - distance];
}

/**
 * Returns the coordinates of the corners of a given rectangle:
 * [TopLeft {x, y}, TopRight {x, y}, BottomLeft {x, y}, BottomRight {x, y}]
 */

function cornersOfRectangle(hitbox: Hitbox): Coordinates[] {
  return [
    {
      x: hitbox[0],
      y: hitbox[1],
    },
    {
      x: hitbox[2],
      y: hitbox[1],
    },
    {
      x: hitbox[0],
      y: hitbox[3],
    },
    {
      x: hitbox[2],
      y: hitbox[3],
    },
  ];
}

export function distanceBetween(p1: Coordinates, p2: Coordinates) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

export function closestCorners(entities: Entity[], target: Hitbox) {
  const corners = cornersOfRectangle(target);

  const distances = entities.map((entity) => {
    const entryCorners = cornersOfRectangle(entity.getHitbox());
    const distances = corners.reduce((accumulator, corner, index) => {
      return accumulator + distanceBetween(entryCorners[index], corner);
    }, 0);

    return Number((distances / 4).toFixed(4));
  });

  const minValueIndex = getMinValueIndex(distances);

  return entities[minValueIndex] ? entities[minValueIndex] : null;
}

/**
 * Returns the coordinates of the center of a given ClientRect
 */
function centerOfRectangle(hitbox: Hitbox): Coordinates {
  return {
    x: (hitbox[0] + hitbox[2]) / 2,
    y: (hitbox[1] + hitbox[2]) / 2,
  };
}

/**
 * Returns the closest rectangle from an array of rectangles to the center of a given
 * rectangle.
 */
export function closestCenter(entities: Entity[], target: Hitbox) {
  const centerRect = centerOfRectangle(target);
  const distances = entities.map((entity) =>
    distanceBetween(centerOfRectangle(entity.getHitbox()), centerRect)
  );

  const minValueIndex = getMinValueIndex(distances);

  return entities[minValueIndex] ? entities[minValueIndex] : null;
}

export function getBestIntersect(
  hits: Entity[],
  dragHitbox: Hitbox,
  dragId: string
): Entity | null {
  const dragTopLeft = cornersOfRectangle(dragHitbox)[0];
  const distances = hits.map((entity) => {
    if (entity.entityId === dragId) {
      return Infinity;
    }

    const entityHitbox = entity.getHitbox();
    const entityTopLeft = cornersOfRectangle(entityHitbox)[0];
    const entityCenter = centerOfRectangle(dragHitbox);
    const axis = entity.getData().sortAxis === 'horizontal' ? 'x' : 'y';

    const modifier = entityCenter[axis] > dragTopLeft[axis] ? 1000 : 0;

    return distanceBetween(entityTopLeft, dragTopLeft) + modifier;
  });

  const minValueIndex = getMinValueIndex(distances);

  return hits[minValueIndex] ? hits[minValueIndex] : null;
}

export function getElementScrollOffsets(element: HTMLElement): ScrollState {
  const {
    scrollLeft,
    scrollTop,
    scrollWidth,
    scrollHeight,
    offsetWidth,
    offsetHeight,
  } = element;

  const x = scrollLeft;
  const y = scrollTop;
  const maxX = scrollWidth - offsetWidth;
  const maxY = scrollHeight - offsetHeight;

  return {
    x,
    y,
    maxX: Math.max(maxX, 0),
    maxY: Math.max(maxY, 0),
  };
}

export function adjustHitboxForMovement(
  hitbox: Hitbox,
  origin: Coordinates,
  position: Coordinates
): Hitbox {
  const xShift = Math.trunc((position.x - origin.x) * 100) / 100;
  const yShift = Math.trunc((position.y - origin.y) * 100) / 100;

  return [
    hitbox[0] + xShift,
    hitbox[1] + yShift,
    hitbox[2] + xShift,
    hitbox[3] + yShift,
  ];
}

export function getScrollIntersectionDiff(
  prev: [Entity, number][],
  next: [Entity, number][]
): {
  add: [Entity, number][];
  update: [Entity, number][];
  remove: [Entity, number][];
} {
  const add: [Entity, number][] = [];
  const remove: [Entity, number][] = [];
  const update: [Entity, number][] = [];

  const inPrev: Record<string, [Entity, number]> = {};
  const inNext: Record<string, [Entity, number]> = {};

  prev.forEach((intersection) => {
    inPrev[intersection[0].entityId] = intersection;
  });

  next.forEach((intersection) => {
    const id = intersection[0].entityId;

    if (!inPrev[id]) {
      add.push(intersection);
    } else if (inPrev[id][1] !== intersection[1]) {
      update.push(intersection);
    }

    inNext[id] = intersection;
  });

  prev.forEach((intersection) => {
    if (!inNext[intersection[0].entityId]) {
      remove.push(intersection);
    }
  });

  return {
    add,
    update,
    remove,
  };
}

export function getHitboxDimensions(
  hitbox: Hitbox,
  margin: Hitbox = [0, 0, 0, 0]
) {
  const minX = hitbox[0] - margin[0];
  const minY = hitbox[1] - margin[1];
  const maxX = hitbox[2] + margin[2];
  const maxY = hitbox[3] + margin[3];

  const height = maxY - minY;
  const width = maxX - minX;

  return { width, height };
}
