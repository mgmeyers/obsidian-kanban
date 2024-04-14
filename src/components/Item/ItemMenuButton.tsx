import Preact from 'preact/compat';
import { Dispatch, StateUpdater } from 'preact/hooks';
import { t } from 'src/lang/helpers';

import { Icon } from '../Icon/Icon';
import { c } from '../helpers';
import { EditState, EditingState, isEditing } from '../types';

interface ItemMenuButtonProps {
  editState: EditState;
  setEditState: Dispatch<StateUpdater<EditState>>;
  showMenu: (e: MouseEvent, internalLinkPath?: string) => void;
}

export const ItemMenuButton = Preact.memo(function ItemMenuButton({
  editState,
  setEditState,
  showMenu,
}: ItemMenuButtonProps) {
  const ignoreAttr = Preact.useMemo(() => {
    if (editState) {
      return {
        'data-ignore-drag': true,
      };
    }

    return {};
  }, [editState]);

  return (
    <div {...ignoreAttr} className={c('item-postfix-button-wrapper')}>
      {isEditing(editState) ? (
        <a
          data-ignore-drag={true}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => setEditState(EditingState.cancel)}
          className={`${c('item-postfix-button')} is-enabled clickable-icon`}
          aria-label={t('Cancel')}
        >
          <Icon name="lucide-x" />
        </a>
      ) : (
        <a
          data-ignore-drag={true}
          onPointerDown={(e) => e.preventDefault()}
          onClick={showMenu as any}
          className={`${c('item-postfix-button')} clickable-icon`}
          aria-label={t('More options')}
        >
          <Icon name="lucide-more-vertical" />
        </a>
      )}
    </div>
  );
});
