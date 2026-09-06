/**
 * ============================================================================
 * [실행 순서 #86] src/components/Editor/datepicker.ts — flatpickr 달력을 CodeMirror 에디터에 연동
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * #11(suggest.ts)의 DateSuggest가 화면에 달력 팝업을 띄울 때 사용하는 실제 구현부다.
 * 벤더링된 flatpickr 라이브러리(./flatpickr, 이번 작업 대상 아님)를 인라인(inline: true)
 * 모드로 특정 <input> 엘리먼트에 붙여 항상 펼쳐진 달력 형태로 렌더링하고, 사용자가 날짜를
 * 고르면(onChange) applyDate로 실제 카드 본문 텍스트에 트리거 구문을 삽입한다.
 * toPreviousMonth/toNextMonth는 moment 객체를 이용해 "현재 주와 같은 주차(week index)"를
 * 유지한 채 이전/다음 달의 같은 위치로 이동시키는 순수 날짜 계산 헬퍼로, #11의 DateSuggest가
 * 방향키 네비게이션(화살표 좌/우로 달을 넘어갈 때)에 사용한다.
 * ============================================================================
 */
import { EditorSuggestContext, moment } from 'obsidian';
import { StateManager } from 'src/StateManager';
import { buildLinkToDailyNote } from 'src/helpers';

import { getDefaultLocale } from './datePickerLocale';
import flatpickr from './flatpickr';
import { Instance } from './flatpickr/types/instance';

// 사용자가 달력(또는 자동완성)에서 날짜를 확정했을 때 실제로 에디터 텍스트를 바꾸는 함수.
// EditorSuggestContext(ctx)는 Obsidian EditorSuggest가 트리거된 시점의 에디터/범위 정보를
// 담고 있으며, ctx.start~ctx.end 구간을 최종 날짜 텍스트로 치환한다.
export function applyDate(ctx: EditorSuggestContext, stateManager: StateManager, date: Date) {
  const dateFormat = stateManager.getSetting('date-format');
  const dateTrigger = stateManager.getSetting('date-trigger');
  const shouldLinkDates = stateManager.getSetting('link-date-to-daily-note');

  const formattedDate = moment(date).format(dateFormat);
  // 설정에서 "날짜를 데일리 노트로 링크"를 켰다면 위키링크 형태로, 아니면 단순히
  // 트리거 중괄호 구문(`{2024-01-01}`)으로 감싼 텍스트를 만든다.
  const wrappedDate = shouldLinkDates
    ? buildLinkToDailyNote(stateManager.app, formattedDate)
    : `{${formattedDate}} `;

  // ctx.start는 트리거 문자(예: '@')가 시작된 위치이므로, 트리거 문자열 길이만큼 뒤로
  // 이동시켜 "트리거 다음, 실제 날짜가 들어갈 위치"부터 교체 대상 범위로 삼는다.
  const start = { line: ctx.start.line, ch: ctx.start.ch + dateTrigger.length };

  ctx.editor.replaceRange(wrappedDate, start, ctx.end);
  // 삽입한 텍스트 바로 뒤로 커서를 옮겨서 이어서 타이핑할 수 있게 한다.
  ctx.editor.setCursor({
    line: start.line,
    ch: start.ch + wrappedDate.length,
  });
  ctx.editor.focus();
}

// 자동완성 팝업 안에 실제 flatpickr 달력 인스턴스를 생성해 넣는 함수.
// div(suggestEl)는 #11(suggest.ts)의 DateSuggest.showSuggestions가 넘겨주는 팝업 컨테이너다.
export function constructDatePicker(
  ctx: EditorSuggestContext,
  stateManager: StateManager,
  div: HTMLElement,
  cb: (picker: Instance) => void
) {
  // flatpickr는 <input> 엘리먼트에 부착되는 라이브러리이므로, 먼저 숨겨질(보통 CSS로 가려지는)
  // 텍스트 입력을 하나 만든다.
  div.createEl('input', { type: 'text' }, (input) => {
    // setTimeout(0): input이 실제로 DOM에 삽입된 다음 틱에 flatpickr를 초기화해야
    // 라이브러리가 엘리먼트 크기/위치를 올바르게 계산할 수 있기 때문에 한 틱 지연시킨다.
    div.win.setTimeout(() =>
      cb(
        flatpickr(input, {
          win: input.win,
          now: new Date(),
          // inline: true — 클릭해야 열리는 팝업이 아니라, 처음부터 펼쳐진 상태의 달력으로 렌더링.
          inline: true,
          // 사용자의 Obsidian 로케일(moment.locale())에 맞는 요일/월 이름 등을 datePickerLocale.ts에서 가져온다.
          locale: getDefaultLocale(stateManager),
          // 달력에서 날짜를 클릭해 선택할 때마다 호출되어, 곧바로 applyDate로 에디터 텍스트를 갱신한다.
          onChange: (dates) => applyDate(ctx, stateManager, dates[0]),
        })
      )
    );
  });
}

// 주어진 moment 날짜와 "같은 주차(월요일이 속한 주가 그 달의 몇 번째 줄인지)"를 유지한 채
// 이전 달의 대응 주로 이동시킨다. 달력 그리드에서 화살표로 좌/위 이동 시 달의 경계를 넘을 때,
// 시각적으로 같은 행(週)에 있던 위치를 유지하려는 목적의 계산이다.
export function toPreviousMonth(date: moment.Moment) {
  const initialMonth = date.month();
  // 이번 달 1일이 속한 주의 "일요일(weekday(0))"을 기준점(first)으로 잡는다.
  const first = date.clone().startOf('month').weekday(0);
  // 기준점으로부터 현재 날짜까지 몇 주 차이가 나는지(diff) 구해둔다 — 이것이 "몇 번째 주"인지를 나타낸다.
  const diff = date.diff(first, 'week');

  // 한 달 전으로 이동한 뒤, 그 달의 1일이 속한 주의 토요일(weekday(6))부터 시작해서
  // 같은 주차만큼(diff) 더해 대략적인 대응 위치로 이동시킨다.
  date.subtract(1, 'month').startOf('month').weekday(6).add(diff, 'week');

  let nextMonth = date.month();

  // 위 계산이 근사치이기 때문에, 실제로 달이 바뀌기 전(=아직 원래 달에 머물러 있는 경우)까지
  // 한 주씩 앞으로 당기며 보정한다. 이렇게 해야 "정확히 이전 달"의 날짜에 안착한다.
  while (initialMonth === nextMonth) {
    date.subtract(1, 'week');
    nextMonth = date.month();
  }

  return date;
}

// toPreviousMonth와 대칭되는 로직으로, 다음 달의 대응하는 주차 위치로 이동시킨다.
export function toNextMonth(date: moment.Moment) {
  const initialMonth = date.month();
  const first = date.clone().startOf('month').weekday(6);
  const diff = date.diff(first, 'week');

  date.add(1, 'month').startOf('month').weekday(0).add(diff, 'week');

  let nextMonth = date.month();

  // 아직 다음 달로 넘어가지 못했다면(=여전히 원래 달) 한 주씩 뒤로 밀며 보정한다.
  while (initialMonth === nextMonth) {
    date.add(1, 'week');
    nextMonth = date.month();
  }

  return date;
}
