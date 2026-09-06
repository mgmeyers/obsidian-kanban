/**
 * ============================================================================
 * [실행 순서 #31] hitbox.ts — 좌표/사각형 충돌 계산(마우스 포인터가 어떤 요소 위에 있는지 판정)
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 드래그를 하는 동안 dnd 엔진은 매 프레임 "지금 드래그 중인 카드가 화면의 어느 레인/아이템
 * 위에 겹쳐 있는가?"를 계속 판단해야 한다. 이 파일은 그 판단에 필요한 순수 계산 함수들을 모아
 * 놓았다. 기본 단위는 Hitbox([minX, minY, maxX, maxY] 형태의 사각형)이며, DOM의 getBoundingClientRect()
 * 결과에 스크롤 위치·스크롤 보정값·수동 이동값을 더하고 빼서 "문서 전체 좌표계" 기준의 사각형을
 * 만들어낸다(calculateHitbox). 이후 두 사각형이 얼마나 겹치는지(rectIntersection), 어느
 * 사각형이 더 가까운지(closestCorners/closestCenter), 드롭 시 스크롤 방향은 어느 쪽인지
 * (getScrollIntersection) 등을 계산하는 함수들이 이어진다. 순수 함수 위주라 로직만 따라가면
 * 이해하기 쉽지만, 좌표 공식이 촘촘하므로 각 함수의 계산식이 "무엇을 구하는지" 하나씩 짚어둔다.
 * ============================================================================
 */

import { CoordinateShift, Coordinates, Entity, Hitbox, ScrollState, Side } from '../types';

// 빈(모두 0인) DOMRectReadOnly 값. toJSON()은 DOMRectReadOnly 인터페이스가 요구하는
// 메서드라서 형태를 맞추기 위해 빈 함수로 채워 넣은 것뿐, 실제로 값을 만들어 반환하진 않는다.
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

// 넓이/높이가 0인 빈 Hitbox. "겹치는 대상이 없음"을 나타내는 기본값 등으로 쓰인다.
export const emptyHitbox: Hitbox = [0, 0, 0, 0];

// n이 undefined면 0을, 아니면 n 그대로를 반환한다.
// 스크롤/보정값이 없을 수도 있는(옵셔널) 계산식에서 "값이 없으면 더하고 빼는 데 영향 없게"
// 만들기 위해 자주 사용되는 헬퍼.
export function numberOrZero(n?: number) {
  return n === undefined ? 0 : n;
}

// 아무 일도 하지 않는 함수. 콜백이 필요한 자리에 "기본값"으로 채워 넣는 용도.
export function noop() {}

/**
 * DOM의 getBoundingClientRect() 결과(rect, 뷰포트 기준 좌표)를 스크롤 상태(scroll),
 * 스크롤로 인한 보정값(scrollShift), 수동 이동 보정값(manualShift)까지 반영해
 * "문서 좌표계" 기준의 Hitbox([minX, minY, maxX, maxY])로 변환한다.
 * - minX = rect.left + 스크롤된 만큼(scroll.x) + 스크롤 보정(scrollShift.x) - 수동 보정(manualShift.x)
 * - minY도 y축에 대해 동일한 공식.
 * - maxX = minX와 같은 보정을 적용하되 rect.left 대신 "rect.left + rect.width"(오른쪽 끝)에서 시작.
 * - maxY도 마찬가지로 "rect.top + rect.height"(아래쪽 끝) 기준.
 * 즉 사각형의 좌상단과 우하단 좌표 각각에 대해 "화면에 보이는 위치 + 스크롤량 - 수동 이동량"을
 * 계산해 실제 판정에 쓸 수 있는 좌표로 정규화하는 함수다. scroll/scrollShift/manualShift가
 * null일 수 있으므로 numberOrZero로 안전하게 0 처리한다.
 */
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

