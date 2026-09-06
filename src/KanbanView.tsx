/**
 * ============================================================================
 * [실행 순서 #15] KanbanView.tsx — 칸반 파일 뷰 (TextFileView 구현체)
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화 / 실행-렌더링
 * Obsidian의 TextFileView는 "파일 하나를 데이터 원본으로 삼는 뷰"의 표준 베이스 클래스이며,
 * onLoadFile(파일이 이 뷰에 로드될 때) → setViewData(파일의 원문 텍스트를 뷰 상태로 반영) →
 * (사용자가 편집) → getViewData(디스크에 저장할 최신 텍스트를 반환) → clear(다음 파일을 위해
 * 초기화) 순서로 호출되는 생명주기를 갖는다. 사용자가 kanban-plugin frontmatter가 포함된 .md
 * 파일을 열면 #1(main.ts)이 등록해둔 이 뷰 클래스가 WorkspaceLeaf 안에 인스턴스화되고, 반대로
 * 탭을 닫거나 다른 파일로 전환하면 onunload/clear가 호출되며 소멸(정리)된다. 이 클래스 자체는
 * 보드 데이터를 직접 소유하지 않고, 파일 경로를 키로 하는 #14(StateManager)의 상태를 읽고
 * 쓰는 "창구" 역할만 하며, 실제 Preact 렌더링은 getPortal()이 반환하는 #17(components/Kanban.tsx)과
 * 이를 화면에 이식하는 #16(DragDropApp.tsx)의 createPortal이 담당한다.
 * ============================================================================
 */
import EventEmitter from 'eventemitter3';
import update from 'immutability-helper';
import {
  HoverParent,
  HoverPopover,
  Menu,
  Platform,
  TFile,
  TextFileView,
  ViewStateResult,
  WorkspaceLeaf,
  debounce,
} from 'obsidian';

import { KanbanFormat, KanbanSettings, KanbanViewSettings, SettingsModal } from './Settings';
import { Kanban } from './components/Kanban';
import { BasicMarkdownRenderer } from './components/MarkdownRenderer/MarkdownRenderer';
import { c } from './components/helpers';
import { Board } from './components/types';
import { getParentWindow } from './dnd/util/getWindow';
import { gotoNextDailyNote, gotoPrevDailyNote, hasFrontmatterKeyRaw } from './helpers';
import { bindMarkdownEvents } from './helpers/renderMarkdown';
import { PromiseQueue } from './helpers/util';
import { t } from './lang/helpers';
import KanbanPlugin from './main';
import { frontmatterKey } from './parsers/common';

// Obsidian이 뷰를 식별할 때 사용하는 고유 문자열. main.ts의 registerView(kanbanViewType, ...)와
// 리프(leaf)의 viewType 저장값이 이 상수를 통해 서로 매칭된다.
export const kanbanViewType = 'kanban';
// 탭 헤더/사이드바에 표시될 lucide 아이콘 이름 (Obsidian 내장 lucide 아이콘 세트 사용).
export const kanbanIcon = 'lucide-trello';

// HoverParent를 구현하면 이 뷰 안의 링크를 마우스로 hover 했을 때 Obsidian의 페이지 미리보기
// (Hover Popover) 기능이 정상 동작한다. hoverPopover 필드는 그 팝오버 인스턴스를 보관하는 자리다.
export class KanbanView extends TextFileView implements HoverParent {
  plugin: KanbanPlugin;
  hoverPopover: HoverPopover | null;
  // hotkey, showLaneForm, queueEmpty 등 이 뷰와 하위 Preact 컴포넌트 사이를 잇는 내부 이벤트 버스.
  // React/Preact 트리 바깥(Obsidian 커맨드, 메뉴 클릭 등)에서 발생한 액션을 컴포넌트 쪽으로
  // 전달하거나, 그 반대 방향으로 신호를 보낼 때 props drilling 없이 느슨하게 연결하기 위해 사용한다.
  emitter: EventEmitter;
  // 헤더(탭 오른쪽)에 추가된 액션 버튼들을 key(설정 이름)별로 보관. 설정이 꺼지면 여기서 찾아 제거한다.
  actionButtons: Record<string, HTMLElement> = {};

  // 카드 제목 등 마크다운 텍스트를 미리 렌더링해 캐시해두는 용도. key는 아이템/레인의 id.
  previewCache: Map<string, BasicMarkdownRenderer>;
  // previewCache를 채우는 비동기 렌더링 작업들을 순서대로 처리하기 위한 큐 (동시성 제어).
  previewQueue: PromiseQueue;

