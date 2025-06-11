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
  const { boardModifiers } = useContext(KanbanContext);

  if (!isEditing(editState)) return null;

  return (
    <div className={c('lane-setting-wrapper')}>
      <div className={c('checkbox-wrapper')}>
        <div className={c('checkbox-label')}>{t('Mark cards in this list as complete')}</div>
        <div
          onClick={() =>
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
      <div className={c('input-wrapper')} style={{marginTop: 12}}>
        <div className={c('checkbox-label')}>任务符号（拖拽到本列时自动设置）</div>
        <input
          type="text"
          value={lane.data.autoSetTaskSymbol || ''}
          maxLength={2}
          placeholder="如 /, -, > 等"
          onInput={e => {
            const value = (e.target as HTMLInputElement).value;
            boardModifiers.updateLane(
              lanePath,
              update(lane, { data: { autoSetTaskSymbol: { $set: value } } })
            );
          }}
          className={c('lane-symbol-input')}
          style={{width: 60, marginTop: 4}}
        />
      </div>
    </div>
  );
}
