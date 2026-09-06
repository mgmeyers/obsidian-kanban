/**
 * ============================================================================
 * [실행 순서 #67] src/components/Lane/LaneMenu.tsx — 레인 메뉴 버튼을 눌렀을 때 나오는
 *                  컨텍스트 메뉴(정렬, 아카이브, 삭제 등)
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * 이 파일은 두 가지를 내보낸다: (1) 레인 삭제/보관 전 "정말 실행하시겠습니까?"를 묻는
 * `ConfirmAction` 컴포넌트, (2) obsidian의 네이티브 `Menu` API로 "더보기(⋮)" 버튼 클릭 시
 * 뜨는 컨텍스트 메뉴(편집/카드 보관/앞뒤에 리스트 삽입/보관/삭제/정렬 하위메뉴)를 만들어주는
 * `useSettingsMenu` 훅이다. #64(LaneHeader.tsx)가 이 훅과 컴포넌트를 가져다 사용한다.
 * #18(components/context.ts)의 `KanbanContext`에서 `stateManager`(태그 정렬 순서 등 설정 조회)와
 * `boardModifiers`(레인 삽입·정렬 결과 반영)를 useContext로 꺼내 쓰며, obsidian `Menu` 객체 자체는
 * Preact 컴포넌트가 아니라 명령형(imperative) API이므로 useMemo로 한 번 만들어 재사용한다.
 * ============================================================================
 */
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

// 확인이 필요한 파괴적 동작의 종류. null이면 "확인 대기 중인 동작 없음"을 의미.
export type LaneAction = 'delete' | 'archive' | 'archive-items' | null;

// 각 동작에 대응하는 확인 문구/버튼 라벨을 미리 정의해둔 테이블. t()는 i18n 번역 헬퍼.
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

