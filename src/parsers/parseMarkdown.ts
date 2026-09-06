/**
 * ============================================================================
 * [실행 순서 #45] parseMarkdown.ts — 마크다운 문자열을 AST(추상 구문 트리)로 변환하는 첫 파싱 단계
 * ----------------------------------------------------------------------------
 * 단계: 실행-파싱
 * 이 파일은 노트 파일의 원본 텍스트(마크다운 문자열)가 실제로 "구조화된 데이터"로 처음
 * 바뀌는 지점이다. 먼저 frontmatter(YAML 머리말)와 파일 하단의 칸반 설정 코드블록을
 * 정규식이 아닌 "문자 단위 스캔" 방식으로 직접 잘라내고, 남은 본문을
 * mdast-util-from-markdown(fromMarkdown)에 넘겨 AST(mdast 트리)를 생성한다. 이때
 * parsers/extensions/*(#46~#52)에 정의된 커스텀 micromark 확장(위키링크, 태그, 날짜,
 * 시간, 블록ID 등 칸반 전용 문법)을 함께 주입하여, 표준 마크다운에는 없는 이 플러그인만의
 * 문법까지 하나의 AST로 파싱해낸다. List.ts(#58)의 mdToBoard()는 이 파일의
 * parseMarkdown()이 만든 AST를 받아 실제 Board 데이터 구조(리스트/카드)로 다시 조립한다.
 * 즉 "텍스트 -> AST" 변환이라는, 전체 파싱 파이프라인의 가장 첫 관문 역할을 하는 파일이다.
 * ============================================================================
 */
import { fromMarkdown } from 'mdast-util-from-markdown';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { frontmatter } from 'micromark-extension-frontmatter';
import { parseYaml } from 'obsidian';
import { KanbanSettings, settingKeyLookup } from 'src/Settings';
import { StateManager } from 'src/StateManager';
import { getNormalizedPath } from 'src/helpers/renderMarkdown';

import { frontmatterKey, getLinkedPageMetadata } from './common';
// 아래 extensions/* 모듈들은 각각 "micromark 토크나이저 확장"과 "mdast 변환기 확장"의 짝을
// 내보낸다. micromark 확장은 문자 스트림에서 특정 문법을 토큰으로 인식하는 저수준 파서이고,
// fromMarkdown 확장은 그 토큰들을 실제 AST 노드(mdast tree)로 조립하는 상위 레이어다.
import { blockidExtension, blockidFromMarkdown } from './extensions/blockid';
import { genericWrappedExtension, genericWrappedFromMarkdown } from './extensions/genericWrapped';
import { internalMarkdownLinks } from './extensions/internalMarkdownLink';
import { tagExtension, tagFromMarkdown } from './extensions/tag';
import { gfmTaskListItem, gfmTaskListItemFromMarkdown } from './extensions/taskList';
import { FileAccessor } from './helpers/parser';

