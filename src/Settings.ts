/**
 * ============================================================================
 * [실행 순서 #5] Settings.ts — 플러그인 설정 스키마 + 전역/보드별 설정 UI
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화 / 실행-상호작용
 * KanbanSettings 인터페이스는 칸반 보드 하나가 가질 수 있는 모든 설정 값의 타입 스키마다. 이 값들은
 * 두 층위로 존재한다 — (1) 플러그인 전역 설정: data.json에 저장되고 KanbanSettingsTab(Obsidian 설정
 * 화면의 "Kanban" 탭)에서 편집한다. (2) 보드별 설정: 개별 .md 파일의 frontmatter와 파일 내 설정
 * 코드블록에 저장되며, 보드 툴바에서 SettingsModal을 열어 편집한다. 보드별 설정이 지정돼 있으면 전역
 * 설정보다 우선 적용되고, 지정돼 있지 않으면 전역 설정 값으로 자동 대체(fallback)된다 — 이 우선순위
 * 판단 로직은 StateManager.ts(#14)가 담당한다. 이 파일의 SettingsManager 클래스가 두 UI(전역 탭과
 * 보드별 모달)에서 공통으로 재사용되는 실제 폼 렌더링 로직을 담고 있다.
 * ============================================================================
 */
import update, { Spec } from 'immutability-helper'; // immutability-helper: update(원본, 스펙)을 호출하면 원본은 그대로 두고, 스펙에 정의된 경로만 바뀐 "새" 객체를 반환한다(불변 갱신). Spec<T>는 그 스펙 객체의 타입.
import {
  App,
  DropdownComponent, // 드롭다운(select) UI 컴포넌트의 타입 — reset 버튼에서 값을 다시 세팅하려고 참조를 변수에 저장할 때 타입으로 쓰인다.
  Modal, // Obsidian 모달(팝업 대화상자) 베이스 클래스 — SettingsModal이 상속한다.
  PluginSettingTab, // Obsidian 플러그인 설정 탭 베이스 클래스 — KanbanSettingsTab이 상속한다.
  Setting, // "이름 + 설명 + 입력 컨트롤" 한 줄(row)을 만들어주는 Obsidian 설정 UI 빌더. new Setting(containerEl)로 시작해 .setName().addToggle() 등 메서드 체이닝으로 구성한다.
  ToggleComponent, // on/off 스위치 UI 컴포넌트의 타입 — reset 버튼에서 토글 값을 되돌릴 때 참조하기 위해 쓰인다.
} from 'obsidian';

import { KanbanView } from './KanbanView'; // 보드별 설정 모달(SettingsModal)이 어떤 보드 뷰에 속한 설정인지 알기 위해 참조.
import {
  c, // BEM 스타일 CSS 클래스 이름에 플러그인 접두사를 붙여주는 헬퍼(예: c('board-settings-modal')).
  generateInstanceId, // 목록 렌더링용 고유 id 생성 헬퍼(태그/날짜 색상 규칙 등의 편집 UI key로 사용).
  getDefaultDateFormat, // 데일리 노트 플러그인 등의 설정에서 기본 날짜 포맷을 가져오는 헬퍼.
  getDefaultTimeFormat, // 기본 시간 포맷을 가져오는 헬퍼.
} from './components/helpers';
import {
  DataKey, // 링크된 페이지 메타데이터 중 표시할 키 하나를 나타내는 데이터 타입.
  DateColor, // 날짜 조건에 따라 카드에 적용할 색상 규칙의 데이터 타입.
  DateColorSetting, // DateColor에 편집 UI용 id 등을 덧붙인 래퍼 타입.
  DateColorSettingTemplate, // DateColorSetting의 기본값 템플릿.
  MetadataSetting, // 링크된 노트 메타데이터 표시 규칙의 편집 UI용 래퍼 타입.
  MetadataSettingTemplate, // MetadataSetting의 기본값 템플릿.
  TagColor, // 태그별 색상 규칙의 데이터 타입.
  TagColorSetting, // TagColor에 편집 UI용 id를 덧붙인 래퍼 타입.
  TagColorSettingTemplate, // TagColorSetting의 기본값 템플릿.
  TagSort, // 태그 정렬 순서 규칙의 데이터 타입.
  TagSortSetting, // TagSort에 편집 UI용 id를 덧붙인 래퍼 타입.
  TagSortSettingTemplate, // TagSortSetting의 기본값 템플릿.
} from './components/types';
import { getParentWindow } from './dnd/util/getWindow'; // 팝아웃(다중 윈도우) 환경에서 설정 UI가 속한 실제 window 객체를 구하는 헬퍼.
import { t } from './lang/helpers'; // 다국어 번역 함수 — 이 파일의 모든 UI 문자열이 t('...')로 감싸져 있다.
import KanbanPlugin from './main'; // 플러그인 본체 클래스(#1) — 전역 설정(plugin.settings)과 app 인스턴스 참조용.
import { frontmatterKey } from './parsers/common'; // frontmatter/설정 객체에 저장되는 "보드 포맷" 키 이름 상수.
import {
  createSearchSelect, // 파일/폴더 검색-선택 입력 UI를 만드는 헬퍼(노트 템플릿·노트 폴더 설정에 사용).
  defaultDateTrigger, // 날짜 선택기를 여는 기본 트리거 문자열.
  defaultMetadataPosition, // 인라인 메타데이터의 기본 표시 위치.
  defaultTimeTrigger, // 시간 선택기를 여는 기본 트리거 문자열.
  getListOptions, // 템플릿 파일 목록/폴더 목록 등 드롭다운에 쓸 선택지를 모으는 헬퍼.
} from './settingHelpers';
import { cleanUpDateSettings, renderDateSettings } from './settings/DateColorSettings'; // 날짜별 색상 규칙 편집 UI의 렌더 함수와, 그 UI가 등록한 리스너를 해제하는 정리 함수.
import { cleanupMetadataSettings, renderMetadataSettings } from './settings/MetadataSettings'; // 링크된 페이지 메타데이터 편집 UI의 렌더/정리 함수.
import { cleanUpTagSettings, renderTagSettings } from './settings/TagColorSettings'; // 태그별 색상 편집 UI의 렌더/정리 함수.
import { cleanUpTagSortSettings, renderTagSortSettings } from './settings/TagSortSettings'; // 태그 정렬 순서 편집 UI의 렌더/정리 함수.

// 숫자(정수 또는 소수) 문자열 검증용 정규식 — 리스트 너비, 아카이브 최대 개수 등 숫자 텍스트 입력값의 유효성 검사에 재사용된다.
const numberRegEx = /^\d+(?:\.\d+)?$/;

// 보드가 마크다운으로 렌더링/파싱되는 네 가지 형식. frontmatter의 포맷 키 값과 대응된다.
// basic: 리스트 구분 없는 단순 보드 / board: 기본 칸반(리스트=컬럼) / table: 표 형태 / list: 세로 목록 형태.
export type KanbanFormat = 'basic' | 'board' | 'table' | 'list';

