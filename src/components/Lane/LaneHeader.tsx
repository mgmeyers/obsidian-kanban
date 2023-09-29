import update from 'immutability-helper';
import Preact from 'preact/compat';

import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { t } from 'src/lang/helpers';
import { parseLaneTitle } from 'src/parsers/helpers/parser';

import { KanbanContext } from '../context';
import { getDropAction } from '../Editor/helpers';
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
  dragHandleRef: Preact.RefObject<HTMLDivElement>;
  setIsItemInputVisible?: Preact.StateUpdater<boolean>;
}

export const LaneHeader = Preact.memo(function LaneHeader({
  lane,
  laneIndex,
  dragHandleRef,
  setIsItemInputVisible,
}: LaneHeaderProps) {
  const { boardModifiers, stateManager } = Preact.useContext(KanbanContext);
  const [isEditing, setIsEditing] = Preact.useState(false);
  const lanePath = useNestedEntityPath(laneIndex);

  const { settingsMenu, confirmAction, setConfirmAction } = useSettingsMenu({
    setIsEditing,
    path: lanePath,
    lane,
  });

  Preact.useEffect(() => {
    if (lane.data.forceEditMode) {
      setIsEditing(true);
    }
  }, [lane.data.forceEditMode]);

  const [points, completedPoints] = lane.children.reduce(
    ([points, completedPoints], child) => {
      return [
        points + (child.data.points ?? 0),
        completedPoints + (child.data.completedPoints ?? 0),
      ];
    },
    [0, 0]
  );

  return (
    <>
      <div
        onDblClick={() => setIsEditing(true)}
        className={c('lane-header-wrapper')}
      >
        <div className={c('lane-grip')} ref={dragHandleRef}>
          <GripIcon />
        </div>
        <LaneTitle
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          itemCount={lane.children.length}
          maxItems={lane.data.maxItems}
          title={lane.data.title}
          points={points}
          completedPoints={completedPoints}
          onChange={(e) => {
            const { title, maxItems } = parseLaneTitle(
              (e.target as HTMLTextAreaElement).value
            );
            boardModifiers.updateLane(
              lanePath,
              update(lane, {
                data: {
                  title: { $set: title },
                  maxItems: { $set: maxItems },
                },
              })
            );
          }}
        />
        <div className={c('lane-settings-button-wrapper')}>
          {isEditing ? (
            <a
              onClick={() => {
                setIsEditing(false);
              }}
              aria-label={t('Close')}
              className={`${c(
                'lane-settings-button'
              )} is-enabled clickable-icon`}
            >
              <Icon name="lucide-x" />
            </a>
          ) : (
            <>
              {setIsItemInputVisible && (
                <a
                  aria-label={t('Add a card')}
                  className={`${c('lane-settings-button')} clickable-icon`}
                  onClick={() => {
                    setIsItemInputVisible(true);
                  }}
                  onDragOver={(e) => {
                    if (getDropAction(stateManager, e.dataTransfer)) {
                      setIsItemInputVisible(true);
                    }
                  }}
                >
                  <Icon name="lucide-plus-circle" />
                </a>
              )}
              <a
                aria-label={t('More options')}
                className={`${c('lane-settings-button')} clickable-icon`}
                onClick={(e) => {
                  settingsMenu.showAtPosition({ x: e.clientX, y: e.clientY });
                }}
              >
                <Icon name="lucide-more-vertical" />
              </a>
            </>
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
});
