/**
 * ============================================================================
 * [실행 순서 #23] types.ts — Nestable<D,T>, Entity, Path, Hitbox 등 DnD 시스템 전역 타입 정의
 * ----------------------------------------------------------------------------
 * 단계: 실행-상호작용
 * 이 파일은 "타입 정의 파일"입니다 — 즉 런타임에 실행되는 로직은 전혀 없고, 컴파일 타임에만
 * 존재하는 TypeScript 타입/인터페이스만 모아 놓았습니다. 그럼에도 매우 중요한 이유는, 이 파일이
 * 정의하는 Nestable(트리 구조의 공통 형태), Path(트리 안에서 특정 노드의 위치를 가리키는 좌표),
 * Hitbox(화면상의 사각형 영역), Entity(드래그 가능한 대상이 구현해야 하는 인터페이스) 등의
 * 타입들을 src/dnd 폴더 아래 거의 모든 파일이 import 해서 사용하기 때문입니다. 이 타입들이
 * 바뀌면 dnd 엔진 전체에 영향을 미치므로, 다른 모든 dnd 파일을 읽기 전에 이 파일부터 이해하고
 * 나면 나머지 코드를 훨씬 쉽게 따라갈 수 있습니다. Board(보드) → Lane(리스트) → Item(카드)이라는
 * 실제 칸반 데이터 구조도 전부 이 Nestable 트리 위에 얹혀 만들어집니다.
 * ============================================================================
 */

// preact의 자식 노드 타입(문자열, JSX 엘리먼트, 배열 등을 아우르는 타입)을 가져온다.
// 이 플러그인은 React 대신 더 가벼운 preact를 UI 라이브러리로 사용한다.
import { ComponentChildren } from 'preact';

// 드래그를 허용하는 축(가로/세로). 예: 리스트가 세로로만 정렬되면 'vertical'.
export type Axis = 'horizontal' | 'vertical';
// 드롭 시 스크롤이 발생하는 화면의 네 방향 중 하나를 나타내는 문자열 리터럴 유니언 타입.
export type Side = 'top' | 'right' | 'bottom' | 'left';
// Path: 트리(Nestable) 구조에서 루트로부터 특정 노드까지 내려가는 "자식 인덱스"들의 배열.
// 예를 들어 [1, 3]은 "루트의 children[1]의 children[3]"이라는 위치를 의미한다.
// 이 숫자 배열 하나로 보드 트리 안의 임의의 위치(레인, 아이템 등)를 가리킬 수 있다.
export type Path = number[];

// Nestable이 공통으로 가져야 하는 식별/분류용 필드들.
export interface NestableProps {
  // 이 노드의 고유 ID (예: 레인 ID, 아이템 ID).
  id: string;
  // 이 노드의 종류를 나타내는 문자열 (예: 'lane', 'item'). DataTypes 열거값과 매칭된다.
  type: string;
  // 이 노드가 자식으로 받아들일 수 있는 type 목록. 드롭 가능 여부 판정에 쓰인다.
  accepts: string[];
}

/**
 * Nestable<D, T> — Board/Lane/Item 트리를 이루는 모든 노드의 공통 뼈대가 되는 제네릭 타입.
 *
 * 제네릭 타입 파라미터란: <D = any, T = any> 처럼 타입 자체를 매개변수처럼 받는 문법이다.
 *  - D(Data)는 이 노드가 들고 있는 실제 데이터의 타입(예: LaneData, ItemData)을 의미한다.
 *  - T(Type of children)는 이 노드의 자식이 어떤 타입인지를 의미한다(예: Board의 자식은 Lane).
 * 예를 들어 실제 코드에서 Board는 Nestable<BoardData, Lane>, Lane은 Nestable<LaneData, Item>
 * 처럼 구체적인 타입을 채워 넣어 재사용한다. `= any`는 기본값으로, 타입 인자를 생략하면
 * D와 T가 모두 any로 취급된다는 뜻이다.
 * children은 T[] (자식 노드 배열), data는 D(이 노드 자신의 데이터)를 담는다.
 * Board → Lane → Item 처럼 같은 모양(Nestable)이 재귀적으로 중첩되어 트리를 이룬다.
 */
export interface Nestable<D = any, T = any> extends NestableProps {
  children: T[];
  data: D;
}

