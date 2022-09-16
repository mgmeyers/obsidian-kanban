import Preact from 'preact/compat';
import update from 'immutability-helper';
import { c, generateInstanceId } from '../components/helpers';
import {
  TagColorKey,
  TagColorSetting,
  TagColorSettingTemplate,
} from '../components/types';
import { getParentBodyElement } from '../dnd/util/getWindow';
import { t } from '../lang/helpers';
import { Icon } from '../components/Icon/Icon';
import { RgbaStringColorPicker } from 'react-colorful';
import useOnclickOutside from 'react-cool-onclickoutside';
import { colord } from 'colord';

interface ItemProps {
  tagColorKey: TagColorKey;
  deleteKey: () => void;
  updateKey: (tagKey: string, color: string, backgroundColor: string) => void;
}

function colorToRgbaString(color: string) {
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

function ColorPickerInput({
  color,
  setColor,
}: {
  color?: string;
  setColor: (color: string) => void;
}) {
  const [localRGB, setLocalRGB] = Preact.useState(color);
  const [localHEX, setLocalHEX] = Preact.useState(color);
  const [isPickerVisible, setIsPickerVisible] = Preact.useState(false);
  const onChange = Preact.useCallback(
    (newColor: string) => {
      const normalized = colorToRgbaString(newColor);
      if (normalized) {
        setLocalHEX(normalized.hexa);
        setLocalRGB(normalized.rgba);
        setColor(normalized.rgba);
      }
    },
    [setColor]
  );

  Preact.useEffect(() => {
    if (!color) return;

    const normalized = colorToRgbaString(color);
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

function Item({ tagColorKey, deleteKey, updateKey }: ItemProps) {
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
                  {tagColorKey.tagKey}
                </a>
                <a className={`tag ${c('item-tag')}`}>#tag2</a>
              </div>
            </div>
          </div>
        </div>
        <div className={c('setting-button-wrapper')}>
          <div onClick={deleteKey} aria-label={t('Delete')}>
            <Icon name="cross" />
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
