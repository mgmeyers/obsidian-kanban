/**
 * ============================================================================
 * [실행 순서 #14] StateManager.ts — 보드(파일) 단위 상태 저장소
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화 / 실행-저장·동기화
 * 이 클래스는 칸반 보드(마크다운 파일) 한 개당 정확히 하나의 인스턴스만 생성되는
 * "단일 진실 공급원(single source of truth)"이다. Redux 같은 전역 상태 관리 라이브러리를
 * 쓰지 않은 이유는, 보드마다 독립적인 상태(state)와 설정(settings)만 관리하면 되고
 * 여러 보드 간에 상태를 공유할 필요가 없어 전역 스토어가 오히려 과한 설계이기 때문이다.
 * 대신 아주 단순한 구독자 배열(stateReceivers)과 설정별 구독자 맵(settingsNotifiers)만으로
 * 발행-구독(pub/sub) 패턴을 직접 구현했다. 같은 마크다운 파일을 여러 창(pane)에서 동시에
 * 열어도, 각 KanbanView는 파일 경로가 같으면 동일한 StateManager 인스턴스를 공유하도록
 * main.ts의 addView()에서 재사용되므로, 한 쪽에서 상태를 변경하면 setState()가 모든
 * 구독자(stateReceivers)에게 새 상태를 브로드캐스트하여 다른 창도 즉시 동기화된다.
 * ============================================================================
 */
// immutability-helper의 update() 함수: 불변(immutable) 객체를 직접 수정하지 않고
// $set, $push 등의 "스펙(spec)" 객체를 사용해 새로운 객체를 생성해 반환한다.
// (예: update(obj, { a: { $set: 1 } }) => obj.a를 1로 바꾼 새 객체를 반환)
import update from 'immutability-helper';
import { App, TFile, moment } from 'obsidian';
// Preact의 useEffect/useState 훅. esbuild 번들 설정에서 react -> preact/compat으로
// alias되어 있어, react 훅과 동일한 사용법으로 Preact 컴포넌트에서 쓸 수 있다.
import { useEffect, useState } from 'preact/compat';

import { KanbanView } from './KanbanView';
import { KanbanSettings, SettingRetrievers } from './Settings';
import { getDefaultDateFormat, getDefaultTimeFormat } from './components/helpers';
import { Board, BoardTemplate, Item } from './components/types';
import { ListFormat } from './parsers/List';
import { BaseFormat, frontmatterKey, shouldRefreshBoard } from './parsers/common';
import { getTaskStatusDone } from './parsers/helpers/inlineMetadata';
import { defaultDateTrigger, defaultMetadataPosition, defaultTimeTrigger } from './settingHelpers';

export class StateManager {
  // 이 StateManager가 관리하던 마지막 뷰(view)가 닫혀서 더 이상 구독자가 없을 때 호출되는 콜백.
  // main.ts 쪽에서 전달받아, viewSet이 비면 StateManager 자체를 정리(GC)할 수 있게 한다.
  onEmpty: () => void;
  // 플러그인 전역 설정(모든 보드에 공통 적용되는 기본값)을 가져오는 함수.
  // 개별 보드의 frontmatter 설정이 없을 때 이 전역 설정으로 폴백(fallback)한다.
  getGlobalSettings: () => KanbanSettings;

  // [구독 목록 1] "보드 상태 전체"를 구독하는 콜백 목록.
  // 주로 useState() 훅에서 등록되며, 보드의 데이터(리스트/카드 등)가 바뀔 때마다
  // 여기 등록된 모든 함수가 새 Board 객체를 인자로 받아 호출된다(= Preact의 setState 호출로 이어짐).
  stateReceivers: Array<(state: Board) => void> = [];
  // [구독 목록 2] "설정 키(key) 단위"로 구독하는 콜백 목록.
  // stateReceivers와 달리, 특정 설정값 하나(K)가 실제로 변경되었을 때만 해당 key에 등록된
  // 콜백들만 선택적으로 호출된다. useSetting(key) 훅이 이 맵을 사용하며,
  // 컴포넌트가 자신과 무관한 설정 변경에는 리렌더링되지 않도록 하여 불필요한 렌더링을 줄인다.
  settingsNotifiers: Map<keyof KanbanSettings, Array<() => void>> = new Map();

