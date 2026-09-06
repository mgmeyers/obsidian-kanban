/**
 * ============================================================================
 * [실행 순서 #20] helpers.ts — 컴포넌트 공용 헬퍼 함수 모음
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * BEM 스타일 CSS 클래스명을 생성하고 캐싱하는 c() 함수, 무작위 인스턴스 ID 생성기
 * generateInstanceId, 아이템이 다른 레인으로 이동할 때 완료(체크) 상태를 자동으로
 * 전환해 주는 maybeCompleteForMove(), IME(한글 등 조합형 입력) 처리, 템플릿 파일
 * 적용, 날짜/태그 색상 계산, 검색 결과 계산(useSearchValue) 등 여러 컴포넌트에서
 * 공통으로 재사용되는 순수 함수 및 커스텀 훅들을 모아둔 유틸리티 파일이다.
 * ============================================================================
 */
import update from 'immutability-helper';
import { App, MarkdownView, TFile, moment } from 'obsidian';
import Preact, { Dispatch, RefObject, useEffect } from 'preact/compat';
import { StateUpdater, useMemo } from 'preact/hooks';
import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import { getEntityFromPath } from 'src/dnd/util/data';
import {
  InlineField,
  getTaskStatusDone,
  getTaskStatusPreDone,
  toggleTask,
} from 'src/parsers/helpers/inlineMetadata';

import { SearchContextProps } from './context';
import { Board, DataKey, DateColor, Item, Lane, PageData, TagColor } from './types';

// 이 플러그인의 모든 BEM 클래스명이 공유하는 최상위(block) 이름
export const baseClassName = 'kanban-plugin';

// 아무 동작도 하지 않는 빈 함수. 콜백 prop의 기본값(no-op) 등으로 사용
export function noop() {}

// c() 함수가 생성한 클래스명을 재사용하기 위한 캐시(Map). 같은 className 인자에 대해
// 매번 문자열을 새로 만들지 않고 캐시된 값을 반환해 약간의 성능 이점을 얻는다.
const classCache = new Map<string, string>();
// c(): BEM 스타일(`block__element`)의 CSS 클래스명을 생성하는 헬퍼.
// baseClassName('kanban-plugin')을 블록으로, 인자로 받은 className을 엘리먼트로 하여
// `kanban-plugin__<className>` 형태의 문자열을 만들고 캐시에 저장한 뒤 반환한다.
export function c(className: string) {
  if (classCache.has(className)) return classCache.get(className);
  const cls = `${baseClassName}__${className}`;
  classCache.set(className, cls);
  return cls;
}

// generateInstanceId: len(기본 9자리) 길이의 임의의 영숫자 문자열 ID를 생성한다.
// Math.random()의 결과를 36진수 문자열로 변환한 뒤 소수점 이하 부분(정수부 "0." 제거)에서
// 앞의 "0."을 건너뛰고 필요한 길이만큼 잘라내는 방식으로 구현되어 있다.
export function generateInstanceId(len: number = 9): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + len);
}

