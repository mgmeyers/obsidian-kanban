import update from 'immutability-helper';
import { Menu, moment } from 'obsidian';
import Preact from 'preact/compat';
import { StateUpdater } from 'preact/hooks';
import { Path } from 'src/dnd/types';
import { defaultSort } from 'src/helpers/util';
import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c, generateInstanceId } from '../helpers';
import { EditState, Lane, LaneSort, LaneTemplate } from '../types';

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
  Preact.useEffect(() => {
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
  setEditState: StateUpdater<EditState>;
  path: Path;
  lane: Lane;
}

export function useSettingsMenu({
  setEditState,
  path,
  lane,
}: UseSettingsMenuParams) {
  const { stateManager, boardModifiers } = Preact.useContext(KanbanContext);
  const [confirmAction, setConfirmAction] = Preact.useState<LaneAction>(null);

  const settingsMenu = Preact.useMemo(() => {
    return new Menu()
      .addItem((item) => {
        item
          .setIcon('lucide-edit-3')
          .setTitle(t('Edit list'))
          .onClick(() => setEditState({ x: 0, y: 0 }));
      })
      .addItem((item) => {
        item
          .setIcon('lucide-archive')
          .setTitle(t('Archive cards'))
          .onClick(() => setConfirmAction('archive-items'));
      })
      .addSeparator()
      .addItem((item) => {
        item
          .setIcon('lucide-move-vertical')
          .setTitle(t('Sort by card text'))
          .onClick(() => {
            const children = lane.children.slice();
            const isAsc = lane.data.sorted === LaneSort.TitleAsc;

            children.sort((a, b) => {
              if (isAsc) {
                return b.data.title.localeCompare(a.data.title);
              }

              return a.data.title.localeCompare(b.data.title);
            });

            boardModifiers.updateLane(
              path,
              update(lane, {
                children: {
                  $set: children,
                },
                data: {
                  sorted: {
                    $set:
                      lane.data.sorted === LaneSort.TitleAsc
                        ? LaneSort.TitleDsc
                        : LaneSort.TitleAsc,
                  },
                },
              })
            );
          });
      })
      .addItem((item) => {
        item
          .setIcon('lucide-move-vertical')
          .setTitle(t('Sort by date'))
          .onClick(() => {
            const children = lane.children.slice();
            const mod = lane.data.sorted === LaneSort.DateAsc ? -1 : 1;

            children.sort((a, b) => {
              const aDate: moment.Moment | undefined =
                a.data.metadata.time || a.data.metadata.date;
              const bDate: moment.Moment | undefined =
                b.data.metadata.time || b.data.metadata.date;

              if (aDate && !bDate) return -1 * mod;
              if (bDate && !aDate) return 1 * mod;
              if (!aDate && !bDate) return 0;

              return (aDate.isBefore(bDate) ? -1 : 1) * mod;
            });

            boardModifiers.updateLane(
              path,
              update(lane, {
                children: {
                  $set: children,
                },
                data: {
                  sorted: {
                    $set:
                      lane.data.sorted === LaneSort.DateAsc
                        ? LaneSort.DateDsc
                        : LaneSort.DateAsc,
                  },
                },
              })
            );
          });
      })
      .addItem((item) => {
        item
          .setIcon('lucide-move-vertical')
          .setTitle(t('Sort by tags'))
          .onClick(() => {
            const children = lane.children.slice();
            const desc = lane.data.sorted === LaneSort.TagsAsc ? true : false;

            children.sort((a, b) => {
              const tagsA = a.data.metadata.tags;
              const tagsB = b.data.metadata.tags;

              if (!tagsA?.length && !tagsB?.length) return 0;
              if (!tagsA?.length) return 1;
              if (!tagsB?.length) return -1;

              if (desc) return defaultSort(tagsB.join(''), tagsA.join(''));
              return defaultSort(tagsA.join(''), tagsB.join(''));
            });

            boardModifiers.updateLane(
              path,
              update(lane, {
                children: {
                  $set: children,
                },
                data: {
                  sorted: {
                    $set:
                      lane.data.sorted === LaneSort.TagsAsc
                        ? LaneSort.TagsDsc
                        : LaneSort.TagsAsc,
                  },
                },
              })
            );
          });
      })
      .addSeparator()
      .addItem((i) => {
        i.setIcon('corner-left-down')
          .setTitle(t('Insert list before'))
          .onClick(() =>
            boardModifiers.insertLane(path, {
              ...LaneTemplate,
              id: generateInstanceId(),
              children: [],
              data: {
                title: '',
                shouldMarkItemsComplete: false,
                forceEditMode: true,
              },
            })
          );
      })
      .addItem((i) => {
        i.setIcon('lucide-corner-right-down')
          .setTitle(t('Insert list after'))
          .onClick(() => {
            const newPath = [...path];

            newPath[newPath.length - 1] = newPath[newPath.length - 1] + 1;

            boardModifiers.insertLane(newPath, {
              ...LaneTemplate,
              id: generateInstanceId(),
              children: [],
              data: {
                title: '',
                shouldMarkItemsComplete: false,
                forceEditMode: true,
              },
            });
          });
      })
      .addSeparator()
      .addItem((item) => {
        item
          .setIcon('lucide-archive')
          .setTitle(t('Archive list'))
          .onClick(() => setConfirmAction('archive'));
      })
      .addItem((item) => {
        item
          .setIcon('lucide-trash-2')
          .setTitle(t('Delete list'))
          .onClick(() => setConfirmAction('delete'));
      });
  }, [stateManager, setConfirmAction, path, lane]);

  return {
    settingsMenu,
    confirmAction,
    setConfirmAction,
  };
}