  // 같은 보드 파일을 열람 중인 KanbanView(에디터 탭/창) 인스턴스들의 집합.
  // Set을 사용하므로 같은 뷰가 중복 등록되지 않는다. 여러 창에서 같은 파일을 열어도
  // 이 Set에 여러 KanbanView가 들어가고, 상태 변경 시 모두에게 알림이 전파된다.
  viewSet: Set<KanbanView> = new Set();
  // compileSettings()가 계산해낸, "이 보드에 실제로 적용되는 최종 설정값" 캐시.
  // (보드 자체 설정 > 전역 설정 > 하드코딩된 기본값 순으로 병합된 결과)
  compiledSettings: KanbanSettings = {};

  app: App;
  // 현재 보드의 상태(리스트, 카드, 설정, 에러 등을 모두 포함하는 불변 트리 구조).
  state: Board;
  // 이 StateManager가 담당하는 실제 마크다운 파일(Obsidian TFile).
  file: TFile;

  // 마크다운 <-> Board 객체 간 변환을 담당하는 파서. 현재는 리스트 기반 포맷(ListFormat)만
  // 존재하며, #58 parsers/List.ts 에서 구현된다. BaseFormat은 공통 인터페이스 타입.
  parser: BaseFormat;

  constructor(
    app: App,
    initialView: KanbanView,
    initialData: string,
    onEmpty: () => void,
    getGlobalSettings: () => KanbanSettings
  ) {
    this.app = app;
    // 최초로 이 StateManager를 생성한 뷰의 파일을 이 인스턴스가 다룰 파일로 고정한다.
    this.file = initialView.file;
    this.onEmpty = onEmpty;
    this.getGlobalSettings = getGlobalSettings;
    // 파서에 this(StateManager 자신)를 넘겨, 파서가 설정값 조회(getSetting 등)를
    // StateManager를 통해 할 수 있도록 연결한다.
    this.parser = new ListFormat(this);

    // 생성자에서 곧바로 최초 뷰를 등록하고, shouldParseData=true로 첫 파싱을 트리거한다.
    this.registerView(initialView, initialData, true);
  }

  // viewSet에 등록된 여러 뷰 중 아무거나 하나를 대표로 가져온다.
  // (저장, 헤더 버튼 갱신 등 "뷰가 하나만 있으면 충분한" 작업에 사용)
  getAView(): KanbanView {
    return this.viewSet.values().next().value;
  }

  // 현재 보드 상태에 파싱 에러 등이 기록되어 있는지 확인한다(옵셔널 체이닝으로 안전하게 접근).
  hasError(): boolean {
    return !!this.state?.data?.errors?.length;
  }

  // 새 뷰(탭/창)가 이 StateManager를 구독하기 시작할 때 호출된다.
  // shouldParseData가 true면 마크다운을 새로 파싱하고, false면(이미 파싱된 state가 있으면)
  // 그 state를 그대로 재사용해 렌더링만 다시 요청한다(= 같은 파일을 두 번째 창에서 열 때).
  async registerView(view: KanbanView, data: string, shouldParseData: boolean) {
    if (!this.viewSet.has(view)) {
      this.viewSet.add(view);
    }

    // This helps delay blocking the UI until the the loading indicator is displayed
    // (0ms가 아닌 10ms 지연을 줘서, 로딩 스피너 등이 화면에 그려질 시간을 확보한 뒤
    //  무거운 파싱 작업을 시작하도록 한다 — 브라우저의 다음 페인트 프레임을 양보)
    await new Promise((res) => activeWindow.setTimeout(res, 10));

    if (shouldParseData) {
      // 마크다운 원문을 처음부터 파싱하여 새 보드를 만든다.
      await this.newBoard(view, data);
    } else {
      // 이미 만들어진 this.state를 그대로 사용해 뷰만 미리 렌더링(prerender).
      await view.prerender(this.state);
    }

    // 파싱/로드가 끝난 뒤, 뷰의 내부 상태(뷰 모드 등)를 보드 설정에 맞게 채워 넣는다.
    view.populateViewState(this.state.data.settings);
  }

  // 뷰가 닫힐 때 호출된다. 구독 목록에서 제거하고, 더 이상 구독 중인 뷰가 하나도 없으면
  // onEmpty() 콜백을 호출해 상위(main.ts)가 이 StateManager를 정리할 수 있게 알린다.
  unregisterView(view: KanbanView) {
    if (this.viewSet.has(view)) {
      this.viewSet.delete(view);

      if (this.viewSet.size === 0) {
        this.onEmpty();
      }
    }
  }

