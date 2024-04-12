import { EditorView } from '@codemirror/view';
import { TFile } from 'obsidian';
import { JSX, memo } from 'preact/compat';
import {
  StateUpdater,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'preact/hooks';
import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { Path } from 'src/dnd/types';

import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { MarkdownPreviewRenderer } from '../MarkdownRenderer';
import { KanbanContext } from '../context';
import { c } from '../helpers';
import { EditState, EditingState, Item, isEditing } from '../types';
import { DateAndTime, RelativeDate } from './DateAndTime';
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
    const onEditDate: JSX.MouseEventHandler<HTMLSpanElement> = (e) => {
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

    const onEditTime: JSX.MouseEventHandler<HTMLSpanElement> = (e) => {
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
  setEditState: StateUpdater<EditState>;
  searchQuery?: string;
  showMetadata?: boolean;
  editState: EditState;
  priority?: number;
}

function checkCheckbox(title: string, checkboxIndex: number) {
  let count = 0;

  return title.replace(
    /^(\s*[-+*]\s+?\[)([^\]])(\]\s+)/gm,
    (sub, before, check, after) => {
      let match = sub;

      if (count === checkboxIndex) {
        if (check === ' ') {
          match = `${before}x${after}`;
        } else {
          match = `${before} ${after}`;
        }
      }

      count++;

      return match;
    }
  );
}

async function checkEmbeddedCheckbox(checkbox: HTMLElement) {
  const file = app.vault.getAbstractFileByPath(checkbox.dataset.src);

  if (!(file instanceof TFile)) return;

  const content = await app.vault.cachedRead(file);
  const start = parseInt(checkbox.dataset.oStart);
  const end = parseInt(checkbox.dataset.oEnd);
  const li = content.substring(start, end);

  const updated = li.replace(/^(.+?)\[(.)\](.+)$/, (_, g1, g2, g3) => {
    if (g2 !== ' ') {
      checkbox.parentElement.removeClass('is-checked');
      checkbox.parentElement.dataset.task = '';
      return `${g1}[ ]${g3}`;
    }

    checkbox.parentElement.addClass('is-checked');
    checkbox.parentElement.dataset.task = 'x';
    return `${g1}[x]${g3}`;
  });

  await app.vault.modify(
    file,
    `${content.substring(0, start)}${updated}${content.substring(end)}`
  );
}

export function Tags({
  tags,
  searchQuery,
  isDisplay = true,
}: {
  tags?: string[];
  searchQuery?: string;
  isDisplay?: boolean;
}) {
  const { stateManager, getTagColor } = useContext(KanbanContext);

  const hideTagsDisplay =
    isDisplay && stateManager.useSetting('hide-tags-display');
  if (hideTagsDisplay || !tags?.length) return null;
  return (
    <div className={c('item-tags')}>
      {tags.map((tag, i) => {
        const tagColor = getTagColor(tag);

        return (
          <a
            href={tag}
            key={i}
            className={`tag ${c('item-tag')} ${
              searchQuery && tag.toLocaleLowerCase().contains(searchQuery)
                ? 'is-search-match'
                : ''
            }`}
            style={
              tagColor && {
                '--tag-color': tagColor.color,
                '--tag-background-color': tagColor.backgroundColor,
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
  priority = 0,
  showMetadata = true,
}: ItemContentProps) {
  const { stateManager, filePath, boardModifiers, getDateColor } =
    useContext(KanbanContext);
  const titleRef = useRef<string | null>(null);

  useEffect(() => {
    if (editState === EditingState.complete) {
      if (titleRef.current !== null) {
        stateManager
          .updateItemContent(item, titleRef.current)
          .then((item) => {
            boardModifiers.updateItem(path, item);
          })
          .catch((e) => {
            stateManager.setError(e);
            console.error(e);
          });
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

  const onSubmit = useCallback(() => setEditState(EditingState.complete), []);

  const onEscape = useCallback(() => {
    setEditState(EditingState.cancel);
    return true;
  }, [item]);

  const onCheckboxContainerClick = useCallback(
    (e: PointerEvent) => {
      const target = e.target as HTMLElement;

      if (target.hasClass('task-list-item-checkbox')) {
        if (target.dataset.src) {
          return checkEmbeddedCheckbox(target);
        }

        const checkboxIndex = parseInt(target.dataset.checkboxIndex, 10);

        stateManager
          .updateItemContent(
            item,
            checkCheckbox(item.data.titleRaw, checkboxIndex)
          )
          .then((item) => {
            boardModifiers.updateItem(path, item);
          })
          .catch((e) => {
            stateManager.setError(e);
            console.error(e);
          });
      }
    },
    [path, boardModifiers, stateManager, item]
  );

  if (isEditing(editState)) {
    return (
      <div className={c('item-input-wrapper')}>
        <MarkdownEditor
          editState={editState}
          className={c('item-input')}
          onEnter={onEnter}
          onEscape={onEscape}
          onSubmit={onSubmit}
          value={item.data.titleRaw}
          onChange={(update) => {
            titleRef.current = update.state.doc.toString().trim();
          }}
        />
      </div>
    );
  }

  return (
    <div className={c('item-title')}>
      <MarkdownPreviewRenderer
        priority={priority}
        className={c('item-markdown')}
        markdownString={item.data.title}
        searchQuery={searchQuery}
        onPointerUp={onCheckboxContainerClick}
      />
      {showMetadata && (
        <div className={c('item-metadata')}>
          <RelativeDate item={item} stateManager={stateManager} />
          <DateAndTime
            item={item}
            stateManager={stateManager}
            filePath={filePath}
            onEditDate={onEditDate}
            onEditTime={onEditTime}
            getDateColor={getDateColor}
          />
          <Tags tags={item.data.metadata.tags} searchQuery={searchQuery} />
        </div>
      )}
    </div>
  );
});
