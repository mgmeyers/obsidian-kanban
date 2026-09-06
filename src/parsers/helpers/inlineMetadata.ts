/**
 * ============================================================================
 * [실행 순서 #55] src/parsers/helpers/inlineMetadata.ts — 카드 본문 인라인 메타데이터 파싱 및 태스크 완료 토글 처리
 * ----------------------------------------------------------------------------
 * 단계: 실행-파싱
 * 이 파일은 칸반 카드(Item)의 제목 텍스트 안에 들어있는 "인라인 필드"
 * ([key:: value] 또는 (key:: value) 형태, Dataview 플러그인 문법)와, Tasks 플러그인이
 * 사용하는 이모지 단축 표기(📅 마감일, ✅ 완료일, 🔁 반복 등)를 정규식으로 찾아내는
 * 파서를 제공합니다. 또한 Obsidian Tasks 커뮤니티 플러그인이 설치되어 있을 때 그
 * 플러그인과 연동하여 체크박스의 "완료" 문자와 "완료 직전" 문자를 판별하고
 * (getTaskStatusDone / getTaskStatusPreDone), 체크박스를 토글할 때 반복 태스크 생성 등
 * Tasks 플러그인 고유의 로직을 그대로 위임해서 처리하는 toggleTask / toggleTaskString
 * 함수를 제공합니다. #16(DragDropApp.tsx)에서 드래그로 레인을 이동하며 완료 처리를 할
 * 때, #59 계열의 helpers/boardModifiers.ts, components/helpers.ts,
 * components/Item/ItemCheckbox.tsx 등 카드 완료 토글이 필요한 모든 곳에서 이 파일의
 * 함수들이 널리 호출됩니다.
 * ============================================================================
 */