/**
 * 드래그 중 화면 가장자리에 마우스를 가져가면 자동 스크롤이 일어나도록, 요소의 네 변(top/right/
 * bottom/left) 중 지정한 side 쪽에 "35px 두께의 얇은 감지 영역" Hitbox를 만든다.
 * - 먼저 calculateHitbox로 기본 사각형을 구한 다음, side에 따라 한쪽 변만 35px만큼 안쪽으로
 *   당겨서 얇은 띠 모양으로 만든다.
 *   - 'top'   : 아래쪽 경계(hitbox[3], maxY)를 "윗변 + 35"로 줄여 상단 35px만 남김.
 *   - 'right' : 왼쪽 경계(hitbox[0], minX)를 "오른쪽 끝 - 35"로 밀어 우측 35px만 남김.
 *   - 'bottom': 위쪽 경계(hitbox[1], minY)를 "아랫변 - 35"로 밀어 하단 35px만 남김.
 *   - 'left'  : 오른쪽 경계(hitbox[2], maxX)를 "왼쪽 끝 + 35"로 줄여 좌측 35px만 남김.
 * - 반환값: 스크롤 감지 트리거로 쓰이는, 지정한 변 쪽에 붙은 얇은 Hitbox.
 */
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

/**
 * 이미 계산된 minX/minY/maxX/maxY 좌표값들에서 스크롤량(scroll)과 스크롤 보정값(scrollShift)만큼
 * "빼서" 되돌리는(원래 스크롤이 없었을 때의 좌표로 조정하는) 함수. calculateHitbox와 반대 방향의
 * 보정(스크롤된 만큼을 더하는 게 아니라 빼는 것)이라고 볼 수 있다.
 */
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

// 숫자 배열에서 "가장 큰 값"을 가진 원소의 인덱스를 반환한다.
// getValueIndex에 "value > tracked면 갱신"이라는 비교 함수를 넘겨 구현(화살표 함수, 함수 합성).
export const getMaxValueIndex = (array: number[]) =>
  getValueIndex(array, (value, tracked) => value > tracked);

// 숫자 배열에서 "가장 작은 값"을 가진 원소의 인덱스를 반환한다.
// getMaxValueIndex와 동일한 구조이되 비교 방향만 반대(value < tracked)로 넘긴다.
export const getMinValueIndex = (array: number[]) =>
  getValueIndex(array, (value, tracked) => value < tracked);

/**
 * 배열을 순회하면서 comparator(비교 함수)가 "참"을 반환할 때마다 "지금까지 추적 중인 값
 * (tracked)"과 "그 값의 인덱스(index)"를 갱신해 나가는 범용 탐색 함수.
 * - 배열이 비어 있으면 -1을 반환(유효한 인덱스가 없음을 의미).
 * - 그렇지 않으면 첫 원소를 초기 tracked 값으로 놓고, 두 번째 원소부터 끝까지 순회하며
 *   comparator(array[i], tracked)가 true인 경우에만 tracked와 index를 그 원소로 바꾼다.
 * - getMaxValueIndex/getMinValueIndex가 각각 ">"/"<" 비교 함수를 넘겨 이 함수를 재사용한다.
 */
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

/**
 * 두 Hitbox(hitboxA, hitboxB)가 서로 얼마나 겹치는지를 "IoU(Intersection over Union,
 * 교집합 넓이 / 합집합 넓이)" 방식으로 계산해 0~1 사이의 비율로 반환한다.
 * - aWidth/aHeight, bWidth/bHeight: 각 사각형의 너비/높이(= max - min).
 * - top/left/right/bottom: 두 사각형이 겹치는 부분의 경계를 구한다. 겹치는 영역의
 *   위쪽 경계는 "두 top 중 더 아래(큰) 값"(Math.max), 왼쪽 경계는 "두 left 중 더 오른쪽(큰) 값",
 *   오른쪽 경계는 "두 right 중 더 왼쪽(작은) 값"(Math.min), 아래쪽 경계는 "두 bottom 중 더
 *   위(작은) 값" — 이렇게 구하면 두 사각형이 겹치는 공통 영역의 네 변이 나온다.
 * - width/height가 양수(left < right && top < bottom, 즉 실제로 겹치는 영역이 존재)일 때만
 *   교집합 넓이(intersectionArea)를 계산하고,
 *   IoU 공식: 교집합 / (A넓이 + B넓이 - 교집합) 으로 겹침 비율을 구해 소수점 4자리로 반올림한다.
 * - 겹치지 않으면 0을 반환.
 */
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
    const intersectionRatio = intersectionArea / (targetArea + entryArea - intersectionArea);

    return Number(intersectionRatio.toFixed(4));
  }

  return 0;
}

