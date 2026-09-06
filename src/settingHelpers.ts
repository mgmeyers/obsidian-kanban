/**
 * ============================================================================
 * [실행 순서 #6] src/settingHelpers.ts — 설정 UI 공용 헬퍼 & date/time-trigger 기본값 상수
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화 / 실행-상호작용
 * 이 파일은 Obsidian Vault(볼트) 안의 폴더/템플릿 파일 목록을 수집해 설정 화면의
 * select(드롭다운) 위젯에 넘겨줄 "선택지 목록"을 만들어 주는 순수 헬퍼 함수들과,
 * Choices.js 라이브러리를 이용해 "검색 가능한 select 위젯"을 실제 DOM에 생성하는
 * createSearchSelect()를 제공합니다. 또한 카드 본문에서 날짜/시간을 표시할 때 쓰는
 * 트리거 문자(@ , @@)와 메타데이터 기본 위치값 상수도 이 파일에서 정의합니다.
 * #5(Settings.ts)의 SettingsManager, 그리고 이번 배치 밖의 MetadataSettings.tsx /
 * TagSortSettings.tsx 등에서 이 파일의 함수를 가져다 씁니다.
 * ============================================================================
 */
import Choices, { Choices as IChoices } from 'choices.js';
// immutability-helper: 불변(immutable) 방식으로 객체/배열을 갱신하기 위한 헬퍼.
// update(원본, 스펙) 형태로 호출하며, 스펙에 $set/$push/$splice/$unshift/$apply/$unset
// 같은 "커맨드 키워드"를 사용해 원본을 직접 변경하지 않고 새 값을 만들어 반환합니다.
import update from 'immutability-helper';
import { App, Setting, TFile, TFolder, Vault } from 'obsidian';

import { KanbanSettings, SettingsManager } from './Settings';
import { getTemplatePlugins } from './components/helpers';
import { t } from './lang/helpers';

// 카드 본문에서 날짜를 표시하기 위해 입력하는 트리거 문자(예: "@2024-01-01")의 기본값.
export const defaultDateTrigger = '@';
// 시간 표시 트리거 문자(예: "@@13:00")의 기본값. date-trigger를 두 번 반복한 형태.
export const defaultTimeTrigger = '@@';
// 카드에 삽입된 메타데이터(날짜/시간 등)를 카드 본문 어디에 위치시킬지의 기본값.
export const defaultMetadataPosition = 'body';

// 볼트 전체를 순회하며 모든 "폴더"를 Choices.js가 이해하는 { value, label, ... } 형태의
// 선택지 배열로 변환합니다. 템플릿 폴더 선택 드롭다운 등에서 사용됩니다.
export function getFolderChoices(app: App) {
  const folderList: IChoices.Choice[] = [];

  // Vault.recurseChildren: 루트부터 재귀적으로 모든 파일/폴더 항목(f)에 대해 콜백을 호출.
  Vault.recurseChildren(app.vault.getRoot(), (f) => {
    if (f instanceof TFolder) {
      folderList.push({
        value: f.path,
        label: f.path,
        selected: false,
        disabled: false,
      });
    }
  });

  return folderList;
}

// 지정한 folderStr(없으면 볼트 루트) 아래의 모든 "파일"을 선택지 목록으로 변환합니다.
// 카드 생성 시 사용할 템플릿 파일을 고르는 드롭다운에 쓰입니다.
export function getTemplateChoices(app: App, folderStr?: string) {
  const fileList: IChoices.Choice[] = [];

  // 경로 문자열로부터 실제 파일 시스템 객체를 조회. 폴더가 아니면(찾지 못했거나 파일이면)
  // 아래에서 볼트 루트로 대체한다.
  let folder = folderStr ? app.vault.getAbstractFileByPath(folderStr) : null;

  if (!folder || !(folder instanceof TFolder)) {
    folder = app.vault.getRoot();
  }

  Vault.recurseChildren(folder as TFolder, (f) => {
    if (f instanceof TFile) {
      fileList.push({
        value: f.path,
        // 파일은 전체 경로 대신 파일명(확장자 제외, basename)만 라벨로 보여줌.
        label: f.basename,
        selected: false,
        disabled: false,
      });
    }
  });

  return fileList;
}