  // 설정 화면(Settings UI) 등에서 필요로 하는, 설정을 조회하는 3가지 함수 묶음을 만들어 반환한다.
  // 화살표 함수로 정의된 getGlobalSetting/getSetting(아래 참고)을 그대로 전달하므로,
  // 구조 분해되어 다른 곳에 전달되어도 this 바인딩이 유지된다(화살표 함수 특성).
  buildSettingRetrievers(): SettingRetrievers {
    return {
      getGlobalSettings: this.getGlobalSettings,
      getGlobalSetting: this.getGlobalSetting,
      getSetting: this.getSetting,
    };
  }

  // 마크다운 문자열(md)을 파싱해 완전히 새로운 보드를 만들고 상태로 반영한다.
  // (파일을 처음 열었을 때, 혹은 외부에서 파일이 수정되어 다시 읽어야 할 때 사용)
  async newBoard(view: KanbanView, md: string) {
    try {
      const board = this.getParsedBoard(md);
      await view.prerender(board);
      // shouldSave=false: 방금 디스크에서 읽어온 내용이므로 다시 디스크에 쓸 필요가 없다.
      this.setState(board, false);
    } catch (e) {
      this.setError(e);
    }
  }

  // 현재 보드 상태(this.state)를 다시 마크다운 문자열로 직렬화하여 디스크에 저장 요청한다.
  saveToDisk() {
    // 파싱 에러가 있는 상태라면(예: 문법이 깨진 마크다운) 잘못된 내용으로 덮어쓰지 않도록 저장을 건너뛴다.
    if (this.state.data.errors.length > 0) {
      return;
    }

    const view = this.getAView();

    if (view) {
      // 파서를 이용해 Board 객체 -> 마크다운 문자열로 변환.
      const fileStr = this.parser.boardToMd(this.state);
      // 실제 디스크 쓰기는 KanbanView(#15)에게 위임한다(디바운스/파일 API 처리 등을 뷰가 담당).
      view.requestSaveToDisk(fileStr);

      // 같은 파일을 보고 있는 모든 뷰의 캐시된 원문(data)도 최신 문자열로 맞춰둔다.
      // (그래야 나중에 파일 변경 감지 로직이 "실제로 바뀐 게 맞는지" 비교할 때 정확하다)
      this.viewSet.forEach((view) => {
        view.data = fileStr;
      });
    }
  }

  // 설정 재계산이나 재파싱 없이, 현재 state를 얕은 복사(spread)하여 구독자들에게 다시 전달한다.
  // Preact가 참조 동등성(reference equality)으로 변경을 감지하므로, 객체를 새로 만들어야
  // 리렌더링이 트리거된다는 점에 유의(내용은 같아도 참조가 다르면 리렌더링됨).
  softRefresh() {
    this.stateReceivers.forEach((receiver) => receiver({ ...this.state }));
  }

  // 설정을 다시 컴파일하고 마크다운을 처음부터 재파싱하여 완전히 새로 그린다.
  // (플러그인 설정이 바뀌어 파싱 규칙 자체가 달라졌을 때 등, softRefresh보다 훨씬 무거운 갱신)
  forceRefresh() {
    if (this.state) {
      try {
        this.compileSettings();
        // parser.reparseBoard(): 기존에 저장해둔 원문을 기준으로 보드를 다시 파싱한다.
        this.state = this.parser.reparseBoard();

        // 두 구독 목록(state 전체 구독자 + 설정별 구독자) 모두에게 변경을 알린다.
        this.stateReceivers.forEach((receiver) => receiver(this.state));
        this.settingsNotifiers.forEach((notifiers) => {
          notifiers.forEach((fn) => fn());
        });
        this.viewSet.forEach((view) => view.initHeaderButtons());
      } catch (e) {
        console.error(e);
        this.setError(e);
      }
    }
  }

