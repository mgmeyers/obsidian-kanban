/**
 * ============================================================================
 * [실행 순서 #4] common.ts — 파서 공통 유틸리티 (여러 파서 파일이 공유하는 기반 모듈)
 * ----------------------------------------------------------------------------
 * 단계: 실행-파싱
 * 이 파일은 특정 파서 하나에 속하지 않고, 여러 파서/설정 관련 파일이 공통으로 가져다 쓰는
 * "공유 유틸리티 모음"이다. 칸반 보드임을 식별하는 frontmatterKey 상수, 모든 보드 파서
 * 구현체(List 등)가 반드시 지켜야 할 BaseFormat 인터페이스(계약), 카드 검색 문자열 생성
 * (getSearchValue), 위키링크로 연결된 노트의 frontmatter/Dataview 메타데이터 조회
 * (getLinkedPageMetadata), 설정 변경 시 보드 재파싱 필요 여부 판단(shouldRefreshBoard) 등을
 * 담당한다. Settings.ts(#5), StateManager.ts(#14), parseMarkdown.ts(#45), List.ts(#58) 등
 * 파서/설정 관련 파일 대부분이 이 파일을 import하므로, 여기서 정의된 규칙이 바뀌면 전체
 * 파싱 파이프라인에 영향을 준다. 즉, 실제 파싱 로직 실행에 앞서 다른 여러 단계가 공통으로
 * 참조하는 "기반 도구상자" 역할을 하는 파일이다.
 * ============================================================================
 */
import { App, TFile, moment } from 'obsidian';
import { KanbanSettings } from 'src/Settings';
import { StateManager } from 'src/StateManager';
import { anyToString } from 'src/components/Item/MetadataTable';
import { Board, FileMetadata, Item } from 'src/components/types';
import { defaultSort } from 'src/helpers/util';
import { t } from 'src/lang/helpers';

// 칸반보드로 인식되는 마크다운 파일의 frontmatter(YAML 머리말)에 들어가는 특수 키 이름.
// 노트의 frontmatter에 이 키(`kanban-plugin: board`)가 존재해야 Obsidian이 해당 노트를
// 일반 마크다운이 아니라 "칸반 보드"로 인식하고 전용 보드 뷰로 렌더링한다.
export const frontmatterKey = 'kanban-plugin';

// [TypeScript 문법: enum]
// 파서 포맷의 종류를 나타내는 열거형(enum). enum은 이름이 붙은 상수 집합을 정의하는 문법으로,
// 멤버에 값을 직접 지정하지 않으면 0부터 순서대로 정수가 자동 할당된다 (List === 0).
// 현재는 'List'(리스트 기반 보드) 하나뿐이지만, 훗날 다른 보드 포맷이 추가될 것을 대비한
// 확장 지점으로 만들어져 있다.
export enum ParserFormats {
  List,
}

// [TypeScript 문법: interface]
// interface는 객체(또는 클래스)가 반드시 가져야 할 메서드/속성의 "형태(shape)"만 선언하고,
// 실제 구현 내용은 강제하지 않는다. BaseFormat은 모든 보드 파서 구현체(예: List.ts의
// ListFormat 클래스)가 공통으로 구현해야 하는 계약(contract)이다. StateManager는 이
// interface 타입을 통해 파서 구현체를 다형적으로(polymorphic) 다룰 수 있다.
export interface BaseFormat {
  // 문자열 content로부터 새 카드(Item)를 생성한다.
  // forceEdit 뒤의 물음표(?)는 "옵셔널(선택적) 매개변수"를 뜻하며, 호출 시 생략 가능하고
  // 생략하면 함수 내부에서 undefined로 취급된다.
  newItem(content: string, checkChar: string, forceEdit?: boolean): Item;
  // 기존 카드(item)의 텍스트 내용을 새 문자열(content)로 교체한 새 Item을 반환한다.
  updateItemContent(item: Item, content: string): Item;
  // 보드 데이터 구조(Board)를 다시 마크다운 문자열로 직렬화(serialize)한다 (Board -> md).
  boardToMd(board: Board): string;
  // 마크다운 문자열을 파싱해 보드 데이터 구조(Board)로 변환한다 (md -> Board).
  // List.ts의 mdToBoard()가 실제로 parseMarkdown.ts(#45)의 parseMarkdown()을 호출하는 구현체.
  mdToBoard(md: string): Board;
  // 현재 원본 마크다운을 기준으로 보드를 처음부터 다시 파싱한다 (설정 변경 등으로 재파싱이
  // 필요할 때 StateManager가 호출).
  reparseBoard(): Board;
}

