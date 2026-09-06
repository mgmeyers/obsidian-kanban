/**
 * ============================================================================
 * [실행 순서 #70] ItemContent.tsx — 카드 본문(마크다운 렌더링/메타데이터)을 렌더링
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * Item.tsx(#69)의 ItemInner가 사용하는 자식 컴포넌트로, 카드 제목(마크다운) 부분을
 * 실제로 그린다. editState가 "편집 중"이면 인라인 CodeMirror 에디터(MarkdownEditor)를,
 * 그렇지 않으면 렌더링된 마크다운(MarkdownRenderer)을 보여주는 전환 로직이 핵심이다.
 * 그 외에도 체크박스 토글, 태그 클릭, 날짜/시간 메타데이터 클릭 시 피커(picker)를
 * 띄우는 등 카드 본문 안에서 벌어지는 다양한 상호작용을 처리한다.
 * ============================================================================
 */
import { EditorView } from '@codemirror/view';
import { memo } from 'preact/compat';
import {
  Dispatch,
  StateUpdater,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'preact/hooks';
import { StateManager } from 'src/StateManager';
import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { Path } from 'src/dnd/types';
import { getTaskStatusDone, toggleTaskString } from 'src/parsers/helpers/inlineMetadata';

import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import {
  MarkdownClonedPreviewRenderer,
  MarkdownRenderer,
} from '../MarkdownRenderer/MarkdownRenderer';
import { KanbanContext, SearchContext } from '../context';
import { c, useGetDateColorFn, useGetTagColorFn } from '../helpers';
import { EditState, EditingState, Item, isEditing } from '../types';
import { DateAndTime, RelativeDate } from './DateAndTime';
import { InlineMetadata } from './InlineMetadata';
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
  constructMenuTimePickerOnChange,
  constructTimePicker,
} from './helpers';

// 카드의 날짜/시간 메타데이터를 클릭했을 때 여는 "피커(선택기)"를 만들어주는 훅.
// item, 그리고 선택적으로 명시적인 path(트리 경로)를 받아 onEditDate/onEditTime 핸들러를 반환한다.
export function useDatePickers(item: Item, explicitPath?: Path) {
  // KanbanContext에서 stateManager(상태 조회/변경 API)와 boardModifiers(데이터 변경 함수)를 꺼낸다.
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  // explicitPath가 주어지지 않았다면(OR 연산자의 기본값 패턴) 훅을 통해 현재 경로를 계산한다.
  const path = explicitPath || useNestedEntityPath();

  // useMemo로 감싸서 의존성(boardModifiers, path, item, stateManager)이 바뀌지 않는 한
  // 매 렌더링마다 새 함수 쌍을 만들지 않도록 한다.
  return useMemo(() => {
    // 날짜 영역 클릭 시: 클릭 좌표에 날짜 선택 팝업을 띄우고, 값이 바뀌면
    // constructMenuDatePickerOnChange가 만들어준 콜백을 통해 아이템 데이터를 갱신한다.
    const onEditDate = (e: MouseEvent) => {
      constructDatePicker(
        e.view,
        stateManager,
        { x: e.clientX, y: e.clientY },
        constructMenuDatePickerOnChange({
          stateManager,
          boardModifiers,
          item,
          hasDate: true,
          path,
        }),
        item.data.metadata.date?.toDate()
      );
    };

    // 시간 영역 클릭 시에도 동일한 방식으로 시간 선택 팝업을 띄운다.
    const onEditTime = (e: MouseEvent) => {
      constructTimePicker(
        e.view, // Preact uses real events, so this is safe
        stateManager,
        { x: e.clientX, y: e.clientY },
        constructMenuTimePickerOnChange({
          stateManager,
          boardModifiers,
          item,
          hasTime: true,
          path,
        }),
        item.data.metadata.time
      );
    };

    return {
      onEditDate,
      onEditTime,
    };
  }, [boardModifiers, path, item, stateManager]);
}

