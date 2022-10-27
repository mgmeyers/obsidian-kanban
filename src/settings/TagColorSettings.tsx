import { colord } from 'colord';
import update from 'immutability-helper';
import Preact from 'preact/compat';
import { RgbaStringColorPicker } from 'react-colorful';
import useOnclickOutside from 'react-cool-onclickoutside';

import { c, generateInstanceId } from '../components/helpers';
import { Icon } from '../components/Icon/Icon';
import {
  TagColorKey,
  TagColorSetting,
  TagColorSettingTemplate,
} from '../components/types';
import { getParentBodyElement } from '../dnd/util/getWindow';
import { t } from '../lang/helpers';

interface ItemProps {
  tagColorKey: TagColorKey;
  deleteKey: () => void;
  updateKey: (tagKey: string, color: string, backgroundColor: string) => void;
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

function Item({ tagColorKey, deleteKey, updateKey, defaultColors }: ItemProps) {
  return (
    <div className={c('setting-item-wrapper')}>
      <div className={c('setting-item')}>
        <div
          className={`${c('setting-controls-wrapper')} ${c('tag-color-input')}`}
        >
          <div className={c('setting-input-wrapper')}>
            <div>
              <div className={c('setting-item-label')}>{t('Tag')}</div>
              <input
                type="text"
                placeholder="#tag"
                value={tagColorKey.tagKey}
                onChange={(e) => {
                  updateKey(
                    e.currentTarget.value,
                    tagColorKey.color,
                    tagColorKey.backgroundColor
                  );
                }}
              />
            </div>
            <div>
              <div className={c('setting-item-label')}>
                {t('Background color')}
              </div>
              <ColorPickerInput
                color={tagColorKey.backgroundColor}
                setColor={(color) => {
                  updateKey(tagColorKey.tagKey, tagColorKey.color, color);
                }}
                defaultColor={defaultColors.backgroundColor}
              />
            </div>
            <div>
              <div className={c('setting-item-label')}>{t('Text color')}</div>
              <ColorPickerInput
                color={tagColorKey.color}
                setColor={(color) => {
                  updateKey(
                    tagColorKey.tagKey,
                    color,
                    tagColorKey.backgroundColor
                  );
                }}
                defaultColor={defaultColors.color}
              />
            </div>
          </div>
          <div className={c('setting-toggle-wrapper')}>
            <div>
              <div className={c('item-tags')}>
                <a className={`tag ${c('item-tag')}`}>#tag1</a>
                <a
                  className={`tag ${c('item-tag')}`}
                  style={{
                    '--tag-color': tagColorKey.color,
                    '--tag-background-color': tagColorKey.backgroundColor,
                  }}
                >
                  {tagColorKey.tagKey || '#tag'}
                </a>
                <a className={`tag ${c('item-tag')}`}>#tag2</a>
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

interface TagSettingsProps {
  dataKeys: TagColorSetting[];
  onChange: (settings: TagColorSetting[]) => void;
  portalContainer: HTMLElement;
}

function TagSettings({ dataKeys, onChange }: TagSettingsProps) {
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

  const updateKeys = (keys: TagColorSetting[]) => {
    onChange(keys);
    setKeys(keys);
  };

  const newKey = () => {
    updateKeys(
      update(keys, {
        $push: [
          {
            ...TagColorSettingTemplate,
            id: generateInstanceId(),
            data: {
              tagKey: '',
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
              tagKey: {
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
      <div className="setting-item-info">
        <div className="setting-item-name">{t('Display tag colors')}</div>
        <div className="setting-item-description">
          {t('Set colors for the tags displayed below the card title.')}
        </div>
      </div>
      {keys.map((key, index) => (
        <Item
          key={key.id}
          tagColorKey={key.data}
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
        {t('Add tag color')}
      </button>
    </div>
  );
}

export function renderTagSettings(
  containerEl: HTMLElement,
  keys: TagColorSetting[],
  onChange: (key: TagColorSetting[]) => void
) {
  Preact.render(
    <TagSettings
      dataKeys={keys}
      onChange={onChange}
      portalContainer={getParentBodyElement(containerEl)}
    />,
    containerEl
  );
}

export function cleanUpTagSettings(containerEl: HTMLElement) {
  Preact.unmountComponentAtNode(containerEl);
}
