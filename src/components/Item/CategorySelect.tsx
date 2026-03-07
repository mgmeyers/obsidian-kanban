import { createPortal, useCallback, useContext, useEffect, useRef, useState } from 'preact/compat';
import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { Path } from 'src/dnd/types';

import { KanbanContext } from '../context';
import { c, escapeRegExpStr } from '../helpers';
import { Category, Item } from '../types';

interface CategorySelectProps {
  item: Item;
  isStatic?: boolean;
  explicitPath?: Path;
}

export function CategorySelect({ item, isStatic, explicitPath }: CategorySelectProps) {
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const path = explicitPath || useNestedEntityPath();
  const currentCategory = item.data.metadata.category ?? null;
  const categories = (stateManager.useSetting('categories') as Category[]) || [];
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentColor =
    categories.find((cat) => cat.name === currentCategory)?.color || null;

  const setCategory = useCallback(
    (newCategory: string | null) => {
      setIsOpen(false);
      if (newCategory === currentCategory) return;

      const catTrigger = stateManager.getSetting('category-trigger') as string;
      const catRegEx = new RegExp(`(^|\\s)${escapeRegExpStr(catTrigger)}{([^}]+)}`);

      let titleRaw = item.data.titleRaw;
      if (currentCategory) {
        if (newCategory) {
          titleRaw = titleRaw.replace(catRegEx, `$1${catTrigger}{${newCategory}}`);
        } else {
          titleRaw = titleRaw.replace(catRegEx, '').trim();
        }
      } else if (newCategory) {
        titleRaw = `${titleRaw} ${catTrigger}{${newCategory}}`;
      }
      boardModifiers.updateItem(path, stateManager.updateItemContent(item, titleRaw));
    },
    [currentCategory, item, stateManager, boardModifiers, path]
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

    let left = triggerRect.left;
    if (left + ddWidth > window.innerWidth) {
      left = triggerRect.right - ddWidth;
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

  if (categories.length === 0) return null;

  const dropdown = isOpen
    ? createPortal(
        <div ref={dropdownRef} className={c('category-dropdown')}>
          <div
            className={`${c('category-option')} ${!currentCategory ? 'is-selected' : ''}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              setCategory(null);
            }}
          >
            <span className={c('category-option-dot')} style={{ backgroundColor: 'transparent', border: '1px dashed var(--text-faint)' }} />
            <span>None</span>
          </div>
          {categories.map((cat) => (
            <div
              key={cat.name}
              className={`${c('category-option')} ${cat.name === currentCategory ? 'is-selected' : ''}`}
              onMouseDown={(e) => {
                e.stopPropagation();
                setCategory(cat.name);
              }}
            >
              <span
                className={c('category-option-dot')}
                style={{ backgroundColor: cat.color }}
              />
              <span>{cat.name}</span>
            </div>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <span
      className={c('category-select')}
      data-ignore-drag="true"
    >
      <span
        ref={triggerRef}
        className={c('category-select-trigger')}
        onClick={handleToggle}
        aria-label={currentCategory || 'Set category'}
      >
        <span
          className={c('category-dot')}
          style={{
            backgroundColor: currentColor || 'transparent',
            border: currentColor ? 'none' : '1.5px dashed var(--text-faint)',
          }}
        />
        {currentCategory && (
          <span className={c('category-label')}>{currentCategory}</span>
        )}
      </span>
      {dropdown}
    </span>
  );
}
