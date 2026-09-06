/**
 * ============================================================================
 * [실행 순서 #7] MetadataSettings.tsx — 연결된 노트의 frontmatter 키를 카드 메타데이터로 표시하도록 설정하는 UI
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화 / 실행-상호작용
 * 이 파일은 칸반 설정 화면(#5 Settings.ts의 SettingsModal)에서 "카드에 연결된 노트의 어떤
 * frontmatter 속성을 표시할지"를 사용자가 목록 형태로 추가/삭제/수정/재정렬할 수 있게 해주는
 * Preact 컴포넌트를 정의한다. 각 항목은 metadataKey(frontmatter 키), label(표시 라벨),
 * shouldHideLabel(라벨 숨김 여부), containsMarkdown(마크다운 렌더링 여부) 값을 가진다.
 * 목록의 드래그 앤 드롭 재정렬은 이 플러그인 자체 DnD 프레임워크(src/dnd)를 사용하며,
 * 상태 갱신은 immutability-helper(update)를 통해 불변(immutable) 방식으로 수행한다.
 * 이 컴포넌트는 순수 React/Preact 트리 밖(Obsidian Setting 탭의 일반 DOM)에 render()로
 * 수동 마운트/언마운트되는 "포털 스타일" 컴포넌트라는 점이 특징이다.
 * ============================================================================
 */
import update from 'immutability-helper';
import { JSX, createPortal, render, unmountComponentAtNode } from 'preact/compat';
import { Dispatch, StateUpdater, useContext, useEffect, useRef, useState } from 'preact/hooks';

import { Icon } from '../components/Icon/Icon';
import { c, generateInstanceId, noop, useIMEInputProps } from '../components/helpers';
import { DataTypes, MetadataSetting, MetadataSettingTemplate } from '../components/types';
import { DndContext } from '../dnd/components/DndContext';
import { DragOverlay } from '../dnd/components/DragOverlay';
import { Droppable } from '../dnd/components/Droppable';
import { DndScope } from '../dnd/components/Scope';
import { SortPlaceholder } from '../dnd/components/SortPlaceholder';
import { Sortable } from '../dnd/components/Sortable';
import { DndManagerContext } from '../dnd/components/context';
import { useDragHandle } from '../dnd/managers/DragManager';
import { Entity } from '../dnd/types';
import { getParentBodyElement, getParentWindow } from '../dnd/util/getWindow';
import { t } from '../lang/helpers';

// Item(행) 컴포넌트가 받는 props 타입.
// itemIndex: 현재 목록에서의 인덱스(드래그 시 위치 계산에 사용)
// isStatic: true이면 드래그 불가능한 "정적" 렌더링(예: 드래그 오버레이 미리보기용)
// item: 이 행이 표현하는 메타데이터 설정 데이터
// 나머지는 각 필드를 변경/삭제하기 위한 콜백 함수들(이미 인덱스가 바인딩된 형태로 전달됨)
interface ItemProps {
  itemIndex: number;
  isStatic?: boolean;
  item: MetadataSetting;
  deleteKey: () => void;
  toggleShouldHideLabel: () => void;
  toggleContainsMarkdown: () => void;
  updateKey: (value: string) => void;
  updateLabel: (value: string) => void;
}