// 마크다운 파일 맨 앞부분의 frontmatter(YAML 머리말)를 잘라내어 파싱한다.
// [왜 정규식 대신 문자 단위 루프를 쓰는가]
// "---\n(YAML)\n---"라는 형태는 정규식 하나(예: /^---\n([\s\S]*?)\n---/)로도 표현할 수는
// 있지만, 이 함수는 아래와 같은 이유로 직접 문자를 하나씩 순회하는 방식을 택했다:
//   1) 파일이 정확히 대시 3개로 "시작"하는지를 엄격히 검증하고, 그렇지 않으면 즉시
//      Error를 던져 잘못된 파일임을 명확히 알리기 위함 (정규식 매치 실패는 단순 null이라
//      실패 이유를 구분하기 어렵다).
//   2) 닫는 "---"가 반드시 "줄의 시작"(직전 문자가 개행)에서만 나타나야 한다는 조건을
//      느슨한 정규식보다 더 명시적으로 표현하기 위함 (YAML 값 안에 우연히 "---"가 포함된
//      경우를 오탐지하지 않기 위해).
//   3) 슬라이스에 사용할 문자 인덱스(frontmatterStart, 닫는 위치)를 매칭 과정에서 직접
//      알고 있으므로, 캡처 그룹을 다시 계산할 필요 없이 바로 substring/slice할 수 있다.
function extractFrontmatter(md: string) {
  // frontmatter 본문(YAML 내용)이 시작하는 문자 인덱스. 아직 못 찾았으면 -1.
  let frontmatterStart = -1;
  // 파일 맨 앞에서부터 연속으로 나온 대시('-') 개수. 여는 구분자 "---"를 세는 카운터.
  let openDashCount = 0;

  for (let i = 0, len = md.length; i < len; i++) {
    // 아직 여는 구분자(대시 3개)를 다 세지 못한 단계
    if (openDashCount < 3) {
      if (md[i] === '-') {
        openDashCount++;
        // 다음 문자로 넘어가서 계속 대시를 센다.
        continue;
      } else {
        // 파일의 맨 앞 3글자가 정확히 "---"가 아니라면 frontmatter로 볼 수 없으므로
        // 즉시 에러를 던진다 (이 함수는 frontmatter가 반드시 존재한다고 가정하고 호출됨).
        throw new Error('Error parsing frontmatter');
      }
    }

    // 여는 "---"를 통과한 직후, 아직 YAML 본문 시작 위치를 기록하지 않았다면 지금이 그 위치.
    // (frontmatterStart < 0 체크로 한 번만 기록되도록 함)
    if (frontmatterStart < 0) frontmatterStart = i;

    // 닫는 구분자 탐색: 현재 문자가 '-'이고, 바로 앞 문자가 개행(\r 또는 \n)이며,
    // 그 뒤로도 '-'가 2개 더 이어져야("---") 줄 맨 앞에서 시작하는 닫는 펜스로 인정한다.
    // [정규식 리터럴] /[\r\n]/ 는 문자 클래스(character class)로, \r(캐리지 리턴) 또는
    // \n(라인피드) 둘 중 하나와 일치하면 참이 되는 한 글자짜리 매칭이다.
    if (md[i] === '-' && /[\r\n]/.test(md[i - 1]) && md[i + 1] === '-' && md[i + 2] === '-') {
      // frontmatterStart부터 닫는 "---" 직전(개행 문자 앞, i - 1)까지를 잘라내
      // 앞뒤 공백을 trim()한 뒤 YAML로 파싱해서 반환한다.
      return parseYaml(md.slice(frontmatterStart, i - 1).trim());
    }
  }
}