// 삭제/보관 같은 파괴적 동작을 실행하기 전에 보여주는 확인 배너 컴포넌트.
// #64 LaneHeader가 confirmAction 상태가 설정되어 있을 때 이 컴포넌트를 렌더링한다.
export function ConfirmAction({ action, cancel, onAction, lane }: ConfirmActionProps) {
  // 레인에 카드가 하나도 없다면 사용자에게 굳이 확인을 묻지 않고 바로 동작을 실행한다.
  // 의존성 배열에 action과 lane.children.length를 명시해, 둘 중 하나라도 바뀌면 재검사한다.
  useEffect(() => {
    // Immediately execute action if lane is empty
    if (action && lane.children.length === 0) {
      onAction();
    }
  }, [action, lane.children.length]);

  // action이 없거나(대기 상태), 위 useEffect에서 이미 즉시 실행된 "빈 레인" 케이스라면
  // 아무것도 렌더링하지 않는다(다음 렌더에서 자연스럽게 사라짐).
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

// #64 LaneHeader가 호출하는 커스텀 훅. obsidian의 명령형 Menu API를 이용해 레인용 컨텍스트
// 메뉴를 구성하고, 삭제/보관 확인 상태(confirmAction)를 함께 관리해 반환한다.
export function useSettingsMenu({ setEditState, path, lane }: UseSettingsMenuParams) {
  // #18 KanbanContext에서 stateManager(설정 조회)와 boardModifiers(레인 삽입·정렬 반영)를 꺼낸다.
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const [confirmAction, setConfirmAction] = useState<LaneAction>(null);

  // obsidian Menu 인스턴스는 매번 새로 만들면 비용이 크고 참조도 불안정하므로 useMemo로 캐싱한다.
  // 의존성 배열([stateManager, setConfirmAction, path, lane])이 바뀔 때만 메뉴를 새로 빌드한다.
  // (주의: lane.children 내부 값이 바뀌어도 lane 객체 참조 자체가 바뀌지 않으면 재계산되지
  //  않을 수 있으나, immutability-helper로 불변 갱신되는 구조상 보통 lane 참조도 함께 바뀐다.)
  const settingsMenu = useMemo(() => {
    // 정렬 하위 메뉴에 "메타데이터 값별 정렬" 옵션을 추가하기 위해, 이 레인의 카드들이
    // 어떤 인라인 메타데이터 키를 가지고 있는지, 날짜/태그를 가진 카드가 있는지를 미리 스캔한다.
    const metadataSortOptions = new Set<string>();
    let canSortDate = false;
    let canSortTags = false;

    lane.children.forEach((item) => {
      const taskData = item.data.metadata.inlineMetadata;
      if (taskData) {
        taskData.forEach((m) => {
          if (m.key === 'repeat') return; // 반복 일정 메타는 정렬 기준에서 제외
          if (!metadataSortOptions.has(m.key)) metadataSortOptions.add(m.key);
        });
      }

      if (!canSortDate && item.data.metadata.date) canSortDate = true;
      if (!canSortTags && item.data.metadata.tags?.length) canSortTags = true;
    });

    // obsidian Menu는 메서드 체이닝으로 항목을 추가하는 빌더 패턴 API.
    const menu = new Menu()
      .addItem((item) => {
        item
          .setIcon('lucide-edit-3')
          .setTitle(t('Edit list'))
          .onClick(() => setEditState({ x: 0, y: 0 })); // 제목 편집 모드 열기
      })
      .addItem((item) => {
        item
          .setIcon('lucide-archive')
          .setTitle(t('Archive cards'))
          .onClick(() => setConfirmAction('archive-items')); // 카드만 보관(레인 자체는 유지)
      })
      .addSeparator()
      .addItem((i) => {
        // "앞에 리스트 삽입": 현재 경로(path) 위치에 빈 레인을 새로 끼워 넣고, 강제 편집 모드로 시작
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
                forceEditMode: true, // #64의 useEffect가 이 플래그를 보고 자동으로 편집 모드를 연다
              },
            })
          );
      })
      .addItem((i) => {
        // "뒤에 리스트 삽입": path의 마지막 인덱스에 +1 해서 바로 다음 위치에 삽입
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
          .onClick(() => setConfirmAction('archive')); // 레인 전체 보관 — 확인 다이얼로그를 먼저 띄움
      })
      .addItem((item) => {
        item
          .setIcon('lucide-trash-2')
          .setTitle(t('Delete list'))
          .onClick(() => setConfirmAction('delete')); // 레인 전체 삭제 — 확인 다이얼로그를 먼저 띄움
      })
      .addSeparator();

    // "정렬 방식" 하위 메뉴들을 실제로 채워 넣는 헬퍼 함수. 모바일(Platform.isPhone)에서는
    // 하위 메뉴 UX가 불편하므로 최상위 메뉴에 바로 펼쳐 넣고, 데스크톱에서는 서브메뉴로 감싼다.
    const addSortOptions = (menu: Menu) => {
      // 1) 카드 텍스트(제목) 기준 정렬 — 클릭할 때마다 오름차순/내림차순을 토글
      menu.addItem((item) => {
        item
          .setIcon('arrow-down-up')
          .setTitle(t('Sort by card text'))
          .onClick(() => {
            const children = lane.children.slice(); // 원본 배열을 변경하지 않기 위해 복사
            const isAsc = lane.data.sorted === LaneSort.TitleAsc;

            children.sort((a, b) => {
              if (isAsc) {
                return b.data.title.localeCompare(a.data.title);
              }

              return a.data.title.localeCompare(b.data.title);
            });

            // boardModifiers.updateLane으로 정렬된 children 배열과 새 sorted 상태를
            // immutability-helper(update)를 이용해 불변 방식으로 반영한다.
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

      // 2) 날짜 기준 정렬 — 날짜/시간이 있는 카드만 이 옵션이 노출된다(canSortDate).
      if (canSortDate) {
        menu.addItem((item) => {
          item
            .setIcon('arrow-down-up')
            .setTitle(t('Sort by date'))
            .onClick(() => {
              const children = lane.children.slice();
              const mod = lane.data.sorted === LaneSort.DateAsc ? -1 : 1; // 토글 방향 계수(+1/-1)

              children.sort((a, b) => {
                const aDate: moment.Moment | undefined =
                  a.data.metadata.time || a.data.metadata.date;
                const bDate: moment.Moment | undefined =
                  b.data.metadata.time || b.data.metadata.date;

                // 날짜가 없는 카드는 항상 뒤로 보내고, 둘 다 없으면 순서를 유지(0)
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

      // 3) 태그 기준 정렬 — 태그가 있는 카드가 하나라도 있을 때만 노출(canSortTags).
      //    사용자가 설정한 태그 우선순위(tag-sort)를 고려해 정렬한다.
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

                // 태그가 없는 카드는 뒤로 보낸다
                if (!tagsA?.length && !tagsB?.length) return 0;
                if (!tagsA?.length) return 1;
                if (!tagsB?.length) return -1;

                // tagSortOrder(설정에서 지정한 태그 우선순위 목록)에서의 위치를 찾아 비교
                const aSortOrder =
                  tagSortOrder?.findIndex((sort) => tagsA.includes(sort.tag)) ?? -1;
                const bSortOrder =
                  tagSortOrder?.findIndex((sort) => tagsB.includes(sort.tag)) ?? -1;

                if (aSortOrder > -1 && bSortOrder < 0) return desc ? 1 : -1;
                if (bSortOrder > -1 && aSortOrder < 0) return desc ? -1 : 1;
                if (aSortOrder > -1 && bSortOrder > -1) {
                  return desc ? bSortOrder - aSortOrder : aSortOrder - bSortOrder;
                }

                // 우선순위 목록에 없는 태그끼리는 문자열 기본 정렬(defaultSort)로 비교
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

      // 4) 인라인 메타데이터(예: 우선순위, 사용자 정의 필드 등) 값 기준 정렬 — 발견된 각 키마다
      //    별도의 메뉴 항목을 동적으로 생성한다.
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

                  // 해당 메타데이터 키가 없는 카드는 뒤로 보낸다
                  if (valA === undefined && valB === undefined) return 0;
                  if (valA === undefined) return 1;
                  if (valB === undefined) return -1;

                  // anyToString으로 값(문자열/숫자/날짜 등)을 비교 가능한 문자열로 변환 후 정렬
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

    // 모바일에서는 서브메뉴 UX가 불편하므로 정렬 옵션들을 최상위 메뉴에 바로 펼쳐 추가하고,
    // 데스크톱에서는 "Sort by" 항목 아래에 서브메뉴(setSubmenu)로 중첩시킨다.
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

  // 완성된 Menu 인스턴스와 확인 다이얼로그 상태를 호출부(#64 LaneHeader)에 반환.
  return {
    settingsMenu,
    confirmAction,
    setConfirmAction,
  };
}
