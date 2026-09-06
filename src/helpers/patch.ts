/**
 * ============================================================================
 * [실행 순서 #60] src/helpers/patch.ts — 두 Board 객체 간 JSON-patch 스타일 diff(diff) / apply(diffApply)
 * ----------------------------------------------------------------------------
 * 단계: 실행-저장·동기화
 * 마크다운 소스를 다시 파싱해서 새 Board 객체를 만들 때, 예전 Board 객체와 새 Board 객체를 단순히
 * 통째로 교체하면 접힘 상태·아이템 id 등 "파일 내용에는 없지만 메모리에만 있던" UI 상태가 사라진다.
 * 이 문제를 피하기 위해, 이 파일은 두 객체(또는 배열) 사이의 차이를 remove/replace/add 세 종류의
 * 연산(Op) 목록으로 계산하는 diff()와, 그 연산 목록을 어떤 base 객체 위에 적용해 새 객체를 만드는
 * diffApply()를 제공한다. diffApply는 실제로 변경된 경로에 있는 객체/배열만 얕은 복사(shallow copy)하고
 * 나머지 참조는 그대로 재사용하므로, 불필요한 리렌더링을 막는 구조적 공유(structural sharing)가 유지된다.
 * #58 parsers/List.ts가 재파싱 시 기존 상태를 보존하기 위해 이 두 함수를 사용한다.
 * ============================================================================
 */
import { isPlainObject } from 'is-plain-object';
import moment from 'moment';
import { getAPI } from 'obsidian-dataview';

type Key = string | number;
type Diffable = Record<Key, any> | any[];
type OpPath = Array<Key>;

const REMOVE = 'remove';
const REPLACE = 'replace';
const ADD = 'add';

// JSON-patch(RFC 6902)에서 영감을 받은 단순화된 연산 하나를 표현한다.
// path는 obj1(또는 결과 obj)의 루트에서부터 대상 값까지 내려가는 키/인덱스의 배열이다.
export interface Op {
  op: 'remove' | 'replace' | 'add';
  path: OpPath;
  value?: any;
}

// getDiff가 재귀 도중 계속 채워나가는 누적 버킷. remove/replace/add를 종류별로 따로 모아뒀다가
// diff() 마지막에 하나의 배열로 합친다(순서가 중요하므로 뒤에서 설명).
interface Diff {
  remove: Op[];
  replace: Op[];
  add: Op[];
}

// 특정 경로(path)를 diff 대상에서 제외하고 싶을 때 호출자가 넘기는 콜백.
// 예: 재파싱 결과를 비교할 때 특정 필드(예: 자동 생성 id)는 항상 다르므로 비교에서 제외하는 용도로 쓸 수 있다.
type SkipFn = (k: OpPath, val?: any) => boolean;
// 두 값을 "문자열로 변환해서" 비교할 때 쓰는 함수(기본은 String()). 재귀할 수 없는 특수 객체(moment 등)를
// 값 비교하기 위한 최후 수단이다.
type ToStringFn = (val: any) => string;

// 이 값이 "재귀적으로 파고들어 비교할 수 있는" 대상인지 판별한다.
// 일반 객체({} 형태)나 배열은 물론, obsidian-dataview가 다루는 특수 "object" 값(단, moment 날짜 객체는 제외)도
// 다이어프 가능한 것으로 취급한다. 이 판별이 false면 해당 값은 더 이상 쪼개지 않고 통째로 비교/치환 대상이 된다.
function isDiffable(obj: any): obj is Diffable {
  if (!obj) return false;
  if (isPlainObject(obj) || Array.isArray(obj)) return true;

  const dv = getAPI();
  // dataview의 값 시스템에서 "객체로 인식되는" 값이면서 moment 날짜가 아닌 경우도 재귀 대상에 포함
  if (!moment.isMoment(obj) && dv?.value.isObject(obj)) return true;

  return false;
}

// 최상위 진입점: obj1 → obj2로 바꾸기 위한 patch 연산 배열을 계산해서 반환한다.
export function diff(
  obj1: Diffable,
  obj2: Diffable,
  skip: SkipFn = () => false,
  toString: ToStringFn = (val) => String(val)
): Op[] {
  if (!isDiffable(obj1) || !isDiffable(obj2)) {
    throw new Error('both arguments must be objects or arrays');
  }

  // getDiff가 remove/replace/add를 종류별로 채운 Diff 객체를 재귀적으로 만들어낸다
  const diffs: Diff = getDiff(
    obj1,
    obj2,
    [],
    [],
    { remove: [], replace: [], add: [] },
    skip,
    toString
  );

  // reverse removes since we want to maintain indexes
  // (원문 주석) remove 연산은 배열 인덱스가 큰 것부터 적용해야 앞의 인덱스가 밀리지 않는다.
  // getDiff는 낮은 인덱스부터 순서대로 remove를 push하므로, 여기서 배열을 뒤집어 "큰 인덱스 → 작은 인덱스"
  // 순서로 만든 뒤, replace, add 순으로 이어붙여 최종 patch 배열을 완성한다.
  return diffs.remove.reverse().concat(diffs.replace).concat(diffs.add);
}