/*
This code is modified from https://github.com/blacksmithgu/obsidian-dataview
and https://github.com/obsidian-tasks-group/obsidian-tasks

Dataview is licensed as such:
MIT License

Copyright (c) 2021 Michael Brenan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Tasks is licensed as such:
MIT License

Copyright (c) 2021 Martin Schenck and Clare Macrae

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// TFile: 토글 대상 태스크가 들어있는 실제 볼트 파일(Tasks 플러그인 API 호출 시 파일 경로가 필요함)
import { TFile } from 'obsidian';
// RRule: 반복 규칙(RFC 5545 RRULE) 문자열을 파싱/생성하는 라이브러리. 🔁 반복 필드 정규화에 사용.
import { RRule } from 'rrule';
import { Item } from 'src/components/types';
import { t } from 'src/lang/helpers';

// Tasks 플러그인이 사용하는 우선순위 등급. 문자열 '0'(가장 높음) ~ '5'(가장 낮음) 코드로 표현되며,
// 실제 마크다운에는 이 값 대신 아래 prioritySymbols의 이모지로 직렬화된다.
export enum Priority {
  Highest = '0',
  High = '1',
  Medium = '2',
  None = '3',
  Low = '4',
  Lowest = '5',
}

// 인라인 메타데이터 각 항목(우선순위/날짜/반복/ID 등)을 마크다운에 표시할 때 사용하는
// 기본 이모지 기호 테이블. Tasks 플러그인이 사용하는 이모지 단축 표기와 동일한 규약을 따른다.
export const DEFAULT_SYMBOLS = {
  prioritySymbols: {
    Highest: '🔺', // 최우선
    High: '⏫', // 높음
    Medium: '🔼', // 보통
    Low: '🔽', // 낮음
    Lowest: '⏬', // 최하
    None: '', // 우선순위 없음 → 아이콘 없음
  },
  startDateSymbol: '🛫', // 시작일
  createdDateSymbol: '➕', // 생성일
  scheduledDateSymbol: '⏳', // 예정일
  dueDateSymbol: '📅', // 마감일
  doneDateSymbol: '✅', // 완료일
  cancelledDateSymbol: '❌', // 취소일
  recurrenceSymbol: '🔁', // 반복 규칙
  dependsOnSymbol: '⛔', // 선행 태스크(의존) ID
  idSymbol: '🆔', // 태스크 고유 ID
} as const;

// 필드 이름(label, 예: 'priority', 'due')을 화면/마크다운에 표시할 아이콘 문자로 변환한다.
// 'priority'는 값(우선순위 등급)에 따라 아이콘이 달라지므로 별도 함수(priorityToIcon)에 위임하고,
// 나머지는 필드 이름에 1:1로 고정된 이모지를 반환한다. 알 수 없는 label은 그대로 되돌려준다.
export function lableToIcon(label: string, value: any) {
  switch (label) {
    case 'priority':
      return priorityToIcon(value);
    case 'start':
      return DEFAULT_SYMBOLS.startDateSymbol;
    case 'created':
      return DEFAULT_SYMBOLS.createdDateSymbol;
    case 'scheduled':
      return DEFAULT_SYMBOLS.scheduledDateSymbol;
    case 'due':
      return DEFAULT_SYMBOLS.dueDateSymbol;
    case 'completion':
      return DEFAULT_SYMBOLS.doneDateSymbol;
    case 'cancelled':
      return DEFAULT_SYMBOLS.cancelledDateSymbol;
    case 'repeat':
      return DEFAULT_SYMBOLS.recurrenceSymbol;
    case 'dependsOn':
      return DEFAULT_SYMBOLS.dependsOnSymbol;
    case 'id':
      return DEFAULT_SYMBOLS.idSymbol;
  }

  return label;
}

// 필드 이름(label)을 사용자에게 보여줄 다국어(i18n) 표시 이름으로 변환한다. t()는 lang/helpers의
// 번역 함수. lableToIcon과 짝을 이루어 UI(예: 카드 메타데이터 편집 팝업)에서 함께 쓰인다.
export function lableToName(label: string) {
  switch (label) {
    case 'priority':
      return t('Priority');
    case 'start':
      return t('Start');
    case 'created':
      return t('Created');
    case 'scheduled':
      return t('Scheduled');
    case 'due':
      return t('Due');
    case 'completion':
      return t('Done');
    case 'cancelled':
      return t('Cancelled');
    case 'repeat':
      return t('Recurrence');
    case 'dependsOn':
      return t('Depends on');
    case 'id':
      return t('ID');
  }

  return label;
}

// Priority 열거값('0'~'5')을 화면에 표시할 이모지 아이콘으로 변환한다.
// Priority.None(우선순위 없음)에 대응하는 case가 없으므로 이 경우 switch를 통과해 null을 반환한다.
export function priorityToIcon(p: Priority) {
  switch (p) {
    case Priority.Highest:
      return DEFAULT_SYMBOLS.prioritySymbols.Highest;
    case Priority.High:
      return DEFAULT_SYMBOLS.prioritySymbols.High;
    case Priority.Medium:
      return DEFAULT_SYMBOLS.prioritySymbols.Medium;
    case Priority.Low:
      return DEFAULT_SYMBOLS.prioritySymbols.Low;
    case Priority.Lowest:
      return DEFAULT_SYMBOLS.prioritySymbols.Lowest;
  }
  return null;
}

// priorityToIcon의 역방향 변환: 마크다운에서 읽은 이모지 아이콘 문자열을 다시 Priority 열거값으로
// 되돌린다. 마크다운 파싱(읽기) 시 사용되고, priorityToIcon은 마크다운 직렬화(쓰기) 시 사용된다.
export function iconToPriority(icon: string) {
  switch (icon) {
    case DEFAULT_SYMBOLS.prioritySymbols.Highest:
      return Priority.Highest;
    case DEFAULT_SYMBOLS.prioritySymbols.High:
      return Priority.High;
    case DEFAULT_SYMBOLS.prioritySymbols.Medium:
      return Priority.Medium;
    case DEFAULT_SYMBOLS.prioritySymbols.Low:
      return Priority.Low;
    case DEFAULT_SYMBOLS.prioritySymbols.Lowest:
      return Priority.Lowest;
  }
  return null;
}

// 현재 볼트에 커뮤니티 플러그인 "obsidian-tasks-plugin"이 설치·활성화되어 있는지 확인하고,
// 있다면 해당 플러그인 인스턴스를 반환한다. 없으면 null을 반환하여 호출자가 자체 처리(폴백)를
// 하도록 유도한다. `app`은 Obsidian이 전역으로 노출하는 App 객체(타입 체크 우회를 위해 any 캐스팅).
export function getTasksPlugin() {
  if (!(app as any).plugins.enabledPlugins.has('obsidian-tasks-plugin')) {
    return null;
  }

  return (app as any).plugins.plugins['obsidian-tasks-plugin'];
}

// Tasks 플러그인은 설정 객체를 공식 API로 노출하지 않으므로, 에디터 확장(EditorSuggest) 목록을
// 뒤져서 `settings.taskFormat` 속성을 가진 항목(=Tasks 플러그인이 등록한 서제스트)을 찾아
// 그 설정 객체를 얻어내는 우회(reflection) 방식을 사용한다. 못 찾으면 undefined.
function getTasksPluginSettings() {
  return (app as any).workspace.editorSuggest.suggests.find(
    (s: any) => s.settings && s.settings.taskFormat
  )?.settings;
}

// 체크박스가 "완료" 상태임을 나타내는 문자(예: 'x')를 반환한다.
// Tasks 플러그인 설정에 커스텀 완료 문자가 정의되어 있으면 그것을, 없거나 플러그인이
// 없으면 기본값 'x'를 반환한다.
export function getTaskStatusDone(): string {
  // 1) Tasks 플러그인 설정에서 상태(statusSettings) 정보를 꺼낸다.
  const settings = getTasksPluginSettings();
  const statuses = settings?.statusSettings;
  // 설정 자체가 없으면(플러그인 미설치 등) 기본 완료 문자 'x'로 폴백.
  if (!statuses) return 'x';

  // 2) 내장 상태 목록(coreStatuses)에서 type이 'DONE'인 항목을 우선 찾는다.
  let done = statuses.coreStatuses?.find((s: any) => s.type === 'DONE');
  // 3) 내장 목록에 없으면 사용자 정의 상태 목록(customStatuses)에서 동일하게 찾는다.
  if (!done) done = statuses.customStatuses?.find((s: any) => s.type === 'DONE');
  // 4) 그래도 못 찾으면 'x'로 폴백.
  if (!done) return 'x';

  // 5) 찾은 상태 항목의 실제 체크박스 문자(symbol, 예: 'x')를 반환.
  return done.symbol;
}

// 체크박스가 "완료 직전(다음 클릭 시 완료로 전이되는)" 상태를 나타내는 문자를 반환한다.
// 예: 커스텀 워크플로에서 ' '(미완료) → '/'(진행중) → 'x'(완료) 처럼 여러 단계가 있을 때,
// getTaskStatusDone()의 심볼로 "다음 상태(nextStatusSymbol)"가 이어지는 상태를 역으로 찾는다.
export function getTaskStatusPreDone(): string {
  const settings = getTasksPluginSettings();
  const statuses = settings?.statusSettings;
  // 설정이 없으면 기본 미완료 문자 ' '(공백)로 폴백.
  if (!statuses) return ' ';

  // 먼저 "완료" 문자가 무엇인지 알아낸다.
  const done = getTaskStatusDone();

  // coreStatuses 중에서, 이 상태 다음(next)이 "완료" 문자로 이어지는 상태를 찾는다.
  let preDone = statuses.coreStatuses?.find((s: any) => s.nextStatusSymbol === done);
  // 없으면 customStatuses에서도 동일하게 찾는다.
  if (!preDone) preDone = statuses.customStatuses?.find((s: any) => s.nextStatusSymbol === done);
  // 그래도 없으면 기본 미완료 문자 ' '로 폴백.
  if (!preDone) return ' ';

  return preDone.symbol;
}

// 마크다운 한 줄(문자열) 형태의 태스크를 그대로 Tasks 플러그인의 "완료 토글" 커맨드에 위임한다.
// Tasks 플러그인이 없으면 null을 반환해 호출자가 폴백 로직을 쓰도록 한다.
// (참고: 이 함수는 Item 객체가 아니라 원시 마크다운 줄 문자열을 다루는 경량 버전이다.)
export function toggleTaskString(item: string, file: TFile): string | null {
  const plugin = getTasksPlugin();
  if (!plugin) return null;
  return plugin.apiV1?.executeToggleTaskDoneCommand?.(item, file.path) ?? null;
}

// 카드(Item)의 체크박스를 토글할 때 호출되는 핵심 함수.
// Tasks 플러그인이 있으면, 반복 태스크(recurring task) 완료 처리 같은 복잡한 로직을 플러그인에
// 통째로 위임하고, 그 결과(하나 이상의 마크다운 줄)를 파싱해 [새 아이템 문자열들, 각 줄의 체크
// 문자들, "원래 이 아이템"에 해당하는 줄의 인덱스] 튜플로 돌려준다.
// 반환값이 null이면(Tasks 플러그인 없음/토글 실패) 호출자는 자체적으로 간단히 체크 문자만
// 뒤집는 폴백 로직을 수행한다(예: components/Item/ItemCheckbox.tsx 참고).
export function toggleTask(item: Item, file: TFile): [string[], string[], number] | null {
  const plugin = getTasksPlugin();
  if (!plugin) {
    // Tasks 플러그인이 없으면 이 함수가 처리할 수 없으므로 null 반환(호출자가 폴백 처리).
    return null;
  }

  // 아이템의 현재 체크 문자를 이용해 "- [x] " 형태의 마크다운 체크박스 접두어를 재구성한다.
  const prefix = `- [${item.data.checkChar}] `;
  // 아이템의 원본 제목(titleRaw)은 여러 줄(멀티라인)일 수 있으므로 줄 단위로 쪼갠다.
  // 예: 하위 텍스트/서브 불릿이 있는 카드의 경우 originalLines[0]은 첫 줄, 나머지는 부가 내용.
  const originalLines = item.data.titleRaw.split(/\n\r?/g);

  // Tasks 플러그인 설정에서 "반복 작업 생성 시 새 줄을 다음 줄에 놓을지" 여부를 읽어온다.
  // 이 설정에 따라 Tasks 플러그인이 반환하는 여러 줄 중 어느 줄이 "완료된 원본"이고
  // 어느 줄이 "새로 생성된 다음 반복 태스크"인지가 달라진다.
  const taskSettings = getTasksPluginSettings();
  const recurrenceOnNextLine = !!taskSettings?.recurrenceOnNextLine;

  // which: 결과로 나온 여러 줄 중, "지금 토글한 바로 이 아이템"에 해당하는 줄의 인덱스.
  // 호출자는 이 인덱스의 결과만 기존 아이템 id를 유지해 덮어쓰고, 나머지 인덱스는 완전히
  // 새로운 아이템(예: 새로 생성된 반복 태스크)으로 만들어 카드 목록에 추가한다.
  let which = 0;

  // 실제 토글은 첫 번째 줄(prefix + originalLines[0])만 Tasks 플러그인에 넘겨 수행한다.
  // Tasks 플러그인은 완료 처리(완료일 기록, 반복 규칙에 따른 다음 태스크 생성 등)를 계산해
  // 결과를 문자열로 돌려주는데, 반복 태스크인 경우 결과에 줄바꿈(\n)으로 구분된 두 줄
  // (완료된 원본 + 새로 생성된 다음 회차)이 포함될 수 있다.
  const result = plugin.apiV1?.executeToggleTaskDoneCommand?.(prefix + originalLines[0], file.path);
  // 토글 커맨드 실행에 실패했다면(예: API 시그니처 변경 등) null을 반환해 폴백을 유도한다.
  if (!result) return null;

  // 결과의 각 줄에서 추출한 체크박스 문자(예: 'x', ' ')를 순서대로 모아둔다.
  const checkChars: string[] = [];
  const resultLines = result.split(/\n/g).map((line: string, index: number) => {
    // ── "which"(원래 이 아이템에 해당하는 줄) 결정 로직 ──────────────────────────
    // recurrenceOnNextLine이 true면: 새 반복 태스크가 "다음 줄"(index 1 이상)에 오므로,
    //   원래 아이템(완료 처리된 원본)은 첫 줄(index === 0)이다 → which = 0.
    if (recurrenceOnNextLine && index === 0) {
      which = index;
      // recurrenceOnNextLine이 false면: 새 반복 태스크가 앞쪽(index 0)에 오고, 완료된
      //   원본은 뒤따르는 줄(index > 0)에 위치한다 → which = 그 줄의 인덱스.
    } else if (!recurrenceOnNextLine && index > 0) {
      which = index;
    }
    // ────────────────────────────────────────────────────────────────────────

    // 이 줄의 맨 앞 체크박스 문법 "- [X]"에서 체크 문자(X)를 정규식으로 추출해 저장.
    const match = line.match(/^- \[([^\]]+)\]/);
    if (match?.[1]) checkChars.push(match[1]);

    // 이 줄에서 "- [X] " 체크박스 접두어를 제거한 본문만 남기고, 원본 아이템의 2번째 줄부터
    // 이어지던 부가 내용(originalLines.slice(1))을 그대로 뒤에 붙여 완전한 새 제목 문자열을
    // 만든다. 즉, 여러 결과 줄 각각이 "체크박스 줄 하나 + 기존 부가 본문"으로 재구성된다.
    return [line.replace(/^- \[[^\]]+\] */, ''), ...originalLines.slice(1)].join('\n');
  });

  // [각 결과 줄의 완전한 제목 문자열 배열, 각 줄의 체크 문자 배열, 원래 이 아이템의 줄 인덱스]
  return [resultLines, checkChars, which];
}

