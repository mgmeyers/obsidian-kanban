import React from 'react';

import { useNestedEntityPath } from 'src/dnd/components/Droppable';

import { KanbanContext } from '../context';
import { getDropAction } from '../Editor/helpers';
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
  handleDragOrPaste,
} from './helpers';

function useDatePickers(item: Item) {
  const { stateManager, boardModifiers } = React.useContext(KanbanContext);
  const path = useNestedEntityPath();

  return React.useMemo(() => {
    const onEditDate: React.MouseEventHandler = (e) => {
      constructDatePicker(
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

    const onEditTime: React.MouseEventHandler = (e) => {
      constructTimePicker(
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
  setIsEditing: React.Dispatch<boolean>;
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

export const ItemContent = React.memo(function ItemContent({
  item,
  isEditing,
  setIsEditing,
  searchQuery,
}: ItemContentProps) {
  const [editState, setEditState] = React.useState(item.data.titleRaw);
  const { stateManager, filePath, boardModifiers } =
    React.useContext(KanbanContext);

  const hideTagsDisplay = stateManager.useSetting('hide-tags-display');
  const path = useNestedEntityPath();

  const { onEditDate, onEditTime } = useDatePickers(item);

  React.useEffect(() => {
    if (isEditing) {
      setEditState(item.data.titleRaw);
    }
  }, [isEditing]);

  const onEnter = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!allowNewLine(e, stateManager)) {
        e.preventDefault();

        stateManager.parser
          .updateItem(item, editState)
          .then((item) => {
            boardModifiers.updateItem(path, item);
          })
          .catch((e) => console.error(e));

        setIsEditing(false);
        return true;
      }
    },
    [stateManager, editState]
  );

  const onEscape = React.useCallback(() => {
    setIsEditing(false);
    setEditState(item.data.titleRaw);
    return true;
  }, [item]);

  const onCheckboxContainerClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      if (target.hasClass('task-list-item-checkbox')) {
        const checkboxIndex = parseInt(target.dataset.checkboxIndex, 10);

        stateManager.parser
          .updateItem(item, checkCheckbox(item.data.titleRaw, checkboxIndex))
          .then((item) => {
            boardModifiers.updateItem(path, item);
          })
          .catch((e) => console.error(e));
      }
    },
    [path, boardModifiers, stateManager, item]
  );

  if (isEditing) {
    return (
      <MarkdownEditor
        className={c('item-input')}
        onChange={(e) => setEditState((e.target as HTMLTextAreaElement).value)}
        onEnter={onEnter}
        onEscape={onEscape}
        value={editState}
        onDragOver={(e) => {
          const action = getDropAction(stateManager, e.dataTransfer);

          if (action) {
            e.dataTransfer.dropEffect = action;
            e.preventDefault();
            return false;
          }
        }}
        onDrop={(e) => {
          setEditState(
            (state) =>
              state +
              handleDragOrPaste(
                stateManager,
                filePath,
                e.dataTransfer,
                e.shiftKey
              ).join('\n')
          );
        }}
      />
    );
  }

  return (
    <div className={c('item-title')}>
      <MarkdownDomRenderer
        className={c('item-markdown')}
        dom={item.data.dom}
        searchQuery={searchQuery}
        onClick={onCheckboxContainerClick}
      />
      <div className={c('item-metadata')}>
        <RelativeDate item={item} stateManager={stateManager} />
        <DateAndTime
          item={item}
          stateManager={stateManager}
          filePath={filePath}
          onEditDate={onEditDate}
          onEditTime={onEditTime}
        />
        {!hideTagsDisplay && !!item.data.metadata.tags?.length && (
          <div className={c('item-tags')}>
            {item.data.metadata.tags.map((tag, i) => {
              return (
                <a
                  href={tag}
                  key={i}
                  className={`tag ${c('item-tag')} ${
                    tag.toLocaleLowerCase().contains(searchQuery)
                      ? 'is-search-match'
                      : ''
                  }`}
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
