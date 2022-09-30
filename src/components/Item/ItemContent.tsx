import { TFile } from 'obsidian';
import Preact from 'preact/compat';

import { useNestedEntityPath } from 'src/dnd/components/Droppable';

import { KanbanContext } from '../context';
import { handlePaste } from '../Editor/helpers';
import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { c } from '../helpers';
import { MarkdownDomRenderer } from '../MarkdownRenderer';
import { Item } from '../types';
import { DateAndTime, RelativeDate } from './DateAndTime';
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
  constructMenuTimePickerOnChange,
  constructTimePicker,
} from './helpers';

function useDatePickers(item: Item) {
  const { stateManager, boardModifiers } = Preact.useContext(KanbanContext);
  const path = useNestedEntityPath();

  return Preact.useMemo(() => {
    const onEditDate: Preact.JSX.MouseEventHandler<HTMLSpanElement> = (e) => {
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

    const onEditTime: Preact.JSX.MouseEventHandler<HTMLSpanElement> = (e) => {
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
  isEditing: boolean;
  setIsEditing: Preact.StateUpdater<boolean>;
  searchQuery?: string;
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

export const ItemContent = Preact.memo(function ItemContent({
  item,
  isEditing,
  setIsEditing,
  searchQuery,
}: ItemContentProps) {
  const [editState, setEditState] = Preact.useState(item.data.titleRaw);
  const {
    stateManager,
    filePath,
    boardModifiers,
    view,
    getTagColor,
    getDateColor,
  } = Preact.useContext(KanbanContext);

  const hideTagsDisplay = stateManager.useSetting('hide-tags-display');
  const path = useNestedEntityPath();

  const { onEditDate, onEditTime } = useDatePickers(item);

  Preact.useEffect(() => {
    if (isEditing) {
      setEditState(item.data.titleRaw);
    }
  }, [isEditing]);

  const onEnter = Preact.useCallback(
    (e: KeyboardEvent) => {
      if (!allowNewLine(e, stateManager)) {
        e.preventDefault();

        stateManager
          .updateItemContent(item, editState)
          .then((item) => {
            boardModifiers.updateItem(path, item);
          })
          .catch((e) => {
            stateManager.setError(e);
            console.error(e);
          });

        setIsEditing(false);
        return true;
      }
    },
    [stateManager, editState, item, path]
  );

  const onSubmit = Preact.useCallback(() => {
    stateManager
      .updateItemContent(item, editState)
      .then((item) => {
        boardModifiers.updateItem(path, item);
      })
      .catch((e) => {
        stateManager.setError(e);
        console.error(e);
      });

    setIsEditing(false);
  }, [stateManager, editState, item, path]);

  const onEscape = Preact.useCallback(() => {
    setIsEditing(false);
    setEditState(item.data.titleRaw);
    return true;
  }, [item]);

  const onCheckboxContainerClick = Preact.useCallback(
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

  if (isEditing) {
    return (
      <div className={c('item-input-wrapper')}>
        <MarkdownEditor
          className={c('item-input')}
          onChange={(e) =>
            setEditState((e.target as HTMLTextAreaElement).value)
          }
          onEnter={onEnter}
          onEscape={onEscape}
          onSubmit={onSubmit}
          value={editState}
          onPaste={(e) => {
            handlePaste(e, stateManager, view.getWindow());
          }}
        />
      </div>
    );
  }

  return (
    <div className={c('item-title')}>
      <MarkdownDomRenderer
        className={c('item-markdown')}
        dom={item.data.dom}
        searchQuery={searchQuery}
        onPointerDown={onCheckboxContainerClick}
      />
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
        {!hideTagsDisplay && !!item.data.metadata.tags?.length && (
          <div className={c('item-tags')}>
            {item.data.metadata.tags.map((tag, i) => {
              const tagColor = getTagColor(tag);

              return (
                <a
                  href={tag}
                  key={i}
                  className={`tag ${c('item-tag')} ${
                    tag.toLocaleLowerCase().contains(searchQuery)
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
        )}
      </div>
    </div>
  );
});
