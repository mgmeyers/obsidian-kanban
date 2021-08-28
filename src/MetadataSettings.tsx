import update from 'immutability-helper';
import React from 'react';
import ReactDOM from 'react-dom';

import {
  c,
  generateInstanceId,
  noop,
  useIMEInputProps,
} from './components/helpers';
import { Icon } from './components/Icon/Icon';
import {
  DataTypes,
  MetadataSetting,
  MetadataSettingTemplate,
} from './components/types';
import { DndManagerContext } from './dnd/components/context';
import { DndContext } from './dnd/components/DndContext';
import { DragOverlay } from './dnd/components/DragOverlay';
import { Droppable } from './dnd/components/Droppable';
import { DndScope } from './dnd/components/Scope';
import { Sortable } from './dnd/components/Sortable';
import { SortPlaceholder } from './dnd/components/SortPlaceholder';
import { useDragHandle } from './dnd/managers/DragManager';
import { Entity } from './dnd/types';
import { t } from './lang/helpers';

interface ItemProps {
  itemIndex: number;
  isStatic?: boolean;
  item: MetadataSetting;
  deleteKey: () => void;
  toggleShouldHideLabel: () => void;
  toggleContainsMarkdown: () => void;
  updateKey: (value: string) => void;
  updateLabel: (value: string) => void;
}

function Item({
  isStatic,
  itemIndex,
  item,
  toggleShouldHideLabel,
  toggleContainsMarkdown,
  deleteKey,
  updateKey,
  updateLabel,
}: ItemProps) {
  const elementRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const dragHandleRef = React.useRef<HTMLDivElement>(null);

  useDragHandle(measureRef, dragHandleRef);

  const body = (
    <div className={c('setting-controls-wrapper')}>
      <div className={c('setting-input-wrapper')}>
        <div>
          <div className={c('setting-item-label')}>{t('Metadata key')}</div>
          <input
            type="text"
            value={item.data.metadataKey}
            onChange={(e) => updateKey(e.target.value)}
          />
        </div>
        <div>
          <div className={c('setting-item-label')}>{t('Display label')}</div>
          <input
            type="text"
            value={item.data.label}
            onChange={(e) => updateLabel(e.target.value)}
          />
        </div>
      </div>
      <div className={c('setting-toggle-wrapper')}>
        <div>
          <div
            className={`checkbox-container ${
              item.data.shouldHideLabel ? 'is-enabled' : ''
            }`}
            onClick={toggleShouldHideLabel}
            aria-label={t('Hide label')}
          />
          <div className={c('setting-item-label')}>{t('Hide label')}</div>
        </div>
        <div>
          <div
            className={`checkbox-container ${
              item.data.containsMarkdown ? 'is-enabled' : ''
            }`}
            onClick={toggleContainsMarkdown}
            aria-label={t('Field contains markdown')}
          />
          <div className={c('setting-item-label')}>
            {t('Field contains markdown')}
          </div>
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
            id={item.id}
            index={itemIndex}
            data={item}
          >
            {body}
          </Droppable>
        )}
        <div className={c('setting-button-wrapper')}>
          <div onClick={deleteKey} aria-label={t('Delete')}>
            <Icon name="cross" />
          </div>
          <div
            className="mobile-option-setting-drag-icon"
            aria-label={t('Drag to rearrange')}
            ref={dragHandleRef}
          >
            <Icon name="three-horizontal-bars" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetadataSettingsProps {
  dataKeys: MetadataSetting[];
  scrollEl: HTMLElement;
  onChange(keys: MetadataSetting[]): void;
}

interface UseKeyModifiersParams {
  onChange(keys: MetadataSetting[]): void;
  inputValue: string;
  keys: MetadataSetting[];
  setKeys: React.Dispatch<React.SetStateAction<MetadataSetting[]>>;
}