// maybeCompleteForMove: 아이템이 한 레인에서 다른 레인으로 이동(드래그 등)할 때,
// 출발 레인/도착 레인의 shouldMarkItemsComplete 설정에 따라 체크박스 완료 상태를
// 자동으로 켜거나 꺼야 하는지 판단하고, 실제 마크다운 텍스트(체크박스 표기)까지
// 갱신한 새 Item(및 필요 시 대체 아이템)을 반환하는 함수.
export function maybeCompleteForMove(
  sourceStateManager: StateManager,
  sourceBoard: Board,
  sourcePath: Path,
  destinationStateManager: StateManager,
  destinationBoard: Board,
  destinationPath: Path,
  item: Item
): { next: Item; replacement?: Item } {
  // 경로(path)에서 마지막 인덱스를 제외한 부분으로 부모(레인) 엔티티를 조회
  const sourceParent = getEntityFromPath(sourceBoard, sourcePath.slice(0, -1));
  const destinationParent = getEntityFromPath(destinationBoard, destinationPath.slice(0, -1));

  const oldShouldComplete = sourceParent?.data?.shouldMarkItemsComplete;
  const newShouldComplete = destinationParent?.data?.shouldMarkItemsComplete;

  // If neither the old or new lane set it complete, leave it alone
  // 출발/도착 레인 둘 다 "완료 자동 처리" 설정이 없다면 아이템을 그대로 둔다.
  if (!oldShouldComplete && !newShouldComplete) return { next: item };

  const isComplete = item.data.checked && item.data.checkChar === getTaskStatusDone();

  // If it already matches the new lane, leave it alone
  // 아이템의 현재 완료 상태가 이미 도착 레인이 요구하는 상태와 일치한다면 그대로 둔다.
  if (newShouldComplete === isComplete) return { next: item };

  if (newShouldComplete) {
    // 완료 처리 대상이면 우선 checkChar를 "완료 예정(pre-done)" 문자로 바꿔둔다.
    item = update(item, { data: { checkChar: { $set: getTaskStatusPreDone() } } });
  }

  // toggleTask: 체크박스 관련 텍스트(예: 반복 작업 처리 등)까지 고려하여 실제 마크다운 문자열을 토글
  const updates = toggleTask(item, destinationStateManager.file);

  if (updates) {
    // toggleTask가 여러 개의 결과 문자열(예: 반복 작업 완료 시 원본+다음 회차 등)을 반환한 경우 처리
    const [itemStrings, checkChars, thisIndex] = updates;
    let next: Item;
    let replacement: Item;

    itemStrings.forEach((str, i) => {
      if (i === thisIndex) {
        // 이동된 원래 아이템에 해당하는 인덱스 - 도착 stateManager 기준으로 새 Item 객체 생성
        next = destinationStateManager.getNewItem(str, checkChars[i]);
      } else {
        // 그 외 인덱스는 함께 생성되어야 하는 대체/추가 아이템 (예: 반복 작업의 다음 회차)
        replacement = destinationStateManager.getNewItem(str, checkChars[i]);
      }
    });

    return { next, replacement };
  }

  // It's different, update it
  // toggleTask가 별도 결과를 주지 않은 경우 - checked/checkChar 필드만 단순히 갱신
  return {
    next: update(item, {
      data: {
        checked: {
          $set: newShouldComplete,
        },
        checkChar: {
          $set: newShouldComplete ? getTaskStatusDone() : ' ',
        },
      },
    }),
  };
}

// useIMEInputProps: 한글/일본어/중국어 등 조합형(IME) 입력 중인지 여부를 추적하는 커스텀 훅.
// 조합 입력 도중(예: 한글 자모 조합 중) Enter 등 키 이벤트를 오작동으로 처리하지 않도록
// 조합 시작/종료 이벤트 핸들러와, 현재 조합 중인지 조회하는 함수를 함께 반환한다.
export function useIMEInputProps() {
  const isComposingRef = Preact.useRef<boolean>(false);

  return {
    // Note: these are lowercased because we use preact
    // See: https://github.com/preactjs/preact/issues/3003
    // (Preact 특성상 이벤트 핸들러 prop 이름을 소문자로 써야 정상 동작하는 이슈에 대한 원본 주석)
    oncompositionstart: () => {
      isComposingRef.current = true; // IME 조합 입력 시작
    },
    oncompositionend: () => {
      isComposingRef.current = false; // IME 조합 입력 종료
    },
    getShouldIMEBlockAction: () => {
      // 현재 조합 입력 중이면 true를 반환하여, 호출부에서 Enter 등 특정 동작을 잠시 막을 수 있게 함
      return isComposingRef.current;
    },
  };
}

// 템플릿 파일 내용에 "<%"가 포함되어 있으면 Templater 플러그인 문법으로 간주하기 위한 정규식
export const templaterDetectRegex = /<%/;

// applyTemplate: 새 아이템/노트 생성 시 지정된 템플릿 파일 내용을 현재 활성 문서에 적용하는 함수.
// Templates(내장) 플러그인과 Templater(커뮤니티) 플러그인이 모두 활성화된 경우 우선순위를 판단하고,
// 둘 다 없으면 템플릿 파일 내용을 그냥 그대로 현재 파일에 추가(append)한다.
export async function applyTemplate(stateManager: StateManager, templatePath?: string) {
  const templateFile = templatePath
    ? stateManager.app.vault.getAbstractFileByPath(templatePath)
    : null;

  if (templateFile && templateFile instanceof TFile) {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);

    try {
      // Force the view to source mode, if needed
      // 템플릿 삽입 전, 편집 뷰가 소스 모드가 아니면 강제로 소스 모드로 전환 (history: false로 실행 취소 기록에 남기지 않음)
      if (activeView?.getMode() !== 'source') {
        await activeView.setState(
          {
            ...activeView.getState(),
            mode: 'source',
          },
          { history: false }
        );
      }

      const { templatesEnabled, templaterEnabled, templatesPlugin, templaterPlugin } =
        getTemplatePlugins(stateManager.app);

      const templateContent = await stateManager.app.vault.read(templateFile);

      // If both plugins are enabled, attempt to detect templater first
      // 두 플러그인이 모두 활성화된 경우, 템플릿 내용에 Templater 전용 문법(<%)이 있는지 먼저 검사
      if (templatesEnabled && templaterEnabled) {
        if (templaterDetectRegex.test(templateContent)) {
          return await templaterPlugin.append_template_to_active_file(templateFile);
        }

        return await templatesPlugin.instance.insertTemplate(templateFile);
      }

      if (templatesEnabled) {
        return await templatesPlugin.instance.insertTemplate(templateFile);
      }

      if (templaterEnabled) {
        return await templaterPlugin.append_template_to_active_file(templateFile);
      }

      // No template plugins enabled so we can just append the template to the doc
      // 템플릿 관련 플러그인이 전혀 활성화되지 않았다면, 템플릿 내용을 현재 활성 파일에 그대로 덧붙인다.
      await stateManager.app.vault.modify(
        stateManager.app.workspace.getActiveFile(),
        templateContent
      );
    } catch (e) {
      console.error(e);
      stateManager.setError(e);
    }
  }
}