// obj1과 obj2를 같은 depth에서 비교하는 재귀 함수. 한 번 호출될 때마다 "현재 계층"의 키들만 처리하고,
// 값 자체가 또 diffable 객체라면 pushReplaces를 거쳐 다시 getDiff를 호출하는 방식으로 트리 전체를 순회한다.
function getDiff(
  obj1: Diffable,
  obj2: Diffable,
  basePath: OpPath,
  basePathForRemoves: OpPath,
  diffs: Diff,
  skip: SkipFn,
  toString: ToStringFn
) {
  if (!isDiffable(obj1) || !isDiffable(obj2)) return diffs;

  const obj1Keys = Object.keys(obj1);
  const obj2Keys = Object.keys(obj2);
  const obj2KeysLength = obj2Keys.length;
  // 배열일 때만 의미 있는 값(길이 차이). 일반 객체면 .length가 undefined라 NaN이 되지만,
  // 아래 trimFromRight가 배열이 아닌 경우 이 값을 사용하지 않도록 처리되어 있다.
  const lengthDelta = obj1.length - obj2.length;

  let path: OpPath;

  // trimFromRight: 두 배열의 길이가 다를 때, "줄어든 원소들이 배열의 끝에서 없어졌는지(오른쪽 트림)
  // 아니면 앞에서 없어졌는지(왼쪽 트림)"를 추정하는 휴리스틱. 객체(Object)에 대해서는 항상 true를 반환해
  // 아래 "오른쪽 트림" 분기(=단순 키 비교 분기)를 타게 만든다.
  if (trimFromRight(obj1, obj2)) {
    // [오른쪽에서 사라졌다고 가정하는 경우 / 혹은 obj1·obj2가 배열이 아닌 일반 객체인 경우]
    // obj1에는 있지만 obj2에는 없는 키 → 삭제(remove) 대상
    for (const k of obj1Keys) {
      const key = Array.isArray(obj1) ? Number(k) : k;
      if (!(key in obj2)) {
        path = basePathForRemoves.concat(key);
        if (skip(path)) continue;
        diffs.remove.push({
          op: REMOVE,
          path,
        });
      }
    }

    // obj2의 모든 키에 대해 "새로 추가되었는지 / 값이 바뀌었는지 / 재귀 비교가 필요한지"를 판단
    for (const k of obj2Keys) {
      const key = Array.isArray(obj2) ? Number(k) : k;
      pushReplaces(
        key,
        obj1,
        obj2,
        basePath.concat(key),
        basePath.concat(key),
        diffs,
        skip,
        toString
      );
    }
  } else {
    // trim from left, objects are both arrays
    // [왼쪽(앞부분)에서 사라졌다고 가정하는 경우 — 배열끼리 비교할 때만 여기로 옴]
    // obj1의 앞쪽 lengthDelta개의 원소가 통째로 제거된 것으로 간주하고 그 인덱스들을 remove로 push
    for (let i = 0; i < lengthDelta; i++) {
      path = basePathForRemoves.concat(i);
      if (skip(path)) continue;
      diffs.remove.push({
        op: REMOVE,
        path,
      });
    }

    // now make a copy of obj1 with excess elements left trimmed and see if there any replaces
    // 앞쪽 lengthDelta개를 잘라낸 obj1Trimmed를 obj2와 "같은 시작 인덱스"로 맞춰서 원소별로 비교한다
    const obj1Trimmed = obj1.slice(lengthDelta);
    for (let i = 0; i < obj2KeysLength; i++) {
      pushReplaces(
        i,
        obj1Trimmed,
        obj2,
        basePath.concat(i),
        // since list of removes are reversed before presenting result,
        // we need to ignore existing parent removes when doing nested removes
        // (원문 주석) 최종적으로 remove 배열은 뒤집혀서 적용되므로, obj1Trimmed 기준 인덱스 i를
        // 원본 obj1 기준 인덱스로 되돌리려면 lengthDelta를 더해줘야 한다(앞에서 잘려나간 만큼 보정).
        basePath.concat(i + lengthDelta),
        diffs,
        skip,
        toString
      );
    }
  }

  return diffs;
}