  // 보드 상태를 갱신하는 핵심 함수. state는 새 Board 객체 자체이거나, 이전 state를 받아
  // 새 state를 반환하는 함수(리듀서 스타일 업데이트) 둘 다 허용한다.
  setState(state: Board | ((board: Board) => Board), shouldSave: boolean = true) {
    try {
      const oldSettings = this.state?.data.settings;
      // state가 함수라면 현재 state를 인자로 호출해 새 state를 얻고,
      // 객체라면 그대로 사용한다(삼항 연산자로 두 오버로드를 한 번에 처리).
      const newState = typeof state === 'function' ? state(this.state) : state;
      const newSettings = newState?.data.settings;

      // [핵심 분기] 설정이 바뀌어서 "재파싱"까지 필요한 경우인지 판별한다.
      // shouldRefreshBoard(oldSettings, newSettings)는 parsers/common.ts(#?)에 정의되어 있으며,
      // 날짜 형식/트리거 문자 등 "마크다운을 파싱하는 방식 자체"에 영향을 주는 설정이
      // 바뀌었는지를 비교한다. 단순히 카드 순서를 바꾸는 등 파싱 규칙과 무관한 변경은
      // 여기 해당하지 않아 else 분기(가벼운 갱신)로 처리된다.
      if (oldSettings && newSettings && shouldRefreshBoard(oldSettings, newSettings)) {
        // immutability-helper의 update() 스펙 문법:
        // { data: { settings: { $set: newSettings } } } 는
        // "this.state.data.settings 경로만 newSettings로 교체한 새 객체를 만들어라"는 뜻이다.
        // 나머지 트리(children 등)는 기존 참조를 그대로 재사용하므로 불필요한 복사가 없다.
        this.state = update(this.state, {
          data: {
            settings: {
              $set: newSettings,
            },
          },
        });
        // 새 설정을 반영해 최종 병합 설정(compiledSettings)을 다시 계산하고,
        this.compileSettings();
        // 원문을 설정이 바뀐 규칙으로 다시 파싱한다(예: 날짜 포맷이 바뀌면 날짜 파싱 결과도 달라짐).
        this.state = this.parser.reparseBoard();
      } else {
        // 재파싱이 필요 없는 일반적인 경우: 전달받은 새 state를 그대로 채택하고
        // 설정 캐시만 최신화한다(성능상 훨씬 저렴한 경로).
        this.state = newState;
        this.compileSettings();
      }

      // 모든 뷰에 헤더 버튼(정렬/검색 등 아이콘) 재계산과 미리보기 캐시 검증을 요청한다.
      this.viewSet.forEach((view) => {
        view.initHeaderButtons();
        view.validatePreviewCache(newState);
      });

      // 호출자가 "저장까지 해달라"고 명시한 경우에만 디스크에 반영한다.
      // (외부 파일 변경 감지로 인한 setState 등은 shouldSave=false로 호출되어 무한 저장 루프를 방지)
      if (shouldSave) {
        this.saveToDisk();
      }

      // [구독 목록 1] 알림: 보드 상태 전체를 구독하는 모든 콜백에게 최신 state를 전달.
      this.stateReceivers.forEach((receiver) => receiver(this.state));

      // 설정 객체 자체의 참조가 바뀐 경우에만(= 실제로 설정이 갱신된 경우에만) 아래 로직 실행.
      if (oldSettings !== newSettings && newSettings) {
        // [구독 목록 2] 알림: settingsNotifiers는 Map<설정키, 콜백배열> 구조이므로,
        // 등록된 각 key마다 "이전 값과 새 값이 실제로 다른가"를 개별적으로 비교해서
        // 변경된 key를 구독 중인 콜백들만 선택적으로 호출한다. 이렇게 하면 예를 들어
        // useSetting('date-format')만 쓰는 컴포넌트는 'tag-colors'가 바뀌어도 리렌더링되지 않는다.
        this.settingsNotifiers.forEach((notifiers, key) => {
          if ((!oldSettings && newSettings) || oldSettings[key] !== newSettings[key]) {
            notifiers.forEach((fn) => fn());
          }
        });
      }
    } catch (e) {
      console.error(e);
      this.setError(e);
    }
  }

  // ── Preact 커스텀 훅: 보드 상태 전체 구독 ──────────────────────────────────
  // Preact 컴포넌트(#17 Kanban.tsx 등)에서 `const board = stateManager.useState();`
  // 형태로 호출하여, 보드 상태가 바뀔 때마다 자동으로 리렌더링되도록 구독한다.
  useState(): Board {
    // 컴포넌트 로컬 state로 현재 보드를 보관. 초깃값은 StateManager가 들고 있는 최신 state.
    const [state, setState] = useState(this.state);

    // 마운트 시 1회만 실행(의존성 배열이 빈 배열 []).
    useEffect(() => {
      // stateReceivers 배열에 이 컴포넌트 전용 setState 콜백을 등록(구독 시작).
      this.stateReceivers.push((state) => setState(state));
      // 구독을 등록하는 시점과 최신 state 사이에 시간차가 있을 수 있으므로, 등록 직후
      // 한 번 더 최신 state로 강제 동기화해 둔다.
      setState(this.state);
      // useEffect의 cleanup 함수: 컴포넌트가 언마운트되거나 재실행되기 직전에 호출되어,
      // stateReceivers 배열에서 자신의 setState를 제거함으로써 구독을 해제한다.
      // 이 정리를 빼먹으면 이미 사라진 컴포넌트의 setState가 계속 호출되어 메모리 누수/에러가 난다.
      return () => {
        this.stateReceivers.remove(setState);
      };
    }, []);

    return state;
  }