// getDefaultDateFormat: 날짜 기본 표시 형식을 결정하는 함수.
// 우선순위: (1) Daily Notes 내장 플러그인의 날짜 형식 → (2) Natural Language Dates 플러그인의 형식
// → (3) Templates 내장 플러그인의 날짜 형식 → (4) 그래도 없으면 하드코딩된 'YYYY-MM-DD'
export function getDefaultDateFormat(app: App) {
  const internalPlugins = (app as any).internalPlugins.plugins;
  const dailyNotesEnabled = internalPlugins['daily-notes']?.enabled;
  const dailyNotesValue = internalPlugins['daily-notes']?.instance.options.format;
  const nlDatesValue = (app as any).plugins.plugins['nldates-obsidian']?.settings.format;
  const templatesEnabled = internalPlugins.templates?.enabled;
  const templatesValue = internalPlugins.templates?.instance.options.dateFormat;

  return (
    (dailyNotesEnabled && dailyNotesValue) ||
    nlDatesValue ||
    (templatesEnabled && templatesValue) ||
    'YYYY-MM-DD'
  );
}

// getDefaultTimeFormat: 시간 기본 표시 형식을 결정하는 함수.
// 우선순위: (1) Natural Language Dates 플러그인 형식 → (2) Templates 플러그인 형식 → (3) 'HH:mm'
export function getDefaultTimeFormat(app: App) {
  const internalPlugins = (app as any).internalPlugins.plugins;
  const nlDatesValue = (app as any).plugins.plugins['nldates-obsidian']?.settings.timeFormat;
  const templatesEnabled = internalPlugins.templates?.enabled;
  const templatesValue = internalPlugins.templates?.instance.options.timeFormat;

  return nlDatesValue || (templatesEnabled && templatesValue) || 'HH:mm';
}

// 정규식에서 특수한 의미를 갖는 문자들을 이스케이프하기 위한 매칭용 정규식
const reRegExChar = /[\\^$.*+?()[\]{}|]/g;
// 위 정규식과 동일한 소스를 재사용하되, test()로 "이스케이프가 필요한 문자가 있는지"만 빠르게 검사하기 위한 정규식
const reHasRegExChar = RegExp(reRegExChar.source);

// escapeRegExpStr: 사용자가 입력한 일반 문자열을 정규식 리터럴 안에 안전하게 삽입할 수 있도록
// 정규식 특수문자 앞에 백슬래시를 붙여 이스케이프 처리한다. (예: 검색어를 정규식으로 변환할 때 사용)
export function escapeRegExpStr(str: string) {
  return str && reHasRegExChar.test(str) ? str.replace(reRegExChar, '\\$&') : str || '';
}

// getTemplatePlugins: Templates(내장) 플러그인과 Templater(커뮤니티) 플러그인의 활성화 여부,
// 인스턴스, 템플릿 폴더 경로 등 템플릿 적용에 필요한 정보를 한 번에 모아 반환하는 헬퍼.
export function getTemplatePlugins(app: App) {
  const templatesPlugin = (app as any).internalPlugins.plugins.templates;
  const templatesEnabled = templatesPlugin.enabled;
  const templaterPlugin = (app as any).plugins.plugins['templater-obsidian'];
  const templaterEnabled = (app as any).plugins.enabledPlugins.has('templater-obsidian');
  const templaterEmptyFileTemplate =
    templaterPlugin &&
    (this.app as any).plugins.plugins['templater-obsidian'].settings?.empty_file_template;

  const templateFolder = templatesEnabled
    ? templatesPlugin.instance.options.folder
    : templaterPlugin
      ? templaterPlugin.settings.template_folder
      : undefined;

  return {
    templatesPlugin,
    templatesEnabled,
    templaterPlugin: templaterPlugin?.templater,
    templaterEnabled,
    templaterEmptyFileTemplate,
    templateFolder,
  };
}

