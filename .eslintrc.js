// ============================================================================
// [단계: 빌드설정] .eslintrc.js — ESLint(정적 분석/린트) 설정 파일
// ----------------------------------------------------------------------------
// "설치→빌드설정→실행" 흐름 중 "빌드설정" 단계에 속하는, 개발 시에만 쓰이는 파일입니다.
// `yarn lint` / `yarn lint:fix`(package.json scripts)가 이 설정을 읽어 src/**/*.{ts,tsx}를
// 검사합니다. 번들(main.js)에는 전혀 포함되지 않고, 오직 "코드 스타일/잠재적 버그"를 사람이
// 코드를 커밋하기 전에 미리 잡아주는 개발 도구 설정입니다. module.exports 형태이므로 Node.js가
// CommonJS 모듈로 그대로 읽어들입니다(ESLint 자체가 Node로 동작하는 CLI 도구이기 때문).
// ============================================================================
module.exports = {
  // 이 코드가 실행될 것으로 "가정하는" 전역 환경들. env를 지정하면 그 환경에서 흔히 쓰이는 전역
  // 변수(예: browser의 window/document, node의 require/module, jest의 describe/it)를 ESLint가
  // "정의되지 않은 변수" 오류로 잘못 잡아내지 않도록 미리 알려주는 역할을 합니다.
  env: {
    browser: true, // window, document 등 브라우저(Electron 렌더러) 전역 허용
    es6: true, // Promise, Map, Set 등 ES6 전역 객체 허용
    node: true, // require, module, process 등 Node 전역 허용(esbuild.config.mjs 등 빌드 스크립트용)
    jest: true, // describe/it/expect 등 테스트 전역 허용(현재 이 프로젝트엔 테스트 파일이 거의 없지만 대비용)
  },
  // 린트 검사에서 완전히 제외할 경로 패턴. src/docs는 사용자용 문서/샘플이 들어있는 폴더라서
  // 코드 품질 규칙을 적용할 대상이 아니므로 제외합니다.
  ignorePatterns: ['./src/docs'],
  // 이 프로젝트가 따를 규칙 묶음(preset)들을 순서대로 상속합니다. 뒤에 나열된 preset이 앞선
  // preset의 규칙을 덮어쓸 수 있습니다.
  extends: [
    'eslint:recommended', // ESLint가 기본 제공하는 "일반적으로 버그를 유발하는 패턴" 규칙 모음
    'plugin:react/recommended', // JSX/React(사실상 Preact) 작성 시 흔한 실수를 잡는 규칙 모음
    'plugin:@typescript-eslint/recommended', // TypeScript 전용 규칙 모음(타입 관련 안티패턴 등)
  ],
  // ESLint가 "이미 어딘가에 선언되어 있다"고 가정해도 되는 추가 전역 변수. env만으로 커버되지
  // 않는, 최신 브라우저 API 전역 2개를 명시적으로 허용합니다.
  globals: {
    Atomics: 'readonly', // 공유 메모리 원자적 연산 API
    SharedArrayBuffer: 'readonly', // 여러 스레드/워커가 공유할 수 있는 바이너리 버퍼 타입
  },
  // ESLint가 코드를 분석하기 전에 문법 트리(AST)로 바꾸는 "파서"를 지정합니다. TypeScript 문법
  // (인터페이스, 제네릭, 타입 단언 등)은 표준 JS 파서가 이해하지 못하므로 전용 파서가 필요합니다.
  parser: '@typescript-eslint/parser',
  // 위 파서에게 전달할 세부 옵션들.
  parserOptions: {
    parser: '@typescript-eslint/parser', // (일부 플러그인 호환을 위해 중첩 지정된 동일 파서)
    // 이 tsconfig.json을 참조해서, "타입 정보를 활용하는" 규칙(예: await-thenable처럼 실제 타입이
    // Promise인지 알아야 판단 가능한 규칙)까지 검사할 수 있게 합니다.
    project: './tsconfig.json',
    ecmaFeatures: {
      jsx: true, // JSX 문법(<Component />)을 파싱할 수 있게 활성화
    },
    ecmaVersion: 2018, // 파싱을 허용할 최신 JS 문법 버전(비동기 반복자 등 ES2018 문법까지 허용)
    sourceType: 'module', // 파일들을 import/export를 쓰는 ES 모듈로 간주(스크립트 모드가 아님)
  },
  // 위 extends의 preset들이 내부적으로 사용하는 규칙 구현체 플러그인들을 명시적으로 등록합니다.
  plugins: ['react', '@typescript-eslint'],
  // extends로 상속받은 preset 규칙들 중 이 프로젝트에 맞게 개별적으로 켜거나(on) 끄는(off) 목록.
  // 'error'는 위반 시 린트 실패, 'off'는 해당 규칙을 아예 검사하지 않음을 의미합니다.
  rules: {
    // Promise가 아닌 값에 await를 쓰는 것을 에러로 잡음(실수로 동기 값을 await하는 버그 방지).
    // 타입 정보(project 설정)가 있어야 판단 가능한 규칙이라 위 parserOptions.project가 필요합니다.
    '@typescript-eslint/await-thenable': 'error',
    // 모든 함수에 반환 타입을 명시하도록 강제하는 규칙 — 끔(타입 추론에 맡김, 보일러플레이트 감소).
    '@typescript-eslint/explicit-function-return-type': 'off',
    // 인터페이스/타입 멤버 끝의 세미콜론(;) vs 콤마(,) 스타일 강제 — 끔(Prettier가 대신 포맷 담당).
    '@typescript-eslint/member-delimiter-style': 'off',
    // `any` 타입 사용을 금지하는 규칙 — 끔(이 프로젝트는 Obsidian의 비공개 내부 API 등에 접근하기
    // 위해 의도적으로 any를 자주 사용하기 때문에, 이를 강제로 막으면 오히려 코드가 지저분해짐).
    '@typescript-eslint/no-explicit-any': 'off',
    // 빈 함수 본문(예: 콜백 자리채움용 () => {})을 금지하는 규칙 — 끔.
    '@typescript-eslint/no-empty-function': 'off',
    // CommonJS의 require()를 TS/ESM 파일에서 쓰는 것을 금지하는 규칙 — 끔(빌드 스크립트 등에서
    // require를 섞어 쓸 수 있게 허용).
    '@typescript-eslint/no-var-requires': 'off',
    // 함수/변수를 "선언하기 전에 사용"하는 것을 금지하는 규칙 — 끔(호이스팅을 이용한 상호 참조
    // 패턴이 코드베이스 곳곳에 있어서 끔).
    '@typescript-eslint/no-use-before-define': 'off',
    // export되는 함수/클래스 멤버에 명시적 타입을 강제하는 규칙(위 explicit-function-return-type의
    // "모듈 경계"버전) — 끔.
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // `const self = this` 같은 this 별칭 사용을 금지하는 규칙 — 끔(콜백 안에서 this를 참조하기
    // 위해 이 패턴을 의도적으로 쓰는 코드가 있음, 예: main.ts의 registerMonkeyPatches).
    '@typescript-eslint/no-this-alias': 'off',
    // `let x: number = 5` 처럼 타입을 추론 가능한데도 명시한 경우를 지적하는 규칙 — 끔.
    '@typescript-eslint/no-inferrable-types': 'off',
    // JSX 텍스트 안의 따옴표(')를 이스케이프하지 않았다고 지적하는 React 규칙 — 끔.
    'react/no-unescaped-entities': 'off',
    // 컴포넌트 props에 PropTypes 런타임 검증을 요구하는 규칙 — 끔(TypeScript가 이미 컴파일 타임에
    // props 타입을 검증하므로 PropTypes는 중복).
    'react/prop-types': 'off',
    // 파일 상단에 `import React from 'react'`가 없다고 지적하는 React 17 이전 방식의 규칙 — 끔
    // (이 프로젝트는 tsconfig.json의 jsx: 'react-jsx' 자동 런타임을 쓰므로 그런 import가 필요 없음).
    'react/react-in-jsx-scope': 'off',
    // 줄바꿈 문자를 유닉스(LF, \n) 방식으로 강제(윈도우 CRLF 혼입 방지) — 위반 시 에러.
    'linebreak-style': ['error', 'unix'],
    indent: 'off', // 들여쓰기 검사 — 끔(Prettier가 포맷을 전담).
    quotes: 'off', // 따옴표 스타일(작은따옴표/큰따옴표) 검사 — 끔(Prettier가 전담, prettier.config.cjs의 singleQuote 참고).
  },
  // 플러그인별 부가 설정. react 플러그인에게 "이 프로젝트가 타깃하는 React 버전"을 알려줘서
  // 버전별로 다른 규칙(예: 새 JSX 런타임 관련 분기)을 올바르게 적용하게 합니다. 실제로는
  // Preact를 쓰지만 API 호환을 위해 React 버전 숫자를 명시해야 합니다.
  settings: {
    react: {
      version: '16.13',
    },
  },
};