// 마크다운 파일 맨 아래에 저장된 칸반 설정 코드블록(settingsToCodeblock으로 저장된
// "%% kanban:settings\n```\n{json}\n```\n%%" 형태)을 잘라내어 JSON으로 파싱한다.
// frontmatter와 달리 파일의 "끝"에서부터 거꾸로 스캔하는데, 이는 설정 코드블록이 항상
// 파일 맨 마지막에 붙기 때문에 앞부분(보드 본문 전체)을 스캔할 필요 없이 뒤에서부터
// 짧게 훑어 찾아내기 위함이다.
// [왜 정규식 대신 역방향 문자 루프를 쓰는가]
// JS 정규식은 "문자열 끝에서부터" 매칭을 시작하는 기능을 기본 제공하지 않고, 코드블록
// 안의 JSON 값 자체에 백틱이나 개행이 포함될 가능성(이스케이프된 문자열 등)까지 고려하면
// 앞에서부터 매칭하는 정규식은 오탐/과매칭 위험이 있다. 따라서 파일 끝에서부터 한 글자씩
// 훑으며 "백틱 3개로 이루어진 펜스가 줄 시작에서 나타나는지"를 직접 확인하는 방식을 쓴다.
function extractSettingsFooter(md: string) {
  // 닫는 코드펜스(```)를 찾아 "본문 스캔 단계"에 진입했는지 여부
  let hasEntered = false;
  // 역방향으로 스캔하며 연속으로 만난 백틱(`) 개수 (3개가 모이면 코드펜스로 인정)
  let openTickCount = 0;
  // JSON 내용의 끝 경계 인덱스(닫는 펜스 앞의 개행 직전 위치)
  let settingsEnd = -1;

  // 파일의 맨 끝 문자(i = md.length - 1)부터 시작해 앞쪽(인덱스 0)으로 거꾸로 스캔한다.
  for (let i = md.length - 1; i >= 0; i--) {
    // 아직 닫는 펜스를 다 찾지 못한 단계에서는, 백틱(`) / 퍼센트(%) / 개행(\n, \r)만
    // 허용된 문자로 취급한다. 이는 파일 맨 끝의 "%%"(주석 종료 마커)와 그 앞뒤 개행,
    // 그리고 닫는 코드펜스(```)만 통과시키고, 그 외의 일반 텍스트가 나오면 "설정 코드블록
    // 형식이 아니다"라고 즉시 판단하기 위함이다.
    // [정규식 리터럴] /[`%\n\r]/ 는 백틱, %, 개행, 캐리지리턴 중 하나와 일치하는 문자 클래스.
    if (!hasEntered && /[`%\n\r]/.test(md[i])) {
      if (md[i] === '`') {
        openTickCount++;

        // 백틱을 3개 연속으로 만나면(역방향 스캔이므로 실제로는 정방향 기준 닫는 펜스의
        // 첫 글자에 도달한 시점) 닫는 코드펜스를 찾은 것으로 간주한다.
        if (openTickCount === 3) {
          hasEntered = true;
          // JSON 내용의 끝 경계는 이 펜스 바로 앞(개행 문자 직전) 위치.
          settingsEnd = i - 1;
        }
      }
      // 백틱이든 %/개행이든, 허용된 문자였다면 계속 앞쪽으로 스캔을 이어간다.
      continue;
    } else if (!hasEntered) {
      // 닫는 펜스를 찾기도 전에 허용되지 않은 문자를 만났다면, 파일 끝부분이 예상한
      // "설정 코드블록" 형식이 아니라는 뜻이므로 즉시 빈 객체를 반환하고 포기한다.
      return {};
    }

    // 닫는 펜스를 찾은 이후(hasEntered === true) 단계: 이제 JSON 내용을 건너뛰며
    // "여는 코드펜스"(```, 줄 시작에서 시작)를 찾는다.
    // md[i], md[i-1], md[i-2]가 모두 백틱이고(즉 정방향으로 읽었을 때 "```" 3글자),
    // 그 바로 앞 문자(md[i-3])가 개행이어야 줄 맨 앞에서 시작하는 펜스로 인정한다.
    if (md[i] === '`' && md[i - 1] === '`' && md[i - 2] === '`' && /[\r\n]/.test(md[i - 3])) {
      // 여는 펜스 바로 다음(i + 1)부터 앞서 기록해둔 settingsEnd까지가 JSON 본문이다.
      // trim으로 여백을 제거한 뒤 JSON.parse로 실제 설정 객체를 복원해 반환한다.
      return JSON.parse(md.slice(i + 1, settingsEnd).trim());
    }
  }
}

