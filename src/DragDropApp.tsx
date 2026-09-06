/**
 * ============================================================================
 * [실행 순서 #16] DragDropApp.tsx — 창(Window)별 최상위 Preact 앱 + 전역 드롭 핸들러
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * Obsidian은 팝아웃(popout) 창을 열면 각 창마다 별도의 document/window 객체를 가지므로,
 * 드래그 앤 드롭(DnD)처럼 마우스 좌표·리스너를 전역으로 추적해야 하는 기능은 "창 하나당 하나의
 * DnD 컨텍스트"로 묶어야 정확히 동작한다. 그래서 KanbanView(칸반 탭/리프)마다 각자 렌더 트리를
 * 갖게 하는 대신, main.ts가 창마다 이 DragDropApp 하나만 마운트하고, 그 창에 열린 모든
 * KanbanView 인스턴스는 createPortal로 이 앱의 자식이 되도록 "이식(portal)"한다. 이렇게 하면
 * 같은 창 안의 여러 칸반 보드가 하나의 DndContext(마우스 이벤트, 드래그 상태)를 공유하면서도,
 * 실제 DOM 출력 위치는 각 KanbanView의 contentEl 그대로 유지된다.
 * handleDrop은 드롭이 끝났을 때 dnd 매니저가 계산한 (dragEntity, dropEntity) 결과를 실제 보드
 * 데이터 변경으로 옮기는 지점으로, 크게 3갈래로 분기한다: (1) 파일 탐색기 등에서 온 HTML5 네이티브
 * 드래그(scopeId === 'htmldnd')는 새 아이템을 생성해 insertEntity로 삽입만 하고, (2) 같은 보드
 * 안에서의 이동은 moveEntity로 한 stateManager 안에서 제거+삽입을 원자적으로 처리하며, (3) 서로
 * 다른 보드(파일) 간 이동은 source/destination 두 stateManager를 각각 setState로 갱신해 한쪽에서는
 * removeEntity, 다른 쪽에서는 insertEntity를 호출하는 방식으로 처리한다.
 * ============================================================================
 */

// classcat: 조건부로 CSS 클래스 이름들을 조합해주는 유틸리티(예: classcat(['a', {b: true}]) -> 'a b')
import classcat from 'classcat';
// immutability-helper의 update(): 불변(immutable) 객체를 "스펙(spec)" 객체로 선언적으로 갱신한다.
// 예) update(obj, { a: { $set: 1 } }) => obj.a를 1로 바꾼 "새" 객체를 반환(원본 obj는 그대로 유지).
// $set(교체), $unset(키 제거), $push/$splice(배열 조작) 등의 커맨드를 스펙 트리 형태로 중첩해서 쓴다.
import update from 'immutability-helper';
// preact/compat: React API와 호환되는 preact 계층. tsconfig에서 react -> preact/compat 별칭 처리됨.
// - JSX: TypeScript용 JSX 네임스페이스 타입
// - createPortal: 특정 서브트리를 이 컴포넌트 트리 밖의 다른 DOM 노드에 렌더링하게 해주는 함수
// - memo: props가 얕은 비교(shallow compare)로 동일하면 리렌더를 건너뛰게 해주는 고차 컴포넌트(HOC)
// - useCallback/useMemo: 의존성 배열이 바뀌지 않는 한 함수/값을 재생성하지 않고 재사용하는 훅
import { JSX, createPortal, memo, useCallback, useMemo } from 'preact/compat';

