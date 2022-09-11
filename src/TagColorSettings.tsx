import Preact from 'preact/compat';
import update from 'immutability-helper';
import { c, generateInstanceId } from './components/helpers';
import {
  TagColorKey,
  TagColorSetting,
  TagColorSettingTemplate,
} from './components/types';
import { getParentBodyElement } from './dnd/util/getWindow';
import { t } from './lang/helpers';
import { Icon } from './components/Icon/Icon';

interface ItemProps {
  tagColorKey: TagColorKey;
  deleteKey: () => void;
  updateKey: (tagKey: string, color: string) => void;
}

function Item({ tagColorKey, deleteKey, updateKey }: ItemProps) {
  console.log(tagColorKey);
  return (
    <div className={c('setting-item-wrapper')}>
      <div className={c('setting-item')}>
        <div className={c('tag-color-input')}>
          <input
            type="text"
            placeholder="#tag"
            value={tagColorKey.tagKey}
            onChange={(e) => {
              updateKey(e.currentTarget.value, tagColorKey.color);
            }}
          />
          <input
            type="text"
            placeholder="#ffffff"
            value={tagColorKey.color}
            onChange={(e) => {
              updateKey(tagColorKey.tagKey, e.currentTarget.value);
            }}
          />
          <div
            style={{
              height: '16px',
              width: '16px',
              backgroundColor: tagColorKey.color,
              border: '1px solid black',
            }}
          />
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

  const updateTagColor = (i: number) => (tagKey: string, color: string) => {
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