  // 카드 내용을 인라인 편집 중일 때 활성화된 CodeMirror 등의 에디터 인스턴스 참조.
  activeEditor: any;
  // 이 뷰 인스턴스에 한정된 뷰 상태(보기 형식, 리스트 접힘 여부 등). setState/getState로 영속화된다.
  viewSettings: KanbanViewSettings = {};

  // getter 문법: 프로퍼티처럼 `view.isPrimary` 형태로 접근하지만 호출 시점마다 새로 계산된다.
  // 같은 파일을 여러 창/탭에서 열어도 StateManager는 파일마다 하나만 존재하는데, 그중 "대표"로
  // 등록된 뷰(getAView())가 바로 this인지를 확인한다. 대표 뷰만 디스크 저장을 트리거하는 등
  // 중복 작업을 피하는 기준으로 쓰인다.
  get isPrimary(): boolean {
    return this.plugin.getStateManager(this.file)?.getAView() === this;
  }

  // 리프 id와 파일 경로를 조합한 문자열로, 같은 파일이 여러 리프(탭/분할창)에 열려 있어도
  // 뷰 인스턴스를 유일하게 구분할 수 있는 식별자를 만든다.
  get id(): string {
    return `${(this.leaf as any).id}:::${this.file?.path}`;
  }

  // Shift 키를 누른 상태인지 여부를 plugin 전역 상태에서 그대로 위임해서 노출하는 getter.
  // (플러그인 레벨에서 전역 keydown/keyup 리스너로 추적한 값을 사용)
  get isShiftPressed(): boolean {
    return this.plugin.isShiftPressed;
  }

  // Obsidian이 이 뷰를 생성할 때 호출하는 생성자. leaf(뷰가 배치될 컨테이너)와 plugin(전역 상태
  // 접근용) 참조를 받아 저장하고, 이 뷰 인스턴스 전용 이벤트 버스/캐시/큐를 초기화한다.
  constructor(leaf: WorkspaceLeaf, plugin: KanbanPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.emitter = new EventEmitter();
    this.previewCache = new Map();

    // previewQueue가 대기 중이던 모든 렌더링 작업을 소진하면 'queueEmpty' 이벤트를 쏴서
    // prerender()에서 await하고 있는 Promise를 깨워준다.
    this.previewQueue = new PromiseQueue(() => this.emitter.emit('queueEmpty'));

    // 'hotkey' 이벤트 패턴: Obsidian 커맨드(main.ts에서 addCommand로 등록)가 실행되면
    // 그 커맨드가 직접 로직을 수행하는 대신 emitter.emit('hotkey', {commandId})로 알리고,
    // 여기서 commandId에 따라 분기 처리한다. 데일리 노트 이전/다음 이동 커맨드가 그 예시.
    this.emitter.on('hotkey', ({ commandId }) => {
      switch (commandId) {
        case 'daily-notes:goto-prev': {
          gotoPrevDailyNote(this.app, this.file);
          break;
        }
        case 'daily-notes:goto-next': {
          gotoNextDailyNote(this.app, this.file);
          break;
        }
      }
    });

    // 마크다운 렌더링(카드 본문 등)에 필요한 Obsidian 이벤트(링크 클릭, hover-link 등)를
    // 이 뷰에 바인딩한다. 상세 구현은 helpers/renderMarkdown 참고.
    bindMarkdownEvents(this);
  }

  // 보드에 포함된 모든 카드(item)의 제목을 미리 마크다운으로 렌더링해 previewCache에 채워두는
  // 선(先)렌더링 단계. 실제 화면에 보드를 그리기 전에 이 작업을 끝내두면, 렌더링 중 마크다운
  // 파싱으로 인한 깜빡임/지연 없이 즉시 캐시된 결과를 보여줄 수 있다.
  async prerender(board: Board) {
    board.children.forEach((lane) => {
      lane.children.forEach((item) => {
        // 이미 캐시된 카드는 다시 렌더링하지 않고 건너뛴다.
        if (this.previewCache.has(item.id)) return;

        // 큐에 렌더링 작업을 등록. addChild로 등록된 자식은 이 뷰가 언로드될 때 자동으로
        // 함께 정리(unload)된다 (Obsidian Component 생명주기 규칙).
        this.previewQueue.add(async () => {
          const preview = this.addChild(new BasicMarkdownRenderer(this, item.data.title));
          this.previewCache.set(item.id, preview);
          await preview.renderCapability.promise;
        });
      });
    });

    // 큐가 아직 처리 중이면, 큐가 전부 비워질 때까지(queueEmpty 이벤트) 한 번만 대기한다.
    if (this.previewQueue.isRunning) {
      await new Promise((res) => {
        this.emitter.once('queueEmpty', res);
      });
    }

    // 선렌더링이 끝난 뒤 헤더 액션 버튼들도 현재 설정에 맞춰 갱신한다.
    this.initHeaderButtons();
  }

