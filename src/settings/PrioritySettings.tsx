import { colord } from 'colord';
import update from 'immutability-helper';
import Preact from 'preact/compat';
import { RgbaStringColorPicker } from 'react-colorful';
import useOnclickOutside from 'react-cool-onclickoutside';

import { c, generateInstanceId } from '../components/helpers';
import { Icon } from '../components/Icon/Icon';
import {
  PriorityKey,
  PrioritySetting,
  PrioritySettingTemplate,
} from '../components/types';
import { getParentBodyElement } from '../dnd/util/getWindow';
import { t } from '../lang/helpers';

interface ItemProps {
  priorityKey: PriorityKey;
  deleteKey: () => void;
  updateKey: (priorityKey: string, color: string, backgroundColor: string) => void;
  defaultColors: { color: string; backgroundColor: string };
}

export function colorToRgbaString(color: string) {
  const parsed = colord(color);

  if (!parsed.isValid()) {
    return null;
  }

  const rgba = parsed.toRgb();
  return {
    rgba: `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`,
    hexa: parsed.toHex(),
  };
}

export interface ColorPickerInputProps {
  color?: string;
  setColor: (color: string) => void;
  defaultColor: string;
}

export function ColorPickerInput({
  color,
  setColor,
  defaultColor,
}: ColorPickerInputProps) {
  const [localRGB, setLocalRGB] = Preact.useState(color || defaultColor);
  const [localHEX, setLocalHEX] = Preact.useState(color || defaultColor);
  const [isPickerVisible, setIsPickerVisible] = Preact.useState(false);
  const onChange = Preact.useCallback(
    (newColor: string) => {
      const normalized = colorToRgbaString(newColor || defaultColor);
      if (normalized) {
        setLocalHEX(normalized.hexa);
        setLocalRGB(normalized.rgba);
        setColor(normalized.rgba);
      }
    },
    [setColor]
  );

  Preact.useEffect(() => {
    if (!color || !defaultColor) return;

    const normalized = colorToRgbaString(color || defaultColor);
    if (normalized) {
      setLocalRGB(normalized.rgba);
      setLocalHEX(normalized.hexa);
    }
  }, []);

  const clickOutsideRef = useOnclickOutside(() => {
    setIsPickerVisible(false);
  });

  return (
    <div ref={clickOutsideRef} className={c('color-picker-wrapper')}>
      {isPickerVisible && (
        <div className={c('color-picker')}>
          <RgbaStringColorPicker color={localRGB} onChange={onChange} />
        </div>
      )}
      <input
        type="text"
        value={localHEX}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
        onFocus={() => {
          setIsPickerVisible(true);
        }}
      />
    </div>
  );
}

function Item({ priorityKey, deleteKey, updateKey, defaultColors }: ItemProps) {
  return (
    <div className={c('setting-item-wrapper')}>
      <div className={c('setting-item')}>
        <div
          className={`${c('setting-controls-wrapper')} ${c('tag-color-input')}`}
        >
          <div className={c('setting-input-wrapper')}>
            <div>
              <div className={c('setting-item-label')}>{t('Priority')}</div>
              <input
                type="text"
                placeholder="item priority"
                value={priorityKey.priority}
                onChange={(e) => {
                  updateKey(
                    e.currentTarget.value,
                    priorityKey.color,
                    priorityKey.backgroundColor
                  );
                }}
              />
            </div>
            <div>
              <div className={c('setting-item-label')}>
                {t('Background color')}
              </div>
              <ColorPickerInput
                color={priorityKey.backgroundColor}
                setColor={(color) => {
                  updateKey(priorityKey.priority, priorityKey.color, color);
                }}
                defaultColor={defaultColors.backgroundColor}
              />
            </div>
            <div>
              <div className={c('setting-item-label')}>{t('Text color')}</div>
              <ColorPickerInput
                color={priorityKey.color}
                setColor={(color) => {
                  updateKey(
                    priorityKey.priority,
                    color,
                    priorityKey.backgroundColor
                  );
                }}
                defaultColor={defaultColors.color}
              />
            </div>
          </div>
          <div className={c('setting-toggle-wrapper')}>
            <div>
              <div className={c('item-priority')}>
                <span className={`tag ${c('item-priority-tag')}`}>p0</span>
                <span
                  className={`tag ${c('item-priority-tag')}`}
                  style={{
                    '--tag-color': priorityKey.color,
                    '--tag-background-color': priorityKey.backgroundColor,
                  }}
                >
                  {priorityKey.priority || 'item priority'}
                </span>
                <span className={`tag ${c('item-priority-tag')}`}>p2</span>
              </div>
            </div>
          </div>
        </div>
        <div className={c('setting-button-wrapper')}>
          <div
            className="clickable-icon"
            onClick={deleteKey}
            aria-label={t('Delete')}
          >
            <Icon name="lucide-trash-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface PrioritySettingsProps {
  dataKeys: PrioritySetting[];
  onChange: (settings: PrioritySetting[]) => void;
  portalContainer: HTMLElement;
}

function PrioritySettings({ dataKeys, onChange }: PrioritySettingsProps) {
  const [keys, setKeys] = Preact.useState(dataKeys);
  const defaultColors = Preact.useMemo(() => {
    const wrapper = createDiv(c('item-tags'));
    const tag = wrapper.createEl('a', c('item-tag'));

    wrapper.style.position = 'absolute';
    wrapper.style.visibility = 'hidden';

    activeDocument.body.append(wrapper);

    const props = activeWindow.getComputedStyle(tag);
    const color = props.getPropertyValue('color').trim();
    const backgroundColor = props.getPropertyValue('background-color').trim();

    wrapper.remove();

    return {
      color,
      backgroundColor,
    };
  }, []);

  const updateKeys = (keys: PrioritySetting[]) => {
    onChange(keys);
    setKeys(keys);
  };

  const newKey = () => {
    updateKeys(
      update(keys, {
        $push: [
          {
            ...PrioritySettingTemplate,
            id: generateInstanceId(),
            data: {
              priority: '',
              color: '',
              backgroundColor: '',
            },
          },
        ],
      })
    );
  };

  const deleteKey = (i: number) => {
    updateKeys(
      update(keys, {
        $splice: [[i, 1]],
      })
    );
  };

  const updateTagColor =
    (i: number) => (tagKey: string, color: string, backgroundColor: string) => {
      updateKeys(
        update(keys, {
          [i]: {
            data: {
              priority: {
                $set: tagKey,
              },
              color: {
                $set: color,
              },
              backgroundColor: {
                $set: backgroundColor,
              },
            },
          },
        })
      );
    };

  return (
    <div className={c('tag-color-input-wrapper')}>
      {keys.map((key, index) => (
        <Item
          key={key.id}
          priorityKey={key.data}
          deleteKey={() => deleteKey(index)}
          updateKey={updateTagColor(index)}
          defaultColors={defaultColors}
        />
      ))}
      <button
        className={c('add-tag-color-button')}
        onClick={() => {
          newKey();
        }}
      >
        {t('Add priority tag')}
      </button>
    </div>
  );
}

export function renderPrioritySettings(
  containerEl: HTMLElement,
  keys: PrioritySetting[],
  onChange: (key: PrioritySetting[]) => void
) {
  Preact.render(
    <PrioritySettings
      dataKeys={keys}
      onChange={onChange}
      portalContainer={getParentBodyElement(containerEl)}
    />,
    containerEl
  );
}

export function cleanupPrioritySettings(containerEl: HTMLElement) {
  Preact.unmountComponentAtNode(containerEl);
}
