import update, { Spec } from 'immutability-helper';
import {
  App,
  Modal,
  PluginSettingTab,
  Setting,
  ToggleComponent,
} from 'obsidian';

import {
  c,
  generateInstanceId,
  getDefaultDateFormat,
  getDefaultTimeFormat,
} from './components/helpers';
import {
  DataKey,
  MetadataSetting,
  MetadataSettingTemplate,
} from './components/types';
import { KanbanView } from './KanbanView';
import { t } from './lang/helpers';
import KanbanPlugin from './main';
import {
  cleanupMetadataSettings,
  renderMetadataSettings,
} from './MetadataSettings';
import { frontMatterKey } from './parsers/common';
import {
  createSearchSelect,
  defaultDateTrigger,
  defaultTimeTrigger,
  getListOptions,
} from './settingHelpers';

const numberRegEx = /^\d+(?:\.\d+)?$/;

export type KanbanFormats = 'basic';

export interface KanbanSettings {
  [frontMatterKey]?: KanbanFormats;
  'new-card-insertion-method'?: 'prepend' | 'append';
  'new-note-folder'?: string;
  'new-note-template'?: string;
  'lane-width'?: number;
  'show-checkboxes'?: boolean;
  'date-format'?: string;
  'date-display-format'?: string;
  'date-time-display-format'?: string;
  'hide-date-display'?: boolean;
  'show-relative-date'?: boolean;
  'date-trigger'?: string;
  'time-trigger'?: string;
  'link-date-to-daily-note'?: boolean;
  'hide-date-in-title'?: boolean;
  'max-archive-size'?: number;
  'time-format'?: string;
  'prepend-archive-date'?: boolean;
  'prepend-archive-separator'?: string;
  'prepend-archive-format'?: string;

  'hide-tags-in-title'?: boolean;
  'hide-tags-display'?: boolean;

  'metadata-keys'?: DataKey[];
}

export type SettingRetriever = <K extends keyof KanbanSettings>(
  key: K,
  supplied?: KanbanSettings
) => KanbanSettings[K];

export interface SettingRetrievers {
  getGlobalSettings: () => KanbanSettings;
  getGlobalSetting: SettingRetriever;
  getSetting: SettingRetriever;
}

export interface SettingsManagerConfig {
  onSettingsChange: (newSettings: KanbanSettings) => void;
}

export class SettingsManager {
  app: App;
  plugin: KanbanPlugin;
  config: SettingsManagerConfig;
  settings: KanbanSettings;
  cleanupFns: Array<() => void> = [];
  applyDebounceTimer: number = 0;

  constructor(
    plugin: KanbanPlugin,
    config: SettingsManagerConfig,
    settings: KanbanSettings
  ) {
    this.app = plugin.app;
    this.plugin = plugin;
    this.config = config;
    this.settings = settings;
  }

  applySettingsUpdate(spec: Spec<KanbanSettings>) {
    clearTimeout(this.applyDebounceTimer);

    this.applyDebounceTimer = window.setTimeout(() => {
      this.settings = update(this.settings, spec);
      this.config.onSettingsChange(this.settings);
    }, 200);
  }

  getSetting(key: keyof KanbanSettings, local: boolean) {
    if (local) {
      return [this.settings[key], this.plugin.settings[key]];
    }

    return [this.settings[key], null];
  }