  // previewCache에 남아있는 항목 중, 현재 board에 더 이상 존재하지 않는 레인/카드의 캐시를
  // 찾아서 제거(메모리 누수 방지). 카드가 삭제되거나 보드가 재파싱될 때 호출된다.
  validatePreviewCache(board: Board) {
    const seenKeys = new Set<string>();
    board.children.forEach((lane) => {
      seenKeys.add(lane.id);
      lane.children.forEach((item) => {
        seenKeys.add(item.id);
      });
    });

    for (const k of this.previewCache.keys()) {
      if (!seenKeys.has(k)) {
        // Obsidian Component API: addChild로 등록했던 자식을 명시적으로 제거(unload)한다.
        this.removeChild(this.previewCache.get(k));
        this.previewCache.delete(k);
      }
    }
  }

  // 보드의 표시 형식(board/table/list 등)을 변경한다. 이 뷰의 로컬 상태(setViewState)뿐
  // 아니라 파일 자체의 frontmatter(kanban-plugin 등 관련 키)도 함께 갱신해, 파일을 다시
  // 열었을 때도 형식이 유지되도록 한다.
  setView(view: KanbanFormat) {
    this.setViewState(frontmatterKey, view);
    this.app.fileManager.processFrontMatter(this.file, (frontmatter) => {
      frontmatter[frontmatterKey] = view;
    });
  }

  // 이 파일에 연결된 StateManager를 찾아 새 보드 상태를 반영시킨다. shouldSave가 true면
  // (기본값) StateManager가 내부적으로 마크다운으로 재직렬화해 디스크 저장까지 트리거한다.
  setBoard(board: Board, shouldSave: boolean = true) {
    const stateManager = this.plugin.stateManagers.get(this.file);
    stateManager.setState(board, shouldSave);
  }

  // 현재 파일의 StateManager가 들고 있는 최신 보드 상태(파싱된 객체 모델)를 가져온다.
  getBoard(): Board {
    const stateManager = this.plugin.stateManagers.get(this.file);
    return stateManager.state;
  }

  // Obsidian이 뷰 종류를 식별할 때 사용하는 타입 문자열 반환 (kanbanViewType 상수와 동일).
  getViewType() {
    return kanbanViewType;
  }

  // 탭 헤더에 표시할 아이콘 이름.
  getIcon() {
    return kanbanIcon;
  }

  // 탭 헤더에 표시할 제목. 아직 파일이 없으면 기본 문자열 'Kanban'을 대신 보여준다.
  getDisplayText() {
    return this.file?.basename || 'Kanban';
  }

  // 이 뷰의 DOM이 속한 실제 Window 객체를 반환 (팝아웃 창 지원: Obsidian은 탭을 별도
  // 브라우저 창으로 분리할 수 있으므로 항상 전역 window를 써서는 안 된다).
  getWindow() {
    return getParentWindow(this.containerEl) as Window & typeof globalThis;
  }

  // 새 파일을 이 뷰에 로드하기 직전 호출됨. 먼저 plugin.removeView로 (혹시 이 뷰가 이전
  // 파일의 StateManager에 등록되어 있었다면) 등록을 해제한 뒤, TextFileView의 기본
  // loadFile 로직(내부적으로 onUnloadFile → onLoadFile 순서를 호출)을 그대로 위임한다.
  async loadFile(file: TFile) {
    this.plugin.removeView(this);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return super.loadFile(file);
  }

  // TextFileView 생명주기 훅: 파일 로드가 완료된 시점에 호출된다. 로드 도중 에러가 나면
  // (예: 잘못된 형식의 보드) 해당 파일의 StateManager에 에러 상태를 기록해 UI가 에러 화면을
  // 보여줄 수 있게 하고, 에러를 다시 던져 Obsidian에도 실패를 알린다.
  async onLoadFile(file: TFile) {
    try {
      return await super.onLoadFile(file);
    } catch (e) {
      const stateManager = this.plugin.stateManagers.get(this.file);
      stateManager?.setError(e);
      throw e;
    }
  }