// 설정 화면에서 "새 카드 템플릿"과 "새 노트 저장 폴더"를 고르는 드롭다운에 필요한
// 데이터를 한 번에 모아서 반환하는 조합 함수.
export function getListOptions(app: App) {
  // 다른 템플릿 관련 플러그인(코어 Templates, Templater)의 활성화 여부와
  // 그 플러그인이 설정한 템플릿 폴더 경로를 가져온다.
  const { templateFolder, templatesEnabled, templaterPlugin } = getTemplatePlugins(app);

  const templateFiles = getTemplateChoices(app, templateFolder);
  const vaultFolders = getFolderChoices(app);

  let templateWarning = '';

  // 템플릿 플러그인이 하나도 켜져 있지 않으면 사용자에게 경고 문구를 보여주기 위한 문자열 준비.
  if (!templatesEnabled && !templaterPlugin) {
    templateWarning = t('Note: No template plugins are currently enabled.');
  }

  return {
    templateFiles,
    vaultFolders,
    templateWarning,
  };
}

// createSearchSelect()에 전달할 파라미터 타입 정의.
interface CreateSearchSelectParams {
  choices: IChoices.Choice[]; // 드롭다운에 표시할 전체 선택지 목록
  key: keyof KanbanSettings; // 이 select가 제어하는 설정 키(예: 'new-note-folder')
  warningText?: string; // 선택지 아래에 강조 표시할 경고 문구(옵션)
  local: boolean; // 보드별(로컬) 설정인지, 전역 설정인지 구분
  placeHolderStr: string; // 값이 비어있을 때 보여줄 placeholder 라벨
  manager: SettingsManager; // 실제 설정 값을 읽고/쓰는 매니저 인스턴스
}

