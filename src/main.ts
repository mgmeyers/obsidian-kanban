/**
 * ============================================================================
 * [실행 순서 #1] main.ts — 플러그인 엔트리포인트 (KanbanPlugin)
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화
 * Obsidian 앱이 시작되면서 .obsidian/plugins/obsidian-kanban/manifest.json 을 읽고,
 * 같은 폴더의 main.js(이 파일이 esbuild로 번들링된 결과물)를 로드하는 순간 이 파일의
 * 최상위 코드(클래스 정의)가 평가되고, 이어서 Obsidian이 KanbanPlugin 인스턴스를 생성한 뒤
 * onload()를 호출하면서 실제 실행이 시작됩니다. onload()에서 설정을 불러오고, 커맨드/이벤트/뷰를
 * 등록하고, WorkspaceLeaf를 몽키패치하여 프론트매터에 특정 키가 있는 마크다운 파일을 자동으로
 * 칸반 뷰로 열리게 만들며, Preact 앱을 각 윈도우(메인 창 + 팝아웃 창들)에 마운트합니다.
 * 이 과정에서 lang/helpers.ts(다국어 번역 t 함수), parsers/common.ts(프론트매터 상수),
 * Settings.ts(설정 탭 UI), StateManager.ts(칸반 보드 데이터/상태 관리), KanbanView.tsx(실제
 * Obsidian ItemView 구현체), DragDropApp.tsx(윈도우별 Preact 루트 앱)를 import하여 사용합니다.
 * 이 파일이 전체 실행 흐름의 시작점(#1)이며, 이후 모든 기능은 이 onload()에서 뻗어나갑니다.
 * ============================================================================
 */
// monkey-around: 기존 객체의 메서드를 안전하게 감싸서(wrap) 오버라이드하고, 필요 시 원본을 호출할 수
// 있게 해주는 라이브러리. around(obj, { method(next) { return function(...) { ... next.call(this, ...) } } })
// 형태로 사용하며, this.register(...)에 등록해두면 플러그인이 언로드될 때 자동으로 원복(unpatch)된다.
import { around } from 'monkey-around';
import {
  MarkdownView,
  Platform,
  Plugin,
  TFile,
  TFolder,
  ViewState,
  WorkspaceLeaf,
  debounce,
} from 'obsidian';
// preact/compat: package.json에서 react/react-dom을 preact/compat으로 alias했기 때문에, 여기서
// render/unmountComponentAtNode/useEffect/useState는 실제로는 Preact 구현체이다. render는 리액트의
// ReactDOM.render와 동일한 역할(가상 DOM을 실제 DOM에 마운트), useEffect/useState는 함수형 컴포넌트용 훅.
import { render, unmountComponentAtNode, useEffect, useState } from 'preact/compat';

import { createApp } from './DragDropApp';
import { KanbanView, kanbanIcon, kanbanViewType } from './KanbanView';
import { KanbanSettings, KanbanSettingsTab } from './Settings';
import { StateManager } from './StateManager';
import { DateSuggest, TimeSuggest } from './components/Editor/suggest';
import { getParentWindow } from './dnd/util/getWindow';
import { hasFrontmatterKey } from './helpers';
import { t } from './lang/helpers';
import { basicFrontmatter, frontmatterKey } from './parsers/common';

// interface: TypeScript의 구조적 타입 선언. 이 플러그인은 멀티 윈도우(팝아웃 창 포함)를 지원하기
// 때문에, 창(Window)마다 별도의 "레지스트리"를 두어 그 창에 열려 있는 칸반 뷰들과, 뷰 목록이 바뀔 때
// 알림을 받아야 하는 Preact 컴포넌트(콜백 배열), 그리고 Preact 앱이 마운트된 루트 DOM 엘리먼트를
// 추적한다.
interface WindowRegistry {
  viewMap: Map<string, KanbanView>;
  viewStateReceivers: Array<(views: KanbanView[]) => void>;
  appRoot: HTMLElement;
}

// getEditorClass: Obsidian 내부(비공개) API를 리버스 엔지니어링하여, 마크다운 노트를 편집할 때 쓰는
// 내부 에디터 클래스(MarkdownEditor)를 얻어내는 함수. 공식 API로 노출되지 않은 기능이라 임시로
// 더미 마크다운 임베드를 하나 만들어 로드하고, 그 프로토타입 체인을 두 단계 거슬러 올라가
// constructor를 얻은 뒤 즉시 언로드하여 부작용을 없앤다. 이렇게 얻은 MarkdownEditor는 칸반 카드의
// 인라인 편집기(Editor 컴포넌트들)에서 재사용된다. app: any로 타입을 느슨하게 받는 이유도 비공개
// API라 공식 타입 정의가 없기 때문이다.
function getEditorClass(app: any) {
  // embedRegistry.embedByExtension.md(...)로 마크다운 임베드 인스턴스를 생성. createDiv()는
  // Obsidian이 전역으로 주입하는 헬퍼로, document.createElement('div')와 유사하지만 Obsidian
  // 스타일 클래스 지정 등 편의 기능이 있다.
  const md = app.embedRegistry.embedByExtension.md(
    { app: app, containerEl: createDiv(), state: {} },
    null,
    ''
  );

  // 임베드를 로드하고, 강제로 편집 가능 상태로 만든 뒤 에디터를 표시시켜 내부적으로
  // editMode(에디터 인스턴스)가 생성되도록 유도한다.
  md.load();
  md.editable = true;
  md.showEditor();

  // Object.getPrototypeOf를 두 번 호출해 md.editMode의 프로토타입 체인을 두 단계 위로 올라간 뒤
  // .constructor로 실제 MarkdownEditor 클래스(생성자 함수)를 얻는다. 이는 Obsidian이 감춘 클래스
  // 계층 구조(예: Editor -> MarkdownEditor -> ...) 를 우회해서 접근하는 트릭이다.
  const MarkdownEditor = Object.getPrototypeOf(Object.getPrototypeOf(md.editMode)).constructor;

  // 클래스만 뽑아내면 되므로 실제 DOM에 남아있을 임시 인스턴스는 바로 언로드해서 정리한다.
  md.unload();

  return MarkdownEditor;
}

// KanbanPlugin: Obsidian의 Plugin 클래스를 상속(extends)한 플러그인 본체. Obsidian은 이 클래스를
// 인스턴스화한 뒤 onload()를 호출하여 플러그인을 활성화하고, 비활성화/언로드 시 onunload()를
// 호출한다. export default이므로 esbuild가 만든 main.js에서 Obsidian이 바로 이 클래스를
// require해서 사용한다.
export default class KanbanPlugin extends Plugin {
  // 설정 화면(탭) 인스턴스. addSettingTab으로 등록되어 Obsidian 설정 UI에 표시된다.
  settingsTab: KanbanSettingsTab;
  // 플러그인 전역 설정 객체. 타입은 Settings.ts에 정의된 KanbanSettings 인터페이스. 기본값은
  // 빈 객체이며 loadSettings()에서 저장된 데이터로 채워진다.
  settings: KanbanSettings = {};