// micromark 단계(문자 스트림 -> 토큰)에서 사용할 커스텀 확장들의 배열을 만든다.
// 각 확장은 표준 마크다운에는 없는 이 플러그인만의 특수 문법을 인식하는 토크나이저다.
// stateManager.getSetting(...)으로 사용자가 설정한 트리거 문자를 읽어와, 그 문자에 맞춰
// 동적으로 확장을 구성한다 (예: date-trigger를 '@'로 바꾸면 "@{...}" 문법이 바뀜).
function getExtensions(stateManager: StateManager) {
  return [
    // GitHub Flavored Markdown의 체크박스 리스트 항목 문법: "- [ ] 할일" / "- [x] 완료"
    gfmTaskListItem,
    // 날짜 트리거 문자 + '{' ... '}' 로 감싸진 값을 "date" 토큰으로 인식.
    // 예: date-trigger가 '@'라면 "@{2024-01-01}" 형태를 날짜로 파싱.
    genericWrappedExtension('date', `${stateManager.getSetting('date-trigger')}{`, '}'),
    // 날짜 트리거 문자 + '[[' ... ']]' (위키링크 형태)로 감싸진 값을 "dateLink" 토큰으로 인식.
    // 예: "@[[2024-01-01]]" 처럼 데일리 노트를 가리키는 링크형 날짜 문법.
    genericWrappedExtension('dateLink', `${stateManager.getSetting('date-trigger')}[[`, ']]'),
    // 시간 트리거 문자 + '{' ... '}' 로 감싸진 값을 "time" 토큰으로 인식. (예: "@@{14:00}")
    genericWrappedExtension('time', `${stateManager.getSetting('time-trigger')}{`, '}'),
    // '![[' ... ']]' 형태의 임베드 위키링크(이미지/노트 삽입) 문법.
    genericWrappedExtension('embedWikilink', '![[', ']]'),
    // '[[' ... ']]' 형태의 일반 위키링크 문법.
    genericWrappedExtension('wikilink', '[[', ']]'),
    // '#태그' 형태의 인라인 태그 문법.
    tagExtension(),
    // 문단 끝의 '^blockid' 형태 블록 참조 ID 문법.
    blockidExtension(),
  ];
}