// 목록의 한 행(하나의 frontmatter 키 설정)을 렌더링하는 컴포넌트.
// "Metadata key" / "Display label" 입력창과 "Hide label" / "Field contains markdown" 체크박스,
// 그리고 삭제 버튼 + 드래그 핸들을 포함한다.
function Item({
  isStatic,
  itemIndex,
  item,
  toggleShouldHideLabel,
  toggleContainsMarkdown,
  deleteKey,
  updateKey,
  updateLabel,
}: ItemProps) {
  // elementRef: 실제로 화면에 보이는 카드 DOM(드롭 대상 히트박스 측정용)
  // measureRef: 바깥쪽 래퍼 DOM(드래그 중 크기/위치를 측정하는 기준, 드래그 핸들 바인딩에도 사용)
  // dragHandleRef: 드래그를 시작하는 손잡이(grip) 아이콘 DOM
  const elementRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // useDragHandle: measureRef(드래그될 요소)와 dragHandleRef(포인터 이벤트를 받을 손잡이)를 연결해,
  // 손잡이를 누르고 드래그하면 measureRef가 통째로 움직이도록 만들어주는 커스텀 훅.
  // 반환값 bindHandle은 손잡이 DOM에 ref로 꽂아서 pointerdown 리스너를 등록하는 콜백 ref이다.
  const bindHandle = useDragHandle(measureRef, dragHandleRef);

  // 실제 입력 UI 본체. isStatic 여부와 상관없이 동일한 내용을 렌더링하고,
  // 아래에서 Droppable로 감쌀지 여부만 분기한다(중복 코드 방지를 위해 변수로 미리 만들어 둠).
  const body = (
    <div className={c('setting-controls-wrapper')}>
      <div className={c('setting-input-wrapper')}>
        <div>
          <div className={c('setting-item-label')}>{t('Metadata key')}</div>
          {/* frontmatter 키 이름 입력. onChange 시 상위에서 받은 updateKey 콜백으로 값을 전달 */}
          <input
            type="text"
            value={item.data.metadataKey}
            onChange={(e) => updateKey((e.target as HTMLInputElement).value)}
          />
        </div>
        <div>
          <div className={c('setting-item-label')}>{t('Display label')}</div>
          {/* 카드에 표시할 라벨 텍스트 입력 */}
          <input
            type="text"
            value={item.data.label}
            onChange={(e) => updateLabel((e.target as HTMLInputElement).value)}
          />
        </div>
      </div>
      <div className={c('setting-toggle-wrapper')}>
        <div>
          {/* 커스텀 체크박스: 실제 <input type="checkbox">가 아니라 클릭 이벤트로 토글하는 div.
              is-enabled 클래스 유무로 체크 상태를 시각적으로 표현한다. */}
          <div
            className={`checkbox-container ${item.data.shouldHideLabel ? 'is-enabled' : ''}`}
            onClick={toggleShouldHideLabel}
            aria-label={t('Hide label')}
          />
          <div className={c('setting-item-label')}>{t('Hide label')}</div>
        </div>
        <div>
          <div
            className={`checkbox-container ${item.data.containsMarkdown ? 'is-enabled' : ''}`}
            onClick={toggleContainsMarkdown}
            aria-label={t('Field contains markdown')}
          />
          <div className={c('setting-item-label')}>{t('Field contains markdown')}</div>
        </div>
      </div>
    </div>
  );

  return (
    // measureRef가 달린 바깥 래퍼: 이 요소의 크기가 드래그 애니메이션(플레이스홀더 크기 등) 계산의 기준이 된다.
    <div ref={measureRef} className={c('setting-item-wrapper')}>
      <div ref={elementRef} className={c('setting-item')}>
        {isStatic ? (
          // isStatic이면 드래그 오버레이용 "고정된" 미리보기이므로 Droppable로 감싸지 않는다
          // (실제 드롭 대상이 되어서는 안 되기 때문).
          body
        ) : (
          // 일반 목록 항목: Droppable로 감싸서 드래그 앤 드롭 시스템에 "이 영역은 드롭 가능하며,
          // 이 데이터(item)와 인덱스(itemIndex)를 가진 항목"이라고 등록한다.
          <Droppable
            elementRef={elementRef}
            measureRef={measureRef}
            id={item.id}
            index={itemIndex}
            data={item}
          >
            {body}
          </Droppable>
        )}
        <div className={c('setting-button-wrapper')}>
          {/* 삭제(휴지통) 버튼: 클릭 시 이 행을 목록에서 제거 */}
          <div className="clickable-icon" onClick={deleteKey} aria-label={t('Delete')}>
            <Icon name="lucide-trash-2" />
          </div>
          {/* 드래그 핸들: 이 아이콘을 눌러야만 드래그가 시작된다(행 전체가 아니라 손잡이만 반응) */}
          <div
            className="mobile-option-setting-drag-icon clickable-icon"
            aria-label={t('Drag to rearrange')}
            ref={bindHandle}
          >
            <Icon name="lucide-grip-horizontal" />
          </div>
        </div>
      </div>
    </div>
  );
}

