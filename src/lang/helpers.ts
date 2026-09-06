/**
 * ============================================================================
 * [실행 순서 #2] src/lang/helpers.ts — 다국어 번역 함수 t() 정의 및 로케일 로더
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화
 * 이 파일은 Obsidian Kanban 플러그인의 모든 UI 문자열을 다국어로 표시하기 위한
 * 진입점(entry point) 역할을 한다. 모듈이 처음 로드되는 시점(파일 최상단, 함수
 * 밖)에 src/lang/locale/ 아래 25개 언어별 파일(en, ko, ja 등, 이번 작업 대상
 * 아님)을 전부 import하여 "언어 코드(key) -> 번역 테이블(value)" 형태의 맵을
 * 한 번만 구성해 둔다. 실제로 사용할 언어는 Obsidian이 설정 화면에서 언어를
 * 바꿀 때 브라우저의 localStorage에 저장해 두는 'language' 키 값을 읽어
 * 결정하며, 해당 로케일 데이터가 없거나 특정 문자열 키가 그 언어 파일에 비어
 * 있으면 항상 영어(en)를 기본값(fallback)으로 사용한다.
 * 이 파일이 export하는 t() 함수는 #1 main.ts를 포함한 거의 모든 UI 컴포넌트에서
 * t('문자열 키') 형태로 호출되어, 화면에 표시되는 문자열을 사용자의 Obsidian
 * 언어 설정에 맞게 번역해 반환하는 역할을 한다. 이 로직은 파일이 처음 import될
 * 때 딱 한 번 실행되고(모듈 캐싱), 이후에는 이미 계산된 locale 상수를 재사용한다.
 * ============================================================================
 */
// 아래는 언어별 번역 테이블을 담고 있는 25개의 로케일 파일을 각각 import하는 부분이다.
// 각 파일(src/lang/locale/*.ts)은 문자열 키 -> 번역된 문자열 값으로 이루어진
// 객체(Partial<Lang>)를 default export 하고 있다고 가정한다.
import ar from './locale/ar'; // 아랍어(Arabic)
import cz from './locale/cz'; // 체코어(Czech)
import da from './locale/da'; // 덴마크어(Danish)
import de from './locale/de'; // 독일어(German)
// en(영어)은 "기준 로케일"이다. 다른 언어에 없는 키를 채워주는 fallback으로도 쓰이고,
// 동시에 Lang이라는 타입(en 객체의 키들로 이루어진 타입)도 함께 가져와 아래에서 사용한다.
import en, { Lang } from './locale/en'; // 영어(English) - 기준/기본 로케일 + Lang 타입
import es from './locale/es'; // 스페인어(Spanish)
import fr from './locale/fr'; // 프랑스어(French)
import hi from './locale/hi'; // 힌디어(Hindi)
import id from './locale/id'; // 인도네시아어(Indonesian)
import it from './locale/it'; // 이탈리아어(Italian)
import ja from './locale/ja'; // 일본어(Japanese)
import ko from './locale/ko'; // 한국어(Korean)
import nl from './locale/nl'; // 네덜란드어(Dutch)
import no from './locale/no'; // 노르웨이어(Norwegian)
import pl from './locale/pl'; // 폴란드어(Polish)
import pt from './locale/pt'; // 포르투갈어(Portuguese, 포르투갈)
import ptBR from './locale/pt-br'; // 포르투갈어(브라질, Brazilian Portuguese)
import ro from './locale/ro'; // 루마니아어(Romanian)
import ru from './locale/ru'; // 러시아어(Russian)
import sq from './locale/sq'; // 알바니아어(Albanian)
import tr from './locale/tr'; // 터키어(Turkish)
// 주의: 아래 uk(우크라이나어) import는 './locale/tr'(터키어 파일)을 다시 가리키고 있다.
// 이는 원본 소스에 있는 그대로이며(실제 './locale/uk' 파일이 아님), 로직을
// 수정하지 말라는 지침에 따라 그대로 두었다. 즉 uk 로케일 선택 시 실제로는
// 터키어 번역 테이블이 사용되는 셈이다(원저작자의 의도인지 오타인지는 불명).
import uk from './locale/tr'; // 우크라이나어(Ukrainian)로 매핑되지만 실제로는 tr(터키어) 파일을 재사용
import zhCN from './locale/zh-cn'; // 중국어 간체(Simplified Chinese)
import zhTW from './locale/zh-tw'; // 중국어 번체(Traditional Chinese, 대만)

// localeMap: 언어 코드 문자열을 key로, 해당 언어의 번역 테이블(Partial<Lang>)을 value로 갖는 객체.
// Partial<Lang>인 이유는 모든 언어 파일이 en의 모든 키를 100% 번역해 채워두지 않을 수도
// 있기 때문(일부 키가 비어 있어도 타입 에러가 나지 않도록 함)이다.
const localeMap: { [k: string]: Partial<Lang> } = {
  ar,
  cz,
  da,
  de,
  en,
  es,
  fr,
  hi,
  id,
  it,
  ja,
  ko,
  nl,
  no,
  pl,
  'pt-BR': ptBR, // Obsidian이 localStorage에 저장하는 언어 코드가 'pt-BR' 형태이므로 키를 그대로 맞춤
  pt,
  ro,
  ru,
  sq,
  tr,
  uk,
  'zh-TW': zhTW, // Obsidian이 저장하는 언어 코드 'zh-TW'(번체)에 대응
  zh: zhCN, // Obsidian이 저장하는 언어 코드 'zh'(간체, 기본 중국어)에 대응
};

// window.localStorage.getItem('language'): Obsidian 앱이 사용자가 설정에서 선택한 표시 언어
// 코드(예: 'ko', 'en', 'zh-TW' 등)를 브라우저 localStorage에 저장해 두는데, 이 값을 그대로
// 읽어온다. 값이 없으면(아직 한 번도 설정되지 않았거나 Node/테스트 환경이면) null이 된다.
const lang = window.localStorage.getItem('language');
// 위에서 읽은 lang 코드로 localeMap에서 해당 언어의 번역 테이블을 조회한다.
// lang이 null이거나 localeMap에 없는 코드이면 'en'(영어) 테이블을 기본값으로 사용한다.
const locale = localeMap[lang || 'en'];

// t(): 문자열 키를 받아 현재 로케일에 맞는 번역 문자열을 반환하는 번역 함수.
// - 매개변수 str의 타입은 `keyof typeof en`으로, en 로케일 객체가 가진 모든 키(문자열 리터럴 유니온)
//   만 인자로 허용한다. 즉 en.ts에 정의되지 않은 키는 컴파일 타임에 타입 에러가 난다(오타 방지).
// - 반환값은 항상 string이다.
export function t(str: keyof typeof en): string {
  // locale이 falsy(즉 위에서 lang 코드가 localeMap에 없어 undefined가 된 경우)라면
  // 콘솔에 에러를 남긴다. 이는 개발/디버깅 편의를 위한 로깅일 뿐, 로직 흐름을 막지는 않는다.
  if (!locale) {
    console.error('Error: kanban locale not found', lang);
  }
  // 우선순위: 1) 현재 로케일의 번역이 존재하면 그것을 사용,
  //           2) 로케일 자체가 없거나(undefined) 해당 키의 번역이 비어있으면(falsy) en(영어) 값으로 폴백.
  // `locale && locale[str]`는 locale이 없을 때 예외가 나지 않도록 방어하는 단축 평가(short-circuit)이다.
  return (locale && locale[str]) || en[str];
}