// 보드 하나가 가질 수 있는 모든 설정 값의 스키마. 거의 모든 필드가 optional(?)인 이유는
// "값이 없으면 상위(전역) 설정을 그대로 물려받는다"는 계층적 fallback 구조 때문이다.
// 키 이름은 frontmatter/설정 코드블록에 그대로 저장되는 문자열 키라서 camelCase가 아닌 kebab-case이며,
// 필드는 알파벳 순으로 정렬되어 있어 실제 기능 그룹과는 순서가 섞여 있다(각 줄의 주석 참고).
export interface KanbanSettings {
  [frontmatterKey]?: KanbanFormat; // [보드 포맷] 이 보드가 basic/board/table/list 중 무엇으로 렌더링될지.
  'append-archive-date'?: boolean; // [아카이브] 아카이브 날짜를 카드 제목 "뒤"에 붙일지(기본은 앞).
  'archive-date-format'?: string; // [아카이브] 아카이브 시 기록되는 날짜/시간의 moment.js 포맷 문자열.
  'archive-date-separator'?: string; // [아카이브] 아카이브 날짜/시간과 카드 제목 사이의 구분자 문자열.
  'archive-with-date'?: boolean; // [아카이브] 카드를 아카이브할 때 현재 날짜/시간을 제목에 자동으로 덧붙일지.
  'date-colors'?: DateColor[]; // [날짜] 오늘/기한지남 등 날짜 조건에 따라 카드에 적용할 색상 규칙 목록.
  'date-display-format'?: string; // [날짜] 카드에 표시되는 날짜의 moment.js 포맷(저장 포맷과 별개인 화면 표시용).
  'date-format'?: string; // [날짜] 마크다운에 날짜를 저장할 때 사용하는 moment.js 포맷.
  'date-picker-week-start'?: number; // [날짜] 날짜 선택기 캘린더에서 한 주가 시작하는 요일(0=일요일 ... 6=토요일).
  'date-time-display-format'?: string; // [날짜] 날짜+시간을 함께 표시할 때 쓰는 포맷.
  'date-trigger'?: string; // [날짜] 카드 편집 중 이 문자열을 입력하면 날짜 선택기가 뜨는 트리거(예: '@').
  'full-list-lane-width'?: boolean; // [레이아웃] 리스트(세로) 뷰에서 리스트가 화면 전체 너비를 채우도록 확장할지.
  'hide-card-count'?: boolean; // [표시] 리스트 제목 옆 카드 개수 표시를 숨길지.
  'inline-metadata-position'?: 'body' | 'footer' | 'metadata-table'; // [메타데이터] Dataview 인라인 메타데이터를 카드 본문/푸터/메타데이터 테이블 중 어디에 표시할지.
  'lane-width'?: number; // [레이아웃] 보드(가로) 뷰에서 리스트(레인) 하나의 픽셀 너비.
  'link-date-to-daily-note'?: boolean; // [날짜] 카드에 표시되는 날짜를 데일리 노트로 링크할지(예: [[2021-04-26]]).
  'list-collapse'?: boolean[]; // [보드 상태] 각 리스트의 접힘/펼침 상태 배열 — 인덱스가 리스트 순서에 대응.
  'max-archive-size'?: number; // [아카이브] 아카이브에 보관할 최대 카드 수(-1이면 무제한, 넘으면 오래된 것부터 제거).
  'metadata-keys'?: DataKey[]; // [메타데이터] 카드에 링크된 첫 노트의 프론트매터 중 표시할 키 목록과 라벨 설정.
  'move-dates'?: boolean; // [카드 레이아웃] 카드 본문의 날짜를 카드 푸터로 이동해서 표시할지.
  'move-tags'?: boolean; // [카드 레이아웃] 카드 본문의 태그를 카드 푸터로 이동해서 표시할지.
  'move-task-metadata'?: boolean; // [카드 레이아웃] Tasks 플러그인 메타데이터를 카드 푸터로 이동해서 표시할지.
  'new-card-insertion-method'?: 'prepend' | 'prepend-compact' | 'append'; // [카드 생성] 새 카드를 리스트의 맨 앞/맨 앞(압축)/맨 뒤 중 어디에 추가할지.
  'new-line-trigger'?: 'enter' | 'shift-enter'; // [편집] 카드/리스트 편집 중 줄바꿈을 Enter로 할지 Shift+Enter로 할지(반대 키는 편집 완료 트리거가 됨).
  'new-note-folder'?: string; // [카드 생성] 카드에서 새 노트를 만들 때 저장할 폴더 경로.
  'new-note-template'?: string; // [카드 생성] 카드에서 새 노트를 만들 때 사용할 템플릿 파일 경로.
  'show-add-list'?: boolean; // [헤더 버튼] 보드 헤더에 "리스트 추가" 버튼을 표시할지.
  'show-archive-all'?: boolean; // [헤더 버튼] 보드 헤더에 "완료 카드 모두 아카이브" 버튼을 표시할지.
  'show-board-settings'?: boolean; // [헤더 버튼] 보드 헤더에 "보드 설정 열기" 버튼을 표시할지.
  'show-checkboxes'?: boolean; // [표시] 각 카드에 체크박스를 표시할지.
  'show-relative-date'?: boolean; // [날짜 표시] 카드 날짜를 "3일 후", "한 달 전"처럼 상대 시간으로 표시할지.
  'show-search'?: boolean; // [헤더 버튼] 보드 헤더에 검색 버튼을 표시할지.
  'show-set-view'?: boolean; // [헤더 버튼] 보드 헤더에 보기 방식(보드/리스트/테이블) 전환 버튼을 표시할지.
  'show-view-as-markdown'?: boolean; // [헤더 버튼] 보드 헤더에 "마크다운으로 보기" 버튼을 표시할지.
  'table-sizing'?: Record<string, number>; // [테이블 뷰] 테이블 뷰에서 각 컬럼의 픽셀 너비를 컬럼 키별로 저장한 맵.
  'tag-action'?: 'kanban' | 'obsidian'; // [태그] 카드의 태그를 클릭했을 때 칸반 보드 내 검색을 열지, Obsidian 전역 검색을 열지.
  'tag-colors'?: TagColor[]; // [태그] 태그별 배경/글자색 규칙 목록.
  'tag-sort'?: TagSort[]; // [태그] 태그를 표시 순서대로 정렬하기 위한 우선순위 규칙 목록.
  'time-format'?: string; // [시간] 마크다운에 시간을 저장할 때 사용하는 moment.js 포맷.
  'time-trigger'?: string; // [시간] 카드 편집 중 이 문자열을 입력하면 시간 선택기가 뜨는 트리거.
}

// 뷰(런타임) 쪽에서 실제로 필요한 축소된 설정 형태 — 보드 포맷과 리스트 접힘 상태만 다룰 때 사용.
export interface KanbanViewSettings {
  [frontmatterKey]?: KanbanFormat;
  'list-collapse'?: boolean[];
}

// KanbanSettings의 키 이름들을 런타임에 빠르게 조회(존재 확인)하기 위한 Set 자료구조.
// 예: frontmatter나 설정 코드블록을 파싱할 때 "이 키가 유효한 칸반 설정 키인지" 판별하는 용도.
// Set<keyof KanbanSettings> 타입 덕분에, KanbanSettings 인터페이스에 없는 키를 이 배열에 넣으면
// 컴파일 타임에 타입 오류가 나서 인터페이스와 항상 동기화되도록 강제된다.
export const settingKeyLookup: Set<keyof KanbanSettings> = new Set([
  frontmatterKey,
  'append-archive-date',
  'archive-date-format',
  'archive-date-separator',
  'archive-with-date',
  'date-colors',
  'date-display-format',
  'date-format',
  'date-picker-week-start',
  'date-time-display-format',
  'date-trigger',
  'full-list-lane-width',
  'hide-card-count',
  'inline-metadata-position',
  'lane-width',
  'link-date-to-daily-note',
  'list-collapse',
  'max-archive-size',
  'metadata-keys',
  'move-dates',
  'move-tags',
  'move-task-metadata',
  'new-card-insertion-method',
  'new-line-trigger',
  'new-note-folder',
  'new-note-template',
  'show-add-list',
  'show-archive-all',
  'show-board-settings',
  'show-checkboxes',
  'show-relative-date',
  'show-search',
  'show-set-view',
  'show-view-as-markdown',
  'table-sizing',
  'tag-action',
  'tag-colors',
  'tag-sort',
  'time-format',
  'time-trigger',
]);

// 제네릭 함수 타입: keyof KanbanSettings 중 하나의 키(K)를 넣으면 그 키에 대응하는 값 타입인
// KanbanSettings[K]를 반환하도록 타입이 자동으로 좁혀진다(K가 무엇이냐에 따라 반환 타입이 달라짐).
// supplied가 주어지면 그 설정 객체를 대상으로, 생략되면 호출하는 쪽의 기본 컨텍스트를 대상으로 조회한다.
export type SettingRetriever = <K extends keyof KanbanSettings>(
  key: K,
  supplied?: KanbanSettings
) => KanbanSettings[K];

