/**
 * ============================================================================
 * [실행 순서 #30] data.ts — Board 트리(Path=숫자배열 기반)에 대한 순수 불변 조작 함수 모음
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 실제 데이터 변경은 전부 여기서 일어난다. 이 플러그인이 다루는 보드 데이터(Board → Lane →
 * Item 트리)는 어디에서도 직접 mutate(변경)되지 않고, 오직 이 파일이 제공하는 함수들
 * (getEntityFromPath, insertEntity, removeEntity, moveEntity, updateEntity 등)을 통해서만
 * "새로운 트리를 만들어 반환"하는 방식으로 바뀐다. 즉 원본 root는 절대 건드리지 않고 항상
 * 변경된 복사본을 리턴하는 순수 함수(pure function)들의 모음이다. types.ts의 Path(숫자 배열로
 * 트리 위치를 표현)와 Nestable(트리의 재귀적 노드 타입)을 그대로 사용하며, 실제 array 인덱스
 * 접근/삽입/삭제는 immutability-helper 라이브러리의 update()/Spec 커맨드 객체로 위임한다.
 * DragDropApp.tsx가 드래그 종료 시 moveEntity를 호출해 보드를 갱신하고, boardModifiers.ts가
 * 메뉴/버튼 조작(레인 추가, 아이템 삭제 등)에서 이 함수들을 호출하는 등, 이 파일은 dnd 엔진과
 * 실제 칸반 데이터 양쪽을 잇는 핵심 의존성이다.
 * ============================================================================
 */

// deepmerge: 두 객체를 재귀적으로 병합해 "새 객체"를 만들어주는 라이브러리(원본은 변경 안 함).
import merge from 'deepmerge';
// immutability-helper: `update(원본, spec)` 형태로 호출하면 spec에 적힌 커맨드
// ($push, $splice, $merge, $set 등)를 적용한 "새 객체"를 돌려주는 불변 업데이트 라이브러리.
// Spec<T, C>는 그 spec 객체의 타입(어떤 커맨드를 어떤 모양으로 써야 하는지)을 나타내는 제네릭 타입.
import update, { Spec } from 'immutability-helper';
// 값이 (배열/클래스 인스턴스가 아닌) 순수 객체 리터럴인지 판별하는 유틸.
import { isPlainObject } from 'is-plain-object';

import { Nestable, Path } from '../types';
import { SiblingDirection, getSiblingDirection } from './path';

/**
 * root(트리의 시작점)에서 출발해 path(자식 인덱스 배열)를 따라 내려가며 목표 노드를 찾는다.
 * - 인자: root(현재 위치한 Nestable 노드, 처음 호출 시에는 트리 최상단), path(남은 이동 경로).
 * - 동작: path의 첫 번째 숫자(step)를 꺼내 root.children[step]으로 한 단계 내려가고,
 *   나머지 경로(path.slice(1) — 첫 원소를 제외한 새 배열)를 가지고 자기 자신을 다시 호출한다
 *   (재귀 함수). path가 비어있거나(step === null) 더 이상 내려갈 자식이 없으면 재귀를 멈추고
 *   현재 root를 반환한다.
 * - 반환값: path가 가리키는 위치의 Nestable 노드(레인 또는 아이템 등).
 * 예) path=[1,0]이면 "루트의 children[1]의 children[0]"을 반환한다.
 */
export function getEntityFromPath(root: Nestable, path: Path): Nestable {
  // path가 비어있지 않으면 첫 번째 인덱스를, 비어있으면(기저 조건) null을 step으로 둔다.
  const step = path.length ? path[0] : null;

  if (step !== null && root.children && root.children[step]) {
    // 재귀 호출: 한 단계 내려간 자식을 새 root로, 첫 원소를 뺀 나머지 경로로 계속 탐색.
    return getEntityFromPath(root.children[step], path.slice(1));
  }

  // 더 내려갈 곳이 없으면(경로 소진 또는 해당 인덱스에 자식 없음) 현재 노드를 반환(재귀 종료).
  return root;
}

/**
 * path가 가리키는 "노드 자신"에 mutation(immutability-helper의 Spec 커맨드)을 적용하기 위한
 * 중첩 spec 객체를 만든다.
 * - 인자: path(예: [1, 0]), mutation(마지막 노드에 적용할 커맨드, 예: { data: { $set: ... } }).
 * - 동작: path를 뒤에서부터(i = path.length - 1 → 0) 순회하며, 매 단계마다
 *   `{ children: { [path[i]]: 이전에_만든_것 } }` 형태로 한 겹씩 감싼다. 즉 path=[1,0]이면
 *   먼저 { children: { 0: mutation } }을 만들고, 그 다음 { children: { 1: { children: { 0: mutation } } } }
 *   으로 한 번 더 감싸서, 결국 "루트.children[1].children[0]"에 정확히 mutation이 적용되도록
 *   경로 전체를 spec으로 표현한다. (트리 구조를 그대로 반영하는 중첩 객체를 만드는 것이 핵심.)
 * - 반환값: update(root, 이_반환값) 형태로 호출하면 path 위치의 노드에 mutation이 적용된
 *   새 트리를 얻을 수 있는 Spec<Nestable> 객체.
 */
