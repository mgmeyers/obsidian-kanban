import update from 'immutability-helper';
import { moment } from 'obsidian';
import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import {
  appendEntities,
  getEntityFromPath,
  insertEntity,
  moveEntity,
  prependEntities,
  removeEntity,
  updateEntity,
  updateParentEntity,
} from 'src/dnd/util/data';

import { generateInstanceId } from '../components/helpers';
import { Board, DataTypes, Item, Lane } from '../components/types';

export interface BoardModifiers {
  appendItems: (path: Path, items: Item[]) => void;
  prependItems: (path: Path, items: Item[]) => void;
  insertItems: (path: Path, items: Item[]) => void;
  replaceItem: (path: Path, items: Item[]) => void;
  splitItem: (path: Path, items: Item[]) => void;
  moveItemToTop: (path: Path) => void;
  moveItemToBottom: (path: Path) => void;
  addLane: (lane: Lane) => void;
  insertLane: (path: Path, lane: Lane) => void;
  updateLane: (path: Path, lane: Lane) => void;
  archiveLane: (path: Path) => void;
  archiveLaneItems: (path: Path) => void;
  deleteEntity: (path: Path) => void;
  updateItem: (path: Path, item: Item) => void;
  archiveItem: (path: Path) => void;
  duplicateEntity: (path: Path) => void;
}