// KanbanView: Obsidian의 ItemView를 상속한 실제 칸반 탭(리프) 클래스. #15에서 정의.
import { KanbanView } from './KanbanView';
// 드래그 오버레이(드래그 중 마우스를 따라다니는 미리보기)에 쓰일 레인/아이템 프레젠테이션 컴포넌트
import { DraggableItem } from './components/Item/Item';
import { DraggableLane } from './components/Lane/Lane';
// KanbanContext: stateManager, view, boardModifiers 등을 하위 컴포넌트에 공급하는 Preact Context
import { KanbanContext } from './components/context';
// c(): BEM 스타일 클래스명에 플러그인 접두사를 붙여주는 헬퍼 / maybeCompleteForMove: 아이템이
// "완료(done)" 레인으로 이동할 때 체크박스 상태를 자동으로 맞춰주는 로직
import { c, maybeCompleteForMove } from './components/helpers';
// 보드 데이터 모델 타입들과 DataTypes(엔티티 종류를 구분하는 문자열 상수 enum 유사 객체)
import { Board, DataTypes, Item, Lane } from './components/types';
// DndContext: 자체 구현 DnD 시스템(src/dnd)의 최상위 프로바이더. 마우스 이벤트를 구독하고 드롭 시
// onDrop 콜백을 호출한다.
import { DndContext } from './dnd/components/DndContext';
// DragOverlay: 드래그 중인 엔티티를 마우스 포인터를 따라다니며 미리보기로 렌더링하는 컴포넌트
import { DragOverlay } from './dnd/components/DragOverlay';
// Entity: 드래그/드롭 가능한 대상(레인, 아이템 등)을 추상화한 dnd 시스템의 핵심 타입
// Nestable: children을 가질 수 있는 엔티티(트리 구조의 노드)를 나타내는 타입
import { Entity, Nestable } from './dnd/types';
// dnd/util/data.ts(#30)의 순수 함수들: 보드 트리에서 경로(path)로 엔티티를 찾거나(getEntityFromPath),
// 삽입(insertEntity)/이동(moveEntity)/제거(removeEntity)/갱신(updateEntity)하는 불변 연산들
import {
  getEntityFromPath,
  insertEntity,
  moveEntity,
  removeEntity,
  updateEntity,
} from './dnd/util/data';
// getBoardModifiers: 보드를 변경하는 여러 헬퍼 함수 묶음(추가/삭제/이동 등)을 만들어주는 팩토리
import { getBoardModifiers } from './helpers/boardModifiers';
// KanbanPlugin: 플러그인 본체 클래스(#1 main.ts). 여러 stateManager/view를 관리한다.
import KanbanPlugin from './main';
// frontmatterKey: 노트 프론트매터에서 칸반 보기 방식(보드/리스트 등)을 지정하는 키 이름 상수
import { frontmatterKey } from './parsers/common';
// 체크박스 텍스트(대문자 X 등)와 관련된 헬퍼: 상태 문자 조회 및 토글 로직
import {
  getTaskStatusDone,
  getTaskStatusPreDone,
  toggleTask,
} from './parsers/helpers/inlineMetadata';

// main.ts(#1)에서 창을 새로 열 때 호출하는 팩토리 함수. JSX 엘리먼트만 반환하고 실제 마운트(render)는
// 호출하는 쪽(main.ts)의 책임이다. win과 plugin을 그대로 props로 넘겨 DragDropApp을 생성한다.
export function createApp(win: Window, plugin: KanbanPlugin) {
  return <DragDropApp win={win} plugin={plugin} />;
}

// View: 개별 KanbanView 인스턴스 하나를 이 앱 트리 안으로 "이식(portal)"하는 아주 얇은 래퍼 컴포넌트.
// - createPortal(children, containerDomNode)는 JSX 트리상으로는 이 컴포넌트의 자식이지만, 실제 DOM
//   렌더링 위치는 view.contentEl(해당 KanbanView 탭의 콘텐츠 영역)이 되도록 만든다.
// - view.getPortal()은 KanbanView가 자신의 실제 보드 UI(JSX)를 반환하는 메서드(#15 참고).
// - memo로 감싼 이유: DragDropApp이 리렌더될 때(예: 다른 view의 상태 변화) views 배열의 각 view
//   객체 참조가 바뀌지 않았다면 이 컴포넌트는 리렌더를 건너뛰어, 불필요한 포탈 재계산을 막는다.
const View = memo(function View({ view }: { view: KanbanView }) {
  return createPortal(view.getPortal(), view.contentEl);
});

