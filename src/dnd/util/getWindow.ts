/**
 * ============================================================================
 * [실행 순서 #12] getWindow.ts — DOM 노드가 속한 실제 Window 객체를 찾는 유틸
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * Obsidian은 노트를 "팝아웃(pop-out)" 창으로 별도의 OS 창에 띄울 수 있는데, 이때 팝아웃 창은
 * 메인 앱과는 다른 별개의 `window`/`document` 객체를 가집니다. 만약 코드가 무조건 전역
 * `window`(메인 창)만 참조한다면, 팝아웃 창 안에서 드래그앤드롭을 할 때 마우스 이벤트 좌표나
 * requestAnimationFrame 같은 API가 엉뚱한 창을 기준으로 동작하는 버그가 생깁니다.
 * 이 파일은 그런 문제를 막기 위해, 특정 DOM 요소(Element)가 실제로 속해 있는 Window/Document를
 * 그 요소로부터 직접 알아내는 아주 작은 헬퍼 두 개를 제공합니다. dnd 엔진의 다른 파일들은
 * `window`를 직접 쓰는 대신 이 함수들을 통해 "지금 이 엔티티가 속한 창"을 구해서 사용합니다.
 * ============================================================================
 */

// 인자로 받은 DOM 요소(el)가 속한 Window 객체를 반환한다.
// el.win 은 Obsidian이 각 Element에 추가로 붙여주는 확장 속성으로,
// 이 요소가 렌더링된 (메인 창일 수도, 팝아웃 창일 수도 있는) 실제 Window를 가리킨다.
export function getParentWindow(el: Element) {
  return el.win;
}

// 인자로 받은 DOM 요소(el)가 속한 Document의 <body> 엘리먼트를 반환한다.
// el.doc 역시 Obsidian이 확장한 속성으로, el이 속한 Document 객체를 가리킨다.
// 즉 "이 요소가 어느 창의 document.body에 붙어 있는지"를 알려준다.
export function getParentBodyElement(el: Element) {
  return el.doc.body;
}
