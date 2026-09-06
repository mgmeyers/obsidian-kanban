/**
 * ============================================================================
 * [실행 순서 #19] types.ts — 핵심 데이터 모델 타입 정의
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링
 * 이 프로젝트의 핵심 데이터 모델을 정의하는 파일이다. Board(보드) → Lane(레인) →
 * Item(아이템)으로 이어지는 트리 구조와, 각 노드가 공통으로 가져야 하는 드래그앤드롭
 * (dnd) 관련 필드를 결합해 주는 Nestable<T, C> 제네릭 조합(Item = Nestable<ItemData>,
 * Lane = Nestable<LaneData, Item> 등)을 정의한다. 또한 DataTypes 상수(dnd 타입 식별자
 * 문자열)와 ItemTemplate/LaneTemplate 등 새 노드를 생성할 때 기본으로 병합되는 템플릿
 * 객체도 함께 정의한다. 거의 모든 컴포넌트와 파서(parser) 파일이 이 파일의 타입을
 * import하여 사용하므로, 이 파일을 이해하는 것이 전체 코드베이스를 이해하는 출발점이 된다.
 * ============================================================================
 */
import { TFile } from 'obsidian'; // Obsidian의 파일 객체 타입 - ItemMetadata.file 필드 등에서 사용
import { KanbanSettings } from 'src/Settings'; // 보드/플러그인 설정 값들의 타입
import { Nestable } from 'src/dnd/types'; // dnd 트리 노드 공통 래퍼 제네릭 타입 (id, type, accepts, children 등 공통 필드를 T에 결합)
import { InlineField } from 'src/parsers/helpers/inlineMetadata'; // 아이템 본문에서 파싱된 인라인 메타데이터(예: [key:: value]) 타입
import { FileAccessor } from 'src/parsers/helpers/parser'; // 아이템 텍스트 안의 링크된 파일에 접근하기 위한 접근자 타입

// 레인 내부 아이템 정렬 기준을 나타내는 열거형(enum)
export enum LaneSort {
  TitleAsc, // 제목 오름차순 정렬
  TitleDsc, // 제목 내림차순 정렬
  DateAsc, // 날짜 오름차순 정렬
  DateDsc, // 날짜 내림차순 정렬
  TagsAsc, // 태그 오름차순 정렬
  TagsDsc, // 태그 내림차순 정렬
}

// 레인(Lane)이 가지는 고유 데이터. 아래에서 Nestable<LaneData, Item>으로 감싸져 최종 Lane 타입이 된다.
export interface LaneData {
  shouldMarkItemsComplete?: boolean; // 이 레인으로 아이템이 이동해 오면 자동으로 "완료" 처리할지 여부 (helpers.ts의 maybeCompleteForMove에서 사용)
  title: string; // 레인 제목
  maxItems?: number; // 레인에 표시할 아이템 개수 제한 (선택적)
  dom?: HTMLDivElement; // 레인의 실제 DOM 엘리먼트 참조 (스크롤 등 명령형 DOM 조작에 사용, 선택적)
  forceEditMode?: boolean; // 레인 제목을 강제로 편집(인풋) 모드로 열도록 지시하는 플래그
  sorted?: LaneSort | string; // 현재 이 레인에 적용된 정렬 기준 (내장 LaneSort 값 또는 커스텀 정렬 식별 문자열)
}

// frontmatter/인라인 메타데이터의 개별 필드를 어떻게 표시할지에 대한 설정
export interface DataKey {
  metadataKey: string; // 메타데이터 키 이름 (예: frontmatter의 필드명)
  label: string; // 화면에 표시할 라벨 텍스트
  shouldHideLabel: boolean; // 라벨 자체를 숨길지 여부
  containsMarkdown: boolean; // 값에 마크다운 문법이 포함되어 있어 렌더링(파싱) 처리가 필요한지 여부
}