// 카드가 "완료됨" 상태일 때 표시하는 마크다운 볼드 텍스트. 예: **Complete**
// t()는 다국어(i18n) 번역 헬퍼 함수로, 사용자의 Obsidian 언어 설정에 맞는 문자열을 반환한다.
export const completeString = `**${t('Complete')}**`;
// 완료된 카드를 모아두는 "보관(Archive)" 구역을 마크다운 안에서 구분하는 수평선 문자열.
export const archiveString = '***';
// 새 칸반 보드 파일을 생성할 때 기본으로 삽입되는 frontmatter 템플릿 문자열.
// 배열의 각 원소를 줄바꿈('\n')으로 이어붙여 아래와 같은 텍스트 블록을 만든다:
//   ---
//
//   kanban-plugin: board
//
//   ---
//
//
export const basicFrontmatter = ['---', '', `${frontmatterKey}: board`, '', '---', '', ''].join(
  '\n'
);

// 보드의 설정 객체(board.data.settings)를 마크다운 파일 맨 아래에 저장하기 위한
// 코드블록 문자열로 변환한다. Obsidian의 "%% ... %%" 구문은 주석(comment) 블록이라
// 렌더링 시 화면에는 보이지 않는다. 그 안에 JSON 코드블록으로 설정을 직렬화해 저장해두면,
// parseMarkdown.ts(#45)의 extractSettingsFooter()가 파일을 다시 열 때 이 부분을 읽어
// 설정을 복원한다.
export function settingsToCodeblock(board: Board): string {
  return [
    '',
    '',
    '%% kanban:settings',
    '```',
    JSON.stringify(board.data.settings),
    '```',
    '%%',
  ].join('\n');
}

// 카드(Item) 하나에 대한 "검색 대상 문자열"을 생성한다. 사용자가 검색창에 입력한 텍스트와
// 이 함수의 반환값(소문자로 통일됨)을 비교해 카드가 검색 결과에 포함될지를 결정한다.
export function getSearchValue(item: Item, stateManager: StateManager) {
  // 카드에 연결된 노트(위키링크 대상)가 있다면 그 노트의 frontmatter/Dataview 메타데이터
  const fileMetadata = item.data.metadata.fileMetadata;
  // 마크다운 서식이 남아있는 카드 제목 원문(검색에 특화된 raw 텍스트)
  const { titleSearchRaw } = item.data;

  // 검색 문자열 조각들을 모아둘 배열. 마지막에 공백으로 이어붙인다.
  const searchValue = [titleSearchRaw];

  if (fileMetadata) {
    // fileMetadataOrder(사용자가 실제로 표시하도록 설정한 키 순서 목록)에 포함된 키만
    // 검색 대상으로 필터링한다.
    // [TypeScript 문법: 옵셔널 체이닝(optional chaining) `?.`]
    // fileMetadataOrder가 undefined/null이어도 예외를 던지지 않고 그 시점에서 undefined를
    // 반환하며 멈춘다. 그 결과 `undefined?.includes(k)`가 아니라 콜백 전체가 undefined가 되어
    // filter 조건은 falsy로 처리된다.
    const presentKeys = Object.keys(fileMetadata).filter((k) => {
      return item.data.metadata.fileMetadataOrder?.includes(k);
    });
    if (presentKeys.length) {
      // 메타데이터의 "키 이름들" 자체도 검색 가능하도록 문자열로 변환
      const keys = anyToString(presentKeys, stateManager);
      // 메타데이터의 "값들"도 검색 가능하도록 문자열로 변환
      const values = anyToString(
        presentKeys.map((k) => fileMetadata[k]),
        stateManager
      );

      if (keys) searchValue.push(keys);
      if (values) searchValue.push(values);
    }
  }

  // 카드에 시간(time) 정보가 있으면, 사람이 읽기 좋은 로케일 형식(LLLL)과 원본 값을
  // 모두 검색 대상 문자열에 추가한다.
  if (item.data.metadata.time) {
    searchValue.push(item.data.metadata.time.format('LLLL'));
    searchValue.push(anyToString(item.data.metadata.time, stateManager));
  } else if (item.data.metadata.date) {
    // 시간이 없으면 날짜(date) 정보로 대체 (한 카드에 time과 date가 동시에 존재하지 않는다고 가정)
    searchValue.push(item.data.metadata.date.format('LLLL'));
    searchValue.push(anyToString(item.data.metadata.date, stateManager));
  }

  // 모든 조각을 공백으로 이어붙이고 소문자로 통일하여, 대소문자를 구분하지 않는 검색을 지원한다.
  return searchValue.join(' ').toLocaleLowerCase();
}