export function buildUpdateMutation(path: Path, mutation: Spec<Nestable>) {
  let pathedMutation: Spec<Nestable> = mutation;

  // path의 마지막 인덱스부터 첫 인덱스까지 역순으로 순회(for문 감소 루프)하며 한 겹씩 감싼다.
  for (let i = path.length - 1; i >= 0; i--) {
    pathedMutation = {
      children: {
        // 계산된 속성명(computed property name) 문법: path[i] 값을 객체의 키로 사용한다.
        [path[i]]: pathedMutation,
      },
    };
  }

  return pathedMutation;
}

/**
 * buildUpdateMutation과 거의 동일하지만, path가 가리키는 노드 "자신"이 아니라 그 노드의
 * "부모"에 mutation을 적용하기 위한 spec을 만든다.
 * - 차이점: 루프가 `path.length - 2`부터 시작한다(마지막 한 단계를 건너뜀). 즉 path=[1,0]이면
 *   0번째 반복(i=path.length-2=0)에서 바로 { children: { [path[0]]: mutation } }을 만들고 끝난다
 *   — path[1](마지막 인덱스, 즉 목표 노드 자신을 가리키는 부분)은 spec 경로에 포함되지 않는다.
 * - 용도: 배열에 원소를 삽입/삭제/추가하려면 "그 배열을 들고 있는 부모"의 children에
 *   $splice/$push 같은 커맨드를 적용해야 하므로, 삽입/삭제 계열 함수들은 전부 이 함수를 사용한다.
 * - 인자/반환값 의미는 buildUpdateMutation과 동일(단지 한 단계 얕게 감쌀 뿐).
 */
export function buildUpdateParentMutation(path: Path, mutation: Spec<Nestable>) {
  let pathedMutation: Spec<Nestable> = mutation;

  for (let i = path.length - 2; i >= 0; i--) {
    pathedMutation = {
      children: {
        [path[i]]: pathedMutation,
      },
    };
  }

  return pathedMutation;
}

/**
 * path가 가리키는 노드 하나를 부모의 children 배열에서 제거(혹은 다른 노드로 교체)하는
 * spec을 만든다.
 * - 인자: path(제거할 노드의 위치), replacement(선택값 — 있으면 제거 대신 그 자리에 교체).
 * - 동작: `path.last()`(Obsidian이 전역으로 추가한 Array.prototype.last() 확장 메서드로,
 *   배열의 마지막 원소를 반환)로 "부모의 children 중 몇 번째 인덱스인지"를 얻는다.
 *   immutability-helper의 `$splice` 커맨드는 Array.prototype.splice와 같은 인자 형식
 *   `[시작인덱스, 제거할개수, ...삽입할원소]`를 받는데,
 *     - replacement가 있으면 `[path.last(), 1, replacement]` → 1개를 지우고 그 자리에 하나를 끼움(교체).
 *     - replacement가 없으면 `[path.last(), 1]` → 그냥 1개를 삭제.
 *   이 val을 `{ children: { $splice: [val] } }` 형태로 만든 뒤, buildUpdateParentMutation으로
 *   "부모" 경로까지 감싸서 최종 spec을 만든다.
 * - 반환값: update(root, 이 값)으로 호출하면 해당 노드가 제거/교체된 새 트리를 얻는 Spec.
 */
export function buildRemoveMutation(path: Path, replacement?: Nestable) {
  // 삼항 연산자: replacement가 존재하면 교체용 splice 인자, 없으면 순수 삭제용 splice 인자.
  const val: Spec<any, any> = replacement ? [path.last(), 1, replacement] : [path.last(), 1];
  return buildUpdateParentMutation(path, {
    children: {
      $splice: [val],
    },
  });
}