// 특정 태그에 대한 커스텀 색상 지정 (설정 화면에서 사용자가 등록)
export interface TagColor {
  tagKey: string; // 대상이 되는 태그 문자열
  color: string; // 글자 색상 (CSS color 값)
  backgroundColor: string; // 배경 색상 (CSS color 값)
}

// 태그 정렬 우선순위를 지정하기 위한 설정 (특정 태그를 우선적으로 정렬하고 싶을 때 사용)
export interface TagSort {
  tag: string; // 정렬 기준이 되는 태그 문자열
}

// 날짜(마감일 등) 값에 따라 커스텀 색상을 적용하기 위한 규칙
export interface DateColor {
  isToday?: boolean; // "오늘" 날짜일 때 적용되는 규칙인지 여부
  isBefore?: boolean; // "지금 이전"이면 무조건 적용되는 규칙인지 여부 (distance/unit 무시)
  isAfter?: boolean; // "지금 이후"면 무조건 적용되는 규칙인지 여부 (distance/unit 무시)
  distance?: number; // 기준 시점으로부터의 거리 값 (예: 3)
  unit?: 'hours' | 'days' | 'weeks' | 'months'; // distance의 단위
  direction?: 'before' | 'after'; // distance를 기준으로 과거 방향인지 미래 방향인지
  color?: string; // 글자 색상
  backgroundColor?: string; // 배경 색상
}

// frontmatter 등에서 읽어온 값이 가질 수 있는 타입들의 합집합(유니언) 타입.
// 문자열/숫자/그 배열/혹은 같은 형태의 값을 갖는 중첩 객체까지 재귀적으로 허용한다.
export type PageDataValue =
  | string
  | number
  | Array<string | number>
  | { [k: string]: PageDataValue };

// DataKey(표시 설정)에 실제 값(value)을 추가로 결합한 타입 - "표시 방법 + 실제 값"을 함께 가짐
export interface PageData extends DataKey {
  value: PageDataValue;
}

// 파일 하나의 메타데이터 전체를 key(메타데이터 키 이름)로 접근할 수 있는 맵 타입
export interface FileMetadata {
  [k: string]: PageData;
}

// 아이템(카드) 하나에 딸린 부가 메타데이터 (파싱 과정에서 채워짐)
export interface ItemMetadata {
  dateStr?: string; // 파싱된 날짜의 원본 문자열 형태
  date?: moment.Moment; // 파싱되어 moment 객체로 변환된 날짜
  timeStr?: string; // 파싱된 시간의 원본 문자열 형태
  time?: moment.Moment; // 파싱되어 moment 객체로 변환된 시간
  tags?: string[]; // 아이템 본문에서 추출된 태그 목록
  fileAccessor?: FileAccessor; // 아이템 텍스트 내 링크된 파일에 접근하기 위한 접근자 객체
  file?: TFile | null; // 실제로 링크가 가리키는 Obsidian 파일 (링크가 없거나 파일을 찾지 못하면 null)
  fileMetadata?: FileMetadata; // 링크된 파일의 frontmatter 등에서 읽어온 메타데이터
  fileMetadataOrder?: string[]; // fileMetadata의 필드들을 화면에 표시할 순서(키 목록)
  inlineMetadata?: InlineField[]; // 아이템 본문 텍스트 안에 직접 작성된 인라인 메타데이터 목록 (예: [key:: value])
}

// 아이템(카드) 자체의 고유 데이터. 아래에서 Nestable<ItemData>로 감싸져 최종 Item 타입이 된다.
export interface ItemData {
  blockId?: string; // 마크다운 블록 참조용 ID (예: 텍스트 끝의 ^abc123)
  checked: boolean; // 체크박스의 완료 여부 (true/false)
  checkChar: string; // 체크박스 대괄호 안에 실제로 쓰인 문자 (예: 'x', ' ', 혹은 커스텀 진행 상태를 나타내는 문자)
  title: string; // 렌더링을 위해 가공된 제목 (예: 마크다운 처리, 임베드 치환 등이 반영된 상태)
  titleRaw: string; // 가공되지 않은 원본 마크다운 텍스트 그대로의 제목
  titleSearch: string; // 검색 매칭을 위해 정규화(소문자 변환 등)된 제목
  titleSearchRaw: string; // 검색 매칭용이지만 가공 전(raw) 상태의 제목
  metadata: ItemMetadata; // 위에서 정의한 날짜/태그/파일 등 부가 메타데이터
  forceEditMode?: boolean; // 이 아이템을 강제로 편집(텍스트 입력) 모드로 열도록 지시하는 플래그
}

