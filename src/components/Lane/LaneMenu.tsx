import update from 'immutability-helper';
import { Menu, Platform } from 'obsidian';
import { Dispatch, StateUpdater, useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { Path } from 'src/dnd/types';
import { defaultSort } from 'src/helpers/util';
import { t } from 'src/lang/helpers';
import { lableToName } from 'src/parsers/helpers/inlineMetadata';

import { anyToString } from '../Item/MetadataTable';
import { KanbanContext } from '../context';
import { c, generateInstanceId } from '../helpers';
import { EditState, Lane, LaneSort, LaneTemplate } from '../types';

export type LaneAction = 'delete' | 'archive' | 'archive-items' | null;

const actionLabels = {
  delete: {
    description: t('Are you sure you want to delete this list and all its cards?'),
    confirm: t('Yes, delete list'),
  },
  archive: {
    description: t('Are you sure you want to archive this list and all its cards?'),
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

export function ConfirmAction({ action, cancel, onAction, lane }: ConfirmActionProps) {
  useEffect(() => {
    // Immediately execute action if lane is empty
    if (action && lane.children.length === 0) {
      onAction();
    }
  }, [action, lane.children.length]);

  if (!action || (action && lane.children.length === 0)) return null;

  return (
    <div className={c('action-confirm-wrapper')}>
      <div className={c('action-confirm-text')}>{actionLabels[action].description}</div>
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
  setEditState: Dispatch<StateUpdater<EditState>>;
  path: Path;
  lane: Lane;
}

export function useSettingsMenu({ setEditState, path, lane }: UseSettingsMenuParams) {
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const [confirmAction, setConfirmAction] = useState<LaneAction>(null);

  const settingsMenu = useMemo(() => {
    const metadataSortOptions = new Set<string>();
    let canSortDate = false;
    let canSortTags = false;

    lane.children.forEach((item) => {
      const taskData = item.data.metadata.inlineMetadata;
      if (taskData) {
        taskData.forEach((m) => {
          if (m.key === 'repeat') return;
          if (!metadataSortOptions.has(m.key)) metadataSortOptions.add(m.key);
        });
      }

      if (!canSortDate && item.data.metadata.date) canSortDate = true;
      if (!canSortTags && item.data.metadata.tags?.length) canSortTags = true;
    });

    const menu = new Menu()
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
      .addItem((i) => {
        i.setIcon('arrow-left-to-line')
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
        i.setIcon('arrow-right-to-line')
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
      })
      .addSeparator()
      .addItem((item) => {
        const isHoriz = !!lane.data.isHorizontal;
        item
          .setIcon('lucide-layout-list')
          .setTitle(isHoriz ? t('Make this vertical') : t('Make this horizontal'))
          .onClick(() => {
            stateManager.setState((board) => {
              return update(board, {
                children: {
                  $set: board.children.map((l, i) => {
                    const targetIndex = path[path.length - 1];
                    if (i === targetIndex) {
                      return update(l, {
                        data: { isHorizontal: { $set: !isHoriz } },
                      });
                    }
                    if (!isHoriz && l.data.isHorizontal) {
                      return update(l, {
                        data: { isHorizontal: { $set: false } },
                      });
                    }
                    return l;
                  }),
                },
              });
            });
          });
      })
      .addSeparator();

    const addSortOptions = (menu: Menu) => {
      menu.addItem((item) => {
        item
          .setIcon('arrow-down-up')
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
      });

      if (canSortDate) {
        menu.addItem((item) => {
          item
            .setIcon('arrow-down-up')
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
                        lane.data.sorted === LaneSort.DateAsc ? LaneSort.DateDsc : LaneSort.DateAsc,
                    },
                  },
                })
              );
            });
        });
      }

      if (canSortTags) {
        menu.addItem((item) => {
          item
            .setIcon('arrow-down-up')
            .setTitle(t('Sort by tags'))
            .onClick(() => {
              const tagSortOrder = stateManager.getSetting('tag-sort');
              const children = lane.children.slice();
              const desc = lane.data.sorted === LaneSort.TagsAsc ? true : false;

              children.sort((a, b) => {
                const tagsA = a.data.metadata.tags;
                const tagsB = b.data.metadata.tags;

                if (!tagsA?.length && !tagsB?.length) return 0;
                if (!tagsA?.length) return 1;
                if (!tagsB?.length) return -1;

                const aSortOrder =
                  tagSortOrder?.findIndex((sort) => tagsA.includes(sort.tag)) ?? -1;
                const bSortOrder =
                  tagSortOrder?.findIndex((sort) => tagsB.includes(sort.tag)) ?? -1;

                if (aSortOrder > -1 && bSortOrder < 0) return desc ? 1 : -1;
                if (bSortOrder > -1 && aSortOrder < 0) return desc ? -1 : 1;
                if (aSortOrder > -1 && bSortOrder > -1) {
                  return desc ? bSortOrder - aSortOrder : aSortOrder - bSortOrder;
                }

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
                        lane.data.sorted === LaneSort.TagsAsc ? LaneSort.TagsDsc : LaneSort.TagsAsc,
                    },
                  },
                })
              );
            });
        });
      }

      if (metadataSortOptions.size) {
        metadataSortOptions.forEach((k) => {
          menu.addItem((i) => {
            i.setIcon('arrow-down-up')
              .setTitle(t('Sort by') + ' ' + lableToName(k).toLocaleLowerCase())
              .onClick(() => {
                const children = lane.children.slice();
                const desc = lane.data.sorted === k + '-asc' ? true : false;

                children.sort((a, b) => {
                  const valA = a.data.metadata.inlineMetadata?.find((m) => m.key === k);
                  const valB = b.data.metadata.inlineMetadata?.find((m) => m.key === k);

                  if (valA === undefined && valB === undefined) return 0;
                  if (valA === undefined) return 1;
                  if (valB === undefined) return -1;

                  if (desc) {
                    return defaultSort(
                      anyToString(valB.value, stateManager),
                      anyToString(valA.value, stateManager)
                    );
                  }
                  return defaultSort(
                    anyToString(valA.value, stateManager),
                    anyToString(valB.value, stateManager)
                  );
                });

                boardModifiers.updateLane(
                  path,
                  update(lane, {
                    children: {
                      $set: children,
                    },
                    data: {
                      sorted: {
                        $set: lane.data.sorted === k + '-asc' ? k + '-desc' : k + '-asc',
                      },
                    },
                  })
                );
              });
          });
        });
      }
    };

    if (Platform.isPhone) {
      addSortOptions(menu);
    } else {
      menu.addItem((item) => {
        const submenu = (item as any).setTitle(t('Sort by')).setIcon('arrow-down-up').setSubmenu();

        addSortOptions(submenu);
      });
    }

    return menu;
  }, [stateManager, setConfirmAction, path, lane]);

  return {
    settingsMenu,
    confirmAction,
    setConfirmAction,
  };
}
