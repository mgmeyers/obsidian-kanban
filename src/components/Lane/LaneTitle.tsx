/**
 * ============================================================================
 * [실행 순서 #65] src/components/Lane/LaneTitle.tsx — 레인 제목을 편집하는 인풋 컴포넌트
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * #64(LaneHeader.tsx)에서 사용하는 두 개의 작은 컴포넌트를 정의한다: 카드 개수/최대 개수를
 * 보여주는 `LaneLimitCounter`와, 레인 제목을 보여주거나(뷰 모드) CodeMirror 기반 마크다운
 * 에디터로 편집하는(편집 모드) `LaneTitle`이다. 편집이 끝나는 시점(EditingState.complete/cancel)을
 * useEffect로 감지해 상위(#64)로부터 받은 onChange 콜백을 호출하는 패턴이 핵심이다.
 * #18(components/context.ts)의 `KanbanContext`에서는 `stateManager`만 꺼내 쓰는데, 카드 개수
 * 표시 여부 설정(hide-card-count)을 읽거나 Shift/Cmd+Enter로 줄바꿈을 허용할지(allowNewLine) 판단하는
 * 데 사용한다 — 실제 데이터 변경(boardModifiers)은 이 컴포넌트가 아니라 호출부(#64)가 담당한다.
 * ============================================================================
 */
import { EditorView, ViewUpdate } from '@codemirror/view';
import classcat from 'classcat';
import { Dispatch, StateUpdater, useCallback, useContext, useEffect, useRef } from 'preact/hooks';
import { laneTitleWithMaxItems } from 'src/helpers';

import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { MarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer';
import { KanbanContext } from '../context';
import { c } from '../helpers';
import { EditState, EditingState, isEditing } from '../types';

export interface LaneTitleProps {
  title: string;
  maxItems?: number;
  editState: EditState;
  setEditState: Dispatch<StateUpdater<EditState>>;
  onChange: (str: string) => void;
  id: string;
}

// 레인 헤더에 표시되는 "현재 카드 수 / 최대 카드 수(WIP 제한)" 배지.
export function LaneLimitCounter({
  maxItems,
  itemCount,
  editState,
}: {
  maxItems: number;
  itemCount: number;
  editState: EditState;
}) {
  // #18 KanbanContext에서 stateManager를 꺼내 "카드 수 숨기기" 설정 값을 읽는다.
  const { stateManager } = useContext(KanbanContext);
  const hideCount = stateManager.getSetting('hide-card-count');

  // 설정으로 숨김 처리되었거나, 제목이 편집 중일 때는 배지를 아예 렌더링하지 않는다.
  if (hideCount || isEditing(editState)) return null;

  return (
    <div
      className={classcat([
        c('lane-title-count'),
        {
          // 최대 카드 수가 설정되어 있고 실제 카드 수가 이를 초과하면 경고 스타일(wip-exceeded) 부여
          'wip-exceeded': maxItems && maxItems < itemCount,
        },
      ])}
    >
      {itemCount}
      {maxItems > 0 && (
        <>
          <span className={c('lane-title-count-separator')}>/</span>
          <span className={c('lane-title-count-limit')}>{maxItems}</span>
        </>
      )}
    </div>
  );
}

// 레인 제목 자체를 렌더링/편집하는 컴포넌트. editState가 "편집 중" 상태이면 CodeMirror 기반
// MarkdownEditor를, 아니면 렌더링된 마크다운 텍스트(MarkdownRenderer)를 보여준다.
export function LaneTitle({ maxItems, editState, setEditState, title, onChange }: LaneTitleProps) {
  // stateManager는 allowNewLine 판단(설정에 따라 Enter/Shift+Enter 동작이 달라짐)에 사용.
  const { stateManager } = useContext(KanbanContext);
  // 편집 중 사용자가 입력한 최신 문자열을 담아두는 ref. useRef는 값이 바뀌어도 리렌더를 유발하지
  // 않으므로, 매 키 입력마다 리렌더할 필요 없는 "임시 버퍼"로 사용하기에 적합하다.
  const titleRef = useRef<string | null>(null);

  // editState가 바뀔 때마다 실행되는 이펙트. 편집이 "완료(complete)"되면 titleRef에 쌓인
  // 최신 문자열을 상위로 onChange(str)로 전달해 실제 보드 데이터에 반영시키고, "취소(cancel)"되면
  // 버퍼만 비운다(변경 사항을 버림). 의존성 배열이 [editState]이므로 onChange/titleRef 값 자체가
  // 바뀌어도 재실행되지 않고, 오직 editState 전환 시점에만 실행된다.
  useEffect(() => {
    if (editState === EditingState.complete) {
      if (titleRef.current !== null) onChange(titleRef.current);
      titleRef.current = null;
    } else if (editState === EditingState.cancel && titleRef.current !== null) {
      titleRef.current = null;
    }
  }, [editState]);

  // CodeMirror 에디터 내용이 바뀔 때마다(키 입력 등) 호출되어 titleRef 버퍼를 최신 문자열로
  // 갱신한다. 의존성 배열이 빈 배열([])이므로 이 함수는 최초 렌더 시 한 번만 생성되고 이후
  // 재생성되지 않는다 — titleRef는 ref이므로 클로저에 갇혀도 항상 최신 값을 참조할 수 있다.
  const onUpdate = useCallback((update: ViewUpdate) => {
    if (update.docChanged) {
      titleRef.current = update.state.doc.toString().trim();
    }
  }, []);
  // Enter 키 처리: allowNewLine(설정/보조키 조합에 따라 줄바꿈 허용 여부 판단)이 false면
  // 줄바꿈 대신 편집을 완료 처리하고, 에디터에게 "이 키 입력을 내가 처리했다"는 의미로 true를 반환한다.
  const onEnter = useCallback(
    (cm: EditorView, mod: boolean, shift: boolean) => {
      if (!allowNewLine(stateManager, mod, shift)) {
        setEditState(EditingState.complete);
        return true;
      }
    },
    [setEditState, stateManager]
  );
  // 에디터가 자체적으로 "제출(submit)" 이벤트를 발생시켰을 때(예: 포커스 아웃 등) 편집을 완료 처리.
  const onSubmit = useCallback(() => setEditState(EditingState.complete), [setEditState]);
  // Escape 키 입력 시 편집을 취소 처리(버퍼는 위 useEffect에서 비워짐).
  const onEscape = useCallback(() => setEditState(EditingState.cancel), [setEditState]);

  return (
    <div className={c('lane-title')}>
      {isEditing(editState) ? (
        // 편집 모드: CodeMirror 기반 마크다운 에디터. laneTitleWithMaxItems로 "제목 (maxItems)"
        // 형태의 초기 값을 만들어 편집 가능한 하나의 텍스트로 합쳐 보여준다.
        <MarkdownEditor
          editState={editState}
          className={c('lane-input')}
          onChange={onUpdate}
          onEnter={onEnter}
          onEscape={onEscape}
          onSubmit={onSubmit}
          value={laneTitleWithMaxItems(title, maxItems)}
        />
      ) : (
        // 뷰 모드: 저장된 마크다운 제목을 그대로 렌더링(링크, 굵게 등 마크다운 서식 지원)
        <div className={c('lane-title-text')}>
          <MarkdownRenderer markdownString={title} />
        </div>
      )}
    </div>
  );
}