// 보드 파싱 등에서 발생한 에러 하나를 표현하는 정보
export interface ErrorReport {
  description: string; // 사용자에게 보여줄 에러 설명 메시지
  stack: string; // 디버깅용 스택 트레이스 문자열
}

// 보드(Board) 자체가 가지는 고유 데이터. 아래에서 Nestable<BoardData, Lane>으로 감싸져 최종 Board 타입이 된다.
export interface BoardData {
  isSearching: boolean; // 현재 이 보드가 검색 중인 상태인지 여부
  settings: KanbanSettings; // 이 보드에 적용되는 설정 (frontmatter로 오버라이드된 값 포함)
  frontmatter: Record<string, number | string | Array<number | string>>; // 마크다운 파일의 원본 frontmatter 데이터
  archive: Item[]; // 아카이브(보관)된 아이템 목록 - 보드 화면에는 표시되지 않고 별도 보관됨
  errors: ErrorReport[]; // 이 보드를 파싱하는 과정에서 발생한 에러 목록
}

// ----------------------------------------------------------------------------
// 아래는 Nestable<T, C> 제네릭을 이용해 "고유 데이터 타입 T"에 dnd 트리 노드가 공통으로
// 가져야 하는 필드(id, type, accepts, children 등 - src/dnd/types에 정의됨)를 결합한
// 실제 사용 타입들이다. Nestable의 두 번째 타입 인자 C는 children 배열 원소의 타입을 의미하며,
// 생략하면 T 자기 자신을 담는 트리(예: Item처럼 스스로를 중첩하지 않는 리프 노드)로 취급된다.
// 즉 "Item = Nestable<ItemData>"는 "ItemData + 공통 노드 필드"를 합친 타입이고,
// "Lane = Nestable<LaneData, Item>"은 여기에 더해 "children: Item[]" 형태로 자식을 갖는다는
// 의미가 추가된 타입이다. 이런 방식으로 Board > Lane > Item의 3단 트리 구조가 표현된다.
// ----------------------------------------------------------------------------
export type Item = Nestable<ItemData>; // 아이템: 트리의 리프(leaf) 노드
export type Lane = Nestable<LaneData, Item>; // 레인: 자식으로 Item[]을 갖는 노드
export type Board = Nestable<BoardData, Lane>; // 보드: 자식으로 Lane[]을 갖는 최상위 노드
export type MetadataSetting = Nestable<DataKey>; // 설정 화면에서 드래그로 순서 변경 가능한 메타데이터 표시 설정 항목
export type TagColorSetting = Nestable<TagColor>; // 설정 화면에서 드래그로 순서 변경 가능한 태그 색상 설정 항목
export type TagSortSetting = Nestable<TagSort>; // 설정 화면에서 드래그로 순서 변경 가능한 태그 정렬 설정 항목
export type DateColorSetting = Nestable<DateColor>; // 설정 화면에서 드래그로 순서 변경 가능한 날짜 색상 설정 항목

// DataTypes: dnd 시스템에서 노드의 "종류"를 구분하는 문자열 식별자 모음.
// Sortable 컨테이너의 accepts 배열이나 드래그 중인 노드의 type을 비교하는 데 사용되며,
// 예를 들어 레인 컨테이너는 accepts에 DataTypes.Lane만 넣어 아이템이 최상위에 드롭되지 않도록 막는다.
export const DataTypes = {
  Item: 'item',
  Lane: 'lane',
  Board: 'board',
  MetadataSetting: 'metadata-setting',
  TagColorSetting: 'tag-color',
  TagSortSetting: 'tag-sort',
  DateColorSetting: 'date-color',
};

