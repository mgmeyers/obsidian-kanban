/**
 * ============================================================================
 * [실행 순서 #73] src/components/Item/ItemMenu.ts — 카드 우클릭/"..." 메뉴 생성 로직
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 카드를 우클릭하거나 #74 ItemMenuButton.tsx의 "..." 버튼을 클릭했을 때 뜨는 Obsidian
 * 네이티브 Menu(카드 편집, 새 노트로 분리, 링크 복사, 카드 분할, 복제, 위/아래 삽입,
 * 맨 위/아래로 이동, 아카이브, 삭제, 날짜/시간 추가·수정·삭제, 다른 리스트로 이동 등)를
 * 구성하는 훅(useCallback 기반 팩토리 함수) useItemMenu를 정의한다. 각 메뉴 항목의
 * onClick 핸들러는 대부분 boardModifiers(#72와 동일하게 사용되는 불변 상태 변경 함수
 * 모음)를 호출해 실제 보드 데이터를 바꾸며, 화면에 보이는 메뉴 UI 자체는 Obsidian이
 * 제공하는 Menu 클래스의 체이닝 API(addItem/addSeparator/setIcon/setTitle/onClick)로
 * 선언적으로 구성된다.
 * ============================================================================
 */
import update from 'immutability-helper';
import { Menu, Platform, TFile, TFolder } from 'obsidian';
import { Dispatch, StateUpdater, useCallback } from 'preact/hooks';
import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import { moveEntity } from 'src/dnd/util/data';
import { t } from 'src/lang/helpers';

import { BoardModifiers } from '../../helpers/boardModifiers';
import { applyTemplate, escapeRegExpStr, generateInstanceId } from '../helpers';
import { EditState, Item } from '../types';
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
  constructMenuTimePickerOnChange,
  constructTimePicker,
} from './helpers';

// "새 노트로 만들기" 시 파일명으로 쓸 수 없는 마크다운 문법/특수문자를 제거하기 위한 정규식들.
// illegalCharsRegEx: 파일 시스템에서 금지된 문자(\ / : " * ? < > |)
const illegalCharsRegEx = /[\\/:"*?<>|]+/g;
// embedRegEx: ![[파일명.확장자]] 형태의 임베드 링크에서 표시 이름만 추출
const embedRegEx = /!?\[\[([^\]]*)\.[^\]]+\]\]/g;
// wikilinkRegEx: [[위키링크]] 형태에서 대괄호를 제거
const wikilinkRegEx = /!?\[\[([^\]]*)\]\]/g;
// mdLinkRegEx: [텍스트](url) 형태의 마크다운 링크에서 텍스트만 추출
const mdLinkRegEx = /!?\[([^\]]*)\]\([^)]*\)/g;
// tagRegEx: #태그 문자열에서 '#'을 제거(유니코드 구두점/공백을 태그 구분자로 취급)
const tagRegEx = /#([^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~[\]\\\s\n\r]+)/g;
// condenceWhiteSpaceRE: 연속된 공백을 하나로 축약
const condenceWhiteSpaceRE = /\s+/g;

// useItemMenu 훅에 전달되는 파라미터 타입
interface UseItemMenuParams {
  setEditState: Dispatch<StateUpdater<EditState>>; // 카드를 인라인 편집 모드로 전환하는 setState
  item: Item; // 메뉴를 여는 대상 카드
  path: Path; // 보드 트리에서 이 카드의 위치 경로
  boardModifiers: BoardModifiers; // 보드 상태를 변경하는 함수 모음(각 메뉴 항목이 실제로 호출하는 대상)
  stateManager: StateManager; // 보드 데이터/설정/파일 접근을 담당하는 중앙 관리자
}

/**
 * 카드에 대한 컨텍스트 메뉴(우클릭 메뉴, "..." 버튼 메뉴)를 만드는 커스텀 훅.
 * 반환값은 MouseEvent를 받아 메뉴를 화면에 띄우는 함수이며, Preact의 useCallback으로
 * 감싸져 있어 의존성 배열의 값이 바뀌지 않는 한 동일한 함수 참조를 유지한다
 * (자식 컴포넌트의 불필요한 리렌더를 막기 위함).
 */
