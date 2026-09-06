/**
 * ============================================================================
 * [실행 순서 #72] src/components/Item/ItemCheckbox.tsx — 카드의 완료 체크박스 토글 컴포넌트
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 칸반 카드 왼쪽에 표시되는 체크박스(또는 Ctrl/Cmd 호버 시 나타나는 "아카이브" 버튼)를
 * 렌더링하는 Preact 컴포넌트입니다. 사용자가 체크박스를 클릭하면 먼저 Obsidian Tasks
 * 플러그인이 설치돼 있는지 확인해 설치돼 있다면 그 플러그인의 규칙(반복 작업 생성,
 * 완료일 삽입 등)에 맞춰 카드 텍스트 자체를 재작성하고, 없다면 단순히 체크 문자만
 * 토글합니다. 즉 이 컴포넌트는 "완료 상태"라는 하나의 상태가 실제로는 카드의 원본
 * 마크다운 텍스트(titleRaw)를 다시 쓰는 방식으로 구현된다는 것을 보여주는 예시입니다.
 * 상태 변경은 항상 boardModifiers를 통해 이루어지며, 이 컴포넌트는 로컬 UI 상태(호버
 * 여부)만 useState로 직접 관리합니다.
 * ============================================================================
 */
import update from 'immutability-helper';
import { memo, useCallback, useEffect, useState } from 'preact/compat';
import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import { getTaskStatusDone, toggleTask } from 'src/parsers/helpers/inlineMetadata';

import { BoardModifiers } from '../../helpers/boardModifiers';
import { Icon } from '../Icon/Icon';
import { c } from '../helpers';
import { Item } from '../types';

// 이 컴포넌트가 받는 props 타입 정의
interface ItemCheckboxProps {
  path: Path; // 보드 트리 안에서 이 카드(아이템)의 위치를 가리키는 경로([레인 인덱스, 아이템 인덱스, ...])
  item: Item; // 카드 자체의 데이터(제목 원문, 체크 문자, 메타데이터 등)
  shouldMarkItemsComplete: boolean; // 레인 설정에 따라 "이 레인의 카드는 완료로 표시한다"가 켜져 있는지 여부
  stateManager: StateManager; // 보드 데이터/설정을 읽고 쓰는 중앙 관리자
  boardModifiers: BoardModifiers; // 보드 상태를 불변(immutable) 방식으로 변경하는 함수 모음
}

