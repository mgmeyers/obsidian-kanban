/**
 * ============================================================================
 * [실행 순서 #71] ItemForm.tsx — 카드 추가/편집용 폼(인라인 편집기 래퍼)
 * ----------------------------------------------------------------------------
 * 단계: 실행-렌더링 / 실행-상호작용
 * 레인(Lane) 하단에 표시되는 "+ 카드 추가" 버튼과, 그 버튼을 눌렀을 때 나타나는
 * 인라인 마크다운 편집기를 하나의 컴포넌트로 묶어 놓았다. editState가 편집 중이면
 * MarkdownEditor 폼을, 아니면 버튼을 보여주는 전환 구조를 가진다. 폼 바깥을
 * 클릭하면 자동으로 취소되고, 다른 카드를 이 위치로 드래그해 올리면 자동으로
 * 편집 모드가 열려 새 카드를 만들 수 있는 위치를 제공한다.
 * ============================================================================
 */
import { EditorView } from '@codemirror/view';
import { Dispatch, StateUpdater, useContext, useRef } from 'preact/hooks';
// 엘리먼트 바깥을 클릭했을 때 콜백을 실행해주는 서드파티 훅 (외부 클릭 감지)
import useOnclickOutside from 'react-cool-onclickoutside';
import { t } from 'src/lang/helpers';

import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { getDropAction } from '../Editor/helpers';
import { KanbanContext } from '../context';
import { c } from '../helpers';
import { EditState, EditingState, Item, isEditing } from '../types';

interface ItemFormProps {
  addItems: (items: Item[]) => void; // 새로 만들어진 카드(들)를 레인에 실제로 추가하는 콜백
  editState: EditState; // 편집 상태는 부모(Lane)로부터 내려받는다 — 상태를 위로 끌어올린(lift-up) 구조
  setEditState: Dispatch<StateUpdater<EditState>>;
  hideButton?: boolean; // true면 편집 중이 아닐 때 "+ 카드 추가" 버튼 자체를 숨김
}

export function ItemForm({ addItems, editState, setEditState, hideButton }: ItemFormProps) {
  const { stateManager } = useContext(KanbanContext);
  // CodeMirror 에디터 인스턴스를 직접 참조해 명령형으로 제어(내용 비우기 등)하기 위한 ref
  const editorRef = useRef<EditorView>();

  // 편집을 취소하고 "보기(버튼) 모드"로 되돌리는 헬퍼
  const clear = () => setEditState(EditingState.cancel);
  // 이 컴포넌트가 반환하는 루트 엘리먼트에 연결할 ref.
  // 이 엘리먼트 바깥을 클릭하면 clear()가 자동 호출되어 폼이 닫힌다.
  // ignoreClass에 나열된 클래스를 가진 요소를 클릭한 경우는 "바깥 클릭"으로 치지 않고 무시한다
  // (자체 UI 무시 클래스, 모바일 툴바, 자동완성 제안 목록 등은 폼의 일부로 취급).
  const clickOutsideRef = useOnclickOutside(clear, {
    ignoreClass: [c('ignore-click-outside'), 'mobile-toolbar', 'suggestion-container'],
  });

  // 입력된 제목(title)으로 새 카드를 만들어 addItems로 부모에 전달하고, 에디터 내용은 비운다.
  const createItem = (title: string) => {
    // stateManager.getNewItem(title, ' ')로 새 Item 데이터를 생성 (두 번째 인자는 체크박스 문자 등 기본값)
    addItems([stateManager.getNewItem(title, ' ')]);
    const cm = editorRef.current;
    if (cm) {
      // CodeMirror 트랜잭션으로 문서 전체 범위(0~length)를 빈 문자열로 교체해 에디터를 초기화
      cm.dispatch({
        changes: {
          from: 0,
          to: cm.state.doc.length,
          insert: '',
        },
      });
    }
  };

  // 조건부 렌더링 ①: 지금 편집 중(isEditing)이라면 인라인 마크다운 에디터 폼을 보여준다.
  if (isEditing(editState)) {
    return (
      <div className={c('item-form')} ref={clickOutsideRef}>
        <div className={c('item-input-wrapper')}>
          <MarkdownEditor
            editorRef={editorRef}
            editState={{ x: 0, y: 0 }}
            className={c('item-input')}
            placeholder={t('Card title...')}
            onEnter={(cm, mod, shift) => {
              // 현재 상황에서 줄바꿈이 허용되지 않으면(=Enter가 "제출"의 의미) 새 카드를 생성
              if (!allowNewLine(stateManager, mod, shift)) {
                createItem(cm.state.doc.toString());
                return true; // 에디터의 기본 개행 삽입 동작을 막음
              }
            }}
            onSubmit={(cm) => {
              // 제출 커맨드(예: 완료 버튼/단축키)로도 동일하게 카드를 생성
              createItem(cm.state.doc.toString());
            }}
            onEscape={clear}
          />
        </div>
      </div>
    );
  }

  // 조건부 렌더링 ②: 편집 중이 아니고 hideButton이 true면 아무것도 렌더링하지 않음(가드 절)
  if (hideButton) return null;

  // 조건부 렌더링 ③: 편집 중이 아니고 버튼을 숨기지 않는 기본 상태 — "+ 카드 추가" 버튼을 보여준다.
  return (
    <div className={c('item-button-wrapper')}>
      <button
        className={c('new-item-button')}
        onClick={() => setEditState({ x: 0, y: 0 })}
        onDragOver={(e) => {
          // 다른 카드를 이 버튼 위로 드래그해 올리는 경우, 드롭이 가능한 상황이라면
          // 자동으로 편집 모드를 열어 "새 카드가 추가될 위치"를 시각적으로 확보해준다
          if (getDropAction(stateManager, e.dataTransfer)) {
            setEditState({ x: 0, y: 0 });
          }
        }}
      >
        <span className={c('item-button-plus')}>+</span> {t('Add a card')}
      </button>
    </div>
  );
}