// Obsidian의 Setting(설정 항목) 안에 "검색 가능한 select" 위젯을 만들어 넣는 팩토리 함수.
// 반환값은 (setting: Setting) => void 형태의 콜백이며, 호출측에서
// new Setting(...).then(createSearchSelect({...})) 식으로 사용하도록 설계되어 있다.
export function createSearchSelect({
  choices,
  key,
  warningText,
  local,
  placeHolderStr,
  manager,
}: CreateSearchSelectParams) {
  return (setting: Setting) => {
    // 컨트롤 영역에 순수 <select> 엘리먼트를 생성. 세 번째 인자 콜백에서 el을 후처리한다.
    setting.controlEl.createEl('select', {}, (el) => {
      // el must be in the dom, so we setTimeout
      // Choices.js는 대상 엘리먼트가 실제 DOM에 삽입(mount)된 뒤에 초기화해야
      // 스타일/치수 계산이 올바르게 되므로, 다음 이벤트 루프 틱까지 지연시킨다.
      el.win.setTimeout(() => {
        let list = choices;

        // manager.getSetting(key, local): 이 설정 키의 [현재 값, 전역(global) 기본값]을
        // 튜플로 반환한다. local=true이면 보드 로컬 설정을, false면 전역 설정을 우선 조회.
        const [value, globalValue] = manager.getSetting(key, local);

        let didSetPlaceholder = false;
        if (globalValue) {
          // 전역 설정값과 동일한 항목을 선택지 목록에서 찾는다.
          const index = list.findIndex((f) => f.value === globalValue);

          if (index > -1) {
            didSetPlaceholder = true;
            const choice = choices[index];

            // immutability-helper 스펙 해설:
            // $splice: [[index, 1]] → list 배열에서 index 위치의 항목 1개를 제거
            //   (Array.prototype.splice(index, 1)과 동일한 의미를 불변적으로 수행).
            // $unshift: [...] → 제거한 자리 대신, 아래에서 가공한 새 choice 객체를
            //   배열의 맨 앞에 삽입(unshift)한다.
            // 즉, "전역 기본값과 일치하는 선택지를 목록에서 꺼내 맨 앞으로 옮기면서
            // placeholder(기본값 안내) 형태로 바꿔치기"하는 로직이다.
            list = update(list, {
              $splice: [[index, 1]],
              $unshift: [
                // 안쪽 update()는 choice 객체 자체를 불변적으로 수정하는 중첩 스펙.
                update(choice, {
                  // $set: 필드 값을 지정한 값으로 완전히 교체.
                  placeholder: {
                    $set: true,
                  },
                  value: {
                    $set: '',
                  },
                  // $apply: 기존 값을 인자로 받는 함수를 적용해 새 값을 계산.
                  // 여기서는 라벨 뒤에 "(default)" 문구를 덧붙인다.
                  label: {
                    $apply: (v) => `${v} (${t('default')})`,
                  },
                }),
              ],
            });
          }
        }

        // 전역 기본값과 일치하는 항목이 없었다면(=아직 아무 값도 설정 안 됨),
        // 별도의 빈 placeholder 항목을 목록 맨 앞에 추가한다.
        if (!didSetPlaceholder) {
          list = update(list, {
            $unshift: [
              {
                placeholder: true,
                value: '',
                label: placeHolderStr,
                selected: false,
                disabled: false,
              },
            ],
          });
        }

        // 실제 Choices.js 인스턴스 생성 — 검색창이 달린 커스텀 select UI를 구성한다.
        const c = new Choices(el, {
          placeholder: true,
          position: 'bottom' as 'auto',
          searchPlaceholderValue: t('Search...'),
          // 선택지가 10개를 초과할 때만 검색창을 활성화(적을 땐 스크롤만으로 충분).
          searchEnabled: list.length > 10,
          choices: list,
        }).setChoiceByValue(''); // 초기값은 빈 문자열(=placeholder 선택 상태)로 맞춘다.

        // 저장되어 있던 실제 값(value)이 목록 안에 존재하면 그 값으로 선택 상태를 갱신.
        if (value && typeof value === 'string' && list.findIndex((f) => f.value === value) > -1) {
          c.setChoiceByValue(value);
        }

        // 사용자가 드롭다운에서 값을 바꿀 때 호출되는 이벤트 핸들러.
        const onChange = (e: CustomEvent) => {
          const val = e.detail.value;

          if (val) {
            // 값이 선택되었으면 해당 key 필드를 $set으로 교체하는 부분 업데이트를 적용.
            manager.applySettingsUpdate({
              [key]: {
                $set: val,
              },
            });
          } else {
            // 값이 비워졌으면(placeholder로 돌아감) $unset으로 해당 key 자체를 제거해
            // "전역 기본값을 그대로 상속"하는 상태로 되돌린다.
            manager.applySettingsUpdate({
              $unset: [key],
            });
          }
        };

        // Choices.js가 발생시키는 'change' 커스텀 이벤트를 select 엘리먼트에 바인딩.
        el.addEventListener('change', onChange);

        // 설정 화면이 닫힐 때 함께 실행될 정리(cleanup) 함수를 매니저에 등록.
        // Choices 인스턴스 파괴 + 이벤트 리스너 해제로 메모리 누수를 방지한다.
        manager.cleanupFns.push(() => {
          c.destroy();
          el.removeEventListener('change', onChange);
        });
      });

      // 경고 문구가 주어졌다면, 설명 영역에 강조(<strong>) 텍스트로 렌더링.
      if (warningText) {
        setting.descEl.createDiv({}, (div) => {
          div.createEl('strong', { text: warningText });
        });
      }
    });
  };
}