export function useItemMenu({
  setEditState,
  item,
  path,
  boardModifiers,
  stateManager,
}: UseItemMenuParams) {
  return useCallback(
    (e: MouseEvent) => {
      // 메뉴를 띄울 화면 좌표(클릭한 마우스 위치)를 저장. 이후 "카드 편집" 항목이나
      // 날짜/시간 피커를 같은 좌표에 띄우는 데 재사용된다.
      const coordinates = { x: e.clientX, y: e.clientY };
      // 이 카드에 이미 날짜/시간 메타데이터가 있는지 여부(있으면 "수정", 없으면 "추가" 문구로 분기)
      const hasDate = !!item.data.metadata.date;
      const hasTime = !!item.data.metadata.time;

      // new Menu(): Obsidian이 제공하는 네이티브 컨텍스트 메뉴 객체를 생성한다.
      // .addItem(callback): 메뉴 항목을 하나 추가하며, 콜백 인자로 MenuItem 빌더(i)를 넘겨준다.
      //   i.setIcon(iconId) → i.setTitle(text) → i.onClick(handler) 순으로 메서드 체이닝하여
      //   "아이콘 설정 → 표시 텍스트 설정 → 클릭 핸들러 등록"을 한 줄로 선언한다.
      //   addItem은 Menu 인스턴스 자신을 반환하므로 이어서 .addItem(...).addItem(...)처럼
      //   계속 체이닝할 수 있다(플루언트 빌더 패턴).
      const menu = new Menu().addItem((i) => {
        // "카드 편집": 별도의 boardModifiers 호출 없이, 이 카드를 인라인 편집 모드로 전환한다.
        // setEditState에 클릭 좌표를 넘겨 편집 UI가 해당 위치 기준으로 나타나게 한다.
        i.setIcon('lucide-edit')
          .setTitle(t('Edit card'))
          .onClick(() => setEditState(coordinates));
      });

      menu
        .addItem((i) => {
          // "카드에서 새 노트 만들기": 카드 제목을 새 마크다운 파일로 분리하고,
          // 원래 카드 텍스트는 그 새 파일로 향하는 링크로 치환한다.
          i.setIcon('lucide-file-plus-2')
            .setTitle(t('New note from card'))
            .onClick(async () => {
              // 카드 제목(titleRaw)의 첫 줄만 취해 새 노트의 제목 후보로 사용한다.
              const prevTitle = item.data.titleRaw.split('\n')[0].trim();
              // 위에서 정의한 정규식들을 순서대로 적용해 임베드/위키링크/마크다운링크/태그/
              // 파일명 금지 문자를 제거하고 공백을 정리해 파일 시스템에 안전한 제목을 만든다.
              const sanitizedTitle = prevTitle
                .replace(embedRegEx, '$1')
                .replace(wikilinkRegEx, '$1')
                .replace(mdLinkRegEx, '$1')
                .replace(tagRegEx, '$1')
                .replace(illegalCharsRegEx, ' ')
                .trim()
                .replace(condenceWhiteSpaceRE, ' ');

              // 플러그인 설정에서 "새 노트 저장 폴더"와 "새 노트 템플릿 경로"를 읽어온다.
              const newNoteFolder = stateManager.getSetting('new-note-folder');
              const newNoteTemplatePath = stateManager.getSetting('new-note-template');

              // 설정된 폴더가 있으면 그 폴더를, 없으면 Obsidian의 기본 규칙(현재 파일 기준
              // "새 파일을 만들 부모 폴더")을 사용해 대상 폴더를 결정한다.
              const targetFolder = newNoteFolder
                ? (stateManager.app.vault.getAbstractFileByPath(newNoteFolder as string) as TFolder)
                : stateManager.app.fileManager.getNewFileParent(stateManager.file.path);

              // Obsidian 내부 API(createNewMarkdownFile)로 실제 새 마크다운 파일을 생성한다.
              // 타입에 아직 공식 노출되지 않은 API라 (as any)로 우회 호출한다.
              const newFile = (await (stateManager.app.fileManager as any).createNewMarkdownFile(
                targetFolder,
                sanitizedTitle
              )) as TFile;

              // 현재 활성 탭을 분할해 새 리프(leaf, 편집 영역)를 만들고 그 안에 새 파일을 연다.
              const newLeaf = stateManager.app.workspace.splitActiveLeaf();

              await newLeaf.openFile(newFile);

              // 새로 연 리프를 활성 리프로 지정한다(포커스 이동, 히스토리 기록 등 처리).
              stateManager.app.workspace.setActiveLeaf(newLeaf, false, true);

              // 설정된 템플릿이 있다면 새 노트에 적용한다(템플릿 플러그인 연동 헬퍼).
              await applyTemplate(stateManager, newNoteTemplatePath as string | undefined);

              // 원래 카드 텍스트에서 첫 줄(prevTitle)을, 새로 만든 파일을 가리키는
              // 마크다운 링크로 치환한 새 titleRaw를 만든다.
              const newTitleRaw = item.data.titleRaw.replace(
                prevTitle,
                stateManager.app.fileManager.generateMarkdownLink(newFile, stateManager.file.path)
              );

              // boardModifiers.updateItem: 이 카드(path 위치)를 새 텍스트로 갱신한 Item으로 교체한다.
              boardModifiers.updateItem(path, stateManager.updateItemContent(item, newTitleRaw));
            });
        })
        .addItem((i) => {
          // "카드 링크 복사": 이 카드를 블록 참조(^blockId)로 가리키는 마크다운 링크를
          // 클립보드에 복사한다. boardModifiers 호출 없이 끝날 수도 있고(이미 blockId가 있는 경우),
          // 없는 경우에는 새 블록 ID를 생성해 카드에 기록한다.
          i.setIcon('lucide-link')
            .setTitle(t('Copy link to card'))
            .onClick(() => {
              if (item.data.blockId) {
                // 이미 블록 ID가 있으면 그것으로 링크를 만들어 그대로 클립보드에 복사한다.
                navigator.clipboard.writeText(
                  `${this.app.fileManager.generateMarkdownLink(
                    stateManager.file,
                    '',
                    '#^' + item.data.blockId
                  )}`
                );
              } else {
                // 블록 ID가 없으면 6자리 임의 ID를 새로 생성한다.
                const id = generateInstanceId(6);

                navigator.clipboard.writeText(
                  `${this.app.fileManager.generateMarkdownLink(stateManager.file, '', '#^' + id)}`
                );

                // boardModifiers.updateItem: 새로 만든 blockId를 카드 데이터에 저장하고,
                // 카드 텍스트(titleRaw)는 그대로 유지한 채 내용을 갱신한다(블록 참조가
                // 실제 마크다운 파일에도 반영되도록).
                boardModifiers.updateItem(
                  path,
                  stateManager.updateItemContent(
                    update(item, { data: { blockId: { $set: id } } }),
                    item.data.titleRaw
                  )
                );
              }
            });
        })
        // addSeparator(): 메뉴 항목 사이에 구분선을 그어 그룹을 시각적으로 나눈다.
        .addSeparator();

      // 카드 제목에 줄바꿈이 있는(여러 줄로 된) 경우에만 "카드 분할" 메뉴 항목을 조건부로 추가한다.
      // Menu API는 이렇게 매 addItem 호출을 조건문으로 감싸 동적으로 메뉴 구성을 바꿀 수 있다.
      if (/\n/.test(item.data.titleRaw)) {
        menu.addItem((i) => {
          i.setIcon('lucide-wrap-text')
            .setTitle(t('Split card'))
            .onClick(async () => {
              // 줄바꿈 기준으로 제목을 여러 줄로 나누고 각 줄의 앞뒤 공백을 제거한다.
              const titles = item.data.titleRaw.split(/[\r\n]+/g).map((t) => t.trim());
              // 각 줄을 새로운 독립 카드(Item)로 파싱한다. 체크 문자는 모두 ' '(미완료)로 시작.
              const newItems = await Promise.all(
                titles.map((title) => {
                  return stateManager.getNewItem(title, ' ');
                })
              );

              // boardModifiers.splitItem: 기존 카드 한 개를 여러 개의 새 카드로 교체(분할)한다.
              boardModifiers.splitItem(path, newItems);
            });
        });
      }

      menu
        .addItem((i) => {
          // "카드 복제": boardModifiers.duplicateEntity가 새로운 id를 부여한 사본을
          // 같은 위치 바로 옆(또는 아래)에 삽입한다.
          i.setIcon('lucide-copy')
            .setTitle(t('Duplicate card'))
            .onClick(() => boardModifiers.duplicateEntity(path));
        })
        .addItem((i) => {
          // "이 카드 앞에 삽입": 빈 카드를 현재 카드와 같은 path 위치에 삽입해
          // 결과적으로 현재 카드 바로 위(앞)에 새 빈 카드가 생기게 한다.
          i.setIcon('lucide-list-start')
            .setTitle(t('Insert card before'))
            .onClick(() =>
              boardModifiers.insertItems(path, [stateManager.getNewItem('', ' ', true)])
            );
        })
        .addItem((i) => {
          // "이 카드 뒤에 삽입": path를 복사한 뒤 마지막 인덱스(카드 위치)를 1 증가시켜
          // 현재 카드 바로 다음 자리를 가리키는 newPath를 만들고, 그 위치에 빈 카드를 삽입한다.
          i.setIcon('lucide-list-end')
            .setTitle(t('Insert card after'))
            .onClick(() => {
              const newPath = [...path];

              newPath[newPath.length - 1] = newPath[newPath.length - 1] + 1;

              boardModifiers.insertItems(newPath, [stateManager.getNewItem('', ' ', true)]);
            });
        })
        .addItem((i) => {
          // "맨 위로 이동": boardModifiers.moveItemToTop이 같은 레인 안에서 인덱스 0으로 옮긴다.
          i.setIcon('lucide-arrow-up')
            .setTitle(t('Move to top'))
            .onClick(() => boardModifiers.moveItemToTop(path));
        })
        .addItem((i) => {
          // "맨 아래로 이동": boardModifiers.moveItemToBottom이 같은 레인의 마지막 인덱스로 옮긴다.
          i.setIcon('lucide-arrow-down')
            .setTitle(t('Move to bottom'))
            .onClick(() => boardModifiers.moveItemToBottom(path));
        })
        .addItem((i) => {
          // "카드 아카이브": boardModifiers.archiveItem이 카드를 보드에서 제거하고
          // 보드 데이터의 archive 배열 끝에 추가한다(#72 ItemCheckbox의 아카이브 버튼과 동일한 동작).
          i.setIcon('lucide-archive')
            .setTitle(t('Archive card'))
            .onClick(() => boardModifiers.archiveItem(path));
        })
        .addItem((i) => {
          // "카드 삭제": boardModifiers.deleteEntity가 이 경로의 엔티티(카드)를 완전히 제거한다.
          i.setIcon('lucide-trash-2')
            .setTitle(t('Delete card'))
            .onClick(() => boardModifiers.deleteEntity(path));
        })
        .addSeparator()
        .addItem((i) => {
          // "날짜 추가/수정": hasDate 값에 따라 메뉴 제목이 "Add date" 또는 "Edit date"로 바뀐다.
          i.setIcon('lucide-calendar-check')
            .setTitle(hasDate ? t('Edit date') : t('Add date'))
            .onClick(() => {
              // constructDatePicker: flatpickr 기반 날짜 선택 팝업을 클릭 좌표 위치에 띄운다.
              // 다섯 번째 인자(onChange)로 constructMenuDatePickerOnChange가 만들어준 콜백을
              // 전달하는데, 이 콜백이 실제로 boardModifiers.updateItem을 호출해 카드 텍스트에
              // 날짜 트리거 문자열을 삽입/치환한다.
              constructDatePicker(
                e.view,
                stateManager,
                coordinates,
                constructMenuDatePickerOnChange({
                  stateManager,
                  boardModifiers,
                  item,
                  hasDate,
                  path,
                }),
                item.data.metadata.date?.toDate()
              );
            });
        });

      // 날짜가 이미 있는 카드에서만 "날짜 제거", "시간 추가/수정" 항목을 추가로 노출한다.
      if (hasDate) {
        menu.addItem((i) => {
          // "날짜 제거": 정규식으로 카드 텍스트에서 날짜 트리거 패턴을 찾아 제거한다.
          i.setIcon('lucide-x')
            .setTitle(t('Remove date'))
            .onClick(() => {
              // 설정에 따라 날짜가 데일리 노트 링크 형식([[...]] 또는 [텍스트](링크))인지,
              // 아니면 중괄호({...}) 형식인지에 맞는 정규식 조각을 고른다.
              const shouldLinkDates = stateManager.getSetting('link-date-to-daily-note');
              const dateTrigger = stateManager.getSetting('date-trigger');
              const contentMatch = shouldLinkDates
                ? '(?:\\[[^\\]]+\\]\\([^\\)]+\\)|\\[\\[[^\\]]+\\]\\])'
                : '{[^}]+}';
              // escapeRegExpStr로 트리거 문자열(예: '@', '#date' 등)에 있을 수 있는 정규식
              // 특수문자를 이스케이프한 뒤 최종 날짜 매칭 정규식을 조립한다.
              const dateRegEx = new RegExp(
                `(^|\\s)${escapeRegExpStr(dateTrigger as string)}${contentMatch}`
              );

              // 매칭된 날짜 트리거 문자열을 제거하고 양끝 공백을 정리한다.
              const titleRaw = item.data.titleRaw.replace(dateRegEx, '').trim();

              // boardModifiers.updateItem으로 정리된 텍스트를 카드에 반영한다.
              boardModifiers.updateItem(path, stateManager.updateItemContent(item, titleRaw));
            });
        });

        menu.addItem((i) => {
          // "시간 추가/수정": hasTime 여부에 따라 제목 문구가 바뀐다.
          i.setIcon('lucide-clock')
            .setTitle(hasTime ? t('Edit time') : t('Add time'))
            .onClick(() => {
              // constructTimePicker: 시간 선택 팝업을 띄우고, 값이 바뀌면
              // constructMenuTimePickerOnChange가 만든 콜백이 boardModifiers.updateItem을
              // 호출해 카드 텍스트의 시간 트리거 문자열을 갱신한다.
              constructTimePicker(
                e.view,
                stateManager,
                coordinates,
                constructMenuTimePickerOnChange({
                  stateManager,
                  boardModifiers,
                  item,
                  hasTime,
                  path,
                }),
                item.data.metadata.time
              );
            });
        });

        // 시간까지 이미 설정돼 있는 경우에만 "시간 제거" 항목을 추가한다(날짜가 있어야 시간도 있을 수 있는 구조).
        if (hasTime) {
          menu.addItem((i) => {
            i.setIcon('lucide-x')
              .setTitle(t('Remove time'))
              .onClick(() => {
                // 시간 트리거 문자열({...} 형태)을 찾는 정규식을 조립해 제거한다.
                const timeTrigger = stateManager.getSetting('time-trigger');
                const timeRegEx = new RegExp(
                  `(^|\\s)${escapeRegExpStr(timeTrigger as string)}{([^}]+)}`
                );

                const titleRaw = item.data.titleRaw.replace(timeRegEx, '').trim();
                boardModifiers.updateItem(path, stateManager.updateItemContent(item, titleRaw));
              });
          });
        }
      }

      menu.addSeparator();

      // "다른 리스트(레인)로 이동" 메뉴를 구성하는 내부 헬퍼 함수.
      // 전달받은 menu(최상위 메뉴일 수도, 서브메뉴일 수도 있음)에 각 레인을 항목으로 추가한다.
      const addMoveToOptions = (menu: Menu) => {
        const lanes = stateManager.state.children;
        // 레인이 하나 이하면(이동할 곳이 없으면) 아무 항목도 추가하지 않고 종료한다.
        if (lanes.length <= 1) return;
        for (let i = 0, len = lanes.length; i < len; i++) {
          menu.addItem((item) =>
            item
              .setIcon('lucide-square-kanban')
              // setChecked: 현재 카드가 속한 레인(path[0]과 인덱스가 같은 경우)에는
              // 체크 표시(선택됨 표시)를 보여준다.
              .setChecked(path[0] === i)
              .setTitle(lanes[i].data.title)
              .onClick(() => {
                // 이미 같은 레인이면 아무 동작도 하지 않는다.
                if (path[0] === i) return;
                // stateManager.setState + moveEntity: 보드 데이터를 직접 조작해
                // 이 카드를 i번째 레인의 맨 앞(인덱스 0)으로 이동시킨다.
                // (boardModifiers를 거치지 않고 stateManager.setState를 직접 호출하는 예외적인 경로)
                stateManager.setState((boardData) => {
                  return moveEntity(boardData, path, [i, 0]);
                });
              })
          );
        }
      };

      // 모바일(폰)에서는 서브메뉴(중첩 메뉴)가 조작하기 불편하므로, 레인 목록을
      // 최상위 메뉴에 바로 펼쳐서 보여준다.
      if (Platform.isPhone) {
        addMoveToOptions(menu);
      } else {
        // 데스크톱에서는 "Move to list"라는 하나의 항목 아래에 서브메뉴를 만들어 그 안에 레인 목록을 넣는다.
        menu.addItem((item) => {
          // setSubmenu(): 이 메뉴 항목에 마우스를 올리면 펼쳐지는 하위 Menu 인스턴스를 생성해 반환한다.
          // 타입 정의에 아직 없는 API라 (item as any)로 캐스팅해 호출한다.
          const submenu = (item as any)
            .setTitle(t('Move to list'))
            .setIcon('lucide-square-kanban')
            .setSubmenu();

          addMoveToOptions(submenu);
        });
      }

      // showAtPosition: 지금까지 구성한 메뉴를 클릭했던 좌표(coordinates) 위치에 실제로 표시한다.
      menu.showAtPosition(coordinates);
    },
    // useCallback 의존성 배열: 이 값들 중 하나라도 바뀌면 메뉴를 여는 함수를 새로 생성한다.
    [setEditState, item, path, boardModifiers, stateManager]
  );
}
