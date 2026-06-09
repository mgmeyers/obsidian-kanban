import { useCallback, useContext, useRef, useState } from 'preact/compat';
import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { Path } from 'src/dnd/types';

import { KanbanContext } from '../context';
import { c, escapeRegExpStr } from '../helpers';
import { Item } from '../types';

interface StoryPointsProps {
  item: Item;
  isStatic?: boolean;
  explicitPath?: Path;
}

export function StoryPoints({ item, isStatic, explicitPath }: StoryPointsProps) {
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const path = explicitPath || useNestedEntityPath();
  const sp = item.data.metadata.storyPoints ?? 0;
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(sp));
  const inputRef = useRef<HTMLInputElement>(null);

  const commitValue = useCallback(
    (val: string) => {
      setIsEditing(false);
      const parsed = parseFloat(val);
      const newSp = isNaN(parsed) ? 0 : parsed;
      if (newSp === sp) return;

      const spTrigger = stateManager.getSetting('story-points-trigger') as string;
      const spRegEx = new RegExp(`(^|\\s)${escapeRegExpStr(spTrigger)}{([^}]+)}`);

      let titleRaw = item.data.titleRaw;
      if (item.data.metadata.storyPoints != null) {
        titleRaw = titleRaw.replace(spRegEx, `$1${spTrigger}{${newSp}}`);
      } else {
        titleRaw = `${titleRaw} ${spTrigger}{${newSp}}`;
      }
      boardModifiers.updateItem(path, stateManager.updateItemContent(item, titleRaw));
    },
    [sp, item, stateManager, boardModifiers, path]
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (isStatic) return;
      e.stopPropagation();
      setLocalValue(String(sp));
      setIsEditing(true);
      requestAnimationFrame(() => inputRef.current?.select());
    },
    [sp, isStatic]
  );

  const handleBlur = useCallback(() => {
    commitValue(localValue);
  }, [localValue, commitValue]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitValue(localValue);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsEditing(false);
      }
      e.stopPropagation();
    },
    [localValue, commitValue]
  );

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        step="1"
        className={c('item-story-points-input')}
        value={localValue}
        data-ignore-drag="true"
        onInput={(e) => setLocalValue((e.target as HTMLInputElement).value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={c('item-story-points')}
      onClick={handleClick}
      aria-label={`${sp} story point${sp !== 1 ? 's' : ''}`}
    >
      {sp}
    </span>
  );
}
