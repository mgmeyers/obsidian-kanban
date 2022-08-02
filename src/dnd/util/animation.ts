import { Coordinates } from '../types';
import { distanceBetween } from './hitbox';

type ThrottledFn<T extends any[]> = {
  (...args: T): void;
  cancel: () => void;
};

/**
 * Throttle a function so it only executes once per animation frame
 *
 * @param fn The function to throttle
 * @returns a wrapped function trottled by requestAnimationFrame
 */
export function rafThrottle<T extends any[]>(
  win: Window,
  fn: (...args: T) => void
): ThrottledFn<T> {
  let lastArgs: T;
  let frameId: number;

  const wrapperFn: ThrottledFn<T> = (...args: T) => {
    lastArgs = args;
    if (frameId) return;
    frameId = win.requestAnimationFrame(() => {
      frameId = null;
      fn(...lastArgs);
    });
  };

  wrapperFn.cancel = () => {
    if (!frameId) return;
    win.cancelAnimationFrame(frameId);
    frameId = null;
  };

  return wrapperFn;
}

export const curves = {
  outOfTheWay: 'cubic-bezier(0.2, 0, 0, 1)',
  drop: 'cubic-bezier(.2,1,.1,1)',
};

export const combine = {
  opacity: {
    // while dropping: fade out totally
    drop: 0,
    // while dragging: fade out partially
    combining: 700,
  },
  scale: {
    drop: 750,
  },
};

export const timings = {
  outOfTheWay: 200,
  minDropTime: 330,
  maxDropTime: 550,
};

const outOfTheWayTiming: string = `${timings.outOfTheWay}ms ${curves.outOfTheWay}`;
export const placeholderTransitionDelayTime: number = 100;

export const transitions = {
  none: `none`,
  fluid: `opacity ${outOfTheWayTiming}`,
  snap: `transform ${outOfTheWayTiming}, opacity ${outOfTheWayTiming}`,
  drop: (duration: number): string => {
    const timing: string = `${duration}ms ${curves.drop}`;
    return `transform ${timing}, opacity ${timing}`;
  },
  outOfTheWay: `transform ${outOfTheWayTiming}`,
  placeholder: `height ${outOfTheWayTiming}, width ${outOfTheWayTiming}, margin ${outOfTheWayTiming}, border-color ${outOfTheWayTiming}`,
};

export const isEqual = (point1: Coordinates, point2: Coordinates): boolean =>
  point1.x === point2.x && point1.y === point2.y;

export const origin: Coordinates = { x: 0, y: 0 };

const moveTo = (offset: Coordinates): string | undefined =>
  isEqual(offset, origin)
    ? undefined
    : `translate(${offset.x}px, ${offset.y}px)`;

export const transforms = {
  moveTo,
  drop: (offset: Coordinates) => {
    return moveTo(offset);
  },
};

const dropTimeRange: number = timings.maxDropTime - timings.minDropTime;
const maxDropTimeAtDistance: number = 1500;
// will bring a time lower - which makes it faster
const cancelDropModifier: number = 0.6;

export function getDropDuration({
  position,
  destination,
  isCancel,
}: {
  position: Coordinates;
  destination: Coordinates;
  isCancel?: boolean;
}): number {
  const distance: number = distanceBetween(position, destination);
  // even if there is no distance to travel, we might still need to animate opacity
  if (distance <= 0) {
    return timings.minDropTime;
  }

  if (distance >= maxDropTimeAtDistance) {
    return timings.maxDropTime;
  }

  // * range from:
  // 0px = 0.33s
  // 1500px and over = 0.55s
  // * If reason === 'CANCEL' then speeding up the animation
  // * round to 2 decimal points

  const percentage: number = distance / maxDropTimeAtDistance;
  const duration: number = timings.minDropTime + dropTimeRange * percentage;

  const withDuration: number = isCancel
    ? duration * cancelDropModifier
    : duration;

  return Math.round(withDuration);
}

export function setStyle(el: HTMLElement, property: string, value: string) {
  if (el.style.getPropertyValue(property) !== value) {
    el.style.setProperty(property, value);
  }
}

export function removeStyle(el: HTMLElement, property: string) {
  if (el.style.getPropertyValue(property)) {
    el.style.removeProperty(property);
  }
}
