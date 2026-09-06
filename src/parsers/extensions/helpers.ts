/**
 * ============================================================================
 * [실행 순서 #46] src/parsers/extensions/helpers.ts — micromark 확장들이 공유하는 작은 공용 헬퍼
 * ----------------------------------------------------------------------------
 * 단계: 실행-파싱
 * 이 플러그인은 칸반 보드 전용 문법(날짜/시간 트리거, #태그, ^블록id, GFM 체크박스 등)을
 * 표준 마크다운만으로는 표현할 수 없기 때문에, "micromark"라는 저수준 마크다운
 * 토크나이저(tokenizer, 입력 문자열을 한 글자씩 읽어 토큰으로 잘게 쪼개는 상태 기계
 * state machine)에 커스텀 확장을 추가해서 사용합니다. micromark 확장은 보통 두 부분으로
 * 구성됩니다.
 *   (1) micromark "Extension"(tokenizer) — 문자 코드(character code) 단위로 입력을
 *       스캔하면서 effects.enter(토큰 시작 표시) / effects.consume(문자 소비) /
 *       effects.exit(토큰 종료 표시)를 호출해 "여기서부터 여기까지가 하나의 토큰이다"라는
 *       정보를 기록하는 함수. 인식에 성공하면 ok, 실패하면 nok(다른 문법에게 이 구간을
 *       양보)를 호출합니다.
 *   (2) mdast-util-from-markdown "FromMarkdownExtension" — 위에서 만들어진 토큰들을
 *       실제 mdast(마크다운 추상 구문 트리, Abstract Syntax Tree) 노드로 바꾸는
 *       enter/exit 콜백 모음.
 * 이 파일(helpers.ts)은 그중 (2)번, mdast 변환 단계에서 여러 확장이 공통으로 사용하는
 * 아주 작은 유틸리티 함수 하나만 담고 있습니다. 뒤이어 나오는 확장 파일들(#48~#52)은
 * 위에서 설명한 tokenizer / FromMarkdownExtension 구조를 그대로 따르므로, 이 배너의
 * 설명을 계속 참조하게 됩니다.
 * ============================================================================
 */
import { CompileContext } from 'mdast-util-from-markdown';

/**
 * mdast-util-from-markdown이 마크다운을 파싱하는 동안 내부적으로 유지하는 "스택
 * (stack)" 배열에서 가장 마지막(맨 위)에 쌓인 노드, 즉 "지금 막 enter되어 아직
 * exit되지 않은, 가장 안쪽의 현재 mdast 노드"를 꺼내오는 헬퍼 함수입니다.
 *
 * from-markdown은 어떤 노드에 enter(노드)를 호출할 때마다 그 노드를 stack에
 * push하고, exit()을 호출할 때 그 노드를 pop합니다. 따라서 "지금 작업 중인(아직 닫히지
 * 않은) 가장 안쪽 노드"를 얻으려면 배열의 마지막 원소(stack[stack.length - 1])를
 * 보면 됩니다. 예를 들어 커스텀 확장의 exit 핸들러 안에서 "방금 전 enter로 만들어
 * 둔 나 자신의 노드"에 값을 채워 넣고 싶을 때 이 함수를 사용합니다
 * (tag.ts, blockid.ts, genericWrapped.ts에서 실제로 이렇게 사용됨).
 *
 * @param stack CompileContext(변환 진행 중 상태를 담는 객체)가 들고 있는 노드 스택
 * @returns 스택의 맨 위, 즉 가장 최근에 enter되어 아직 exit되지 않은 mdast 노드
 */
export function getSelf(stack: CompileContext['stack']) {
  // 배열의 마지막 인덱스(length - 1)에 있는 노드를 반환 = "현재 컨텍스트에서 나 자신"에 해당하는 노드
  return stack[stack.length - 1];
}
