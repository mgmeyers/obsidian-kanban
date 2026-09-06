/**
 * ============================================================================
 * [실행 순서 #32] animation.ts — 드래그 관련 애니메이션 유틸
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 드래그가 끝나고 카드가 원래 자리로 "스냅"되거나, 다른 카드들이 자리를 비켜주며 부드럽게
 * 밀려나는 등의 CSS 트랜지션/타이밍을 이 파일에서 한곳에 모아 관리한다. 실제로 엘리먼트를
 * 움직이는 것은 CSS의 transform/transition 속성이고, 이 파일은 그 CSS 값을 만들어주는
 * 문자열 상수와 계산 함수, 그리고 requestAnimationFrame 기반 스로틀링 유틸을 제공하는
 * "설정값 + 헬퍼 함수" 모음이다. 애니메이션 하드코딩 값(200ms, 330ms 등)이 여러 군데
 * 흩어지지 않도록 timings/curves/transitions 객체로 정리해 둔 점이 특징이다.
 * ============================================================================
 */

import { Coordinates } from '../types';
import { distanceBetween } from './hitbox';

// rafThrottle이 반환하는 함수의 타입: 원래 함수(fn)와 같은 인자를 받는 호출 가능한 함수이면서,
// 추가로 예약된 애니메이션 프레임을 취소하는 cancel() 메서드도 가진다.
// 제네릭 T extends any[] : "인자들의 타입 배열"을 그대로 보존하기 위한 타입 파라미터
// (몇 개의 인자를 받든, 어떤 타입이든 원래 fn의 시그니처를 그대로 유지하게 해준다).
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
/**
 * (위 원본 JSDoc 유지) fn을 "애니메이션 프레임당 최대 한 번만" 실행되도록 스로틀링한다.
 * 예를 들어 마우스 이동 이벤트처럼 아주 짧은 시간에 여러 번 호출되는 함수를, 브라우저가 다음
 * 화면을 그리기 직전(requestAnimationFrame 콜백 시점)에 딱 한 번만 최신 인자로 실행하게 만든다.
 * - win: getWindow.ts에서 다룬 것처럼, 팝아웃 창을 지원하기 위해 어느 Window의
 *   requestAnimationFrame/cancelAnimationFrame을 쓸지 명시적으로 받는다.
 * - fn: 실제로 실행하고 싶은 함수. 제네릭 T(가변 인자 튜플 타입)로 인자 타입을 그대로 보존한다.
 * - lastArgs: 마지막으로 호출됐을 때 넘어온 인자들을 기억해 둔다(클로저에 저장).
 * - frameId: 현재 예약된 requestAnimationFrame의 ID. 0/undefined면 "아직 예약 안 됨" 상태.
 * - wrapperFn(...args): 호출될 때마다 lastArgs를 최신 인자로 갱신한다. 이미 프레임이 예약되어
 *   있으면(frameId가 참 값이면) 그냥 리턴해 중복 예약을 막고, 없으면 requestAnimationFrame으로
 *   다음 프레임에 fn(...lastArgs)을 실행하도록 예약한다. 콜백 안에서는 frameId를 null로
 *   리셋해 다음 호출 때 다시 예약될 수 있게 한다.
 * - wrapperFn.cancel(): 예약된 프레임이 있으면 cancelAnimationFrame으로 취소하고 frameId를
 *   초기화한다(더 이상 실행되지 않도록 정리).
 * - 반환값: 원래 fn과 같은 방식으로 호출할 수 있는, 스로틀링된 함수(+ cancel 메서드 포함).
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

// 애니메이션에 사용할 CSS cubic-bezier 이징(easing) 곡선 두 가지.
// outOfTheWay: 다른 카드들이 자리를 비켜줄 때 쓰는 곡선. drop: 드롭될 때 쓰는 곡선.
export const curves = {
  outOfTheWay: 'cubic-bezier(0.2, 0, 0, 1)',
  drop: 'cubic-bezier(.2,1,.1,1)',
};

// 드래그 중 다른 위젯과 "합쳐지는(combine)" 듯한 시각 효과에 쓰이는 값 모음.
export const combine = {
  opacity: {
    // while dropping: fade out totally
    // 드롭되는 순간에는 투명도를 0까지 완전히 낮춤(완전히 사라짐).
    drop: 0,
    // while dragging: fade out partially
    // 드래그 중에는 700(ms로 추정되는 단위)만큼의 시간에 걸쳐 부분적으로만 흐려짐.
    combining: 700,
  },
  scale: {
    drop: 750,
  },
};

// 애니메이션 진행 시간(ms) 관련 기준값들을 한곳에 모아둔 객체.
export const timings = {
  outOfTheWay: 200,
  minDropTime: 330,
  maxDropTime: 550,
};

// "outOfTheWay 지속시간 + outOfTheWay 곡선"을 합친 CSS transition 타이밍 문자열을 미리 만들어 둔다.
// 템플릿 리터럴(백틱 문자열) 안에 timings/curves 값을 삽입.
const outOfTheWayTiming: string = `${timings.outOfTheWay}ms ${curves.outOfTheWay}`;
// 플레이스홀더(빈 칸) 전환이 시작되기까지의 지연 시간(ms).
export const placeholderTransitionDelayTime: number = 100;

// 실제 CSS `transition` 속성 값으로 바로 대입할 수 있는 문자열들을 모아둔 객체.
export const transitions = {
  none: `none`,
  // opacity만 outOfTheWay 타이밍으로 전환.
  fluid: `opacity ${outOfTheWayTiming}`,
  // transform과 opacity를 함께 outOfTheWay 타이밍으로 전환(제자리로 스냅되는 효과).
  snap: `transform ${outOfTheWayTiming}, opacity ${outOfTheWayTiming}`,
  // drop(duration): 드롭 애니메이션의 지속시간(duration, ms)을 인자로 받아 그때그때
  // transform/opacity 전환 문자열을 동적으로 만들어 반환하는 함수(고정 문자열이 아님).
  drop: (duration: number): string => {
    const timing: string = `${duration}ms ${curves.drop}`;
    return `transform ${timing}, opacity ${timing}`;
  },
  // transform만 outOfTheWay 타이밍으로 전환(다른 카드가 비켜나는 움직임에 사용).
  outOfTheWay: `transform ${outOfTheWayTiming}`,
  // 플레이스홀더(드롭될 자리를 미리 보여주는 빈 칸)의 높이/너비/여백/테두리색 전환.
  placeholder: `height ${outOfTheWayTiming}, width ${outOfTheWayTiming}, margin ${outOfTheWayTiming}, border-color ${outOfTheWayTiming}`,
};

// 두 좌표(point1, point2)의 x, y가 모두 같은지 비교해 완전히 동일한 위치인지 판정한다.
export const isEqual = (point1: Coordinates, point2: Coordinates): boolean =>
  point1.x === point2.x && point1.y === point2.y;

// 좌표 (0, 0), 즉 이동하지 않은 원점을 나타내는 기준값.
export const origin: Coordinates = { x: 0, y: 0 };

// offset만큼 이동시키는 CSS `translate()` 문자열을 만든다. 단, offset이 원점(origin)과
// 같다면(이동량이 없다면) 굳이 transform을 걸 필요가 없으므로 undefined를 반환해 스타일을
// 아예 적용하지 않게 한다(불필요한 스타일 재계산을 줄이기 위한 최적화).
const moveTo = (offset: Coordinates): string | undefined =>
  isEqual(offset, origin) ? undefined : `translate(${offset.x}px, ${offset.y}px)`;

// transform 관련 헬퍼 함수 모음. drop은 지금은 moveTo와 동일하게 동작하지만, 이름을
// 분리해 두어 나중에 드롭 시에만 다른 처리를 넣기 쉽게 만든 구조다.
export const transforms = {
  moveTo,
  drop: (offset: Coordinates) => {
    return moveTo(offset);
  },
};

// 최대/최소 드롭 시간의 차이(범위). 거리에 따라 이 범위 안에서 시간을 보간(선형 보간)한다.
const dropTimeRange: number = timings.maxDropTime - timings.minDropTime;
// "이 거리 이상이면 무조건 최대 드롭 시간을 적용한다"는 기준 거리(px).
const maxDropTimeAtDistance: number = 1500;
// will bring a time lower - which makes it faster
// (원본 주석 유지) 취소(cancel) 시 곱해서 시간을 줄여(더 빠르게) 만드는 배율.
const cancelDropModifier: number = 0.6;

/**
 * 드래그 중이던 카드가 position에서 destination까지 이동해 드롭될 때, 그 이동 거리에 비례해
 * 자연스러운 드롭 애니메이션 지속시간(ms)을 계산한다. 구조분해할당으로 매개변수 객체에서
 * position/destination/isCancel 세 값을 바로 꺼내 쓴다.
 * - distance: hitbox.ts의 distanceBetween으로 구한 두 좌표 사이의 유클리드 거리.
 * - 거리가 0 이하(이동 없음)면 최소 시간(minDropTime)만 사용(그래도 opacity 전환 등 필요할 수
 *   있어 시간을 0으로 만들지는 않음).
 * - 거리가 maxDropTimeAtDistance(1500px) 이상이면 무조건 최대 시간(maxDropTime).
 * - 그 사이 거리라면, percentage(0~1 사이 비율)를 구해 minDropTime과 (범위 * percentage)를
 *   더하는 선형 보간(linear interpolation)으로 duration을 계산한다.
 * - isCancel(드래그 취소)이면 계산된 duration에 cancelDropModifier(0.6)를 곱해 더 빠르게 만든다.
 * - 최종적으로 Math.round로 반올림한 정수(ms)를 반환한다.
 */
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

  const withDuration: number = isCancel ? duration * cancelDropModifier : duration;

  return Math.round(withDuration);
}

// 인라인 스타일 property의 현재 값이 value와 다를 때만 setProperty를 호출해 실제로 값이
// 바뀔 때만 DOM에 스타일을 적용한다(불필요한 리페인트/리플로우를 줄이기 위한 가드).
export function setStyle(el: HTMLElement, property: string, value: string) {
  if (el.style.getPropertyValue(property) !== value) {
    el.style.setProperty(property, value);
  }
}

// 인라인 스타일 property가 실제로 설정되어 있을 때만 removeProperty를 호출해 제거한다.
export function removeStyle(el: HTMLElement, property: string) {
  if (el.style.getPropertyValue(property)) {
    el.style.removeProperty(property);
  }
}
