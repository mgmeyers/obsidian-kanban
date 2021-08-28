import update from 'immutability-helper';
import React from 'react';

import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c } from '../helpers';
import { GripIcon } from '../Icon/GripIcon';
import { Icon } from '../Icon/Icon';
import { Lane } from '../types';
import { ConfirmAction, useSettingsMenu } from './LaneMenu';
import { LaneSettings } from './LaneSettings';
import { LaneTitle } from './LaneTitle';

interface LaneHeaderProps {
  lane: Lane;
  laneIndex: number;
  dragHandleRef: React.MutableRefObject<HTMLDivElement>;
}

export const LaneHeader = React.memo(
  ({ lane, laneIndex, dragHandleRef }: LaneHeaderProps) => {
    const { boardModifiers } = React.useContext(KanbanContext);
    const [isEditing, setIsEditing] = React.useState(false);
    const lanePath = useNestedEntityPath(laneIndex);

    const { settingsMenu, confirmAction, setConfirmAction } = useSettingsMenu({
      setIsEditing,
    });

    return (
      <>
        <div
          onDoubleClick={() => setIsEditing(true)}
          className={c('lane-header-wrapper')}
        >
          <div className={c('lane-grip')} ref={dragHandleRef}>
            <GripIcon />
          </div>

          <LaneTitle
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            itemCount={lane.children.length}
            title={lane.data.title}
            onChange={(e) =>
              boardModifiers.updateLane(
                lanePath,
                update(lane, { data: { title: { $set: e.target.value } } })
              )
            }
          />

          <div className={c('lane-settings-button-wrapper')}>
            {isEditing ? (
              <button
                onClick={() => {
                  setIsEditing(false);
                }}
                aria-label="Close"
                className={`${c('lane-settings-button')} is-enabled`}
              >
                <Icon name="cross" />
              </button>
            ) : (
              <button
                aria-label={t('More options')}
                className={c('lane-settings-button')}
                onClick={(e) => {
                  settingsMenu.showAtPosition({ x: e.clientX, y: e.clientY });
                }}
              >
                <Icon name="vertical-three-dots" />
              </button>
            )}
          </div>
        </div>

        {isEditing && <LaneSettings lane={lane} lanePath={lanePath} />}

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
  }
);