/** A parsed inline field. */
export interface InlineField {
  /** The raw parsed key. */
  key: string;
  /** The raw value of the field. */
  value: string;
  /** The start column of the field. */
  start: number;
  /** The start column of the *value* for the field. */
  startValue: number;
  /** The end column of the field. */
  end: number;
  /** If this inline field was defined via a wrapping ('[' or '('), then the wrapping that was used. */
  wrapping?: string;
}

// 인라인 필드를 감싸는 괄호 종류: 대괄호 '[...]' 또는 소괄호 '(...)'.
// Dataview 플러그인의 인라인 필드 문법([key:: value], (key:: value))을 그대로 따른다.
export const INLINE_FIELD_WRAPPERS: Readonly<Record<string, string>> = Object.freeze({
  '[': ']',
  '(': ')',
});

/** Find the '::' separator in an inline field. */
// 주어진 위치(start) 이후에서 "::" 구분자를 찾아, 그 앞부분을 key로, "::" 바로 뒤의
// 인덱스를 값(value)이 시작하는 위치(valueIndex)로 반환한다. "::"가 없으면 undefined
// (이 위치는 인라인 필드가 아니라는 뜻이므로 파싱을 포기한다).
function findSeparator(
  line: string,
  start: number
): { key: string; valueIndex: number } | undefined {
  const sep = line.indexOf('::', start);
  if (sep < 0) return undefined;

  // key 부분의 앞뒤 공백은 trim으로 제거한다. 예: "[ due :: 2024-01-01]" → key = "due".
  return { key: line.substring(start, sep).trim(), valueIndex: sep + 2 };
}

