import { EditorView } from '@codemirror/view';
import { memo } from 'preact/compat';
import {
  Dispatch,
  StateUpdater,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'preact/hooks';
import useOnclickOutside from 'react-cool-onclickoutside';
import { StateManager } from 'src/StateManager';
import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { Path } from 'src/dnd/types';
import { getTaskStatusDone, toggleTaskString } from 'src/parsers/helpers/inlineMetadata';

import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import {
  MarkdownClonedPreviewRenderer,
  MarkdownRenderer,
} from '../MarkdownRenderer/MarkdownRenderer';
import { KanbanContext, SearchContext } from '../context';
import { c, useGetTagColorFn } from '../helpers';
import { EditState, EditingState, Item, isEditing } from '../types';
import { CategorySelect } from './CategorySelect';
import { DateBubble } from './DateBubble';
import { InlineMetadata } from './InlineMetadata';
import { PrioritySelect } from './PrioritySelect';
import { StoryPoints } from './StoryPoints';
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
  constructMenuTimePickerOnChange,
  constructTimePicker,
} from './helpers';

export function useDatePickers(item: Item, explicitPath?: Path) {
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const path = explicitPath || useNestedEntityPath();

  return useMemo(() => {
    const onEditDate = (e: MouseEvent) => {
      constructDatePicker(
        e.view,
        stateManager,
        { x: e.clientX, y: e.clientY },
        constructMenuDatePickerOnChange({
          stateManager,
          boardModifiers,
          item,
          hasDate: true,
          path,
        }),
        item.data.metadata.date?.toDate()
      );
    };

    const onEditTime = (e: MouseEvent) => {
      constructTimePicker(
        e.view, // Preact uses real events, so this is safe
        stateManager,
        { x: e.clientX, y: e.clientY },
        constructMenuTimePickerOnChange({
          stateManager,
          boardModifiers,
          item,
          hasTime: true,
          path,
        }),
        item.data.metadata.time
      );
    };

    return {
      onEditDate,
      onEditTime,
    };
  }, [boardModifiers, path, item, stateManager]);
}

export interface ItemContentProps {
  item: Item;
  setEditState: Dispatch<StateUpdater<EditState>>;
  searchQuery?: string;
  showMetadata?: boolean;
  editState: EditState;
  isStatic: boolean;
}

function checkCheckbox(stateManager: StateManager, title: string, checkboxIndex: number) {
  let count = 0;

  const lines = title.split(/\n\r?/g);
  const results: string[] = [];

  lines.forEach((line) => {
    if (count > checkboxIndex) {
      results.push(line);
      return;
    }

    const match = line.match(/^(\s*>)*(\s*[-+*]\s+?\[)([^\]])(\]\s+)/);

    if (match) {
      if (count === checkboxIndex) {
        const updates = toggleTaskString(line, stateManager.file);
        if (updates) {
          results.push(updates);
        } else {
          const check = match[3] === ' ' ? getTaskStatusDone() : ' ';
          const m1 = match[1] ?? '';
          const m2 = match[2] ?? '';
          const m4 = match[4] ?? '';
          results.push(m1 + m2 + check + m4 + line.slice(match[0].length));
        }
      } else {
        results.push(line);
      }
      count++;
      return;
    }

    results.push(line);
  });

  return results.join('\n');
}

export function Tags({
  tags,
  searchQuery,
  alwaysShow,
}: {
  tags?: string[];
  searchQuery?: string;
  alwaysShow?: boolean;
}) {
  const { stateManager } = useContext(KanbanContext);
  const getTagColor = useGetTagColorFn(stateManager);
  const search = useContext(SearchContext);
  const shouldShow = stateManager.useSetting('move-tags') || alwaysShow;

  if (!tags.length || !shouldShow) return null;

  return (
    <div className={c('item-tags')}>
      {tags.map((tag, i) => {
        const tagColor = getTagColor(tag);

        return (
          <a
            href={tag}
            onClick={(e) => {
              e.preventDefault();

              const tagAction = stateManager.getSetting('tag-action');
              if (search && tagAction === 'kanban') {
                search.search(tag, true);
                return;
              }

              (stateManager.app as any).internalPlugins
                .getPluginById('global-search')
                .instance.openGlobalSearch(`tag:${tag}`);
            }}
            key={i}
            className={`tag ${c('item-tag')} ${
              searchQuery && tag.toLocaleLowerCase().contains(searchQuery) ? 'is-search-match' : ''
            }`}
            style={
              tagColor && {
                '--tag-color': tagColor.color,
                '--tag-background': tagColor.backgroundColor,
              }
            }
          >
            <span>{tag[0]}</span>
            {tag.slice(1)}
          </a>
        );
      })}
    </div>
  );
}

