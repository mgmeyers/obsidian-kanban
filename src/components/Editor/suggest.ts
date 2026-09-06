/**
 * ============================================================================
 * [실행 순서 #11] src/components/Editor/suggest.ts — 카드 본문 날짜/시간 트리거 자동완성(EditorSuggest)
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 사용자가 카드 본문(마크다운 에디터) 안에서 날짜 트리거(예: `@{`)나 시간 트리거(예: `@@{`)
 * 문자를 입력하면, Obsidian의 EditorSuggest API를 구현한 DateSuggest/TimeSuggest 클래스가
 * 팝업 형태의 자동완성 UI를 띄워준다. DateSuggest는 목록 대신 flatpickr 달력 위젯을 직접
 * 렌더링하며, TimeSuggest는 일반적인 문자열 목록(00:00, 00:30 ... 형태)을 보여준다.
 * 이 두 클래스는 #1(main.ts)의 onload()에서 registerEditorSuggest()로 Obsidian에 등록되어,
 * 사용자가 볼트 내 어떤 마크다운 에디터에 포커스를 두더라도 자동으로 동작한다.
 * ============================================================================
 */
import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
  moment,
} from 'obsidian';

import KanbanPlugin from '../../main';
import { buildTimeArray } from '../Item/helpers';
import { c, escapeRegExpStr } from '../helpers';
import { applyDate, constructDatePicker, toNextMonth, toPreviousMonth } from './datepicker';
import { Instance } from './flatpickr/types/instance';

// 커서 바로 앞의 텍스트에서 "시간 트리거 문자열 + { + 아직 닫히지 않은 내용" 패턴을 찾는다.
// 예: timeTrigger가 '@@'라면 "메모 @@{09" 같은 문자열에서 매치되어, 사용자가 시간을 입력 중임을 감지한다.
// escapeRegExpStr로 트리거 문자열 안의 정규식 특수문자(예: '{')를 이스케이프해서 안전하게 정규식에 끼워 넣는다.
export function matchTimeTrigger(timeTrigger: string, editor: Editor, cursor: EditorPosition) {
  const textCtx = (editor.getLine(cursor.line) || '').slice(0, cursor.ch);
  const timeTriggerRegex = new RegExp(`(?:^|\\s)${escapeRegExpStr(timeTrigger)}{?([^}]*)$`);
  return textCtx.match(timeTriggerRegex);
}

// matchTimeTrigger와 동일한 방식으로, 날짜 트리거 문자열이 커서 앞에 입력되었는지 검사한다.
export function matchDateTrigger(dateTrigger: string, editor: Editor, cursor: EditorPosition) {
  const textCtx = (editor.getLine(cursor.line) || '').slice(0, cursor.ch);
  const dateTriggerRegex = new RegExp(`(?:^|\\s)${escapeRegExpStr(dateTrigger)}{?([^}]*)$`);
  return textCtx.match(dateTriggerRegex);
}

// 날짜 트리거에 대한 자동완성. 일반적인 EditorSuggest는 문자열 목록 중 하나를 고르는 UI지만,
// 여기서는 제네릭 타입을 빈 튜플([])로 지정해 "선택 가능한 항목이 없는" 자동완성으로 만들고,
// 대신 showSuggestions에서 flatpickr 달력을 직접 그려서 UI 전체를 커스터마이즈한다.
export class DateSuggest extends EditorSuggest<[]> {
  plugin: KanbanPlugin;
  app: App;

  // 현재 자동완성이 열려 있는 파일(this.context.file)에 대응하는 칸반 StateManager를 찾아준다.
  // context가 없으면(자동완성이 열려있지 않으면) null을 반환.
  get stateManager() {
    return this.context ? this.plugin.stateManagers.get(this.context.file) : null;
  }

