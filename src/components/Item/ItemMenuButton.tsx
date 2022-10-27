import Preact from 'preact/compat';

import { t } from 'src/lang/helpers';

import { c } from '../helpers';
import { Icon } from '../Icon/Icon';

interface ItemMenuButtonProps {
  isEditing: boolean;
  setIsEditing: Preact.StateUpdater<boolean>;
  showMenu: (e: MouseEvent, internalLinkPath?: string) => void;
}

export const ItemMenuButton = Preact.memo(function ItemMenuButton({
  isEditing,
  setIsEditing,
  showMenu,
}: ItemMenuButtonProps) {
  const ignoreAttr = Preact.useMemo(() => {
    if (isEditing) {
      return {
        'data-ignore-drag': true,
      };
    }

    return {};
  }, [isEditing]);

  return (
    <div {...ignoreAttr} className={c('item-postfix-button-wrapper')}>
      {isEditing ? (
        <a
          data-ignore-drag={true}
          onPointerDown={(e) => {
            e.preventDefault();
          }}
          onClick={() => {
            setIsEditing(false);
          }}
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