// 최상위 MetadataSettings 컴포넌트가 받는 props.
// dataKeys: 초기 메타데이터 설정 배열(플러그인 설정에 저장된 값)
// scrollEl: 이 UI가 담긴 스크롤 컨테이너(스크롤 시 드래그 히트박스를 재계산하기 위해 필요)
// onChange: 목록이 바뀔 때마다 호출되어 실제 플러그인 설정에 값을 반영하는 콜백
// portalContainer: DragOverlay를 렌더링할 포털 대상(보통 문서의 body 요소)
interface MetadataSettingsProps {
  dataKeys: MetadataSetting[];
  scrollEl: HTMLElement;
  onChange(keys: MetadataSetting[]): void;
  portalContainer: HTMLElement;
}

// useKeyModifiers 훅에 전달되는 파라미터 타입
interface UseKeyModifiersParams {
  onChange(keys: MetadataSetting[]): void;
  inputValue: string;
  keys: MetadataSetting[];
  setKeys: Dispatch<StateUpdater<MetadataSetting[]>>;
  win: Window;
}

// 목록(keys)에 대한 모든 변경 로직(추가/삭제/수정/재정렬)을 한 곳에 모아주는 커스텀 훅.
// 이 훅은 JSX를 반환하지 않고, "인덱스를 받아 변경 함수를 돌려주는 함수들"의 묶음을 반환한다.
// 즉 updateKey(i) => (value) => {...} 형태의 커링(currying) 패턴을 사용해서,
// Item 컴포넌트마다 자신의 인덱스가 이미 바인딩된 콜백을 props로 내려줄 수 있게 한다.
function useKeyModifiers({ onChange, inputValue, keys, setKeys }: UseKeyModifiersParams) {
  // 새 배열을 계산한 뒤 (1) 상위 컴포넌트/플러그인 설정에 알리고 (2) 로컬 상태도 갱신하는
  // 공통 헬퍼. 모든 변경 함수는 반드시 이 함수를 통해서만 상태를 바꾼다.
  const updateKeys = (keys: MetadataSetting[]) => {
    onChange(keys);
    setKeys(keys);
  };

  return {
    // 특정 인덱스(i)의 metadataKey 값을 새 값(value)으로 교체.
    // immutability-helper의 update(keys, spec) 문법:
    //   { [i]: { data: { metadataKey: { $set: value } } } }
    // 는 "keys 배열의 i번째 원소.data.metadataKey를 value로 교체한 새 배열"을 만들어낸다.
    // 원본 keys 배열과 그 안의 다른 원소들은 그대로 재사용(참조 유지)되고, 변경된 경로만
    // 새로운 객체로 복제되므로 얕은 비교(reference equality) 기반 리렌더 최적화에 유리하다.
    updateKey: (i: number) => (value: string) => {
      updateKeys(
        update(keys, {
          [i]: {
            data: {
              metadataKey: {
                $set: value,
              },
            },
          },
        })
      );
    },

    // 특정 인덱스의 label(표시 라벨) 값을 교체. updateKey와 동일한 패턴.
    updateLabel: (i: number) => (value: string) => {
      updateKeys(
        update(keys, {
          [i]: {
            data: {
              label: {
                $set: value,
              },
            },
          },
        })
      );
    },

    // shouldHideLabel 불리언 값을 반전(toggle)시킨다.
    // $toggle: ['shouldHideLabel']은 immutability-helper 전용 커맨드로,
    // 지정한 키(들)의 boolean 값을 true/false로 뒤집어주는 축약 문법이다.
    toggleShouldHideLabel: (i: number) => () => {
      updateKeys(
        update(keys, {
          [i]: {
            data: {
              $toggle: ['shouldHideLabel'],
            },
          },
        })
      );
    },

    // containsMarkdown 불리언 값을 반전. 위와 동일한 $toggle 패턴.
    toggleContainsMarkdown: (i: number) => () => {
      updateKeys(
        update(keys, {
          [i]: {
            data: {
              $toggle: ['containsMarkdown'],
            },
          },
        })
      );
    },

    // 인덱스 i의 항목을 배열에서 제거.
    // $splice: [[i, 1]]는 Array.prototype.splice(i, 1)을 불변 방식으로 적용하는 문법
    // (i번째 위치부터 1개 원소를 삭제).
    deleteKey: (i: number) => () => {
      updateKeys(
        update(keys, {
          $splice: [[i, 1]],
        })
      );
    },

    // "Add key" 버튼(또는 입력창에서 Enter)을 눌렀을 때 새 항목을 목록 끝에 추가한다.
    // $push: [...] 는 배열 끝에 새 원소를 불변 방식으로 추가하는 문법(Array.push와 동일한 효과).
    // 새 항목은 템플릿(MetadataSettingTemplate: accepts/type/children 등 DnD에 필요한 메타데이터)에
    // 고유 id(generateInstanceId)와 실제 데이터를 합쳐서 만든다.
    // metadataKey는 현재 입력창에 타이핑된 inputValue를 그대로 사용하고,
    // label/shouldHideLabel/containsMarkdown은 빈 값/기본값으로 초기화한다.
    newKey: () => {
      updateKeys(
        update(keys, {
          $push: [
            {
              ...MetadataSettingTemplate,
              id: generateInstanceId(),
              data: {
                metadataKey: inputValue,
                label: '',
                shouldHideLabel: false,
                containsMarkdown: false,
              },
            },
          ],
        })
      );
    },

    // 드래그 앤 드롭으로 순서를 바꿀 때 호출되는 함수.
    // drag: 사용자가 집어 든(드래그 시작한) 엔티티, drop: 그 위에 놓인(드롭 대상) 엔티티.
    // 각 엔티티의 getPath()는 DnD 트리 구조 안에서의 위치 경로(number[])를 반환하는데,
    // 이 목록은 평면(1단계) 구조이므로 경로의 마지막 값이 곧 배열 인덱스가 된다.
    moveKey: (drag: Entity, drop: Entity) => {
      const dragPath = drag.getPath();
      const dropPath = drop.getPath();

      const dragIndex = dragPath[dragPath.length - 1];
      const dropIndex = dropPath[dropPath.length - 1];

      // 같은 위치에 놓였다면(자기 자신 위에 드롭) 아무 것도 하지 않는다.
      if (dragIndex === dropIndex) {
        return;
      }

      // immutability-helper 대신 일반 배열 복사(slice)로 처리:
      // 1) 얕은 복사본을 만들고 2) dragIndex 위치의 원소를 잘라낸 뒤(splice로 제거하며 획득)
      // 3) dropIndex 위치에 다시 끼워 넣는다. 결과적으로 순서만 바뀐 새 배열이 만들어진다.
      const clone = keys.slice();
      const [removed] = clone.splice(dragIndex, 1);
      clone.splice(dropIndex, 0, removed);

      updateKeys(clone);
    },
  };
}

