/**
 * ============================================================================
 * [실행 순서 #34] path.ts — Path(숫자 배열) 비교/조작 유틸
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * types.ts에서 정의한 Path(트리 안 위치를 나타내는 숫자 배열)는 그 자체로는 "어디를 가리키는지"만
 * 알려줄 뿐, 두 Path가 서로 어떤 관계인지(형제인지, 바로 다음 형제인지, 완전히 같은 위치인지)는
 * 알려주지 않는다. 이 파일은 그런 "두 Path 사이의 관계"를 판정하는 순수 함수들을 모아 놓았다.
 * data.ts의 moveEntity가 "드래그로 옮기려는 위치가 원래 있던 위치의 형제 중 앞인지 뒤인지"를
 * 판단할 때(getSiblingDirection) 바로 이 파일의 함수를 사용해 인덱스 보정 여부를 결정한다.
 * ============================================================================
 */

import { Path } from '../types';

/**
 * sib(비교 대상 Path)가 source(기준 Path)의 "바로 다음 형제"인지 판정한다.
 * - 먼저 두 Path의 길이(깊이)가 다르면 애초에 형제일 수 없으므로 false.
 * - Array.prototype.every로 source의 각 인덱스(step)를 순회하며 확인한다. every의 콜백은
 *   (원소, 인덱스, 배열 자신)을 받는데, 여기서는 배열 자신(arr)의 길이로 "마지막 인덱스인지"를
 *   판단한다.
 *   - 마지막 인덱스(i === arr.length - 1, 즉 두 Path가 갈라지는 마지막 단계)에서는
 *     "step이 sib의 그 자리 값보다 정확히 1 작은지"(step === sib[i] - 1)를 확인한다.
 *     예: source=[0,2], sib=[0,3] → 마지막 자리에서 2 === 3-1 → true(바로 다음 형제).
 *   - 그 이전 단계들은 두 Path가 같은 조상 경로를 공유해야 하므로 완전히 같은 값(step === sib[i])
 *     이어야 한다.
 * - every는 모든 원소에 대해 콜백이 true를 반환해야 최종적으로 true가 되는 배열 메서드이므로,
 *   "마지막 단계 전까지는 경로가 동일하고, 마지막 단계에서만 sib이 source보다 1 크다"는 조건을
 *   한 번의 순회로 검사하는 셈이다.
 */
export function isNextSibling(source: Path, sib: Path): boolean {
  if (source.length !== sib.length) {
    return false;
  }

  return source.every((step, i, arr) => {
    if (i === arr.length - 1) {
      return step === sib[i] - 1;
    }

    return step === sib[i];
  });
}

/**
 * source와 sib가 "같은 부모를 공유하는 서로 다른 형제"인지 판정한다(바로 다음일 필요는 없음,
 * 순서 상관없이 그냥 형제 관계이기만 하면 됨).
 * - 길이가 다르면 형제가 될 수 없으므로 false.
 * - every로 순회하되:
 *   - 마지막 단계에서는 "서로 달라야"(step !== sib[i]) 형제(같은 부모의 서로 다른 자식)로 인정한다
 *     (완전히 같은 값이면 그건 같은 노드 자신이지 형제가 아니므로 isSamePath와 구분된다).
 *   - 그 이전 단계들은 isNextSibling과 마찬가지로 조상 경로가 완전히 같아야 한다(step === sib[i]).
 */
export function areSiblings(source: Path, sib: Path): boolean {
  if (source.length !== sib.length) {
    return false;
  }

  return source.every((step, i, arr) => {
    if (i === arr.length - 1) {
      return step !== sib[i];
    }

    return step === sib[i];
  });
}

/**
 * source와 sib가 완전히 동일한 위치(Path)를 가리키는지 판정한다.
 * - 길이가 같고(source.length === sib.length), 모든 인덱스에서 두 값이 같아야(every) 참이 된다.
 * - `&&`는 단축 평가(short-circuit)되므로 길이가 다르면 every 호출 자체를 하지 않는다.
 */
export function isSamePath(source: Path, sib: Path): boolean {
  return source.length === sib.length && source.every((step, i) => step === sib[i]);
}

// 두 Path 사이의 관계를 나타내는 열거형(enum). TypeScript의 숫자 enum으로, 각 값은
// 0(Before), 1(After), 2(Self), 3(NotSiblings) 순서로 자동 부여된다.
export enum SiblingDirection {
  Before,
  After,
  Self,
  NotSiblings,
}

/**
 * source를 기준으로 sib가 어떤 관계에 있는지(자기 자신인지 / 형제가 아닌지 / 형제라면 앞인지
 * 뒤인지)를 판정해 SiblingDirection 값으로 반환한다. data.ts의 moveEntity가 이 함수의 결과로
 * "이동 시 인덱스를 보정해야 하는지"를 결정한다.
 * - 먼저 isSamePath로 완전히 같은 위치인지 확인 → 같으면 SiblingDirection.Self.
 * - areSiblings로 형제 관계인지 확인 → 형제가 아니면 SiblingDirection.NotSiblings.
 * - 형제라면, 마지막 인덱스(lastIndex = source.length - 1)에서의 값만 비교하면 된다(그 앞
 *   단계는 areSiblings에서 이미 동일함이 보장됨). source의 마지막 인덱스가 sib보다 작으면
 *   sib가 source보다 뒤에 있다는 뜻이므로 SiblingDirection.After, 그렇지 않으면(더 크면)
 *   SiblingDirection.Before를 반환한다.
 */
export function getSiblingDirection(source: Path, sib: Path): SiblingDirection {
  if (isSamePath(source, sib)) {
    return SiblingDirection.Self;
  }

  if (!areSiblings(source, sib)) {
    return SiblingDirection.NotSiblings;
  }

  const lastIndex = source.length - 1;

  if (source[lastIndex] < sib[lastIndex]) {
    return SiblingDirection.After;
  }

  return SiblingDirection.Before;
}