// obj1[key]와 obj2[key] "한 쌍"을 비교해서 add / replace / (재귀적으로 더 깊이 비교) 중 무엇을 할지 결정한다.
// getDiff가 "이번 depth의 각 키"를 순회하며 호출하는 헬퍼로, 재귀의 실질적인 분기점 역할을 한다.
function pushReplaces(
  key: any,
  obj1: Diffable,
  obj2: Diffable,
  path: OpPath,
  pathForRemoves: OpPath,
  diffs: Diff,
  skip: SkipFn,
  toString: ToStringFn
) {
  const obj1AtKey = obj1[key];
  const obj2AtKey = obj2[key];

  // 호출자가 이 경로는 비교하지 말라고 지정했다면(skip) 아무 연산도 만들지 않고 건너뜀
  if (skip(path, obj2AtKey)) return;

  if (!(key in obj1) && key in obj2) {
    // obj1에는 없던 키가 obj2에 새로 생김 → add 연산
    diffs.add.push({ op: ADD, path, value: obj2AtKey });
  } else if (obj1AtKey !== obj2AtKey) {
    // 참조/값이 다를 때만 아래를 검사(동일 참조면 비교할 필요 없이 이 분기 자체에 들어오지 않음)
    if (
      Object(obj1AtKey) !== obj1AtKey ||
      Object(obj2AtKey) !== obj2AtKey ||
      differentTypes(obj1AtKey, obj2AtKey)
    ) {
      // 둘 중 하나라도 원시값(primitive)이거나, 둘 다 객체이지만 내부 타입(Array/Date/Object 등)이 다르면
      // 더 이상 재귀할 수 없으므로 통째로 교체(replace)
      diffs.replace.push({ op: REPLACE, path, value: obj2AtKey });
    } else {
      if (
        !isDiffable(obj1AtKey) &&
        !isDiffable(obj2AtKey) &&
        toString(obj1AtKey) !== toString(obj2AtKey)
      ) {
        // 둘 다 "재귀 불가능한 특수 객체"(예: moment 날짜)이면서 문자열 표현이 다르면 값이 바뀐 것으로 보고 replace
        diffs.replace.push({ op: REPLACE, path, value: obj2AtKey });
      } else {
        // 그 외에는 둘 다 diffable한 객체/배열이므로 한 단계 더 깊이 들어가 재귀적으로 비교
        getDiff(obj1[key], obj2[key], path, pathForRemoves, diffs, skip, toString);
      }
    }
  }
}

// Object.prototype.toString.call()로 얻는 내부 [[Class]] 태그(예: "[object Array]", "[object Date]")를
// 비교해서 두 값의 "진짜 타입"이 다른지 판별한다(예: 배열 vs 일반 객체, Date vs 일반 객체 등).
function differentTypes(a: any, b: any) {
  return Object.prototype.toString.call(a) !== Object.prototype.toString.call(b);
}

// 두 배열의 길이가 다를 때, 늘어나거나 줄어든 원소가 배열의 "오른쪽 끝"에서 발생했다고 볼지
// "왼쪽 끝"에서 발생했다고 볼지를 추정한다. 예를 들어 리스트 맨 앞에 새 항목을 끼워 넣으면 나머지 원소들의
// 인덱스가 전부 하나씩 밀리는데, 이를 "왼쪽에서 트림되었다"고 인식하면 diff 결과가 훨씬 간결해진다.
function trimFromRight(obj1: Record<string, any>, obj2: Record<string, any>) {
  const lengthDelta = obj1.length - obj2.length;

  // 두 값이 모두 배열이고 obj1이 obj2보다 긴 경우에만 실제로 방향을 추정한다
  if (Array.isArray(obj1) && Array.isArray(obj2) && lengthDelta > 0) {
    let leftMatches = 0;
    let rightMatches = 0;
    // obj1과 obj2를 "왼쪽부터" 같은 인덱스로 겹쳐 놓고, 문자열 변환 기준으로 연속으로 일치하는 개수를 센다
    for (let i = 0; i < obj2.length; i++) {
      if (String(obj1[i]) === String(obj2[i])) {
        leftMatches++;
      } else {
        break;
      }
    }

    // 이번엔 "오른쪽(끝)부터" 거꾸로 겹쳐 놓고, obj1의 뒷부분이 lengthDelta만큼 밀려 있다고 가정한 채
    // 연속으로 일치하는 개수를 센다
    for (let j = obj2.length; j > 0; j--) {
      if (String(obj1[j + lengthDelta]) === String(obj2[j])) {
        rightMatches++;
      } else {
        break;
      }
    }

    // bias to trim right becase it requires less index shifting
    // (원문 주석) 왼쪽 정렬이 더 잘 맞거나 동점이면 "오른쪽에서 잘렸다"고 판단(=오른쪽 트림).
    // 오른쪽 트림 쪽이 나중에 인덱스 보정이 덜 필요해 diff가 더 단순해지기 때문에 동점일 때 이쪽을 우선한다.
    return leftMatches >= rightMatches;
  }

  // 배열이 아니거나 길이가 같거나 obj1이 더 짧은 경우는 이 휴리스틱이 필요 없으므로 항상 "오른쪽 트림"으로 처리
  return true;
}