  // ── Preact 커스텀 훅: 설정값 단위 구독 ────────────────────────────────────
  // <K extends keyof KanbanSettings>: 제네릭 K는 반드시 KanbanSettings의 키(key) 중 하나여야
  // 한다는 제약. 이렇게 하면 호출부에서 `useSetting('date-format')`처럼 실제 존재하는 설정
  // 이름만 넘길 수 있고, 반환 타입도 KanbanSettings[K]로 자동 추론되어(예: 'date-format'이면
  // string 타입) 타입 안전성이 보장된다.
  useSetting<K extends keyof KanbanSettings>(key: K): KanbanSettings[K] {
    // 초깃값은 현재 시점에 계산된 해당 key의 설정값.
    const [state, setState] = useState<KanbanSettings[K]>(this.getSetting(key));

    useEffect(() => {
      // key가 바뀌었을 때 최신 값을 다시 조회해 setState하는 리시버 함수를 만든다.
      const receiver = () => setState(this.getSetting(key));

      // settingsNotifiers는 Map이므로, 해당 key에 대한 배열이 이미 있으면 push,
      // 없으면(이 key를 구독하는 첫 컴포넌트라면) 새 배열을 만들어 등록한다.
      if (this.settingsNotifiers.has(key)) {
        this.settingsNotifiers.get(key).push(receiver);
      } else {
        this.settingsNotifiers.set(key, [receiver]);
      }

      // cleanup: 언마운트 시 해당 key의 구독자 배열에서 자신의 receiver만 제거(구독 해제).
      // useState()의 cleanup과 동일한 패턴이며, key 단위로 세분화되어 있다는 점만 다르다.
      return () => {
        this.settingsNotifiers.get(key).remove(receiver);
      };
    }, []);

    return state;
  }

