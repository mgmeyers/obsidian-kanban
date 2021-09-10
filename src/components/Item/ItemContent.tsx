import React from 'react';

import { useNestedEntityPath } from 'src/dnd/components/Droppable';

import { KanbanContext } from '../context';
import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { c } from '../helpers';
import { MarkdownDomRenderer } from '../MarkdownRenderer';
import { Item } from '../types';
import { DateAndTime, RelativeDate } from './DateAndTime';

export interface ItemContentProps {
  item: Item;
  isSettingsVisible: boolean;
  setIsSettingsVisible?: React.Dispatch<boolean>;
  searchQuery?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onEditDate?: React.MouseEventHandler;
  onEditTime?: React.MouseEventHandler;
}

export const ItemContent = React.memo(function ItemContent({
  item,
  isSettingsVisible,
  setIsSettingsVisible,
  searchQuery,
  onChange,
  onEditDate,
  onEditTime,
}: ItemContentProps) {
  const { stateManager, filePath, boardModifiers } =
    React.useContext(KanbanContext);
  const path = useNestedEntityPath();

  const onEnter = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!allowNewLine(e, stateManager)) {
        e.preventDefault();
        setIsSettingsVisible(false);
        return true;
      }
    },
    [stateManager]
  );
  const onEscape = React.useCallback(() => {
    setIsSettingsVisible(false);
    return true;
  }, []);

  const hideTagsDisplay = stateManager.useSetting('hide-tags-display');

  const onCheckboxContainerClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      if (target.hasClass('task-list-item-checkbox')) {
        const index = parseInt(target.dataset.checkboxIndex, 10);

        let count = 0;

        const checked = item.data.titleRaw.replace(
          /^(\s*[-+*]\s+?\[)([^\]])(\]\s+)/gm,
          (sub, before, check, after) => {
            let match = sub;

            if (count === index) {
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

        stateManager.parser
          .updateItem(item, checked)
          .then((item) => {
            boardModifiers.updateItem(path, item);
          })
          .catch((e) => console.error(e));
      }
    },
    [path, boardModifiers, stateManager, item]
  );

  if (isSettingsVisible) {
    return (
      <MarkdownEditor
        className={c('item-input')}
        onChange={onChange}
        onEnter={onEnter}
        onEscape={onEscape}
        value={item.data.titleRaw}
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
