import update from 'immutability-helper';
import { memo, useCallback, useEffect, useState } from 'preact/compat';
import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import { getTaskStatusDone, toggleTask } from 'src/parsers/helpers/inlineMetadata';

import { BoardModifiers } from '../../helpers/boardModifiers';
import { Icon } from '../Icon/Icon';
import { c } from '../helpers';
import { Item } from '../types';

interface ItemCheckboxProps {
  path: Path;
  item: Item;
  shouldMarkItemsComplete: boolean;
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
}

export const ItemCheckbox = memo(function ItemCheckbox({
  shouldMarkItemsComplete,
  path,
  item,
  stateManager,
  boardModifiers,
}: ItemCheckboxProps) {
  const shouldShowCheckbox = stateManager.useSetting('show-checkboxes');

  const [isCtrlHoveringCheckbox, setIsCtrlHoveringCheckbox] = useState(false);
  const [isHoveringCheckbox, setIsHoveringCheckbox] = useState(false);

  const onCheckboxChange = useCallback(() => {
    const updates = toggleTask(item, stateManager.file);
    if (updates) {
      const [itemStrings, checkChars, thisIndex] = updates;
      const replacements: Item[] = itemStrings.map((str, i) => {
        const next = stateManager.getNewItem(str, checkChars[i]);
        if (i === thisIndex) next.id = item.id;
        return next;
      });

      boardModifiers.replaceItem(path, replacements);
    } else {
      boardModifiers.updateItem(
        path,
        update(item, {
          data: {
            checkChar: {
              $apply: (v) => {
                return v === ' ' ? getTaskStatusDone() : ' ';
              },
            },
            $toggle: ['checked'],
          },
        })
      );
    }
  }, [item, stateManager, boardModifiers, ...path]);

  useEffect(() => {
    if (isHoveringCheckbox) {
      const handler = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey) {
          setIsCtrlHoveringCheckbox(true);
        } else {
          setIsCtrlHoveringCheckbox(false);
        }
      };

      activeWindow.addEventListener('keydown', handler);
      activeWindow.addEventListener('keyup', handler);

      return () => {
        activeWindow.removeEventListener('keydown', handler);
        activeWindow.removeEventListener('keyup', handler);
      };
    }
  }, [isHoveringCheckbox]);

  if (!(shouldMarkItemsComplete || shouldShowCheckbox)) {
    return null;
  }

  return (
    <div
      onMouseEnter={(e) => {
        setIsHoveringCheckbox(true);

        if (e.ctrlKey || e.metaKey) {
          setIsCtrlHoveringCheckbox(true);
        }
      }}
      onMouseLeave={() => {
        setIsHoveringCheckbox(false);

        if (isCtrlHoveringCheckbox) {
          setIsCtrlHoveringCheckbox(false);
        }
      }}
      className={c('item-prefix-button-wrapper')}
    >
      {shouldShowCheckbox && !isCtrlHoveringCheckbox && (
        <input
          onChange={onCheckboxChange}
          type="checkbox"
          className="task-list-item-checkbox"
          checked={item.data.checked}
          data-task={item.data.checkChar}
        />
      )}
      {(isCtrlHoveringCheckbox || (!shouldShowCheckbox && shouldMarkItemsComplete)) && (
        <a
          onClick={() => {
            boardModifiers.archiveItem(path);
          }}
          className={`${c('item-prefix-button')} clickable-icon`}
          aria-label={isCtrlHoveringCheckbox ? undefined : 'Archive card'}
        >
          <Icon name="sheets-in-box" />
        </a>
      )}
    </div>
  );
});
