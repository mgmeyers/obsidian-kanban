import { EditorView } from '@codemirror/view';
import Preact, { useRef } from 'preact/compat';
import useOnclickOutside from 'react-cool-onclickoutside';
import { t } from 'src/lang/helpers';
import { parseLaneTitle } from 'src/parsers/helpers/parser';

import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { KanbanContext } from '../context';
import { c, generateInstanceId } from '../helpers';
import { LaneTemplate } from '../types';

export function LaneForm({
  onNewLane,
  closeLaneForm,
}: {
  onNewLane: () => void;
  closeLaneForm: () => void;
}) {
  const { boardModifiers, stateManager } = Preact.useContext(KanbanContext);
  const [shouldMarkAsComplete, setShouldMarkAsComplete] =
    Preact.useState(false);
  const editorRef = useRef<EditorView>();

  const inputRef = Preact.useRef<HTMLTextAreaElement>();
  const clickOutsideRef = useOnclickOutside(() => closeLaneForm(), {
    ignoreClass: c('ignore-click-outside'),
  });

  Preact.useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  const createLane = (title: string) => {
    boardModifiers.addLane({
      ...LaneTemplate,
      id: generateInstanceId(),
      children: [],
      data: {
        ...parseLaneTitle(title),
        shouldMarkItemsComplete: shouldMarkAsComplete,
      },
    });

    const cm = editorRef.current;
    if (cm) {
      cm.dispatch({
        changes: {
          from: 0,
          to: cm.state.doc.length,
          insert: '',
        },
      });
    }

    setShouldMarkAsComplete(false);
    onNewLane();
  };

  return (
    <div ref={clickOutsideRef} className={c('lane-form-wrapper')}>
      <div className={c('lane-input-wrapper')}>
        <MarkdownEditor
          editorRef={editorRef}
          editState={{ x: 0, y: 0 }}
          className={c('lane-input')}
          onEnter={(cm, mod, shift) => {
            if (!allowNewLine(stateManager, mod, shift)) {
              createLane(cm.state.doc.toString());
              return true;
            }
          }}
          onSubmit={(cm) => createLane(cm.state.doc.toString())}
          onEscape={closeLaneForm}
        />
      </div>
      <div className={c('checkbox-wrapper')}>
        <div className={c('checkbox-label')}>
          {t('Mark cards in this list as complete')}
        </div>
        <div
          onClick={() => setShouldMarkAsComplete(!shouldMarkAsComplete)}
          className={`checkbox-container ${
            shouldMarkAsComplete ? 'is-enabled' : ''
          }`}
        />
      </div>
      <div className={c('lane-input-actions')}>
        <button
          className={c('lane-action-add')}
          onClick={() => {
            createLane(editorRef.current.state.doc.toString());
          }}
        >
          {t('Add list')}
        </button>
        <button className={c('lane-action-cancel')} onClick={closeLaneForm}>
          {t('Cancel')}
        </button>
      </div>
    </div>
  );
}