  // leafid => view mode
  // 각 워크스페이스 리프(leaf, 탭/패널)별로 현재 보기 모드('markdown' 또는 kanbanViewType)를
  // 기억해두는 맵. Record<string, string>은 TypeScript의 인덱스 시그니처 타입 별칭으로, 문자열
  // 키에 문자열 값을 매핑하는 일반 객체를 의미한다. 사용자가 "마크다운으로 보기" / "칸반으로
  // 보기"를 토글했을 때 그 선택을 세션 동안 유지하기 위해 쓰인다.
  kanbanFileModes: Record<string, string> = {};
  // 파일(TFile)마다 하나씩 존재하는 StateManager(칸반 보드의 파싱된 상태와 갱신 로직을 담당)를
  // 보관하는 Map. 같은 파일을 여러 뷰(탭)에서 열어도 StateManager는 공유된다.
  stateManagers: Map<TFile, StateManager> = new Map();

  // 창(Window)별 WindowRegistry를 보관하는 Map. 메인 창뿐 아니라 Obsidian의 팝아웃(멀티 윈도우)
  // 창마다 별도의 Preact 루트와 뷰 목록을 관리하기 위함이다.
  windowRegistry: Map<Window, WindowRegistry> = new Map();

  // 플러그인이 정상적으로 로드 완료되었는지 나타내는 플래그. 종료(unload) 과정 중에는 이 값을
  // false로 두어, 아래 setViewState 몽키패치가 종료 시퀀스 중에 뷰 타입을 강제로 바꾸지 않도록
  // 방어한다.
  _loaded: boolean = false;

  // 현재 Shift 키가 눌려있는지 추적하는 상태. 카드/리스트 조작 시 Shift+클릭 등 보조 동작을
  // 구분하기 위해 전역 keydown/keyup 리스너로 갱신된다.
  isShiftPressed: boolean = false;

  // async/await: Promise를 동기 코드처럼 작성할 수 있게 해주는 문법. loadData()는 Obsidian이
  // 제공하는 저장소 API로 data.json의 내용을 비동기로 읽어온다. Object.assign({}, ...)은 새로운
  // 객체를 만들어 그 안에 로드된 데이터를 얕은 복사(spread와 유사한 효과)하는 패턴으로, 원본
  // 데이터 객체를 직접 참조하지 않기 위함이다.
  async loadSettings() {
    this.settings = Object.assign({}, await this.loadData());
  }

