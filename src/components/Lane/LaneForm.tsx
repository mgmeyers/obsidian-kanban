import React from 'react';
import useOnclickOutside from 'react-cool-onclickoutside';

import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c, generateInstanceId } from '../helpers';
import { useAutocompleteInputProps } from '../Item/autocomplete';
import { LaneTemplate } from '../types';

export function LaneForm({
  onNewLane,
  closeLaneForm,
}: {
  onNewLane: () => void;
  closeLaneForm: () => void;
}) {
  const { boardModifiers } = React.useContext(KanbanContext);
  const [shouldMarkAsComplete, setShouldMarkAsComplete] = React.useState(false);
  const [laneTitle, setLaneTitle] = React.useState('');

  const inputRef = React.useRef<HTMLTextAreaElement>();
  const clickOutsideRef = useOnclickOutside(
    () => {
      closeLaneForm();
    },
    {
      ignoreClass: c('ignore-click-outside'),
    }
  );

  React.useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  const createLane = () => {
    boardModifiers.addLane({
      ...LaneTemplate,
      id: generateInstanceId(),
      children: [],
      data: {
        title: laneTitle,
        shouldMarkItemsComplete: shouldMarkAsComplete,
      },
    });

    setLaneTitle('');
    setShouldMarkAsComplete(false);
    onNewLane();
  };

  const autocompleteProps = useAutocompleteInputProps({
    isInputVisible: true,
    onEnter: (e) => {
      e.preventDefault();
      createLane();
    },
    onEscape: closeLaneForm,
    excludeDatePicker: true,
  });

  return (
    <div ref={clickOutsideRef} className={c('lane-form-wrapper')}>
      <div className={c('lane-input-wrapper')}>
        <div data-replicated-value={laneTitle} className={c('grow-wrap')}>
          <textarea
            rows={1}
            value={laneTitle}
            ref={inputRef}
            className={c('lane-input')}
            placeholder={t('Enter list title...')}
            onChange={(e) => setLaneTitle(e.target.value)}
            {...autocompleteProps}
          />
        </div>
      </div>
      <div className={c('checkbox-wrapper')}>
        <div className={c('checkbox-label')}>
          {t('Mark items in this list as complete')}
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