// getTagColorFn: 설정에 등록된 TagColor 목록을 태그 이름 → TagColor 매핑(Map 형태 객체)으로
// 변환한 뒤, 특정 태그 문자열을 받아 해당하는 TagColor(없으면 null)를 반환하는 조회 함수를 만들어 준다.
export function getTagColorFn(tagColors: TagColor[]) {
  const tagMap = (tagColors || []).reduce<Record<string, TagColor>>((total, current) => {
    if (!current.tagKey) return total; // 태그 키가 비어있는 항목은 무시
    total[current.tagKey] = current;
    return total;
  }, {});

  return (tag: string) => {
    if (tagMap[tag]) return tagMap[tag];
    return null;
  };
}

// useGetTagColorFn: 'tag-colors' 설정을 구독하고, 설정이 바뀔 때만 getTagColorFn으로
// 새 조회 함수를 재생성하는(useMemo) 커스텀 훅. 컴포넌트에서 태그 색상을 조회할 때 사용.
export function useGetTagColorFn(stateManager: StateManager): (tag: string) => TagColor {
  const tagColors = stateManager.useSetting('tag-colors');
  return useMemo(() => getTagColorFn(tagColors), [tagColors]);
}

// getDateColorFn: 설정에 등록된 DateColor 규칙 목록을 기준 시점(오늘/이전/이후 또는 특정 moment 날짜)
// 순으로 정렬한 뒤, 임의의 날짜를 받아 어떤 규칙에 해당하는지 찾아 그 DateColor를 반환하는 조회 함수를 만든다.
export function getDateColorFn(dateColors: DateColor[]) {
  // 각 규칙을 "정렬 비교에 쓰일 기준값(moment 날짜 또는 'today'/'before'/'after' 문자열)"과
  // "원본 규칙 객체"의 튜플로 변환한다.
  const orders = (dateColors || []).map<[moment.Moment | 'today' | 'before' | 'after', DateColor]>(
    (c) => {
      if (c.isToday) {
        return ['today', c];
      }

      if (c.isBefore) {
        return ['before', c];
      }

      if (c.isAfter) {
        return ['after', c];
      }

      // distance/unit/direction 조합으로 기준 시점을 계산 (direction이 'after'면 +방향, 아니면 -방향)
      const modifier = c.direction === 'after' ? 1 : -1;
      const date = moment();

      date.add(c.distance * modifier, c.unit);

      return [date, c];
    }
  );

  // 규칙들을 비교하기 쉬운 순서로 정렬: 'today' 규칙을 오늘에 가장 가깝게, 'before'/'after' 규칙은 뒤로 배치
  const now = moment();
  orders.sort((a, b) => {
    if (a[0] === 'today') {
      return typeof b[0] === 'string' ? -1 : b[0].isSame(now, 'day') ? 1 : -1;
    }
    if (b[0] === 'today') {
      return typeof a[0] === 'string' ? 1 : a[0].isSame(now, 'day') ? -1 : 1;
    }

    if (a[0] === 'after') return 1;
    if (a[0] === 'before') return 1;
    if (b[0] === 'after') return -1;
    if (b[0] === 'before') return -1;

    return a[0].isBefore(b[0]) ? -1 : 1;
  });

  // 실제 조회 함수: 주어진 날짜(date)가 정렬된 규칙들 중 어느 것에 해당하는지 순서대로 찾아 반환
  return (date: moment.Moment) => {
    const now = moment();
    const result = orders.find((o) => {
      const key = o[1];
      if (key.isToday) return date.isSame(now, 'day');
      if (key.isAfter) return date.isAfter(now);
      if (key.isBefore) return date.isBefore(now);

      let granularity: moment.unitOfTime.StartOf = 'days';

      if (key.unit === 'hours') {
        granularity = 'hours';
      }

      if (key.direction === 'before') {
        return date.isBetween(o[0], now, granularity, '[]');
      }

      return date.isBetween(now, o[0], granularity, '[]');
    });

    if (result) {
      return result[1];
    }

    return null;
  };
}

