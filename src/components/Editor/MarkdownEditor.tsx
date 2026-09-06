/**
 * ============================================================================
 * [실행 순서 #84] src/components/Editor/MarkdownEditor.tsx — CodeMirror 6 기반 카드 제목 인라인 편집기
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화 / 실행-상호작용
 * 칸반 카드 제목(및 기타 인라인 텍스트)을 편집할 때 실제로 화면에 렌더링되는 CodeMirror 6
 * 에디터를 Preact 컴포넌트로 감싼 것이다. Obsidian이 내부적으로 사용하는 진짜 마크다운
 * 에디터 클래스(#1 main.ts의 getEditorClass()가 몰래 추출해 view.plugin.MarkdownEditor에
 * 저장해둔 것)를 상속해 서브클래싱함으로써, Obsidian 기본 에디터와 동일한 문법 강조/자동완성
 * 기능을 그대로 누리면서 Enter/Escape 키 동작이나 붙여넣기 등만 칸반 전용으로 오버라이드한다.
 * useEffect 안에서 CodeMirror EditorView 인스턴스를 직접 생성/해제하므로, Preact의 선언적
 * 렌더링과 CodeMirror의 명령형 API를 연결하는 다리 역할을 한다.
 * ============================================================================
 */
import { insertBlankLine } from '@codemirror/commands';
import { EditorSelection, Extension, Prec } from '@codemirror/state';
import { EditorView, ViewUpdate, keymap, placeholder as placeholderExt } from '@codemirror/view';
import classcat from 'classcat';
import { EditorPosition, Editor as ObsidianEditor, Platform } from 'obsidian';
import { MutableRefObject, useContext, useEffect, useRef } from 'preact/compat';
import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';
import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c, noop } from '../helpers';
import { EditState, isEditing } from '../types';
import { datePlugins, stateManagerField } from './dateWidget';
import { matchDateTrigger, matchTimeTrigger } from './suggest';

// 이 컴포넌트가 부모로부터 받는 props 타입.
// editorRef: 부모가 CodeMirror EditorView 인스턴스에 직접 접근하고 싶을 때 쓰는 Preact ref(useRef로 생성된 객체).
// onEnter/onEscape/onSubmit/onPaste/onChange: 각각 CodeMirror 이벤트를 카드 편집 로직(저장/취소 등)에 연결하는 콜백.
interface MarkdownEditorProps {
  editorRef?: MutableRefObject<EditorView>;
  editState?: EditState;
  onEnter: (cm: EditorView, mod: boolean, shift: boolean) => boolean;
  onEscape: (cm: EditorView) => void;
  onSubmit: (cm: EditorView) => void;
  onPaste?: (e: ClipboardEvent, cm: EditorView) => void;
  onChange?: (update: ViewUpdate) => void;
  value?: string;
  className: string;
  placeholder?: string;
}

// Enter 키를 눌렀을 때 "줄바꿈을 허용할지"를 결정하는 규칙.
// 모바일에서는 Ctrl/Shift 없이 Enter만 누르면 항상 줄바꿈(가상 키보드에 Done/제출 버튼이 따로 있으므로).
// 데스크톱에서는 사용자 설정(new-line-trigger)에 따라 "Enter로 줄바꿈" 모드와
// "Mod(Ctrl/Cmd)+Enter로 줄바꿈" 모드를 서로 반대로 뒤집어 판단한다.
export function allowNewLine(stateManager: StateManager, mod: boolean, shift: boolean) {
  if (Platform.isMobile) return !(mod || shift);
  return stateManager.getSetting('new-line-trigger') === 'enter' ? !(mod || shift) : mod || shift;
}

// Obsidian의 내부 MarkdownEditor는 app.vault.config 등 실제 볼트 설정을 참조해서
// "줄 번호 표시", "제목 접기" 같은 기능을 켤 수도 있는데, 카드 제목처럼 아주 작은 인라인
// 에디터에서는 이런 기능이 불필요하거나 레이아웃을 깨뜨린다. 그래서 JS Proxy로 app 객체를
// 감싸서, vault.config의 특정 키(showLineNumber 등)를 읽을 때는 항상 false를 반환하도록
// "속여서" 해당 기능들이 꺼진 것처럼 보이게 만든다. 그 외의 속성 접근은 원본 그대로 통과(Reflect.get)시킨다.
function getEditorAppProxy(view: KanbanView) {
  return new Proxy(view.app, {
    get(target, prop, reveiver) {
      if (prop === 'vault') {
        return new Proxy(view.app.vault, {
          get(target, prop, reveiver) {
            if (prop === 'config') {
              return new Proxy((view.app.vault as any).config, {
                get(target, prop, reveiver) {
                  if (['showLineNumber', 'foldHeading', 'foldIndent'].includes(prop as string)) {
                    return false;
                  }
                  return Reflect.get(target, prop, reveiver);
                },
              });
            }
            return Reflect.get(target, prop, reveiver);
          },
        });
      }
      return Reflect.get(target, prop, reveiver);
    },
  });
}