/**
 * Find a matching closing bracket that occurs at or after `start`, respecting nesting and escapes. If found,
 * returns the value contained within and the string index after the end of the value.
 */
// 값(value) 문자열 안에 괄호가 중첩되어 있거나(예: 값 자체가 "(2024-01-01)"을 포함) 이스케이프된
// 괄호(\] 등)가 있는 경우까지 올바르게 처리하면서, 여는 괄호(open)와 짝이 맞는 닫는 괄호(close)의
// 위치를 찾는다. 한 글자씩 순회하며 상태를 갱신하는 작은 상태 기계(state machine)로 구현되어 있다.
function findClosing(
  line: string,
  start: number,
  open: string,
  close: string
): { value: string; endIndex: number } | undefined {
  // nesting: 현재까지 만난 "열림"과 "닫힘"의 차이(중첩 깊이). 0보다 작아지는 순간이
  //          "우리가 찾던, 짝이 맞는 바깥쪽 닫는 괄호"를 만난 시점이다.
  let nesting = 0;
  // escaped: 바로 이전 문자가 백슬래시(\)였는지 여부. true인 동안 다음 한 글자는
  //          괄호 카운팅에서 제외(이스케이프 처리)된다.
  let escaped = false;
  for (let index = start; index < line.length; index++) {
    const char = line.charAt(index);

    // Allows for double escapes like '\\' to be rendered normally.
    // 백슬래시를 만나면 이스케이프 상태를 토글한다. 이렇게 하면 "\\"(이스케이프된 백슬래시
    // 자기 자신)는 두 번째 백슬래시에서 escaped가 다시 꺼지므로 정상적으로 처리된다.
    if (char == '\\') {
      escaped = !escaped;
      continue;
    }

    // If escaped, ignore the next character for computing nesting, regardless of what it is.
    // 직전 문자가 백슬래시였다면(escaped === true), 지금 문자는 무엇이든 괄호 카운팅에서
    // 제외하고 이스케이프 상태를 해제한 뒤 다음 문자로 넘어간다.
    if (escaped) {
      escaped = false;
      continue;
    }

    // 이스케이프되지 않은 순수한 여는/닫는 괄호만 중첩 깊이 계산에 반영한다.
    if (char == open) nesting++;
    else if (char == close) nesting--;

    // Only occurs if we are on a close character and trhere is no more nesting.
    // nesting이 음수가 되었다는 것은, 우리가 찾던 "가장 바깥쪽 여는 괄호"와 짝이 맞는
    // 닫는 괄호를 지금 만났다는 뜻이다. 이 시점에서 값(start~index 사이)을 잘라 반환한다.
    if (nesting < 0) return { value: line.substring(start, index).trim(), endIndex: index + 1 };

    // (참고) 위 두 if에서 이미 처리되지 않은 일반 문자는 항상 escaped를 false로 리셋해 둔다.
    escaped = false;
  }

  // 문자열 끝까지 짝이 맞는 닫는 괄호를 찾지 못함 → 이 인라인 필드는 닫히지 않은 것이므로 실패.
  return undefined;
}