// 연결된 노트(linkedFile)에 대한 Dataview 플러그인의 캐시 데이터를 가져온다.
// Dataview는 인기 있는 Obsidian 커뮤니티 플러그인으로, frontmatter 외에도 본문 인라인
// 필드(`key:: value` 문법) 등 더 풍부한 메타데이터를 조회할 수 있는 API(api.page())를 제공한다.
export function getDataViewCache(app: App, linkedFile: TFile, sourceFile: TFile) {
  if (
    // [TypeScript 문법: `as any` 타입 단언(type assertion)]
    // Obsidian의 공식 App 타입 정의에는 커뮤니티 플러그인 인스턴스 목록에 접근하는 API가
    // 선언되어 있지 않다. `app as any`로 캐스팅해 타입 검사를 우회함으로써 런타임에만
    // 존재하는 비공식 내부 속성(plugins.enabledPlugins 등)에 접근한다. 대신 타입 안전성은
    // 포기하는 것이므로, 아래처럼 옵셔널 체이닝으로 방어적으로 접근해야 한다.
    (app as any).plugins.enabledPlugins.has('dataview') &&
    // 옵셔널 체이닝(?.)으로 plugins 객체나 dataview 플러그인, api가 없어도 에러 없이
    // undefined로 평가되어 안전하게 조건을 검사할 수 있다.
    (app as any).plugins?.plugins?.dataview?.api
  ) {
    // Dataview API로 linkedFile 경로에 대한 페이지 메타데이터를 조회한다.
    // sourceFile은 상대 경로 링크 해석 등에 사용되는 기준 파일이다.
    return (app as any).plugins.plugins.dataview.api.page(linkedFile.path, sourceFile.path);
  }
  // 위 조건이 거짓이면(Dataview 미설치/비활성화) 아무 값도 반환하지 않아 암묵적으로 undefined가 된다.
}

// 점(.)으로 구분된 경로 문자열(path, 예: "a.b.c")을 이용해 중첩 객체(obj)에서 값을 안전하게
// 꺼내는 헬퍼. 정규식으로 경로를 파싱하지 않고 단순 split('.') + 반복문으로 한 단계씩
// 내려가며 탐색하는 이유는, 실제 metadata-keys 키 이름 자체에 점(.)이 포함될 수도 있기
// 때문이다(예: 키 이름이 "a.b"라는 하나의 통짜 문자열인 경우). 그래서 먼저 path 전체를
// 하나의 키로 취급해 직접 조회를 시도하고, 그것이 실패했을 때만 점 단위로 쪼개어 중첩
// 탐색을 수행한다.
function getPageData(obj: any, path: string) {
  if (!obj) return null;
  // 1순위: path 문자열 전체를 하나의 통짜 키로 취급해 바로 조회 (예: obj["a.b.c"])
  if (obj[path]) return obj[path];

  // 2순위: 통짜 키로 찾지 못했다면 점(.) 단위로 분리해 한 단계씩 내려가며 중첩 객체를 탐색
  const split = path.split('.');
  let ctx = obj;

  for (const p of split) {
    if (typeof ctx === 'object' && p in ctx) {
      ctx = ctx[p];
    } else {
      // 중간에 경로가 끊기면(해당 속성이 존재하지 않으면) 더 진행하지 않고 null로 확정한다.
      ctx = null;
      break;
    }
  }

  return ctx;
}