// useGetDateColorFn: 'date-colors' 설정을 구독하고, 설정이 바뀔 때만 getDateColorFn으로
// 새 조회 함수를 재생성하는(useMemo) 커스텀 훅. 컴포넌트에서 날짜 색상을 조회할 때 사용.
export function useGetDateColorFn(
  stateManager: StateManager
): (date: moment.Moment) => DateColor | null {
  const dateColors = stateManager.useSetting('date-colors');
  return useMemo(() => getDateColorFn(dateColors), [dateColors]);
}

// parseMetadataWithOptions: 인라인 메타데이터(InlineField, key/value)를 설정된 metadataKeys
// 목록과 매칭시켜 표시 옵션(label, containsMarkdown 등)을 결합한 PageData로 변환한다.
// 매칭되는 설정이 없으면 키 이름을 그대로 라벨로 사용하는 기본값을 만들어 반환한다.
export function parseMetadataWithOptions(data: InlineField, metadataKeys: DataKey[]): PageData {
  const options = metadataKeys.find((opts) => opts.metadataKey === data.key);

  return options
    ? {
        ...options,
        value: data.value,
      }
    : {
        containsMarkdown: false,
        label: data.key,
        metadataKey: data.key,
        shouldHideLabel: false,
        value: data.value,
      };
}

// useOnMount: 여러 개의 DOM 참조(refs)가 모두 실제 DOM에 삽입(마운트)된 후에 콜백(cb)을
// 한 번만 호출해 주는 커스텀 훅. 각 ref의 onNodeInserted를 구독해 삽입될 때마다 카운트를 올리고,
// refs.length에 도달하면 cb를 실행한다. 언마운트 시에는 onUnmount 콜백을 실행한다.
// 의존성 배열이 빈 배열([])이므로 컴포넌트 마운트 시 한 번만 등록된다.
export function useOnMount(refs: RefObject<HTMLElement>[], cb: () => void, onUnmount?: () => void) {
  useEffect(() => {
    let complete = 0;
    let unmounted = false;
    const onDone = () => {
      if (unmounted) return; // 이미 언마운트되었다면 늦게 도착한 콜백은 무시
      if (++complete === refs.length) {
        cb();
      }
    };
    for (const ref of refs) ref.current?.onNodeInserted(onDone, true);
    return () => {
      unmounted = true;
      onUnmount();
    };
  }, []);
}

// useSearchValue: 보드 데이터(board)와 검색어(query)를 받아 검색어에 매칭되는 레인/아이템 집합과
// 검색 상태를 갱신하는 함수(search)를 계산해 SearchContextProps 형태로 반환하는 커스텀 훅.
// Kanban.tsx에서 SearchContext.Provider에 넘길 값을 만드는 데 사용된다.
export function useSearchValue(
  board: Board,
  query: string,
  setSearchQuery: Dispatch<StateUpdater<string>>,
  setDebouncedSearchQuery: Dispatch<StateUpdater<string>>,
  setIsSearching: Dispatch<StateUpdater<boolean>>
) {
  // 의존성 배열: [board, query, setSearchQuery, setDebouncedSearchQuery] - 보드나 검색어가 바뀔 때만 재계산
  return useMemo<SearchContextProps>(() => {
    // 검색어를 앞뒤 공백 제거 + 소문자 변환하여 정규화 (titleSearch도 동일하게 정규화되어 있음을 전제로 함)
    query = query.trim().toLocaleLowerCase();

    const lanes = new Set<Lane>();
    const items = new Set<Item>();

    if (query) {
      // 모든 레인의 모든 아이템을 순회하며 title에 검색어가 포함되는지 검사
      board.children.forEach((lane) => {
        let laneMatched = false;
        lane.children.forEach((item) => {
          if (item.data.titleSearch.includes(query)) {
            laneMatched = true;
            items.add(item);
          }
        });
        // 레인 안에 매칭된 아이템이 하나라도 있으면 해당 레인도 매칭된 것으로 표시
        if (laneMatched) lanes.add(lane);
      });
    }

    return {
      lanes,
      items,
      query,
      // search: 외부(예: 검색 입력창)에서 호출해 검색어 상태를 갱신하는 함수
      search: (query, immediate) => {
        if (!query) {
          // 빈 검색어면 검색 모드를 완전히 종료
          setIsSearching(false);
          setSearchQuery('');
          setDebouncedSearchQuery('');
        }
        setIsSearching(true);
        if (immediate) {
          // immediate=true면 디바운스를 건너뛰고 즉시 두 상태(입력값/디바운스값)를 함께 갱신
          setSearchQuery(query);
          setDebouncedSearchQuery(query);
        } else {
          setSearchQuery(query);
        }
      },
    };
  }, [board, query, setSearchQuery, setDebouncedSearchQuery]);
}
