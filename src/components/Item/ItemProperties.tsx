import { memo, useCallback, useContext, useMemo, useRef, useState } from 'preact/compat';
import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c } from '../helpers';
import { Item } from '../types';

interface ItemPropertiesProps {
  item: Item;
  laneTitle?: string;
  searchQuery?: string;
}

export const ItemProperties = memo(function ItemProperties({
  item,
  laneTitle,
  searchQuery,
}: ItemPropertiesProps) {
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const path = useNestedEntityPath();

  const showCreated = stateManager.useSetting('show-created-date') !== false;
  const showModified = stateManager.useSetting('show-modified-date') !== false;
  const showStatus = !!stateManager.useSetting('show-status-property');
  const showTags = stateManager.useSetting('show-tags-property') !== false;

  const { createdDate, modifiedDate, tags } = item.data.metadata;
  const createdDateDisplay = createdDate?.split(' ')[0];
  const modifiedDateDisplay = modifiedDate?.split(' ')[0];

  const hasAnyProperty =
    showCreated || showModified || (showStatus && laneTitle) || showTags;

  if (!hasAnyProperty) return null;

  const addTag = useCallback(
    (tag: string) => {
      const normalized = tag.startsWith('#') ? tag : `#${tag}`;
      if (item.data.metadata.tags?.includes(normalized)) return;
      const newTitle = `${item.data.titleRaw} ${normalized}`;
      boardModifiers.updateItem(path, stateManager.updateItemContent(item, newTitle));
    },
    [item, path, boardModifiers, stateManager]
  );

  const removeTag = useCallback(
    (tag: string) => {
      const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const newTitle = item.data.titleRaw.replace(new RegExp(`\\s*${escaped}`), '').trim();
      boardModifiers.updateItem(path, stateManager.updateItemContent(item, newTitle));
    },
    [item, path, boardModifiers, stateManager]
  );

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    stateManager.state?.children?.forEach((lane) => {
      lane.children?.forEach((it) => {
        it.data.metadata.tags?.forEach((t) => tagSet.add(t));
      });
    });
    return Array.from(tagSet).sort();
  }, [stateManager.state]);

  return (
    <div className={c('item-properties')}>
      {showStatus && laneTitle && (
        <PropertyRow icon="●" label={t('Status')}>
          <span className={c('item-property-status-value')}>{laneTitle}</span>
        </PropertyRow>
      )}
      {showCreated && (
        <PropertyRow icon="➕" label={t('Created date')}>
          <span className={c('item-property-value')}>{createdDateDisplay || '—'}</span>
        </PropertyRow>
      )}
      {showModified && (
        <PropertyRow icon="✏️" label={t('Modified date')}>
          <span className={c('item-property-value')}>{modifiedDateDisplay || '—'}</span>
        </PropertyRow>
      )}
      {showTags && (
        <PropertyRow icon="#" label="Tags">
          <TagEditor
            tags={tags || []}
            allTags={allTags}
            onAdd={addTag}
            onRemove={removeTag}
            searchQuery={searchQuery}
          />
        </PropertyRow>
      )}
    </div>
  );
});

function PropertyRow({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: any;
}) {
  return (
    <div className={c('item-property-row')}>
      <span className={c('item-property-row-label')}>
        <span className={c('item-property-icon')}>{icon}</span>
        {label}
      </span>
      <span className={c('item-property-row-value')}>{children}</span>
    </div>
  );
}

interface TagEditorProps {
  tags: string[];
  allTags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  searchQuery?: string;
}

function TagEditor({ tags, allTags, onAdd, onRemove, searchQuery }: TagEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    if (!inputValue) return allTags.filter((t) => !tags.includes(t));
    const query = inputValue.toLowerCase();
    return allTags.filter(
      (t) => !tags.includes(t) && t.toLowerCase().includes(query)
    );
  }, [inputValue, allTags, tags]);

  const handleAdd = useCallback(
    (tag: string) => {
      const cleaned = tag.replace(/^#/, '').trim();
      if (!cleaned) return;
      onAdd(cleaned);
      setInputValue('');
      setIsAdding(false);
    },
    [onAdd]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd(inputValue);
      } else if (e.key === 'Escape') {
        setIsAdding(false);
        setInputValue('');
      }
    },
    [inputValue, handleAdd]
  );

  return (
    <span className={c('tag-editor')}>
      {tags.map((tag, i) => (
        <span
          key={i}
          className={`${c('tag-editor-tag')} ${
            searchQuery && tag.toLowerCase().includes(searchQuery) ? 'is-search-match' : ''
          }`}
        >
          {tag}
          <span
            className={c('tag-editor-remove')}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(tag);
            }}
          >
            ×
          </span>
        </span>
      ))}
      {isAdding ? (
        <span className={c('tag-editor-input-wrapper')}>
          <input
            ref={inputRef}
            type="text"
            className={c('tag-editor-input')}
            value={inputValue}
            placeholder="tag name"
            onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Delay to allow click on suggestion
              setTimeout(() => {
                setIsAdding(false);
                setInputValue('');
              }, 200);
            }}
          />
          {suggestions.length > 0 && (
            <div className={c('tag-editor-suggestions')}>
              {suggestions.slice(0, 8).map((tag) => (
                <div
                  key={tag}
                  className={c('tag-editor-suggestion')}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAdd(tag);
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
          )}
        </span>
      ) : (
        <span
          className={c('tag-editor-add')}
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
        >
          +
        </span>
      )}
    </span>
  );
}