// 설정값을 읽어오는 세 가지 방법을 묶은 인터페이스 — 전역 설정 객체 전체, 전역 설정의 특정 키,
// (보드별 우선순위가 적용된) 특정 키. StateManager(#14) 등에서 구현하여 하위 컴포넌트에 전달한다.
export interface SettingRetrievers {
  getGlobalSettings: () => KanbanSettings;
  getGlobalSetting: SettingRetriever;
  getSetting: SettingRetriever;
}

// SettingsManager 생성자에 전달되는 콜백 묶음 — 설정이 바뀔 때마다 이 콜백을 통해 상위(플러그인
// 본체 또는 보드의 StateManager)에 새로운 설정 객체를 통지한다.
export interface SettingsManagerConfig {
  onSettingsChange: (newSettings: KanbanSettings) => void;
}

// 설정 폼(전역 탭 + 보드별 모달) UI를 실제로 그리고, 사용자 입력을 받아 불변 갱신 후 저장 콜백을
// 호출하는 핵심 클래스. KanbanSettingsTab과 SettingsModal이 각각 이 클래스의 인스턴스를 하나씩 만들어
// constructUI()를 호출하는 방식으로 실제 렌더링 로직을 위임한다(상속이 아닌 구성/합성 패턴).
export class SettingsManager {
  win: Window; // 이 설정 UI가 렌더링된 실제 window 객체(Obsidian 팝아웃 다중 창 지원) — constructUI 호출 시 설정됨.
  app: App;
  plugin: KanbanPlugin;
  config: SettingsManagerConfig;
  settings: KanbanSettings; // 현재 편집 중인 설정 객체(local=true면 보드별 설정, false면 전역 설정의 복사본).
  cleanupFns: Array<() => void> = []; // 태그/날짜색 등 하위 렌더 함수가 등록한 정리(이벤트 리스너 해제) 콜백 목록 — cleanUp()에서 일괄 실행.
  applyDebounceTimer: number = 0; // 디바운스 타이머 id — 텍스트를 빠르게 연속 입력해도 매 입력마다 즉시 저장하지 않도록 지연시키는 데 사용.

  constructor(plugin: KanbanPlugin, config: SettingsManagerConfig, settings: KanbanSettings) {
    this.app = plugin.app;
    this.plugin = plugin;
    this.config = config;
    this.settings = settings;
  }

  // 설정 변경을 즉시 반영하지 않고 1초 디바운스 후 적용한다. spec은 immutability-helper의
  // update() 스펙 객체(예: { 'show-checkboxes': { $set: true } } 또는 { $unset: ['lane-width'] })이며,
  // update(this.settings, spec)은 this.settings를 직접 변형(mutate)하지 않고 변경된 부분만 반영한
  // "새" 객체를 만들어 반환한다(불변성 유지 → React/Preact의 참조 비교 리렌더링과 잘 맞음).
  applySettingsUpdate(spec: Spec<KanbanSettings>) {
    this.win.clearTimeout(this.applyDebounceTimer); // 이전에 예약된 저장을 취소하고 새로 디바운스 타이머를 건다.

    this.applyDebounceTimer = this.win.setTimeout(() => {
      this.settings = update(this.settings, spec); // 불변 갱신: spec에 정의된 경로만 바뀐 새 객체로 교체.
      this.config.onSettingsChange(this.settings); // 상위(플러그인 또는 StateManager)에 변경 통지 → 실제 저장/리렌더 트리거.
    }, 1000);
  }

  // key에 해당하는 [로컬 값, 전역 값] 쌍을 배열(튜플)로 반환한다. local=true(보드별 설정 모달)일 때만
  // 전역값도 함께 반환해서 "미설정 시 전역값으로 폴백"되는 UI(placeholder, 회색 텍스트, reset 버튼 등)를
  // 그릴 수 있게 한다. local=false(전역 탭)일 때는 비교 대상이 없으므로 두 번째 값은 항상 null.
  getSetting(key: keyof KanbanSettings, local: boolean) {
    if (local) {
      return [this.settings[key], this.plugin.settings[key]];
    }

    return [this.settings[key], null];
  }