export interface ItemContentProps {
  item: Item;
  setEditState: Dispatch<StateUpdater<EditState>>; // 부모(ItemInner)의 editState를 갱신하기 위한 setter
  searchQuery?: string;
  showMetadata?: boolean; // 메타데이터(날짜/태그 등) 영역을 표시할지 여부, 기본값 true
  editState: EditState; // 현재 편집 상태(보기/편집, 편집 좌표)
  isStatic: boolean; // 정적 렌더링(드래그 미리보기 등) 여부
}

// 카드의 원문(raw markdown) 텍스트에서 checkboxIndex번째 체크박스를 찾아 체크 상태를 토글한 뒤
// 전체 텍스트를 다시 조립해서 반환하는 순수 함수.
function checkCheckbox(stateManager: StateManager, title: string, checkboxIndex: number) {
  let count = 0; // 지금까지 발견한 체크박스 개수(=발견한 체크박스의 인덱스 카운터)

  const lines = title.split(/\n\r?/g); // 줄 단위로 분리 (개행 문자 차이 대응)
  const results: string[] = [];

  lines.forEach((line) => {
    // 이미 목표 체크박스를 처리했다면, 남은 줄은 검사 없이 그대로 결과에 추가 (조기 통과 최적화)
    if (count > checkboxIndex) {
      results.push(line);
      return;
    }

    // "- [ ]", "* [x]", 인용문 안의 체크박스(">") 등의 마크다운 체크박스 패턴을 매칭
    const match = line.match(/^(\s*>)*(\s*[-+*]\s+?\[)([^\]])(\]\s+)/);

    if (match) {
      if (count === checkboxIndex) {
        // 목표로 하는 체크박스를 찾았을 때: 먼저 사용자 정의 토글 로직(toggleTaskString)을 시도
        const updates = toggleTaskString(line, stateManager.file);
        if (updates) {
          results.push(updates);
        } else {
          // 사용자 정의 토글 결과가 없으면 기본 규칙 적용:
          // 삼항 연산자 — 비어있던 체크박스( )였다면 "완료" 문자로, 이미 표시돼 있었다면 다시 공백으로 되돌림
          const check = match[3] === ' ' ? getTaskStatusDone() : ' ';
          const m1 = match[1] ?? ''; // 인용 기호(>) 부분, 없으면 빈 문자열 (nullish 병합 연산자)
          const m2 = match[2] ?? ''; // "- [" 부분
          const m4 = match[4] ?? ''; // "] " 부분
          results.push(m1 + m2 + check + m4 + line.slice(match[0].length));
        }
      } else {
        // 체크박스이긴 하지만 아직 목표 인덱스가 아니면 그대로 둔다
        results.push(line);
      }
      count++; // 체크박스를 하나 더 발견했으므로 카운트 증가
      return;
    }

    // 체크박스 패턴이 아닌 일반 줄은 그대로 결과에 추가
    results.push(line);
  });

  return results.join('\n');
}

// 카드 하단에 표시되는 태그 목록 컴포넌트
export function Tags({
  tags,
  searchQuery,
  alwaysShow,
}: {
  tags?: string[];
  searchQuery?: string;
  alwaysShow?: boolean;
}) {
  const { stateManager } = useContext(KanbanContext);
  // 태그별 사용자 지정 색상을 찾아주는 함수를 반환하는 훅
  const getTagColor = useGetTagColorFn(stateManager);
  const search = useContext(SearchContext);
  // 설정값(move-tags)이 켜져 있거나 alwaysShow가 true면 태그를 표시 (OR 단축평가)
  const shouldShow = stateManager.useSetting('move-tags') || alwaysShow;

  // 가드 절: 태그가 없거나 표시하지 않기로 했다면 아무것도 렌더링하지 않음
  if (!tags.length || !shouldShow) return null;

  return (
    <div className={c('item-tags')}>
      {tags.map((tag, i) => {
        const tagColor = getTagColor(tag);

        return (
          <a
            href={tag}
            onClick={(e) => {
              e.preventDefault(); // 실제 링크 이동(#tag로 스크롤 등)은 막고 아래의 커스텀 동작만 수행

              const tagAction = stateManager.getSetting('tag-action');
              if (search && tagAction === 'kanban') {
                // 설정이 "칸반 내 검색"이면 보드 내부 검색창에 태그를 검색어로 넣는다
                search.search(tag, true);
                return;
              }

              // 그 외에는 Obsidian 전역 검색 코어 플러그인을 열어 태그로 전역 검색을 수행
              (stateManager.app as any).internalPlugins
                .getPluginById('global-search')
                .instance.openGlobalSearch(`tag:${tag}`);
            }}
            key={i}
            className={`tag ${c('item-tag')} ${
              // 조건부(삼항) 클래스: 검색어가 태그 문자열에 포함되면 검색-일치 스타일 클래스를 추가
              searchQuery && tag.toLocaleLowerCase().contains(searchQuery) ? 'is-search-match' : ''
            }`}
            style={
              // tagColor가 존재할 때만(단축평가) CSS 커스텀 프로퍼티로 색상을 주입, 없으면 false(스타일 없음)
              tagColor && {
                '--tag-color': tagColor.color,
                '--tag-background': tagColor.backgroundColor,
              }
            }
          >
            <span>{tag[0]}</span>
            {tag.slice(1)}
          </a>
        );
      })}
    </div>
  );
}