  // Obsidian Component 생명주기: 뷰(및 그 DOM)가 실제로 워크스페이스에 부착될 때 호출된다.
  onload() {
    super.onload();
    // 모바일 환경에서는 하단 내비게이션 바 높이만큼 CSS 변수로 노출해, 칸반 보드 레이아웃이
    // 내비게이션 바에 가려지지 않도록 한다.
    if (Platform.isMobile) {
      this.containerEl.setCssProps({
        '--mobile-navbar-height': (this.app as any).mobileNavbar.containerEl.clientHeight + 'px',
      });
    }

    // 탭을 다른 창(팝아웃 윈도우)으로 이동시켰을 때 발생하는 이벤트를 구독. register()로
    // 등록하면 이 뷰가 unload될 때 리스너도 자동 해제된다. 창이 바뀌면 기존 뷰 등록을 해제하고
    // 같은 데이터로 다시 addView하여 새 창 컨텍스트에 맞게 재등록한다.
    this.register(
      this.containerEl.onWindowMigrated(() => {
        this.plugin.removeView(this);
        this.plugin.addView(this, this.data, this.isPrimary);
      })
    );
  }

  // 뷰가 파괴되거나 탭이 닫힐 때 호출되는 정리 단계. 진행 중인 렌더링 큐/캐시를 비우고,
  // 이 뷰가 화면(DOM)에서 완전히 분리된 뒤에는 드래그앤드롭 관련 참조도 함께 제거해야
  // 참조가 끊긴 DOM 노드를 잘못 조작하는 일을 막는다.
  onunload(): void {
    super.onunload();

    this.previewQueue.clear();
    this.previewCache.clear();
    this.emitter.emit('queueEmpty');

    // Remove draggables from render, as the DOM has already detached
    this.plugin.removeView(this);
    this.emitter.removeAllListeners();
    this.activeEditor = null;
    this.actionButtons = {};
  }

  // 파일 이름이 변경되었을 때 Obsidian이 호출. 이 뷰가 보고 있던 파일과 새 경로가 일치하면
  // (즉 리네임 대상이 바로 이 파일이면) plugin에게 StateManager 등의 키 갱신을 위임한다.
  handleRename(newPath: string, oldPath: string) {
    if (this.file.path === newPath) {
      this.plugin.handleViewFileRename(this, oldPath);
    }
  }

  // StateManager 등이 새로 직렬화한 마크다운 문자열을 디스크에 저장 요청하는 통로.
  // 내용이 실제로 달라졌고 이 뷰가 대표(isPrimary) 뷰일 때만 requestSave()를 호출해
  // 같은 파일을 여러 뷰가 열고 있어도 저장 요청이 중복되지 않게 한다. 대표가 아니면
  // 로컬 캐시(this.data)만 갱신하고 실제 저장은 대표 뷰에 맡긴다.
  requestSaveToDisk(data: string) {
    if (this.data !== data && this.isPrimary) {
      this.data = data;
      this.requestSave();
    } else {
      this.data = data;
    }
  }

  // TextFileView 생명주기: Obsidian이 "현재 뷰가 들고 있는 최신 텍스트"를 요청할 때 호출.
  getViewData() {
    // In theory, we could unparse the board here.  In practice, the board can be
    // in an error state, so we return the last good data here.  (In addition,
    // unparsing is slow, and getViewData() can be called more often than the
    // data actually changes.)
    return this.data;
  }