function useKeyModifiers({
  onChange,
  inputValue,
  keys,
  setKeys,
}: UseKeyModifiersParams) {
  const updateKeys = (keys: MetadataSetting[]) => {
    onChange(keys);
    setKeys(keys);
  };

  return {
    updateKey: (i: number) => (value: string) => {
      updateKeys(
        update(keys, {
          [i]: {
            data: {
              metadataKey: {
                $set: value,
              },
            },
          },
        })
      );
    },

    updateLabel: (i: number) => (value: string) => {
      updateKeys(
        update(keys, {
          [i]: {
            data: {
              label: {
                $set: value,
              },
            },
          },
        })
      );
    },

    toggleShouldHideLabel: (i: number) => () => {
      updateKeys(
        update(keys, {
          [i]: {
            data: {
              $toggle: ['shouldHideLabel'],
            },
          },
        })
      );
    },

    toggleContainsMarkdown: (i: number) => () => {
      updateKeys(
        update(keys, {
          [i]: {
            data: {
              $toggle: ['containsMarkdown'],
            },
          },
        })
      );
    },

    deleteKey: (i: number) => () => {
      updateKeys(
        update(keys, {
          $splice: [[i, 1]],
        })
      );
    },

    newKey: () => {
      updateKeys(
        update(keys, {
          $push: [
            {
              ...MetadataSettingTemplate,
              id: generateInstanceId(),
              data: {
                metadataKey: inputValue,
                label: '',
                shouldHideLabel: false,
                containsMarkdown: false,
              },
            },
          ],
        })
      );
    },

    moveKey: (drag: Entity, drop: Entity) => {
      const dragPath = drag.getPath();
      const dropPath = drop.getPath();

      const dragIndex = dragPath[dragPath.length - 1];
      const dropIndex = dropPath[dropPath.length - 1];

      if (dragIndex === dropIndex) {
        return;
      }

      const clone = keys.slice();
      const [removed] = clone.splice(dragIndex, 1);
      clone.splice(dropIndex, 0, removed);

      updateKeys(clone);
    },
  };
}

const accepts = [DataTypes.MetadataSetting];

function Overlay({ keys }: { keys: MetadataSetting[] }) {
  return ReactDOM.createPortal(
    <DragOverlay>
      {(entity, styles) => {
        const path = entity.getPath();
        const index = path[0];
        const item = keys[index];

        return (
          <div className={c('drag-container')} style={styles}>
            <Item
              item={item}
              itemIndex={index}
              updateKey={noop}
              updateLabel={noop}
              toggleShouldHideLabel={noop}
              toggleContainsMarkdown={noop}
              deleteKey={noop}
              isStatic={true}
            />
          </div>
        );
      }}
    </DragOverlay>,
    document.body
  );
}

function RespondToScroll({ scrollEl }: { scrollEl: HTMLElement }): JSX.Element {
  const dndManager = React.useContext(DndManagerContext);

  React.useEffect(() => {
    let debounce = 0;

    const onScroll = () => {
      clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        dndManager.hitboxEntities.forEach((entity) => {
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

function MetadataSettings(props: MetadataSettingsProps) {
  const [keys, setKeys] = React.useState(props.dataKeys);
  const [inputValue, setInputValue] = React.useState('');
  const { getShouldIMEBlockAction, ...inputProps } = useIMEInputProps();

  const {
    updateKey,
    updateLabel,
    toggleShouldHideLabel,
    toggleContainsMarkdown,
    deleteKey,
    newKey,
    moveKey,
  } = useKeyModifiers({
    onChange: props.onChange,
    inputValue,
    keys,
    setKeys,
  });

  return (
    <>
      <DndContext onDrop={moveKey}>
        <RespondToScroll scrollEl={props.scrollEl} />
        <DndScope>
          <Sortable axis="vertical">
            {keys.map((k, i) => {
              return (
                <Item
                  key={k.id}
                  item={k}
                  itemIndex={i}
                  updateKey={updateKey(i)}
                  updateLabel={updateLabel(i)}
                  toggleShouldHideLabel={toggleShouldHideLabel(i)}
                  toggleContainsMarkdown={toggleContainsMarkdown(i)}
                  deleteKey={deleteKey(i)}
                />
              );
            })}
            <SortPlaceholder accepts={accepts} index={keys.length} />
          </Sortable>
        </DndScope>
        <Overlay keys={keys} />
      </DndContext>
      <div className={c('setting-key-input-wrapper')}>
        <input
          placeholder={t('Metadata key')}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (getShouldIMEBlockAction()) return;

            if (e.key === 'Enter') {
              newKey();
              setInputValue('');
              const target = e.target as HTMLInputElement;

              setTimeout(() => {
                target.scrollIntoView();
              });
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
          onClick={(e) => {
            newKey();
            setInputValue('');
            const target = e.target as HTMLElement;

            setTimeout(() => {
              target.scrollIntoView();
            });
            return;
          }}
        >
          {t('Add key')}
        </button>
      </div>
    </>
  );
}

export function renderMetadataSettings(
  containerEl: HTMLElement,
  scrollEl: HTMLElement,
  keys: MetadataSetting[],
  onChange: (key: MetadataSetting[]) => void
) {
  ReactDOM.render(
    <MetadataSettings
      dataKeys={keys}
      scrollEl={scrollEl}
      onChange={onChange}
    />,
    containerEl
  );
}

export function cleanupMetadataSettings(containerEl: HTMLElement) {
  ReactDOM.unmountComponentAtNode(containerEl);
}
