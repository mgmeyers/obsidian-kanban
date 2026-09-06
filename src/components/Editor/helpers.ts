/**
 * ============================================================================
 * [실행 순서 #88] src/components/Editor/helpers.ts — Editor 디렉토리 공용 소소한 헬퍼
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * #11(suggest.ts), #84(MarkdownEditor.tsx), #85(dateWidget.ts), #86(datepicker.ts) 등
 * Editor 폴더의 다른 파일들이 공통으로 참조할 만한 작은 유틸리티 함수를 모아두는 파일이다.
 * 현재는 카드/항목을 드래그해서 에디터 영역에 드롭했을 때, 브라우저의 DataTransfer 정보와
 * Obsidian의 드래그 매니저 상태를 보고 어떤 드롭 동작('copy' 또는 'link')을 적용할지
 * 판별하는 getDropAction 함수 하나만 존재한다.
 * ============================================================================
 */
import { StateManager } from 'src/StateManager';

// 드롭(drop) 이벤트가 발생했을 때, 드래그되어 온 데이터의 종류에 따라 어떤 방식으로
// 처리할지 결정하는 함수. 반환값이 없으면(undefined) 호출부에서 "인식하지 못한 타입"으로
// 간주해 기본 동작(혹은 무시)을 하게 된다.
export function getDropAction(stateManager: StateManager, transfer: DataTransfer) {
  // Return a 'copy' or 'link' action according to the content types, or undefined if no recognized type
  // 브라우저 표준 드래그 데이터 중 'text/uri-list'(URL 목록)가 있으면 링크로 처리한다.
  if (transfer.types.includes('text/uri-list')) return 'link';
  // Obsidian 내부적으로 파일/폴더/노트 링크 등을 드래그할 때 쓰는 비공개 API인
  // app.dragManager.draggable.type을 확인해서, 파일류(file/files/link/folder)라면
  // 역시 링크로 취급한다(예: 파일 탐색기에서 노트를 드래그해 카드 본문에 놓으면 링크로 삽입).
  if (
    ['file', 'files', 'link', 'folder'].includes(
      (stateManager.app as any).dragManager.draggable?.type
    )
  )
    return 'link';
  // 순수 텍스트나 HTML 조각을 드래그해온 경우(예: 다른 곳에서 복사한 텍스트)에는 그 내용을
  // 그대로 복사해 넣는 'copy' 동작으로 처리한다.
  if (transfer.types.includes('text/html') || transfer.types.includes('text/plain')) return 'copy';
}