// Hitbox: 화면 좌표계에서 사각형 영역을 표현하는 4-튜플.
// [minX, minY, maxX, maxY] 순서로, 좌상단(min) 좌표와 우하단(max) 좌표를 담는다.
// 드래그 중인 포인터가 어떤 요소 위에 있는지 판정할 때 이 사각형끼리 충돌 검사를 한다.
export type Hitbox = [number, number, number, number];

// 평면 좌표 하나(x, y)를 나타내는 기본 인터페이스.
export interface Coordinates {
  x: number;
  y: number;
}

// CoordinateShift: 좌표를 "얼마나 이동시킬지"를 나타내는 값. 구조는 Coordinates와 동일하지만
// 의미가 다르므로(위치가 아니라 이동량) 별도의 타입 별칭(type alias)으로 구분해 둔 것이다.
export type CoordinateShift = Coordinates;

// 스크롤 상태: 현재 스크롤 위치(x, y)에 더해, 스크롤이 가능한 최대치(maxX, maxY)까지 포함한다.
// Coordinates를 확장(extends)하여 x, y 필드를 그대로 물려받는다.
export interface ScrollState extends Coordinates {
  maxX: number;
  maxY: number;
}

// 엔티티(드래그 가능한 대상)가 들고 있는 데이터의 공통 형태.
export interface EntityData {
  type: string;
  id: string;
  // 이 영역이 받아들일 수 있는 type 목록 (드롭 가능 여부 판정용).
  accepts: string[];
  // 정렬(재배치) 시 받아들일 수 있는 type 목록. accepts와 별도로 관리될 수 있다.
  acceptsSort?: string[];
  // 이 영역 내부에서 정렬이 일어나는 축(가로/세로).
  sortAxis?: Axis;
  // 인덱스 시그니처: 위에 정의되지 않은 임의의 추가 문자열 키도 허용한다는 뜻.
  // 즉 EntityData는 최소한 type/id/accepts를 갖되, 그 외 어떤 커스텀 필드도 덧붙일 수 있다.
  [k: string]: any;
}

// ScopedEntityData: EntityData에 "이 엔티티가 속한 Window" 정보를 추가한 버전.
// 팝아웃 창 지원을 위해, 어떤 창에서 이 엔티티가 렌더링되었는지를 함께 들고 다닌다.
export interface ScopedEntityData extends EntityData {
  win: Window;
}

// Entity: 드래그 가능한(혹은 드롭 가능한) 대상이 반드시 구현해야 하는 인터페이스.
// 실제 구현체는 DOM 요소를 감싸는 래퍼 객체로, 아래 메서드들을 통해 dnd 엔진과 상호작용한다.
export interface Entity {
  // 이 엔티티가 트리 안에서 어디에 위치하는지를 Path(숫자 배열)로 반환.
  getPath(): Path;
  // 이 엔티티의 현재 화면상 사각형 영역(Hitbox)을 반환.
  getHitbox(): Hitbox;
  // 이 엔티티가 들고 있는 데이터(type, id, accepts 등 + 소속 창 정보)를 반환.
  getData(): ScopedEntityData;
  // 최초(드래그 시작 시점) 위치/크기 정보를 다시 계산해서 갱신한다.
  recalcInitial(): void;
  // 부모 컨테이너의 스크롤 상태를 반환.
  getParentScrollState(): ScrollState;
  // 드래그 시작 이후 부모가 스크롤된 양(보정값)을 반환.
  getParentScrollShift(): CoordinateShift;

  // 이 엔티티가 속한 스코프(드래그 컨텍스트)의 ID.
  scopeId: string;
  // 이 엔티티 고유의 ID.
  entityId: string;
  // 드래그 시작 시점에 기록해 둔 최초 Hitbox(위치가 변해도 기준점으로 남겨둔 값).
  initial: Hitbox;
}

// preact 컴포넌트가 자식(children) prop을 받을 수 있음을 표시하는 공통 인터페이스.
// 다른 인터페이스들이 `extends WithChildren`으로 섞어 쓰기(mixin) 위한 용도.
export interface WithChildren {
  children?: ComponentChildren;
}

// ScrollState의 초기값(스크롤 안 된 상태). 여러 곳에서 기본값으로 재사용된다.
export const initialScrollState: ScrollState = {
  x: 0,
  y: 0,
  maxX: 0,
  maxY: 0,
};

// CoordinateShift의 초기값(이동량 없음, 즉 원점).
export const initialScrollShift: CoordinateShift = {
  x: 0,
  y: 0,
};