  // 여러 출처(보드 자체 설정, 전역 설정, 기본값)에 흩어진 설정값을 하나로 병합하여
  // this.compiledSettings에 캐시해 두는 함수. 매번 getSetting을 호출할 때마다 우선순위를
  // 다시 계산하지 않도록, 설정이 바뀔 때 한 번만 이 함수를 실행해 결과를 미리 만들어 둔다.
  // suppliedSettings가 주어지면(예: 설정 화면에서 "미리보기"용으로 임시 설정을 넘길 때)
  // 그 값을 최우선으로 사용해 계산한다.
  compileSettings(suppliedSettings?: KanbanSettings) {
    // 'metadata-keys'는 특별 취급: 전역 설정과 보드별(local) 설정을 "합집합(Set)"으로 합친다.
    // 즉, 다른 설정들처럼 하나만 선택하는 게 아니라 전역+로컬 메타데이터 키를 모두 사용하겠다는 의미.
    const globalKeys = this.getGlobalSetting('metadata-keys') || [];
    const localKeys = this.getSettingRaw('metadata-keys', suppliedSettings) || [];
    const metadataKeys = Array.from(new Set([...globalKeys, ...localKeys]));

    // 날짜/시간 관련 설정들은 서로 기본값을 참조하는 연쇄 구조를 가진다:
    // dateFormat이 없으면 Obsidian 자체의 기본 날짜 형식(getDefaultDateFormat)을 쓰고,
    const dateFormat =
      this.getSettingRaw('date-format', suppliedSettings) || getDefaultDateFormat(this.app);
    // dateDisplayFormat이 없으면 위에서 구한 dateFormat을 그대로 표시용으로도 사용한다.
    const dateDisplayFormat =
      this.getSettingRaw('date-display-format', suppliedSettings) || dateFormat;

    const timeFormat =
      this.getSettingRaw('time-format', suppliedSettings) || getDefaultTimeFormat(this.app);

    // 아카이브 날짜 형식이 별도로 지정 안 되어 있으면 "날짜형식 + 시간형식"을 조합해 기본값으로 삼는다.
    const archiveDateFormat =
      this.getSettingRaw('archive-date-format', suppliedSettings) || `${dateFormat} ${timeFormat}`;

    // getSettingRaw(key, suppliedSettings)의 우선순위(아래 getSettingRaw 정의 참고):
    // 1) suppliedSettings(임시로 넘겨준 설정) 2) 보드 자체 frontmatter 설정
    // 3) 전역(플러그인) 설정 순으로 값을 찾고, 그래도 없으면 여기서 `||`나 `??`로 하드코딩된
    // 최종 기본값을 사용한다. 이렇게 계산된 전체 결과를 compiledSettings 객체 하나로 모은다.
    this.compiledSettings = {
      [frontmatterKey]: this.getSettingRaw(frontmatterKey, suppliedSettings) || 'board',
      'date-format': dateFormat,
      'date-display-format': dateDisplayFormat,
      'date-time-display-format': dateDisplayFormat + ' ' + timeFormat,
      'date-trigger': this.getSettingRaw('date-trigger', suppliedSettings) || defaultDateTrigger,
      'inline-metadata-position':
        this.getSettingRaw('inline-metadata-position', suppliedSettings) || defaultMetadataPosition,
      'time-format': timeFormat,
      'time-trigger': this.getSettingRaw('time-trigger', suppliedSettings) || defaultTimeTrigger,
      'link-date-to-daily-note': this.getSettingRaw('link-date-to-daily-note', suppliedSettings),
      'move-dates': this.getSettingRaw('move-dates', suppliedSettings),
      'move-tags': this.getSettingRaw('move-tags', suppliedSettings),
      'move-task-metadata': this.getSettingRaw('move-task-metadata', suppliedSettings),
      'metadata-keys': metadataKeys,
      'archive-date-separator': this.getSettingRaw('archive-date-separator') || '',
      'archive-date-format': archiveDateFormat,
      // `??`(null 병합 연산자)를 쓰는 항목들은 값이 false/0처럼 falsy이어도 유효한 값으로
      // 인정해야 하는 boolean 설정들이다(`||`를 쓰면 false가 기본값으로 덮어써지는 버그가 생김).
      'show-add-list': this.getSettingRaw('show-add-list', suppliedSettings) ?? true,
      'show-archive-all': this.getSettingRaw('show-archive-all', suppliedSettings) ?? true,
      'show-view-as-markdown':
        this.getSettingRaw('show-view-as-markdown', suppliedSettings) ?? true,
      'show-board-settings': this.getSettingRaw('show-board-settings', suppliedSettings) ?? true,
      'show-search': this.getSettingRaw('show-search', suppliedSettings) ?? true,
      'show-set-view': this.getSettingRaw('show-set-view', suppliedSettings) ?? true,
      'tag-colors': this.getSettingRaw('tag-colors', suppliedSettings) ?? [],
      'tag-sort': this.getSettingRaw('tag-sort', suppliedSettings) ?? [],
      'date-colors': this.getSettingRaw('date-colors', suppliedSettings) ?? [],
      'tag-action': this.getSettingRaw('tag-action', suppliedSettings) ?? 'obsidian',
    };
  }

  // ── 설정 조회 함수들(모두 화살표 함수로 정의된 클래스 필드) ───────────────
  // 일반 메서드(getSetting(...) {...})가 아니라 화살표 함수 필드(getSetting = (...) => {...})로
  // 정의한 이유: 이 함수들은 buildSettingRetrievers()에서 this와 분리된 채(구조 분해되어)
  // 다른 컴포넌트/모듈로 전달되는 경우가 많다. 일반 메서드였다면 그렇게 넘겨졌을 때 this
  // 바인딩이 깨져 `this.compiledSettings` 등에서 오류가 나지만, 화살표 함수는 정의 시점의
  // this(=인스턴스 자신)를 클로저로 항상 고정해서 기억하므로 어디로 전달되어도 안전하다.