  // 실제 설정 폼 UI 전체를 contentEl 안에 그리는 메서드. heading은 상단 제목(보드 파일명 또는
  // "Kanban Plugin"), local=true면 보드별 설정 모달에서, false면 전역 설정 탭에서 호출된다.
  // 아래에 줄줄이 나오는 new Setting(contentEl)... 블록들이 실제 화면에 그려지는 각 설정 행(row)이다.
  constructUI(contentEl: HTMLElement, heading: string, local: boolean) {
    this.win = contentEl.win; // 이 UI가 그려질 window(팝아웃 다중 창 지원)를 저장 — applySettingsUpdate의 디바운스 타이머에 쓰임.

    // 구조분해할당: getListOptions()가 반환하는 객체에서 템플릿 파일 목록/볼트 폴더 목록/템플릿 경고
    // 문구를 한 번에 꺼낸다. 아래 "노트 템플릿"/"노트 폴더" 설정의 검색-선택 UI에 선택지로 쓰인다.
    const { templateFiles, vaultFolders, templateWarning } = getListOptions(this.app);

    contentEl.createEl('h3', { text: heading }); // 설정 화면 최상단 제목(보드 이름 또는 "Kanban Plugin").

    if (local) {
      // 보드별 설정 모달일 때: 여기서 정한 값이 전역 설정보다 우선 적용된다는 안내 문구.
      contentEl.createEl('p', {
        text: t('These settings will take precedence over the default Kanban board settings.'),
      });
    } else {
      // 전역 설정 탭일 때: 여기서 정한 값이 기본값이며 보드별로 재정의될 수 있다는 안내 문구.
      contentEl.createEl('p', {
        text: t(
          'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.'
        ),
      });
    }

    // ------------------------------------------------------------------
    // [토글 설정의 전형적인 패턴] 이후 반복되는 대부분의 boolean 설정이 이 구조를 따른다:
    //  1) new Setting(contentEl).setName(...).setDesc(...) 로 이름/설명이 있는 행을 만든다.
    //  2) .then((setting) => {...}) 콜백 안에서 addToggle()로 on/off 스위치를 추가한다.
    //     - 로컬 값이 있으면 그 값을, 없으면 전역값을 초기 상태로 표시한다(둘 다 없으면 꺼진 채로 둠).
    //     - toggle.onChange(newValue => ...)에서 $set 스펙으로 로컬 설정에 즉시(디바운스 후) 반영한다.
    //  3) .addExtraButton()으로 "기본값으로 되돌리기"(되돌리기 아이콘) 버튼을 추가한다.
    //     - 클릭 시 토글 UI를 전역값으로 되돌리고, $unset 스펙으로 로컬 설정에서 이 키 자체를 지운다
    //       (지우면 getSetting()이 다시 전역값으로 폴백하게 됨).
    //  toggleComponent 변수는 클로저에 담아 두었다가 reset 버튼 클릭 시 UI를 다시 세팅하는 데 쓰인다.
    // ------------------------------------------------------------------
    new Setting(contentEl)
      .setName(t('Display card checkbox'))
      .setDesc(t('When toggled, a checkbox will be displayed with each card'))
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting('show-checkboxes', local);

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'show-checkboxes': {
                  $set: newValue, // immutability-helper 스펙: 'show-checkboxes' 필드를 newValue로 완전히 교체.
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('lucide-rotate-ccw')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting('show-checkboxes', local); // 배열 구조분해에서 첫 번째(로컬값)는 버리고 전역값만 취함.
                toggleComponent.setValue(!!globalValue); // !!로 undefined/null도 boolean으로 안전하게 변환.

                this.applySettingsUpdate({
                  $unset: ['show-checkboxes'], // immutability-helper 스펙: 로컬 설정 객체에서 이 키를 아예 제거(전역값 상속 상태로 복귀).
                });
              });
          });
      });

    // [드롭다운(select) 설정 패턴] addDropdown()으로 <select> 형태의 옵션 목록을 만든다.
    // addOption(value, label)을 여러 번 호출해 선택지를 등록하고, setValue로 초기 선택값을,
    // onChange로 변경 시 콜백을 지정한다. 드롭다운은 값이 항상 존재해야 하므로(빈 선택 없음)
    // toggle과 달리 별도의 리셋 버튼 없이 "로컬값 || 전역값 || 하드코딩된 기본값" 순서로 폴백한다.
    new Setting(contentEl)
      .setName(t('New line trigger'))
      .setDesc(
        t(
          'Select whether Enter or Shift+Enter creates a new line. The opposite of what you choose will create and complete editing of cards and lists.'
        )
      )
      .addDropdown((dropdown) => {
        dropdown.addOption('shift-enter', t('Shift + Enter'));
        dropdown.addOption('enter', t('Enter'));

        const [value, globalValue] = this.getSetting('new-line-trigger', local);

        dropdown.setValue((value as string) || (globalValue as string) || 'shift-enter');
        dropdown.onChange((value) => {
          this.applySettingsUpdate({
            'new-line-trigger': {
              $set: value as 'enter' | 'shift-enter', // 문자열 리터럴 유니온 타입으로 단언(as)하여 KanbanSettings 필드 타입에 맞춤.
            },
          });
        });
      });

    // 'new-card-insertion-method' 드롭다운: 새 카드가 리스트의 어디에 추가되는지 결정.
    new Setting(contentEl)
      .setName(t('Prepend / append new cards'))
      .setDesc(
        t('This setting controls whether new cards are added to the beginning or end of the list.')
      )
      .addDropdown((dropdown) => {
        dropdown.addOption('prepend', t('Prepend'));
        dropdown.addOption('prepend-compact', t('Prepend (compact)'));
        dropdown.addOption('append', t('Append'));

        const [value, globalValue] = this.getSetting('new-card-insertion-method', local);

        dropdown.setValue((value as string) || (globalValue as string) || 'append');
        dropdown.onChange((value) => {
          this.applySettingsUpdate({
            'new-card-insertion-method': {
              $set: value as 'prepend' | 'append',
            },
          });
        });
      });

    // 'hide-card-count' 토글: 리스트 제목 옆 카드 개수 배지를 숨길지(위의 전형적 토글+리셋 패턴 재사용).
    new Setting(contentEl)
      .setName(t('Hide card counts in list titles'))
      .setDesc(t('When toggled, card counts are hidden from the list title'))
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting('hide-card-count', local);

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'hide-card-count': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('lucide-rotate-ccw')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting('hide-card-count', local);
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['hide-card-count'],
                });
              });
          });
      });

    // [텍스트 입력 설정 패턴] addText()로 <input type="text">를 만든다. 여기서는 inputEl(실제 DOM
    // input 요소)의 type 속성을 'number'로 바꾸고 placeholder에 "전역값 (default)" 형태를 보여준다.
    // onChange에서 numberRegEx로 유효성을 검사해 통과하면 $set, 비어있으면 $unset, 형식이 틀리면
    // 에러 스타일(error 클래스)만 붙이고 값은 저장하지 않는다(값을 지우지 않아 사용자가 계속 수정 가능).
    new Setting(contentEl)
      .setName(t('List width'))
      .setDesc(t('Enter a number to set the list width in pixels.'))
      .addText((text) => {
        const [value, globalValue] = this.getSetting('lane-width', local);

        text.inputEl.setAttr('type', 'number');
        text.inputEl.placeholder = `${globalValue ? globalValue : '272'} (default)`;
        text.inputEl.value = value ? value.toString() : '';

        text.onChange((val) => {
          if (val && numberRegEx.test(val)) {
            text.inputEl.removeClass('error');

            this.applySettingsUpdate({
              'lane-width': {
                $set: parseInt(val), // 문자열 입력값을 정수로 변환해 저장.
              },
            });

            return;
          }

          if (val) {
            text.inputEl.addClass('error'); // 숫자가 아닌 값을 입력하면 시각적 에러 표시만 하고 저장은 하지 않음.
          }

          this.applySettingsUpdate({
            $unset: ['lane-width'], // 입력이 비어 있으면 설정을 아예 지워 전역/기본값(272)으로 폴백.
          });
        });
      });

    // 'full-list-lane-width' 토글: 리스트(세로) 뷰에서 리스트를 화면 전체 너비로 확장할지.
    // 여기서는 .setName()만 있고 .setDesc()가 없다 — 이름만으로 충분히 설명되는 단순 토글.
    new Setting(contentEl).setName(t('Expand lists to full width in list view')).then((setting) => {
      let toggleComponent: ToggleComponent;

      setting
        .addToggle((toggle) => {
          toggleComponent = toggle;

          const [value, globalValue] = this.getSetting('full-list-lane-width', local);

          if (value !== undefined) {
            toggle.setValue(value as boolean);
          } else if (globalValue !== undefined) {
            toggle.setValue(globalValue as boolean);
          }

          toggle.onChange((newValue) => {
            this.applySettingsUpdate({
              'full-list-lane-width': {
                $set: newValue,
              },
            });
          });
        })
        .addExtraButton((b) => {
          b.setIcon('lucide-rotate-ccw')
            .setTooltip(t('Reset to default'))
            .onClick(() => {
              const [, globalValue] = this.getSetting('full-list-lane-width', local);
              toggleComponent.setValue(!!globalValue);

              this.applySettingsUpdate({
                $unset: ['full-list-lane-width'],
              });
            });
        });
    });

    // 'max-archive-size' 텍스트 입력(숫자): 위 List width와 같은 검증/폴백 패턴. -1은 "무제한"을 의미.
    new Setting(contentEl)
      .setName(t('Maximum number of archived cards'))
      .setDesc(
        t(
          "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely."
        )
      )
      .addText((text) => {
        const [value, globalValue] = this.getSetting('max-archive-size', local);

        text.inputEl.setAttr('type', 'number');
        text.inputEl.placeholder = `${globalValue ? globalValue : '-1'} (default)`;
        text.inputEl.value = value ? value.toString() : '';

        text.onChange((val) => {
          if (val && numberRegEx.test(val)) {
            text.inputEl.removeClass('error');

            this.applySettingsUpdate({
              'max-archive-size': {
                $set: parseInt(val),
              },
            });

            return;
          }

          if (val) {
            text.inputEl.addClass('error');
          }

          this.applySettingsUpdate({
            $unset: ['max-archive-size'],
          });
        });
      });

    // 'new-note-template' 검색-선택 설정: createSearchSelect()는 settingHelpers.ts(#6)가 제공하는
    // 팩토리 함수로, Setting 인스턴스를 인자로 받는 콜백을 반환한다. .then(콜백)에 바로 넘겨서
    // "볼트 내 파일/폴더를 검색해서 고르는" 자동완성 입력 UI를 구성한다(선택지=templateFiles).
    new Setting(contentEl)
      .setName(t('Note template'))
      .setDesc(t('This template will be used when creating new notes from Kanban cards.'))
      .then(
        createSearchSelect({
          choices: templateFiles,
          key: 'new-note-template',
          warningText: templateWarning,
          local,
          placeHolderStr: t('No template'),
          manager: this, // this(SettingsManager 인스턴스)를 넘겨서 createSearchSelect 내부가 applySettingsUpdate/getSetting을 호출할 수 있게 함.
        })
      );

    // 'new-note-folder' 검색-선택 설정: 선택지가 vaultFolders(볼트 내 폴더 목록)라는 점만 다름.
    new Setting(contentEl)
      .setName(t('Note folder'))
      .setDesc(
        t(
          'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.'
        )
      )
      .then(
        createSearchSelect({
          choices: vaultFolders,
          key: 'new-note-folder',
          local,
          placeHolderStr: t('Default folder'),
          manager: this,
        })
      );

    // ---- 여기서부터 "태그" 관련 설정 그룹 (섹션 소제목 h4) ----
    contentEl.createEl('h4', { text: t('Tags') });

    // 'move-tags' 토글: 태그를 카드 본문이 아닌 푸터에 표시할지(전형적 토글+리셋 패턴).
    new Setting(contentEl)
      .setName(t('Move tags to card footer'))
      .setDesc(
        t("When toggled, tags will be displayed in the card's footer instead of the card's body.")
      )
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting('move-tags', local);

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'move-tags': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('lucide-rotate-ccw')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting('move-tags', local);
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['move-tags'],
                });
              });
          });
      });

    // 'tag-action' 드롭다운: 태그 클릭 시 칸반 보드 내 검색 vs Obsidian 전역 검색 중 선택.
    new Setting(contentEl)
      .setName(t('Tag click action'))
      .setDesc(
        t(
          'This setting controls whether clicking the tags displayed below the card title opens the Obsidian search or the Kanban board search.'
        )
      )
      .addDropdown((dropdown) => {
        dropdown.addOption('kanban', t('Search Kanban Board'));
        dropdown.addOption('obsidian', t('Search Obsidian Vault'));

        const [value, globalValue] = this.getSetting('tag-action', local);

        dropdown.setValue((value as string) || (globalValue as string) || 'obsidian');
        dropdown.onChange((value) => {
          this.applySettingsUpdate({
            'tag-action': {
              $set: value as 'kanban' | 'obsidian',
            },
          });
        });
      });

    // [복합 리스트 편집 설정 패턴] 'tag-sort'는 단순 값이 아니라 "규칙들의 배열"이라서 자체 하위
    // 컴포넌트(settings/TagSortSettings.tsx, #10)가 그린다. 여기서는 new Setting(contentEl)로 빈 행만
    // 만들고(이름/설명 없이) .then()에서 setting.settingEl(실제 DOM 컨테이너)을 그 하위 렌더 함수에 넘긴다.
    new Setting(contentEl).then((setting) => {
      // 저장된 TagSort[] 각 항목을 편집 UI용 TagSortSetting으로 변환: 템플릿 스프레드(...TagSortSettingTemplate)로
      // 기본 골격을 깔고, generateInstanceId()로 렌더링 key(id)를 새로 부여하고, 실제 데이터는 data 필드에 넣는다.
      const [value, globalValue] = this.getSetting('tag-sort', local);

      const keys: TagSortSetting[] = ((value || globalValue || []) as TagSort[]).map((k) => {
        return {
          ...TagSortSettingTemplate,
          id: generateInstanceId(),
          data: k,
        };
      });

      // renderTagSortSettings가 실제 드래그 가능한 규칙 목록 UI를 그리고, 사용자가 목록을 바꿀 때마다
      // 콜백(마지막 인자)이 호출된다. 콜백 안에서는 각 항목의 UI 래퍼(id 등)를 벗기고 data만 뽑아 $set으로 저장.
      renderTagSortSettings(setting.settingEl, contentEl, keys, (keys: TagSortSetting[]) =>
        this.applySettingsUpdate({
          'tag-sort': {
            $set: keys.map((k) => k.data),
          },
        })
      );

      // 이 설정 UI가 등록한 리스너/드래그 핸들 등을 모달/탭이 닫힐 때 정리하도록 cleanupFns에 등록.
      this.cleanupFns.push(() => {
        if (setting.settingEl) {
          cleanUpTagSortSettings(setting.settingEl);
        }
      });
    });

    // 'tag-colors': 태그별 색상 규칙 배열 — 위 tag-sort와 동일한 패턴이지만 전역값으로 폴백하지 않는다
    // (const [value] 구조분해에서 두 번째 요소를 아예 받지 않음 — 태그 색상은 보드별로만 관리되는 값).
    new Setting(contentEl).then((setting) => {
      const [value] = this.getSetting('tag-colors', local);

      const keys: TagColorSetting[] = ((value || []) as TagColor[]).map((k) => {
        return {
          ...TagColorSettingTemplate,
          id: generateInstanceId(),
          data: k,
        };
      });

      renderTagSettings(setting.settingEl, keys, (keys: TagColorSetting[]) =>
        this.applySettingsUpdate({
          'tag-colors': {
            $set: keys.map((k) => k.data),
          },
        })
      );

      this.cleanupFns.push(() => {
        if (setting.settingEl) {
          cleanUpTagSettings(setting.settingEl);
        }
      });
    });

    // ---- 여기서부터 "날짜 & 시간" 관련 설정 그룹 ----
    contentEl.createEl('h4', { text: t('Date & Time') });

    // 'move-dates' 토글: 날짜를 카드 본문이 아닌 푸터에 표시할지.
    // 주의: reset 버튼 onClick에서 !!globalValue가 아니라 (globalValue as boolean) ?? true를 쓴다 —
    // 즉 전역값이 undefined/null이면 "기본은 켜짐(true)"으로 되돌린다는 뜻으로, 이 설정의 기본 동작이
    // 다른 대부분의 토글과 달리 true라는 것을 알 수 있다(??는 null/undefined일 때만 우측 값을 사용).
    new Setting(contentEl)
      .setName(t('Move dates to card footer'))
      .setDesc(
        t("When toggled, dates will be displayed in the card's footer instead of the card's body.")
      )
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting('move-dates', local);

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'move-dates': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('lucide-rotate-ccw')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting('move-dates', local);
                toggleComponent.setValue((globalValue as boolean) ?? true);

                this.applySettingsUpdate({
                  $unset: ['move-dates'],
                });
              });
          });
      });

    // 'date-trigger' 텍스트 입력: 날짜 선택기를 여는 트리거 문자열(기본값은 defaultDateTrigger, 예: '@').
    // List width와 달리 숫자 검증이 없는 자유 텍스트라, 값이 있으면 $set, 비어 있으면 $unset만 한다.
    new Setting(contentEl)
      .setName(t('Date trigger'))
      .setDesc(t('When this is typed, it will trigger the date selector'))
      .addText((text) => {
        const [value, globalValue] = this.getSetting('date-trigger', local);

        if (value || globalValue) {
          text.setValue((value || globalValue) as string);
        }

        text.setPlaceholder((globalValue as string) || defaultDateTrigger);

        text.onChange((newValue) => {
          if (newValue) {
            this.applySettingsUpdate({
              'date-trigger': {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ['date-trigger'],
            });
          }
        });
      });

    // 'time-trigger' 텍스트 입력: 위 date-trigger와 동일한 패턴, 시간 선택기를 여는 트리거 문자열.
    new Setting(contentEl)
      .setName(t('Time trigger'))
      .setDesc(t('When this is typed, it will trigger the time selector'))
      .addText((text) => {
        const [value, globalValue] = this.getSetting('time-trigger', local);

        if (value || globalValue) {
          text.setValue((value || globalValue) as string);
        }

        text.setPlaceholder((globalValue as string) || defaultTimeTrigger);

        text.onChange((newValue) => {
          if (newValue) {
            this.applySettingsUpdate({
              'time-trigger': {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ['time-trigger'],
            });
          }
        });
      });

    // [moment 포맷 설정 패턴] addMomentFormat()은 Obsidian이 제공하는 특수 입력 컴포넌트로,
    // 사용자가 moment.js 포맷 문자열(예: 'YYYY-MM-DD')을 입력하면 실시간으로 그 포맷이 적용된
    // "샘플" 텍스트를 보여준다. setSampleEl()로 그 샘플을 렌더링할 엘리먼트를 지정하고,
    // createFragment()로 설명문 + 링크 + 샘플 엘리먼트를 조합한 DocumentFragment를 만들어
    // setting.descEl(설정 설명 영역)에 통째로 appendChild한다. mf.setDefaultFormat()은 입력이 완전히
    // 비어있을 때 내부적으로 사용할 기본 포맷, mf.setPlaceholder()는 입력창에 회색으로 보이는 힌트다.
    new Setting(contentEl).setName(t('Date format')).then((setting) => {
      setting.addMomentFormat((mf) => {
        setting.descEl.appendChild(
          createFragment((frag) => {
            frag.appendText(t('This format will be used when saving dates in markdown.'));
            frag.createEl('br');
            frag.appendText(t('For more syntax, refer to') + ' ');
            frag.createEl(
              'a',
              {
                text: t('format reference'),
                href: 'https://momentjs.com/docs/#/displaying/format/',
              },
              (a) => {
                a.setAttr('target', '_blank');
              }
            );
            frag.createEl('br');
            frag.appendText(t('Your current syntax looks like this') + ': ');
            mf.setSampleEl(frag.createEl('b', { cls: 'u-pop' })); // 입력 중인 포맷이 실제로 어떻게 보이는지 실시간 미리보기를 그릴 <b> 태그.
            frag.createEl('br');
          })
        );

        const [value, globalValue] = this.getSetting('date-format', local);
        const defaultFormat = getDefaultDateFormat(this.app); // Obsidian 데일리노트 설정 등에서 가져온 기본 날짜 포맷.

        mf.setPlaceholder(defaultFormat);
        mf.setDefaultFormat(defaultFormat);

        if (value || globalValue) {
          mf.setValue((value || globalValue) as string);
        }

        mf.onChange((newValue) => {
          if (newValue) {
            this.applySettingsUpdate({
              'date-format': {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ['date-format'],
            });
          }
        });
      });
    });

    // 'time-format' moment 포맷 설정: 위 date-format과 동일한 UI 패턴, 시간 저장 포맷을 다룬다.
    new Setting(contentEl).setName(t('Time format')).then((setting) => {
      setting.addMomentFormat((mf) => {
        setting.descEl.appendChild(
          createFragment((frag) => {
            frag.appendText(t('For more syntax, refer to') + ' ');
            frag.createEl(
              'a',
              {
                text: t('format reference'),
                href: 'https://momentjs.com/docs/#/displaying/format/',
              },
              (a) => {
                a.setAttr('target', '_blank');
              }
            );
            frag.createEl('br');
            frag.appendText(t('Your current syntax looks like this') + ': ');
            mf.setSampleEl(frag.createEl('b', { cls: 'u-pop' }));
            frag.createEl('br');
          })
        );

        const [value, globalValue] = this.getSetting('time-format', local);
        const defaultFormat = getDefaultTimeFormat(this.app);

        mf.setPlaceholder(defaultFormat);
        mf.setDefaultFormat(defaultFormat);

        if (value || globalValue) {
          mf.setValue((value || globalValue) as string);
        }

        mf.onChange((newValue) => {
          if (newValue) {
            this.applySettingsUpdate({
              'time-format': {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ['time-format'],
            });
          }
        });
      });
    });

    // 'date-display-format' moment 포맷 설정: 저장 포맷(date-format)과 별개로, 카드 화면에 실제로
    // "보여지는" 날짜 포맷을 지정한다(예: 저장은 ISO 형식, 표시는 로컬 형식으로 다르게 할 수 있음).
    new Setting(contentEl).setName(t('Date display format')).then((setting) => {
      setting.addMomentFormat((mf) => {
        setting.descEl.appendChild(
          createFragment((frag) => {
            frag.appendText(t('This format will be used when displaying dates in Kanban cards.'));
            frag.createEl('br');
            frag.appendText(t('For more syntax, refer to') + ' ');
            frag.createEl(
              'a',
              {
                text: t('format reference'),
                href: 'https://momentjs.com/docs/#/displaying/format/',
              },
              (a) => {
                a.setAttr('target', '_blank');
              }
            );
            frag.createEl('br');
            frag.appendText(t('Your current syntax looks like this') + ': ');
            mf.setSampleEl(frag.createEl('b', { cls: 'u-pop' }));
            frag.createEl('br');
          })
        );

        const [value, globalValue] = this.getSetting('date-display-format', local);
        const defaultFormat = getDefaultDateFormat(this.app);

        mf.setPlaceholder(defaultFormat);
        mf.setDefaultFormat(defaultFormat);

        if (value || globalValue) {
          mf.setValue((value || globalValue) as string);
        }

        mf.onChange((newValue) => {
          if (newValue) {
            this.applySettingsUpdate({
              'date-display-format': {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ['date-display-format'],
            });
          }
        });
      });
    });

    // 'show-relative-date' 토글: 카드 날짜를 "3일 후"처럼 상대 표현으로 보여줄지.
    new Setting(contentEl)
      .setName(t('Show relative date'))
      .setDesc(
        t(
          "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'. Relative dates will not be shown for dates from the Tasks and Dataview plugins."
        )
      )
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting('show-relative-date', local);

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'show-relative-date': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('lucide-rotate-ccw')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting('show-relative-date', local);
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['show-relative-date'],
                });
              });
          });
      });

    // 'link-date-to-daily-note' 토글: 카드의 날짜를 데일리 노트 링크(위키링크)로 만들지.
    new Setting(contentEl)
      .setName(t('Link dates to daily notes'))
      .setDesc(t('When toggled, dates will link to daily notes. Eg. [[2021-04-26]]'))
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting('link-date-to-daily-note', local);

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'link-date-to-daily-note': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('lucide-rotate-ccw')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting('link-date-to-daily-note', local);
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['link-date-to-daily-note'],
                });
              });
          });
      });

    // 'date-colors': 날짜 조건별 색상 규칙 배열 — tag-sort/tag-colors와 같은 "복합 리스트 편집" 패턴.
    // renderDateSettings에는 규칙 목록 외에도 두 개의 게터(getter) 콜백을 추가로 넘긴다: 미리보기에
    // 쓸 날짜 표시 포맷과 시간 포맷을 그때그때 최신값(로컬 우선, 없으면 전역, 그것도 없으면 기본값)으로
    // 가져오기 위함이다 — 화살표 함수로 감싸서 "지금 시점의" 값을 매번 다시 계산하도록 지연 평가한다.
    new Setting(contentEl).then((setting) => {
      const [value] = this.getSetting('date-colors', local);

      const keys: DateColorSetting[] = ((value || []) as DateColor[]).map((k) => {
        return {
          ...DateColorSettingTemplate,
          id: generateInstanceId(),
          data: k,
        };
      });

      renderDateSettings(
        setting.settingEl,
        keys,
        (keys: DateColorSetting[]) =>
          this.applySettingsUpdate({
            'date-colors': {
              $set: keys.map((k) => k.data),
            },
          }),
        () => {
          const [value, globalValue] = this.getSetting('date-display-format', local);
          const defaultFormat = getDefaultDateFormat(this.app);
          return value || globalValue || defaultFormat;
        },
        () => {
          const [value, globalValue] = this.getSetting('time-format', local);
          const defaultFormat = getDefaultTimeFormat(this.app);
          return value || globalValue || defaultFormat;
        }
      );

      this.cleanupFns.push(() => {
        if (setting.settingEl) {
          cleanUpDateSettings(setting.settingEl);
        }
      });
    });

    // ---- 여기서부터 "아카이브" 관련 토글/텍스트 설정들 ----
    // 'archive-with-date' 토글: 카드를 아카이브할 때 현재 날짜/시간을 제목에 자동으로 붙일지.
    new Setting(contentEl)
      .setName(t('Add date and time to archived cards'))
      .setDesc(
        t(
          'When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title'
        )
      )
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting('archive-with-date', local);

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'archive-with-date': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('lucide-rotate-ccw')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting('archive-with-date', local);
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['archive-with-date'],
                });
              });
          });
      });

    // 'append-archive-date' 토글: 아카이브 날짜/시간을 카드 제목 뒤에 붙일지(기본은 앞에 붙임).
    new Setting(contentEl)
      .setName(t('Add archive date/time after card title'))
      .setDesc(
        t(
          'When toggled, the archived date/time will be added after the card title, e.g.- [ ] My card title 2021-05-14 10:00am. By default, it is inserted before the title.'
        )
      )
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting('append-archive-date', local);

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'append-archive-date': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('lucide-rotate-ccw')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting('append-archive-date', local);
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['append-archive-date'],
                });
              });
          });
      });

    // 'archive-date-separator' 텍스트 입력: 아카이브 날짜/시간과 카드 제목 사이의 구분 문자열.
    new Setting(contentEl)
      .setName(t('Archive date/time separator'))
      .setDesc(t('This will be used to separate the archived date/time from the title'))
      .addText((text) => {
        const [value, globalValue] = this.getSetting('archive-date-separator', local);

        text.inputEl.placeholder = globalValue ? `${globalValue} (default)` : '';
        text.inputEl.value = value ? (value as string) : '';

        text.onChange((val) => {
          if (val) {
            this.applySettingsUpdate({
              'archive-date-separator': {
                $set: val,
              },
            });

            return;
          }

          this.applySettingsUpdate({
            $unset: ['archive-date-separator'],
          });
        });
      });

    // 'archive-date-format' moment 포맷 설정: 아카이브 시 기록되는 날짜+시간 포맷.
    // 기본 포맷을 만들 때 이미 설정된 'date-format'과 'time-format' 값(로컬 우선, 없으면 전역,
    // 그것도 없으면 시스템 기본값)을 각각 가져와 "날짜 포맷 + 공백 + 시간 포맷" 문자열로 조합한다 —
    // 즉 이 설정 하나가 앞서 정의된 다른 두 설정에 의존해 기본값을 계산하는 예시.
    new Setting(contentEl).setName(t('Archive date/time format')).then((setting) => {
      setting.addMomentFormat((mf) => {
        setting.descEl.appendChild(
          createFragment((frag) => {
            frag.appendText(t('For more syntax, refer to') + ' ');
            frag.createEl(
              'a',
              {
                text: t('format reference'),
                href: 'https://momentjs.com/docs/#/displaying/format/',
              },
              (a) => {
                a.setAttr('target', '_blank');
              }
            );
            frag.createEl('br');
            frag.appendText(t('Your current syntax looks like this') + ': ');
            mf.setSampleEl(frag.createEl('b', { cls: 'u-pop' }));
            frag.createEl('br');
          })
        );

        const [value, globalValue] = this.getSetting('archive-date-format', local);

        const [dateFmt, globalDateFmt] = this.getSetting('date-format', local);
        const defaultDateFmt = dateFmt || globalDateFmt || getDefaultDateFormat(this.app);
        const [timeFmt, globalTimeFmt] = this.getSetting('time-format', local);
        const defaultTimeFmt = timeFmt || globalTimeFmt || getDefaultTimeFormat(this.app);

        const defaultFormat = `${defaultDateFmt} ${defaultTimeFmt}`; // 템플릿 리터럴로 날짜 포맷과 시간 포맷을 공백으로 이어붙임.

        mf.setPlaceholder(defaultFormat);
        mf.setDefaultFormat(defaultFormat);

        if (value || globalValue) {
          mf.setValue((value || globalValue) as string);
        }

        mf.onChange((newValue) => {
          if (newValue) {
            this.applySettingsUpdate({
              'archive-date-format': {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ['archive-date-format'],
            });
          }
        });
      });
    });

    // 'date-picker-week-start' 드롭다운: 날짜 선택기 캘린더의 주 시작 요일. 값은 숫자(0~6)이지만
    // HTML select 옵션은 문자열만 가능하므로 addOption에는 문자열로 등록하고, onChange에서 Number()로
    // 다시 숫자로 변환해 저장한다. value?.toString()의 ?.는 옵셔널 체이닝 — value가 undefined/null이면
    // 에러 없이 undefined를 반환하고, 그 뒤 || 로 다음 폴백(globalValue, 최종적으로 '')으로 넘어간다.
    new Setting(contentEl)
      .setName(t('Calendar: first day of week'))
      .setDesc(t('Override which day is used as the start of the week'))
      .addDropdown((dropdown) => {
        dropdown.addOption('', t('default'));
        dropdown.addOption('0', t('Sunday'));
        dropdown.addOption('1', t('Monday'));
        dropdown.addOption('2', t('Tuesday'));
        dropdown.addOption('3', t('Wednesday'));
        dropdown.addOption('4', t('Thursday'));
        dropdown.addOption('5', t('Friday'));
        dropdown.addOption('6', t('Saturday'));

        const [value, globalValue] = this.getSetting('date-picker-week-start', local);

        dropdown.setValue(value?.toString() || globalValue?.toString() || '');
        dropdown.onChange((value) => {
          if (value) {
            this.applySettingsUpdate({
              'date-picker-week-start': {
                $set: Number(value),
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ['date-picker-week-start'],
            });
          }
        });
      });

    // ---- 여기서부터 "인라인 메타데이터"(Dataview 플러그인 연동) 관련 설정 그룹 ----
    contentEl.createEl('br');
    contentEl.createEl('h4', { text: t('Inline Metadata') });

    // 'inline-metadata-position' 드롭다운: 위 date-picker-week-start와 달리 이 설정은 드롭다운인데도
    // addExtraButton()으로 리셋 버튼까지 갖췄다 — DropdownComponent 참조를 input 변수에 저장해두고
    // reset 클릭 시 input.setValue(...)로 드롭다운 UI 자체를 전역값/기본값으로 되돌린다.
    new Setting(contentEl)
      .setName(t('Inline metadata position'))
      .setDesc(
        t('Controls where the inline metadata (from the Dataview plugin) will be displayed.')
      )
      .then((s) => {
        let input: DropdownComponent;

        s.addDropdown((dropdown) => {
          input = dropdown;

          dropdown.addOption('body', t('Card body'));
          dropdown.addOption('footer', t('Card footer'));
          dropdown.addOption('metadata-table', t('Merge with linked page metadata'));

          const [value, globalValue] = this.getSetting('inline-metadata-position', local);

          dropdown.setValue(
            value?.toString() || globalValue?.toString() || defaultMetadataPosition
          );
          dropdown.onChange((value: 'body' | 'footer' | 'metadata-table') => {
            if (value) {
              this.applySettingsUpdate({
                'inline-metadata-position': {
                  $set: value,
                },
              });
            } else {
              this.applySettingsUpdate({
                $unset: ['inline-metadata-position'],
              });
            }
          });
        }).addExtraButton((b) => {
          b.setIcon('lucide-rotate-ccw')
            .setTooltip(t('Reset to default'))
            .onClick(() => {
              const [, globalValue] = this.getSetting('inline-metadata-position', local);
              input.setValue((globalValue as string) || defaultMetadataPosition);

              this.applySettingsUpdate({
                $unset: ['inline-metadata-position'],
              });
            });
        });
      });

    new Setting(contentEl)
      .setName(t('Move task data to card footer'))
      .setDesc(
        t(
          "When toggled, task data (from the Tasks plugin) will be displayed in the card's footer instead of the card's body."
        )
      )
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting('move-task-metadata', local);

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'move-task-metadata': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('lucide-rotate-ccw')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting('move-task-metadata', local);
                toggleComponent.setValue((globalValue as boolean) ?? true);

                this.applySettingsUpdate({
                  $unset: ['move-task-metadata'],
                });
              });
          });
      });

    contentEl.createEl('br');
    contentEl.createEl('h4', { text: t('Linked Page Metadata') });
    contentEl.createEl('p', {
      cls: c('metadata-setting-desc'),
      text: t(
        'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.'
      ),
    });

    new Setting(contentEl).then((setting) => {
      setting.settingEl.addClass(c('draggable-setting-container'));

      const [value] = this.getSetting('metadata-keys', local);

      const keys: MetadataSetting[] = ((value as DataKey[]) || ([] as DataKey[])).map((k) => {
        return {
          ...MetadataSettingTemplate,
          id: generateInstanceId(),
          data: k,
          win: getParentWindow(contentEl),
        };
      });

      renderMetadataSettings(setting.settingEl, contentEl, keys, (keys: MetadataSetting[]) =>
        this.applySettingsUpdate({
          'metadata-keys': {
            $set: keys.map((k) => k.data),
          },
        })
      );

      this.cleanupFns.push(() => {
        if (setting.settingEl) {
          cleanupMetadataSettings(setting.settingEl);
        }
      });
    });

    contentEl.createEl('h4', { text: t('Board Header Buttons') });

    new Setting(contentEl).setName(t('Add a list')).then((setting) => {
      let toggleComponent: ToggleComponent;

      setting
        .addToggle((toggle) => {
          toggleComponent = toggle;

          const [value, globalValue] = this.getSetting('show-add-list', local);

          if (value !== undefined && value !== null) {
            toggle.setValue(value as boolean);
          } else if (globalValue !== undefined && globalValue !== null) {
            toggle.setValue(globalValue as boolean);
          } else {
            // default
            toggle.setValue(true);
          }

          toggle.onChange((newValue) => {
            this.applySettingsUpdate({
              'show-add-list': {
                $set: newValue,
              },
            });
          });
        })
        .addExtraButton((b) => {
          b.setIcon('lucide-rotate-ccw')
            .setTooltip(t('Reset to default'))
            .onClick(() => {
              const [, globalValue] = this.getSetting('show-add-list', local);
              toggleComponent.setValue(!!globalValue);

              this.applySettingsUpdate({
                $unset: ['show-add-list'],
              });
            });
        });
    });

    new Setting(contentEl).setName(t('Archive completed cards')).then((setting) => {
      let toggleComponent: ToggleComponent;

      setting
        .addToggle((toggle) => {
          toggleComponent = toggle;

          const [value, globalValue] = this.getSetting('show-archive-all', local);

          if (value !== undefined && value !== null) {
            toggle.setValue(value as boolean);
          } else if (globalValue !== undefined && globalValue !== null) {
            toggle.setValue(globalValue as boolean);
          } else {
            // default
            toggle.setValue(true);
          }

          toggle.onChange((newValue) => {
            this.applySettingsUpdate({
              'show-archive-all': {
                $set: newValue,
              },
            });
          });
        })
        .addExtraButton((b) => {
          b.setIcon('lucide-rotate-ccw')
            .setTooltip(t('Reset to default'))
            .onClick(() => {
              const [, globalValue] = this.getSetting('show-archive-all', local);
              toggleComponent.setValue(!!globalValue);

              this.applySettingsUpdate({
                $unset: ['show-archive-all'],
              });
            });
        });
    });

    new Setting(contentEl).setName(t('Open as markdown')).then((setting) => {
      let toggleComponent: ToggleComponent;

      setting
        .addToggle((toggle) => {
          toggleComponent = toggle;

          const [value, globalValue] = this.getSetting('show-view-as-markdown', local);

          if (value !== undefined && value !== null) {
            toggle.setValue(value as boolean);
          } else if (globalValue !== undefined && globalValue !== null) {
            toggle.setValue(globalValue as boolean);
          } else {
            // default
            toggle.setValue(true);
          }

          toggle.onChange((newValue) => {
            this.applySettingsUpdate({
              'show-view-as-markdown': {
                $set: newValue,
              },
            });
          });
        })
        .addExtraButton((b) => {
          b.setIcon('lucide-rotate-ccw')
            .setTooltip(t('Reset to default'))
            .onClick(() => {
              const [, globalValue] = this.getSetting('show-view-as-markdown', local);
              toggleComponent.setValue(!!globalValue);

              this.applySettingsUpdate({
                $unset: ['show-view-as-markdown'],
              });
            });
        });
    });

    new Setting(contentEl).setName(t('Open board settings')).then((setting) => {
      let toggleComponent: ToggleComponent;

      setting
        .addToggle((toggle) => {
          toggleComponent = toggle;

          const [value, globalValue] = this.getSetting('show-board-settings', local);

          if (value !== undefined && value !== null) {
            toggle.setValue(value as boolean);
          } else if (globalValue !== undefined && globalValue !== null) {
            toggle.setValue(globalValue as boolean);
          } else {
            // default
            toggle.setValue(true);
          }

          toggle.onChange((newValue) => {
            this.applySettingsUpdate({
              'show-board-settings': {
                $set: newValue,
              },
            });
          });
        })
        .addExtraButton((b) => {
          b.setIcon('lucide-rotate-ccw')
            .setTooltip(t('Reset to default'))
            .onClick(() => {
              const [, globalValue] = this.getSetting('show-board-settings', local);
              toggleComponent.setValue(!!globalValue);

              this.applySettingsUpdate({
                $unset: ['show-board-settings'],
              });
            });
        });
    });

    new Setting(contentEl).setName(t('Search...')).then((setting) => {
      let toggleComponent: ToggleComponent;

      setting
        .addToggle((toggle) => {
          toggleComponent = toggle;

          const [value, globalValue] = this.getSetting('show-search', local);

          if (value !== undefined && value !== null) {
            toggle.setValue(value as boolean);
          } else if (globalValue !== undefined && globalValue !== null) {
            toggle.setValue(globalValue as boolean);
          } else {
            // default
            toggle.setValue(true);
          }

          toggle.onChange((newValue) => {
            this.applySettingsUpdate({
              'show-search': {
                $set: newValue,
              },
            });
          });
        })
        .addExtraButton((b) => {
          b.setIcon('lucide-rotate-ccw')
            .setTooltip(t('Reset to default'))
            .onClick(() => {
              const [, globalValue] = this.getSetting('show-search', local);
              toggleComponent.setValue(!!globalValue);

              this.applySettingsUpdate({
                $unset: ['show-search'],
              });
            });
        });
    });

    new Setting(contentEl).setName(t('Board view')).then((setting) => {
      let toggleComponent: ToggleComponent;

      setting
        .addToggle((toggle) => {
          toggleComponent = toggle;

          const [value, globalValue] = this.getSetting('show-set-view', local);

          if (value !== undefined && value !== null) {
            toggle.setValue(value as boolean);
          } else if (globalValue !== undefined && globalValue !== null) {
            toggle.setValue(globalValue as boolean);
          } else {
            // default
            toggle.setValue(true);
          }

          toggle.onChange((newValue) => {
            this.applySettingsUpdate({
              'show-set-view': {
                $set: newValue,
              },
            });
          });
        })
        .addExtraButton((b) => {
          b.setIcon('lucide-rotate-ccw')
            .setTooltip(t('Reset to default'))
            .onClick(() => {
              const [, globalValue] = this.getSetting('show-set-view', local);
              toggleComponent.setValue(!!globalValue);

              this.applySettingsUpdate({
                $unset: ['show-set-view'],
              });
            });
        });
    });
  }

  cleanUp() {
    this.win = null;
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }
}

export class SettingsModal extends Modal {
  view: KanbanView;
  settingsManager: SettingsManager;

  constructor(view: KanbanView, config: SettingsManagerConfig, settings: KanbanSettings) {
    super(view.app);

    this.view = view;
    this.settingsManager = new SettingsManager(view.plugin, config, settings);
  }

  onOpen() {
    const { contentEl, modalEl } = this;

    modalEl.addClass(c('board-settings-modal'));

    this.settingsManager.constructUI(contentEl, this.view.file.basename, true);
  }

  onClose() {
    const { contentEl } = this;

    this.settingsManager.cleanUp();
    contentEl.empty();
  }
}

export class KanbanSettingsTab extends PluginSettingTab {
  plugin: KanbanPlugin;
  settingsManager: SettingsManager;

  constructor(plugin: KanbanPlugin, config: SettingsManagerConfig) {
    super(plugin.app, plugin);
    this.plugin = plugin;
    this.settingsManager = new SettingsManager(plugin, config, plugin.settings);
  }

  display() {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.addClass(c('board-settings-modal'));

    this.settingsManager.constructUI(containerEl, t('Kanban Plugin'), false);
  }
}
