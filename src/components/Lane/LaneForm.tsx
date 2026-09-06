/**
 * ============================================================================
 * [실행 순서 #66] src/components/Lane/LaneForm.tsx — 새 레인 추가/이름 편집 폼
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * 보드 맨 끝(혹은 사용자가 "새 리스트 추가" 버튼을 눌렀을 때)에 표시되는, 새 레인(리스트)을
 * 만들기 위한 인라인 폼이다. #65 LaneTitle과 달리 이미 존재하는 레인을 편집하는 것이 아니라
 * "아직 존재하지 않는" 레인을 위한 입력값을 모아 `boardModifiers.addLane`을 호출해 새 레인을
 * 생성한다. #18(components/context.ts)의 `KanbanContext`에서 `boardModifiers`(레인 생성 실행)와
 * `stateManager`(Enter 키의 줄바꿈 허용 여부 설정 조회)를 useContext로 꺼내 쓴다. 폼 바깥을
 * 클릭하면 자동으로 닫히는 useOnclickOutside 훅과, 마운트 시 자동 포커스를 주는 useLayoutEffect도
 * 함께 살펴볼 만하다.
 * ============================================================================
 */
import { EditorView } from '@codemirror/view';
import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'preact/compat';
import useOnclickOutside from 'react-cool-onclickoutside';
import { t } from 'src/lang/helpers';
import { parseLaneTitle } from 'src/parsers/helpers/parser';

import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { KanbanContext } from '../context';
import { c, generateInstanceId } from '../helpers';
import { LaneTemplate } from '../types';

interface LaneFormProps {
  onNewLane: () => void; // 레인 생성이 완료된 뒤 호출되는 콜백(폼을 다시 초기 상태로 되돌리는 등에 사용)
  closeLaneForm: () => void; // 폼을 완전히 닫는 콜백(취소/바깥 클릭/Done 버튼)
}

export function LaneForm({ onNewLane, closeLaneForm }: LaneFormProps) {
  // "이 레인에 들어오는 카드를 자동으로 완료 처리할지" 체크박스 상태.
  const [shouldMarkAsComplete, setShouldMarkAsComplete] = useState(false);
  // CodeMirror EditorView 인스턴스 참조 — "Add list" 버튼 클릭 시 현재 편집기 내용을 읽어오는 데 사용.
  const editorRef = useRef<EditorView>();
  const inputRef = useRef<HTMLTextAreaElement>();
  // react-cool-onclickoutside: 반환된 ref를 붙인 요소 바깥을 클릭하면 자동으로 closeLaneForm 호출.
  // ignoreClass에 나열된 클래스를 가진 요소를 클릭했을 때는 "바깥 클릭"으로 취급하지 않는다
  // (예: 모바일 툴바나 자동완성 목록 클릭 시 폼이 실수로 닫히는 것을 방지).
  const clickOutsideRef = useOnclickOutside(() => closeLaneForm(), {
    ignoreClass: [c('ignore-click-outside'), 'mobile-toolbar', 'suggestion-container'],
  });

  // #18 KanbanContext에서 boardModifiers(레인 추가 실행)와 stateManager(설정 조회)를 꺼낸다.
  const { boardModifiers, stateManager } = useContext(KanbanContext);

  // 컴포넌트가 처음 마운트(DOM에 그려짐)된 직후, 브라우저가 화면을 그리기 전에 동기적으로 실행되는
  // useLayoutEffect를 이용해 입력창에 자동으로 포커스를 준다. 의존성 배열이 []이므로 최초 1회만 실행.
  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 실제로 새 레인을 생성하는 함수. cm(CodeMirror EditorView)과 title(입력된 텍스트)을 받는다.
  const createLane = useCallback(
    (cm: EditorView, title: string) => {
      // boardModifiers.addLane으로 LaneTemplate(기본 레인 구조)을 복사한 뒤, 새 id/파싱된
      // 제목/최대 카드 수/완료 표시 여부를 채워 보드에 새 레인을 추가한다.
      boardModifiers.addLane({
        ...LaneTemplate,
        id: generateInstanceId(),
        children: [],
        data: {
          ...parseLaneTitle(title),
          shouldMarkItemsComplete: shouldMarkAsComplete,
        },
      });

      // 레인 생성 후 에디터 내용을 비워, 다음 레인을 이어서 추가할 수 있도록 준비한다.
      cm.dispatch({
        changes: {
          from: 0,
          to: cm.state.doc.length,
          insert: '',
        },
      });

      // 체크박스 상태를 초기화하고, 상위에 "새 레인이 생성되었다"고 알린다.
      setShouldMarkAsComplete(false);
      onNewLane();
    },
    [onNewLane, setShouldMarkAsComplete, boardModifiers]
  );

  // 이 폼의 편집기는 항상 "열려 있는" 상태이므로, 좌표 값 자체는 의미가 없다(단지 편집 모드임을
  // 나타내기 위한 고정 객체). useMemo로 한 번만 생성해 매 렌더마다 새 객체가 만들어지는 것을 방지.
  const editState = useMemo(() => ({ x: 0, y: 0 }), []);
  // Enter 키 처리: 줄바꿈이 허용되지 않는 상황이면 Enter를 "제출"로 취급해 새 레인을 생성한다.
  const onEnter = useCallback(
    (cm: EditorView, mod: boolean, shift: boolean) => {
      if (!allowNewLine(stateManager, mod, shift)) {
        createLane(cm, cm.state.doc.toString());
        return true;
      }
    },
    [createLane]
  );
  // 에디터의 제출 이벤트(onSubmit)에서도 동일하게 createLane 호출.
  const onSubmit = useCallback(
    (cm: EditorView) => createLane(cm, cm.state.doc.toString()),
    [createLane]
  );

  return (
    // clickOutsideRef를 최상위 wrapper에 부착 — 이 영역 밖을 클릭하면 폼이 자동으로 닫힌다.
    <div ref={clickOutsideRef} className={c('lane-form-wrapper')}>
      <div className={c('lane-input-wrapper')}>
        <MarkdownEditor
          className={c('lane-input')}
          editorRef={editorRef}
          editState={editState}
          onEnter={onEnter}
          onEscape={closeLaneForm}
          onSubmit={onSubmit}
        />
      </div>
      <div className={c('checkbox-wrapper')}>
        <div className={c('checkbox-label')}>{t('Mark cards in this list as complete')}</div>
        <div
          onClick={() => setShouldMarkAsComplete(!shouldMarkAsComplete)}
          className={`checkbox-container ${shouldMarkAsComplete ? 'is-enabled' : ''}`}
        />
      </div>
      <div className={c('lane-input-actions')}>
        <button
          className={c('lane-action-add')}
          onClick={() => {
            // 버튼 클릭 시에는 CodeMirror의 onSubmit 콜백 체계를 거치지 않으므로,
            // editorRef에 저장해둔 현재 EditorView 인스턴스를 직접 참조해 createLane을 호출한다.
            if (editorRef.current) {
              createLane(editorRef.current, editorRef.current.state.doc.toString());
            }
          }}
        >
          {t('Add list')}
        </button>
        <button className={c('lane-action-cancel')} onClick={closeLaneForm}>
          {t('Done')}
        </button>
      </div>
    </div>
  );
}