  constructor(app: App, plugin: KanbanPlugin) {
    super(app);

    this.app = app;
    this.plugin = plugin;

    // EditorSuggest는 기본적으로 위/아래 화살표로 "목록의 항목"을 이동하는 키 스코프(scope)를
    // 자체적으로 등록해두는데, 여기서는 항목 목록 대신 달력을 보여주므로 그 기본 키 바인딩을
    // 전부 해제(unregister)한 뒤, 아래에서 달력 이동용 키를 새로 등록한다.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    [...(this.scope as any).keys].forEach((k: any) => this.scope.unregister(k));

    this.suggestEl.addClass(c('date-suggest'));

    // 방향키 입력에 따라 달력에서 선택된 날짜를 하루/한 주 단위로 이동시키는 헬퍼.
    // 'right'/'left'는 요일 경계(토요일/일요일)에 걸리면 다음 달/이전 달의 첫 주로 넘어가도록
    // toNextMonth/toPreviousMonth(datepicker.ts)를 사용해 달력이 자연스럽게 넘어가게 한다.
    const move = (dir: 'up' | 'right' | 'down' | 'left') => {
      const { datepicker } = this;
      if (!datepicker) return;

      const currentDate = moment(datepicker.selectedDates[0] || new Date());
      let nextDate: Date;

      if (dir === 'right') {
        if (currentDate.weekday() === 6) {
          nextDate = toNextMonth(currentDate).toDate();
        } else {
          nextDate = currentDate.add(1, 'day').toDate();
        }
      } else if (dir === 'left') {
        if (currentDate.weekday() === 0) {
          nextDate = toPreviousMonth(currentDate).toDate();
        } else {
          nextDate = currentDate.subtract(1, 'day').toDate();
        }
      } else if (dir === 'up') {
        nextDate = currentDate.subtract(1, 'week').toDate();
      } else if (dir === 'down') {
        nextDate = currentDate.add(1, 'week').toDate();
      }

      if (nextDate) {
        // 두 번째 인자 false는 flatpickr에게 "값 변경 콜백(onChange)을 호출하지 말라"는 뜻으로,
        // 단순히 달력 상의 커서 이동일 뿐 아직 날짜를 확정(Enter)한 것은 아니기 때문이다.
        datepicker.setDate(nextDate, false);
        return false;
      }
    };

    // 방향키: 달력 안에서 하루/한 주 단위로 선택 위치 이동
    this.scope.register([], 'ArrowLeft', () => move('left'));
    this.scope.register([], 'ArrowRight', () => move('right'));
    this.scope.register([], 'ArrowDown', () => move('down'));
    this.scope.register([], 'ArrowUp', () => move('up'));

    // Enter: 달력에서 선택된 날짜(없으면 오늘 날짜)를 실제 카드 본문 텍스트로 삽입(applyDate)하고 팝업을 닫는다.
    this.scope.register([], 'Enter', () => {
      const selectedDates = this.datepicker.selectedDates;
      const ctx = this.context;

      if (selectedDates.length) {
        applyDate(ctx, this.stateManager, selectedDates[0]);
      } else {
        applyDate(ctx, this.stateManager, new Date());
      }

      this.close();
      return false;
    });

    // Escape: 아무것도 삽입하지 않고 자동완성 팝업만 닫는다.
    this.scope.register([], 'Escape', () => {
      this.close();
      return false;
    });
  }

  // 실제 "목록"은 사용하지 않으므로 항상 빈 배열을 반환한다(달력 UI는 showSuggestions에서 별도로 그림).
  getSuggestions(): [] {
    return [];
  }

  suggestEl: HTMLElement;
  // 목록 항목이 없으므로 렌더링/선택 콜백은 아무 동작도 하지 않는다(Obsidian API 계약을 만족시키기 위한 빈 구현).
  renderSuggestion(): void {}
  selectSuggestion(): void {}

  // flatpickr 인스턴스를 보관. 아직 생성 전이면 null.
  datepicker: Instance = null;
  // Obsidian이 자동완성 팝업을 화면에 띄울 때 호출하는 생명주기 메서드.
  // datepicker가 아직 없고 stateManager를 알 수 있는 상태라면, suggestEl(팝업 컨테이너) 안에
  // constructDatePicker(datepicker.ts)로 flatpickr 달력을 생성해 넣는다.
  showSuggestions() {
    const { datepicker, suggestEl, context, stateManager } = this;
    if (!datepicker && stateManager) {
      suggestEl.empty();
      suggestEl.addClasses([c('date-picker'), c('ignore-click-outside')]);
      constructDatePicker(context, stateManager, suggestEl, (picker) => {
        this.datepicker = picker;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // updatePosition은 Obsidian EditorSuggest의 내부(비공개) 메서드로, 달력이 렌더링된 뒤
        // 실제 크기에 맞춰 팝업 위치를 재계산하도록 강제 호출한다(true = 강제 갱신).
        this.updatePosition(true);
      });
    }
  }