/** Try to completely parse an inline field starting at the given position. Assuems `start` is on a wrapping character. */
// line[start] 위치가 이미 '[' 또는 '(' 같은 여는 괄호라고 가정하고, 그 지점부터
// "[key:: value]" 형태의 인라인 필드 전체를 완전히 파싱해본다. 아래 3단계로 진행되며,
// 어느 단계든 실패하면 undefined를 반환해 "여기는 인라인 필드가 아니다"라고 알린다.
function findSpecificInlineField(line: string, start: number): InlineField | undefined {
  const open = line.charAt(start);

  // 1단계: 여는 괄호 바로 다음 위치부터 "::" 구분자를 찾아 key를 얻는다.
  const key = findSeparator(line, start + 1);
  if (key === undefined) return undefined;

  // Fail the match if we find any separator characters (not allowed in keys).
  // 2단계: key 안에 괄호류 문자('[', ']', '(', ')')가 섞여 있으면 올바른 key가 아니므로
  // (예: 중첩된 다른 필드의 일부를 잘못 잘라낸 경우) 매칭을 실패 처리한다.
  for (const sep of Object.keys(INLINE_FIELD_WRAPPERS).concat(
    Object.values(INLINE_FIELD_WRAPPERS)
  )) {
    if (key.key.includes(sep)) return undefined;
  }

  // 3단계: "::" 뒤부터 시작해서, open과 짝이 맞는 닫는 괄호를 찾아 값(value)을 추출한다.
  const value = findClosing(line, key.valueIndex, open, INLINE_FIELD_WRAPPERS[open]);
  if (value === undefined) return undefined;

  // 세 단계가 모두 성공하면, key/value/각 위치 정보를 담은 InlineField 객체를 완성해 반환.
  return {
    key: key.key,
    value: value.value,
    start: start,
    startValue: key.valueIndex,
    end: value.endIndex,
    wrapping: open,
  };
}

