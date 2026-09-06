// ============================================================================
// [단계: 빌드설정] prettier.config.cjs — Prettier(코드 자동 포맷터) 설정 파일
// ----------------------------------------------------------------------------
// "설치→빌드설정→실행" 흐름 중 "빌드설정" 단계에 속하는, 개발 시에만 쓰이는 파일입니다.
// `yarn prettier`(package.json scripts, `prettier --write "./src/**/*.{ts,tsx}"`)와
// .vscode/settings.json의 "저장 시 자동 포맷"이 이 설정을 읽어 코드 스타일(들여쓰기, 따옴표,
// 세미콜론, import 순서 등)을 자동으로 통일합니다. 번들(main.js)에는 포함되지 않습니다.
// 확장자 .cjs는 "이 파일 자체는 항상 CommonJS(require/module.exports)로 취급하라"는 명시로,
// 프로젝트의 나머지 코드가 ESM(import/export) 위주라도 이 설정 파일만은 Node가 CommonJS로
// 읽도록 강제하는 역할을 합니다.
// ============================================================================
/* eslint-disable no-undef */
// 위 줄: 이 파일 안에서 쓰는 `module`이 브라우저 환경(.eslintrc.js의 env.browser)에서는
// "정의되지 않은 전역"으로 오인될 수 있어, 이 파일에 한해 해당 ESLint 규칙(no-undef)을 끕니다.
module.exports = {
  // 화살표 함수의 매개변수가 1개뿐이어도 항상 괄호를 씀: `x => x*2`가 아니라 `(x) => x*2`.
  arrowParens: 'always',
  // 객체 리터럴의 중괄호 안쪽에 공백을 넣음: `{foo: bar}`가 아니라 `{ foo: bar }`.
  bracketSpacing: true,
  // 줄바꿈 문자를 LF(유닉스 스타일, \n)로 통일. .eslintrc.js의 linebreak-style 규칙과 짝을 이룸.
  endOfLine: 'lf',
  // .html/.vue 등에서 태그 사이 공백을 의미있는 것으로 취급할지 여부. 'css'는 CSS의 display 속성
  // 기준을 따름(이 프로젝트엔 순수 .html 파일이 거의 없지만 기본값을 명시적으로 고정해둔 것).
  htmlWhitespaceSensitivity: 'css',
  // JSX/HTML 태그의 닫는 `>`를 마지막 속성과 같은 줄에 두지 않고 다음 줄로 내림(여러 줄 속성일 때
  // 가독성을 위해 `>` 를 따로 줄바꿈).
  bracketSameLine: false,
  // JSX 안의 문자열 속성에는 홑따옴표(') 대신 겹따옴표(")를 사용: `<div className="foo">`.
  jsxSingleQuote: false,
  // 한 줄에 허용할 최대 문자 수. 100자를 넘으면 자동으로 줄바꿈.
  printWidth: 100,
  // 마크다운 등 "산문(prose)" 텍스트의 줄바꿈을 원본 그대로 유지(자동으로 다시 줄바꿈하지 않음).
  proseWrap: 'preserve',
  // 객체 속성 이름에 따옴표를 "필요한 경우에만" 붙임: `{ foo: 1 }`은 그대로 두고, `{ 'foo-bar': 1 }`
  // 처럼 식별자로 쓸 수 없는 이름에만 따옴표를 붙임.
  quoteProps: 'as-needed',
  // 문장 끝에 세미콜론(;)을 항상 붙임.
  semi: true,
  // 문자열은 기본적으로 홑따옴표(')를 사용: `'foo'` (JSX 속성 안은 위 jsxSingleQuote가 별도 결정).
  singleQuote: true,
  // 들여쓰기 폭은 스페이스 2칸.
  tabWidth: 2,
  // 여러 줄에 걸친 배열/객체/함수 인자의 마지막 요소 뒤에 trailing comma를 어디까지 붙일지 결정.
  // 'es5'는 ES5에서도 문법적으로 허용되는 위치(배열, 객체 리터럴)에만 붙이고, 함수 호출/정의의
  // 마지막 인자 뒤에는 붙이지 않음(구형 엔진 호환을 고려한 설정, 실제 타깃은 es2018이지만 관례적
  // 기본값을 유지).
  trailingComma: 'es5',
  // 들여쓰기에 탭 문자 대신 스페이스를 사용.
  useTabs: false,
  // 아래 3개(importOrder*)는 plugins에 등록된 @trivago/prettier-plugin-sort-imports 플러그인의
  // 옵션으로, import 문의 순서를 자동 정렬합니다. 정규식 '^[./]'는 "./"나 "../"로 시작하는, 즉
  // 상대 경로 import를 매칭합니다 — 이 패턴에 매칭되는 import(상대경로 import)들을, 매칭되지
  // 않는 나머지 import(외부 npm 패키지 import 등)들보다 "뒤에" 오도록 정렬합니다. 즉 결과적으로
  // "외부 패키지 import들 → (빈 줄) → 상대경로 import들" 순서가 됩니다.
  importOrder: ['^[./]'],
  // 위 importOrder 그룹들(외부 패키지 그룹 vs 상대경로 그룹) 사이에 빈 줄을 넣어 시각적으로
  // 구분되게 합니다.
  importOrderSeparation: true,
  // 한 import 문 안에서 여러 개를 가져올 때(`import { b, a, c } from 'x'`) 그 안의 이름들까지
  // 알파벳 순으로 재정렬합니다(`import { a, b, c } from 'x'`).
  importOrderSortSpecifiers: true,
  // 위에서 설명한 import 정렬 동작을 실제로 수행하는 서드파티 Prettier 플러그인을 활성화합니다.
  plugins: ['@trivago/prettier-plugin-sort-imports'],
};
