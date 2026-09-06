/**
 * ============================================================================
 * [실행 순서 #64] src/components/Lane/LaneHeader.tsx — 레인 헤더(제목, 카드 수, 메뉴 버튼)
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * #63(Lane.tsx)의 `DraggableLaneRaw`가 각 레인 상단에 렌더링하는 헤더 컴포넌트다.
 * 드래그 손잡이(grip), 접기/펼치기 버튼, 레인 제목(#65 LaneTitle.tsx), 카드 개수 표시,
 * "카드 추가"/"더보기(메뉴)" 버튼, 그리고 레인별 설정(#68 LaneSettings.tsx)과
 * 삭제/보관 확인 다이얼로그(ConfirmAction, #67 LaneMenu.tsx에서 가져온 것)까지 한 화면에
 * 조립한다. #18(components/context.ts)의 `KanbanContext`에서 `stateManager`(설정 조회용)와
 * `boardModifiers`(레인 제목 변경·보관·삭제 실행용)를 useContext로 꺼내 쓰며, 제목 편집이나
 * 메뉴 클릭 같은 사용자 상호작용이 이 값들을 통해 실제 보드 데이터에 반영된다.
 * ============================================================================
 */
import update from 'immutability-helper';
import { Menu } from 'obsidian';
import { memo } from 'preact/compat';
import { Dispatch, StateUpdater, useCallback, useContext, useEffect, useState } from 'preact/hooks';
import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { t } from 'src/lang/helpers';
import { parseLaneTitle } from 'src/parsers/helpers/parser';

import { getDropAction } from '../Editor/helpers';
import { GripIcon } from '../Icon/GripIcon';
import { Icon } from '../Icon/Icon';
import { KanbanContext } from '../context';
import { c } from '../helpers';
import { EditState, EditingState, Lane, isEditing } from '../types';
import { ConfirmAction, useSettingsMenu } from './LaneMenu';
import { LaneSettings } from './LaneSettings';
import { LaneLimitCounter, LaneTitle } from './LaneTitle';

interface LaneHeaderProps {
  lane: Lane;
  laneIndex: number;
  bindHandle: (el: HTMLElement) => void; // #63에서 만든 드래그 핸들 바인더 — grip 요소의 ref로 전달됨
  setIsItemInputVisible?: Dispatch<StateUpdater<EditState>>; // "간이 카드 추가" 입력창 표시 setter(선택적)
  isCollapsed: boolean;
  toggleIsCollapsed: () => void;
}

interface LaneButtonProps {
  settingsMenu: Menu; // #67 useSettingsMenu가 만든 obsidian Menu 인스턴스
  editState: EditState;
  setEditState: Dispatch<StateUpdater<EditState>>;
  setIsItemInputVisible?: Dispatch<StateUpdater<EditState>>;
}

// 레인 헤더 오른쪽의 버튼 영역(카드 추가 버튼 + 더보기 메뉴 버튼, 혹은 편집 중일 때 닫기 버튼)을
// 담당하는 하위 컴포넌트.
function LaneButtons({
  settingsMenu,
  editState,
  setEditState,
  setIsItemInputVisible,
}: LaneButtonProps) {
  // #18 KanbanContext에서 stateManager만 꺼낸다 — 드래그 오버 시 드롭 가능 여부를 판단하는 데 필요.
  const { stateManager } = useContext(KanbanContext);
  return (
    <div className={c('lane-settings-button-wrapper')}>
      {isEditing(editState) ? (
        // 제목 편집 중이면 버튼 영역을 "닫기(X)" 버튼 하나로 교체 — 편집 취소 역할
        <a
          onClick={() => setEditState(null)}
          aria-label={t('Close')}
          className={`${c('lane-settings-button')} is-enabled clickable-icon`}
        >
          <Icon name="lucide-x" />
        </a>
      ) : (
        <>
          {/* setIsItemInputVisible이 주어졌을 때만(=compact-prepend 삽입 모드일 때만) "카드 추가" 버튼 노출 */}
          {setIsItemInputVisible && (
            <a
              aria-label={t('Add a card')}
              className={`${c('lane-settings-button')} clickable-icon`}
              onClick={() => setIsItemInputVisible({ x: 0, y: 0 })}
              onDragOver={(e) => {
                // 카드를 이 버튼 위로 드래그해 올리면(드롭 대상이 유효할 때) 자동으로 입력창을 열어준다
                if (getDropAction(stateManager, e.dataTransfer)) {
                  setIsItemInputVisible({ x: 0, y: 0 });
                }
              }}
            >
              <Icon name="lucide-plus-circle" />
            </a>
          )}
          {/* "더보기" 버튼 — 클릭 시 #67에서 만들어진 obsidian Menu를 마우스 위치에 표시 */}
          <a
            aria-label={t('More options')}
            className={`${c('lane-settings-button')} clickable-icon`}
            onClick={(e) => {
              settingsMenu.showAtMouseEvent(e);
            }}
          >
            <Icon name="lucide-more-vertical" />
          </a>
        </>
      )}
    </div>
  );
}