// 아래는 Tasks 플러그인 스타일의 "이모지 단축 표기" 필드를 인식하기 위한 정규식들이다.
// 각 정규식은 "이모지(+선택적 변형 선택자 \uFE0F) + 공백 + 실제 값"의 형태를 매칭한다.
const priorityRegex = /([🔺⏫🔼🔽⏬])\uFE0F?/u; // 우선순위 이모지 하나
const startDateRegex = /🛫 *(\d{4}-\d{2}-\d{2})/u; // 시작일(YYYY-MM-DD)
const createdDateRegex = /➕ *(\d{4}-\d{2}-\d{2})/u; // 생성일
const scheduledDateRegex = /[⏳⌛] *(\d{4}-\d{2}-\d{2})/u; // 예정일(모래시계 두 종류 모두 허용)
const dueDateRegex = /[📅📆🗓] *(\d{4}-\d{2}-\d{2})/u; // 마감일(달력 이모지 세 종류 모두 허용)
const doneDateRegex = /✅ *(\d{4}-\d{2}-\d{2})/u; // 완료일
const cancelledDateRegex = /❌ *(\d{4}-\d{2}-\d{2})/u; // 취소일
const dependsOnRegex = /⛔\uFE0F? *([a-zA-Z0-9-_]+)/u; // 의존(선행 태스크) ID
const idRegex = /🆔 *([a-zA-Z0-9-_]+)/u; // 태스크 고유 ID
const recurrenceRegex = /🔁 *([a-zA-Z0-9; !]+)/u; // 반복 규칙 문구(예: "every week")