  // "최종적으로 사용할 설정값"을 조회한다. compileSettings()가 미리 계산해 둔 캐시
  // (compiledSettings)를 우선 사용하는, 가장 자주 쓰이는 조회 함수.
  // 제네릭 <K extends keyof KanbanSettings>는 key 인자로 실제 설정 키만 허용하고,
  // 반환값 타입도 그 key에 맞는 타입으로 자동 좁혀준다(타입 안전한 사전 조회 패턴).
  getSetting = <K extends keyof KanbanSettings>(
    key: K,
    suppliedLocalSettings?: KanbanSettings
  ): KanbanSettings[K] => {
    // 1순위: 이번 호출에 한해 임시로 전달된 설정(있다면 이것이 최우선).
    if (suppliedLocalSettings?.[key] !== undefined) {
      return suppliedLocalSettings[key];
    }

    // 2순위: 미리 계산되어 캐시된 compiledSettings(보드+전역+기본값이 이미 병합된 결과).
    if (this.compiledSettings?.[key] !== undefined) {
      return this.compiledSettings[key];
    }

    // 그래도 없다면 원시(raw) 조회 경로로 폴백.
    return this.getSettingRaw(key);
  };

  // compiledSettings 캐시를 거치지 않고, "보드 자체 설정 -> 전역 설정" 순서로 직접 조회하는
  // 저수준(raw) 함수. compileSettings() 내부에서 각 항목의 원본 값을 얻어올 때 사용된다
  // (compiledSettings는 아직 계산 "중"이므로 이 시점엔 자기 자신을 참조할 수 없기 때문).
  getSettingRaw = <K extends keyof KanbanSettings>(
    key: K,
    suppliedLocalSettings?: KanbanSettings
  ): KanbanSettings[K] => {
    // 1순위: 임시로 전달된 설정.
    if (suppliedLocalSettings?.[key] !== undefined) {
      return suppliedLocalSettings[key];
    }

    // 2순위: 이 보드의 frontmatter에 실제로 적힌 설정값.
    if (this.state?.data?.settings?.[key] !== undefined) {
      return this.state.data.settings[key];
    }

    // 3순위: 플러그인 전역 설정으로 폴백.
    return this.getGlobalSetting(key);
  };

  // 전역(플러그인 옵션 화면에서 설정한) 값만 조회한다. 없으면 null을 반환해
  // 호출자가 `||` 등으로 자체 기본값을 적용할 수 있게 한다.
  getGlobalSetting = <K extends keyof KanbanSettings>(key: K): KanbanSettings[K] => {
    const globalSettings = this.getGlobalSettings();

    if (globalSettings?.[key] !== undefined) {
      return globalSettings[key];
    }

    return null;
  };

  // 마크다운 원문(data)을 파싱해 Board 객체를 만든다. 파싱 도중 예외가 발생하면
  // 빈 보드 템플릿에 에러 정보만 채워 반환하여, 파일이 깨져 있어도 플러그인이 죽지 않고
  // "에러가 있습니다" 화면을 보여줄 수 있게 한다.
  getParsedBoard(data: string) {
    const trimmedContent = data.trim();

    // 기본 뼈대: BoardTemplate(공통 기본 구조)을 펼치고(spread), 이 파일 경로를 id로 사용.
    let board: Board = {
      ...BoardTemplate,
      id: this.file.path,
      children: [],
      data: {
        archive: [],
        settings: { [frontmatterKey]: 'board' },
        frontmatter: {},
        isSearching: false,
        errors: [],
      },
    };

    try {
      // 내용이 비어있지 않을 때만 실제 파싱을 시도(빈 파일은 빈 보드 그대로 사용).
      if (trimmedContent) {
        board = this.parser.mdToBoard(trimmedContent);
      }
    } catch (e) {
      console.error(e);

      // 파싱 실패 시, 위에서 만든 기본 board에 errors 배열만 update()의 $push 스펙으로
      // 에러 항목을 추가한다. $push는 "배열 끝에 항목을 추가한 새 배열"을 만드는 스펙 커맨드.
      board = update(board, {
        data: {
          errors: {
            $push: [{ description: e.toString(), stack: e.stack }],
          },
        },
      });
    }

    return board;
  }

  // 에러 객체를 받아 현재 state.data.errors 배열에 추가하고 setState를 호출한다.
  setError(e: Error) {
    this.setState(
      update(this.state, {
        data: {
          errors: {
            // 기존 에러 목록을 지우지 않고 새 에러를 뒤에 추가($push)한다.
            $push: [{ description: e.toString(), stack: e.stack }],
          },
        },
      }),
      // shouldSave=false: 에러 표시만을 위한 상태 갱신이므로 디스크에 다시 쓰지 않는다.
      false
    );
  }

  // Obsidian이 "이 파일의 메타데이터(frontmatter 등)가 외부에서 바뀌었다"고 알려줄 때
  // 호출되는 훅. 실제 재파싱은 reparseBoardFromMd()에 위임한다.
  onFileMetadataChange() {
    this.reparseBoardFromMd();
  }

