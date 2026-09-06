/**
 * ============================================================================
 * [실행 순서 #87] src/components/Editor/datePickerLocale.ts — flatpickr 날짜선택기 로케일 매핑
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화
 * #86(datepicker.ts)의 constructDatePicker가 flatpickr 인스턴스를 만들 때 넘겨주는
 * locale 옵션(요일 이름, 월 이름, 한 주의 시작 요일 등)을 결정한다. Obsidian이 현재 사용
 * 중인 언어(moment.locale())를 flatpickr가 제공하는 로케일 코드(l10n)로 매핑하고,
 * 사용자가 칸반 설정에서 "한 주의 시작 요일"을 별도로 지정했다면 그 값으로 덮어쓴다.
 * 이 파일은 데이터 매핑/조회 로직만 담당하며, 실제 로케일 데이터(l10n)는 벤더링된
 * flatpickr 라이브러리(./flatpickr/l10n, 이번 작업 대상 아님)에서 가져온다.
 * ============================================================================
 */
import { moment } from 'obsidian';
import { StateManager } from 'src/StateManager';

import l10n from './flatpickr/l10n';
import { CustomLocale } from './flatpickr/types/locale';

// Obsidian(moment)이 쓰는 로케일 코드 문자열을 key로, flatpickr가 제공하는 로케일 데이터
// 객체(CustomLocale)를 value로 갖는 매핑 테이블. 예를 들어 moment.locale()이 'ko'면
// l10n.ko(한국어 요일/월 이름 등)를 사용하게 된다. 'en-gb', 'pt-br'처럼 지역 변형은
// 별도 데이터가 없는 경우 가장 가까운 기본 로케일(en, pt)로 대체(alias)해 연결해둔다.
const localeMap: { [k: string]: CustomLocale } = {
  ar: l10n.ar,
  cs: l10n.cs,
  da: l10n.da,
  de: l10n.de,
  en: l10n.en,
  'en-gb': l10n.en,
  es: l10n.es,
  fr: l10n.fr,
  hi: l10n.hi,
  id: l10n.id,
  it: l10n.it,
  ja: l10n.ja,
  ko: l10n.ko,
  nl: l10n.nl,
  nn: l10n.no,
  pl: l10n.pl,
  pt: l10n.pt,
  'pt-br': l10n.pt,
  ro: l10n.ro,
  ru: l10n.ru,
  tr: l10n.tr,
  'zh-cn': l10n.zh,
  'zh-tw': l10n.zh_tw,
};

// 모듈이 로드되는 시점(파일 최초 import 시)의 Obsidian 전역 로케일을 기준으로 한 번만
// 조회해서 캐싱해둔다. 이후 Obsidian 언어 설정이 실행 중에 바뀌더라도 이 값은 갱신되지
// 않는다는 점에 유의(플러그인이 이 값을 다시 계산하려면 재로드가 필요).
const locale = localeMap[moment.locale()];

// 실제로 flatpickr에 넘길 로케일 객체를 계산해서 반환하는 함수.
// 매핑 테이블에 없는 로케일이면 영어(l10n.en)로 안전하게 대체(fallback)한다.
export function getDefaultLocale(stateManager?: StateManager) {
  const firstDayOfWeek = stateManager?.getSetting('date-picker-week-start');
  const curLocale = locale || localeMap.en;

  // 사용자가 칸반 설정에서 "한 주의 시작 요일"을 명시적으로 지정했다면, 로케일 기본값 위에
  // 스프레드(...)로 덮어써서 해당 값만 오버라이드한 새 객체를 반환한다.
  if (firstDayOfWeek) {
    return {
      ...curLocale,
      firstDayOfWeek,
    };
  }

  return curLocale;
}