// memo로 감싸 props가 바뀌지 않으면 리렌더를 생략하는 레인 헤더 본체 컴포넌트.
export const LaneHeader = memo(function LaneHeader({
  lane,
  laneIndex,
  bindHandle,
  setIsItemInputVisible,
  isCollapsed,
  toggleIsCollapsed,
}: LaneHeaderProps) {
  // 제목이 편집 중인지/닫혀 있는지를 나타내는 로컬 상태. EditingState.cancel이 "닫힘" 기본값.
  const [editState, setEditState] = useState<EditState>(EditingState.cancel);
  // dnd 트리에서 이 레인의 경로 — boardModifiers 호출 시 대상 위치를 지정하는 데 사용.
  const lanePath = useNestedEntityPath(laneIndex);

  // #18 KanbanContext에서 boardModifiers(보드 데이터 수정 헬퍼)를 꺼낸다. 제목 변경, 보관, 삭제가
  // 모두 이 객체의 메서드를 통해 이루어진다.
  const { boardModifiers } = useContext(KanbanContext);
  // #67 LaneMenu.tsx의 useSettingsMenu 훅: 이 레인에 맞는 obsidian Menu(정렬/보관/삭제 등)와
  // 삭제·보관 확인 상태(confirmAction)를 생성해 반환한다.
  const { settingsMenu, confirmAction, setConfirmAction } = useSettingsMenu({
    setEditState,
    path: lanePath,
    lane,
  });

  // lane.data.forceEditMode 플래그가 true로 바뀌면(예: "앞/뒤에 리스트 삽입"으로 새로 만들어진
  // 빈 레인) 자동으로 제목 편집 모드를 연다. 의존성 배열에 lane.data.forceEditMode만 넣어
  // 그 값이 바뀔 때만 이 이펙트가 실행되게 한다.
  useEffect(() => {
    if (lane.data.forceEditMode) {
      setEditState(null);
    }
  }, [lane.data.forceEditMode]);

  // 사용자가 제목 입력을 마쳤을 때 호출되는 콜백. 입력 문자열에서 "제목"과 "최대 카드 수(maxItems)"를
  // 함께 파싱(parseLaneTitle)한 뒤, boardModifiers.updateLane으로 레인 데이터를 불변 갱신한다.
  const onLaneTitleChange = useCallback(
    (str: string) => {
      const { title, maxItems } = parseLaneTitle(str);
      boardModifiers.updateLane(
        lanePath,
        update(lane, {
          data: {
            title: { $set: title },
            maxItems: { $set: maxItems },
          },
        })
      );
    },
    [boardModifiers, lane, lanePath]
  );

  // 레인 헤더를 더블클릭하면(접혀 있지 않을 때만) 제목 편집 모드를 연다. 클릭 좌표(clientX/Y)를
  // editState에 담아 #65 LaneTitle이 편집기를 그 위치에 배치할 수 있게 한다.
  const onDoubleClick = useCallback(
    (e: MouseEvent) => {
      !isCollapsed && setEditState({ x: e.clientX, y: e.clientY });
    },
    [isCollapsed, setEditState]
  );

  return (
    <>
      <div
        // eslint-disable-next-line react/no-unknown-property
        onDblClick={onDoubleClick}
        className={c('lane-header-wrapper')}
      >
        {/* 드래그 손잡이(grip) — bindHandle(ref)를 통해 #63의 useDragHandle과 연결되어
            이 요소를 누르고 끌면 레인 전체가 드래그된다. */}
        <div className={c('lane-grip')} ref={bindHandle}>
          <GripIcon />
        </div>

        {/* 접기/펼치기 화살표 아이콘. 클릭 시 #63에서 내려온 toggleIsCollapsed 콜백 실행 */}
        <div onClick={toggleIsCollapsed} className={c('lane-collapse')}>
          <Icon name="chevron-down" />
        </div>

        {/* #65 LaneTitle — 편집 모드일 땐 마크다운 에디터, 아닐 땐 렌더링된 제목 텍스트를 보여준다 */}
        <LaneTitle
          id={lane.id}
          editState={editState}
          maxItems={lane.data.maxItems}
          onChange={onLaneTitleChange}
          setEditState={setEditState}
          title={lane.data.title}
        />

        {/* 카드 개수 / 최대 카드 수(WIP 제한) 배지 표시 (#65에서 함께 export) */}
        <LaneLimitCounter
          editState={editState}
          itemCount={lane.children.length}
          maxItems={lane.data.maxItems}
        />

        <LaneButtons
          editState={editState}
          setEditState={setEditState}
          setIsItemInputVisible={setIsItemInputVisible}
          settingsMenu={settingsMenu}
        />
      </div>

      {/* #68 LaneSettings — 제목 편집 모드일 때만 그 아래에 나타나는 "완료로 표시" 등 개별 설정 UI */}
      <LaneSettings editState={editState} lane={lane} lanePath={lanePath} />

      {/* confirmAction("delete" | "archive" | "archive-items")이 설정되어 있으면 확인 다이얼로그를
          띄운다. 사용자가 확인 버튼을 누르면 실제 boardModifiers 메서드를 호출해 레인을 삭제/보관한다. */}
      {confirmAction && (
        <ConfirmAction
          lane={lane}
          action={confirmAction}
          onAction={() => {
            switch (confirmAction) {
              case 'archive':
                boardModifiers.archiveLane(lanePath);
                break;
              case 'archive-items':
                boardModifiers.archiveLaneItems(lanePath);
                break;
              case 'delete':
                boardModifiers.deleteEntity(lanePath);
                break;
            }

            setConfirmAction(null);
          }}
          cancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
});
