/**
 * ============================================================================
 * [실행 순서 #9] TagSortSettings.tsx — 태그 정렬 우선순위를 지정하는 UI
 * ----------------------------------------------------------------------------
 * 단계: 실행-초기화 / 실행-상호작용
 * 이 파일은 칸반 설정 화면(#5 Settings.ts의 SettingsModal)에서 "카드에 붙은 태그들을
 * 어떤 순서로 정렬해서 보여줄지"를 사용자가 명시적으로 지정할 수 있게 해주는 Preact
 * 컴포넌트를 정의한다. 사용자가 등록한 순서대로 목록의 위에서 아래로 태그 우선순위가
 * 매겨지며(먼저 나올수록 높은 우선순위), 이 목록 자체를 드래그 앤 드롭으로 재정렬할 수 있다.
 * 구조와 동작 방식은 #7 MetadataSettings.tsx와 거의 동일한 패턴(같은 DnD 프레임워크,
 * immutability-helper를 이용한 불변 상태 갱신, render()로 수동 마운트되는 포털 컴포넌트)을
 * 따르며, 각 항목이 여러 필드가 아닌 태그 문자열 하나만 가진다는 점이 차이다.
 * ============================================================================
 */
import classcat from 'classcat';
import update from 'immutability-helper';
import { JSX, createPortal, render, unmountComponentAtNode } from 'preact/compat';
import { Dispatch, StateUpdater, useContext, useEffect, useRef, useState } from 'preact/hooks';

import { Icon } from '../components/Icon/Icon';
import { c, generateInstanceId, noop, useIMEInputProps } from '../components/helpers';
import { DataTypes, TagSortSetting, TagSortSettingTemplate } from '../components/types';
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

// 목록의 한 행(Item)이 받는 props.
// tagIndex: 현재 배열에서의 위치(드래그 시 위치 계산용)
// isStatic: true면 드래그 불가능한 정적 렌더링(드래그 오버레이 미리보기용)
// tag: 이 행이 표현하는 태그 정렬 설정 데이터(문자열 하나만 담고 있음)
// deleteTag/updateTag: 이 행을 삭제/수정하기 위한 콜백(인덱스가 이미 바인딩된 형태)
interface ItemProps {
  tagIndex: number;
  isStatic?: boolean;
  tag: TagSortSetting;
  deleteTag: () => void;
  updateTag: (value: string) => void;
}

// 최상위 TagSettings 컴포넌트의 props.
// tags: 초기 태그 정렬 설정 배열(저장된 설정값)
// scrollEl: 이 UI가 담긴 스크롤 컨테이너(드래그 히트박스 재계산에 필요)
// onChange: 목록이 바뀔 때마다 실제 플러그인 설정에 반영하는 콜백
// portalContainer: 드래그 오버레이를 렌더링할 포털 대상(보통 document.body)
interface TagSortSettingsProps {
  tags: TagSortSetting[];
  scrollEl: HTMLElement;
  onChange(tags: TagSortSetting[]): void;
  portalContainer: HTMLElement;
}

// useKeyModifiers 훅에 전달되는 파라미터 타입.
// (이름은 "Key"지만 실제로는 태그 배열을 다룬다 — MetadataSettings.tsx와 이름 규칙을 맞춘 것)
interface UseKeyModifiersParams {
  onChange(tags: TagSortSetting[]): void;
  inputValue: string;
  tags: TagSortSetting[];
  setTags: Dispatch<StateUpdater<TagSortSetting[]>>;
  win: Window;
}