/**
 * destination 경로의 "마지막 인덱스 위치"에 entities 배열의 항목들을 끼워 넣는(insert) spec을 만든다.
 * - 인자: destination(삽입할 위치를 가리키는 Path), entities(끼워 넣을 Nestable 배열),
 *   destinationModifier(기본값 0 — 인덱스를 보정하고 싶을 때 더하는 값. 기본 매개변수 문법).
 * - 동작: `$splice: [[destination.last() + destinationModifier, 0, ...entities]]`
 *   → splice의 "제거할 개수"가 0이므로 삭제 없이 순수 삽입만 수행하고,
 *   전개 연산자(스프레드, `...entities`)로 배열 entities의 각 원소를 splice 인자 배열 안에
 *   낱개로 펼쳐 넣는다(배열 안에 배열을 통째로 넣는 게 아니라 원소들을 나란히 이어붙임).
 * - buildUpdateParentMutation(destination, ...)을 사용하므로, destination의 "부모"의 children
 *   배열에 대해 삽입이 이루어진다(즉 destination 자체가 "부모 경로 + 삽입 위치 인덱스"의 역할).
 * - 반환값: update(root, 이 값) 호출 시 entities가 삽입된 새 트리를 만드는 Spec.
 */
export function buildInsertMutation(
  destination: Path,
  entities: Nestable[],
  destinationModifier: number = 0
) {
  return buildUpdateParentMutation(destination, {
    children: {
      $splice: [[destination.last() + destinationModifier, 0, ...entities]],
    },
  });
}

/**
 * destination이 가리키는 노드의 children 배열 "맨 끝"에 entities를 추가(append)하는 spec을 만든다.
 * - immutability-helper의 `$push` 커맨드는 Array.prototype.push처럼 배열 끝에 원소들을 덧붙인다.
 * - buildInsertMutation과 달리 인덱스 계산이 필요 없으므로(항상 맨 끝에 붙이므로) 더 단순하다.
 * - 여기서는 destination 자체가 "children을 갖고 있는 부모 노드의 경로"이므로
 *   buildUpdateParentMutation이 아니라 buildUpdateParentMutation을 호출해 그 부모의 children에
 *   접근한다(= destination이 가리키는 노드 자신의 children 배열을 갱신).
 */
export function buildAppendMutation(destination: Path, entities: Nestable[]) {
  return buildUpdateParentMutation(destination, {
    children: {
      $push: entities,
    },
  });
}

/**
 * buildAppendMutation과 반대로, destination의 children 배열 "맨 앞"에 entities를 추가(prepend)한다.
 * - `$unshift` 커맨드는 Array.prototype.unshift처럼 배열 맨 앞에 원소들을 끼워 넣는다.
 */
export function buildPrependMutation(destination: Path, entities: Nestable[]) {
  return buildUpdateParentMutation(destination, {
    children: {
      $unshift: entities,
    },
  });
}

/**
 * 트리 안에서 노드를 한 위치(source)에서 다른 위치(destination)로 "이동"시키는 핵심 함수.
 * 드래그앤드롭으로 카드/리스트 순서를 바꿀 때 최종적으로 호출되는 함수다.
 * - 인자:
 *   root: 전체 보드 트리.
 *   source: 이동시킬 노드의 현재 위치.
 *   destination: 이동할 목표 위치.
 *   transform?: source 노드를 이동시키기 전에 변형(예: 다른 타입으로 감싸기)하는 선택적 콜백.
 *               반환값이 Nestable 하나일 수도, Nestable 배열(여러 개로 쪼개기)일 수도 있다.
 *   replace?: source 자리에 (완전히 제거하는 대신) 남겨둘 대체 노드를 만드는 선택적 콜백.
 * - 동작 순서:
 *   1) transform이 있으면 그 결과를, 없으면 원본 그대로를 "이동시킬 entity"로 삼는다.
 *      (삼항 연산자 + optional하게 getEntityFromPath로 source 위치의 노드를 조회)
 *   2) getSiblingDirection(source, destination)으로 두 경로가 "형제(같은 부모)"관계인지,
 *      그렇다면 destination이 source보다 앞(Before)인지 뒤(After)인지를 판정한다.
 *   3) 같은 부모 안에서 뒤쪽(After)으로 옮기는 경우, source를 먼저 제거하면 그 뒤에 있던
 *      모든 형제의 인덱스가 1씩 앞당겨지므로, destinationModifier를 -1로 주어 삽입 위치를
 *      보정한다(그 외의 경우는 0, 보정 불필요).
 *   4) replace 콜백이 있으면 source 자리에 넣을 대체 노드를 만든다(optional chaining `?.`으로
 *      replace가 undefined면 호출을 건너뛰고 undefined가 됨).
 *   5) buildRemoveMutation으로 "source 제거(또는 replacement로 교체)" spec을 만들고,
 *      buildInsertMutation으로 "destination 위치에 entity 삽입" spec을 만든다.
 *      이때 entity가 배열인지 아닌지에 따라 `Array.isArray(entity) ? entity : [entity]`로
 *      항상 배열 형태로 맞춰 삽입한다.
 *   6) 두 spec(제거 spec과 삽입 spec)은 서로 다른 트리 경로를 건드리므로, deepmerge(merge)를
 *      이용해 두 spec 객체를 하나로 합친다. isMergeableObject 옵션으로 "일반 객체이거나
 *      배열이면 병합 대상으로 취급"하도록 지정해, immutability-helper의 커맨드 객체/배열이
 *      올바르게 재귀 병합되게 한다.
 *   7) 합쳐진 mutation을 update(root, mutation)에 적용해 최종적으로 이동이 반영된 새 트리를
 *      반환한다. (원본 root는 변경되지 않는다 — 불변성 유지.)
 * - 반환값: source의 노드가 destination으로 옮겨진 새로운 보드 트리(newBoard).
 */