  // TextFileView 생명주기: 파일의 원문 텍스트(data)가 (다시) 주어졌을 때 호출된다. 여기서
  // 이 파일이 여전히 "칸반 파일"인지(frontmatter의 kanban-plugin 키 존재 여부)를 먼저
  // 검사한다. frontmatter가 없다면(사용자가 직접 지워버렸거나 애초에 칸반 파일이 아니었던
  // 경우) 이 커스텀 뷰를 유지할 이유가 없으므로, 파일 모드를 'markdown'으로 표시해두고
  // 이 뷰의 StateManager 등록을 해제한 뒤 일반 마크다운 뷰로 강제 전환하고 즉시 반환한다.
  setViewData(data: string, clear?: boolean) {
    if (!hasFrontmatterKeyRaw(data)) {
      this.plugin.kanbanFileModes[(this.leaf as any).id || this.file.path] = 'markdown';
      this.plugin.removeView(this);
      this.plugin.setMarkdownView(this.leaf, false);

      return;
    }

    // clear=true는 "완전히 새 파일을 로드하는 것"에 해당(예: 다른 파일로 전환). 이 경우
    // 이전 파일과 관련된 인라인 에디터/미리보기 캐시/헤더 버튼 등 뷰 로컬 상태를 전부
    // 초기화해서 새 파일의 상태와 뒤섞이지 않도록 한다. clear가 false/undefined면 같은
    // 파일 내에서의 갱신(예: 외부에서 파일이 수정됨)이므로 기존 상태를 유지한다.
    if (clear) {
      this.activeEditor = null;
      this.previewQueue.clear();
      this.previewCache.clear();
      this.emitter.emit('queueEmpty');
      Object.values(this.actionButtons).forEach((b) => b.remove());
      this.actionButtons = {};
    }

    // frontmatter가 정상 확인되었으므로 plugin에 위임해 (필요하다면 새로) StateManager를
    // 만들거나 재사용하고, 이 뷰를 그 StateManager의 구독자로 등록한다. 세 번째 인자는
    // "이 뷰가 대표 뷰가 되어야 하는지" 여부이며, clear(새 파일 로드)가 아니면서 이미
    // 대표였던 뷰는 계속 대표를 유지한다.
    this.plugin.addView(this, data, !clear && this.isPrimary);
  }

  // Obsidian 뷰 상태(레이아웃 저장/복원용 JSON)를 주입받을 때 호출. 커스텀 필드
  // kanbanViewState만 이 뷰의 viewSettings로 꺼내 저장하고, 나머지 표준 상태 처리는
  // super.setState에 위임한다.
  async setState(state: any, result: ViewStateResult): Promise<void> {
    this.viewSettings = { ...state.kanbanViewState };
    await super.setState(state, result);
  }

  // 반대로 현재 상태를 Obsidian이 워크스페이스 레이아웃(workspace.json)에 저장할 수 있도록
  // 직렬화해 반환. 표준 상태에 kanbanViewState 필드를 덧붙여 확장한다.
  getState() {
    const state = super.getState();
    state.kanbanViewState = { ...this.viewSettings };
    return state;
  }

  // 제네릭 K를 KanbanViewSettings의 키로 제한하는 TypeScript 문법(`<K extends keyof T>`).
  // 이렇게 하면 호출부에서 key와 val의 타입이 서로 어긋나지 않도록 컴파일 타임에 검증된다.
  // globalUpdater가 주어지면 "이 파일을 보고 있는 모든 뷰"에 대해 일괄적으로 값을 갱신하고
  // (예: 리스트 접힘 상태를 모든 창에서 동기화), 그렇지 않고 val만 주어지면 이 뷰 하나의
  // viewSettings만 갱신한다. 마지막에는 항상 Obsidian에 레이아웃 저장을 요청해 getState()가
  // 다음에 호출될 때 최신 값이 반영되도록 한다.
  setViewState<K extends keyof KanbanViewSettings>(
    key: K,
    val?: KanbanViewSettings[K],
    globalUpdater?: (old: KanbanViewSettings[K]) => KanbanViewSettings[K]
  ) {
    if (globalUpdater) {
      const stateManager = this.plugin.getStateManager(this.file);
      stateManager.viewSet.forEach((view) => {
        view.viewSettings[key] = globalUpdater(view.viewSettings[key]);
      });
    } else if (val) {
      this.viewSettings[key] = val;
    }

    this.app.workspace.requestSaveLayout();
  }

  // 보드 파일의 frontmatter/전역 설정(settings)에 정의된 기본값으로, 아직 이 뷰의
  // viewSettings에 값이 없는 항목들만 채워 넣는다(`??=`는 nullish일 때만 대입). 새로 열린
  // 뷰가 파일에 저장된 기본 형식/접힘 상태를 그대로 물려받도록 하기 위함이다.
  populateViewState(settings: KanbanSettings) {
    this.viewSettings['kanban-plugin'] ??= settings['kanban-plugin'] || 'board';
    this.viewSettings['list-collapse'] ??= settings['list-collapse'] || [];
  }