export function getBoardModifiers(view: KanbanView, stateManager: StateManager): BoardModifiers {
  const appendArchiveDate = (item: Item) => {
    const archiveDateFormat = stateManager.getSetting('archive-date-format');
    const archiveDateSeparator = stateManager.getSetting('archive-date-separator');
    const archiveDateAfterTitle = stateManager.getSetting('append-archive-date');

    const newTitle = [moment().format(archiveDateFormat)];

    if (archiveDateSeparator) newTitle.push(archiveDateSeparator);

    newTitle.push(item.data.titleRaw);

    if (archiveDateAfterTitle) newTitle.reverse();

    const titleRaw = newTitle.join(' ');
    return stateManager.updateItemContent(item, titleRaw);
  };

  return {
    appendItems: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) => {
        const collapseState = view.getViewState('item-collapse');
        const op = (collapseState: boolean[][]) => {
          const [laneIdx, itemIdx] = path;
          const newState = collapseState.map((inner) => [...inner]);
          newState[laneIdx].splice(itemIdx + 1, 0, false);
          return newState;
        };

        view.setViewState('item-collapse', undefined, op);
        return update<Board>(appendEntities(boardData, path, items), {
          data: { settings: { 'item-collapse': { $set: op(collapseState) } } },
        });
      });
    },

    prependItems: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) => {
        const collapseState = view.getViewState('item-collapse');
        const op = (collapseState: boolean[][]) => {
          const [laneIdx, _] = path;
          const newState = collapseState.map((inner) => [...inner]);
          newState[laneIdx].splice(0, 0, false);
          return newState;
        };

        view.setViewState('item-collapse', undefined, op);
        return update<Board>(prependEntities(boardData, path, items), {
          data: { settings: { 'item-collapse': { $set: op(collapseState) } } },
        });
      });
    },

    insertItems: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) => {
        const collapseState = view.getViewState('item-collapse');
        const op = (collapseState: boolean[][]) => {
          const [laneIdx, itemIdx] = path;
          const newState = collapseState.map((inner) => [...inner]);
          newState[laneIdx].splice(itemIdx, 0, false);
          return newState;
        };

        view.setViewState('item-collapse', undefined, op);
        return update<Board>(insertEntity(boardData, path, items), {
          data: { settings: { 'item-collapse': { $set: op(collapseState) } } },
        });
      });
    },

    replaceItem: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) =>
        insertEntity(removeEntity(boardData, path), path, items)
      );
    },

    splitItem: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) => {
        const collapseState = view.getViewState('item-collapse');
        const op = (collapseState: boolean[][]) => {
          const [laneIdx, itemIdx] = path;
          const newItems = Array(items.length).fill(false);
          const newState = collapseState.map((inner) => [...inner]);
          newState[laneIdx].splice(itemIdx, 1, ...newItems);
          return newState;
        };

        view.setViewState('item-collapse', undefined, op);

        return update<Board>(insertEntity(removeEntity(boardData, path), path, items), {
          data: { settings: { 'item-collapse': { $set: op(collapseState) } } },
        });
      });
    },

    moveItemToTop: (path: Path) => {
      stateManager.setState((boardData) => {
        const [laneIdx, itemIdx] = path;
        const collapseStateItems = view.getViewState('item-collapse');
        const op = (collapseState: boolean[][]) => {
          const newState = collapseState.map((inner) => [...inner]);
          const [tmp] = newState[laneIdx].splice(itemIdx, 1);
          newState[laneIdx].unshift(tmp);
          return newState;
        };

        view.setViewState('item-collapse', undefined, op);
        return update<Board>(moveEntity(boardData, path, [laneIdx, 0]), {
          data: { settings: { 'item-collapse': { $set: op(collapseStateItems) } } },
        });
      });
    },

    moveItemToBottom: (path: Path) => {
      stateManager.setState((boardData) => {
        const [laneIdx, itemIdx] = path;
        const lane = boardData.children[laneIdx];

        const collapseState = view.getViewState('item-collapse');
        const op = (collapseState: boolean[][]) => {
          const newState = collapseState.map((inner) => [...inner]);
          const [tmp] = newState[laneIdx].splice(itemIdx, 1);
          newState[laneIdx].push(tmp);
          return newState;
        };

        view.setViewState('item-collapse', undefined, op);
        return update<Board>(moveEntity(boardData, path, [laneIdx, lane.children.length]), {
          data: { settings: { 'item-collapse': { $set: op(collapseState) } } },
        });
      });
    },

    addLane: (lane: Lane) => {
      stateManager.setState((boardData) => {
        const collapseStateLanes = view.getViewState('list-collapse') || [];
        const opLanes = (collapseState: boolean[]) => {
          const newState = [...collapseState];
          newState.push(false);
          return newState;
        };

        const collapseStateItems = view.getViewState('item-collapse') || [];
        const opItems = (collapseState: boolean[][]) => {
          const newState = collapseState.map((inner) => [...inner]);
          newState.push([]);
          return newState;
        };

        view.setViewState('list-collapse', undefined, opLanes);
        view.setViewState('item-collapse', undefined, opItems);
        return update<Board>(appendEntities(boardData, [], [lane]), {
          data: {
            settings: {
              'list-collapse': { $set: opLanes(collapseStateLanes) },
              'item-collapse': { $set: opItems(collapseStateItems) },
            },
          },
        });
      });
    },

    insertLane: (path: Path, lane: Lane) => {
      stateManager.setState((boardData) => {
        const collapseStateLanes = view.getViewState('list-collapse');
        const opLanes = (collapseState: boolean[]) => {
          const newState = [...collapseState];
          newState.splice(path.last(), 0, false);
          return newState;
        };

        const collapseStateItems = view.getViewState('item-collapse') || [];
        const opItems = (collapseState: boolean[][]) => {
          const newState = collapseState.map((inner) => [...inner]);
          newState.splice(path.last(), 0, []);
          return newState;
        };

        view.setViewState('list-collapse', undefined, opLanes);
        view.setViewState('item-collapse', undefined, opItems);

        return update<Board>(insertEntity(boardData, path, [lane]), {
          data: {
            settings: {
              'list-collapse': { $set: opLanes(collapseStateLanes) },
              'item-collapse': { $set: opItems(collapseStateItems) },
            },
          },
        });
      });
    },

    updateLane: (path: Path, lane: Lane) => {
      stateManager.setState((boardData) =>
        updateParentEntity(boardData, path, {
          children: {
            [path[path.length - 1]]: {
              $set: lane,
            },
          },
        })
      );
    },

    archiveLane: (path: Path) => {
      stateManager.setState((boardData) => {
        const lane = getEntityFromPath(boardData, path);
        const items = lane.children;

        try {
          const collapseStateLanes = view.getViewState('list-collapse');
          const opLanes = (collapseState: boolean[]) => {
            const newState = [...collapseState];
            newState.splice(path.last(), 1);
            return newState;
          };
          view.setViewState('list-collapse', undefined, opLanes);

          const collapseStateItems = view.getViewState('item-collapse');
          const opItems = (collapseState: boolean[][]) => {
            const nextState = collapseState.map((inner) => [...inner]);
            nextState.splice(path.last(), 1);
            return nextState;
          };
          view.setViewState('item-collapse', undefined, opItems);

          return update<Board>(removeEntity(boardData, path), {
            data: {
              settings: {
                'list-collapse': { $set: opLanes(collapseStateLanes) },
                'item-collapse': { $set: opItems(collapseStateItems) },
              },
              archive: {
                $unshift: stateManager.getSetting('archive-with-date')
                  ? items.map(appendArchiveDate)
                  : items,
              },
            },
          });
        } catch (e) {
          stateManager.setError(e);
          return boardData;
        }
      });
    },

    archiveLaneItems: (path: Path) => {
      stateManager.setState((boardData) => {
        const lane = getEntityFromPath(boardData, path);
        const items = lane.children;

        const collapseStateItems = view.getViewState('item-collapse');
        const opItems = (collapseState: boolean[][]) => {
          const newState = collapseState.map((inner) => [...inner]);
          newState[path.last()].length = 0;
          return newState;
        };
        view.setViewState('item-collapse', undefined, opItems);

        try {
          return update(
            updateEntity(boardData, path, {
              children: {
                $set: [],
              },
            }),
            {
              data: {
                settings: {
                  'item-collapse': {
                    $set: opItems(collapseStateItems),
                  },
                },
                archive: {
                  $unshift: stateManager.getSetting('archive-with-date')
                    ? items.map(appendArchiveDate)
                    : items,
                },
              },
            }
          );
        } catch (e) {
          stateManager.setError(e);
          return boardData;
        }
      });
    },

    deleteEntity: (path: Path) => {
      stateManager.setState((boardData) => {
        const entity = getEntityFromPath(boardData, path);

        const collapseStateLanes = view.getViewState('list-collapse');
        const collapseStateItems = view.getViewState('item-collapse');
        if (entity.type === DataTypes.Lane) {
          const opLanes = (collapseState: boolean[]) => {
            const newState = [...collapseState];
            newState.splice(path.last(), 1);
            return newState;
          };
          const opItems = (collapseState: boolean[][]) => {
            const newState = collapseState.map((inner) => [...inner]);
            newState.splice(path.last(), 1);
            return newState;
          };
          view.setViewState('list-collapse', undefined, opLanes);
          view.setViewState('item-collapse', undefined, opItems);

          return update<Board>(removeEntity(boardData, path), {
            data: {
              settings: {
                'list-collapse': { $set: opLanes(collapseStateLanes) },
                'item-collapse': { $set: opItems(collapseStateItems) },
              },
            },
          });
        } else {
          // entity.type === DataTypes.Item
          const opItems = (collapseState: boolean[][]) => {
            const [laneIdx, itemIdx] = path;
            const newState = collapseState.map((inner) => [...inner]);
            newState[laneIdx].splice(itemIdx, 1);
            return newState;
          };
          view.setViewState('item-collapse', undefined, opItems);

          return update<Board>(removeEntity(boardData, path), {
            data: {
              settings: {
                'item-collapse': { $set: opItems(collapseStateItems) },
              },
            },
          });
        }
      });
    },

    updateItem: (path: Path, item: Item) => {
      stateManager.setState((boardData) => {
        return updateParentEntity(boardData, path, {
          children: {
            [path[path.length - 1]]: {
              $set: item,
            },
          },
        });
      });
    },

    archiveItem: (path: Path) => {
      stateManager.setState((boardData) => {
        const item = getEntityFromPath(boardData, path);
        try {
          const collapseStateItems = view.getViewState('item-collapse');
          const opItems = (collapseState: boolean[][]) => {
            const [laneIdx, itemIdx] = path;
            const newState = collapseState.map((inner) => [...inner]);
            newState[laneIdx].splice(itemIdx, 1);
            return newState;
          };
          view.setViewState('item-collapse', undefined, opItems);

          return update(removeEntity(boardData, path), {
            data: {
              settings: {
                'item-collapse': {
                  $set: opItems(collapseStateItems),
                },
              },
              archive: {
                $push: [
                  stateManager.getSetting('archive-with-date') ? appendArchiveDate(item) : item,
                ],
              },
            },
          });
        } catch (e) {
          stateManager.setError(e);
          return boardData;
        }
      });
    },

    duplicateEntity: (path: Path) => {
      stateManager.setState((boardData) => {
        const entity = getEntityFromPath(boardData, path);
        const entityWithNewID = update(entity, {
          id: {
            $set: generateInstanceId(),
          },
        });

        if (entity.type === DataTypes.Lane) {
          const collapseState = view.getViewState('list-collapse');
          const op = (collapseState: boolean[]) => {
            const newState = [...collapseState];
            newState.splice(path.last(), 0, collapseState[path.last()]);
            return newState;
          };
          view.setViewState('list-collapse', undefined, op);

          return update<Board>(insertEntity(boardData, path, [entityWithNewID]), {
            data: { settings: { 'list-collapse': { $set: op(collapseState) } } },
          });
        } else {
          // entity.type === DataTypes.Item
          const collapseState = view.getViewState('item-collapse');
          const op = (collapseState: boolean[][]) => {
            const [laneIdx, itemIdx] = path;
            const newState = collapseState.map((inner) => [...inner]);
            newState[laneIdx].splice(itemIdx, 0, collapseState[laneIdx][itemIdx]);
            return newState;
          };
          view.setViewState('item-collapse', undefined, op);

          return update<Board>(insertEntity(boardData, path, [entityWithNewID]), {
            data: { settings: { 'item-collapse': { $set: op(collapseState) } } },
          });
        }
      });
    },
  };
}