// DragDropApp: 창(win) 하나당 정확히 하나만 존재하는 최상위 컴포넌트.
// props로 받은 win은 이 앱이 속한 브라우저 창(팝아웃 포함), plugin은 전역 플러그인 인스턴스.
export function DragDropApp({ win, plugin }: { win: Window; plugin: KanbanPlugin }) {
  // plugin.useKanbanViews(win): 이 창(win)에 현재 열려 있는 모든 KanbanView 인스턴스 목록을
  // 구독하는 커스텀 훅. 뷰가 열리거나 닫힐 때마다 이 컴포넌트가 리렌더되어 최신 목록을 받는다.
  const views = plugin.useKanbanViews(win);
  // 뷰 목록을 각각 <View> 포탈 컴포넌트로 매핑. key={view.id}로 각 포탈의 아이덴티티를 고정해
  // Preact가 뷰 추가/삭제/순서 변경 시 기존 포탈을 올바르게 재사용/폐기하도록 한다.
  const portals: JSX.Element[] = views.map((view) => <View key={view.id} view={view} />);

  // handleDrop: 사용자가 드래그를 놓았을 때(dnd 시스템의 DragManager가 최종적으로) 호출하는 콜백.
  // dragEntity: 드래그를 시작한 대상(레인/아이템/HTML5 드롭 데이터), dropEntity: 놓인 위치의 대상.
  // useCallback으로 감싸 매 렌더마다 새 함수를 만들지 않고, 의존성(views)이 실제로 바뀔 때만
  // 새 함수를 생성한다 — DndContext에 onDrop으로 전달되므로 참조가 자주 바뀌면 하위에서 불필요한
  // 리스너 재등록/리렌더가 발생할 수 있기 때문이다.
  const handleDrop = useCallback(
    (dragEntity: Entity, dropEntity: Entity) => {
      // 드래그 시작점이나 드롭 대상이 없으면(예: 보드 바깥에 놓임) 아무 것도 하지 않는다.
      if (!dragEntity || !dropEntity) {
        return;
      }

      // ── 분기 1: HTML5 네이티브 드래그 앤 드롭 ─────────────────────────────
      // 파일 탐색기, 다른 앱, OS 파일 등 자체 dnd 시스템 밖에서 온 드래그는 scopeId가 'htmldnd'로
      // 표시된다. 이 경우 dragEntity는 실제 보드 엔티티가 아니라 "드롭된 텍스트/파일 목록" 같은
      // 원시 데이터를 담고 있으므로, 기존 엔티티를 옮기는 게 아니라 새 아이템들을 생성해 삽입한다.
      if (dragEntity.scopeId === 'htmldnd') {
        // getData(): 드래그 페이로드(제목 문자열 배열 data.content, 대상 뷰 id/윈도우 등)를 꺼낸다.
        const data = dragEntity.getData();
        // 드롭이 일어난 뷰의 stateManager(보드 상태를 관리하는 객체, #?? StateManager)를 찾는다.
        const stateManager = plugin.getStateManagerFromViewID(data.viewId, data.win);
        // 드롭 대상 엔티티의 경로(path: 트리에서 위치를 나타내는 인덱스 배열)를 가져온다.
        const dropPath = dropEntity.getPath();
        // 드롭 위치의 "부모" 엔티티를 조회한다. dropPath.slice(0, -1)로 마지막 인덱스(자기 자신
        // 위치)를 제외해 부모 경로를 얻는다. 옵셔널 체이닝(?.)으로 이후 접근 시 null 방지.
        const destinationParent = getEntityFromPath(stateManager.state, dropPath.slice(0, -1));

        try {
          // data.content: 드롭된 각 줄(제목 문자열)을 새 Item 객체로 변환한다.
          const items: Item[] = data.content.map((title: string) => {
            // 우선 공백 본문(' ')으로 새 아이템 뼈대를 생성
            let item = stateManager.getNewItem(title, ' ');
            // 목적지 부모 레인이 "완료로 표시" 설정(shouldMarkItemsComplete)을 갖고 있는지 확인.
            // destinationParent?.data?.shouldMarkItemsComplete: 옵셔널 체이닝을 두 번 연쇄해
            // destinationParent가 null이거나 data가 없어도 예외 없이 undefined로 안전하게 평가됨.
            // 앞의 !!는 undefined/null을 boolean false로 정규화하는 관용구.
            const isComplete = !!destinationParent?.data?.shouldMarkItemsComplete;

            if (isComplete) {
              // immutability-helper update() 사용 예: item.data.checkChar를 "완료 직전" 상태 문자로
              // $set(교체)한다. update(대상, 스펙) 형태이며 중첩 객체 경로를 그대로 스펙 트리로 표현.
              item = update(item, { data: { checkChar: { $set: getTaskStatusPreDone() } } });
              // toggleTask: 텍스트 상의 체크박스 문법을 실제로 "완료" 토글해 재계산한다.
              const updates = toggleTask(item, stateManager.file);
              if (updates) {
                // 배열 구조분해할당: updates가 [문자열배열, 문자열배열, 인덱스] 형태의 튜플이라고
                // 가정하고 각 요소를 의미 있는 이름으로 즉시 꺼낸다.
                const [itemStrings, checkChars, thisIndex] = updates;
                const nextItem = itemStrings[thisIndex];
                const checkChar = checkChars[thisIndex];
                // 토글 결과 텍스트로 최종 아이템을 다시 생성해 반환(map 콜백 종료)
                return stateManager.getNewItem(nextItem, checkChar);
              }
            }

            // isComplete가 아니거나 toggleTask가 갱신 결과를 안 준 경우: 체크 상태를 목적지 레인의
            // shouldMarkItemsComplete 설정에 맞춰 한 번에 설정(checked, checkChar 두 필드 동시 갱신).
            // 삼항연산자로 체크문자를 완료('getTaskStatusDone()') 또는 공백(' ')으로 결정한다.
            return update(item, {
              data: {
                checked: {
                  $set: !!destinationParent?.data?.shouldMarkItemsComplete,
                },
                checkChar: {
                  $set: destinationParent?.data?.shouldMarkItemsComplete
                    ? getTaskStatusDone()
                    : ' ',
                },
              },
            });
          });

          // stateManager.setState: 함수형 업데이트. 현재 board를 받아 새 board를 반환하는 콜백을
          // 넘기면 내부적으로 diff/리렌더를 처리한다. insertEntity(board, dropPath, items)는 dropPath
          // 위치에 items 배열을 삽입한 "새" board를 반환하는 순수 함수(원본 board는 변경하지 않음).
          return stateManager.setState((board) => insertEntity(board, dropPath, items));
        } catch (e) {
          // 아이템 생성/삽입 중 예외(예: 잘못된 형식의 텍스트)가 나면 stateManager에 에러 상태를
          // 기록해 UI에 표시하고, 콘솔에도 스택트레이스를 남긴다.
          stateManager.setError(e);
          console.error(e);
        }

        // htmldnd 분기는 여기서 종료. 아래의 "같은 보드/다른 보드" 로직은 실행되지 않는다.
        return;
      }

      // ── 이하 두 분기 공통 준비 작업: 자체 dnd 시스템 내부에서의 드래그 ───────────
      // getPath(): 트리 안에서 엔티티의 위치를 가리키는 인덱스 배열(예: [레인인덱스, 아이템인덱스])
      const dragPath = dragEntity.getPath();
      const dropPath = dropEntity.getPath();
      // getData(): 엔티티에 부착된 부가 정보(어느 창(win)에 속하는지, acceptsSort/type 등)
      const dragEntityData = dragEntity.getData();
      const dropEntityData = dropEntity.getData();
      // scopeId 형식은 "kanban:::파일경로" 같은 식으로 구성되어 있어, ':::' 구분자로 분리해
      // 두 번째 요소(파일 경로)만 꺼낸다. 배열 구조분해할당에서 첫 요소는 '_'가 아니라 그냥
      // 비워둔 자리(,)로 건너뛰고 있다.
      const [, sourceFile] = dragEntity.scopeId.split(':::');
      const [, destinationFile] = dropEntity.scopeId.split(':::');

      // 드롭 대상이 "정렬된(sorted) 목록의 빈 여백" 같은 영역이라 원래는 정렬 불가능한 타입을
      // 받아들이지 않는 경우를 감지한다. dropEntityData.acceptsSort가 존재하고, 그 안에 드래그
      // 중인 엔티티 타입이 포함되어 있지 않다면 "드롭 영역(빈 공간)에 놓인 것"으로 간주한다.
      const inDropArea =
        dropEntityData.acceptsSort && !dropEntityData.acceptsSort.includes(dragEntityData.type);

      // ── 분기 2: 같은 보드(파일) 내에서의 이동 ───────────────────────────────
      // sourceFile === destinationFile이면 드래그 시작과 도착이 같은 칸반 파일(같은 stateManager)
      // 안이므로, 하나의 setState 호출 안에서 이동을 원자적으로 처리할 수 있다.
      if (sourceFile === destinationFile) {
        // 드래그 시작 스코프(scopeId)와 창 정보로 실제 KanbanView 인스턴스를 다시 찾는다.
        const view = plugin.getKanbanView(dragEntity.scopeId, dragEntityData.win);
        const stateManager = plugin.stateManagers.get(view.file);

        // 정렬 불가 영역(빈 여백)에 놓인 경우, dropPath 끝에 인덱스 0을 추가해 "그 컨테이너의
        // 맨 앞"에 삽입되도록 경로를 보정한다. (배열의 push는 원본 dropPath를 변형하지만, 이
        // dropPath는 이번 호출 안에서만 쓰이는 로컬 변수이므로 문제가 되지 않는다.)
        if (inDropArea) {
          dropPath.push(0);
        }

        return stateManager.setState((board) => {
          // 이동시키기 전, 이동 대상 엔티티 자체(레인인지 아이템인지 판별용)를 미리 조회해둔다.
          const entity = getEntityFromPath(board, dragPath);
          // moveEntity(board, from, to, onRemove변환, onInsert변환): dnd/util/data.ts(#30)의 함수.
          // 내부적으로 dragPath 위치의 엔티티를 제거하고 dropPath 위치에 삽입한, 불변 갱신된 새
          // Board를 반환한다. 세 번째/네 번째 인자는 "제거될 때"와 "삽입될 때" 엔티티를 변형할
          // 수 있는 콜백으로, 여기서는 아이템이 "완료" 레인을 넘나들 때 체크 상태를 맞추는 데 쓰인다.
          const newBoard: Board = moveEntity(
            board,
            dragPath,
            dropPath,
            (entity) => {
              // 이동 중인 엔티티가 아이템(카드)일 때만 완료 상태 자동 보정 로직을 적용
              if (entity.type === DataTypes.Item) {
                // maybeCompleteForMove: 출발/도착 레인의 "완료 표시" 설정을 비교해 체크박스를
                // 자동으로 켜거나 끄는 두 결과(next: 제거 시점에 쓸 엔티티, replacement: 이동 후
                // 남겨둘 대체 엔티티)를 계산해준다. 여기서는 같은 보드이므로 source/destination에
                // 동일한 stateManager와 board를 두 번씩 넘긴다.
                const { next } = maybeCompleteForMove(
                  stateManager,
                  board,
                  dragPath,
                  stateManager,
                  board,
                  dropPath,
                  entity
                );
                return next;
              }
              return entity;
            },
            (entity) => {
              if (entity.type === DataTypes.Item) {
                const { replacement } = maybeCompleteForMove(
                  stateManager,
                  board,
                  dragPath,
                  stateManager,
                  board,
                  dropPath,
                  entity
                );
                return replacement;
              }
              // 아이템이 아니면(예: 레인) 대체 엔티티가 필요 없으므로 명시적으로 아무 것도
              // 반환하지 않는다(undefined).
            }
          );

          // 이동한 엔티티가 "레인(칸반의 열)" 자체라면, 레인의 접기/펼치기(collapse) 상태 배열도
          // 같은 순서로 재배치해줘야 UI가 어긋나지 않는다.
          if (entity.type === DataTypes.Lane) {
            // dragPath.last(): 경로 배열의 마지막 요소(=레인의 원래 인덱스)를 가져오는 헬퍼.
            const from = dragPath.last();
            let to = dropPath.last();

            // 같은 배열 안에서 앞쪽 인덱스(from)를 제거하고 나면 그 뒤 인덱스들은 하나씩
            // 당겨지므로, from보다 to가 크면 실제 삽입 위치는 1 작아진다.
            if (from < to) to -= 1;

            // 뷰에 저장된 'list-collapse'(각 레인의 접힘 여부 배열) 뷰 상태를 가져와,
            const collapsedState = view.getViewState('list-collapse');
            // op: 배열 복사본을 만든 뒤 splice로 (제거 후 삽입) 재배치하는 순수 변환 함수.
            // newState.splice(from, 1)[0]로 from 위치 원소를 꺼내고, 그 결과를 to 위치에 다시
            // splice로 삽입한다(전개 연산자 [...collapsedState]로 원본 배열을 복사해 불변성 유지).
            const op = (collapsedState: boolean[]) => {
              const newState = [...collapsedState];
              newState.splice(to, 0, newState.splice(from, 1)[0]);
              return newState;
            };

            // 뷰 자체의 로컬 상태(list-collapse)도 즉시 갱신
            view.setViewState('list-collapse', undefined, op);

            // 보드 데이터에도 동일한 재배치 결과를 반영한다. update<Board>(newBoard, 스펙)으로
            // board.data.settings['list-collapse'] 필드를 op(collapsedState) 계산 결과로 교체.
            // 제네릭 <Board>는 update()의 반환 타입을 Board로 명시해 타입 추론을 돕는다.
            return update<Board>(newBoard, {
              data: { settings: { 'list-collapse': { $set: op(collapsedState) } } },
            });
          }

          // 레인이 아닌 일반 이동(아이템 이동)의 경우: 목적지 컨테이너(레인)가 이전에
          // "정렬됨(sorted)" 설정을 갖고 있었다면, 사용자가 수동으로 순서를 바꿨으니 더 이상
          // 자동 정렬을 적용하면 안 되므로 그 설정을 제거해야 한다.
          const destinationParentPath = dropPath.slice(0, -1);
          const destinationParent = getEntityFromPath(board, destinationParentPath);

          // 옵셔널 체이닝으로 destinationParent가 null이어도 안전하게 검사. sorted 필드가
          // undefined가 "아니면"(즉 값이 존재하면) 제거 대상이다.
          if (destinationParent?.data?.sorted !== undefined) {
            // updateEntity: 지정 경로의 엔티티에 immutability-helper 스펙을 적용하는 헬퍼.
            // $unset: ['sorted']는 data 객체에서 sorted 키 자체를 삭제하는 커맨드.
            return updateEntity(newBoard, destinationParentPath, {
              data: {
                $unset: ['sorted'],
              },
            });
          }

          // 레인 재배치도, sorted 해제도 필요 없다면 moveEntity 결과를 그대로 최종 상태로 사용.
          return newBoard;
        });
      }

      // ── 분기 3: 서로 다른 보드(파일) 간의 이동 ─────────────────────────────
      // 여기부터는 sourceFile !== destinationFile인 경우. 출발 보드와 도착 보드가 서로 다른
      // stateManager(별도의 파일/StateManager 인스턴스)로 관리되므로, 두 stateManager를 각각
      // setState로 갱신해야 하며 그 사이에서 데이터를 "옮기는" 형태로 처리한다.
      const sourceView = plugin.getKanbanView(dragEntity.scopeId, dragEntityData.win);
      const sourceStateManager = plugin.stateManagers.get(sourceView.file);
      const destinationView = plugin.getKanbanView(dropEntity.scopeId, dropEntityData.win);
      const destinationStateManager = plugin.stateManagers.get(destinationView.file);

      // 먼저 "출발" 보드 쪽 setState를 호출한다. 이 콜백 안에서 도착 보드 쪽 setState를 중첩
      // 호출해, 이동할 엔티티를 계산해 도착 보드에 삽입한 뒤, 마지막에 출발 보드에서 제거한다.
      // (콜백 함수가 새 board를 반환해야 하는 setState의 함수형 업데이트 패턴)
      sourceStateManager.setState((sourceBoard) => {
        // 이동 대상 엔티티(아직 제거하기 전, 원본 출발 보드 기준)를 조회
        const entity = getEntityFromPath(sourceBoard, dragPath);
        // let으로 선언: 아래 destinationStateManager.setState 콜백 내부에서 값을 할당하고,
        // 이 바깥 스코프(sourceBoard 콜백)의 마지막 removeEntity 호출에서 다시 사용하기 위함
        // (클로저를 통해 중첩 콜백 사이에서 값을 전달).
        let replacementEntity: Nestable;

        destinationStateManager.setState((destinationBoard) => {
          if (inDropArea) {
            // 도착 지점이 "정렬 불가 빈 영역"이면, 도착 stateManager의 최신 state 기준으로 부모
            // 컨테이너를 다시 조회해 자식 개수(parent.children.length)나 맨 앞(0)을 계산한다.
            const parent = getEntityFromPath(destinationStateManager.state, dropPath);
            // 도착 보드 설정(new-card-insertion-method)이 'append'(기본값)인지 확인. 옵셔널
            // 체이닝 없이 || 기본값 패턴으로 설정이 없을 때도 안전하게 'append'로 폴백.
            const shouldAppend =
              (destinationStateManager.getSetting('new-card-insertion-method') || 'append') ===
              'append';

            // append 설정이면 컨테이너 맨 끝 인덱스를, 아니면 맨 앞(0)을 dropPath에 덧붙인다.
            if (shouldAppend) dropPath.push(parent.children.length);
            else dropPath.push(0);
          }

          // 도착 보드에 실제로 삽입할 엔티티 목록(대부분 1개)을 담을 배열
          const toInsert: Nestable[] = [];

          if (entity.type === DataTypes.Item) {
            // 아이템 이동일 때는 maybeCompleteForMove로 출발/도착 두 보드의 "완료 레인" 설정을
            // 비교해, 도착 보드에 삽입할 next(체크 상태가 보정된 사본)와 출발 보드에서 이 아이템
            // 자리를 대신할 replacement(보통 null이거나 원본 그대로)를 함께 계산한다. 이번에는
            // source/destination의 stateManager와 board가 서로 다르므로 각각 따로 전달한다.
            const { next, replacement } = maybeCompleteForMove(
              sourceStateManager,
              sourceBoard,
              dragPath,
              destinationStateManager,
              destinationBoard,
              dropPath,
              entity
            );
            // 바깥 스코프의 replacementEntity에 대입 — 이 값은 아래 sourceBoard 콜백이 끝나기
            // 직전, removeEntity 호출 시 "제거 후 대체할 엔티티"로 쓰인다.
            replacementEntity = replacement;
            toInsert.push(next);
          } else {
            // 레인처럼 완료 보정이 필요 없는 엔티티는 원본 그대로 삽입 목록에 넣는다.
            toInsert.push(entity);
          }

          // 이동 대상이 레인이면, 레인 접힘 상태(list-collapse)도 출발 보드의 값을 읽어와
          // 도착 보드의 배열에 끼워 넣어야 UI 일관성이 유지된다.
          if (entity.type === DataTypes.Lane) {
            const collapsedState = destinationView.getViewState('list-collapse');
            // 출발 뷰에서 "이 레인이 접혀 있었는지" 값을 가져온다 (dragPath.last() = 원래 인덱스)
            const val = sourceView.getViewState('list-collapse')[dragPath.last()];
            const op = (collapsedState: boolean[]) => {
              const newState = [...collapsedState];
              // 도착 위치(dropPath.last())에 이전 접힘 상태 값을 그대로 삽입
              newState.splice(dropPath.last(), 0, val);
              return newState;
            };

            destinationView.setViewState('list-collapse', undefined, op);

            // insertEntity(destinationBoard, dropPath, toInsert)로 엔티티를 삽입한 새 board를
            // 얻은 뒤, 그 결과에 다시 update()로 list-collapse 설정까지 한 번에 반영해 반환.
            return update<Board>(insertEntity(destinationBoard, dropPath, toInsert), {
              data: { settings: { 'list-collapse': { $set: op(collapsedState) } } },
            });
          } else {
            // 레인이 아니면(아이템) list-collapse 처리 없이 단순 삽입 결과만 반환
            return insertEntity(destinationBoard, dropPath, toInsert);
          }
        });

        // destinationStateManager.setState가 끝난 뒤(도착 보드에 삽입 완료), 이제 출발 보드에서
        // 원래 엔티티를 제거할 차례. 여기서도 레인이면 list-collapse 배열에서 해당 인덱스를 제거.
        if (entity.type === DataTypes.Lane) {
          const collapsedState = sourceView.getViewState('list-collapse');
          const op = (collapsedState: boolean[]) => {
            const newState = [...collapsedState];
            // splice(index, 1): 인덱스 위치의 원소 1개를 제거(반환값은 버림 — 여기선 사용 안 함)
            newState.splice(dragPath.last(), 1);
            return newState;
          };
          sourceView.setViewState('list-collapse', undefined, op);

          return update<Board>(removeEntity(sourceBoard, dragPath), {
            data: { settings: { 'list-collapse': { $set: op(collapsedState) } } },
          });
        } else {
          // 아이템 이동의 경우 removeEntity의 세 번째 인자로 replacementEntity를 넘겨, 제거된
          // 자리에 (필요하다면) 대체 엔티티를 채워 넣는다. maybeCompleteForMove가 계산해 위의
          // 클로저를 통해 여기까지 전달된 값이다.
          return removeEntity(sourceBoard, dragPath, replacementEntity);
        }
      });
    },
    // 의존성 배열이 [views]인 이유: handleDrop 내부에서 plugin.getKanbanView 등을 통해 "현재 열려
    // 있는 뷰 목록"을 기준으로 stateManager/view를 조회하기 때문에, views 목록이 바뀌면(뷰가
    // 추가/제거되면) 그 최신 목록을 참조하도록 콜백을 새로 만들어야 한다. plugin 자체는 컴포넌트
    // 생애주기 동안 불변 참조이므로 의존성에 넣지 않아도 안전하다.
    [views]
  );

  // 이 창에 열린 칸반 뷰가 하나도 없으면(portals.length === 0) 아무것도 렌더링하지 않는다
  // (암묵적으로 undefined 반환). 뷰가 없는데 DndContext/DragOverlay를 렌더링할 이유가 없기 때문.
  if (portals.length)
    return (
      // DndContext: 이 창(win) 전체에 대한 단일 드래그 앤 드롭 컨텍스트. onDrop={handleDrop}으로
      // 드롭이 끝났을 때 위에서 정의한 콜백이 호출되도록 연결한다.
      <DndContext win={win} onDrop={handleDrop}>
        {/* 전개 문법 {...portals}: portals가 이미 JSX.Element 배열이므로 각 원소를 개별 자식으로
            펼쳐 넣는다(배열을 그대로 자식으로 둬도 Preact가 처리하긴 하지만, 여기서는 다른 형제
            엘리먼트(DragOverlay)와 나란히 놓기 위해 전개 연산자로 펼친다). */}
        {...portals}
        <DragOverlay>
          {/* DragOverlay의 children은 렌더 프롭(render prop) 패턴: 현재 드래그 중인 entity와
              오버레이 위치/크기를 계산한 styles를 인자로 받아, 미리보기로 그릴 JSX를 반환한다. */}
          {(entity, styles) => {
            // useMemo: entity가 바뀔 때만 아래 계산(엔티티 데이터 조회, stateManager/뷰 탐색,
            // boardModifiers 생성)을 다시 수행한다. 드래그 중에는 styles(좌표)만 프레임마다
            // 바뀌고 entity 자체는 그대로인 경우가 많으므로, 이 메모이제이션으로 매 프레임마다
            // 반복되는 조회 비용을 피한다.
            const [data, context] = useMemo(() => {
              // HTML5 네이티브 드래그는 실제 보드 엔티티가 아니므로 오버레이에 표시할 데이터가
              // 없다 — data와 context를 모두 null로 반환해 아래에서 빈 <div />만 그리게 한다.
              if (entity.scopeId === 'htmldnd') {
                return [null, null];
              }

              const overlayData = entity.getData();

              // 드래그 중인 엔티티가 속한 뷰/stateManager를 찾아, 오버레이에 표시할 실제 엔티티
              // 데이터(레인 또는 아이템)와 렌더링에 필요한 컨텍스트를 함께 구성한다.
              const view = plugin.getKanbanView(entity.scopeId, overlayData.win);
              const stateManager = plugin.stateManagers.get(view.file);
              const data = getEntityFromPath(stateManager.state, entity.getPath());
              const boardModifiers = getBoardModifiers(view, stateManager);
              const filePath = view.file.path;

              // [data, context] 튜플을 반환 — 아래에서 배열 구조분해할당으로 각각 data, context
              // 라는 이름으로 받는다.
              return [
                data,
                {
                  view,
                  stateManager,
                  boardModifiers,
                  filePath,
                },
              ];
            }, [entity]);

            // 드래그 중인 엔티티가 "레인"이면 레인 전용 미리보기를 렌더링
            if (data?.type === DataTypes.Lane) {
              // 옵셔널 체이닝(context?.)으로 context가 null(htmldnd 케이스)이어도 안전하게 평가.
              // 뷰별 설정(viewSettings)이 우선이고, 없으면 stateManager 전역 설정으로 폴백(||).
              const boardView =
                context?.view.viewSettings[frontmatterKey] ||
                context?.stateManager.getSetting(frontmatterKey);
              const collapseState =
                context?.view.viewSettings['list-collapse'] ||
                context?.stateManager.getSetting('list-collapse');
              // 경로의 마지막 요소 = 이 레인의 인덱스
              const laneIndex = entity.getPath().last();

              return (
                // KanbanContext.Provider로 하위 DraggableLane에 view/stateManager 등을 공급
                <KanbanContext.Provider value={context}>
                  <div
                    className={classcat([
                      c('drag-container'),
                      {
                        // 보드 뷰가 'list'(세로 목록)가 아니면 가로 방향, 'list'면 세로 방향
                        // 클래스를 조건부로 적용 — classcat의 객체 문법: 값이 true인 키만 포함.
                        [c('horizontal')]: boardView !== 'list',
                        [c('vertical')]: boardView === 'list',
                      },
                    ])}
                    style={styles}
                  >
                    <DraggableLane
                      lane={data as Lane}
                      laneIndex={laneIndex}
                      // isStatic: 오버레이용 미리보기이므로 실제 인터랙션(재드래그 등)은 비활성화
                      isStatic={true}
                      isCollapsed={!!collapseState[laneIndex]}
                      collapseDir={boardView === 'list' ? 'vertical' : 'horizontal'}
                    />
                  </div>
                </KanbanContext.Provider>
              );
            }

            // 드래그 중인 엔티티가 "아이템(카드)"이면 아이템 전용 미리보기를 렌더링
            if (data?.type === DataTypes.Item) {
              return (
                <KanbanContext.Provider value={context}>
                  <div className={c('drag-container')} style={styles}>
                    <DraggableItem item={data as Item} itemIndex={0} isStatic={true} />
                  </div>
                </KanbanContext.Provider>
              );
            }

            // 그 외(htmldnd 등 data가 null인 경우)는 빈 div만 렌더링해 오버레이 자리는 차지하되
            // 실제 미리보기 콘텐츠는 표시하지 않는다.
            return <div />;
          }}
        </DragOverlay>
      </DndContext>
    );
}