// Obsidian의 MarkdownEditor 생성자는 "이 에디터를 소유/제어하는 뷰 컨트롤러" 객체를 요구한다
// (일반적으로는 실제 MarkdownView가 이 역할을 함). 여기서는 칸반 보드가 그 역할을 대신하도록
// 최소한의 인터페이스만 흉내 낸 가짜(마크) 컨트롤러 객체를 만들어 반환한다.
// getEditor는 나중에(에디터 인스턴스가 만들어진 뒤) 실제 Editor 객체를 지연 조회하기 위한 함수다.
function getMarkdownController(
  view: KanbanView,
  getEditor: () => ObsidianEditor
): Record<any, any> {
  return {
    app: view.app,
    showSearch: noop,
    toggleMode: noop,
    onMarkdownScroll: noop,
    getMode: () => 'source',
    scroll: 0,
    editMode: null,
    get editor() {
      return getEditor();
    },
    get file() {
      return view.file;
    },
    get path() {
      return view.file.path;
    },
  };
}

// 사용자가 Vim 키바인딩 플러그인(코드미러의 Vim 모드)을 쓰고 있을 때, 에디터를 열자마자
// "삽입 모드(insert mode)"로 강제 전환해준다. 그래야 Normal 모드에 갇혀 바로 타이핑할 수 없는
// 상황을 피할 수 있다.
function setInsertMode(cm: EditorView) {
  const vim = getVimPlugin(cm);
  if (vim) {
    (window as any).CodeMirrorAdapter?.Vim?.enterInsertMode(vim);
  }
}

// CodeMirror EditorView 내부에 등록된 ViewPlugin들(cm.plugins) 중, Vim 확장이 심어둔
// 플러그인 인스턴스를 구조적 특징(useNextTextInput, waitForCopy 프로퍼티 존재 여부)으로
// 찾아낸다. 공식 API로 노출되지 않는 내부 구현에 의존하는 다소 해키(hacky)한 방식이다.
function getVimPlugin(cm: EditorView): string {
  return (cm as any)?.plugins?.find((p: any) => {
    if (!p?.value) return false;
    return 'useNextTextInput' in p.value && 'waitForCopy' in p.value;
  })?.value?.cm;
}