// diff()가 만든 patch(Op[])를 실제 base 객체 obj에 적용해서 "새 객체"를 만들어 반환한다.
// 원본 obj는 변경하지 않고, patch가 실제로 지나가는 경로에 있는 객체/배열만 얕은 복사를 해서
// 불변성(immutability)과 구조적 공유(건드리지 않은 가지는 참조를 그대로 재사용)를 동시에 만족시킨다.
export function diffApply(obj: Diffable, diff: Op[]) {
  if (!isDiffable(obj)) {
    throw new Error('base object must be an object or an array');
  }

  if (!Array.isArray(diff)) {
    throw new Error('diff must be an array');
  }

  // 최상위 레벨만 우선 얕은 복사(이후 각 연산이 지나가는 하위 경로도 필요할 때마다 복사됨)
  if (Array.isArray(obj)) obj = obj.slice();
  else obj = { ...obj };

  for (const thisDiff of diff) {
    const thisOp = thisDiff.op;
    const thisPath = thisDiff.path;
    const pathCopy = thisPath.slice();
    // path의 마지막 한 칸(실제로 값을 쓰거나 지울 key/index)만 따로 떼어낸다
    const lastProp: any = pathCopy.pop();
    let subObject = obj;

    // "__proto__" 등 프로토타입 오염 공격에 쓰이는 키가 path 끝에 있는지 검사
    prototypeCheck(lastProp);
    if (lastProp == null) return false;

    let thisProp: any;
    // pathCopy(마지막 칸을 제외한 나머지 경로)를 앞에서부터 하나씩 소비하며 subObject를 목표 지점의
    // "부모"까지 내려간다. 내려가는 도중 만나는 모든 컨테이너는 원본을 건드리지 않도록 얕은 복사한다.
    while ((thisProp = pathCopy.shift()) !== null) {
      if (thisProp === undefined) break;

      prototypeCheck(thisProp);
      if (!(thisProp in subObject)) {
        // ADD 연산이 아직 존재하지 않는 중첩 경로를 가리킬 수 있으므로, 없으면 빈 객체를 만들어 이어감
        subObject = subObject[thisProp] = {};
      } else if (Array.isArray(subObject[thisProp])) {
        // 배열이면 slice()로 얕은 복사한 새 배열을 만들어 그 안으로 들어감(원본 배열은 불변 유지)
        subObject = subObject[thisProp] = subObject[thisProp].slice();
      } else if (isPlainObject(subObject[thisProp])) {
        // 일반 객체면 스프레드로 얕은 복사한 새 객체를 만들어 그 안으로 들어감
        subObject = subObject[thisProp] = { ...subObject[thisProp] };
      } else {
        // 그 외(재귀 불가능한 특수 값 등)는 복사하지 않고 그대로 참조만 따라 들어감
        subObject = subObject[thisProp];
      }
    }

    if (thisOp === REMOVE || thisOp === REPLACE) {
      const path = thisDiff.path;
      // REMOVE/REPLACE는 "이미 존재하는 값"을 전제로 하므로, 실제로 없으면 diff가 base와 맞지 않는다는 의미
      if (!Object.prototype.hasOwnProperty.call(subObject, lastProp)) {
        throw new Error(['expected to find property', path, 'in object', obj].join(' '));
      }
    }

    if (thisOp === REMOVE && typeof lastProp === 'number') {
      // 배열이면 splice로 해당 인덱스 원소 1개를 제거(뒤 원소들이 당겨짐), 아니면 그냥 delete
      Array.isArray(subObject) ? subObject.splice(lastProp, 1) : delete subObject[lastProp];
    }

    if (thisOp === REPLACE || thisOp === ADD) {
      // REPLACE와 ADD는 동일하게 처리: 해당 key/index에 새 값을 그대로 대입
      subObject[lastProp] = thisDiff.value;
    }
  }

  return obj;
}

// path 세그먼트가 '__proto__' / 'constructor' / 'prototype' 이면 즉시 예외를 던져서
// diff 데이터로 프로토타입 체인을 오염시키는 공격(prototype pollution)을 차단한다.
function prototypeCheck(prop?: string | number) {
  // coercion is intentional to catch prop values like `['__proto__']`
  if (prop === '__proto__' || prop === 'constructor' || prop === 'prototype') {
    throw new Error('setting of prototype values not supported');
  }
}