  // 이 뷰 전용 설정값(viewSettings)이 있으면 그것을, 없으면 StateManager가 관리하는
  // 파일 단위 설정(getSetting)을 대신 반환하는 폴백 체인.
  getViewState<K extends keyof KanbanViewSettings>(key: K) {
    const stateManager = this.plugin.stateManagers.get(this.file);
    const settingVal = stateManager.getSetting(key);
    return this.viewSettings[key] ?? settingVal;
  }

  // getViewState와 동일한 폴백 로직이지만 stateManager.useSetting을 사용한다. useSetting은
  // (Preact 훅과 유사하게) 값이 바뀔 때 구독 중인 컴포넌트를 리렌더링시키는 반응형 버전으로
  // 추정되며, 이 값은 렌더링 도중(컴포넌트 함수 내부)에서 호출되어야 한다.
  useViewState<K extends keyof KanbanViewSettings>(key: K) {
    const stateManager = this.plugin.stateManagers.get(this.file);
    const settingVal = stateManager.useSetting(key);
    return this.viewSettings[key] ?? settingVal;
  }

  // #16(DragDropApp.tsx)이 createPortal로 실제 DOM에 이식할 Preact 엘리먼트를 생성해
  // 반환한다. StateManager와 view(this) 자신을 props로 넘겨, 하위 컴포넌트 트리 전체가
  // 보드 상태를 읽고 뷰 API(헤더 버튼, 뷰 전환 등)를 호출할 수 있게 연결하는 진입점이다.
  getPortal() {
    const stateManager = this.plugin.stateManagers.get(this.file);
    return <Kanban stateManager={stateManager} view={this} />;
  }

  // 보드 설정(SettingsModal)을 여는 헬퍼. 모달에서 설정이 변경되면 immutability-helper의
  // update()로 board.data.settings 부분만 불변 업데이트한 새 보드 객체를 만들고,
  // StateManager.setState로 반영 + 저장까지 트리거한다.
  getBoardSettings() {
    const stateManager = this.plugin.stateManagers.get(this.file);
    const board = stateManager.state;

    new SettingsModal(
      this,
      {
        onSettingsChange: (settings) => {
          const updatedBoard = update(board, {
            data: {
              settings: {
                $set: settings,
              },
            },
          });

          // Save to disk, compute text of new board
          stateManager.setState(updatedBoard);
        },
      },
      board.data.settings
    ).open();
  }

  // Obsidian의 "탭 더보기(more-options)" 컨텍스트 메뉴를 구성하는 훅. source가
  // 'more-options'가 아니면(예: 다른 종류의 메뉴 호출) 그대로 부모 구현에 위임한다.
  // Obsidian Menu API: menu.addItem(cb)를 체이닝하며 각 콜백에서 setTitle/setIcon/
  // setSection/onClick으로 메뉴 항목 하나를 구성한다. callSuper 플래그로, 이 커스텀
  // 항목들을 추가한 뒤 부모(super)의 기본 메뉴 항목까지 이어붙일지 선택할 수 있다.
  onPaneMenu(menu: Menu, source: string, callSuper: boolean = true) {
    if (source !== 'more-options') {
      super.onPaneMenu(menu, source);
      return;
    }
    // Add a menu item to force the board to markdown view
    menu
      .addItem((item) => {
        item
          .setTitle(t('Open as markdown'))
          .setIcon('lucide-file-text')
          .setSection('pane')
          .onClick(() => {
            this.plugin.kanbanFileModes[(this.leaf as any).id || this.file.path] = 'markdown';
            this.plugin.setMarkdownView(this.leaf);
          });
      })
      .addItem((item) => {
        item
          .setTitle(t('Open board settings'))
          .setIcon('lucide-settings')
          .setSection('pane')
          .onClick(() => {
            this.getBoardSettings();
          });
      })
      .addItem((item) => {
        item
          .setTitle(t('Archive completed cards'))
          .setIcon('lucide-archive')
          .setSection('pane')
          .onClick(() => {
            const stateManager = this.plugin.stateManagers.get(this.file);
            stateManager.archiveCompletedCards();
          });
      });

    if (callSuper) {
      super.onPaneMenu(menu, source);
    }
  }

