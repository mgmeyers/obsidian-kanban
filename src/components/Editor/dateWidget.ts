/**
 * ============================================================================
 * [실행 순서 #85] src/components/Editor/dateWidget.ts — 날짜/시간 트리거 구문을 CodeMirror 위젯으로 표시
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화 / 실행-상호작용
 * #84(MarkdownEditor.tsx)의 buildLocalExtensions()에 주입되는 CodeMirror 6 확장 모음이다.
 * 카드 본문에 `@{2024-01-01}`처럼 원문 그대로 남아있는 날짜/시간 트리거 구문을, 사용자가
 * 실제로 입력한 원문 대신 "1월 1일" 같은 보기 좋은 텍스트 위젯(WidgetType)으로 화면에만
 * 대체(Decoration.replace)해서 보여준다. 실제 문서 텍스트는 바뀌지 않고, 오직 렌더링만
 * 바뀌는 것이 핵심이다. StateField로 StateManager 참조를 에디터 상태에 실어 나르고,
 * MatchDecorator + ViewPlugin으로 정규식 매치 위치마다 위젯 데코레이션을 생성/갱신한다.
 * ============================================================================
 */
import { Extension, StateField } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  MatchDecorator,
  PluginSpec,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { moment } from 'obsidian';

import { StateManager } from '../../StateManager';
import { escapeRegExpStr } from '../helpers';

// CodeMirror 6의 StateField: 에디터의 트랜잭션(변경 사항)마다 갱신되는 "상태 조각"을 정의한다.
// 여기서는 실제로는 트랜잭션에 따라 값이 바뀌지 않고(update에서 그대로 state를 반환),
// 단지 "이 카드가 속한 칸반 보드의 StateManager 인스턴스를 에디터 상태 트리 안에 실어서,
// 다른 CodeMirror 확장(아래 create()가 만드는 ViewPlugin 등)이 view.state.field(...)로
// 언제든 꺼내 쓸 수 있게" 하기 위한 용도로 사용된다. 초기값은 #84에서
// stateManagerField.init(() => stateManager)로 주입된다.
export const stateManagerField = StateField.define<StateManager | null>({
  create() {
    return null;
  },
  update(state) {
    return state;
  },
});

// CodeMirror 6의 WidgetType: 문서의 일부 범위를 대체해서 그릴 "커스텀 DOM 위젯"을 정의할 때
// 상속하는 추상 클래스. 여기서는 트리거 구문(예: '@{2024-01-01}')을 사람이 읽기 좋은 날짜/시간
// 문자열로 대체해서 보여주는 위젯이다.
class DateTimeWidget extends WidgetType {
  date: moment.Moment;
  stateManager: StateManager;
  type: string;

  constructor(stateManager: StateManager, date: moment.Moment, type: 'date' | 'time') {
    super();
    this.stateManager = stateManager;
    this.type = type;
    this.date = date;
  }

  // CodeMirror가 위젯을 다시 그릴지 재사용할지 판단할 때 호출하는 동등성 비교 메서드.
  // 같은 날짜를 나타내는 위젯이면(isSame) 기존 DOM을 재사용해 불필요한 리렌더를 피한다.
  eq(widget: this): boolean {
    return this.date.isSame(widget.date);
  }

  // 실제로 화면에 삽입될 DOM 엘리먼트를 생성한다. createSpan은 Obsidian이 전역에 주입하는
  // DOM 헬퍼(HTMLElement 프로토타입 확장)로, <span> 엘리먼트를 만들고 콜백으로 내부를 채운다.
  // date-display-format/time-format 설정에 맞춰 moment로 포맷팅한 문자열을 자식 span에 넣는다.
  toDOM() {
    return createSpan(
      {
        cls: `cm-kanban-${this.type}-wrapper`,
      },
      (span) => {
        span.createSpan({
          cls: `cm-kanban-${this.type}`,
          text: this.date.format(
            this.stateManager.getSetting(
              this.type === 'time' ? 'time-format' : 'date-display-format'
            )
          ),
        });
      }
    );
  }

  // false를 반환하면 "이 위젯 위에서 발생하는 이벤트(클릭 등)를 CodeMirror가 무시하지 말고
  // 계속 처리하라"는 뜻이 되어, 위젯을 클릭했을 때도 에디터가 정상적으로 커서를 옮기는 등의
  // 기본 동작을 할 수 있게 한다.
  ignoreEvent(): boolean {
    return false;
  }
}