// 이 목록의 드롭 영역이 허용하는 데이터 타입. Sortable/SortPlaceholder/Droppable이
// 이 값을 참조해 "이 타입의 항목만 여기 드롭될 수 있다"고 판단한다.
const accepts = [DataTypes.MetadataSetting];

// 드래그 중 화면 위에 떠다니는 미리보기(오버레이)에 필요한 props
interface OverlayProps {
  keys: MetadataSetting[];
  portalContainer: HTMLElement;
}

// 드래그 중일 때 마우스/터치를 따라다니는 "미리보기 카드"를 렌더링하는 컴포넌트.
// createPortal을 사용해 실제 DOM 트리 상으로는 portalContainer(보통 document.body) 아래에
// 렌더링되므로, 부모의 overflow/스크롤 등에 의해 가려지지 않고 항상 최상단에 그려질 수 있다.
function Overlay({ keys, portalContainer }: OverlayProps) {
  return createPortal(
    // DragOverlay는 현재 드래그 중인 엔티티(entity)와 그에 맞는 인라인 style(위치/크기)을
    // render-prop 패턴((entity, styles) => JSX)으로 전달해준다.
    <DragOverlay>
      {(entity, styles) => {
        const path = entity.getPath();
        const index = path[0];
        const item = keys[index];

        return (
          <div className={c('drag-container')} style={styles}>
            {/* 오버레이에서는 실제 상태를 바꿀 필요가 없으므로 모든 변경 콜백에 noop(아무 동작 없음)을
                전달하고, isStatic=true로 지정해 Droppable로 감싸지 않도록 한다. */}
            <Item
              item={item}
              itemIndex={index}
              updateKey={noop}
              updateLabel={noop}
              toggleShouldHideLabel={noop}
              toggleContainsMarkdown={noop}
              deleteKey={noop}
              isStatic={true}
            />
          </div>
        );
      }}
    </DragOverlay>,
    portalContainer
  );
}