// Tasks 플러그인 문법에서 "태스크 전용" 필드로 취급되는 키 이름 집합.
// 일반 Dataview 인라인 필드와 구분해, 예를 들어 첫 줄에서만 인식하거나 별도 이동 옵션을
// 적용하는 등 특별 취급이 필요한 필드들을 표시하는 데 쓰인다(listItemToItemData 등에서 참조).
export const taskFields = new Set([
  'priority',
  'start',
  'created',
  'scheduled',
  'due',
  'completion',
  'cancelled',
  'id',
  'dependsOn',
  'repeat',
]);

// 위에서 선언한 각 정규식과, 그 정규식이 나타내는 필드 키 이름을 짝지어 놓은 테이블.
// extractSpecialTaskFields가 이 배열을 순회하며 한 줄 안에서 각 이모지 필드를 찾는다.
export const EMOJI_REGEXES = [
  { regex: priorityRegex, key: 'priority' },
  { regex: startDateRegex, key: 'start' },
  { regex: createdDateRegex, key: 'created' },
  { regex: scheduledDateRegex, key: 'scheduled' },
  { regex: dueDateRegex, key: 'due' },
  { regex: doneDateRegex, key: 'completion' },
  { regex: cancelledDateRegex, key: 'cancelled' },
  { regex: idRegex, key: 'id' },
  { regex: dependsOnRegex, key: 'dependsOn' },
  { regex: recurrenceRegex, key: 'repeat' },
];

/** Parse special completed/due/done task fields which are marked via emoji. */
// 한 줄의 텍스트에서 Tasks 플러그인 스타일 이모지 단축 필드를 모두 찾아 InlineField 배열로
// 변환한다. EMOJI_REGEXES 테이블을 순서대로 돌면서 각 정규식이 매치되는지 확인한다.
function extractSpecialTaskFields(line: string): InlineField[] {
  const results: InlineField[] = [];

  for (const { regex, key } of EMOJI_REGEXES) {
    const match = regex.exec(line);
    // 이 줄에 해당 이모지가 없으면 건너뛴다.
    if (!match) continue;

    let value = match[1];
    let end = match.index + match[0].length;

    // 필드 종류에 따라 원시 매치 값을 후처리한다.
    // - priority: 이모지 문자를 Priority 열거값('0'~'5')으로 변환.
    // - repeat: 🔁 뒤의 자유 텍스트(예: "every week")를 RRule로 파싱한 뒤 다시 표준화된
    //   문구로 되돌린다(RRule.fromText(...).toText()). 표준화 과정에서 문자열 길이가
    //   달라질 수 있으므로, 원래 길이(originalLen)와의 차이만큼 end 위치를 보정해 준다.
    if (key === 'priority') value = iconToPriority(value);
    else if (key === 'repeat') {
      const originalLen = value.length;
      value = RRule.fromText(value).toText();
      end -= originalLen - value.length;
    }

    results.push({
      key,
      value,
      start: match.index,
      // 이모지 자체는 1글자로 취급하고, 그 바로 다음 위치를 값의 시작 위치로 근사한다.
      startValue: match.index + 1,
      end,
      // wrapping을 'emoji-shorthand'로 표시해, 대괄호/소괄호로 감싼 일반 인라인 필드와
      // 구분할 수 있게 한다(직렬화 시 다시 이모지 형태로 되돌리기 위한 표식).
      wrapping: 'emoji-shorthand',
    });
  }

  return results;
}