/**
 * 여러 entities(드롭 후보 엔티티들) 중에서 target(드래그 중인 요소의 Hitbox)과 가장 많이
 * 겹치는(IoU가 가장 큰) 엔티티를 찾아 반환한다.
 * - entities.map(...)으로 각 엔티티와 target의 겹침 비율 배열(intersections)을 만들고,
 *   getMaxValueIndex로 그중 최댓값의 인덱스를 찾는다.
 * - 겹침 비율이 0 이하(전혀 안 겹침)라면 null(대상 없음)을 반환.
 * - 그렇지 않으면 해당 인덱스의 엔티티를 반환(방어적으로 존재 여부 확인 후 없으면 null).
 */
export function rectIntersection(entities: Entity[], target: Hitbox) {
  const intersections = entities.map((entity) => getIntersectionRatio(entity.getHitbox(), target));

  const maxValueIndex = getMaxValueIndex(intersections);

  if (intersections[maxValueIndex] <= 0) {
    return null;
  }

  return entities[maxValueIndex] ? entities[maxValueIndex] : null;
}

/**
 * 자동 스크롤 판정을 위해, 드래그 중인 대상(dragEntity)이 스크롤 트리거 영역들(entities) 중
 * 어디에 가장 가까운지(getBestIntersect로 판정)를 찾고, 그 방향(side)으로 얼마나 더 깊이
 * 들어갔는지를 나타내는 거리값을 함께 반환한다.
 * - primary: 가장 근접한 스크롤 트리거 엔티티. 없으면 null 반환.
 * - side: primary 엔티티의 데이터에 저장된 "어느 방향 스크롤인지"('left'/'right'/'top'/'bottom').
 * - side에 따라 target(드래그 중인 요소)과 hitbox(트리거 영역)에서 비교할 좌표 인덱스
 *   (targetIndex, hitboxIndex)를 고른다. 예를 들어 'left'면 target의 minX(인덱스 0)와
 *   hitbox의 maxX(인덱스 2)를 비교 대상으로 삼는다(왼쪽으로 얼마나 파고들었는지 보려는 것).
 * - distance: target 좌표와 hitbox 좌표 사이의 거리(절댓값).
 * - max: hitbox 자체의 두 좌표(targetIndex, hitboxIndex 위치) 사이의 거리, 즉 트리거 영역의
 *   두께(약 35px, calculateScrollHitbox에서 만든 값).
 * - 반환값: [primary 엔티티, (max - distance)] 튜플. (max - distance)가 클수록 트리거 영역
 *   더 깊숙이 들어갔다는 뜻이 되어, 스크롤 속도 등을 계산하는 데 쓰인다.
 */