// 목록의 한 행을 렌더링하는 컴포넌트. 태그 하나를 입력하는 텍스트 필드와
// 삭제 버튼 + 드래그 핸들만 가진다(메타데이터 설정보다 단순한 구조).
function Item({ isStatic, tagIndex, tag, deleteTag, updateTag }: ItemProps) {
  // elementRef: 실제 화면에 보이는 카드 DOM(드롭 히트박스 측정 대상)
  // measureRef: 바깥 래퍼 DOM(드래그 중 크기 측정 기준이자 드래그 핸들이 움직일 대상)
  // dragHandleRef: 드래그를 시작시키는 손잡이(grip) 아이콘 DOM
  const elementRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // measureRef(드래그될 대상)와 dragHandleRef(포인터 이벤트를 받는 손잡이)를 연결하는 훅.
  // 반환된 콜백을 손잡이 DOM의 ref로 지정하면, 손잡이를 누른 채 드래그할 때 measureRef 전체가
  // 함께 움직이도록 DragManager에 등록된다.
  const bindHandle = useDragHandle(measureRef, dragHandleRef);

  // 태그 문자열 입력 UI 본체. isStatic 여부에 따라 Droppable로 감쌀지만 달라지므로
  // 공통 부분을 변수로 미리 만들어 재사용한다.
  const body = (
    <div className={c('setting-controls-wrapper')}>
      <div className={c('setting-input-wrapper')}>
        <div>
          {/* 정렬 우선순위를 부여할 태그 문자열(예: "#urgent") 입력 필드 */}
          <input
            type="text"
            value={tag.data.tag}
            onChange={(e) => updateTag((e.target as HTMLInputElement).value)}
          />
        </div>
      </div>
    </div>
  );

  return (
    // measureRef가 달린 바깥 래퍼: 드래그 애니메이션/플레이스홀더 크기 계산의 기준 요소
    <div ref={measureRef} className={c('setting-item-wrapper')}>
      <div ref={elementRef} className={c('setting-item')}>
        {isStatic ? (
          // 드래그 오버레이 미리보기(isStatic=true)에서는 실제 드롭 대상이 되면 안 되므로
          // Droppable로 감싸지 않고 body를 그대로 사용한다.
          body
        ) : (
          // 일반 목록 항목: Droppable로 감싸 "이 위치(index)에 이 데이터(tag)를 가진
          // 드롭 가능 영역"으로 DnD 시스템에 등록한다.
          <Droppable
            elementRef={elementRef}
            measureRef={measureRef}
            id={tag.id}
            index={tagIndex}
            data={tag}
          >
            {body}
          </Droppable>
        )}
        <div className={c('setting-button-wrapper')}>
          {/* 삭제 버튼: 이 태그 항목을 목록에서 제거 */}
          <div className="clickable-icon" onClick={deleteTag} aria-label={t('Delete')}>
            <Icon name="lucide-trash-2" />
          </div>
          {/* 드래그 핸들 아이콘: 이 부분을 눌러야만 드래그가 시작된다 */}
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

// 태그 목록(tags)에 대한 추가/삭제/수정/재정렬 로직을 모아 놓은 커스텀 훅.
// MetadataSettings.tsx의 useKeyModifiers와 동일한 커링(currying) 패턴을 사용한다:
// 즉 updateTag(i) => (value) => {...} 형태로, 인덱스를 먼저 받아 그 인덱스에 특화된
// 콜백 함수를 반환한다.
function useKeyModifiers({ onChange, inputValue, tags, setTags }: UseKeyModifiersParams) {
  // 새 배열을 계산한 뒤 상위(onChange, 실제 설정 저장)와 로컬 상태(setTags)를 함께 갱신하는
  // 공통 헬퍼. 모든 변경은 이 함수를 거쳐야 한다.
  const updateKeys = (tags: TagSortSetting[]) => {
    onChange(tags);
    setTags(tags);
  };

  return {
    // 인덱스 i번째 태그 문자열을 새 값으로 교체.
    // immutability-helper 문법 { [i]: { data: { tag: { $set: value } } } }는
    // "배열의 i번째 원소.data.tag 필드만 value로 바꾼 새 배열"을 만들어내며,
    // 다른 원소들과 바뀌지 않은 필드는 원본 참조를 그대로 재사용한다(불변성 + 성능 이점).
    updateTag: (i: number) => (value: string) => {
      updateKeys(
        update(tags, {
          [i]: {
            data: {
              tag: {
                $set: value,
              },
            },
          },
        })
      );
    },

    // 인덱스 i번째 태그 항목을 배열에서 제거.
    // $splice: [[i, 1]]는 "i번째 위치부터 1개 원소 삭제"를 의미하는
    // immutability-helper의 Array.splice 대응 커맨드다.
    deleteTag: (i: number) => () => {
      updateKeys(
        update(tags, {
          $splice: [[i, 1]],
        })
      );
    },

    // "Add tag" 버튼(또는 입력창에서 Enter)을 눌렀을 때 새 태그를 목록 끝에 추가.
    // $push: [...] 는 배열 끝에 새 원소를 불변 방식으로 추가하는 문법.
    // 새 항목은 DnD에 필요한 공통 필드(accepts/type/children)를 담은 템플릿
    // (TagSortSettingTemplate)에 고유 id(generateInstanceId)와 현재 입력값을 합쳐서 만든다.
    newTag: () => {
      updateKeys(
        update(tags, {
          $push: [
            {
              ...TagSortSettingTemplate,
              id: generateInstanceId(),
              data: {
                tag: inputValue,
              },
            },
          ],
        })
      );
    },

    // 드래그 앤 드롭으로 태그 순서를 바꿀 때 호출되는 함수.
    // drag: 사용자가 집어 든 엔티티, drop: 그 위에 놓인 엔티티.
    // getPath()는 DnD 트리에서의 위치 경로(number[])를 반환하며, 이 목록은 평면 구조이므로
    // 경로의 마지막 값이 곧 배열 인덱스가 된다.
    moveTag: (drag: Entity, drop: Entity) => {
      const dragPath = drag.getPath();
      const dropPath = drop.getPath();

      const dragIndex = dragPath[dragPath.length - 1];
      const dropIndex = dropPath[dropPath.length - 1];

      // 같은 위치라면(자기 자신 위에 드롭) 아무 작업도 하지 않는다.
      if (dragIndex === dropIndex) {
        return;
      }

      // 일반 배열 복사(slice) + splice로 순서만 바꾸는 방식:
      // 1) 얕은 복사본 생성 2) dragIndex 위치의 원소를 잘라내고(splice로 제거하며 획득)
      // 3) dropIndex 위치에 다시 삽입. 결과는 순서만 바뀐 새 배열.
      const clone = tags.slice();
      const [removed] = clone.splice(dragIndex, 1);
      clone.splice(dropIndex, 0, removed);

      updateKeys(clone);
    },
  };
}

// 이 목록의 드롭 영역이 허용하는 데이터 타입(태그 정렬 설정만 받아들임).
// Sortable/SortPlaceholder/Droppable이 이 값을 참조해 타입이 다른 드래그 항목은 거부한다.
const accepts = [DataTypes.TagSortSetting];

// 드래그 오버레이(미리보기)에 필요한 props
interface OverlayProps {
  keys: TagSortSetting[];
  portalContainer: HTMLElement;
}

// 드래그 중 마우스/터치를 따라 움직이는 미리보기 카드를 렌더링하는 컴포넌트.
// createPortal로 실제 DOM 상으로는 portalContainer(보통 document.body) 아래에 렌더링되어,
// 부모 요소의 overflow/스크롤 클리핑에 영향받지 않고 최상단에 표시된다.
function Overlay({ keys, portalContainer }: OverlayProps) {
  return createPortal(
    // DragOverlay는 현재 드래그 중인 엔티티와 그에 맞는 위치/크기 style을
    // render-prop 패턴((entity, styles) => JSX)으로 넘겨준다.
    <DragOverlay>
      {(entity, styles) => {
        const path = entity.getPath();
        const index = path[0];
        const item = keys[index];

        return (
          <div
            // classcat: 여러 클래스 이름 배열을 공백으로 join해주는 유틸리티(조건부 클래스 없이
            // 단순 결합용으로 사용됨). 'drag-container'와 'tag-sort-input-wrapper' 클래스를 합친다.
            className={classcat([c('drag-container'), c('tag-sort-input-wrapper')])}
            style={styles}
          >
            {/* 오버레이는 상태를 변경할 필요가 없으므로 콜백에 noop을 전달하고,
                isStatic=true로 지정해 Droppable로 감싸지 않게 한다. */}
            <Item tag={item} tagIndex={index} updateTag={noop} deleteTag={noop} isStatic={true} />
          </div>
        );
      }}
    </DragOverlay>,
    portalContainer
  );
}

// 이 UI가 속한 스크롤 컨테이너의 스크롤을 감지해, 스크롤이 멈추면(디바운스 후)
// 모든 드롭 가능 엔티티의 히트박스(위치/크기)를 재계산하는 컴포넌트.
// 스크롤로 인해 각 항목의 화면 좌표가 바뀌기 때문에, 드래그 판정 정확도를 유지하려면
// 주기적인 재계산이 필요하다. 화면에는 아무것도 렌더링하지 않는다(return null).
function RespondToScroll({ scrollEl }: { scrollEl: HTMLElement }): JSX.Element | null {
  const dndManager = useContext(DndManagerContext);

  useEffect(() => {
    // 스크롤 이벤트마다 매번 재계산하면 비용이 크므로, 마지막 스크롤 후 100ms 동안
    // 추가 스크롤이 없을 때만 실제 재계산을 실행하는 디바운스 패턴.
    let debounce = 0;

    const onScroll = () => {
      scrollEl.win.clearTimeout(debounce);
      debounce = scrollEl.win.setTimeout(() => {
        dndManager?.hitboxEntities.forEach((entity) => {
          entity.recalcInitial();
        });
      }, 100);
    };

    // passive: true로 스크롤 성능에 영향을 주지 않게 등록하고, capture: false로 버블링 단계에서만 처리.
    scrollEl.addEventListener('scroll', onScroll, {
      passive: true,
      capture: false,
    });

    // 클린업: 컴포넌트가 언마운트되거나 의존성이 바뀔 때 리스너를 제거해 누수를 방지.
    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
    };
  }, [scrollEl, dndManager]);

  return null;
}

// 이 파일의 최상위 컴포넌트: 태그 정렬 순서 설정 UI 전체(제목/설명 + 드래그 가능한 태그 목록 +
// 새 태그 추가 입력창)를 구성한다.
function TagSettings(props: TagSortSettingsProps) {
  // tags: 현재 목록의 로컬 상태. props.tags를 초기값으로 사용하며, 이후에는
  // useKeyModifiers가 반환하는 함수들을 통해서만 갱신된다.
  const [tags, setTags] = useState(props.tags);
  // inputValue: 하단 "새 태그 추가" 입력창의 현재 값
  const [inputValue, setInputValue] = useState('');
  // IME(한글 등 조합형 입력) 조합 중에 Enter 키를 "항목 추가"로 잘못 처리하지 않도록
  // 조합 상태를 추적하는 훅.
  const { getShouldIMEBlockAction, ...inputProps } = useIMEInputProps();
  // scrollEl이 속한 실제 Window 객체(팝아웃 창 등 다중 윈도우 환경 지원을 위해 필요).
  const win = getParentWindow(props.scrollEl);

  // 위 커스텀 훅으로부터 각 변경 동작 함수들을 받아온다.
  const { updateTag, deleteTag, newTag, moveTag } = useKeyModifiers({
    onChange: props.onChange,
    inputValue,
    tags,
    setTags,
    win,
  });

  return (
    <div className={c('tag-sort-input-wrapper')}>
      <div className="setting-item-info">
        <div className="setting-item-name">{t('Tag sort order')}</div>
        <div className="setting-item-description">
          {t('Set an explicit sort order for the specified tags.')}
        </div>
      </div>
      <div>
        {/* DndContext: 이 하위 트리 전체에 하나의 DragManager를 제공. onDrop 콜백(moveTag)이
            실제 순서 변경(재정렬) 로직을 담당한다. */}
        <DndContext win={win} onDrop={moveTag}>
          <RespondToScroll scrollEl={props.scrollEl} />
          {/* DndScope: 히트박스/스크롤 엔티티 등록을 위한 스코프 경계 제공 */}
          <DndScope>
            {/* Sortable: 자식들을 세로 방향(axis="vertical")으로 정렬 가능한 목록으로 만드는 래퍼 */}
            <Sortable axis="vertical">
              {tags.map((k, i) => {
                return (
                  <Item
                    key={k.id}
                    tag={k}
                    tagIndex={i}
                    // 커링된 함수(updateTag(i) 등)를 호출해 인덱스가 이미 고정된 콜백을 만들어 전달
                    updateTag={updateTag(i)}
                    deleteTag={deleteTag(i)}
                  />
                );
              })}
              {/* 목록 맨 끝(index=tags.length)의 빈 드롭 영역: 항목을 맨 뒤로 드래그해 놓을 수 있게 함 */}
              <SortPlaceholder accepts={accepts} index={tags.length} />
            </Sortable>
          </DndScope>
          {/* 드래그 중 미리보기를 그리는 오버레이(포털) */}
          <Overlay keys={tags} portalContainer={props.portalContainer} />
        </DndContext>
      </div>
      <div className={c('setting-key-input-wrapper')}>
        {/* 새 태그를 입력하는 텍스트 필드 */}
        <input
          placeholder="#tag"
          type="text"
          value={inputValue}
          onChange={(e) => {
            const val = (e.target as HTMLInputElement).value;
            // 사용자가 '#' 없이 입력해도 자동으로 맨 앞에 '#'을 붙여준다(태그 표기 규칙 강제).
            setInputValue(val[0] === '#' ? val : '#' + val);
          }}
          onKeyDown={(e) => {
            // IME 조합 중이면 아래의 키 처리 로직을 건너뛴다.
            if (getShouldIMEBlockAction()) return;

            // Enter: 새 태그를 추가하고 입력창을 비운다.
            if (e.key === 'Enter') {
              newTag();
              setInputValue('');
              return;
            }

            // Escape: 입력값을 비우고 포커스를 해제한다.
            if (e.key === 'Escape') {
              setInputValue('');
              (e.target as HTMLInputElement).blur();
            }
          }}
          {...inputProps}
        />
        {/* "Add tag" 버튼: Enter 키와 동일하게 새 태그를 추가한다 */}
        <button
          onClick={() => {
            newTag();
            setInputValue('');
            return;
          }}
        >
          {t('Add tag')}
        </button>
      </div>
    </div>
  );
}

// Obsidian 설정 탭(일반 DOM 기반)의 특정 컨테이너에 이 Preact 컴포넌트를 마운트하는 진입점 함수.
// Settings.ts의 SettingsModal이 렌더링 시점에 호출한다.
// containerEl: 컴포넌트를 그릴 대상 DOM 노드
// scrollEl: 스크롤 이벤트를 감지할 상위 스크롤 컨테이너
// tags: 초기 태그 정렬 설정 배열
// onChange: 값이 바뀔 때마다 실제 플러그인 설정 객체에 반영하는 콜백
export function renderTagSortSettings(
  containerEl: HTMLElement,
  scrollEl: HTMLElement,
  tags: TagSortSetting[],
  onChange: (key: TagSortSetting[]) => void
) {
  render(
    <TagSettings
      tags={tags}
      scrollEl={scrollEl}
      onChange={onChange}
      // containerEl이 속한 문서(팝아웃 창 포함)의 <body> 요소를 찾아 DragOverlay 포털 대상으로 사용
      portalContainer={getParentBodyElement(containerEl)}
    />,
    containerEl
  );
}

// 설정 탭이 닫히거나 다시 그려질 때 이 컴포넌트를 언마운트해 정리하는 함수.
// render()로 수동 마운트했으므로 반드시 명시적으로 unmount를 호출해 주어야
// 이벤트 리스너/메모리 누수를 방지할 수 있다.
export function cleanUpTagSortSettings(containerEl: HTMLElement) {
  unmountComponentAtNode(containerEl);
}