// 한 줄의 텍스트에서 모든 종류의 인라인 필드(대괄호/소괄호로 감싼 Dataview 스타일 필드,
// 그리고 옵션에 따라 이모지 단축 필드까지)를 찾아 InlineField 배열로 반환하는 최상위 함수.
// includeTaskFields가 true일 때만 이모지 단축 필드(Tasks 플러그인 스타일)까지 함께 찾는다.
export function extractInlineFields(
  line: string,
  includeTaskFields: boolean = false
): InlineField[] | null {
  const dv = getDataviewPlugin();
  const tasks = getTasksPlugin();

  let fields: InlineField[] = [];
  if (dv) {
    // Dataview 플러그인이 활성화된 경우에만 [..] / (..) 형태의 인라인 필드를 파싱한다.
    // ('[', '(') 각 래퍼 문자에 대해:
    for (const wrapper of Object.keys(INLINE_FIELD_WRAPPERS)) {
      // 줄 안에서 해당 래퍼 문자가 등장하는 위치를 처음부터 순서대로 찾아나간다.
      let foundIndex = line.indexOf(wrapper);
      while (foundIndex >= 0) {
        // 그 위치에서 실제로 "key:: value]" 형태가 완전하게 파싱되는지 시도한다.
        const parsedField = findSpecificInlineField(line, foundIndex);
        if (!parsedField) {
          // 파싱 실패(예: 그냥 텍스트 안의 대괄호였음) → 다음 등장 위치부터 다시 탐색.
          foundIndex = line.indexOf(wrapper, foundIndex + 1);
          continue;
        }

        // 파싱 성공 → 결과 목록에 추가하고, 이 필드가 끝난 위치 이후부터 다음 래퍼를 탐색.
        fields.push(parsedField);
        foundIndex = line.indexOf(wrapper, parsedField.end);
      }
    }
  }

  // Tasks 플러그인이 활성화되어 있고 호출자가 태스크 전용 이모지 필드도 원할 때만
  // 이모지 단축 필드를 함께 수집한다.
  if (tasks && includeTaskFields) fields = fields.concat(extractSpecialTaskFields(line));

  // 모든 필드를 줄 안에서 등장한 순서(시작 위치 오름차순)로 정렬한다.
  fields.sort((a, b) => a.start - b.start);

  // 서로 겹치는(overlap) 필드가 있으면 먼저 등장한(=정렬 후 앞에 있는) 필드만 채택하고
  // 뒤의 것은 버린다. 즉 "직전에 채택된 필드의 end보다 현재 필드의 start가 뒤에 있어야"
  // 새로 채택한다 — 겹치지 않는 필드만 최종 결과에 남긴다.
  const filteredFields: InlineField[] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (i == 0 || filteredFields[filteredFields.length - 1].end < f.start) {
      filteredFields.push(f);
    }
  }

  return filteredFields;
}

// 현재 볼트에 커뮤니티 플러그인 "dataview"가 설치·활성화되어 있는지 확인하고,
// 있다면 해당 플러그인 인스턴스를 반환한다(getTasksPlugin과 동일한 패턴).
export function getDataviewPlugin() {
  if (!(app as any).plugins.enabledPlugins.has('dataview')) {
    return null;
  }

  return (app as any).plugins.plugins['dataview'];
}