// 이 설정 UI가 들어있는 스크롤 컨테이너의 스크롤 이벤트를 감지해,
// 스크롤이 멈추면(디바운스) 모든 드롭 가능 엔티티의 히트박스(위치/크기 정보)를 다시 계산하는 컴포넌트.
// 스크롤로 인해 각 항목의 화면상 좌표가 바뀌므로, 드래그 판정이 어긋나지 않도록 주기적으로 갱신이 필요하다.
// 화면에 아무것도 그리지 않는 "효과만을 위한" 컴포넌트(return null)이다.
function RespondToScroll({ scrollEl }: { scrollEl: HTMLElement }): JSX.Element {
  const dndManager = useContext(DndManagerContext);

  useEffect(() => {
    // 스크롤 이벤트마다 매번 재계산하면 비용이 크므로, 100ms 동안 추가 스크롤이 없을 때만
    // 실제 재계산을 수행하는 디바운스(debounce) 패턴을 사용한다.
    let debounce = 0;

    const onScroll = () => {
      scrollEl.win.clearTimeout(debounce);
      debounce = scrollEl.win.setTimeout(() => {
        dndManager.hitboxEntities.forEach((entity) => {
          entity.recalcInitial();
        });
      }, 100);
    };

    // passive: true로 등록해 스크롤 성능에 영향을 주지 않도록 하고,
    // capture: false로 버블링 단계에서만 처리한다.
    scrollEl.addEventListener('scroll', onScroll, {
      passive: true,
      capture: false,
    });

    // effect 클린업: 컴포넌트가 사라지거나 의존성이 바뀔 때 리스너를 반드시 제거해 메모리 누수를 막는다.
    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
    };
  }, [scrollEl, dndManager]);

  return null;
}

