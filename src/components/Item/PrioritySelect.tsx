import { createPortal, useCallback, useContext, useEffect, useRef, useState } from 'preact/compat';
import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { Path } from 'src/dnd/types';

import { KanbanContext } from '../context';
import { c, escapeRegExpStr } from '../helpers';
import { Item } from '../types';

type Priority = 'low' | 'medium' | 'high';

const priorityLabels: Record<Priority | 'none', string> = {
  none: '\u2014',
  low: 'L',
  medium: 'M',
  high: 'H',
};

const priorityOptions: Array<Priority | 'none'> = ['none', 'low', 'medium', 'high'];

interface PrioritySelectProps {
  item: Item;
  isStatic?: boolean;
  explicitPath?: Path;
}

export function PrioritySelect({ item, isStatic, explicitPath }: PrioritySelectProps) {
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const path = explicitPath || useNestedEntityPath();
  const currentPriority = item.data.metadata.priority ?? null;
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const setPriority = useCallback(
    (newPriority: Priority | 'none') => {
      setIsOpen(false);
      const target = newPriority === 'none' ? null : newPriority;
      if (target === currentPriority) return;

      const pTrigger = stateManager.getSetting('priority-trigger') as string;
      const pRegEx = new RegExp(`(^|\\s)${escapeRegExpStr(pTrigger)}{([^}]+)}`);

      let titleRaw = item.data.titleRaw;
      if (currentPriority) {
        if (target) {
          titleRaw = titleRaw.replace(pRegEx, `$1${pTrigger}{${target}}`);
        } else {
          titleRaw = titleRaw.replace(pRegEx, '').trim();
        }
      } else if (target) {
        titleRaw = `${titleRaw} ${pTrigger}{${target}}`;
      }
      boardModifiers.updateItem(path, stateManager.updateItemContent(item, titleRaw));
    },
    [currentPriority, item, stateManager, boardModifiers, path]
  );

  const positionDropdown = useCallback(() => {
    const trigger = triggerRef.current;
    const dd = dropdownRef.current;
    if (!trigger || !dd) return;

    const triggerRect = trigger.getBoundingClientRect();
    const ddHeight = dd.offsetHeight;
    const ddWidth = dd.offsetWidth;

    let top = triggerRect.top - ddHeight - 4;
    if (top < 0) {
      top = triggerRect.bottom + 4;
    }

    let left = triggerRect.right - ddWidth;
    if (left < 0) {
      left = triggerRect.left;
    }

    dd.style.top = `${top}px`;
    dd.style.left = `${left}px`;
  }, []);

  const handleToggle = useCallback(
    (e: MouseEvent) => {
      if (isStatic) return;
      e.stopPropagation();
      e.preventDefault();
      setIsOpen((prev) => !prev);
    },
    [isStatic]
  );

  useEffect(() => {
    if (!isOpen) return;
    positionDropdown();
  }, [isOpen, positionDropdown]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  const display = currentPriority ? priorityLabels[currentPriority] : priorityLabels.none;

  const dropdown = isOpen
    ? createPortal(
        <div
          ref={dropdownRef}
          className={c('item-priority-dropdown')}
        >
          {priorityOptions.map((opt) => (
            <div
              key={opt}
              className={`${c('item-priority-option')} ${opt === (currentPriority ?? 'none') ? 'is-selected' : ''} ${opt !== 'none' ? `is-${opt}` : ''}`}
              onMouseDown={(e) => {
                e.stopPropagation();
                setPriority(opt);
              }}
            >
              {opt === 'none' ? 'None' : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </div>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <div
      className={`${c('item-priority-select')} ${currentPriority ? `is-${currentPriority}` : ''}`}
      data-ignore-drag="true"
    >
      <span
        ref={triggerRef}
        className={c('item-priority-select-value')}
        onClick={handleToggle}
      >
        {display}
      </span>
      {dropdown}
    </div>
  );
}