  // 현재 settings 객체를 Obsidian의 saveData API를 통해 data.json에 비동기로 저장한다.
  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Plugin 인스턴스가 언로드될 때 Obsidian이 호출하는 표준 메서드(onunload와는 별개로 Plugin
  // 베이스 클래스 자체의 unload()를 오버라이드한 것). super.unload()로 부모 클래스의 원래 동작을
  // 먼저 수행한 뒤, 열려 있는 모든 칸반 뷰를 마크다운 뷰로 되돌린다. 이는 플러그인이 비활성화된
  // 상태에서도 파일이 깨진 커스텀 뷰로 남아있지 않고 일반 마크다운으로 정상 표시되게 하기 위함이다.
  // Promise.all(...)로 여러 leaf에 대한 setMarkdownView 비동기 작업을 병렬로 실행한다.
  unload(): void {
    super.unload();
    Promise.all(
      this.app.workspace.getLeavesOfType(kanbanViewType).map((leaf) => {
        this.kanbanFileModes[(leaf as any).id] = 'markdown';
        return this.setMarkdownView(leaf);
      })
    );
  }

  // onunload: Obsidian Plugin 라이프사이클 훅으로, 플러그인이 비활성화/제거될 때 호출된다. 여기서
  // MarkdownEditor 참조 해제, 모든 창에 마운트된 Preact 앱 언마운트, 내부 상태(Map들) 초기화,
  // hover link source 등록 해제 등 onload에서 등록했던 것들을 역순으로 정리한다.
  onunload() {
    this.MarkdownEditor = null;
    // forEach 콜백에서 구조분해할당 없이 (reg, win) 두 개의 인자를 받는다(Map.forEach는
    // (value, key) 순서로 콜백을 호출한다). 각 창에 등록된 viewStateReceivers(칸반 뷰 목록이
    // 바뀔 때 알림 받는 Preact 상태 setter들)에게 빈 배열을 전달해 UI를 비우고, 그 창의 Preact
    // 앱을 unmount한다.
    this.windowRegistry.forEach((reg, win) => {
      reg.viewStateReceivers.forEach((fn) => fn([]));
      this.unmount(win);
    });

    // 메인 window 자체도 정리(팝아웃 창들과 별개로 항상 존재하는 기본 창).
    this.unmount(window);

    // 모든 상태 매니저와 창 레지스트리, 파일별 뷰 모드 기록을 비워 메모리 누수를 방지한다.
    this.stateManagers.clear();
    this.windowRegistry.clear();
    this.kanbanFileModes = {};

    // registerEvents()에서 등록했던 hover link source(파일 링크 호버 미리보기 소스)를 명시적으로
    // 해제. as any로 타입 단언(type assertion)한 이유는 unregisterHoverLinkSource가 공개 타입
        // 정의에 없는 비공식 API이기 때문이다.
    (this.app.workspace as any).unregisterHoverLinkSource(frontmatterKey);
  }

  // getEditorClass()로 얻어낸 내부 MarkdownEditor 생성자를 보관하는 필드. any 타입이라 별도의
  // 타입 검사 없이 카드 편집기 컴포넌트들에서 그대로 재사용된다.
  MarkdownEditor: any;

  // onload: Obsidian이 플러그인을 활성화할 때 호출하는 진입점. async 함수이므로 내부에서
  // await로 비동기 초기화(설정 로드 등)를 순서대로 처리할 수 있다. 이 메서드가 사실상 플러그인의
  // "부트스트랩" 절차이며, 실행 순서는 아래 주석에서 각 단계별로 설명한다.
  async onload() {
    // 1) 저장된 설정(data.json)을 불러와 this.settings를 채운다. 이후 로직들이 이 설정값에
    // 의존하므로 가장 먼저 await로 완료를 기다린다.
    await this.loadSettings();

    // 2) 비공식 API를 이용해 Obsidian의 내부 마크다운 에디터 클래스를 획득해둔다(카드 인라인
    // 편집에 재사용).
    this.MarkdownEditor = getEditorClass(this.app);

    // 3) 에디터 자동완성(EditorSuggest) 두 종류를 등록. 사용자가 카드 텍스트를 편집할 때 시간/날짜
    // 입력을 돕는 팝업 제안을 제공한다. registerEditorSuggest는 Obsidian이 플러그인 언로드 시
    // 자동으로 해제해주는 등록 헬퍼.
    this.registerEditorSuggest(new TimeSuggest(this.app, this));
    this.registerEditorSuggest(new DateSuggest(this.app, this));

    // 4) 워크스페이스의 'window-open' 이벤트를 구독. Obsidian은 사용자가 탭을 팝아웃(새 OS
    // 창)으로 분리할 때 이 이벤트를 발생시키며, 이때 그 새 창(win)에 Preact 앱을 mount한다.
    // registerEvent로 등록해두면 언로드 시 자동 해제된다. 화살표 함수 콜백은 클로저로 this(플러그인
    // 인스턴스)를 캡처한다.
    this.registerEvent(
      this.app.workspace.on('window-open', (_: any, win: Window) => {
        this.mount(win);
      })
    );

    // 5) 반대로 팝아웃 창이 닫힐 때 발생하는 'window-close' 이벤트를 구독해 해당 창의 Preact
    // 앱을 unmount하여 리소스를 정리한다.
    this.registerEvent(
      this.app.workspace.on('window-close', (_: any, win: Window) => {
        this.unmount(win);
      })
    );

    // 6) 설정 탭 인스턴스를 생성. 두 번째 인자로 전달하는 객체 리터럴은 onSettingsChange라는
    // 콜백 하나를 갖는데, 설정 UI에서 값이 바뀔 때마다 호출되어 새 설정을 저장하고, 열려 있는
    // 모든 StateManager에 forceRefresh()를 호출해 보드를 완전히 다시 렌더링시킨다(예: 날짜 형식이
    // 바뀌면 모든 카드가 다시 그려져야 함).
    this.settingsTab = new KanbanSettingsTab(this, {
      onSettingsChange: async (newSettings) => {
        this.settings = newSettings;
        await this.saveSettings();

        // Force a complete re-render when settings change
        this.stateManagers.forEach((stateManager) => {
          stateManager.forceRefresh();
        });
      },
    });

    // 7) 설정 탭을 Obsidian 설정 화면에 등록.
    this.addSettingTab(this.settingsTab);

    // 8) 커스텀 뷰 타입을 등록. kanbanViewType이라는 문자열 식별자에 대해, Obsidian이 해당 타입의
    // 뷰를 필요로 할 때(예: setViewState로 타입 전환 시) 호출할 팩토리 함수를 전달한다. 화살표
    // 함수 (leaf) => new KanbanView(leaf, this)는 리프마다 새로운 KanbanView 인스턴스를 생성하며
    // this(플러그인 인스턴스)를 클로저로 캡처해 뷰에 전달한다.
    this.registerView(kanbanViewType, (leaf) => new KanbanView(leaf, this));
    // 9) 아래에 정의된 registerMonkeyPatches/registerCommands/registerEvents를 호출하여 각각
    // Obsidian 내부 동작 가로채기, 커맨드 팔레트 커맨드 등록, 워크스페이스/볼트 이벤트 구독을
    // 설정한다. 순서상 뷰 타입이 먼저 등록된 뒤에 호출되어야, 몽키패치나 이벤트 핸들러 내부에서
    // KanbanView를 안전하게 참조할 수 있다.
    this.registerMonkeyPatches();
    this.registerCommands();
    this.registerEvents();

    // Mount an empty component to start; views will be added as we go
    // 10) 메인 창에 대해 Preact 앱을 미리 마운트해둔다(칸반 뷰가 아직 하나도 열려있지 않아도,
    // 나중에 뷰가 추가될 때를 대비해 빈 컴포넌트 트리를 미리 그려놓는 방식).
    this.mount(window);

    // 11) Obsidian이 이미 팝아웃 창(floatingSplit)을 갖고 있는 상태로 플러그인이 로드되는
    // 경우(예: 플러그인 리로드)를 대비해, 기존에 열려 있던 각 팝아웃 창들에도 동일하게 mount를
    // 수행한다. optional chaining(?.)을 연달아 사용해 floatingSplit이나 children이 없을 수도
    // 있는 상황을 안전하게 처리한다. as any는 floatingSplit이 공개 타입에 없는 내부 API이기
    // 때문의 타입 단언.
    (this.app.workspace as any).floatingSplit?.children?.forEach((c: any) => {
      this.mount(c.win);
    });

    // 12) 전역 keydown/keyup 이벤트를 등록해 Shift 키 상태를 추적한다. registerDomEvent는
    // Obsidian이 제공하는 헬퍼로, 언로드 시 리스너를 자동으로 제거해준다.
    this.registerDomEvent(window, 'keydown', this.handleShift);
    this.registerDomEvent(window, 'keyup', this.handleShift);

    // 13) 왼쪽 사이드바에 리본 아이콘을 추가. 클릭 시 새 칸반 보드를 생성하는 newKanban()을
    // 호출한다. t(...)는 lang/helpers.ts의 다국어 번역 함수로, 사용자의 로케일에 맞는 문자열을
    // 반환한다(이번 브랜치의 한국어 번역 갱신과 연결되는 지점).
    this.addRibbonIcon(kanbanIcon, t('Create new board'), () => {
      this.newKanban();
    });
  }

  // 클래스 필드에 화살표 함수를 대입하는 문법(class field arrow function). 이렇게 하면 함수가
  // 항상 인스턴스에 바인딩된 this를 클로저로 캡처하므로, registerDomEvent에 콜백으로 전달해도
  // this.isShiftPressed에 안전하게 접근할 수 있다(일반 메서드였다면 별도로 bind가 필요했을 것).
  handleShift = (e: KeyboardEvent) => {
    this.isShiftPressed = e.shiftKey;
  };

  // 주어진 창(win)에 해당하는 WindowRegistry를 찾아 그 안의 viewMap 값들(KanbanView 인스턴스들)을
  // 배열로 변환해 반환한다. 레지스트리가 없으면(아직 mount되지 않은 창) 빈 배열을 반환한다.
  getKanbanViews(win: Window) {
    const reg = this.windowRegistry.get(win);

    if (reg) {
      return Array.from(reg.viewMap.values());
    }

    return [];
  }

  // id(leaf id 기반 식별자)와 창을 받아 해당 KanbanView 인스턴스를 찾는다. 먼저 지정된 창의
  // 레지스트리에서 optional chaining(reg?.viewMap.has(id))으로 안전하게 확인하고, 없으면 모든
  // 창의 레지스트리를 순회하며 찾는다(뷰가 다른 창으로 이동했을 가능성 등을 대비).
  getKanbanView(id: string, win: Window) {
    const reg = this.windowRegistry.get(win);

    if (reg?.viewMap.has(id)) {
      return reg.viewMap.get(id);
    }

    for (const reg of this.windowRegistry.values()) {
      if (reg.viewMap.has(id)) {
        return reg.viewMap.get(id);
      }
    }

    return null;
  }

  // 파일(TFile)에 대응하는 StateManager를 조회. 없으면 undefined가 반환된다(Map.get 기본 동작).
  getStateManager(file: TFile) {
    return this.stateManagers.get(file);
  }

  // 뷰 id와 창으로부터 먼저 KanbanView를 찾고, 그 뷰가 열고 있는 파일에 대응하는 StateManager를
  // 반환한다. view가 없으면 조기 반환(early return)으로 null을 돌려준다.
  getStateManagerFromViewID(id: string, win: Window) {
    const view = this.getKanbanView(id, win);

    if (!view) {
      return null;
    }

    return this.stateManagers.get(view.file);
  }

  // useKanbanViews: Preact 함수형 컴포넌트 안에서 호출되는 커스텀 훅(hook)이다. useState로 현재
  // 창의 칸반 뷰 목록을 상태로 갖고, useEffect로 이 창의 WindowRegistry에 setState 함수 자체를
  // viewStateReceivers 배열에 등록해둔다. 이렇게 하면 addView/removeView 등에서
  // viewStateReceivers.forEach((fn) => fn(...))를 호출할 때 이 컴포넌트도 갱신된다(일종의
  // 수동 pub/sub 패턴을 React/Preact 훅 위에 얹은 형태). useEffect가 반환하는 함수는 클린업
  // 함수로, 컴포넌트가 언마운트되거나 win이 바뀌어 effect가 재실행되기 전에 호출되어 등록해둔
  // setState를 배열에서 제거(remove)한다. 의존성 배열 [win]은 win이 바뀔 때만 effect를
  // 재실행하라는 의미.
  useKanbanViews(win: Window): KanbanView[] {
    const [state, setState] = useState(this.getKanbanViews(win));

    useEffect(() => {
      const reg = this.windowRegistry.get(win);

      reg?.viewStateReceivers.push(setState);

      return () => {
        reg?.viewStateReceivers.remove(setState);
      };
    }, [win]);

    return state;
  }

  // addView: 새로 열린(또는 다시 활성화된) KanbanView를 등록하는 메서드. shouldParseData는
  // 전달받은 data(마크다운 텍스트)를 새로 파싱해야 하는지 여부를 나타내는 플래그.
  addView(view: KanbanView, data: string, shouldParseData: boolean) {
    // 뷰가 속한 창을 얻어 해당 창의 레지스트리를 조회. 레지스트리가 없으면(비정상 상태) 조기
    // 종료한다.
    const win = view.getWindow();
    const reg = this.windowRegistry.get(win);

    if (!reg) return;
    // 아직 등록되지 않은 뷰라면 viewMap에 추가.
    if (!reg.viewMap.has(view.id)) {
      reg.viewMap.set(view.id, view);
    }

    const file = view.file;

    // 이 파일에 대한 StateManager가 이미 있으면 새 뷰를 그 매니저에 등록(registerView)하고,
    // 없으면 새로 생성한다. new StateManager(...)의 세 번째~네 번째 인자는 화살표 함수
    // 콜백들로, 클로저를 이용해 file/this를 캡처한다: 첫 번째 콜백은 StateManager가 스스로를
    // 폐기해야 할 때(마지막 뷰가 닫혔을 때 등) stateManagers 맵에서 자신을 제거하도록 하는
        // "자기 삭제" 콜백이고, 두 번째 콜백은 항상 최신 settings를 읽을 수 있도록 하는 getter
        // 역할의 콜백이다(설정이 나중에 바뀌어도 StateManager가 캡처 시점의 낡은 값이 아니라
        // 최신 값을 읽게 하기 위함).
    if (this.stateManagers.has(file)) {
      this.stateManagers.get(file).registerView(view, data, shouldParseData);
    } else {
      this.stateManagers.set(
        file,
        new StateManager(
          this.app,
          view,
          data,
          () => this.stateManagers.delete(file),
          () => this.settings
        )
      );
    }

    // 이 창에 등록된 모든 viewStateReceivers(useKanbanViews 훅들의 setState)에게 최신 뷰 목록을
    // 전달해 UI(예: 탭 전환 관련 컴포넌트)를 갱신시킨다.
    reg.viewStateReceivers.forEach((fn) => fn(this.getKanbanViews(win)));
  }

  // removeView: 뷰가 닫힐 때 호출되어 레지스트리와 StateManager에서 해당 뷰를 제거한다.
  removeView(view: KanbanView) {
    // windowRegistry.entries()를 배열로 변환한 뒤 Array.prototype.find로, 이 view.id를 가진
    // viewMap을 보유한 [win, reg] 엔트리를 찾는다. 구조분해할당으로 콜백 매개변수를 [win, reg]가
    // 아니라 [, reg]처럼 받아 첫 번째 요소는 무시할 수도 있지만 여기서는 콜백 인자를
    // 그대로 사용한다. find의 두 번째 인자 []는 thisArg로 사실상 아무 의미 없이 전달된 값이다.
    const entry = Array.from(this.windowRegistry.entries()).find(([, reg]) => {
      return reg.viewMap.has(view.id);
    }, []);

    if (!entry) return;

    // 찾은 엔트리를 구조분해할당으로 win과 reg로 분리.
    const [win, reg] = entry;
    const file = view.file;

    if (reg.viewMap.has(view.id)) {
      reg.viewMap.delete(view.id);
    }

    // 파일에 대응하는 StateManager가 있다면 그 매니저에서 뷰 등록을 해제(unregisterView)하고,
    // 뷰 목록이 바뀌었음을 이 창의 모든 구독자에게 알린다.
    if (this.stateManagers.has(file)) {
      this.stateManagers.get(file).unregisterView(view);
      reg.viewStateReceivers.forEach((fn) => fn(this.getKanbanViews(win)));
    }
  }

  // handleViewFileRename: 칸반 파일이 이름 변경(rename)되었을 때, 뷰 레지스트리의 키(뷰 id에
  // 옛 경로가 포함되어 있음)를 새 id로 갱신하기 위한 메서드.
  handleViewFileRename(view: KanbanView, oldPath: string) {
    const win = view.getWindow();
    // 이 창이 아직 mount되지 않았다면(레지스트리 없음) 처리할 것이 없으므로 종료.
    if (!this.windowRegistry.has(win)) {
      return;
    }

    const reg = this.windowRegistry.get(win);
    // 템플릿 리터럴로 "leafId:::oldPath" 형태의 예전 id를 재구성.
    const oldId = `${(view.leaf as any).id}:::${oldPath}`;

    // 예전 id로 등록된 항목이 있으면 제거.
    if (reg.viewMap.has(oldId)) {
      reg.viewMap.delete(oldId);
    }

    // 새 id(현재 view.id, 이름 변경 후 값)로 아직 등록돼 있지 않으면 추가.
    if (!reg.viewMap.has(view.id)) {
      reg.viewMap.set(view.id, view);
    }

    // 이 뷰가 "primary"(해당 파일을 대표하는 원본 뷰)라면, 이름 변경 후 내용이 최신 상태인지
    // 가볍게 다시 확인하도록 StateManager에 softRefresh를 요청한다.
    if (view.isPrimary) {
      this.getStateManager(view.file).softRefresh();
    }
  }

  // mount: 지정된 창(win)에 Preact 앱 루트를 생성하고 렌더링한다. 메인 창(window)과 각 팝아웃
  // 창마다 한 번씩 호출된다.
  mount(win: Window) {
    // 이미 이 창에 대한 레지스트리가 있다면(이미 mount됨) 중복 마운트를 방지하기 위해 조기 반환.
    if (this.windowRegistry.has(win)) {
      return;
    }

    // 해당 창의 document.body 아래에 Preact 앱을 담을 루트 div를 생성. createDiv는 Obsidian이
    // HTMLElement.prototype에 주입하는 편의 메서드.
    const el = win.document.body.createDiv();

    // 이 창에 대한 새 WindowRegistry를 초기 상태(빈 viewMap, 빈 콜백 배열, 방금 만든 루트
    // 엘리먼트)로 등록.
    this.windowRegistry.set(win, {
      viewMap: new Map(),
      viewStateReceivers: [],
      appRoot: el,
    });

    // DragDropApp.tsx의 createApp(win, this)가 반환하는 최상위 Preact 엘리먼트를 el에 렌더링.
    // render는 preact/compat을 통해 매핑된 (사실상 Preact의) 렌더 함수.
    render(createApp(win, this), el);
  }

  // unmount: 지정된 창에서 Preact 앱과 관련 리소스를 모두 정리한다(창이 닫히거나 플러그인이
  // 언로드될 때 호출).
  unmount(win: Window) {
    // 레지스트리가 없다면(애초에 mount된 적 없음) 처리할 것이 없다.
    if (!this.windowRegistry.has(win)) {
      return;
    }

    const reg = this.windowRegistry.get(win);

    // 이 창에 등록된 모든 뷰를 removeView로 정리(StateManager 등록 해제 등 부수 효과 포함).
    for (const view of reg.viewMap.values()) {
      this.removeView(view);
    }

    // Preact 컴포넌트 트리를 루트에서 언마운트.
    unmountComponentAtNode(reg.appRoot);

    // 루트 DOM 엘리먼트를 문서에서 제거하고, 레지스트리 내부 컬렉션들을 비워 참조를 끊는다
    // (가비지 컬렉션이 가능하도록).
    reg.appRoot.remove();
    reg.viewMap.clear();
    reg.viewStateReceivers.length = 0;
    reg.appRoot = null;

    // 창 자체에 대한 레지스트리 엔트리도 Map에서 제거.
    this.windowRegistry.delete(win);
  }

  // setMarkdownView: 주어진 leaf(탭/패널)의 뷰 타입을 'markdown'으로 전환한다. leaf.setViewState는
  // Obsidian의 핵심 API로, 뷰 타입/상태를 교체하며 popstate: true는 이 전환이 브라우저 히스토리의
  // "뒤로가기"처럼 취급되어야 함을 나타내는 옵션(히스토리 스택에 새 항목을 추가하지 않음). 객체
  // 리터럴 뒤의 `as ViewState`는 TypeScript 타입 단언으로, 객체 리터럴이 ViewState 인터페이스와
  // 정확히 일치하지 않아도(타입 체커가 추론하기 어려운 경우) 강제로 해당 타입으로 취급하게 한다.
  // focus 매개변수는 기본값 true를 갖는 선택적 매개변수로, 전환 후 해당 뷰에 포커스를 줄지 결정한다.
  async setMarkdownView(leaf: WorkspaceLeaf, focus: boolean = true) {
    await leaf.setViewState(
      {
        type: 'markdown',
        state: leaf.view.getState(),
        popstate: true,
      } as ViewState,
      { focus }
    );
  }

  // setKanbanView: 위와 대칭적으로, 주어진 leaf의 뷰 타입을 이 플러그인이 등록한 kanbanViewType으로
  // 전환한다.
  async setKanbanView(leaf: WorkspaceLeaf) {
    await leaf.setViewState({
      type: kanbanViewType,
      state: leaf.view.getState(),
      popstate: true,
    } as ViewState);
  }

  // newKanban: 새 칸반 보드 파일을 생성하고 여는 메서드. 폴더(folder)를 선택적 매개변수로 받아
  // 지정되지 않으면 현재 활성 파일의 위치를 기준으로 기본 폴더를 계산한다.
  async newKanban(folder?: TFolder) {
    // 삼항 연산자 대신 if/else 형태의 조건부 대입: folder가 주어지면 그대로 쓰고, 아니라면
    // fileManager.getNewFileParent로 새 파일이 놓일 부모 폴더를 얻는다. optional chaining(?.)과
    // nullish 병합 연산자가 아닌 논리 OR(||)를 사용해 활성 파일이 없을 경우 빈 문자열을
    // 기본값으로 사용한다.
    const targetFolder = folder
      ? folder
      : this.app.fileManager.getNewFileParent(app.workspace.getActiveFile()?.path || '');

    // try/catch로 파일 생성 및 초기화 과정에서 발생할 수 있는 오류(예: 이름 충돌, 권한 문제)를
    // 잡아 콘솔에 로그로 남긴다.
    try {
      // createNewMarkdownFile은 공식 타입에 없는 비공식 API라 fileManager를 as any로 단언해서
      // 호출한다. t('Untitled Kanban')로 번역된 기본 파일명을 사용.
      const kanban: TFile = await (app.fileManager as any).createNewMarkdownFile(
        targetFolder,
        t('Untitled Kanban')
      );

      // 새로 만든 파일에 기본 프론트매터(parsers/common.ts의 basicFrontmatter, 칸반 인식용
      // frontmatterKey 포함)를 기록해 이 파일이 칸반 보드임을 표시한다.
      await this.app.vault.modify(kanban, basicFrontmatter);
      // 현재 활성 leaf(또는 새 leaf)에 이 파일을 칸반 뷰 타입으로 열도록 상태를 설정한다.
      await this.app.workspace.getLeaf().setViewState({
        type: kanbanViewType,
        state: { file: kanban.path },
      });
    } catch (e) {
      console.error('Error creating kanban board:', e);
    }
  }

  // registerEvents: 볼트/워크스페이스 전반의 이벤트(파일 메뉴, 이름 변경, 파일 수정, 메타데이터
  // 변경 등)를 구독하여 칸반 관련 UI/데이터 동기화를 처리한다. onload()에서 한 번 호출된다.
  registerEvents() {
    // 'file-menu' 이벤트: 파일/폴더를 우클릭하거나 탭의 컨텍스트 메뉴를 열 때 발생. 이 콜백에서
    // menu에 칸반 관련 메뉴 항목들을 조건에 따라 동적으로 추가한다. 콜백 매개변수는 구조분해
    // 없이 그대로 받은 (menu, file, source, leaf) 네 개다.
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file, source, leaf) => {
        // 링크를 우클릭해서 뜨는 컨텍스트 메뉴에는 칸반 관련 항목을 추가하지 않는다.
        if (source === 'link-context-menu') return;

        // instanceof로 대상이 파일인지 폴더인지, 현재 leaf의 뷰가 마크다운/칸반인지 판별해 각각
        // boolean 변수에 저장(가독성을 위한 명명된 조건 플래그들).
        const fileIsFile = file instanceof TFile;
        const fileIsFolder = file instanceof TFolder;
        const leafIsMarkdown = leaf?.view instanceof MarkdownView;
        const leafIsKanban = leaf?.view instanceof KanbanView;

        // Add a menu item to the folder context menu to create a board
        // 대상이 폴더라면 "새 칸반 보드" 메뉴 항목만 추가하고 종료(폴더에는 다른 칸반 관련
        // 항목이 의미 없으므로 조기 반환).
        if (fileIsFolder) {
          menu.addItem((item) => {
            item
              .setSection('action-primary')
              .setTitle(t('New kanban board'))
              .setIcon(kanbanIcon)
              .onClick(() => this.newKanban(file));
          });
          return;
        }

        // 사이드바(파일 탐색기)에서 우클릭했고, 모바일이 아니며, 대상 파일에 칸반 프론트매터
        // 키가 있는 경우: 이미 그 파일을 열어둔 칸반 뷰가 있는지 검사한다.
        if (
          !Platform.isMobile &&
          fileIsFile &&
          leaf &&
          source === 'sidebar-context-menu' &&
          hasFrontmatterKey(file)
        ) {
          // 현재 leaf가 속한 창(getParentWindow로 조회)에 열려 있는 모든 칸반 뷰를 가져와,
          // 이 파일을 열고 있는 뷰가 있는지 순회하며 확인한다.
          const views = this.getKanbanViews(getParentWindow(leaf.view.containerEl));
          let haveKanbanView = false;

          for (const view of views) {
            if (view.file === file) {
              // 이미 열려 있는 칸반 뷰가 있다면, 그 뷰의 onPaneMenu를 위임 호출해 뷰 자체가
              // 자신에게 맞는 메뉴 항목들을 추가하도록 한다.
              view.onPaneMenu(menu, 'more-options', false);
              haveKanbanView = true;
              break;
            }
          }

          // 열려 있는 칸반 뷰가 없다면 "칸반 보드로 열기" 메뉴 항목을 추가해, 클릭 시 해당
          // leaf의 모드를 kanbanViewType으로 기억시키고 setKanbanView로 전환한다.
          if (!haveKanbanView) {
            menu.addItem((item) => {
              item
                .setTitle(t('Open as kanban board'))
                .setIcon(kanbanIcon)
                .setSection('pane')
                .onClick(() => {
                  this.kanbanFileModes[(leaf as any).id || file.path] = kanbanViewType;
                  this.setKanbanView(leaf);
                });
            });

            return;
          }
        }

        // 현재 leaf가 마크다운 뷰이고, 파일이며, 메뉴 소스가 더보기/탭 헤더 등이고, 칸반
        // 프론트매터 키를 가지고 있다면 "칸반 보드로 열기" 항목을 추가한다(사이드바가 아닌
        // 다른 진입점들에 대한 처리).
        if (
          leafIsMarkdown &&
          fileIsFile &&
          ['more-options', 'pane-more-options', 'tab-header'].includes(source) &&
          hasFrontmatterKey(file)
        ) {
          menu.addItem((item) => {
            item
              .setTitle(t('Open as kanban board'))
              .setIcon(kanbanIcon)
              .setSection('pane')
              .onClick(() => {
                this.kanbanFileModes[(leaf as any).id || file.path] = kanbanViewType;
                this.setKanbanView(leaf);
              });
          });
        }

        // 반대로 현재 leaf가 이미 칸반 뷰라면, "마크다운으로 열기" 항목(더보기/탭 헤더에서만)과
        // 모바일 전용 추가 메뉴 항목들(리스트 추가, 완료 카드 보관, 보기 모드 전환, 보드 설정)을
        // 구성한다.
        if (fileIsFile && leafIsKanban) {
          if (['pane-more-options', 'tab-header'].includes(source)) {
            menu.addItem((item) => {
              item
                .setTitle(t('Open as markdown'))
                .setIcon(kanbanIcon)
                .setSection('pane')
                .onClick(() => {
                  this.kanbanFileModes[(leaf as any).id || file.path] = 'markdown';
                  this.setMarkdownView(leaf);
                });
            });
          }

          // 모바일에서는 데스크톱과 달리 리본/툴바 접근이 제한적이므로, 파일 메뉴 자체에 보드
          // 조작용 항목들을 더 많이 노출한다.
          if (Platform.isMobile) {
            const stateManager = this.stateManagers.get(file);
            const kanbanView = leaf.view as KanbanView;
            // 현재 보드 보기 모드를 뷰별 설정(viewSettings) 우선, 없으면 StateManager의 전역
            // 설정에서 가져온다. 논리 OR(||)로 폴백(fallback) 체인을 구성한 패턴.
            const boardView =
              kanbanView.viewSettings[frontmatterKey] || stateManager.getSetting(frontmatterKey);

            // 메서드 체이닝(fluent API)으로 여러 addItem 호출을 연결. 각 항목은 emitter를 통해
            // KanbanView 내부로 이벤트를 보내거나(showLaneForm), StateManager의 메서드를 직접
            // 호출하거나(archiveCompletedCards), kanbanView.setView(...)로 보기 모드를
            // 전환한다. setChecked(...)는 현재 boardView 값과 비교해 체크 표시를 결정한다.
            menu
              .addItem((item) => {
                item
                  .setTitle(t('Add a list'))
                  .setIcon('lucide-plus-circle')
                  .setSection('pane')
                  .onClick(() => {
                    kanbanView.emitter.emit('showLaneForm', undefined);
                  });
              })
              .addItem((item) => {
                item
                  .setTitle(t('Archive completed cards'))
                  .setIcon('lucide-archive')
                  .setSection('pane')
                  .onClick(() => {
                    stateManager.archiveCompletedCards();
                  });
              })
              .addItem((item) => {
                item
                  .setTitle(t('Archive completed cards'))
                  .setIcon('lucide-archive')
                  .setSection('pane')
                  .onClick(() => {
                    const stateManager = this.stateManagers.get(file);
                    stateManager.archiveCompletedCards();
                  });
              })
              .addItem((item) =>
                item
                  .setTitle(t('View as board'))
                  .setSection('pane')
                  .setIcon('lucide-trello')
                  .setChecked(boardView === 'basic' || boardView === 'board')
                  .onClick(() => kanbanView.setView('board'))
              )
              .addItem((item) =>
                item
                  .setTitle(t('View as table'))
                  .setSection('pane')
                  .setIcon('lucide-table')
                  .setChecked(boardView === 'table')
                  .onClick(() => kanbanView.setView('table'))
              )
              .addItem((item) =>
                item
                  .setTitle(t('View as list'))
                  .setSection('pane')
                  .setIcon('lucide-server')
                  .setChecked(boardView === 'list')
                  .onClick(() => kanbanView.setView('list'))
              )
              .addItem((item) =>
                item
                  .setTitle(t('Open board settings'))
                  .setSection('pane')
                  .setIcon('lucide-settings')
                  .onClick(() => kanbanView.getBoardSettings())
              );
          }
        }
      })
    );

    // 볼트에서 파일 이름이 바뀔 때('rename' 이벤트) 열려 있는 모든 칸반 leaf에게
    // handleRename(새 경로, 옛 경로)을 호출해 내부 참조(링크, 첨부파일 경로 등)를 갱신하도록
    // 알린다.
    this.registerEvent(
      app.vault.on('rename', (file, oldPath) => {
        const kanbanLeaves = app.workspace.getLeavesOfType(kanbanViewType);

        kanbanLeaves.forEach((leaf) => {
          (leaf.view as KanbanView).handleRename(file.path, oldPath);
        });
      })
    );

    // debounce: Obsidian이 제공하는 유틸리티로, 짧은 시간 내에 여러 번 호출되어도 마지막(또는
    // 설정에 따라 첫 번째) 호출만 일정 지연 후 실제로 실행되게 한다. 두 번째 인자 2000은 밀리초
    // 단위 지연, 세 번째 인자 true는 "선행 실행(leading edge)" 여부를 의미한다(연속 변경 이벤트가
    // 쏟아질 때 매번 다시 파싱하지 않도록 스로틀링하는 목적).
    const notifyFileChange = debounce(
      (file: TFile) => {
        // 변경된 파일 자신을 열고 있는 StateManager를 제외한 나머지 모든 StateManager에게
        // onFileMetadataChange를 호출한다(다른 보드가 이 파일을 링크/임베드하고 있을 수 있으므로
        // 메타데이터 갱신을 알리는 목적으로 보인다).
        this.stateManagers.forEach((manager) => {
          if (manager.file !== file) {
            manager.onFileMetadataChange();
          }
        });
      },
      2000,
      true
    );

    // 볼트의 'modify'(파일 내용 변경) 이벤트 구독. file이 TFile 인스턴스인 경우에만(폴더 등은
    // 제외) notifyFileChange를 호출.
    this.registerEvent(
      app.vault.on('modify', (file) => {
        if (file instanceof TFile) {
          notifyFileChange(file);
        }
      })
    );

    // 메타데이터 캐시의 'changed' 이벤트(프론트매터/링크 등 파싱된 메타데이터가 갱신됨) 구독.
    this.registerEvent(
      app.metadataCache.on('changed', (file) => {
        notifyFileChange(file);
      })
    );

    // Dataview 플러그인이 설치되어 있을 때 발생하는 비공식 이벤트('dataview:metadata-change')를
    // 구독. metadataCache를 as any로 단언한 이유는 이 이벤트가 Dataview 플러그인이 동적으로
    // 추가하는 것이라 Obsidian 공식 타입 정의에는 없기 때문이다.
    this.registerEvent(
      (app as any).metadataCache.on('dataview:metadata-change', (_: any, file: TFile) => {
        notifyFileChange(file);
      })
    );

    // Dataview API가 막 준비되었을 때('dataview:api-ready') 발생하는 이벤트를 구독해, 모든
    // StateManager를 forceRefresh하여 Dataview 기반 쿼리/필드가 이제는 정상적으로 평가되도록
    // 한다.
    this.registerEvent(
      (app as any).metadataCache.on('dataview:api-ready', () => {
        this.stateManagers.forEach((manager) => {
          manager.forceRefresh();
        });
      })
    );

    // 워크스페이스에 이 플러그인을 "hover link source"(파일 링크에 마우스를 올렸을 때 미리보기를
    // 제공하는 소스)로 등록한다. defaultMod: true는 기본 단축키 조합(예: Ctrl 등)으로도 미리보기가
    // 활성화됨을 의미. onunload에서 unregisterHoverLinkSource로 짝을 맞춰 해제한다.
    (app.workspace as any).registerHoverLinkSource(frontmatterKey, {
      display: 'Kanban',
      defaultMod: true,
    });
  }

  // registerCommands: 커맨드 팔레트(Ctrl/Cmd+P)와 단축키 설정에 노출되는 플러그인 커맨드들을
  // 등록한다. onload()에서 한 번 호출된다.
  registerCommands() {
    // 가장 단순한 형태: id/name/callback만 있는 커맨드. 항상 실행 가능하며 클릭 시 새 칸반
    // 보드를 만든다.
    this.addCommand({
      id: 'create-new-kanban-board',
      name: t('Create new board'),
      callback: () => this.newKanban(),
    });

    // checkCallback 패턴: Obsidian 커맨드 API의 관용구로, 이 콜백은 두 가지 역할을 겸한다.
    // checking이 true로 호출되면 "이 커맨드를 지금 실행할 수 있는가?"만 boolean으로 반환하고
    // 실제 동작은 수행하지 않는다(커맨드 팔레트가 이 커맨드를 표시할지 결정하기 위해 호출).
    // checking이 false면 실제로 그 시점의 활성 뷰를 기준으로 동작을 수행한다.
    this.addCommand({
      id: 'archive-completed-cards',
      name: t('Archive completed cards in active board'),
      checkCallback: (checking) => {
        const activeView = app.workspace.getActiveViewOfType(KanbanView);

        if (!activeView) return false;
        if (checking) return true;

        this.stateManagers.get(activeView.file).archiveCompletedCards();
      },
    });

    // 마크다운 <-> 칸반 보기 모드를 토글하는 커맨드. 현재 활성 파일의 프론트매터를 검사해 칸반
    // 파일인지 판단(fileIsKanban)하고, 체크 단계에서는 그 여부만 반환한다. 실제 실행 시에는 현재
    // 활성 뷰가 KanbanView인지 MarkdownView인지에 따라 반대쪽 모드로 전환한다.
    this.addCommand({
      id: 'toggle-kanban-view',
      name: t('Toggle between Kanban and markdown mode'),
      checkCallback: (checking) => {
        const activeFile = app.workspace.getActiveFile();

        if (!activeFile) return false;

        const fileCache = app.metadataCache.getFileCache(activeFile);
        // optional chaining(?.)과 이중 부정(!!)을 조합해, frontmatter 자체와 그 안의
        // frontmatterKey 값이 모두 존재하는지를 boolean으로 정규화한다.
        const fileIsKanban = !!fileCache?.frontmatter && !!fileCache.frontmatter[frontmatterKey];

        if (checking) {
          return fileIsKanban;
        }

        const activeView = app.workspace.getActiveViewOfType(KanbanView);

        if (activeView) {
          // 현재 칸반 뷰가 열려 있다면 마크다운으로 전환.
          this.kanbanFileModes[(activeView.leaf as any).id || activeFile.path] = 'markdown';
          this.setMarkdownView(activeView.leaf);
        } else if (fileIsKanban) {
          // 칸반 파일이지만 지금은 마크다운 뷰로 열려 있다면 칸반으로 전환.
          const activeView = app.workspace.getActiveViewOfType(MarkdownView);

          if (activeView) {
            this.kanbanFileModes[(activeView.leaf as any).id || activeFile.path] = kanbanViewType;
            this.setKanbanView(activeView.leaf);
          }
        }
      },
    });

    // 빈 노트를 칸반 보드로 변환하는 커맨드. 파일 크기(stat.size)가 0인 경우에만 체크를
    // 통과시키고, 실행 시 기본 프론트매터를 기록한 뒤(Promise 체이닝: .then/.catch 방식으로
    // async/await 대신 명시적으로 처리) 칸반 뷰로 전환한다.
    this.addCommand({
      id: 'convert-to-kanban',
      name: t('Convert empty note to Kanban'),
      checkCallback: (checking) => {
        const activeView = app.workspace.getActiveViewOfType(MarkdownView);

        if (!activeView) return false;

        const isFileEmpty = activeView.file.stat.size === 0;

        if (checking) return isFileEmpty;
        if (isFileEmpty) {
          app.vault
            .modify(activeView.file, basicFrontmatter)
            .then(() => {
              this.setKanbanView(activeView.leaf);
            })
            .catch((e) => console.error(e));
        }
      },
    });

    // 활성 뷰가 KanbanView일 때만 활성화되는 일련의 커맨드들: 리스트(레인) 추가, 보드/테이블/리스트
    // 보기 전환, 보드 설정 열기. 모두 동일한 checkCallback 패턴을 따르며, instanceof로 타입을
    // 좁혀(narrowing) view가 KanbanView임을 확인한 뒤에만 해당 메서드를 호출하거나 emitter로
    // 이벤트를 발행한다.
    this.addCommand({
      id: 'add-kanban-lane',
      name: t('Add a list'),
      checkCallback: (checking) => {
        const view = app.workspace.getActiveViewOfType(KanbanView);

        if (checking) {
          return view && view instanceof KanbanView;
        }

        if (view && view instanceof KanbanView) {
          view.emitter.emit('showLaneForm', undefined);
        }
      },
    });

    this.addCommand({
      id: 'view-board',
      name: t('View as board'),
      checkCallback: (checking) => {
        const view = app.workspace.getActiveViewOfType(KanbanView);

        if (checking) {
          return view && view instanceof KanbanView;
        }

        if (view && view instanceof KanbanView) {
          view.setView('board');
        }
      },
    });

    this.addCommand({
      id: 'view-table',
      name: t('View as table'),
      checkCallback: (checking) => {
        const view = app.workspace.getActiveViewOfType(KanbanView);

        if (checking) {
          return view && view instanceof KanbanView;
        }

        if (view && view instanceof KanbanView) {
          view.setView('table');
        }
      },
    });

    this.addCommand({
      id: 'view-list',
      name: t('View as list'),
      checkCallback: (checking) => {
        const view = app.workspace.getActiveViewOfType(KanbanView);

        if (checking) {
          return view && view instanceof KanbanView;
        }

        if (view && view instanceof KanbanView) {
          view.setView('list');
        }
      },
    });

    this.addCommand({
      id: 'open-board-settings',
      name: t('Open board settings'),
      checkCallback: (checking) => {
        const view = app.workspace.getActiveViewOfType(KanbanView);

        if (!view) return false;
        if (checking) return true;

        view.getBoardSettings();
      },
    });
  }

  // registerMonkeyPatches: Obsidian 코어 객체(commands, workspace, WorkspaceLeaf.prototype)의
  // 메서드를 monkey-around의 around()로 감싸서, 이 플러그인에 필요한 부가 동작을 끼워 넣는다.
  // 원본 메서드 자체를 수정하는 것이 아니라 "실행 전/후에 가로채는" 방식이라 몽키패치라고 부른다.
  // this.register(...)로 등록해두면 플러그인이 언로드될 때 around()가 반환한 원복 함수가 자동으로
  // 호출되어 패치가 해제된다.
  registerMonkeyPatches() {
    // 아래 executeCommand 패치의 반환 함수 내부는 일반 function 표현식이라 this가 호출 시점의
    // 컨텍스트(commands 객체)로 바뀐다. 화살표 함수가 아닌 곳에서 KanbanPlugin 인스턴스를
    // 참조해야 하므로, 클로저로 self = this를 미리 저장해둔다.
    const self = this;

    // 워크스페이스 레이아웃이 완전히 준비된 뒤(onLayoutReady 콜백)에야 커맨드 실행을
    // 가로채는 패치를 등록한다. 레이아웃 준비 전에는 app.workspace 등 일부 내부 상태가 아직
    // 불완전할 수 있기 때문으로 보인다.
    this.app.workspace.onLayoutReady(() => {
      this.register(
        around((app as any).commands, {
          // around()의 패치 정의 객체: 키 이름(executeCommand)이 패치할 메서드 이름이고, 값은
          // "원본 함수(next)를 받아 새 함수를 반환"하는 고차 함수(higher-order function)다.
          // 반환된 function(command) { ... }가 실제로 commands.executeCommand를 대체한다.
          executeCommand(next) {
            return function (command: any) {
              // 현재 활성 뷰가 KanbanView이고 실행되는 커맨드에 id가 있으면, 그 뷰의
              // 이벤트 이미터를 통해 'hotkey' 이벤트를 발행한다. 이렇게 하면 칸반 뷰 내부
              // 컴포넌트들이 "이 커맨드/단축키가 지금 이 보드에서 실행되었다"는 것을 알고
              // 자체적으로 반응할 수 있다(예: 특정 단축키를 카드 관련 동작으로 재해석).
              const view = app.workspace.getActiveViewOfType(KanbanView);

              if (view && command?.id) {
                view.emitter.emit('hotkey', { commandId: command.id });
              }

              // next.call(this, command)로 원본 executeCommand를 반드시 호출해, 패치를
              // 추가했다고 해서 원래 커맨드 실행 자체가 막히지 않도록 한다.
              return next.call(this, command);
            };
          },
        })
      );
    });

    this.register(
      around(this.app.workspace, {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // setActiveLeaf는 공식 타입 정의와 시그니처가 다를 수 있어 TypeScript 컴파일러 오류를
        // 한 줄 무시(@ts-ignore)하고 패치한다.
        setActiveLeaf(next) {
          return function (...args) {
            // 전개 연산자(rest parameter) ...args로 원래 몇 개의 인자를 받든 그대로 원본
            // 메서드에 apply로 전달한다.
            next.apply(this, args);
            // 활성 리프 전환 후, 새로 활성화된 뷰가 KanbanView이고 그 뷰가 activeEditor를
            // 가지고 있다면, workspace.activeEditor를 그 값으로 맞춰준다. 이는 칸반 뷰 안의
            // 카드 편집기가 Obsidian의 "현재 활성 에디터"로 인식되어야 붙여넣기/서식 관련
            // 명령들이 올바르게 그 에디터를 대상으로 동작하기 때문으로 보인다.
            const view = this.getActiveViewOfType(KanbanView);
            if (view?.activeEditor) {
              this.activeEditor = view.activeEditor;
            }
          };
        },
      })
    );

    // Monkey patch WorkspaceLeaf to open Kanbans with KanbanView by default
    // WorkspaceLeaf.prototype 자체를 패치하여, 모든 leaf 인스턴스(현재/이후 생성되는 것 포함)의
    // detach와 setViewState 동작에 공통 로직을 끼워 넣는다.
    this.register(
      around(WorkspaceLeaf.prototype, {
        // Kanbans can be viewed as markdown or kanban, and we keep track of the mode
        // while the file is open. When the file closes, we no longer need to keep track of it.
        // leaf가 닫힐 때(detach) 그 leaf/파일에 대해 기억해두었던 kanbanFileModes 항목을
        // 정리한다(더 이상 필요 없는 상태이므로 메모리에서 제거).
        detach(next) {
          return function () {
            const state = this.view?.getState();

            if (state?.file && self.kanbanFileModes[this.id || state.file]) {
              delete self.kanbanFileModes[this.id || state.file];
            }

            return next.apply(this);
          };
        },

        // setViewState 패치: 이 플러그인의 핵심 자동 전환 로직이다. leaf의 뷰 상태가
        // 'markdown'으로 설정되려는 순간을 가로채서, 만약 그 파일이 칸반 프론트매터 키를 갖고
        // 있고 사용자가 명시적으로 마크다운 모드를 선택한 상태가 아니라면, 요청을 가로채 대신
        // kanbanViewType으로 상태를 바꿔치기한다. 이렇게 해서 "칸반 프론트매터가 있는 파일을
        // 열면 자동으로 칸반 보드로 표시된다"는 플러그인의 핵심 동작이 구현된다.
        setViewState(next) {
          return function (state: ViewState, ...rest: any[]) {
            if (
              // Don't force kanban mode during shutdown
              // 플러그인이 언로드되는 중(self._loaded가 false)에는 강제 전환을 하지 않는다
              // (앞서 unload()에서 이미 명시적으로 markdown으로 되돌리는 절차를 수행하므로,
              // 여기서 다시 kanban으로 되돌리면 무한 루프/충돌이 날 수 있음).
              self._loaded &&
              // If we have a markdown file
              // 지금 설정하려는 뷰 타입이 'markdown'이고, 대상 파일 경로 정보가 있는 경우에만
              // 검사를 진행한다.
              state.type === 'markdown' &&
              state.state?.file &&
              // And the current mode of the file is not set to markdown
              // 사용자가 이 leaf/파일에 대해 명시적으로 'markdown' 모드를 선택해 기억해둔
              // 상태가 아니어야 한다(즉, 사용자가 방금 "마크다운으로 보기"를 클릭한 경우는
              // 존중하고 자동 전환하지 않음).
              self.kanbanFileModes[this.id || state.state.file] !== 'markdown'
            ) {
              // Then check for the kanban frontMatterKey
              // metadataCache에서 해당 파일의 캐시(프론트매터 파싱 결과 포함)를 조회한다.
              const cache = self.app.metadataCache.getCache(state.state.file);

              if (cache?.frontmatter && cache.frontmatter[frontmatterKey]) {
                // If we have it, force the view type to kanban
                // 스프레드 연산자(...state)로 기존 state의 모든 속성을 복사한 새 객체를 만들고
                // type만 kanbanViewType으로 덮어써서 불변(immutable)에 가깝게 새 상태 객체를
                // 구성한다(원본 state 객체를 직접 변형하지 않음).
                const newState = {
                  ...state,
                  type: kanbanViewType,
                };

                // 이 파일이 이제 칸반 모드임을 기억해두어, 다음번 호출에서는 위 조건에서
                // 걸러지도록 한다.
                self.kanbanFileModes[state.state.file] = kanbanViewType;

                // 원본 setViewState를 새 state와 나머지 인자들로 호출해 실제 전환을 수행한다.
                return next.apply(this, [newState, ...rest]);
              }
            }

            // 위 조건에 해당하지 않으면(칸반 파일이 아니거나, 이미 markdown 모드로 명시되어
            // 있거나, 언로드 중인 경우) 원래 요청된 state 그대로 원본 메서드를 호출한다.
            return next.apply(this, [state, ...rest]);
          };
        },
      })
    );
  }
}
