import update from 'immutability-helper';
import React from 'react';

import { Path } from 'src/dnd/types';
import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c } from '../helpers';
import { Lane } from '../types';

export interface LaneSettingsProps {
  lane: Lane;
  lanePath: Path;
}

export function LaneSettings({ lane, lanePath }: LaneSettingsProps) {
  const { boardModifiers } = React.useContext(KanbanContext);

  return (
    <div className={c('lane-setting-wrapper')}>
      <div className={c('checkbox-wrapper')}>
        <div className={c('checkbox-label')}>
          {t('Mark items in this list as complete')}
        </div>
        <div
          onClick={() =>
            boardModifiers.updateLane(
              lanePath,
              update(lane, {
                data: { $toggle: ['shouldMarkItemsComplete'] },
              })
            )
          }
          className={`checkbox-container ${
            lane.data.shouldMarkItemsComplete ? 'is-enabled' : ''
          }`}
        />
      </div>
    </div>
  );
}
