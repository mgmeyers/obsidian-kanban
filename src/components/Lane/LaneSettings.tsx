/**
 * ============================================================================
 * [실행 순서 #68] src/components/Lane/LaneSettings.tsx — 레인별 개별 설정(최대 카드 수 등) UI
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * 이 파일에서 가장 짧고 단순한 컴포넌트로, #64(LaneHeader.tsx)가 제목 편집 모드일 때만
 * 헤더 바로 아래에 렌더링하는 "레인 단위 설정" 패널이다. 현재는 "이 리스트에 들어오는 카드를
 * 완료로 표시할지" 체크박스 하나만 담고 있다. #18(components/context.ts)의 `KanbanContext`에서
 * `boardModifiers`를 useContext로 꺼내, 체크박스를 클릭하면 즉시 `updateLane`을 호출해
 * `lane.data.shouldMarkItemsComplete` 값을 불변(immutable) 방식으로 토글한다.
 * ============================================================================
 */
import update from 'immutability-helper';
import { useContext } from 'preact/compat';
import { Path } from 'src/dnd/types';
import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c } from '../helpers';
import { EditState, Lane, isEditing } from '../types';

export interface LaneSettingsProps {
  lane: Lane;
  lanePath: Path;
  editState: EditState;
}

export function LaneSettings({ lane, lanePath, editState }: LaneSettingsProps) {
  // #18 KanbanContext에서 boardModifiers만 꺼낸다 — 체크박스 토글 시 레인 데이터를 갱신하는 데 사용.
  const { boardModifiers } = useContext(KanbanContext);

  // 제목이 편집 중(isEditing)이 아니면 이 설정 패널 자체를 렌더링하지 않는다.
  // 즉, 사용자가 레인 제목을 더블클릭해 편집 모드로 들어갔을 때만 잠깐 나타나는 UI.
  if (!isEditing(editState)) return null;

  return (
    <div className={c('lane-setting-wrapper')}>
      <div className={c('checkbox-wrapper')}>
        <div className={c('checkbox-label')}>{t('Mark cards in this list as complete')}</div>
        <div
          onClick={() =>
            // immutability-helper의 $toggle 커맨드: 지정한 불리언 필드(shouldMarkItemsComplete)의
            // 값을 반전시킨 새 lane 객체를 만들어 boardModifiers.updateLane으로 반영한다.
            boardModifiers.updateLane(
              lanePath,
              update(lane, {
                data: { $toggle: ['shouldMarkItemsComplete'] },
              })
            )
          }
          className={`checkbox-container ${lane.data.shouldMarkItemsComplete ? 'is-enabled' : ''}`}
        />
      </div>
    </div>
  );
}