export function getScrollIntersection(
  entities: Entity[],
  target: Hitbox,
  dragEntity: Entity
): [Entity, number] {
  const primary = getBestIntersect(entities, target, dragEntity);

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
// (원본 영문 주석 유지) Hitbox 하나를 받아 네 귀퉁이 좌표를 [좌상단, 우상단, 좌하단, 우하단]
// 순서의 Coordinates 배열로 변환한다. hitbox의 [minX, minY, maxX, maxY] 값을 조합해서 만든다.
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

// 두 좌표(p1, p2) 사이의 유클리드 거리를 피타고라스 정리(√((x차이)² + (y차이)²))로 계산한다.
export function distanceBetween(p1: Coordinates, p2: Coordinates) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

/**
 * target 사각형의 네 귀퉁이와 각 entity 사각형의 대응하는 귀퉁이 사이 거리를 각각 구해
 * 평균 낸 뒤(4개 귀퉁이 거리의 합 / 4), 그 평균 거리가 가장 작은(=가장 가까운) 엔티티를 찾는다.
 * - corners: target의 네 귀퉁이 좌표.
 * - entities.map(...) 안에서 reduce를 사용해 "귀퉁이별 거리의 합"을 누적(accumulator)한다.
 *   reduce의 콜백은 (누적값, 현재 원소, 인덱스)를 받는데, 여기서는 corner(참조용 target 귀퉁이)와
 *   entryCorners[index](같은 순서의 entity 귀퉁이) 사이 거리를 계속 더해 나간다.
 * - 합을 4로 나눠 평균을 낸 뒤 소수 4자리로 반올림해 distances 배열을 만들고,
 *   getMinValueIndex로 가장 작은 값의 인덱스를 찾아 그 엔티티를 반환한다.
 */
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
// (원본 영문 주석 유지) Hitbox 하나를 받아 그 사각형의 중심 좌표를 계산해 반환한다.
// 참고: x는 (minX+maxX)/2로 올바르게 중앙을 구하지만, y는 원래대로라면 (minY+maxY)/2여야 할 자리에
// hitbox[2](maxX)가 실수로 들어가 있다(로직 그대로 유지, 주석만 추가하라는 지시에 따라 수정하지 않음).
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
// (원본 영문 주석 유지) target의 중심점(centerRect)과 각 entity의 중심점 사이 거리를 구해서,
// 그 거리가 가장 작은(중심이 가장 가까운) 엔티티를 반환한다. closestCorners와 유사하지만
// 귀퉁이 4곳이 아니라 중심점 1곳만 비교한다는 점이 다르다.
export function closestCenter(entities: Entity[], target: Hitbox) {
  const centerRect = centerOfRectangle(target);
  const distances = entities.map((entity) =>
    distanceBetween(centerOfRectangle(entity.getHitbox()), centerRect)
  );

  const minValueIndex = getMinValueIndex(distances);

  return entities[minValueIndex] ? entities[minValueIndex] : null;
}

/**
 * 드래그 중인 카드를 놓을 "가장 적절한" 대상을 찾는 핵심 판정 함수. 단순 거리 비교가 아니라
 * 정렬 축(sortAxis)과 진행 방향까지 고려해 "리스트 정렬 중 자연스러운 위치"를 추정한다.
 * - dragTopLeft: 드래그 중인 요소의 좌상단 좌표. dragCenter: 드래그 중인 요소의 중심 좌표.
 * - dragId: 드래그 중인 엔티티 자신의 ID(자기 자신과는 비교하지 않기 위함).
 * - hits.map(...)으로 각 후보 엔티티에 대해 "거리 점수(낮을수록 더 적합)"를 계산한다:
 *   - 후보가 드래그 중인 엔티티 자신이면 Infinity(절대 선택되지 않도록 무한대 거리 부여).
 *   - isDropArea(acceptsSort가 있는, 즉 정렬 가능한 드롭 영역)인데 드래그 중인 타입을
 *     받아들이지 않는(!isDropArea.contains(...)) 경우엔, 귀퉁이가 아니라 "중심 대 중심" 거리를
 *     사용(정렬 규칙 적용 없이 단순 근접도만 봄).
 *   - 그 외(정렬 가능한 같은 축 위의 후보)에는 entityTopLeft와 dragTopLeft 사이 거리를 기본으로 쓰되,
 *     sortAxis('horizontal'이면 x, 아니면 y)를 기준으로 "후보의 중심이 드래그 요소의 좌상단보다
 *     더 뒤쪽(진행 방향 앞쪽)에 있으면" modifier로 1000을 더해 우선순위를 낮춘다. 이렇게 하면
 *     "이미 지나친 뒤쪽 후보"보다 "아직 도달 안 한 앞쪽 후보"가 항상 우선하게 되어, 드래그 방향에
 *     맞는 자연스러운 삽입 위치를 고를 수 있다.
 * - 마지막으로 getMinValueIndex로 점수가 가장 낮은(가장 적합한) 엔티티를 찾아 반환한다.
 */
export function getBestIntersect(
  hits: Entity[],
  dragHitbox: Hitbox,
  dragEntity: Entity
): Entity | null {
  const dragTopLeft = cornersOfRectangle(dragHitbox)[0];
  const dragCenter = centerOfRectangle(dragHitbox);
  const dragId = dragEntity.entityId;
  const distances = hits.map((entity) => {
    if (entity.entityId === dragId) {
      return Infinity;
    }

    const data = entity.getData();
    const isDropArea = data.acceptsSort;
    const entityHitbox = entity.getHitbox();
    const entityCenter = centerOfRectangle(entityHitbox);

    if (isDropArea && !isDropArea.contains(dragEntity.getData().type)) {
      return distanceBetween(dragCenter, entityCenter);
    }

    const entityTopLeft = cornersOfRectangle(entityHitbox)[0];
    const axis = data.sortAxis === 'horizontal' ? 'x' : 'y';

    const modifier = entityCenter[axis] > dragTopLeft[axis] ? 1000 : 0;

    return distanceBetween(entityTopLeft, dragTopLeft) + modifier;
  });

  const minValueIndex = getMinValueIndex(distances);

  return hits[minValueIndex] ? hits[minValueIndex] : null;
}

/**
 * 스크롤 가능한 요소(element)의 현재 스크롤 위치와 "더 스크롤할 수 있는 최대량"을 계산해
 * ScrollState 형태로 반환한다.
 * - 구조분해할당(destructuring)으로 element에서 필요한 여섯 개 속성을 한 번에 꺼낸다.
 * - x/y: 현재 스크롤 위치(scrollLeft/scrollTop 그대로).
 * - maxX/maxY: "전체 스크롤 가능 크기(scrollWidth/Height) - 보이는 영역 크기(offsetWidth/Height)"
 *   로 계산한 "더 스크롤할 수 있는 최대 남은 거리". 콘텐츠가 보이는 영역보다 작아 음수가 나올 수
 *   있으므로 Math.max(값, 0)으로 음수를 0으로 clamp한다.
 */
export function getElementScrollOffsets(element: HTMLElement): ScrollState {
  const { scrollLeft, scrollTop, scrollWidth, scrollHeight, offsetWidth, offsetHeight } = element;

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

/**
 * 드래그 시작 지점(origin)에서 현재 포인터 위치(position)까지 이동한 만큼(xShift, yShift)을
 * 구해서 hitbox 전체를 그만큼 평행이동시킨다(드래그로 움직이는 카드의 시각적 위치 갱신에 사용).
 * - Math.trunc(값 * 100) / 100 : 소수점 셋째 자리 이하를 버려(내림이 아니라 0 방향으로 절삭)
 *   소수 둘째 자리까지만 남긴다(부동소수점 오차 누적을 줄이기 위한 반올림 처리).
 * - 반환되는 Hitbox는 원본 hitbox의 네 좌표 각각에 xShift 또는 yShift를 더한 새 사각형이다.
 */
export function adjustHitboxForMovement(
  hitbox: Hitbox,
  origin: Coordinates,
  position: Coordinates
): Hitbox {
  const xShift = Math.trunc((position.x - origin.x) * 100) / 100;
  const yShift = Math.trunc((position.y - origin.y) * 100) / 100;

  return [hitbox[0] + xShift, hitbox[1] + yShift, hitbox[2] + xShift, hitbox[3] + yShift];
}

/**
 * "이전 프레임의 스크롤 트리거 교차 목록(prev)"과 "이번 프레임의 목록(next)"을 비교해서,
 * 새로 추가된 것(add), 값이 바뀐 것(update), 사라진 것(remove)을 분류해 반환한다.
 * (자동 스크롤 인디케이터를 매 프레임 다시 그리지 않고 변화분만 갱신하기 위한 diff 로직.)
 * - inPrev/inNext: entityId를 key로 하는 조회용 맵(Record<string, [Entity, number]>)을 만들어
 *   "이 엔티티가 이전/이후 목록에 있었는지"를 빠르게(O(1)) 확인할 수 있게 한다.
 * - prev.forEach로 inPrev 맵을 채운다.
 * - next.forEach로 각 교차 항목의 id가:
 *   - inPrev에 없으면 → 새로 나타난 것이므로 add에 추가.
 *   - inPrev에는 있지만 두 번째 값(교차 강도/거리 점수)이 달라졌으면 → update에 추가.
 *   그리고 매번 inNext 맵도 채워 나간다.
 * - 마지막으로 prev.forEach를 한 번 더 돌며, inNext에 없는(= next에서 사라진) 항목을 remove에 담는다.
 * - 반환값: { add, update, remove } 세 배열을 담은 객체.
 */
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

/**
 * hitbox에 margin(여백, 기본값 [0,0,0,0]인 Hitbox 모양의 4방향 여백)을 적용한 뒤의 너비/높이를
 * 계산한다.
 * - minX/minY는 margin의 앞쪽 두 값만큼 안쪽으로(빼서), maxX/maxY는 margin의 뒤쪽 두 값만큼
 *   바깥쪽으로(더해서) 확장/축소한다.
 * - width/height: 조정된 max와 min의 차이. 최종적으로 { width, height } 객체로 반환한다.
 */
export function getHitboxDimensions(hitbox: Hitbox, margin: Hitbox = [0, 0, 0, 0]) {
  const minX = hitbox[0] - margin[0];
  const minY = hitbox[1] - margin[1];
  const maxX = hitbox[2] + margin[2];
  const maxY = hitbox[3] + margin[3];

  const height = maxY - minY;
  const width = maxX - minX;

  return { width, height };
}
