import Choices, { Choices as IChoices } from 'choices.js';
import update from 'immutability-helper';
import { App, Setting, TFile, TFolder, Vault } from 'obsidian';

import { KanbanSettings, SettingsManager } from './Settings';
import { getTemplatePlugins } from './components/helpers';
import { t } from './lang/helpers';

export const defaultDateTrigger = '@';
export const defaultTimeTrigger = '@@';
export const defaultStoryPointsTrigger = 'sp';
export const defaultPriorityTrigger = '!!';
export const defaultCategoryTrigger = 'cat';
export const defaultMetadataPosition = 'body';

export function getFolderChoices(app: App) {
  const folderList: IChoices.Choice[] = [];

  Vault.recurseChildren(app.vault.getRoot(), (f) => {
    if (f instanceof TFolder) {
      folderList.push({
        value: f.path,
        label: f.path,
        selected: false,
        disabled: false,
      });
    }
  });

  return folderList;
}

export function getTemplateChoices(app: App, folderStr?: string) {
  const fileList: IChoices.Choice[] = [];

  let folder = folderStr ? app.vault.getAbstractFileByPath(folderStr) : null;

  if (!folder || !(folder instanceof TFolder)) {
    folder = app.vault.getRoot();
  }

  Vault.recurseChildren(folder as TFolder, (f) => {
    if (f instanceof TFile) {
      fileList.push({
        value: f.path,
        label: f.basename,
        selected: false,
        disabled: false,
      });
    }
  });

  return fileList;
}

export function getListOptions(app: App) {
  const { templateFolder, templatesEnabled, templaterPlugin } = getTemplatePlugins(app);

  const templateFiles = getTemplateChoices(app, templateFolder);
  const vaultFolders = getFolderChoices(app);

  let templateWarning = '';

  if (!templatesEnabled && !templaterPlugin) {
    templateWarning = t('Note: No template plugins are currently enabled.');
  }

  return {
    templateFiles,
    vaultFolders,
    templateWarning,
  };
}

interface CreateSearchSelectParams {
  choices: IChoices.Choice[];
  key: keyof KanbanSettings;
  warningText?: string;
  local: boolean;
  placeHolderStr: string;
  manager: SettingsManager;
}

export function createSearchSelect({
  choices,
  key,
  warningText,
  local,
  placeHolderStr,
  manager,
}: CreateSearchSelectParams) {
  return (setting: Setting) => {
    setting.controlEl.createEl('select', {}, (el) => {
      // el must be in the dom, so we setTimeout
      el.win.setTimeout(() => {
        let list = choices;

        const [value, globalValue] = manager.getSetting(key, local);

        let didSetPlaceholder = false;
        if (globalValue) {
          const index = list.findIndex((f) => f.value === globalValue);

          if (index > -1) {
            didSetPlaceholder = true;
            const choice = choices[index];

            list = update(list, {
              $splice: [[index, 1]],
              $unshift: [
                update(choice, {
                  placeholder: {
                    $set: true,
                  },
                  value: {
                    $set: '',
                  },
                  label: {
                    $apply: (v) => `${v} (${t('default')})`,
                  },
                }),
              ],
            });
          }
        }

        if (!didSetPlaceholder) {
          list = update(list, {
            $unshift: [
              {
                placeholder: true,
                value: '',
                label: placeHolderStr,
                selected: false,
                disabled: false,
              },
            ],
          });
        }

        const c = new Choices(el, {
          placeholder: true,
          position: 'bottom' as 'auto',
          searchPlaceholderValue: t('Search...'),
          searchEnabled: list.length > 10,
          choices: list,
        }).setChoiceByValue('');

        if (value && typeof value === 'string' && list.findIndex((f) => f.value === value) > -1) {
          c.setChoiceByValue(value);
        }

        const onChange = (e: CustomEvent) => {
          const val = e.detail.value;

          if (val) {
            manager.applySettingsUpdate({
              [key]: {
                $set: val,
              },
            });
          } else {
            manager.applySettingsUpdate({
              $unset: [key],
            });
          }
        };

        el.addEventListener('change', onChange);

        manager.cleanupFns.push(() => {
          c.destroy();
          el.removeEventListener('change', onChange);
        });
      });

      if (warningText) {
        setting.descEl.createDiv({}, (div) => {
          div.createEl('strong', { text: warningText });
        });
      }
    });
  };
}