// 카드 제목 등을 인라인으로 편집하기 위한 Preact 함수형 컴포넌트.
// CodeMirror EditorView는 Preact의 가상 DOM으로 선언적으로 그릴 수 없으므로,
// useEffect 안에서 명령형으로 직접 생성하고, 컴포넌트가 언마운트될 때 정리(cleanup)한다.
export function MarkdownEditor({
  editorRef,
  onEnter,
  onEscape,
  onChange,
  onPaste,
  className,
  onSubmit,
  editState,
  value,
  placeholder,
}: MarkdownEditorProps) {
  // useContext: 상위 KanbanContext.Provider가 내려준 현재 KanbanView/StateManager를 구독 없이 읽어온다.
  const { view, stateManager } = useContext(KanbanContext);
  // useRef: 렌더링 사이에도 유지되는 가변 참조(mutable ref) 객체를 만든다.
  // elRef: CodeMirror가 마운트될 실제 DOM <div> 엘리먼트를 가리킨다.
  const elRef = useRef<HTMLDivElement>();
  // internalRef: 생성된 EditorView 인스턴스를 컴포넌트 내부에서 재사용하기 위해 보관한다(리렌더를 유발하지 않음).
  const internalRef = useRef<EditorView>();

  // useEffect(fn, [])는 "마운트 시 한 번만 실행, 언마운트 시 정리 함수 실행"에 해당하는 Preact/React 훅이다.
  // 즉 이 블록 전체가 CodeMirror 에디터의 생성부터 파괴까지의 생명주기를 담당한다.
  useEffect(() => {
    // Obsidian이 내부적으로 쓰는 실제 MarkdownEditor 클래스(view.plugin.MarkdownEditor)를
    // 그 자리에서 상속(subclass)하여, 필요한 메서드만 오버라이드한 익명 클래스를 만든다.
    // 이렇게 하면 Obsidian 코어의 문법 강조/입력 처리 로직을 그대로 재사용할 수 있다.
    class Editor extends view.plugin.MarkdownEditor {
      // 이 인스턴스가 "칸반 전용 에디터"임을 표시하는 플래그(다른 코드에서 분기 처리에 사용될 수 있음).
      isKanbanEditor = true;

      // Obsidian의 Tasks 플러그인이 제공하는 자동완성을 켤지 여부를 결정하는 훅.
      // 커서 위치가 날짜/시간 트리거 패턴과 겹치면 칸반 자체 자동완성(suggest.ts)과 충돌하지
      // 않도록 Tasks 플러그인 쪽 자동완성은 false를 반환해 끄고, 전역 필터가 있는 첫 줄이면
      // true, 그 외에는 undefined(=기본 동작 위임)를 반환한다.
      showTasksPluginAutoSuggest(
        cursor: EditorPosition,
        editor: ObsidianEditor,
        lineHasGlobalFilter: boolean
      ) {
        if (matchTimeTrigger(stateManager.getSetting('time-trigger'), editor, cursor)) return false;
        if (matchDateTrigger(stateManager.getSetting('date-trigger'), editor, cursor)) return false;
        if (lineHasGlobalFilter && cursor.line === 0) return true;
        return undefined;
      }

      // 원본 MarkdownEditor는 내용에 맞춰 하단 여백을 동적으로 계산하는데, 카드 제목처럼
      // 작은 인라인 편집기에서는 불필요하므로 아무 것도 하지 않도록 비워둔다.
      updateBottomPadding() {}
      // 문서(내용)가 바뀔 때마다 호출되는 콜백. 부모 클래스의 기본 처리(super.onUpdate)를
      // 먼저 수행한 뒤, 이 컴포넌트의 onChange prop이 있으면 CodeMirror의 ViewUpdate 객체를
      // 그대로 전달해 부모(칸반 카드 컴포넌트)가 값 변경을 감지할 수 있게 한다.
      onUpdate(update: ViewUpdate, changed: boolean) {
        super.onUpdate(update, changed);
        onChange && onChange(update);
      }
      // CodeMirror 6는 여러 개의 Extension(익스텐션: 에디터 동작을 조합하는 단위)을 배열로
      // 조합해서 하나의 EditorView를 구성한다. 이 메서드는 부모가 기본 제공하는 확장 목록에
      // 칸반 전용 확장(날짜/시간 위젯, 커스텀 키맵, placeholder, 포커스 이벤트 처리 등)을 덧붙인다.
      buildLocalExtensions(): Extension[] {
        const extensions = super.buildLocalExtensions();

        // StateField.init(...): dateWidget.ts에서 정의한 stateManagerField(코드미러 상태 필드)에
        // 초기값으로 현재 stateManager를 주입한다. 이렇게 하면 datePlugins 같은 다른 확장들이
        // view.state.field(stateManagerField)로 언제든 칸반 상태에 접근할 수 있다.
        extensions.push(stateManagerField.init(() => stateManager));
        // dateWidget.ts에서 만든, 날짜/시간 트리거 구문을 보기 좋은 위젯으로 치환해주는 ViewPlugin들.
        extensions.push(datePlugins);
        extensions.push(
          // Prec.highest: 여러 확장이 같은 이벤트를 처리하려 할 때의 "우선순위(precedence)"를
          // 지정한다. highest로 지정하면 다른 확장보다 먼저 이 핸들러가 실행된다.
          Prec.highest(
            // EditorView.domEventHandlers: CodeMirror 6에서 DOM 이벤트(focus/blur 등)를
            // 직접 가로채는 확장을 만드는 팩토리 함수.
            EditorView.domEventHandlers({
              focus: (evt) => {
                // 이 에디터가 포커스를 받으면 칸반 뷰에게 "지금 활성 에디터는 나"라고 알려서,
                // Obsidian 전역 명령(굵게, 링크 삽입 등)이 이 에디터를 대상으로 동작하게 한다.
                view.activeEditor = this.owner;
                if (Platform.isMobile) {
                  view.contentEl.addClass('is-mobile-editing');
                }

                // setTimeout(0)으로 다음 틱에 미루는 이유: 포커스 이벤트 처리 도중 곧바로
                // workspace.activeEditor를 바꾸면 Obsidian 내부의 다른 포커스 처리 로직과
                // 경합(race)할 수 있어, 현재 이벤트 루프가 끝난 뒤 안전하게 반영하기 위함이다.
                evt.win.setTimeout(() => {
                  this.app.workspace.activeEditor = this.owner;
                  if (Platform.isMobile) {
                    this.app.mobileToolbar.update();
                  }
                });
                // true를 반환하면 CodeMirror에게 "이 이벤트를 처리했다"고 알려 기본 동작을 계속 진행시킨다.
                return true;
              },
              blur: () => {
                // 포커스를 잃으면 모바일 편집 전용 스타일 클래스를 제거하고 툴바를 갱신한다.
                if (Platform.isMobile) {
                  view.contentEl.removeClass('is-mobile-editing');
                  this.app.mobileToolbar.update();
                }
                return true;
              },
            })
          )
        );

        // placeholder prop이 있으면 CodeMirror의 placeholder 확장(빈 에디터에 회색 안내
        // 문구를 보여주는 기능)을 추가한다. import 시 이름 충돌을 피하려고 placeholderExt로 별칭 처리했다.
        if (placeholder) extensions.push(placeholderExt(placeholder));
        if (onPaste) {
          extensions.push(
            // 붙여넣기는 focus/blur보다는 낮지만 일반 확장보다는 높은 우선순위(Prec.high)로 등록해,
            // 기본 붙여넣기 처리보다 먼저 칸반 쪽 onPaste 콜백이 실행되게 한다.
            Prec.high(
              EditorView.domEventHandlers({
                paste: onPaste,
              })
            )
          );
        }

        // Enter 핸들러를 만드는 팩토리 함수. mod(Ctrl/Cmd)와 shift 조합별로 서로 다른
        // CodeMirror 커맨드 함수(EditorView -> boolean)를 생성해서 keymap.of에 등록할 수 있게 한다.
        const makeEnterHandler = (mod: boolean, shift: boolean) => (cm: EditorView) => {
          // 부모(카드 컴포넌트)가 넘겨준 onEnter 콜백을 먼저 실행한다. 이 콜백이 "내가 이미
          // 처리했다(예: 카드 편집을 제출/종료함)"는 의미로 true를 반환하면, 아래의 기본
          // 줄바꿈 삽입 로직은 실행하지 않는다.
          const didRun = onEnter(cm, mod, shift);
          if (didRun) return true;
          if (this.app.vault.getConfig('smartIndentList')) {
            // 리스트 항목 안에서 Enter를 누르면 들여쓰기/목록 기호를 이어서 유지해주는
            // Obsidian 기본 에디터 기능을 그대로 호출한다.
            this.editor.newlineAndIndentContinueMarkdownList();
          } else {
            // @codemirror/commands가 제공하는 표준 커맨드: 현재 커서 위치에 새 줄을 삽입한다.
            insertBlankLine(cm as any);
          }
          return true;
        };

        extensions.push(
          Prec.highest(
            // keymap.of([...]): CodeMirror 6에서 키보드 단축키를 선언하는 표준 방법.
            // 각 객체는 { key, run, shift?, preventDefault? } 형태이며, run은 기본 키(Enter),
            // shift는 Shift가 함께 눌렸을 때 실행할 커맨드를 지정한다.
            keymap.of([
              {
                key: 'Enter',
                run: makeEnterHandler(false, false),
                shift: makeEnterHandler(false, true),
                preventDefault: true,
              },
              {
                // 'Mod-Enter'는 플랫폼에 따라 Ctrl+Enter(윈도우/리눅스) 또는 Cmd+Enter(맥)로
                // 해석되는 CodeMirror의 플랫폼 독립적 표기법이다.
                key: 'Mod-Enter',
                run: makeEnterHandler(true, false),
                shift: makeEnterHandler(true, true),
                preventDefault: true,
              },
              {
                key: 'Escape',
                run: (cm) => {
                  onEscape(cm);
                  // false를 반환하면 "이 커맨드는 이벤트를 완전히 소비하지 않았다"는 뜻이 되어,
                  // 다른 낮은 우선순위의 Escape 핸들러(예: Obsidian 기본 동작)도 계속 실행될 수 있다.
                  return false;
                },
                preventDefault: true,
              },
            ])
          )
        );

        return extensions;
      }
    }

    // 위에서 정의한 컨트롤러/앱 프록시를 준비한다. controller.editMode는 실제 Editor 인스턴스가
    // 생성된 뒤(아래에서) 채워지므로, getMarkdownController에는 지연 조회 함수만 넘긴다.
    const controller = getMarkdownController(view, () => editor.editor);
    const app = getEditorAppProxy(view);
    // 방금 정의한 서브클래스(Editor)의 인스턴스를 실제로 생성한다. Obsidian의 MarkdownEditor
    // 생성자는 (app, 마운트할 DOM 엘리먼트, 컨트롤러)를 인자로 받는다.
    // view.plugin.addChild(...)로 등록해두면, 플러그인이 언로드될 때 Obsidian이 자동으로
    // 이 에디터의 정리(onunload 등)도 함께 호출해준다(Obsidian Component 생명주기 관리).
    const editor = view.plugin.addChild(new (Editor as any)(app, elRef.current, controller));
    const cm: EditorView = editor.cm;

    // 생성된 CodeMirror EditorView를 내부 ref와, 부모가 넘겨준 editorRef(있다면)에 각각 저장한다.
    internalRef.current = cm;
    if (editorRef) editorRef.current = cm;

    controller.editMode = editor;
    // 에디터의 초기 텍스트 값을 설정한다(카드 제목/본문 내용).
    editor.set(value || '');
    // editState가 "지금 편집 중" 상태이고 클릭한 좌표 정보를 담고 있다면, 그 좌표에 해당하는
    // 문서 위치로 커서(선택 영역)를 옮겨서 사용자가 클릭한 지점부터 바로 편집을 이어갈 수 있게 한다.
    if (isEditing(editState)) {
      cm.dispatch({
        // userEvent: CodeMirror 트랜잭션에 "이 변경이 어떤 사용자 동작에서 비롯됐는지" 태그를
        // 붙이는 메타 정보. 'select.pointer'는 마우스 클릭에 의한 선택임을 나타낸다.
        userEvent: 'select.pointer',
        // EditorSelection.single(pos): 문서 내 단일 커서 위치를 선택 영역으로 만든다.
        // cm.posAtCoords: 화면 좌표(x, y)를 문서 내 오프셋(숫자 위치)으로 변환하는 CodeMirror API.
        selection: EditorSelection.single(cm.posAtCoords(editState, false)),
      });

      cm.dom.win.setTimeout(() => {
        setInsertMode(cm);
      });
    }

    // 모바일에서 소프트 키보드가 올라올 때(keyboardDidShow) 에디터가 화면 하단에 가려지지
    // 않도록 자동으로 스크롤해 보여주는 핸들러.
    const onShow = () => {
      elRef.current.scrollIntoView({ block: 'end' });
    };

    if (Platform.isMobile) {
      cm.dom.win.addEventListener('keyboardDidShow', onShow);
    }

    // useEffect의 정리(cleanup) 함수: 컴포넌트가 언마운트되거나 의존성 배열이 바뀌기 전에
    // 호출되어, 등록했던 리스너를 해제하고 CodeMirror 에디터/Obsidian Component를 정리한다.
    return () => {
      if (Platform.isMobile) {
        cm.dom.win.removeEventListener('keyboardDidShow', onShow);

        if (view.activeEditor === controller) {
          view.activeEditor = null;
        }

        if (app.workspace.activeEditor === controller) {
          app.workspace.activeEditor = null;
          (app as any).mobileToolbar.update();
          view.contentEl.removeClass('is-mobile-editing');
        }
      }
      // addChild로 등록했던 Obsidian Component를 제거한다. 이 안에서 Obsidian이 CodeMirror
      // EditorView.destroy() 등 내부 자원 해제를 알아서 처리해준다.
      view.plugin.removeChild(editor);
      internalRef.current = null;
      if (editorRef) editorRef.current = null;
    };
  }, []);

  const cls = ['cm-table-widget'];
  if (className) cls.push(className);

  // 실제로 렌더링하는 것은 CodeMirror가 마운트될 빈 <div>뿐이다(내용은 위 useEffect가
  // 명령형으로 채워 넣는다). 모바일에서는 화면 키보드에 Enter/Done이 없는 경우가 많으므로
  // 별도의 "제출" 버튼을 함께 보여준다.
  return (
    <>
      <div className={classcat(cls)} ref={elRef}></div>
      {Platform.isMobile && (
        <button
          onClick={() => onSubmit(internalRef.current)}
          className={classcat([c('item-submit-button'), 'mod-cta'])}
        >
          {t('Submit')}
        </button>
      )}
    </>
  );
}
