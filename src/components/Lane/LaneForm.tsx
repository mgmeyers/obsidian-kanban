import Preact from 'preact/compat';
import useOnclickOutside from 'react-cool-onclickoutside';

import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { c, generateInstanceId } from '../helpers';
import { LaneTemplate } from '../types';
import { parseLaneTitle } from 'src/parsers/helpers/parser';

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
  const [laneTitle, setLaneTitle] = Preact.useState('');

  const inputRef = Preact.useRef<HTMLTextAreaElement>();
  const clickOutsideRef = useOnclickOutside(
    () => {
      closeLaneForm();
    },
    {
      ignoreClass: c('ignore-click-outside'),
    }
  );

  Preact.useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  const createLane = () => {
    boardModifiers.addLane({
      ...LaneTemplate,
      id: generateInstanceId(),
      children: [],
      data: {
        ...parseLaneTitle(laneTitle),
        shouldMarkItemsComplete: shouldMarkAsComplete,
      },
    });

    setLaneTitle('');
    setShouldMarkAsComplete(false);
    onNewLane();
  };

  return (
    <div ref={clickOutsideRef} className={c('lane-form-wrapper')}>
      <div className={c('lane-input-wrapper')}>
        <MarkdownEditor
          ref={inputRef}
          className={c('lane-input')}
          onChange={(e) =>
            setLaneTitle((e.target as HTMLTextAreaElement).value)
          }
          onEnter={(e) => {
            if (!allowNewLine(e, stateManager)) {
              e.preventDefault();
              createLane();
            }
          }}
          onSubmit={() => {
            createLane();
          }}
          onEscape={closeLaneForm}
          value={laneTitle}
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
        <button className={c('lane-action-add')} onClick={createLane}>
          {t('Add list')}
        </button>
        <button className={c('lane-action-cancel')} onClick={closeLaneForm}>
          {t('Cancel')}
        </button>
      </div>
    </div>
  );
}
