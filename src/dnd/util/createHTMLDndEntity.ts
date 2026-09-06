/**
 * ============================================================================
 * [실행 순서 #33] createHTMLDndEntity.ts — HTML5 네이티브 드래그 엔티티 생성
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 이 플러그인의 dnd 엔진은 원래 마우스/터치 이벤트를 직접 다루는 "자체 구현" 드래그 시스템이지만,
 * 사용자가 다른 앱이나 다른 Obsidian 창(팝아웃 창 등)에서 텍스트를 이 칸반 보드 위로 드래그해
 * 놓는(HTML5 네이티브 드래그 앤 드롭, 즉 브라우저가 자체적으로 처리하는 dragstart/drop 이벤트)
 * 경우도 지원해야 한다. 그런데 dnd 엔진 내부의 여러 계산(hitbox, 충돌 판정 등)은 전부
 * types.ts의 Entity 인터페이스를 구현한 객체를 전제로 동작한다. 이 파일은 "실제로는 자체 dnd
 * 엔진이 추적하는 진짜 엔티티가 아니지만, 마치 Entity인 것처럼" 흉내 낼 수 있는 가짜(mock)
 * Entity 객체를 만들어주는 역할을 한다. 그 덕분에 외부에서 드롭된 텍스트도 기존 dnd 로직
 * (충돌 판정 등)을 그대로 재사용해 "어느 위치에 드롭되었는지"를 계산할 수 있다.
 * ============================================================================
 */

// 어디서나 겹치지 않는 고유 ID 문자열을 생성해주는 헬퍼(카드/레인 ID 생성 등에도 쓰인다).
import { generateInstanceId } from 'src/components/helpers';
// 이 플러그인이 다루는 콘텐츠 종류(레인/아이템 등)를 나타내는 열거형 성격의 상수 모음.
import { DataTypes } from 'src/components/types';

import { Entity, initialScrollShift, initialScrollState } from '../types';

/**
 * 외부(다른 앱이나 다른 창)에서 드래그해 온 텍스트를 이 보드 위에 놓았을 때, dnd 엔진이
 * 이해할 수 있는 가짜 Entity 객체를 즉석에서 만들어 반환한다.
 * - 인자:
 *   x, y: 드롭(또는 드래그 중) 시점의 마우스 좌표. 이 좌표를 중심으로 가상의 히트박스를 만든다.
 *   content: 드래그되어 들어온 텍스트 내용(줄 단위 등 문자열 배열로 가정).
 *   viewId: 이 드롭 이벤트가 발생한 칸반 보드 뷰의 ID.
 *   win: 이 드롭이 일어난 Window(팝아웃 창 지원을 위해 어느 창인지 함께 기록).
 * - scopeId: 'htmldnd'라는 고정 문자열로, 이 엔티티가 "일반 카드/레인 드래그"가 아니라
 *   "HTML 네이티브 드래그로부터 온 것"임을 구분하는 용도로 쓰인다.
 * - id: generateInstanceId()로 새로 발급한 이 엔티티만의 고유 ID.
 * - minX/maxX/minY/maxY: 마우스 좌표 (x, y)를 중심으로 좌우 75px, 상하 25px 되는 가상의
 *   사각형(150x50 크기)을 만든다. 실제 DOM 요소 크기를 잴 수 없으므로 적당한 고정 크기로
 *   "드래그 중인 커서 주변 영역"을 흉내 낸 것이다.
 * - 반환값: types.ts의 Entity 인터페이스를 만족하는 객체 리터럴. 각 메서드는 실제 엔티티처럼
 *   동작하되, 트리 안에 실제로 속하지 않으므로 대부분 "고정값/빈 값"을 반환한다:
 *   getParentScrollState/getParentScrollShift → 스크롤 없음을 뜻하는 초기값 그대로 반환.
 *   recalcInitial() → 재계산할 것이 없으므로 아무 것도 하지 않음(빈 함수).
 *   getHitbox() → 위에서 계산해 initial에 저장해 둔 고정 사각형을 그대로 반환.
 *   getPath() → 실제 보드 트리에 속한 노드가 아니므로 빈 배열(어디에도 속하지 않음을 의미).
 *   getData() → 드래그 중인 텍스트(content)와 뷰 정보, 소속 창(win) 등을 담아 반환.
 */
export function createHTMLDndEntity(
  x: number,
  y: number,
  content: string[],
  viewId: string,
  win: Window
): Entity {
  const scopeId = 'htmldnd';
  const id = generateInstanceId();

  const minX = x - 75;
  const maxX = x + 75;
  const minY = y - 25;
  const maxY = y + 25;

  return {
    scopeId: scopeId,
    entityId: `${scopeId}-${id}`,
    initial: [minX, minY, maxX, maxY],
    getParentScrollState() {
      return initialScrollState;
    },
    getParentScrollShift() {
      return initialScrollShift;
    },
    recalcInitial() {},
    getHitbox() {
      return this.initial;
    },
    getPath() {
      return [];
    },
    getData() {
      return {
        viewId,
        type: DataTypes.Item,
        id,
        content,
        accepts: [],
        win,
      };
    },
  };
}
