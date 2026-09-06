/**
 * ============================================================================
 * [실행 순서 #59] src/helpers/boardModifiers.ts — 카드/레인 추가·삭제·이동·아카이브 등 "보드 조작 API"(BoardModifiers)
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 사용자가 UI에서 "카드 추가", "레인 삭제", "카드를 맨 위로 이동", "아카이브" 같은 동작을 트리거할 때
 * 실제로 호출되는 함수 묶음을 만들어주는 팩토리 함수(getBoardModifiers)입니다.
 * 이 함수가 반환하는 BoardModifiers 객체는 #17 components/Kanban.tsx에서 생성되어 React Context를 통해
 * 하위 컴포넌트(카드, 레인 등)로 전달되므로, 트리 어디서든 Context로 꺼내 호출할 수 있습니다.
 * 내부 구현은 상태를 직접 mutate하지 않습니다 — #30 dnd/util/data.ts가 제공하는 "불변 갱신 빌더" 함수들
 * (appendEntities/insertEntity/removeEntity/moveEntity 등, 내부적으로 immutability-helper의 update()를 사용)을
 * 조합해 새로운 Board 객체를 만든 뒤, stateManager.setState(...)로 기존 상태를 통째로 교체하는 방식입니다.
 * ============================================================================
 */
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

// UI 컴포넌트들이 사용하는 "보드 조작" 함수들의 타입 시그니처. 실제 구현은 아래
// getBoardModifiers()가 반환하는 객체이며, React Context를 통해 하위 트리에 주입된다.
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