export function moveEntity(
  root: Nestable,
  source: Path,
  destination: Path,
  transform?: (entity: Nestable) => Nestable | Nestable[],
  replace?: (entity: Nestable) => Nestable
) {
  const entity = transform
    ? transform(getEntityFromPath(root, source))
    : getEntityFromPath(root, source);
  const siblingDirection = getSiblingDirection(source, destination);

  // 같은 부모 안에서 뒤쪽으로 이동하는 경우에만 인덱스를 1 앞당겨 보정(-1), 그 외에는 보정 없음(0).
  const destinationModifier = siblingDirection === SiblingDirection.After ? -1 : 0;

  // optional chaining(`replace?.(...)`): replace가 함수로 주어졌을 때만 호출하고,
  // undefined/null이면 호출 없이 결과도 undefined가 된다.
  const replacement = replace?.(getEntityFromPath(root, source));
  const removeMutation = buildRemoveMutation(source, replacement);
  const insertMutation = buildInsertMutation(
    destination,
    Array.isArray(entity) ? entity : [entity],
    destinationModifier
  );

  // 두 개의 서로 다른 부분(root의 다른 경로)을 건드리는 spec을 하나의 spec으로 깊은 병합한다.
  const mutation = merge<Spec<Nestable>>(removeMutation, insertMutation, {
    isMergeableObject: (val) => {
      return isPlainObject(val) || Array.isArray(val);
    },
  });

  // 병합된 spec을 실제로 root에 적용해 이동이 반영된 새로운 트리를 만든다(불변 업데이트).
  const newBoard = update(root, mutation);

  return newBoard;
}

/**
 * target 위치의 노드 하나를 트리에서 제거(혹은 replacement로 교체)한 새 트리를 반환한다.
 * buildRemoveMutation으로 spec을 만들고 곧바로 update()에 적용하는 얇은 래퍼 함수.
 */
export function removeEntity(root: Nestable, target: Path, replacement?: Nestable) {
  return update(root, buildRemoveMutation(target, replacement));
}

/**
 * destination 위치에 entities를 삽입한 새 트리를 반환한다.
 * buildInsertMutation + update()를 묶은 얇은 래퍼 함수.
 */
export function insertEntity(root: Nestable, destination: Path, entities: Nestable[]) {
  return update(root, buildInsertMutation(destination, entities));
}

/**
 * destination이 가리키는 노드의 children 배열 끝에 entities를 덧붙인 새 트리를 반환한다.
 * buildAppendMutation + update()를 묶은 얇은 래퍼 함수.
 */
export function appendEntities(root: Nestable, destination: Path, entities: Nestable[]) {
  return update(root, buildAppendMutation(destination, entities));
}

/**
 * destination이 가리키는 노드의 children 배열 맨 앞에 entities를 끼워 넣은 새 트리를 반환한다.
 * buildPrependMutation + update()를 묶은 얇은 래퍼 함수.
 */
export function prependEntities(root: Nestable, destination: Path, entities: Nestable[]) {
  return update(root, buildPrependMutation(destination, entities));
}

/**
 * path가 가리키는 노드 자신에 임의의 mutation(예: data 필드 갱신)을 적용한 새 트리를 반환한다.
 * buildUpdateMutation(부모가 아니라 노드 "자신"까지 경로를 감싸는 버전) + update()의 래퍼.
 */
export function updateEntity(root: Nestable, path: Path, mutation: Spec<Nestable>) {
  return update(root, buildUpdateMutation(path, mutation));
}

/**
 * path가 가리키는 노드의 "부모"에 임의의 mutation을 적용한 새 트리를 반환한다.
 * buildUpdateParentMutation + update()의 래퍼. children 배열 자체를 통째로 다루고 싶을 때 사용.
 */
export function updateParentEntity(root: Nestable, path: Path, mutation: Spec<Nestable>) {
  return update(root, buildUpdateParentMutation(path, mutation));
}