  constructUI(contentEl: HTMLElement, heading: string, local: boolean) {
    const { templateFiles, vaultFolders, templateWarning } = getListOptions(
      this.app
    );

    contentEl.createEl('h3', { text: heading });

    if (local) {
      contentEl.createEl('p', {
        text: t(
          'These settings will take precedence over the default Kanban board settings.'
        ),
      });
    } else {
      contentEl.createEl('p', {
        text: t(
          'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.'
        ),
      });
    }

    new Setting(contentEl)
      .setName(t('Prepend / append new cards'))
      .setDesc(
        t(
          'This setting controls weather new cards are added to the beginning or end of the list.'
        )
      )
      .addDropdown((dropdown) => {
        dropdown.addOption('prepend', t('Prepend'));
        dropdown.addOption('append', t('Append'));

        const [value, globalValue] = this.getSetting(
          'new-card-insertion-method',
          local
        );

        dropdown.setValue(
          (value as string) || (globalValue as string) || 'append'
        );
        dropdown.onChange((value) => {
          this.applySettingsUpdate({
            'new-card-insertion-method': {
              $set: value as 'prepend' | 'append',
            },
          });
        });
      });

    new Setting(contentEl)
      .setName(t('Note template'))
      .setDesc(
        t(
          'This template will be used when creating new notes from Kanban cards.'
        )
      )
      .then(
        createSearchSelect({
          choices: templateFiles,
          key: 'new-note-template',
          warningText: templateWarning,
          local,
          placeHolderStr: t('No template'),
          manager: this,
        })
      );

    new Setting(contentEl)
      .setName(t('Note folder'))
      .setDesc(
        t(
          'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.'
        )
      )
      .then(
        createSearchSelect({
          choices: vaultFolders,
          key: 'new-note-folder',
          local,
          placeHolderStr: t('Default folder'),
          manager: this,
        })
      );

    new Setting(contentEl)
      .setName(t('Lane width'))
      .setDesc(t('Enter a number to set the lane width in pixels.'))
      .addText((text) => {
        const [value, globalValue] = this.getSetting('lane-width', local);

        text.inputEl.setAttr('type', 'number');
        text.inputEl.placeholder = `${
          globalValue ? globalValue : '272'
        } (default)`;
        text.inputEl.value = value ? value.toString() : '';

        text.onChange((val) => {
          if (val && numberRegEx.test(val)) {
            text.inputEl.removeClass('error');

            this.applySettingsUpdate({
              'lane-width': {
                $set: parseInt(val),
              },
            });

            return;
          }

          if (val) {
            text.inputEl.addClass('error');
          }

          this.applySettingsUpdate({
            $unset: ['lane-width'],
          });
        });
      });

    new Setting(contentEl)
      .setName(t('Maximum number of archived cards'))
      .setDesc(
        t(
          "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely."
        )
      )
      .addText((text) => {
        const [value, globalValue] = this.getSetting('max-archive-size', local);

        text.inputEl.setAttr('type', 'number');
        text.inputEl.placeholder = `${
          globalValue ? globalValue : '-1'
        } (default)`;
        text.inputEl.value = value ? value.toString() : '';

        text.onChange((val) => {
          if (val && numberRegEx.test(val)) {
            text.inputEl.removeClass('error');

            this.applySettingsUpdate({
              'max-archive-size': {
                $set: parseInt(val),
              },
            });

            return;
          }

          if (val) {
            text.inputEl.addClass('error');
          }

          this.applySettingsUpdate({
            $unset: ['max-archive-size'],
          });
        });
      });

    new Setting(contentEl)
      .setName(t('Display card checkbox'))
      .setDesc(t('When toggled, a checkbox will be displayed with each card'))
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting(
              'show-checkboxes',
              local
            );

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'show-checkboxes': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('reset')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting(
                  'show-checkboxes',
                  local
                );
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['show-checkboxes'],
                });
              });
          });
      });

    new Setting(contentEl)
      .setName(t('Hide tags in card titles'))
      .setDesc(
        t(
          'When toggled, tags will be hidden card titles. This will prevent tags from being included in the title when creating new notes.'
        )
      )
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting(
              'hide-tags-in-title',
              local
            );

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'hide-tags-in-title': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('reset')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting(
                  'hide-tags-in-title',
                  local
                );
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['hide-tags-in-title'],
                });
              });
          });
      });

    new Setting(contentEl)
      .setName(t('Hide card display tags'))
      .setDesc(
        t('When toggled, tags will not be displayed below the card title.')
      )
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting(
              'hide-tags-display',
              local
            );

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'hide-tags-display': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('reset')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting(
                  'hide-tags-display',
                  local
                );
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['hide-tags-display'],
                });
              });
          });
      });

    contentEl.createEl('h4', { text: t('Date & Time') });

    new Setting(contentEl)
      .setName(t('Date trigger'))
      .setDesc(t('When this is typed, it will trigger the date selector'))
      .addText((text) => {
        const [value, globalValue] = this.getSetting('date-trigger', local);

        if (value || globalValue) {
          text.setValue((value || globalValue) as string);
        }

        text.setPlaceholder((globalValue as string) || defaultDateTrigger);

        text.onChange((newValue) => {
          if (newValue) {
            this.applySettingsUpdate({
              'date-trigger': {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ['date-trigger'],
            });
          }
        });
      });

    new Setting(contentEl)
      .setName(t('Time trigger'))
      .setDesc(t('When this is typed, it will trigger the time selector'))
      .addText((text) => {
        const [value, globalValue] = this.getSetting('time-trigger', local);

        if (value || globalValue) {
          text.setValue((value || globalValue) as string);
        }

        text.setPlaceholder((globalValue as string) || defaultTimeTrigger);

        text.onChange((newValue) => {
          if (newValue) {
            this.applySettingsUpdate({
              'time-trigger': {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ['time-trigger'],
            });
          }
        });
      });

    new Setting(contentEl).setName(t('Date format')).then((setting) => {
      setting.addMomentFormat((mf) => {
        setting.descEl.appendChild(
          createFragment((frag) => {
            frag.appendText(
              t('This format will be used when saving dates in markdown.')
            );
            frag.createEl('br');
            frag.appendText(t('For more syntax, refer to') + ' ');
            frag.createEl(
              'a',
              {
                text: t('format reference'),
                href: 'https://momentjs.com/docs/#/displaying/format/',
              },
              (a) => {
                a.setAttr('target', '_blank');
              }
            );
            frag.createEl('br');
            frag.appendText(t('Your current syntax looks like this') + ': ');
            mf.setSampleEl(frag.createEl('b', { cls: 'u-pop' }));
            frag.createEl('br');
          })
        );

        const [value, globalValue] = this.getSetting('date-format', local);
        const defaultFormat = getDefaultDateFormat(this.app);

        mf.setPlaceholder(defaultFormat);
        mf.setDefaultFormat(defaultFormat);

        if (value || globalValue) {
          mf.setValue((value || globalValue) as string);
        }

        mf.onChange((newValue) => {
          if (newValue) {
            this.applySettingsUpdate({
              'date-format': {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ['date-format'],
            });
          }
        });
      });
    });

    new Setting(contentEl).setName(t('Time format')).then((setting) => {
      setting.addMomentFormat((mf) => {
        setting.descEl.appendChild(
          createFragment((frag) => {
            frag.appendText(t('For more syntax, refer to') + ' ');
            frag.createEl(
              'a',
              {
                text: t('format reference'),
                href: 'https://momentjs.com/docs/#/displaying/format/',
              },
              (a) => {
                a.setAttr('target', '_blank');
              }
            );
            frag.createEl('br');
            frag.appendText(t('Your current syntax looks like this') + ': ');
            mf.setSampleEl(frag.createEl('b', { cls: 'u-pop' }));
            frag.createEl('br');
          })
        );

        const [value, globalValue] = this.getSetting('time-format', local);
        const defaultFormat = getDefaultTimeFormat(this.app);

        mf.setPlaceholder(defaultFormat);
        mf.setDefaultFormat(defaultFormat);

        if (value || globalValue) {
          mf.setValue((value || globalValue) as string);
        }

        mf.onChange((newValue) => {
          if (newValue) {
            this.applySettingsUpdate({
              'time-format': {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ['time-format'],
            });
          }
        });
      });
    });

    new Setting(contentEl).setName(t('Date display format')).then((setting) => {
      setting.addMomentFormat((mf) => {
        setting.descEl.appendChild(
          createFragment((frag) => {
            frag.appendText(
              t(
                'This format will be used when displaying dates in Kanban cards.'
              )
            );
            frag.createEl('br');
            frag.appendText(t('For more syntax, refer to') + ' ');
            frag.createEl(
              'a',
              {
                text: t('format reference'),
                href: 'https://momentjs.com/docs/#/displaying/format/',
              },
              (a) => {
                a.setAttr('target', '_blank');
              }
            );
            frag.createEl('br');
            frag.appendText(t('Your current syntax looks like this') + ': ');
            mf.setSampleEl(frag.createEl('b', { cls: 'u-pop' }));
            frag.createEl('br');
          })
        );

        const [value, globalValue] = this.getSetting(
          'date-display-format',
          local
        );
        const defaultFormat = getDefaultDateFormat(this.app);

        mf.setPlaceholder(defaultFormat);
        mf.setDefaultFormat(defaultFormat);

        if (value || globalValue) {
          mf.setValue((value || globalValue) as string);
        }

        mf.onChange((newValue) => {
          if (newValue) {
            this.applySettingsUpdate({
              'date-display-format': {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ['date-display-format'],
            });
          }
        });
      });
    });

    new Setting(contentEl)
      .setName(t('Show relative date'))
      .setDesc(
        t(
          "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'"
        )
      )
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting(
              'show-relative-date',
              local
            );

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'show-relative-date': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('reset')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting(
                  'show-relative-date',
                  local
                );
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['show-relative-date'],
                });
              });
          });
      });

    new Setting(contentEl)
      .setName(t('Hide card display dates'))
      .setDesc(
        t(
          'When toggled, formatted dates will not be displayed on the card. Relative dates will still be displayed if they are enabled.'
        )
      )
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting(
              'hide-date-display',
              local
            );

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'hide-date-display': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('reset')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting(
                  'hide-date-display',
                  local
                );
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['hide-date-display'],
                });
              });
          });
      });

    new Setting(contentEl)
      .setName(t('Hide dates in card titles'))
      .setDesc(
        t(
          'When toggled, dates will be hidden card titles. This will prevent dates from being included in the title when creating new notes.'
        )
      )
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting(
              'hide-date-in-title',
              local
            );

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'hide-date-in-title': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('reset')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting(
                  'hide-date-in-title',
                  local
                );
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['hide-date-in-title'],
                });
              });
          });
      });

    new Setting(contentEl)
      .setName(t('Link dates to daily notes'))
      .setDesc(
        t('When toggled, dates will link to daily notes. Eg. [[2021-04-26]]')
      )
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting(
              'link-date-to-daily-note',
              local
            );

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'link-date-to-daily-note': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('reset')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting(
                  'link-date-to-daily-note',
                  local
                );
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['link-date-to-daily-note'],
                });
              });
          });
      });

    new Setting(contentEl)
      .setName(t('Add date and time to archived cards'))
      .setDesc(
        t(
          'When toggled, the current date and time will be added to the beginning of a card when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title'
        )
      )
      .then((setting) => {
        let toggleComponent: ToggleComponent;

        setting
          .addToggle((toggle) => {
            toggleComponent = toggle;

            const [value, globalValue] = this.getSetting(
              'prepend-archive-date',
              local
            );

            if (value !== undefined) {
              toggle.setValue(value as boolean);
            } else if (globalValue !== undefined) {
              toggle.setValue(globalValue as boolean);
            }

            toggle.onChange((newValue) => {
              this.applySettingsUpdate({
                'prepend-archive-date': {
                  $set: newValue,
                },
              });
            });
          })
          .addExtraButton((b) => {
            b.setIcon('reset')
              .setTooltip(t('Reset to default'))
              .onClick(() => {
                const [, globalValue] = this.getSetting(
                  'prepend-archive-date',
                  local
                );
                toggleComponent.setValue(!!globalValue);

                this.applySettingsUpdate({
                  $unset: ['prepend-archive-date'],
                });
              });
          });
      });

    new Setting(contentEl)
      .setName(t('Archive date/time separator'))
      .setDesc(
        t('This will be used to separate the archived date/time from the title')
      )
      .addText((text) => {
        const [value, globalValue] = this.getSetting(
          'prepend-archive-separator',
          local
        );

        text.inputEl.placeholder = globalValue
          ? `${globalValue} (default)`
          : '';
        text.inputEl.value = value ? (value as string) : '';

        text.onChange((val) => {
          if (val) {
            this.applySettingsUpdate({
              'prepend-archive-separator': {
                $set: val,
              },
            });

            return;
          }

          this.applySettingsUpdate({
            $unset: ['prepend-archive-separator'],
          });
        });
      });

    new Setting(contentEl)
      .setName(t('Archive date/time format'))
      .then((setting) => {
        setting.addMomentFormat((mf) => {
          setting.descEl.appendChild(
            createFragment((frag) => {
              frag.appendText(t('For more syntax, refer to') + ' ');
              frag.createEl(
                'a',
                {
                  text: t('format reference'),
                  href: 'https://momentjs.com/docs/#/displaying/format/',
                },
                (a) => {
                  a.setAttr('target', '_blank');
                }
              );
              frag.createEl('br');
              frag.appendText(t('Your current syntax looks like this') + ': ');
              mf.setSampleEl(frag.createEl('b', { cls: 'u-pop' }));
              frag.createEl('br');
            })
          );

          const [value, globalValue] = this.getSetting(
            'prepend-archive-format',
            local
          );

          const [dateFmt, globalDateFmt] = this.getSetting(
            'date-format',
            local
          );
          const defaultDateFmt =
            dateFmt || globalDateFmt || getDefaultDateFormat(this.app);
          const [timeFmt, globalTimeFmt] = this.getSetting(
            'time-format',
            local
          );
          const defaultTimeFmt =
            timeFmt || globalTimeFmt || getDefaultTimeFormat(this.app);

          const defaultFormat = `${defaultDateFmt} ${defaultTimeFmt}`;

          mf.setPlaceholder(defaultFormat);
          mf.setDefaultFormat(defaultFormat);

          if (value || globalValue) {
            mf.setValue((value || globalValue) as string);
          }

          mf.onChange((newValue) => {
            if (newValue) {
              this.applySettingsUpdate({
                'prepend-archive-format': {
                  $set: newValue,
                },
              });
            } else {
              this.applySettingsUpdate({
                $unset: ['prepend-archive-format'],
              });
            }
          });
        });
      });

    contentEl.createEl('br');
    contentEl.createEl('h4', { text: t('Linked Page Metadata') });
    contentEl.createEl('p', {
      cls: c('metadata-setting-desc'),
      text: t(
        'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.'
      ),
    });

    new Setting(contentEl).then((setting) => {
      setting.settingEl.addClass(c('draggable-setting-container'));

      const [value] = this.getSetting('metadata-keys', local);

      const keys: MetadataSetting[] = (
        (value as DataKey[]) || ([] as DataKey[])
      ).map((k) => {
        return {
          ...MetadataSettingTemplate,
          id: generateInstanceId(),
          data: k,
        };
      });

      renderMetadataSettings(
        setting.settingEl,
        contentEl,
        keys,
        (keys: MetadataSetting[]) =>
          this.applySettingsUpdate({
            'metadata-keys': {
              $set: keys.map((k) => k.data),
            },
          })
      );

      this.cleanupFns.push(() => {
        if (setting.settingEl) {
          cleanupMetadataSettings(setting.settingEl);
        }
      });
    });
  }

  cleanUp() {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }
}

export class SettingsModal extends Modal {
  view: KanbanView;
  settingsManager: SettingsManager;

  constructor(
    view: KanbanView,
    config: SettingsManagerConfig,
    settings: KanbanSettings
  ) {
    super(view.app);

    this.view = view;
    this.settingsManager = new SettingsManager(view.plugin, config, settings);
  }

  onOpen() {
    const { contentEl, modalEl } = this;

    modalEl.addClass(c('board-settings-modal'));

    this.settingsManager.constructUI(contentEl, this.view.file.basename, true);
  }

  onClose() {
    const { contentEl } = this;

    this.settingsManager.cleanUp();
    contentEl.empty();
  }
}

export class KanbanSettingsTab extends PluginSettingTab {
  plugin: KanbanPlugin;
  settingsManager: SettingsManager;

  constructor(plugin: KanbanPlugin, config: SettingsManagerConfig) {
    super(plugin.app, plugin);
    this.plugin = plugin;
    this.settingsManager = new SettingsManager(plugin, config, plugin.settings);
  }

  display() {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.addClass(c('board-settings-modal'));

    this.settingsManager.constructUI(containerEl, t('Kanban Plugin'), false);
  }
}