  // debounce(fn, 10, true)로 감싼 공개 진입점. 설정 변경, 파일 로드, prerender 완료 등
  // 여러 이벤트가 짧은 시간 안에 연달아 initHeaderButtons()를 호출할 수 있는데, 매번
  // _initHeaderButtons의 DOM add/remove 작업을 그대로 실행하면 헤더 아이콘이 반복적으로
  // 깜빡이거나 불필요한 작업이 중복 실행된다. debounce의 세 번째 인자 true는 "leading edge"
  // 실행을 의미해, 연속 호출의 맨 처음 한 번은 즉시 실행하고 이후 10ms 이내의 재호출은
  // 무시(마지막 호출 기준으로 한 번 더 정리)하여 헤더 갱신 빈도를 안정적으로 제한한다.
  initHeaderButtons = debounce(() => this._initHeaderButtons(), 10, true);

  // 실제 헤더 액션 버튼들을 StateManager의 현재 설정값에 맞춰 추가/제거하는 본체.
  // 각 버튼마다 "설정이 켜져 있는데 버튼이 아직 없으면 추가, 설정이 꺼졌는데 버튼이
  // 남아있으면 제거"라는 동일한 패턴이 반복된다 (idempotent하게 여러 번 호출해도 안전).
  _initHeaderButtons = async () => {
    // 휴대폰(좁은 화면)에서는 헤더 액션 버튼을 아예 표시하지 않는다.
    if (Platform.isPhone) return;
    const stateManager = this.plugin.getStateManager(this.file);

    // 아직 StateManager가 준비되지 않았다면(파일 로드 중 등) 아무 것도 하지 않는다.
    if (!stateManager) return;

    // "보드 설정 열기" 버튼
    if (
      stateManager.getSetting('show-board-settings') &&
      !this.actionButtons['show-board-settings']
    ) {
      this.actionButtons['show-board-settings'] = this.addAction(
        'lucide-settings',
        t('Open board settings'),
        () => {
          this.getBoardSettings();
        }
      );
    } else if (
      !stateManager.getSetting('show-board-settings') &&
      this.actionButtons['show-board-settings']
    ) {
      this.actionButtons['show-board-settings'].remove();
      delete this.actionButtons['show-board-settings'];
    }

    // "보드 보기 형식 전환(board/table/list)" 버튼. 클릭하면 Obsidian Menu를 마우스
    // 위치에 띄워 현재 형식에 체크 표시(setChecked)를 하고, 항목 클릭 시 setView()를 호출한다.
    if (stateManager.getSetting('show-set-view') && !this.actionButtons['show-set-view']) {
      this.actionButtons['show-set-view'] = this.addAction(
        'lucide-view',
        t('Board view'),
        (evt) => {
          const view = this.viewSettings[frontmatterKey] || stateManager.getSetting(frontmatterKey);
          new Menu()
            .addItem((item) =>
              item
                .setTitle(t('View as board'))
                .setIcon('lucide-trello')
                .setChecked(view === 'basic' || view === 'board')
                .onClick(() => this.setView('board'))
            )
            .addItem((item) =>
              item
                .setTitle(t('View as table'))
                .setIcon('lucide-table')
                .setChecked(view === 'table')
                .onClick(() => this.setView('table'))
            )
            .addItem((item) =>
              item
                .setTitle(t('View as list'))
                .setIcon('lucide-server')
                .setChecked(view === 'list')
                .onClick(() => this.setView('list'))
            )
            .showAtMouseEvent(evt);
        }
      );
    } else if (!stateManager.getSetting('show-set-view') && this.actionButtons['show-set-view']) {
      this.actionButtons['show-set-view'].remove();
      delete this.actionButtons['show-set-view'];
    }

    // "검색" 버튼. 클릭 시 직접 검색 로직을 구현하지 않고 emitter로 'editor:open-search'
    // hotkey 이벤트를 발생시켜, 이 뷰 생성자에 등록된 hotkey 리스너(또는 하위 컴포넌트의
    // 리스너)가 실제 동작을 처리하도록 위임한다.
    if (stateManager.getSetting('show-search') && !this.actionButtons['show-search']) {
      this.actionButtons['show-search'] = this.addAction('lucide-search', t('Search...'), () => {
        this.emitter.emit('hotkey', { commandId: 'editor:open-search' });
      });
    } else if (!stateManager.getSetting('show-search') && this.actionButtons['show-search']) {
      this.actionButtons['show-search'].remove();
      delete this.actionButtons['show-search'];
    }

    // "마크다운으로 보기" 버튼: 클릭 시 이 파일의 모드를 markdown으로 강제 전환한다.
    if (
      stateManager.getSetting('show-view-as-markdown') &&
      !this.actionButtons['show-view-as-markdown']
    ) {
      this.actionButtons['show-view-as-markdown'] = this.addAction(
        'lucide-file-text',
        t('Open as markdown'),
        () => {
          this.plugin.kanbanFileModes[(this.leaf as any).id || this.file.path] = 'markdown';
          this.plugin.setMarkdownView(this.leaf);
        }
      );
    } else if (
      !stateManager.getSetting('show-view-as-markdown') &&
      this.actionButtons['show-view-as-markdown']
    ) {
      this.actionButtons['show-view-as-markdown'].remove();
      delete this.actionButtons['show-view-as-markdown'];
    }

    // "완료된 카드 전체 보관(archive)" 버튼.
    if (stateManager.getSetting('show-archive-all') && !this.actionButtons['show-archive-all']) {
      this.actionButtons['show-archive-all'] = this.addAction(
        'lucide-archive',
        t('Archive completed cards'),
        () => {
          const stateManager = this.plugin.stateManagers.get(this.file);
          stateManager.archiveCompletedCards();
        }
      );
    } else if (
      !stateManager.getSetting('show-archive-all') &&
      this.actionButtons['show-archive-all']
    ) {
      this.actionButtons['show-archive-all'].remove();
      delete this.actionButtons['show-archive-all'];
    }

    // "리스트(레인) 추가" 버튼. 다른 버튼들과 달리 직접 로직을 실행하지 않고 emitter로
    // 'showLaneForm' 이벤트만 발생시켜, 실제 "새 레인 입력 폼 띄우기" 처리는 이를 구독하는
    // Preact 컴포넌트(보드 UI) 쪽에 맡긴다. 이벤트 기반으로 뷰(Obsidian 레이어)와
    // 컴포넌트(Preact 레이어) 사이의 책임을 분리하는 대표적인 패턴이다. ignore-click-outside
    // 클래스는 "바깥 클릭 시 폼 닫기" 로직이 이 버튼 클릭 자체는 바깥 클릭으로 간주해
    // 폼을 즉시 닫아버리지 않도록 예외 처리하기 위한 마커이다.
    if (stateManager.getSetting('show-add-list') && !this.actionButtons['show-add-list']) {
      const btn = this.addAction('lucide-plus-circle', t('Add a list'), () => {
        this.emitter.emit('showLaneForm', undefined);
      });

      btn.addClass(c('ignore-click-outside'));

      this.actionButtons['show-add-list'] = btn;
    } else if (!stateManager.getSetting('show-add-list') && this.actionButtons['show-add-list']) {
      this.actionButtons['show-add-list'].remove();
      delete this.actionButtons['show-add-list'];
    }
  };