// type('date' | 'time')별로 MatchDecorator에 전달할 decorate 콜백을 만드는 팩토리 함수.
// MatchDecorator가 정규식에 매치된 위치를 찾을 때마다 이 콜백을 호출해준다.
function decorate(type: 'date' | 'time') {
  return (
    add: (from: number, to: number, decoration: Decoration) => void,
    from: number,
    to: number,
    match: RegExpExecArray,
    view: EditorView
  ) => {
    // 위에서 정의한 stateManagerField를 통해 현재 문서가 속한 칸반 보드의 설정(날짜/시간
    // 포맷 등)을 읽어온다. StateManager가 없으면(비정상 상태) 아무 데코레이션도 추가하지 않는다.
    const stateManager = view.state.field(stateManagerField);
    if (!stateManager) return;

    // 정규식 캡처 그룹(괄호 안, match[1])이 실제 날짜/시간 문자열이다.
    const dateStr = match[1];
    const parsed = moment(
      dateStr,
      stateManager.getSetting(type === 'date' ? 'date-format' : 'time-format')
    );

    // 설정된 포맷으로 파싱했을 때 유효한 날짜/시간이 아니면(오타 등) 위젯으로 바꾸지 않고
    // 원문 텍스트를 그대로 남겨둔다.
    if (!parsed.isValid()) return;

    // Decoration.replace: 문서의 [from, to) 범위를 화면에서 완전히 위젯으로 대체한다.
    // (문서 자체의 텍스트는 그대로 유지되며, 오직 렌더링 결과에서만 위젯으로 바뀐다.)
    add(
      from,
      to,
      Decoration.replace({
        widget: new DateTimeWidget(stateManager, parsed, type),
      })
    );
  };
}

// 하나의 정규식 패턴에 대해, 문서 전체를 스캔하며 데코레이션 목록(DecorationSet)을 관리하는
// 클래스. ViewPlugin.define의 콜백(아래 create() 참고)에서 인스턴스가 생성되며,
// CodeMirror가 요구하는 "생성자(view) + update(update)" 형태의 플러그인 값 규약을 따른다.
class DateDecorator {
  decos: DecorationSet;
  decorator: MatchDecorator;
  type: string;
  constructor(view: EditorView, regexp: RegExp, type: 'date' | 'time') {
    // MatchDecorator: CodeMirror 6 유틸리티로, 정규식에 매치되는 모든 위치를 찾아
    // decorate 콜백을 호출해주고 그 결과를 하나의 DecorationSet으로 모아준다.
    // 문서 전체를 매번 처음부터 스캔하지 않고, 뷰포트/변경분 위주로 효율적으로 갱신해준다.
    this.decorator = new MatchDecorator({
      regexp,
      decorate: decorate(type),
    });
    // createDeco(view): 현재 뷰 상태를 기준으로 초기 데코레이션 집합을 생성한다.
    this.decos = this.decorator.createDeco(view);
  }
  // ViewPlugin 인스턴스는 매 뷰 업데이트(ViewUpdate)마다 update가 호출된다.
  // 문서 내용이 실제로 바뀐 경우(docChanged)에만 데코레이션을 다시 계산해 성능을 아낀다.
  update(update: ViewUpdate) {
    if (update.docChanged) {
      this.decos = this.decorator.createDeco(update.view);
    }
  }
}

// ViewPlugin.define(fn, spec)의 두 번째 인자(PluginSpec): 플러그인 인스턴스로부터
// "실제 데코레이션을 어떻게 뽑아낼지(decorations)"와, 다른 확장에게 무엇을 제공(provide)할지
// 정의한다. 여기서는 EditorView.atomicRanges를 통해, 위젯으로 대체된 범위를 "원자적(atomic)"
// 영역으로 취급하게 만든다 — 즉 커서가 위젯 중간으로 들어가지 못하고 위젯 전체를 한 번에
// 건너뛰게 되어, 사용자 입장에서는 위젯이 하나의 문자처럼 동작한다.
const config: PluginSpec<DateDecorator> = {
  decorations: (v) => v.decos,
  provide: (p) =>
    EditorView.atomicRanges.of((view) => {
      return view.plugin(p)?.decos || Decoration.none;
    }),
};

// 'date' 또는 'time' 타입과, 트리거 문자열 뒤에 이어질 정규식(reStr, 예: '{([^}]+)}')을 받아
// 하나의 CodeMirror ViewPlugin(Extension)을 만들어 반환하는 팩토리.
// dateTrigger/timeTrigger 설정값을 정규식 앞에 붙여 최종 매치 패턴을 완성한다.
function create(type: 'date' | 'time', reStr: string) {
  return ViewPlugin.define((view) => {
    const stateManager = view.state.field(stateManagerField);
    const dateTrigger = stateManager.getSetting(type === 'date' ? 'date-trigger' : 'time-trigger');
    return new DateDecorator(
      view,
      new RegExp(`${escapeRegExpStr(dateTrigger)}${reStr}`, 'g'),
      type
    );
  }, config);
}

// #84(MarkdownEditor.tsx)에서 buildLocalExtensions()에 통째로 push되는 최종 확장 배열.
// 시간 트리거(`{HH:mm}`), 날짜 트리거(`{...}` 형식), 그리고 위키링크(`[[...]]`)나
// 마크다운 링크(`[텍스트](경로)`) 형태로 감싸진 날짜 표기까지, 서로 다른 4가지 패턴을
// 각각 독립된 ViewPlugin으로 등록해 모두 위젯으로 렌더링될 수 있게 한다.
export const datePlugins: Extension[] = [
  create('time', '{([^}]+)}'),
  create('date', '{([^}]+)}'),
  create('date', '\\[\\[([^\\]]+)\\]\\]'),
  create('date', '\\[([^\\]]+)\\]\\([^)]+\\)'),
];
