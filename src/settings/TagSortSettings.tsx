import classcat from 'classcat';
import update from 'immutability-helper';
import { JSX, createPortal, render, unmountComponentAtNode } from 'preact/compat';
import { Dispatch, StateUpdater, useContext, useEffect, useRef, useState } from 'preact/hooks';

import { Icon } from '../components/Icon/Icon';
import { c, generateInstanceId, noop, useIMEInputProps } from '../components/helpers';
import { DataTypes, TagSortSetting, TagSortSettingTemplate } from '../components/types';
import { DndContext } from '../dnd/components/DndContext';
import { DragOverlay } from '../dnd/components/DragOverlay';
import { Droppable } from '../dnd/components/Droppable';
import { DndScope } from '../dnd/components/Scope';
import { SortPlaceholder } from '../dnd/components/SortPlaceholder';
import { Sortable } from '../dnd/components/Sortable';
import { DndManagerContext } from '../dnd/components/context';
import { useDragHandle } from '../dnd/managers/DragManager';
import { Entity } from '../dnd/types';
import { getParentBodyElement, getParentWindow } from '../dnd/util/getWindow';
import { t } from '../lang/helpers';

interface ItemProps {
  tagIndex: number;
  isStatic?: boolean;
  tag: TagSortSetting;
  deleteTag: () => void;
  updateTag: (value: string) => void;
}

interface TagSortSettingsProps {
  tags: TagSortSetting[];
  scrollEl: HTMLElement;
  onChange(tags: TagSortSetting[]): void;
  portalContainer: HTMLElement;
}

interface UseKeyModifiersParams {
  onChange(tags: TagSortSetting[]): void;
  inputValue: string;
  tags: TagSortSetting[];
  setTags: Dispatch<StateUpdater<TagSortSetting[]>>;
  win: Window;
}

function Item({ isStatic, tagIndex, tag, deleteTag, updateTag }: ItemProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const bindHandle = useDragHandle(measureRef, dragHandleRef);

  const body = (
    <div className={c('setting-controls-wrapper')}>
      <div className={c('setting-input-wrapper')}>
        <div>
          <input
            type="text"
            value={tag.data.tag}
            onChange={(e) => updateTag((e.target as HTMLInputElement).value)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div ref={measureRef} className={c('setting-item-wrapper')}>
      <div ref={elementRef} className={c('setting-item')}>
        {isStatic ? (
          body
        ) : (
          <Droppable
            elementRef={elementRef}
            measureRef={measureRef}
            id={tag.id}
            index={tagIndex}
            data={tag}
          >
            {body}
          </Droppable>
        )}
        <div className={c('setting-button-wrapper')}>
          <div className="clickable-icon" onClick={deleteTag} aria-label={t('Delete')}>
            <Icon name="lucide-trash-2" />
          </div>
          <div
            className="mobile-option-setting-drag-icon clickable-icon"
            aria-label={t('Drag to rearrange')}
            ref={bindHandle}
          >
            <Icon name="lucide-grip-horizontal" />
          </div>
        </div>
      </div>
    </div>
  );
}

function useKeyModifiers({ onChange, inputValue, tags, setTags }: UseKeyModifiersParams) {
  const updateKeys = (tags: TagSortSetting[]) => {
    onChange(tags);
    setTags(tags);
  };

  return {
    updateTag: (i: number) => (value: string) => {
      updateKeys(
        update(tags, {
          [i]: {
            data: {
              tag: {
                $set: value,
              },
            },
          },
        })
      );
    },

    deleteTag: (i: number) => () => {
      updateKeys(
        update(tags, {
          $splice: [[i, 1]],
        })
      );
    },

    newTag: () => {
      updateKeys(
        update(tags, {
          $push: [
            {
              ...TagSortSettingTemplate,
              id: generateInstanceId(),
              data: {
                tag: inputValue,
              },
            },
          ],
        })
      );
    },

    moveTag: (drag: Entity, drop: Entity) => {
      const dragPath = drag.getPath();
      const dropPath = drop.getPath();

      const dragIndex = dragPath[dragPath.length - 1];
      const dropIndex = dropPath[dropPath.length - 1];

      if (dragIndex === dropIndex) {
        return;
      }

      const clone = tags.slice();
      const [removed] = clone.splice(dragIndex, 1);
      clone.splice(dropIndex, 0, removed);

      updateKeys(clone);
    },
  };
}

const accepts = [DataTypes.TagSortSetting];

interface OverlayProps {
  keys: TagSortSetting[];
  portalContainer: HTMLElement;
}

function Overlay({ keys, portalContainer }: OverlayProps) {
  return createPortal(
    <DragOverlay>
      {(entity, styles) => {
        const path = entity.getPath();
        const index = path[0];
        const item = keys[index];

        return (
          <div
            className={classcat([c('drag-container'), c('tag-sort-input-wrapper')])}
            style={styles}
          >
            <Item tag={item} tagIndex={index} updateTag={noop} deleteTag={noop} isStatic={true} />
          </div>
        );
      }}
    </DragOverlay>,
    portalContainer
  );
}

function RespondToScroll({ scrollEl }: { scrollEl: HTMLElement }): JSX.Element | null {
  const dndManager = useContext(DndManagerContext);

  useEffect(() => {
    let debounce = 0;

    const onScroll = () => {
      scrollEl.win.clearTimeout(debounce);
      debounce = scrollEl.win.setTimeout(() => {
        dndManager?.hitboxEntities.forEach((entity) => {
          entity.recalcInitial();
        });
      }, 100);
    };

    scrollEl.addEventListener('scroll', onScroll, {
      passive: true,
      capture: false,
    });

    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
    };
  }, [scrollEl, dndManager]);

  return null;
}

