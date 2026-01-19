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

import { ItemCollapseState } from '../Settings';
import { generateInstanceId } from '../components/helpers';
import { Board, DataTypes, Item, Lane } from '../components/types';

export interface BoardModifiers {
  addLane: (lane: Lane) => void;
  insertLane: (path: Path, lane: Lane) => void;
  updateLane: (path: Path, lane: Lane) => void;
  appendItems: (path: Path, items: Item[]) => void;
  prependItems: (path: Path, items: Item[]) => void;
  insertItems: (path: Path, items: Item[]) => void;
  updateItem: (path: Path, item: Item) => void;
  splitItem: (path: Path, items: Item[]) => void;
  duplicateEntity: (path: Path) => void;
  replaceItem: (path: Path, items: Item[]) => void;
  moveItemToTop: (path: Path) => void;
  moveItemToBottom: (path: Path) => void;
  moveItemToLane: (source: Path, destination: Path) => void;
  deleteEntity: (path: Path) => void;
  archiveLane: (path: Path) => void;
  archiveLaneItems: (path: Path) => void;
  archiveItem: (path: Path) => void;
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
  const generateItemsState = (items: Item[]): (true | false | undefined)[] => {
    const outsideInlineMetadata = stateManager.getSetting('inline-metadata-position') !== 'body';

    return items.map((item) =>
      (outsideInlineMetadata && item.data.metadata.inlineMetadata) ||
      item.data.metadata.fileMetadata
        ? false
        : undefined
    );
  };

  return {
    appendItems: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) => {
        const collapseState = view.getViewState('item-collapse');
        const op = (collapseState: ItemCollapseState) => {
          const [laneIdx, _] = path;
          const newState = collapseState.map((inner) => [...inner]);
          newState[laneIdx].splice(newState[laneIdx].length, 0, ...generateItemsState(items));
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
        const op = (collapseState: ItemCollapseState) => {
          const [laneIdx, _] = path;
          const newState = collapseState.map((inner) => [...inner]);
          newState[laneIdx].splice(0, 0, ...generateItemsState(items));
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
        const op = (collapseState: ItemCollapseState) => {
          const [laneIdx, itemIdx] = path;
          const newState = collapseState.map((inner) => [...inner]);
          newState[laneIdx].splice(itemIdx, 0, ...generateItemsState(items));
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
        const op = (collapseState: ItemCollapseState) => {
          const [laneIdx, itemIdx] = path;
          const newState = collapseState.map((inner) => [...inner]);
          newState[laneIdx].splice(itemIdx, 1, ...generateItemsState(items));
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
        const op = (collapseState: ItemCollapseState) => {
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
        const op = (collapseState: ItemCollapseState) => {
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

    moveItemToLane: (source: Path, destination: Path) => {
      if (source[0] === destination[0]) return;

      stateManager.setState((boardData) => {
        const collapseState = view.getViewState('item-collapse');
        const op = (collapseState: ItemCollapseState) => {
          const [sLaneIdx, sItemIdx] = source;
          const [dLaneIdx, dItemIdx] = destination;
          const newState = collapseState.map((inner) => [...inner]);
          const tmp = newState[sLaneIdx].splice(sItemIdx, 1);
          newState[dLaneIdx].splice(dItemIdx, 0, ...tmp);
          return newState;
        };
        view.setViewState('item-collapse', undefined, op);

        return update<Board>(moveEntity(boardData, source, destination), {
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
        view.setViewState('list-collapse', undefined, opLanes);

        const collapseStateItems = view.getViewState('item-collapse') || [];
        const opItems = (collapseState: ItemCollapseState) => {
          const newState = collapseState.map((inner) => [...inner]);
          newState.push([]);
          return newState;
        };
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
        view.setViewState('list-collapse', undefined, opLanes);

        const collapseStateItems = view.getViewState('item-collapse') || [];
        const opItems = (collapseState: ItemCollapseState) => {
          const newState = collapseState.map((inner) => [...inner]);
          newState.splice(path.last(), 0, []);
          return newState;
        };
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
          const opItems = (collapseState: ItemCollapseState) => {
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
        const opItems = (collapseState: ItemCollapseState) => {
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
          const opItems = (collapseState: ItemCollapseState) => {
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
          const opItems = (collapseState: ItemCollapseState) => {
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
      const outsideInlineMetadata = stateManager.getSetting('inline-metadata-position') !== 'body';
      stateManager.setState((boardData) => {
        const collapseState = view.getViewState('item-collapse');
        const op = (collapseState: ItemCollapseState) => {
          const [laneIdx, itemIdx] = path;
          const newState = collapseState.map((inner) => [...inner]);
          newState[laneIdx][itemIdx] =
            (outsideInlineMetadata && item.data.metadata.inlineMetadata) ||
            item.data.metadata.fileMetadata
              ? false
              : undefined;
          return newState;
        };

        view.setViewState('item-collapse', undefined, op);
        return update<Board>(
          updateParentEntity(boardData, path, {
            children: {
              [path[path.length - 1]]: {
                $set: item,
              },
            },
          }),
          {
            data: { settings: { 'item-collapse': { $set: op(collapseState) } } },
          }
        );
      });
    },

    archiveItem: (path: Path) => {
      stateManager.setState((boardData) => {
        const item = getEntityFromPath(boardData, path);
        try {
          const collapseStateItems = view.getViewState('item-collapse');
          const opItems = (collapseState: ItemCollapseState) => {
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
          const collapseStateLanes = view.getViewState('list-collapse');
          const opLanes = (collapseState: boolean[]) => {
            const newState = [...collapseState];
            newState.splice(path.last(), 0, collapseState[path.last()]);
            return newState;
          };
          view.setViewState('list-collapse', undefined, opLanes);

          const collapseStateItems = view.getViewState('item-collapse');
          const opItems = (collapseState: ItemCollapseState) => {
            const newState = collapseState.map((inner) => [...inner]);
            newState.splice(path.last(), 0, collapseState[path.last()]);
            return newState;
          };
          view.setViewState('item-collapse', undefined, opItems);

          return update<Board>(insertEntity(boardData, path, [entityWithNewID]), {
            data: {
              settings: {
                'list-collapse': { $set: opLanes(collapseStateLanes) },
                'item-collapse': { $set: opItems(collapseStateItems) },
              },
            },
          });
        } else {
          // entity.type === DataTypes.Item
          const collapseState = view.getViewState('item-collapse');
          const op = (collapseState: ItemCollapseState) => {
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