// memo로 감싸 props가 바뀌지 않으면 리렌더링을 건너뛰어 카드가 많은 보드에서 성능을 확보한다.
export const ItemCheckbox = memo(function ItemCheckbox({
  shouldMarkItemsComplete,
  path,
  item,
  stateManager,
  boardModifiers,
}: ItemCheckboxProps) {
  // 사용자 설정 'show-checkboxes'를 구독한다. 설정이 바뀌면 이 컴포넌트도 자동으로 리렌더링된다.
  const shouldShowCheckbox = stateManager.useSetting('show-checkboxes');

  // 체크박스 위에서 Ctrl/Cmd 키를 누르고 있는지(아카이브 버튼으로 바뀌는 트리거) 로컬 상태로 추적
  const [isCtrlHoveringCheckbox, setIsCtrlHoveringCheckbox] = useState(false);
  // 마우스가 체크박스 영역 위에 있는지 여부(키보드 이벤트 리스너를 등록할지 결정하는 데 사용)
  const [isHoveringCheckbox, setIsHoveringCheckbox] = useState(false);

  // 체크박스 클릭(값 변경) 시 실행되는 핸들러. useCallback으로 메모이즈하여
  // item/stateManager/boardModifiers/path가 바뀔 때만 새로 생성한다.
  const onCheckboxChange = useCallback(() => {
    // 1) 먼저 Obsidian Tasks 플러그인 연동을 시도한다. toggleTask는 Tasks 플러그인이
    //    설치돼 있을 때만 결과를 반환하며, 그 플러그인의 "완료 처리" 커맨드를 호출해
    //    반복 작업 생성, 완료일 기록 등 텍스트 재작성 결과를 돌려준다.
    const updates = toggleTask(item, stateManager.file);
    if (updates) {
      // updates: [줄 단위로 분리된 새 카드 텍스트 배열, 각 줄의 체크 문자 배열, 원래 카드에 해당하는 줄 인덱스]
      const [itemStrings, checkChars, thisIndex] = updates;
      // Tasks 플러그인이 반환한 각 줄을 다시 카드(Item) 객체들로 파싱한다.
      // (예: 반복 작업이면 새 미완료 카드가 추가로 하나 더 생길 수 있다)
      const replacements: Item[] = itemStrings.map((str, i) => {
        const next = stateManager.getNewItem(str, checkChars[i]);
        // 원래 카드였던 줄에는 기존 카드의 id를 그대로 유지시켜, React/Preact 리스트 렌더링에서
        // 동일한 카드로 인식되게 하고(드래그 상태, 포커스 등이 끊기지 않도록) 한다.
        if (i === thisIndex) next.id = item.id;
        return next;
      });

      // 기존 카드 하나를 새로 만들어진 카드(들)로 교체한다. (boardModifiers.replaceItem)
      boardModifiers.replaceItem(path, replacements);
    } else {
      // 2) Tasks 플러그인이 없다면 단순히 체크 문자(checkChar)만 토글한다.
      //    immutability-helper의 update()를 사용해 item을 불변적으로 복사/수정한다.
      boardModifiers.updateItem(
        path,
        update(item, {
          data: {
            checkChar: {
              // $apply: 기존 값을 받아 새 값을 계산하는 콜백. 공백(' ', 미완료)이면
              // getTaskStatusDone()이 반환하는 완료 문자('x' 등)로, 아니면 다시 공백으로 바꾼다.
              $apply: (v) => {
                return v === ' ' ? getTaskStatusDone() : ' ';
              },
            },
            // $toggle: 배열로 지정한 boolean 필드들을 반전시키는 immutability-helper 커맨드.
            // 여기서는 item.data.checked 값을 true<->false로 뒤집는다.
            $toggle: ['checked'],
          },
        })
      );
    }
    // 의존성 배열에 ...path를 펼쳐 넣어, path 배열의 각 원소(숫자)가 바뀔 때마다
    // 콜백을 새로 생성하도록 한다(배열 참조 자체가 아니라 값 단위 비교를 위함).
  }, [item, stateManager, boardModifiers, ...path]);

  // 체크박스에 마우스를 올리고 있는 동안에만 전역 keydown/keyup 리스너를 등록해
  // Ctrl/Cmd 키 상태를 추적한다(불필요할 때 리스너를 계속 붙여두지 않기 위한 최적화).
  useEffect(() => {
    if (isHoveringCheckbox) {
      const handler = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey) {
          setIsCtrlHoveringCheckbox(true);
        } else {
          setIsCtrlHoveringCheckbox(false);
        }
      };

      // activeWindow: Obsidian이 제공하는 전역 - 팝아웃 창(별도 윈도우)에서도 올바른
      // window 객체를 참조하도록 하는 헬퍼.
      activeWindow.addEventListener('keydown', handler);
      activeWindow.addEventListener('keyup', handler);

      // useEffect의 클린업 함수: 마우스가 벗어나거나(isHoveringCheckbox가 false로 바뀌거나)
      // 컴포넌트가 언마운트될 때 리스너를 반드시 해제해 메모리 누수를 막는다.
      return () => {
        activeWindow.removeEventListener('keydown', handler);
        activeWindow.removeEventListener('keyup', handler);
      };
    }
  }, [isHoveringCheckbox]);

  // 이 레인이 "완료 표시"도 하지 않고, 사용자 설정으로 체크박스도 보이지 않게 했다면
  // 아무것도 렌더링하지 않는다(early return으로 불필요한 DOM 생성을 방지).
  if (!(shouldMarkItemsComplete || shouldShowCheckbox)) {
    return null;
  }

  return (
    <div
      // 마우스가 들어오면 호버 상태를 켜고, 이미 Ctrl/Cmd를 누른 채 들어왔다면
      // 곧바로 "Ctrl 호버" 상태도 함께 켜준다.
      onMouseEnter={(e) => {
        setIsHoveringCheckbox(true);

        if (e.ctrlKey || e.metaKey) {
          setIsCtrlHoveringCheckbox(true);
        }
      }}
      // 마우스가 벗어나면 호버 상태를 끄고, Ctrl 호버 상태였다면 그것도 함께 끈다.
      onMouseLeave={() => {
        setIsHoveringCheckbox(false);

        if (isCtrlHoveringCheckbox) {
          setIsCtrlHoveringCheckbox(false);
        }
      }}
      className={c('item-prefix-button-wrapper')}
    >
      {/* 평상시(체크박스를 보여줘야 하고, Ctrl을 누르지 않은 상태)에는 일반 체크박스를 렌더링한다.
          checked/data-task 속성은 카드의 현재 완료 상태와 체크 문자를 그대로 반영한다. */}
      {shouldShowCheckbox && !isCtrlHoveringCheckbox && (
        <input
          onChange={onCheckboxChange}
          type="checkbox"
          className="task-list-item-checkbox"
          checked={item.data.checked}
          data-task={item.data.checkChar}
        />
      )}
      {/* Ctrl/Cmd를 누른 채 체크박스 위에 있거나, 체크박스 자체를 표시하지 않는 설정인데
          "완료 표시" 기능은 켜져 있는 경우 체크박스 대신 아카이브 버튼을 보여준다.
          클릭하면 boardModifiers.archiveItem으로 카드를 보관함(archive)으로 옮긴다. */}
      {(isCtrlHoveringCheckbox || (!shouldShowCheckbox && shouldMarkItemsComplete)) && (
        <a
          onClick={() => {
            boardModifiers.archiveItem(path);
          }}
          className={`${c('item-prefix-button')} clickable-icon`}
          aria-label={isCtrlHoveringCheckbox ? undefined : 'Archive card'}
        >
          <Icon name="sheets-in-box" />
        </a>
      )}
    </div>
  );
});