function TagSettings(props: TagSortSettingsProps) {
  const [tags, setTags] = useState(props.tags);
  const [inputValue, setInputValue] = useState('');
  const { getShouldIMEBlockAction, ...inputProps } = useIMEInputProps();
  const win = getParentWindow(props.scrollEl);

  const { updateTag, deleteTag, newTag, moveTag } = useKeyModifiers({
    onChange: props.onChange,
    inputValue,
    tags,
    setTags,
    win,
  });

  return (
    <div className={c('tag-sort-input-wrapper')}>
      <div className="setting-item-info">
        <div className="setting-item-name">{t('Tag sort order')}</div>
        <div className="setting-item-description">
          {t('Set an explicit sort order for the specified tags.')}
        </div>
      </div>
      <div>
        <DndContext win={win} onDrop={moveTag}>
          <RespondToScroll scrollEl={props.scrollEl} />
          <DndScope>
            <Sortable axis="vertical">
              {tags.map((k, i) => {
                return (
                  <Item
                    key={k.id}
                    tag={k}
                    tagIndex={i}
                    updateTag={updateTag(i)}
                    deleteTag={deleteTag(i)}
                  />
                );
              })}
              <SortPlaceholder accepts={accepts} index={tags.length} />
            </Sortable>
          </DndScope>
          <Overlay keys={tags} portalContainer={props.portalContainer} />
        </DndContext>
      </div>
      <div className={c('setting-key-input-wrapper')}>
        <input
          placeholder="#tag"
          type="text"
          value={inputValue}
          onChange={(e) => {
            const val = (e.target as HTMLInputElement).value;
            setInputValue(val[0] === '#' ? val : '#' + val);
          }}
          onKeyDown={(e) => {
            if (getShouldIMEBlockAction()) return;

            if (e.key === 'Enter') {
              newTag();
              setInputValue('');
              return;
            }

            if (e.key === 'Escape') {
              setInputValue('');
              (e.target as HTMLInputElement).blur();
            }
          }}
          {...inputProps}
        />
        <button
          onClick={() => {
            newTag();
            setInputValue('');
            return;
          }}
        >
          {t('Add tag')}
        </button>
      </div>
    </div>
  );
}

export function renderTagSortSettings(
  containerEl: HTMLElement,
  scrollEl: HTMLElement,
  tags: TagSortSetting[],
  onChange: (key: TagSortSetting[]) => void
) {
  render(
    <TagSettings
      tags={tags}
      scrollEl={scrollEl}
      onChange={onChange}
      portalContainer={getParentBodyElement(containerEl)}
    />,
    containerEl
  );
}

export function cleanUpTagSortSettings(containerEl: HTMLElement) {
  unmountComponentAtNode(containerEl);
}
