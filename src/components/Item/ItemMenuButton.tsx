/**
 * ============================================================================
 * [실행 순서 #74] src/components/Item/ItemMenuButton.tsx — 카드 "..." 메뉴 버튼 트리거 컴포넌트
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 카드 오른쪽 아래(또는 우측)에 표시되는 작은 아이콘 버튼입니다. 카드가 편집 중이 아닐
 * 때는 "더보기(⋮)" 아이콘을 보여주고 클릭하면 부모로부터 전달받은 showMenu 콜백을
 * 실행해 #73 ItemMenu.ts에서 만든 Obsidian Menu(우클릭 메뉴와 동일한 메뉴)를 연다.
 * 반대로 카드가 편집 중일 때는 같은 자리에 "취소(X)" 아이콘이 나타나 편집을 취소할 수
 * 있게 해준다. 이 컴포넌트 자체는 메뉴의 내용을 전혀 알지 못하며, 단순히 "언제 보여줄
 * 아이콘을 바꿀지"와 "클릭 시 무엇을 호출할지"만 담당하는 얇은 프레젠테이션 컴포넌트다.
 * ============================================================================
 */
import Preact from 'preact/compat';
import { Dispatch, StateUpdater } from 'preact/hooks';
import { t } from 'src/lang/helpers';

import { Icon } from '../Icon/Icon';
import { c } from '../helpers';
import { EditState, EditingState, isEditing } from '../types';

// 이 컴포넌트가 받는 props 타입
interface ItemMenuButtonProps {
  editState: EditState; // 현재 이 카드가 편집 중인지, 아니면 어떤 편집 상태인지를 나타내는 값
  setEditState: Dispatch<StateUpdater<EditState>>; // 편집 상태를 변경하는 setState 함수(취소 버튼에서 사용)
  showMenu: (e: MouseEvent, internalLinkPath?: string) => void; // #73의 useItemMenu가 반환한, 클릭 시 Menu를 여는 핸들러
}

// Preact.memo로 감싸 props가 동일하면 리렌더링을 생략한다(카드가 많은 보드에서의 성능 최적화).
export const ItemMenuButton = Preact.memo(function ItemMenuButton({
  editState,
  setEditState,
  showMenu,
}: ItemMenuButtonProps) {
  // 카드가 편집 중일 때는 data-ignore-drag 속성을 추가해 드래그 앤 드롭 시스템이
  // 이 버튼을 드래그 핸들로 오인하지 않도록 한다. useMemo로 editState가 바뀔 때만
  // 새 객체를 만들어 불필요한 리렌더를 방지한다.
  const ignoreAttr = Preact.useMemo(() => {
    if (editState) {
      return {
        'data-ignore-drag': true,
      };
    }

    return {};
  }, [editState]);

  return (
    <div {...ignoreAttr} className={c('item-postfix-button-wrapper')}>
      {/* isEditing(editState): 현재 편집 상태인지 판별하는 타입 가드 함수.
          편집 중이면 "취소(X)" 아이콘을, 아니면 "더보기(⋮)" 아이콘을 렌더링한다. */}
      {isEditing(editState) ? (
        <a
          data-ignore-drag={true}
          // 포인터 다운 시 기본 동작(포커스 이동 등)을 막아 편집 중인 textarea의
          // 포커스/선택 영역이 깨지지 않도록 한다.
          onPointerDown={(e) => e.preventDefault()}
          // 클릭하면 편집 상태를 취소값(EditingState.cancel)으로 바꿔 편집을 중단시킨다.
          onClick={() => setEditState(EditingState.cancel)}
          className={`${c('item-postfix-button')} is-enabled clickable-icon`}
          aria-label={t('Cancel')}
        >
          <Icon name="lucide-x" />
        </a>
      ) : (
        <a
          data-ignore-drag={true}
          onPointerDown={(e) => e.preventDefault()}
          // 클릭하면 부모(Item 컴포넌트)로부터 전달받은 showMenu를 호출해
          // #73 ItemMenu.ts가 만든 Obsidian Menu를 클릭 좌표 위치에 띄운다.
          onClick={showMenu as any}
          className={`${c('item-postfix-button')} clickable-icon`}
          aria-label={t('More options')}
        >
          <Icon name="lucide-more-vertical" />
        </a>
      )}
    </div>
  );
});