// 이 파일의 최상위 컴포넌트. 메타데이터 키 목록 전체(입력창 + 드래그 가능한 행 목록 + 추가 버튼)를 구성한다.
function MetadataSettings(props: MetadataSettingsProps) {
  // keys: 현재 목록의 로컬 상태(useState). props.dataKeys를 초기값으로 사용하고,
  // 이후에는 useKeyModifiers를 통해서만 갱신된다(props가 바뀌어도 자동으로 재동기화되지는 않음에 유의).
  const [keys, setKeys] = useState(props.dataKeys);
  // inputValue: 하단 "새 키 추가" 입력창의 현재 값
  const [inputValue, setInputValue] = useState('');
  // 한글/일본어 등 IME(조합) 입력 중에는 Enter 키가 "글자 조합 확정"에 사용되므로,
  // 조합 중에는 Enter를 "새 항목 추가"로 오인해 처리하지 않도록 조합 상태를 추적하는 훅.
  const { getShouldIMEBlockAction, ...inputProps } = useIMEInputProps();
  // scrollEl이 속한 실제 브라우저 Window 객체를 구한다(팝아웃 창 등 다중 윈도우 지원을 위함).
  const win = getParentWindow(props.scrollEl);

  // 위에서 정의한 커스텀 훅으로부터 각 변경 동작 함수들을 받아온다.
  const {
    updateKey,
    updateLabel,
    toggleShouldHideLabel,
    toggleContainsMarkdown,
    deleteKey,
    newKey,
    moveKey,
  } = useKeyModifiers({
    onChange: props.onChange,
    inputValue,
    keys,
    setKeys,
    win,
  });

  return (
    <>
      {/* DndContext: 이 하위 트리 전체에 대해 하나의 DragManager 인스턴스를 제공하는 컨텍스트.
          onDrop 콜백(moveKey)이 실제 순서 변경 로직을 담당한다. */}
      <DndContext win={win} onDrop={moveKey}>
        <RespondToScroll scrollEl={props.scrollEl} />
        {/* DndScope: 히트박스/스크롤 엔티티 등록을 위한 스코프 경계를 제공 */}
        <DndScope>
          {/* Sortable: 자식들을 세로(axis="vertical")로 정렬 가능한 목록으로 만들어주는 래퍼.
              내부적으로 드래그 중 다른 항목들의 위치를 밀어내는 애니메이션 등을 처리한다. */}
          <Sortable axis="vertical">
            {keys.map((k, i) => {
              return (
                <Item
                  key={k.id}
                  item={k}
                  itemIndex={i}
                  // 아래 각 콜백은 커링된 함수(updateKey(i) 등)를 호출해 "인덱스 i가 이미
                  // 고정된" 최종 콜백을 만들어 Item에 전달한다.
                  updateKey={updateKey(i)}
                  updateLabel={updateLabel(i)}
                  toggleShouldHideLabel={toggleShouldHideLabel(i)}
                  toggleContainsMarkdown={toggleContainsMarkdown(i)}
                  deleteKey={deleteKey(i)}
                />
              );
            })}
            {/* SortPlaceholder: 목록 맨 끝(index=keys.length)에 위치한 빈 드롭 영역.
                항목을 맨 뒤로 드래그해 놓을 수 있도록 해준다. */}
            <SortPlaceholder accepts={accepts} index={keys.length} />
          </Sortable>
        </DndScope>
        {/* 드래그 중 미리보기를 그리는 오버레이(포털) */}
        <Overlay keys={keys} portalContainer={props.portalContainer} />
      </DndContext>
      <div className={c('setting-key-input-wrapper')}>
        {/* 새 메타데이터 키를 입력하는 텍스트 필드 */}
        <input
          placeholder={t('Metadata key')}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            // IME 조합 중이면(예: 한글 입력 중 Enter로 조합을 확정하는 상황) 아래 로직을 건너뛴다.
            if (getShouldIMEBlockAction()) return;

            // Enter: 새 키를 추가하고 입력창을 비운다.
            if (e.key === 'Enter') {
              newKey();
              setInputValue('');
              return;
            }

            // Escape: 입력을 취소(비우고 포커스 해제)한다.
            if (e.key === 'Escape') {
              setInputValue('');
              (e.target as HTMLInputElement).blur();
            }
          }}
          {...inputProps}
        />
        {/* "Add key" 버튼: Enter를 누르는 것과 동일하게 새 키를 추가한다 */}
        <button
          onClick={() => {
            newKey();
            setInputValue('');
          }}
        >
          {t('Add key')}
        </button>
      </div>
    </>
  );
}

// Obsidian 설정 탭(일반 DOM 기반)에서 이 Preact 컴포넌트를 특정 컨테이너 엘리먼트에 마운트하는
// 진입점 함수. Settings.ts의 SettingsModal이 렌더링 시점에 이 함수를 호출한다.
// containerEl: 컴포넌트를 그릴 대상 DOM 노드
// scrollEl: 스크롤 이벤트를 감지할 상위 스크롤 컨테이너
// keys: 초기 메타데이터 설정 배열
// onChange: 값이 바뀔 때마다 실제 플러그인 설정 객체에 반영하는 콜백
export function renderMetadataSettings(
  containerEl: HTMLElement,
  scrollEl: HTMLElement,
  keys: MetadataSetting[],
  onChange: (key: MetadataSetting[]) => void
) {
  render(
    <MetadataSettings
      dataKeys={keys}
      scrollEl={scrollEl}
      onChange={onChange}
      // getParentBodyElement: containerEl이 속한 문서(팝아웃 창 포함)의 <body> 요소를 찾아
      // DragOverlay 포털의 대상으로 사용한다.
      portalContainer={getParentBodyElement(containerEl)}
    />,
    containerEl
  );
}

// 설정 탭이 닫히거나 다시 그려질 때 이 컴포넌트를 정리(언마운트)하기 위한 함수.
// render()로 수동 마운트했으므로, 반드시 짝을 맞춰 명시적으로 unmount 해주어야 메모리 누수와
// 중복 렌더링을 방지할 수 있다.
export function cleanupMetadataSettings(containerEl: HTMLElement) {
  unmountComponentAtNode(containerEl);
}
