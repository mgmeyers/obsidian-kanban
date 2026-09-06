/**
 * ============================================================================
 * [실행 순서 #53] ast.ts — mdast AST 노드 순회를 돕는 보조 유틸
 * ----------------------------------------------------------------------------
 * 단계: 실행-파싱
 * 이 파일은 markdown을 파싱해서 얻은 mdast(Markdown AST) 트리를 다룰 때 반복적으로
 * 필요한 "형제 노드 찾기", "특정 타입의 다음 노드 찾기", "노드가 원본 markdown 문자열
 * 안에서 차지하는 범위(offset) 계산하기" 같은 저수준 헬퍼 함수들을 모아둔 곳입니다.
 * 런타임 로직(즉 실제 상태를 바꾸는 코드)은 없고, 순수 함수(입력이 같으면 항상 같은
 * 출력을 내는 함수)들로만 구성되어 있습니다. #57(formats/list.ts)의
 * astToUnhydratedBoard(), listItemToItemData() 등이 mdast 트리를 순회하며 칸반 보드
 * 데이터(레인/아이템)를 뽑아낼 때 이 파일의 함수들을 가져다 씁니다. 즉 이 파일은 파서의
 * "부품 상자" 역할을 하는 유틸리티 모듈입니다.
 * ============================================================================
 */

// mdast(Markdown Abstract Syntax Tree) 타입 정의를 가져온다.
// Content: 문단(paragraph), 리스트(list), 제목(heading) 등 AST의 "자식이 될 수 있는" 모든 노드 타입의 유니언.
// Parent: children 배열을 가지는(즉 자식 노드를 품을 수 있는) 노드의 공통 인터페이스.
import { Content, Parent } from 'mdast';

// 원본 markdown 문자열 안에서 "콘텐츠가 시작하는 문자 위치(start)"와 "끝나는 위치(end)"를
// 나타내는 인터페이스. mdast 파서(remark 계열)는 각 노드에 position 정보(줄/컬럼/오프셋)를
// 함께 주는데, 여기서는 그중 문자 오프셋(offset)만 뽑아서 "문자열을 그대로 잘라낼 수 있는
// 범위"로 재포장한다.
export interface ContentBoundary {
  start: number;
  end: number;
}

// 어떤 Parent 노드(예: 리스트 아이템, 제목)의 "실제 콘텐츠"가 원본 markdown 문자열에서
// 어느 범위(start~end 오프셋)를 차지하는지 계산한다.
// 기본 아이디어: 첫 번째 자식 노드의 시작 위치 ~ 마지막 자식 노드의 끝 위치.
export function getNodeContentBoundary(node: Parent): ContentBoundary {
  // 자식이 하나도 없으면(빈 노드) 범위를 계산할 수 없으므로 null 반환.
  if (node.children.length === 0) return null;
  // 마지막 자식의 인덱스를 미리 구해둔다.
  const last = node.children.length - 1;

  // 마지막 자식이 'blockid' 타입인 경우를 특별 처리한다.
  // 'blockid'는 Obsidian의 블록 참조 문법(예: 줄 끝의 "^abc123")을 나타내는, 이 플러그인이
  // 확장해 둔 커스텀 mdast 노드 타입이다(표준 mdast에는 없으므로 as any로 캐스팅해서 검사).
  // 블록 ID는 "콘텐츠"가 아니라 메타데이터이므로, 콘텐츠 범위 계산에서 제외하려는 의도다.
  if ((node.children[last] as any).type === 'blockid') {
    // 자식이 blockid 하나뿐이라면(즉 실제 콘텐츠 없이 블록 ID만 있는 경우) 콘텐츠가
    // 텍스트 자체는 없으므로, 시작 위치를 시작이자 끝으로 하는 "길이 0" 범위를 반환한다.
    if (last === 0) {
      return {
        start: node.children[0].position.start.offset,
        end: node.children[0].position.start.offset,
      };
    }

    // blockid를 제외한, 그 앞(last - 1)까지의 마지막 콘텐츠 노드를 기준으로 끝 위치를 잡는다.
    return {
      start: node.children[0].position.start.offset,
      end: node.children[last - 1].position.end.offset,
    };
  }

  // 일반적인 경우: 첫 자식의 시작 오프셋부터 마지막 자식의 끝 오프셋까지가 콘텐츠 범위다.
  return {
    start: node.children[0].position.start.offset,
    end: node.children[last].position.end.offset,
  };
}

// 위에서 계산한 ContentBoundary(문자 오프셋 범위)를 이용해 원본 markdown 문자열(md)에서
// 실제 부분 문자열을 잘라(slice) 반환한다. boundary가 null이면(콘텐츠 없음) 빈 문자열.
export function getStringFromBoundary(md: string, boundary: ContentBoundary) {
  if (!boundary) return '';

  return md.slice(boundary.start, boundary.end);
}

// children 배열에서 currentIndex 바로 "이전" 형제 노드를 반환한다.
// currentIndex가 0이하(첫 번째이거나 그보다 앞)면 이전 형제가 없으므로 null.
export function getPrevSibling(children: Content[], currentIndex: number) {
  if (currentIndex <= 0) return null;
  return children[currentIndex - 1];
}

// children 배열에서 currentIndex 바로 "다음" 형제 노드를 반환한다.
// currentIndex가 배열의 마지막 인덱스라면 다음 형제가 없으므로 null.
export function getNextSibling(children: Content[], currentIndex: number) {
  if (currentIndex === children.length - 1) return null;
  return children[currentIndex + 1];
}

// currentIndex 다음부터 children을 순서대로 훑으며, type과 일치하는 첫 번째 노드를 찾아 반환한다.
// shouldContinue는 "이 노드를 지나쳐서 계속 찾아도 되는가?"를 판단하는 콜백으로,
// 기본값은 항상 true(끝까지 계속 찾기)를 반환하는 화살표 함수다.
// 제네릭을 쓰지 않는 대신, TS의 "매개변수 기본값(default parameter)" 문법으로
// shouldContinue 인자를 생략하면 자동으로 `() => true`가 대입되게 했다.
export function getNextOfType(
  children: Content[],
  currentIndex: number,
  type: string,
  shouldContinue: (child: Content) => boolean = () => true
) {
  // currentIndex + 1부터 배열 끝까지 순회.
  for (let i = currentIndex + 1, len = children.length; i < len; i++) {
    const child = children[i];

    // 원하는 타입을 찾았으면 즉시 반환(더 이상 순회하지 않음).
    if (type === child.type) {
      return child;
    }

    // shouldContinue(child)가 false를 반환하면, 아직 원하는 타입을 못 찾았더라도
    // 탐색을 중단하고 null을 반환한다(예: 다른 heading을 만나면 더 찾을 필요가 없는 경우 등).
    if (!shouldContinue(child)) {
      return null;
    }
  }

  // 끝까지 순회했지만 못 찾은 경우.
  return null;
}