  // Obsidian이 매 키 입력마다 호출하여 "지금 자동완성을 트리거할 상황인가?"를 묻는 메서드.
  // 커서 앞 텍스트가 날짜 트리거 패턴과 일치하면 트리거 시작/끝 위치와 쿼리 문자열을 반환하고,
  // 그렇지 않으면 null을 반환해 자동완성이 뜨지 않게 한다.
  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
    const stateManager = this.plugin.getStateManager(file);
    if (!stateManager) return null;

    const dateTrigger = stateManager.getSetting('date-trigger');
    const match = matchDateTrigger(dateTrigger, editor, cursor);
    if (!match) return null;

    return {
      start: { line: cursor.line, ch: cursor.ch - dateTrigger.length },
      end: cursor,
      query: dateTrigger,
    };
  }

  // 팝업을 닫을 때 flatpickr 인스턴스도 함께 destroy해서 DOM/이벤트 리스너 누수를 막는다.
  close() {
    super.close();

    if (this.datepicker) {
      this.datepicker.destroy();
      this.datepicker = null;
      this.suggestEl.empty();
    }
  }
}

// 시간 트리거에 대한 자동완성. DateSuggest와 달리 실제 문자열 목록(예: '09:00', '09:30' ...)을
// 보여주는 표준적인 EditorSuggest<string> 사용 패턴이다.
export class TimeSuggest extends EditorSuggest<string> {
  plugin: KanbanPlugin;
  times: string[];

  constructor(app: App, plugin: KanbanPlugin) {
    super(app);
    this.app = app;
    this.plugin = plugin;
  }

  // 커서 앞 텍스트가 시간 트리거 패턴과 일치하는지 검사하고, 일치하면 buildTimeArray로
  // 설정에 맞는 시간 후보 배열(예: 30분 간격)을 미리 만들어 캐싱해둔다.
  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo {
    const stateManager = this.plugin.getStateManager(file);
    if (!stateManager) return null;

    const timeTrigger = stateManager.getSetting('time-trigger');
    const match = matchTimeTrigger(timeTrigger, editor, cursor);
    if (!match) return null;

    this.times = buildTimeArray(stateManager);

    return {
      start: {
        line: cursor.line,
        ch: cursor.ch - match[1].length - timeTrigger.length,
      },
      end: cursor,
      query: match[1],
    };
  }

  // 사용자가 트리거 이후 입력한 부분 문자열(query)로 후보 시간 목록을 필터링한다.
  // '0' + query로도 비교하는 이유는, 예를 들어 사용자가 "9"만 입력했을 때 "09:00"도
  // 매치되도록 하기 위함(한 자리 시(hour) 입력 보정).
  getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
    const stateManager = this.plugin.getStateManager(context.file);
    if (!stateManager) return [];

    return this.times.filter((t) => {
      return t.startsWith(context.query) || t.startsWith('0' + context.query);
    });
  }

  // 정시(예: '09:00')는 강조(<strong>)해서 보여주고, 그 외(예: '09:30')는 일반 텍스트로 표시한다.
  renderSuggestion(value: string, el: HTMLElement): void {
    if (value.endsWith('00')) {
      el.createEl('strong', { text: value });
    } else {
      el.setText(value);
    }
  }

  // 사용자가 목록에서 시간을 선택(클릭 또는 Enter)했을 때 호출된다.
  // 트리거 구문을 "trigger{선택한시간} " 형태의 실제 텍스트로 치환하고, 커서를 그 뒤로 옮긴 뒤
  // 에디터에 포커스를 되돌려준다.
  selectSuggestion(value: string): void {
    const { context, plugin } = this;
    const stateManager = plugin.getStateManager(context.file);
    if (!stateManager) return;

    const timeTrigger = stateManager.getSetting('time-trigger');
    const replacement = `${timeTrigger}{${value}} `;

    context.editor.replaceRange(replacement, context.start, context.end);
    context.editor.setCursor({
      line: context.start.line,
      ch: context.start.ch + replacement.length,
    });
    context.editor.focus();
  }

  // 팝업이 닫힐 때 캐싱해둔 시간 후보 배열을 비워 다음 트리거 때 새로 계산되게 한다.
  close(): void {
    super.close();
    this.times = null;
  }
}