// mdast 단계(토큰 -> AST 노드)에서 사용할 커스텀 변환기들의 배열을 만든다.
// getExtensions()가 인식한 토큰들을 실제 mdast 트리 노드로 조립하고, 필요하다면 노드에
// 부가 데이터(날짜 문자열, 연결된 파일 정보, 메타데이터 등)를 직접 채워 넣는다.
function getMdastExtensions(stateManager: StateManager) {
  return [
    // 체크박스 토큰을 리스트 아이템 노드의 checked 속성 등으로 변환
    gfmTaskListItemFromMarkdown,
    // "date" 토큰 안의 텍스트를 노드의 date 속성에 그대로 저장 (예: "2024-01-01")
    genericWrappedFromMarkdown('date', (text, node) => {
      if (!text) return;
      node.date = text;
    }),
    // "dateLink" 토큰도 동일하게 date 속성에 저장 (위키링크 형태든 중괄호 형태든 결과적으로
    // 같은 node.date 필드로 통일해서 다루기 위함)
    genericWrappedFromMarkdown('dateLink', (text, node) => {
      if (!text) return;
      node.date = text;
    }),
    // "time" 토큰 안의 텍스트를 노드의 time 속성에 저장
    genericWrappedFromMarkdown('time', (text, node) => {
      if (!text) return;
      node.time = text;
    }),
    // "embedWikilink"(![[...]]) 토큰 처리: 링크 대상 파일을 실제로 찾아 연결한다.
    genericWrappedFromMarkdown('embedWikilink', (text, node) => {
      if (!text) return;

      // "[[파일명#섹션|별칭]]" 같은 위키링크 문자열을 { root, ... } 형태로 정규화
      const normalizedPath = getNormalizedPath(text);

      // Obsidian의 링크 해석 API로 실제 TFile을 찾는다 (없으면 undefined)
      const file = stateManager.app.metadataCache.getFirstLinkpathDest(
        normalizedPath.root,
        stateManager.file.path
      );

      // 노드에 파일 접근 정보(FileAccessor)를 부착. 임베드이므로 isEmbed: true이고,
      // 파일의 stat(수정시간, 크기 등)도 함께 저장해 렌더링(예: 이미지 미리보기)에 활용한다.
      // [TypeScript 문법: `as any`류의 타입 단언(as FileAccessor)]
      // 객체 리터럴이 FileAccessor 인터페이스와 완전히 일치하지 않을 수 있음을 알면서도
      // 컴파일러에게 "이 값은 FileAccessor로 취급해도 된다"고 명시적으로 알려주는 단언이다.
      node.fileAccessor = {
        target: normalizedPath.root,
        isEmbed: true,
        stats: file?.stat,
      } as FileAccessor;
    }),
    // "wikilink"([[...]], 임베드 아님) 토큰 처리: embedWikilink와 유사하지만 isEmbed: false이고,
    // 추가로 연결된 노트의 frontmatter/Dataview 메타데이터까지 함께 조회해 카드에 표시할 수
    // 있도록 한다.
    genericWrappedFromMarkdown('wikilink', (text, node) => {
      if (!text) return;

      const normalizedPath = getNormalizedPath(text);

      const file = stateManager.app.metadataCache.getFirstLinkpathDest(
        normalizedPath.root,
        stateManager.file.path
      );

      node.fileAccessor = {
        target: normalizedPath.root,
        isEmbed: false,
      } as FileAccessor;

      if (file) {
        // common.ts(#4)의 getLinkedPageMetadata()를 재사용해, 이 링크가 가리키는 노트의
        // frontmatter/Dataview 메타데이터를 조회하고(내부적으로 frontmatter 우선, 없으면
        // Dataview로 대체하는 우선순위 로직을 그대로 적용받는다) 노드에 부착한다.
        const metadata = getLinkedPageMetadata(stateManager, file);

        node.fileMetadata = metadata.fileMetadata;
        node.fileMetadataOrder = metadata.fileMetadataOrder;
      }
    }),
    // 표준 마크다운 링크/이미지 문법( [텍스트](경로) , ![alt](경로) )을 다뤄서, 그 경로가
    // 같은 볼트 안의 .md 파일을 가리킬 때만 위키링크와 동일하게 파일 정보를 부착한다.
    internalMarkdownLinks((node, isEmbed) => {
      // url이 없거나, "://"가 포함된 외부 URL(정규식 /:\/\// 로 http://, https:// 등을 감지)
      // 이거나, ".md"로 끝나지 않는(즉 마크다운 노트가 아닌) 링크라면 처리하지 않고 return.
      if (!node.url || /:\/\//.test(node.url) || !/.md$/.test(node.url)) {
        return;
      }

      // URL 인코딩된 문자(공백이 %20 등으로 표기된 경우 등)를 복원한 뒤 실제 파일을 탐색
      const file = stateManager.app.metadataCache.getFirstLinkpathDest(
        decodeURIComponent(node.url),
        stateManager.file.path
      );

      if (isEmbed) {
        // 이미지/노트 임베드( ![...](...) )라면 노드 타입 자체를 'embedLink'로 바꿔
        // 이후 렌더링 단계에서 구분해서 처리할 수 있게 한다.
        node.type = 'embedLink';
        node.fileAccessor = {
          target: decodeURIComponent(node.url),
          isEmbed: true,
          stats: file.stat,
        } as FileAccessor;
      } else {
        node.fileAccessor = {
          target: decodeURIComponent(node.url),
          isEmbed: false,
        } as FileAccessor;

        if (file) {
          // 위키링크와 동일하게, 연결된 노트의 메타데이터를 조회해 부착
          const metadata = getLinkedPageMetadata(stateManager, file);

          node.fileMetadata = metadata.fileMetadata;
          node.fileMetadataOrder = metadata.fileMetadataOrder;
        }
      }
    }),
    // '#태그' 토큰을 태그 AST 노드로 변환
    tagFromMarkdown(),
    // '^blockid' 토큰을 블록ID AST 노드로 변환
    blockidFromMarkdown(),
  ];
}

