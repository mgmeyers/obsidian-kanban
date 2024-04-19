import classcat from 'classcat';
import update from 'immutability-helper';
import { moment } from 'obsidian';
import Preact from 'preact/compat';

import { Icon } from '../components/Icon/Icon';
import { c, generateInstanceId } from '../components/helpers';
import { DateColor, DateColorSetting, DateColorSettingTemplate } from '../components/types';
import { getParentBodyElement } from '../dnd/util/getWindow';
import { t } from '../lang/helpers';
import { ColorPickerInput } from './TagColorSettings';

interface ItemProps {
  dateColorKey: DateColor;
  deleteKey: () => void;
  updateKey: (newKey: DateColor) => void;
  defaultColors: { color: string; backgroundColor: string };
  getTimeFormat: () => string;
  getDateFormat: () => string;
}

function Item({
  dateColorKey,
  deleteKey,
  updateKey,
  defaultColors,
  getTimeFormat,
  getDateFormat,
}: ItemProps) {
  let defaultSelectorValue = 'between';

  if (dateColorKey.isToday) defaultSelectorValue = 'today';
  if (dateColorKey.isBefore) defaultSelectorValue = 'before';
  if (dateColorKey.isAfter) defaultSelectorValue = 'after';

  return (
    <div className={c('setting-item-wrapper')}>
      <div className={c('setting-item')}>
        <div className={`${c('setting-controls-wrapper')} ${c('tag-color-input')}`}>
          <div>
            <div>
              <div className={c('setting-item-label')}>{t('Date is')}</div>
            </div>
            <div className={c('date-color-config')}>
              <select
                className="dropdown"
                defaultValue={defaultSelectorValue}
                onChange={(e) => {
                  const clone = {
                    ...dateColorKey,
                  };
                  delete clone.isAfter;
                  delete clone.isBefore;
                  delete clone.isToday;

                  switch ((e.target as HTMLSelectElement).value) {
                    case 'today':
                      clone.isToday = true;
                      break;
                    case 'before':
                      clone.isBefore = true;
                      break;
                    case 'after':
                      clone.isAfter = true;
                      break;
                  }

                  updateKey(clone);
                }}
              >
                <option value="between">{t('Between now and')}</option>
                <option value="today">{t('Today')}</option>
                <option value="after">{t('After now')}</option>
                <option value="before">{t('Before now')}</option>
              </select>
              {!dateColorKey.isToday && !dateColorKey.isAfter && !dateColorKey.isBefore && (
                <>
                  <input
                    type="number"
                    value={dateColorKey.distance}
                    onChange={(e) => {
                      updateKey({
                        ...dateColorKey,
                        distance: parseInt((e.target as HTMLInputElement).value),
                      });
                    }}
                  />
                  <select
                    className="dropdown"
                    defaultValue={dateColorKey.unit}
                    onChange={(e) => {
                      updateKey({
                        ...dateColorKey,
                        unit: (e.target as HTMLSelectElement).value as any,
                      });
                    }}
                  >
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                  <select
                    className="dropdown"
                    defaultValue={dateColorKey.direction}
                    onChange={(e) => {
                      updateKey({
                        ...dateColorKey,
                        direction: (e.target as HTMLSelectElement).value as any,
                      });
                    }}
                  >
                    <option value="after">{t('After now')}</option>
                    <option value="before">{t('Before now')}</option>
                  </select>
                </>
              )}
            </div>

            <div className={c('date-color-config')}>
              <div>
                <div className={c('setting-item-label')}>{t('Background color')}</div>
                <ColorPickerInput
                  color={dateColorKey.backgroundColor}
                  setColor={(color) => {
                    updateKey({
                      ...dateColorKey,
                      backgroundColor: color,
                    });
                  }}
                  defaultColor={defaultColors.backgroundColor}
                />
              </div>
              <div>
                <div className={c('setting-item-label')}>{t('Text color')}</div>
                <ColorPickerInput
                  color={dateColorKey.color}
                  setColor={(color) => {
                    updateKey({
                      ...dateColorKey,
                      color: color,
                    });
                  }}
                  defaultColor={defaultColors.color}
                />
              </div>
            </div>
          </div>
          <div>
            <div className={c('date-color-wrapper')}>
              <div className={c('item-metadata')}>
                <span
                  style={{
                    '--date-color': dateColorKey.color,
                    '--date-background-color': dateColorKey.backgroundColor,
                  }}
                  className={classcat([
                    c('item-metadata-date-wrapper'),
                    c('date'),
                    { 'has-background': !!dateColorKey?.backgroundColor },
                  ])}
                >
                  <span className={c('item-metadata-date is-button')}>
                    {moment().format(getDateFormat())}
                  </span>{' '}
                  <span className={c('item-metadata-time is-button')}>
                    {moment().format(getTimeFormat())}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className={c('setting-button-wrapper')}>
          <div className="clickable-icon" onClick={deleteKey} aria-label={t('Delete')}>
            <Icon name="lucide-trash-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface DateSettingsProps {
  dataKeys: DateColorSetting[];
  onChange: (settings: DateColorSetting[]) => void;
  portalContainer: HTMLElement;
  getTimeFormat: () => string;
  getDateFormat: () => string;
}

function DateSettings({ dataKeys, onChange, getTimeFormat, getDateFormat }: DateSettingsProps) {
  const [keys, setKeys] = Preact.useState(dataKeys);
  const defaultColors = Preact.useMemo(() => {
    const wrapper = createDiv(c('item-metadata'));
    const date = wrapper.createSpan(c('item-metadata-date'));

    wrapper.style.position = 'absolute';
    wrapper.style.visibility = 'hidden';

    activeDocument.body.append(wrapper);

    const props = activeWindow.getComputedStyle(date);
    const color = props.getPropertyValue('color').trim();
    const backgroundColor = props.getPropertyValue('background-color').trim();

    wrapper.remove();

    return {
      color,
      backgroundColor,
    };
  }, []);

  const updateKeys = (keys: DateColorSetting[]) => {
    onChange(keys);
    setKeys(keys);
  };

  const newKey = () => {
    updateKeys(
      update(keys, {
        $push: [
          {
            ...DateColorSettingTemplate,
            id: generateInstanceId(),
            data: {
              isToday: false,
              distance: 1,
              unit: 'days',
              direction: 'after',
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

  const updateDateColor = (i: number) => (newDateKey: DateColor) => {
    updateKeys(
      update(keys, {
        [i]: {
          data: {
            $set: newDateKey,
          },
        },
      })
    );
  };

  return (
    <div className={c('date-color-input-wrapper')}>
      <div className="setting-item-info">
        <div className="setting-item-name">{t('Display date colors')}</div>
        <div className="setting-item-description">
          {t('Set colors for dates displayed in cards based on the rules below.')}
        </div>
      </div>
      <div>
        {keys.map((key, index) => (
          <Item
            key={key.id}
            dateColorKey={key.data}
            deleteKey={() => deleteKey(index)}
            updateKey={updateDateColor(index)}
            defaultColors={defaultColors}
            getTimeFormat={getTimeFormat}
            getDateFormat={getDateFormat}
          />
        ))}
      </div>
      <button className={c('add-tag-color-button')} onClick={newKey}>
        {t('Add date color')}
      </button>
    </div>
  );
}

export function renderDateSettings(
  containerEl: HTMLElement,
  keys: DateColorSetting[],
  onChange: (key: DateColorSetting[]) => void,
  getDateFormat: () => string,
  getTimeFormat: () => string
) {
  Preact.render(
    <DateSettings
      dataKeys={keys}
      onChange={onChange}
      portalContainer={getParentBodyElement(containerEl)}
      getDateFormat={getDateFormat}
      getTimeFormat={getTimeFormat}
    />,
    containerEl
  );
}

export function cleanUpDateSettings(containerEl: HTMLElement) {
  Preact.unmountComponentAtNode(containerEl);
}