export const ItemContent = memo(function ItemContent({
  item,
  editState,
  setEditState,
  searchQuery,
  showMetadata = true,
  isStatic,
}: ItemContentProps) {
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const titleRef = useRef<string | null>(null);

  useEffect(() => {
    if (editState === EditingState.complete) {
      if (titleRef.current !== null) {
        boardModifiers.updateItem(path, stateManager.updateItemContent(item, titleRef.current));
      }
      titleRef.current = null;
    } else if (editState === EditingState.cancel) {
      titleRef.current = null;
    }
  }, [editState, stateManager, item]);

  const path = useNestedEntityPath();
  const { onEditDate, onEditTime } = useDatePickers(item);
  const onEnter = useCallback(
    (cm: EditorView, mod: boolean, shift: boolean) => {
      if (!allowNewLine(stateManager, mod, shift)) {
        setEditState(EditingState.complete);
        return true;
      }
    },
    [stateManager]
  );

  const onWrapperClick = useCallback(
    (e: MouseEvent) => {
      if (e.targetNode.instanceOf(HTMLElement)) {
        if (e.targetNode.hasClass(c('item-metadata-date'))) {
          onEditDate(e);
        } else if (e.targetNode.hasClass(c('item-metadata-time'))) {
          onEditTime(e);
        }
      }
    },
    [onEditDate, onEditTime]
  );

  const onSubmit = useCallback(() => setEditState(EditingState.complete), []);

  const onEscape = useCallback(() => {
    setEditState(EditingState.cancel);
    return true;
  }, [item]);

  const clickOutsideRef = useOnclickOutside(
    () => setEditState(EditingState.complete),
    {
      ignoreClass: [c('ignore-click-outside'), 'mobile-toolbar', 'suggestion-container'],
    }
  );

  const onCheckboxContainerClick = useCallback(
    (e: PointerEvent) => {
      const target = e.target as HTMLElement;

      if (target.hasClass('task-list-item-checkbox')) {
        if (target.dataset.src) {
          return;
        }

        const checkboxIndex = parseInt(target.dataset.checkboxIndex, 10);
        const checked = checkCheckbox(stateManager, item.data.titleRaw, checkboxIndex);
        const updated = stateManager.updateItemContent(item, checked);

        boardModifiers.updateItem(path, updated);
      }
    },
    [path, boardModifiers, stateManager, item]
  );

  if (!isStatic && isEditing(editState)) {
    return (
      <div ref={clickOutsideRef} className={c('item-input-wrapper')}>
        <MarkdownEditor
          editState={editState}
          className={c('item-input')}
          onEnter={onEnter}
          onEscape={onEscape}
          onSubmit={onSubmit}
          value={item.data.titleRaw}
          onChange={(update) => {
            if (update.docChanged) {
              titleRef.current = update.state.doc.toString().trim();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div onClick={onWrapperClick} className={c('item-title')}>
      {isStatic ? (
        <MarkdownClonedPreviewRenderer
          entityId={item.id}
          className={c('item-markdown')}
          markdownString={item.data.title}
          searchQuery={searchQuery}
          onPointerUp={onCheckboxContainerClick}
        />
      ) : (
        <MarkdownRenderer
          entityId={item.id}
          className={c('item-markdown')}
          markdownString={item.data.title}
          searchQuery={searchQuery}
          onPointerUp={onCheckboxContainerClick}
        />
      )}
      {showMetadata && (
        <div className={c('item-metadata')}>
          <InlineMetadata item={item} stateManager={stateManager} />
          <Tags tags={item.data.metadata.tags} searchQuery={searchQuery} />
          <div className={c('item-metadata-bottom')}>
            <span className={c('item-metadata-bottom-left')}>
              <DateBubble item={item} isStatic={isStatic} />
              <CategorySelect item={item} isStatic={isStatic} />
            </span>
            <span className={c('item-metadata-bottom-right')}>
              <PrioritySelect item={item} isStatic={isStatic} />
              <StoryPoints item={item} isStatic={isStatic} />
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