// view(KanbanView)와 stateManager(보드 상태 저장소)를 캡처한 클로저로 BoardModifiers 구현체를 생성한다.
// path는 항상 [레인 인덱스, (아이템 인덱스)] 형태의 배열로, 보드 트리 안에서 대상의 위치를 가리킨다.
export function getBoardModifiers(view: KanbanView, stateManager: StateManager): BoardModifiers {
  // 아이템을 아카이브할 때, 설정에 따라 제목(titleRaw) 앞/뒤에 날짜 문자열을 붙여주는 헬퍼.
  // 순수 함수형 헬퍼이며, 아래 archiveLane/archiveLaneItems/archiveItem에서 공통으로 재사용된다.
  const appendArchiveDate = (item: Item) => {
    const archiveDateFormat = stateManager.getSetting('archive-date-format');
    const archiveDateSeparator = stateManager.getSetting('archive-date-separator');
    const archiveDateAfterTitle = stateManager.getSetting('append-archive-date');

    // moment로 현재 시각을 설정된 포맷 문자열로 변환해 배열의 첫 항목으로 넣음
    const newTitle = [moment().format(archiveDateFormat)];

    if (archiveDateSeparator) newTitle.push(archiveDateSeparator);

    newTitle.push(item.data.titleRaw);

    // "날짜를 제목 뒤에 붙이기" 설정이면 배열 순서를 뒤집어 [제목, 구분자, 날짜] 순으로 만듦
    if (archiveDateAfterTitle) newTitle.reverse();

    const titleRaw = newTitle.join(' ');
    // 단순 문자열 치환이 아니라 stateManager를 통해 마크다운을 재파싱시켜 item의 파생 데이터(체크박스 등)도 갱신
    return stateManager.updateItemContent(item, titleRaw);
  };

  return {
    // path 위치(레인)의 children 배열 "끝"에 items를 추가한다.
    // appendEntities → 내부적으로 buildAppendMutation({ children: { $push: items } })를 만들어 update() 호출.
    appendItems: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) => appendEntities(boardData, path, items));
    },

    // path 위치(레인)의 children 배열 "맨 앞"에 items를 추가한다.
    // prependEntities → buildPrependMutation({ children: { $unshift: items } }).
    prependItems: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) => prependEntities(boardData, path, items));
    },

    // path가 가리키는 정확한 인덱스 위치에 items를 끼워 넣는다(드래그 드롭 등에서 사용).
    // insertEntity → buildInsertMutation({ children: { $splice: [[index, 0, ...items]] } }).
    insertItems: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) => insertEntity(boardData, path, items));
    },

    // "교체"는 immutability-helper에 전용 연산이 없으므로 제거(removeEntity) 후 같은 위치에
    // 다시 삽입(insertEntity)하는 두 단계 조합으로 구현한다. 카드 편집 후 내용을 통째로 바꿀 때 사용.
    replaceItem: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) =>
        insertEntity(removeEntity(boardData, path), path, items)
      );
    },

    // replaceItem과 완전히 동일한 조합(제거 후 재삽입)이지만, 카드 하나를 여러 개의 카드(items)로
    // "분리"할 때 의미상 구분하기 위해 별도 이름을 붙인 함수. items.length가 1보다 크면 카드가 늘어난다.
    splitItem: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) => {
        return insertEntity(removeEntity(boardData, path), path, items);
      });
    },

    // 아이템을 같은 레인의 맨 위(인덱스 0)로 이동. moveEntity(root, source, destination)는 내부에서
    // source 위치의 엔티티를 remove하고 destination 위치에 insert하는 mutation을 deepmerge로 합쳐
    // 한 번의 update() 호출로 원자적으로 적용한다.
    moveItemToTop: (path: Path) => {
      stateManager.setState((boardData) => moveEntity(boardData, path, [path[0], 0]));
    },

    // 아이템을 같은 레인의 맨 아래로 이동. 대상 레인의 현재 children 길이를 구해 그 값을 목적지 인덱스로 사용.
    moveItemToBottom: (path: Path) => {
      stateManager.setState((boardData) => {
        const laneIndex = path[0];
        const lane = boardData.children[laneIndex];
        return moveEntity(boardData, path, [laneIndex, lane.children.length]);
      });
    },

    // 새 레인을 보드 맨 끝에 추가한다. 보드 데이터(children)뿐 아니라, 레인별 "접힘 상태"를 담는
    // 뷰 상태 배열(list-collapse)도 같은 개수만큼 맞춰줘야 인덱스가 어긋나지 않으므로 두 가지를 함께 갱신한다.
    addLane: (lane: Lane) => {
      stateManager.setState((boardData) => {
        const collapseState = view.getViewState('list-collapse') || [];
        // 새 레인은 기본적으로 "펼쳐진" 상태(false)로 배열 끝에 추가
        const op = (collapseState: boolean[]) => {
          const newState = [...collapseState];
          newState.push(false);
          return newState;
        };

        // 뷰(로컬) 상태 갱신
        view.setViewState('list-collapse', undefined, op);
        // appendEntities로 레인 추가 후, immutability-helper update<Board>로 settings['list-collapse']도
        // 함께 갱신한 최종 Board 객체를 반환 → stateManager.setState가 이 값으로 상태를 교체
        return update<Board>(appendEntities(boardData, [], [lane]), {
          data: { settings: { 'list-collapse': { $set: op(collapseState) } } },
        });
      });
    },

    // addLane과 유사하지만 임의의 위치(path)에 레인을 삽입한다. collapse 상태 배열에도 같은 인덱스에
    // splice로 false를 끼워 넣어 레인 배열과 접힘상태 배열의 인덱스 정합성을 유지한다.
    insertLane: (path: Path, lane: Lane) => {
      stateManager.setState((boardData) => {
        const collapseState = view.getViewState('list-collapse');
        const op = (collapseState: boolean[]) => {
          const newState = [...collapseState];
          newState.splice(path.last(), 0, false);
          return newState;
        };

        view.setViewState('list-collapse', undefined, op);

        // insertEntity로 지정 위치에 레인 삽입 + settings['list-collapse'] 동시 갱신
        return update<Board>(insertEntity(boardData, path, [lane]), {
          data: { settings: { 'list-collapse': { $set: op(collapseState) } } },
        });
      });
    },

    // 레인의 메타데이터(제목, 설정 등)를 통째로 교체한다. updateParentEntity로 "부모(보드)까지만"
    // path를 따라 내려간 뒤, 그 자리에서 children[마지막 인덱스]를 새 lane 객체로 $set 한다.
    // (updateEntity와 달리 updateParentEntity는 path의 마지막 한 칸을 감싸지 않고 부모에서 멈춘다.)
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

    // 레인 전체를 아카이브(보관)한다: 레인을 보드에서 제거하고, 그 안에 있던 카드들을
    // board.data.archive 배열 맨 앞에 몰아넣는다. list-collapse 배열에서도 해당 인덱스를 제거해야 하므로
    // 세 가지 변경(레인 제거 / 접힘상태 제거 / 아카이브 추가)을 하나의 update() 호출에 모아서 적용한다.
    archiveLane: (path: Path) => {
      stateManager.setState((boardData) => {
        // getEntityFromPath: path를 따라 재귀적으로 children을 타고 내려가 대상 레인 엔티티를 찾음
        const lane = getEntityFromPath(boardData, path);
        const items = lane.children;

        try {
          const collapseState = view.getViewState('list-collapse');
          const op = (collapseState: boolean[]) => {
            const newState = [...collapseState];
            // 삭제되는 레인의 인덱스에 해당하는 접힘상태 한 칸을 배열에서 제거
            newState.splice(path.last(), 1);
            return newState;
          };
          view.setViewState('list-collapse', undefined, op);

          // removeEntity로 레인 자체를 보드에서 제거한 결과 위에, settings['list-collapse']와
          // data.archive 두 필드를 immutability-helper spec으로 한 번에 갱신
          return update<Board>(removeEntity(boardData, path), {
            data: {
              settings: { 'list-collapse': { $set: op(collapseState) } },
              archive: {
                // 설정에 따라 아카이브되는 카드 제목에 날짜를 붙일지 결정 후, 배열 맨 앞에 몰아넣음($unshift)
                $unshift: stateManager.getSetting('archive-with-date')
                  ? items.map(appendArchiveDate)
                  : items,
              },
            },
          });
        } catch (e) {
          // 아카이브 처리 중 예외가 나면 상태 변경을 포기하고 원본 boardData를 그대로 반환(롤백 효과)
          stateManager.setError(e);
          return boardData;
        }
      });
    },

    // archiveLane과 달리 레인 자체는 보드에 남기고, 레인 안의 카드들만 비워서 아카이브로 보낸다.
    archiveLaneItems: (path: Path) => {
      stateManager.setState((boardData) => {
        const lane = getEntityFromPath(boardData, path);
        const items = lane.children;

        try {
          return update(
            // updateEntity로 해당 레인의 children을 빈 배열로 교체($set: [])
            updateEntity(boardData, path, {
              children: {
                $set: [],
              },
            }),
            {
              data: {
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

    // 레인 또는 아이템을 (아카이브를 거치지 않고) 완전히 삭제한다.
    // 대상이 Lane이면 list-collapse 배열도 함께 정리해야 하므로 분기 처리한다.
    deleteEntity: (path: Path) => {
      stateManager.setState((boardData) => {
        const entity = getEntityFromPath(boardData, path);

        if (entity.type === DataTypes.Lane) {
          const collapseState = view.getViewState('list-collapse');
          const op = (collapseState: boolean[]) => {
            const newState = [...collapseState];
            newState.splice(path.last(), 1);
            return newState;
          };
          view.setViewState('list-collapse', undefined, op);

          return update<Board>(removeEntity(boardData, path), {
            data: { settings: { 'list-collapse': { $set: op(collapseState) } } },
          });
        }

        // 아이템 삭제는 접힘상태와 무관하므로 removeEntity 한 번으로 충분
        return removeEntity(boardData, path);
      });
    },

    // 카드(아이템)의 내용을 통째로 교체한다. updateLane과 동일한 패턴이지만 대상이 Item이라는 점만 다르다.
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

    // 카드 하나를 아카이브한다: 보드에서 제거하고 archive 배열 맨 "뒤"에 추가($push, 레인 아카이브의
    // $unshift와 달리 순서상 뒤에 쌓는다는 차이가 있음).
    archiveItem: (path: Path) => {
      stateManager.setState((boardData) => {
        const item = getEntityFromPath(boardData, path);
        try {
          return update(removeEntity(boardData, path), {
            data: {
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

    // 레인 또는 아이템을 복제한다: 원본을 찾아 id만 새로 발급한 사본을 만든 뒤, 원본 바로 옆(같은 path)에
    // 삽입한다. 레인일 경우 접힘 상태도 원본과 동일하게 복제해 삽입 위치에 끼워 넣는다.
    duplicateEntity: (path: Path) => {
      stateManager.setState((boardData) => {
        const entity = getEntityFromPath(boardData, path);
        // immutability-helper의 update()로 entity를 얕은 복사하면서 id 필드만 새 값으로 교체
        const entityWithNewID = update(entity, {
          id: {
            $set: generateInstanceId(),
          },
        });

        if (entity.type === DataTypes.Lane) {
          const collapseState = view.getViewState('list-collapse');
          const op = (collapseState: boolean[]) => {
            const newState = [...collapseState];
            // 복제된 레인의 접힘 상태는 원본과 동일한 값을 그대로 복사해 원본 옆에 삽입
            newState.splice(path.last(), 0, collapseState[path.last()]);
            return newState;
          };
          view.setViewState('list-collapse', undefined, op);

          return update<Board>(insertEntity(boardData, path, [entityWithNewID]), {
            data: { settings: { 'list-collapse': { $set: op(collapseState) } } },
          });
        }

        // 아이템 복제는 접힘상태와 무관하므로 insertEntity 한 번으로 충분
        return insertEntity(boardData, path, [entityWithNewID]);
      });
    },
  };
}
