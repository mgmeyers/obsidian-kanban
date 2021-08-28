import { Menu } from 'obsidian';
import React from 'react';

import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c } from '../helpers';
import { Lane } from '../types';

export type LaneAction = 'delete' | 'archive' | 'archive-items' | null;

const actionLabels = {
  delete: {
    description: t(
      'Are you sure you want to delete this list and all its cards?'
    ),
    confirm: t('Yes, delete list'),
  },
  archive: {
    description: t(
      'Are you sure you want to archive this list and all its cards?'
    ),
    confirm: t('Yes, archive list'),
  },
  'archive-items': {
    description: t('Are you sure you want to archive all cards in this list?'),
    confirm: t('Yes, archive cards'),
  },
};

export interface ConfirmActionProps {
  lane: Lane;
  action: LaneAction;
  cancel: () => void;
  onAction: () => void;
}

export function ConfirmAction({
  action,
  cancel,
  onAction,
  lane,
}: ConfirmActionProps) {
  React.useEffect(() => {
    // Immediately execute action if lane is empty
    if (action && lane.children.length === 0) {
      onAction();
    }
  }, [action, lane.children.length]);

  if (!action || (action && lane.children.length === 0)) return null;

  return (
    <div className={c('action-confirm-wrapper')}>
      <div className={c('action-confirm-text')}>
        {actionLabels[action].description}
      </div>
      <div>
        <button onClick={onAction} className={c('confirm-action-button')}>
          {actionLabels[action].confirm}
        </button>
        <button onClick={cancel} className={c('cancel-action-button')}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export interface UseSettingsMenuParams {
  setIsEditing: React.Dispatch<boolean>;
}

export function useSettingsMenu({ setIsEditing }: UseSettingsMenuParams) {
  const { stateManager } = React.useContext(KanbanContext);
  const [confirmAction, setConfirmAction] = React.useState<LaneAction>(null);

  const settingsMenu = React.useMemo(() => {
    return new Menu(stateManager.app)
      .addItem((item) => {
        item
          .setIcon('pencil')
          .setTitle(t('Edit list'))
          .onClick(() => setIsEditing(true));
      })
      .addItem((item) => {
        item
          .setIcon('documents')
          .setTitle(t('Archive cards'))
          .onClick(() => setConfirmAction('archive-items'));
      })
      .addSeparator()
      .addItem((item) => {
        item
          .setIcon('sheets-in-box')
          .setTitle(t('Archive list'))
          .onClick(() => setConfirmAction('archive'));
      })
      .addItem((item) => {
        item
          .setIcon('trash')
          .setTitle(t('Delete list'))
          .onClick(() => setConfirmAction('delete'));
      });
  }, [stateManager, setConfirmAction]);

  return {
    settingsMenu,
    confirmAction,
    setConfirmAction,
  };
}