// 카드 본문(제목 텍스트 + 메타데이터)을 그리는 핵심 컴포넌트.
// editState에 따라 "편집기" 또는 "렌더링된 마크다운" 중 하나만 보여준다.
export const ItemContent = memo(function ItemContent({
  item,
  editState,
  setEditState,
  searchQuery,
  showMetadata = true,
  isStatic,
}: ItemContentProps) {
  const { stateManager, filePath, boardModifiers } = useContext(KanbanContext);
  const getDateColor = useGetDateColorFn(stateManager);
  // titleRef: 편집기에서 타이핑된 "아직 커밋되지 않은" 최신 텍스트를 담아두는 버퍼.
  // useRef를 쓰는 이유는 이 값이 바뀔 때마다 리렌더링을 유발하고 싶지 않기 때문
  // (편집기 자체가 이미 자기 내용을 그리고 있으므로, 여기서는 그냥 최신값만 기억하면 된다).
  const titleRef = useRef<string | null>(null);

  // editState 변화를 감지해 "편집 완료/취소"를 실제 데이터 반영으로 연결하는 핵심 로직.
  useEffect(() => {
    if (editState === EditingState.complete) {
      // 편집을 완료(Enter, blur 등으로 확정)했다면, 버퍼에 저장된 최신 텍스트가 있을 때만
      // boardModifiers.updateItem으로 실제 보드 데이터에 반영한다.
      if (titleRef.current !== null) {
        boardModifiers.updateItem(path, stateManager.updateItemContent(item, titleRef.current));
      }
      titleRef.current = null; // 반영 후 버퍼 초기화
    } else if (editState === EditingState.cancel) {
      // 편집을 취소했다면 버퍼를 그냥 비워서 변경 내용을 폐기한다 (Esc 등)
      titleRef.current = null;
    }
  }, [editState, stateManager, item]);
  // 참고: 위 useEffect 콜백에서 사용하는 `path`는 아래에서 선언되지만, 클로저로 캡처되기 때문에
  // 실제로 이 effect가 실행되는 시점(렌더링 이후)에는 이미 값이 할당되어 있어 문제없이 동작한다.

  const path = useNestedEntityPath();
  const { onEditDate, onEditTime } = useDatePickers(item);
  // 인라인 에디터에서 Enter 키를 눌렀을 때 호출됨.
  // allowNewLine이 false(즉 이 상황에서 줄바꿈을 허용하지 않는다)면 편집을 완료 처리하고
  // true를 반환해 에디터의 기본 개행 동작을 막는다.
  const onEnter = useCallback(
    (cm: EditorView, mod: boolean, shift: boolean) => {
      if (!allowNewLine(stateManager, mod, shift)) {
        setEditState(EditingState.complete);
        return true;
      }
    },
    [stateManager]
  );

  // 렌더링된 마크다운 영역 클릭을 가로채, 클릭한 대상이 날짜/시간 메타데이터 태그인지 확인해
  // 해당하면 날짜/시간 피커를 연다.
  const onWrapperClick = useCallback(
    (e: MouseEvent) => {
      if (e.targetNode.instanceOf(HTMLElement)) {
        if (e.targetNode.hasClass(c('item-metadata-date'))) {
          onEditDate(e);
        } else if (e.targetNode.hasClass(c('item-metadata-time'))) {
          onEditTime(e);
        }
      }
    },
    [onEditDate, onEditTime]
  );

  // 폼 제출(예: 편집기의 제출 버튼/커맨드) 시 편집을 완료 상태로 전환
  const onSubmit = useCallback(() => setEditState(EditingState.complete), []);

  // Esc 등으로 편집을 취소할 때: 취소 상태로 전환하고 true를 반환해 기본 동작을 막는다
  const onEscape = useCallback(() => {
    setEditState(EditingState.cancel);
    return true;
  }, [item]);

  // 렌더링된 마크다운 안에 있는 체크박스(예: "- [ ] 할 일")를 클릭했을 때 처리
  const onCheckboxContainerClick = useCallback(
    (e: PointerEvent) => {
      const target = e.target as HTMLElement;

      if (target.hasClass('task-list-item-checkbox')) {
        if (target.dataset.src) {
          // 다른 파일에서 임베드(transclude)된 체크박스는 이 카드의 텍스트가 아니므로 편집하지 않고 무시
          return;
        }

        const checkboxIndex = parseInt(target.dataset.checkboxIndex, 10);
        // 위에서 정의한 checkCheckbox로 원문 텍스트 중 해당 체크박스만 토글한 새 텍스트를 얻는다
        const checked = checkCheckbox(stateManager, item.data.titleRaw, checkboxIndex);
        const updated = stateManager.updateItemContent(item, checked);

        boardModifiers.updateItem(path, updated);
      }
    },
    [path, boardModifiers, stateManager, item]
  );

  // 조건부 early return: 정적 렌더링이 아니면서(!isStatic) 현재 편집 중(isEditing)이라면
  // 마크다운 렌더러 대신 인라인 CodeMirror 에디터를 보여준다.
  if (!isStatic && isEditing(editState)) {
    return (
      <div className={c('item-input-wrapper')}>
        <MarkdownEditor
          editState={editState}
          className={c('item-input')}
          onEnter={onEnter}
          onEscape={onEscape}
          onSubmit={onSubmit}
          value={item.data.titleRaw}
          onChange={(update) => {
            // 문서 내용이 실제로 바뀐 경우에만 titleRef 버퍼를 최신 텍스트로 갱신
            if (update.docChanged) {
              titleRef.current = update.state.doc.toString().trim();
            }
          }}
        />
      </div>
    );
  }

  // 편집 중이 아닐 때의 기본 렌더링: 마크다운 렌더링 결과 + (옵션) 메타데이터 영역
  return (
    <div onClick={onWrapperClick} className={c('item-title')}>
      {isStatic ? (
        // isStatic(정적 미리보기, 드래그 고스트 등)일 때는 가볍게 복제된 렌더러를 사용
        <MarkdownClonedPreviewRenderer
          entityId={item.id}
          className={c('item-markdown')}
          markdownString={item.data.title}
          searchQuery={searchQuery}
          onPointerUp={onCheckboxContainerClick}
        />
      ) : (
        // 그 외에는 실제 Obsidian 마크다운 렌더링 파이프라인을 사용하는 정식 렌더러 사용
        <MarkdownRenderer
          entityId={item.id}
          className={c('item-markdown')}
          markdownString={item.data.title}
          searchQuery={searchQuery}
          onPointerUp={onCheckboxContainerClick}
        />
      )}
      {/* && 단축평가: showMetadata가 true일 때만 메타데이터 영역(날짜/시간/인라인 필드/태그)을 렌더링 */}
      {showMetadata && (
        <div className={c('item-metadata')}>
          <RelativeDate item={item} stateManager={stateManager} />
          <DateAndTime
            item={item}
            stateManager={stateManager}
            filePath={filePath}
            getDateColor={getDateColor}
          />
          <InlineMetadata item={item} stateManager={stateManager} />
          <Tags tags={item.data.metadata.tags} searchQuery={searchQuery} />
        </div>
      )}
    </div>
  );
});