// [연결된 노트의 메타데이터 조회]
// 카드 안에 [[위키링크]]로 연결된 노트가 있을 때, 그 노트의 frontmatter(YAML) 값 또는
// Dataview 인라인 필드 값을 읽어와 칸반 카드 하단에 메타데이터 배지로 표시하기 위한 함수.
//
// [dataview/frontmatter 우선순위 로직 요약]
// 사용자가 설정 화면에서 지정한 metadata-keys 순서대로 각 키를 순회하면서,
//   1) 먼저 Obsidian 코어 frontmatter 캐시(cache.frontmatter)에서 값을 찾는다.
//   2) frontmatter 값이 "유효"(null/undefined/빈 문자열/빈 배열이 아님)하면 그 값을 그대로 채택한다.
//   3) frontmatter 값이 비어 있을 때만 Dataview 캐시(dataviewCache)의 값을 대체(fallback)로 사용한다.
// 즉 frontmatter가 항상 Dataview보다 우선한다.
export function getLinkedPageMetadata(
  stateManager: StateManager,
  linkedFile: TFile | null | undefined
): { fileMetadata?: FileMetadata; fileMetadataOrder?: string[] } {
  // 사용자가 설정 화면에서 지정한, 카드에 표시할 메타데이터 키 목록 (배열 순서가 표시 순서)
  const metaKeys = stateManager.getSetting('metadata-keys');

  // 표시할 메타데이터 키가 하나도 설정되어 있지 않으면 더 조회할 필요가 없으므로 빈 객체 반환
  if (!metaKeys.length) {
    return {};
  }

  // 연결된 파일 자체가 없으면(깨진 링크, 아직 존재하지 않는 노트 등) 빈 객체 반환
  if (!linkedFile) {
    return {};
  }

  // Obsidian 코어 메타데이터 캐시: frontmatter, 태그, 링크 위치 등을 담고 있다.
  const cache = stateManager.app.metadataCache.getFileCache(linkedFile);
  // Dataview 플러그인이 설치/활성화되어 있다면 보조 메타데이터 캐시도 함께 조회한다.
  const dataviewCache = getDataViewCache(stateManager.app, linkedFile, stateManager.file);

  // 두 캐시 모두 얻지 못했다면(연결 파일 정보를 전혀 알 수 없음) 더 진행할 수 없으므로 빈 객체 반환
  if (!cache && !dataviewCache) {
    return {};
  }

  // 최종적으로 카드에 표시할 메타데이터: 키 -> { 설정정보..., value: 실제 값 }
  const metadata: FileMetadata = {};
  // 태그 값의 중복 제거를 위한 조회용 맵 (객체를 Set처럼 사용하는 흔한 패턴)
  const seenTags: { [k: string]: boolean } = {};
  // metaKeys 설정 목록에 동일한 키가 중복으로 들어있을 경우를 대비한 중복 처리 방지용
  const seenKey: { [k: string]: boolean } = {};
  // 카드에 메타데이터를 표시할 순서를 기록 (사용자가 설정한 순서를 그대로 보존하기 위함)
  const order: string[] = [];

  // 유효한 메타데이터를 하나라도 찾았는지 여부. 끝까지 하나도 못 찾으면 fileMetadata를
  // 빈 객체({}) 대신 undefined로 반환하기 위해 사용한다.
  let haveData = false;

  metaKeys.forEach((k) => {
    // 이미 처리한 키라면(설정 목록에 중복 등록된 경우) 건너뛴다.
    if (seenKey[k.metadataKey]) return;

    seenKey[k.metadataKey] = true;

    // 'tags'는 특수 케이스로 별도 처리한다: Obsidian 코어가 파싱한 본문 인라인
    // 태그(cache.tags)와 frontmatter의 tags 배열(YAML 목록)을 모두 합쳐 하나의 태그
    // 목록으로 만든다.
    if (k.metadataKey === 'tags') {
      let tags = cache?.tags || [];

      // frontmatter.tags가 배열 형태라면(YAML에 `tags: [a, b]`처럼 작성된 경우) 각 항목
      // 앞에 '#'을 붙여, 인라인 태그와 동일한 { tag: string } 형태로 맞춰서 합친다.
      if (Array.isArray(cache?.frontmatter?.tags)) {
        tags = [].concat(
          tags,
          cache.frontmatter.tags.map((tag: string) => ({ tag: `#${tag}` }))
        );
      }

      // 합친 결과 태그가 하나도 없으면 표시할 것이 없으므로 건너뛴다.
      if (tags?.length === 0) return;

      order.push(k.metadataKey);
      metadata.tags = {
        // 스프레드 문법(...)으로 설정 객체(k)의 속성(라벨, 표시 여부 등)을 그대로 복사하고
        // value 속성만 아래에서 새로 계산한 값으로 덮어쓴다.
        ...k,
        value: tags
          .map((t) => t.tag)
          .filter((t) => {
            // 이미 등장한 태그 문자열은 다시 포함하지 않는다 (중복 제거)
            if (seenTags[t]) {
              return false;
            }

            seenTags[t] = true;
            return true;
          })
          .sort(defaultSort),
      };

      haveData = true;
      return;
    }

    // --- 일반(태그가 아닌) 메타데이터 키 처리 ---
    // frontmatter 값과 dataview 값을 미리 둘 다 조회해두고, 아래에서 우선순위에 따라 선택한다.
    const dataviewVal = getPageData(dataviewCache, k.metadataKey);
    let cacheVal = getPageData(cache?.frontmatter, k.metadataKey);
    // [우선순위 로직 핵심] frontmatter 값(cacheVal)이 "유효"하면 무조건 frontmatter를 채택한다.
    // dataview 값은 오직 frontmatter가 비어있을 때만 대체용으로 사용된다 (아래 else if 분기).
    if (
      cacheVal !== null &&
      cacheVal !== undefined &&
      cacheVal !== '' &&
      !(Array.isArray(cacheVal) && cacheVal.length === 0)
    ) {
      if (typeof cacheVal === 'string') {
        // [정규식 리터럴] /^\d{4}-\d{2}-\d{2}/
        // 문자열이 "YYYY-MM-DD" 패턴으로 시작하는지 검사한다. \d{4}는 숫자 4개,
        // 하이픈(-)은 그대로 리터럴 문자. 날짜처럼 보이는 문자열이면 moment 객체로 변환해
        // 카드에서 날짜로 다룰 수 있게 한다.
        if (/^\d{4}-\d{2}-\d{2}/.test(cacheVal)) {
          cacheVal = moment(cacheVal);
        } else if (/^\[\[[^\]]+\]\]$/.test(cacheVal)) {
          // [정규식 리터럴] /^\[\[[^\]]+\]\]$/
          // 문자열 전체가 "[[...]]" 위키링크 형태와 정확히 일치하는지 검사한다.
          // [^\]]+ 는 ']'가 아닌 문자가 1개 이상 반복됨을 뜻한다. ^...$로 문자열 시작과 끝을
          // 고정해 부분 일치가 아닌 완전 일치만 허용한다. frontmatter 값이 위키링크 문자열이면
          // 실제 TFile 객체로 변환을 시도한다.
          const link = (cache.frontmatterLinks || []).find((l) => l.key === k.metadataKey);
          if (link) {
            const file = stateManager.app.metadataCache.getFirstLinkpathDest(
              link.link,
              stateManager.file.path
            );
            if (file) {
              // 문자열이었던 값을 실제 TFile 객체로 교체한다 (카드에서 클릭 가능한 링크로
              // 렌더링하기 위함).
              cacheVal = file;
            }
          }
        }
      } else if (Array.isArray(cacheVal)) {
        // frontmatter 값이 배열인 경우(예: links: ["[[A]]", "[[B]]"]) 각 원소별로
        // 위키링크 변환을 시도한다.
        cacheVal = cacheVal.map<any>((v, i) => {
          // [TypeScript 문법: 제네릭(generic)]
          // Array.prototype.map<any>(...)처럼 <any>는 map 콜백의 반환 타입을 명시적으로
          // any로 지정하는 제네릭 타입 인자다. 배열 원소가 원본 string이거나 변환된
          // TFile일 수 있어 반환 타입을 하나로 고정할 수 없기 때문에 any를 사용한다.
          if (typeof v === 'string' && /^\[\[[^\]]+\]\]$/.test(v)) {
            // 배열 항목의 링크 정보는 frontmatterLinks에 "key.인덱스" 형태 키로 저장되어 있다.
            const link = (cache.frontmatterLinks || []).find(
              (l) => l.key === k.metadataKey + '.' + i.toString()
            );
            if (link) {
              const file = stateManager.app.metadataCache.getFirstLinkpathDest(
                link.link,
                stateManager.file.path
              );
              if (file) {
                return file;
              }
            }
          }
          return v;
        });
      }

      order.push(k.metadataKey);
      metadata[k.metadataKey] = {
        ...k,
        value: cacheVal,
      };
      haveData = true;
    } else if (
      // frontmatter 값이 비어있을 때만 dataview 값을 유효성 검사한다 (fallback 경로).
      dataviewVal !== undefined &&
      dataviewVal !== null &&
      dataviewVal !== '' &&
      !(Array.isArray(dataviewVal) && dataviewVal.length === 0)
    ) {
      const cachedValue = dataviewCache[k.metadataKey];

      order.push(k.metadataKey);
      metadata[k.metadataKey] = {
        ...k,
        value: cachedValue,
      };
      haveData = true;
    }
  });

  return {
    // 유효한 메타데이터를 하나도 찾지 못했다면 fileMetadata를 빈 객체({}) 대신 undefined로
    // 반환한다. 호출부에서 "메타데이터가 있는지"를 단순 truthy 체크로 판단할 수 있게 하기 위함.
    fileMetadata: haveData ? metadata : undefined,
    fileMetadataOrder: order,
  };
}