// ItemTemplate: 새 Item 노드를 생성할 때 기본으로 병합되는 템플릿 객체.
// accepts: 이 노드 내부에 드롭될 수 있는 자식 타입 목록 (Item 자체는 children이 없는 리프이지만 필드는 정의되어 있음)
export const ItemTemplate = {
  accepts: [DataTypes.Item],
  type: DataTypes.Item,
  children: [] as any[],
};

// LaneTemplate: 새 Lane 노드를 생성할 때 기본으로 병합되는 템플릿 객체. Lane 안에는 Lane만 드롭 가능(accepts 참고)
export const LaneTemplate = {
  accepts: [DataTypes.Lane],
  type: DataTypes.Lane,
};

// BoardTemplate: 보드는 다른 무언가의 자식으로 드롭될 수 있는 대상이 아니므로 accepts가 빈 배열
export const BoardTemplate = {
  accepts: [] as string[],
  type: DataTypes.Board,
};

// MetadataSettingTemplate: 설정 화면의 "메타데이터 표시 항목" 목록에서 정렬 가능하게 만드는 템플릿
export const MetadataSettingTemplate = {
  accepts: [DataTypes.MetadataSetting],
  type: DataTypes.MetadataSetting,
  children: [] as any[],
};

// TagSortSettingTemplate: 설정 화면의 "태그 정렬 우선순위" 목록에서 정렬 가능하게 만드는 템플릿
export const TagSortSettingTemplate = {
  accepts: [DataTypes.TagSortSetting],
  type: DataTypes.TagSortSetting,
  children: [] as any[],
};

// TODO: all this is unecessary because these aren't sortable
// TagColorSettingTemplate: 태그 색상 설정 항목 템플릿. 실제로는 드래그 정렬되지 않으므로 accepts가 비어있음 (원본 TODO 주석 그대로 유지됨)
export const TagColorSettingTemplate = {
  accepts: [] as string[],
  type: DataTypes.TagColorSetting,
  children: [] as any[],
};

// TODO: all this is unecessary because these aren't sortable
// DateColorSettingTemplate: 날짜 색상 설정 항목 템플릿. 마찬가지로 드래그 정렬되지 않음
export const DateColorSettingTemplate = {
  accepts: [] as string[],
  type: DataTypes.DateColorSetting,
  children: [] as any[],
};

// 아이템/레인 편집 UI를 화면의 특정 좌표 위치에서 열 때 사용하는 좌표 타입
export interface EditCoordinates {
  x: number;
  y: number;
}

// 편집이 좌표 기반이 아니라 특수한 상태로 종료되었음을 나타내는 열거형
export enum EditingState {
  cancel, // 편집이 취소되어 종료됨
  complete, // 편집이 정상적으로 완료됨
}

// EditState: 편집 중인 위치를 나타내는 좌표(EditCoordinates) 또는
// 편집 종료 상태(EditingState 열거형 값, 즉 number)를 갖는 유니언 타입
export type EditState = EditCoordinates | EditingState;

// isEditing: EditState 값이 좌표 객체(EditCoordinates) 형태인지 판별하는 타입 가드(type guard) 함수.
// 반환 타입에 `state is EditCoordinates`를 명시해, 이 함수가 true를 반환하는 분기에서
// TypeScript가 state를 EditCoordinates로 좁혀(narrowing) 인식하도록 한다.
export function isEditing(state: EditState): state is EditCoordinates {
  if (state === null) return false; // 값이 없으면 편집 중이 아님
  if (typeof state === 'number') return false; // EditingState(enum)는 숫자이므로 좌표가 아님
  return true; // 그 외에는 EditCoordinates 객체로 간주
}