  // TextFileView 추상 메서드 구현. 아래 원본 주석에서 설명하듯, Obsidian은 파일 언로드
  // 직후(onUnloadFile → save(true) 이후) 다음 파일을 로드하기 *전에* 이 메서드를 호출하며,
  // 이 시점의 this.file은 이미 예전 파일을 가리키고 있어 파일을 참조하는 어떤 작업도
  // 안전하지 않다. 그래서 실제 상태 초기화는 여기가 아니라 setViewData()의 clear 분기와
  // onLoadFile()의 에러 핸들러에서 수행하도록 설계되어 있고, 이 메서드는 추상 메서드라서
  // 생략할 수 없기 때문에 본문이 비어 있는 채로 유지된다. (즉, 위쪽의 onLoadFile/setViewData가
  // 이 메서드가 실질적으로 해야 할 일을 대신 책임진다.)
  clear() {
    /*
      Obsidian *only* calls this after unloading a file, before loading the next.
      Specifically, from onUnloadFile, which calls save(true), and then optionally
      calls clear, if and only if this.file is still non-empty.  That means that
      in this function, this.file is still the *old* file, so we should not do
      anything here that might try to use the file (including its path), so we
      should avoid doing anything that refreshes the display.  (Since that could
      use the file, and would also flash an empty pane during navigation, depending
      on how long the next file load takes.)

      Given all that, it makes more sense to clean up our state from onLoadFile, as
      following a clear there are only two possible states: a successful onLoadFile
      updates our full state via setViewData(), or else it aborts with an error
      first.  So as long as setViewData() and the error handler for onLoadFile()
      fully reset the state (to a valid load state or a valid error state),
      there's nothing to do in this method.  (We can't omit it, since it's
      abstract.)
    */
  }
}
