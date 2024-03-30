import update from 'immutability-helper';
import Preact from 'preact/compat';
import { StateUpdater } from 'preact/hooks';
import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { t } from 'src/lang/helpers';
import { parseLaneTitle } from 'src/parsers/helpers/parser';

import { getDropAction } from '../Editor/helpers';
import { GripIcon } from '../Icon/GripIcon';
import { Icon } from '../Icon/Icon';
import { KanbanContext } from '../context';
import { c } from '../helpers';
import { EditState, EditingState, Lane } from '../types';
import { ConfirmAction, useSettingsMenu } from './LaneMenu';
import { LaneSettings } from './LaneSettings';
import { LaneTitle } from './LaneTitle';

interface LaneHeaderProps {
  lane: Lane;
  laneIndex: number;
  dragHandleRef: Preact.RefObject<HTMLDivElement>;
  setIsItemInputVisible?: StateUpdater<EditState>;
}

export const LaneHeader = Preact.memo(function LaneHeader({
  lane,
  laneIndex,
  dragHandleRef,
  setIsItemInputVisible,
}: LaneHeaderProps) {
  const { boardModifiers, stateManager } = Preact.useContext(KanbanContext);
  const [editState, setEditState] = Preact.useState<EditState>(
    EditingState.cancel
  );
  const lanePath = useNestedEntityPath(laneIndex);

  const { settingsMenu, confirmAction, setConfirmAction } = useSettingsMenu({
    setEditState: setEditState,
    path: lanePath,
    lane,
  });

  Preact.useEffect(() => {
    if (lane.data.forceEditMode) {
      setEditState(null);
    }
  }, [lane.data.forceEditMode]);

  return (
    <>
      <div
        // eslint-disable-next-line react/no-unknown-property
        onDblClick={(e) => setEditState({ x: e.clientX, y: e.clientY })}
        className={c('lane-header-wrapper')}
      >
        <div className={c('lane-grip')} ref={dragHandleRef}>
          <GripIcon />
        </div>

        <LaneTitle
          editState={editState}
          setEditState={setEditState}
          itemCount={lane.children.length}
          maxItems={lane.data.maxItems}
          title={lane.data.title}
          onChange={(str) => {
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
          }}
        />
        <div className={c('lane-settings-button-wrapper')}>
          {typeof editState === 'object' ? (
            <a
              onClick={() => setEditState(null)}
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
                    setIsItemInputVisible({ x: 0, y: 0 });
                  }}
                  onDragOver={(e) => {
                    if (getDropAction(stateManager, e.dataTransfer)) {
                      setIsItemInputVisible({ x: 0, y: 0 });
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

      {typeof editState === 'object' && (
        <LaneSettings lane={lane} lanePath={lanePath} />
      )}

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