  // 현재 뷰가 들고 있는 최신 마크다운 원문(view.data)을 기준으로 보드를 완전히 다시 파싱한다.
  // (예: 다른 앱/기기에서 파일이 수정되어 Obsidian이 변경을 감지했을 때)
  async reparseBoardFromMd() {
    try {
      // shouldSave=false: 방금 디스크(또는 동기화)에서 반영된 내용이므로 다시 저장할 필요가 없다.
      this.setState(this.getParsedBoard(this.getAView().data), false);
    } catch (e) {
      console.error(e);
      this.setError(e);
    }
  }

  // "완료됨" 상태로 체크된 카드들을 각 레인에서 걷어내어 archive 목록으로 옮기는 기능.
  async archiveCompletedCards() {
    const board = this.state;

    const archived: Item[] = [];
    // 아카이브 시 제목 앞/뒤에 완료 날짜를 붙일지 여부와 관련 서식 설정들을 미리 조회.
    const shouldAppendArchiveDate = !!this.getSetting('archive-with-date');
    const archiveDateSeparator = this.getSetting('archive-date-separator');
    const archiveDateFormat = this.getSetting('archive-date-format');
    const archiveDateAfterTitle = this.getSetting('append-archive-date');

    // 카드 제목에 "완료 날짜" 문자열을 붙여 새 제목을 만드는 헬퍼.
    const appendArchiveDate = (item: Item) => {
      const newTitle = [moment().format(archiveDateFormat)];

      if (archiveDateSeparator) newTitle.push(archiveDateSeparator);

      newTitle.push(item.data.titleRaw);

      // 설정에 따라 "날짜 - 원제목" 대신 "원제목 - 날짜" 순서로 바꾸고 싶으면 배열을 뒤집는다.
      if (archiveDateAfterTitle) newTitle.reverse();

      const titleRaw = newTitle.join(' ');

      // 파서를 통해 실제 카드 아이템의 내용(titleRaw 및 파생 필드들)을 갱신한다.
      return this.parser.updateItemContent(item, titleRaw);
    };

    // 모든 레인을 순회하며, 완료된 카드는 걸러내고(archived에 수집) 남은 카드만 유지한
    // 새 레인 배열을 만든다. update()의 $set 스펙으로 children 배열 전체를 교체.
    const lanes = board.children.map((lane) => {
      return update(lane, {
        children: {
          $set: lane.children.filter((item) => {
            // "완료" 판정: 체크박스가 체크되어 있고, 체크 문자가 '완료' 상태 문자와 일치하는 경우.
            const isComplete = item.data.checked && item.data.checkChar === getTaskStatusDone();
            // 레인 자체가 "모든 카드를 완료 처리"로 설정되어 있거나(shouldMarkItemsComplete),
            // 개별 카드가 완료 상태이면 archived 목록에 추가한다.
            if (lane.data.shouldMarkItemsComplete || isComplete) {
              archived.push(item);
            }

            // 필터 결과: 완료되지 않았고, 레인이 "전체 완료 처리" 모드도 아닌 카드만 남긴다.
            return !isComplete && !lane.data.shouldMarkItemsComplete;
          }),
        },
      });
    });

    try {
      this.setState(
        update(board, {
          // 레인 목록 전체를 위에서 새로 계산한 lanes로 교체.
          children: {
            $set: lanes,
          },
          data: {
            archive: {
              // 날짜 첨부 옵션이 켜져 있으면 archived 카드들 각각에 대해 비동기로
              // appendArchiveDate를 적용한 결과를, 꺼져 있으면 원본 그대로를 archive 배열
              // 끝에 $push한다. Promise.all로 여러 카드의 비동기 갱신을 병렬 처리.
              $push: shouldAppendArchiveDate
                ? await Promise.all(archived.map((item) => appendArchiveDate(item)))
                : archived,
            },
          },
        })
      );
    } catch (e) {
      this.setError(e);
    }
  }

  // 새 카드(Item)를 생성하는 로직을 파서에 위임하는 단순 통과(pass-through) 메서드.
  getNewItem(content: string, checkChar: string, forceEdit?: boolean) {
    return this.parser.newItem(content, checkChar, forceEdit);
  }

  // 기존 카드의 내용(content)을 갱신하는 로직도 파서에 위임한다.
  updateItemContent(item: Item, content: string) {
    return this.parser.updateItemContent(item, content);
  }
}