// 이 파일의 핵심 진입점(entry point): 노트 전체 마크다운 문자열(md)을 받아
//   1) frontmatter를 추출하고,
//   2) 파일 하단의 설정 코드블록을 추출하고,
//   3) 두 결과를 "칸반 플러그인 설정(settings)"과 "그 외 사용자 frontmatter(frontmatter)"로
//      분리한 뒤,
//   4) 본문 전체를 커스텀 확장이 적용된 fromMarkdown()으로 파싱해 AST를 만들어
// 이 네 가지를 한 번에 반환한다. List.ts(#58)의 mdToBoard()가 이 결과를 받아 실제
// Board(리스트/카드) 데이터 구조로 조립한다.
export function parseMarkdown(stateManager: StateManager, md: string) {
  // 파일 맨 위의 YAML frontmatter를 객체로 파싱
  const mdFrontmatter = extractFrontmatter(md);
  // 파일 맨 아래의 칸반 설정 코드블록을 객체로 파싱 (없으면 {})
  const mdSettings = extractSettingsFooter(md);
  // 설정 코드블록 값을 얕은 복사해 시작 (이후 frontmatter의 설정 관련 키가 덮어쓸 수 있음)
  const settings = { ...mdSettings };
  // frontmatter 중 "칸반 플러그인 설정이 아닌" 나머지 키들을 보존해둘 객체
  // [TypeScript 문법: 제네릭 인덱스 시그니처] Record<string, any>는 "키가 string이고
  // 값 타입은 any인 객체"를 뜻하는 유틸리티 타입으로, 임의의 frontmatter 키를 담기 위함.
  const fileFrontmatter: Record<string, any> = {};

  Object.keys(mdFrontmatter).forEach((key) => {
    if (key === frontmatterKey) {
      // 'kanban-plugin' 키는 과거 버전과의 호환을 위해 값이 'basic'이면 최신 값인
      // 'board'로 정규화한다. 이 키는 settings에도, frontmatter 보존 목록에도 함께 넣는다
      // (파일이 칸반보드임을 표시하는 값이면서 동시에 일반 frontmatter로도 다시 써질 값).
      const val = mdFrontmatter[key] === 'basic' ? 'board' : mdFrontmatter[key];
      settings[key] = val;
      fileFrontmatter[key] = val;
    } else if (settingKeyLookup.has(key as keyof KanbanSettings)) {
      // settingKeyLookup(Set)에 등록된, 즉 "플러그인이 인식하는 공식 설정 키"라면
      // settings 쪽에 반영한다 (frontmatter로 개별 보드의 설정을 오버라이드하는 기능).
      // [TypeScript 문법: `as` 타입 단언] key는 string 타입이지만, Set이
      // keyof KanbanSettings만 담고 있음을 알기에 안전하다고 보고 단언한다.
      settings[key] = mdFrontmatter[key];
    } else {
      // 플러그인이 모르는 키라면 사용자가 직접 추가한 일반 frontmatter이므로, 잃어버리지
      // 않도록 fileFrontmatter에 그대로 보존해둔다 (나중에 다시 저장할 때 복원됨).
      fileFrontmatter[key] = mdFrontmatter[key];
    }
  });

  // 수집된 settings를 StateManager에 반영/정규화(기본값 채우기, 유효성 보정 등)한다.
  stateManager.compileSettings(settings);

  return {
    settings,
    frontmatter: fileFrontmatter,
    // frontmatter와 설정 코드블록을 제외한 "본문"까지 포함한 md 전체를 fromMarkdown에 넘긴다.
    // (frontmatter 부분은 아래 extensions: [frontmatter(['yaml'])]가 다시 인식해서 건너뛴다)
    ast: fromMarkdown(md, {
      // micromark 확장: 표준 YAML frontmatter 인식 확장 + 이 플러그인의 커스텀 문법 확장들
      extensions: [frontmatter(['yaml']), ...getExtensions(stateManager)],
      // mdast 확장: 위 토큰들을 실제 AST 노드로 변환하는 대응 짝
      mdastExtensions: [frontmatterFromMarkdown(['yaml']), ...getMdastExtensions(stateManager)],
    }),
  };
}

// 문서 전체가 아니라 마크다운 "조각"(예: 카드 하나의 텍스트, 편집 중인 일부 텍스트 등)만
// AST로 파싱할 때 사용한다. frontmatter나 설정 코드블록을 추출/처리할 필요가 없으므로
// extractFrontmatter/extractSettingsFooter 호출 없이, 커스텀 문법 확장만 적용해
// 곧바로 fromMarkdown을 호출한다.
export function parseFragment(stateManager: StateManager, md: string) {
  return fromMarkdown(md, {
    extensions: getExtensions(stateManager),
    mdastExtensions: getMdastExtensions(stateManager),
  });
}