// 플러그인 설정이 변경되었을 때, 이미 화면에 표시 중인 보드를 처음부터 다시 파싱해야 하는지
// 여부를 판단한다. "파싱 결과에 실제로 영향을 주는" 설정 항목만 비교 대상(toCompare)으로
// 삼아서, 그와 무관한 설정(예: 테마 색상 등)이 바뀌었을 때는 불필요하게 전체 보드를
// 재파싱하지 않도록 하여 성능을 아낀다.
export function shouldRefreshBoard(oldSettings: KanbanSettings, newSettings: KanbanSettings) {
  // 이전 설정이 아예 없었는데(최초 로드 등) 새 설정이 생겼다면 무조건 새로 파싱해야 한다.
  if (!oldSettings && newSettings) {
    return true;
  }

  // [TypeScript 문법: 제네릭 + keyof 연산자]
  // `keyof KanbanSettings`는 KanbanSettings 인터페이스가 가진 모든 프로퍼티 이름을 모은
  // 문자열 리터럴 유니온 타입이다. `Array<keyof KanbanSettings>`는 그 이름들로만 이루어진
  // 배열 타입이므로, 아래 배열에 오타나 존재하지 않는 설정 키를 적으면 컴파일 타임에 에러가
  // 발생해 실수를 막아준다.
  const toCompare: Array<keyof KanbanSettings> = [
    'metadata-keys',
    'date-trigger',
    'time-trigger',
    'link-date-to-daily-note',
    'date-format',
    'time-format',
    'move-dates',
    'move-tags',
    'inline-metadata-position',
    'move-task-metadata',
    'hide-card-count',
    'tag-colors',
    'date-colors',
  ];

  // toCompare에 나열된 모든 키에 대해 이전 값과 새 값이 동일하면(every()가 true) 재파싱이
  // 필요 없다는 뜻이다. 단 하나라도 값이 다르면 every()가 false가 되고, 맨 앞의 논리
  // 부정(!)으로 뒤집어 true(재파싱 필요)를 반환한다.
  return !toCompare.every((k) => {
    return oldSettings[k] === newSettings[k];
  });
}
