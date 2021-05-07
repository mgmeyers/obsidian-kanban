import update, { Spec } from "immutability-helper";
import { App, Modal, PluginSettingTab, Setting } from "obsidian";
import {
  c,
  getDefaultDateFormat,
  getDefaultTimeFormat,
} from "./components/helpers";
import { KanbanView } from "./KanbanView";
import { frontMatterKey } from "./parser";
import KanbanPlugin from "./main";
import {
  createSearchSelect,
  defaultDateTrigger,
  getListOptions,
} from "./settingHelpers";

const numberRegEx = /^\d+(?:\.\d+)?$/;

export type KanbanFormats = "basic";

export interface KanbanSettings {
  [frontMatterKey]?: KanbanFormats;
  "new-note-folder"?: string;
  "new-note-template"?: string;
  "lane-width"?: number;
  "show-checkboxes"?: boolean;
  "date-format"?: string;
  "date-display-format"?: string;
  "hide-date-display"?: boolean;
  "show-relative-date"?: boolean;
  "date-trigger"?: string;
  "link-date-to-daily-note"?: boolean;
  "hide-date-in-title"?: boolean;
  "max-archive-size"?: number;

  "display-tags"?: boolean;
  "time-format"?: string;
  "time-trigger"?: string;
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
    app: App,
    plugin: KanbanPlugin,
    config: SettingsManagerConfig,
    settings: KanbanSettings
  ) {
    this.app = app;
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
      this.app,
      this.plugin
    );

    contentEl.createEl("h3", { text: heading });

    if (local) {
      contentEl.createEl("p", {
        text:
          "These settings will take precedence over the default Kanban board settings.",
      });
    } else {
      contentEl.createEl("p", {
        text:
          "Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.",
      });
    }

    new Setting(contentEl)
      .setName("Note template")
      .setDesc(
        "This template will be used when creating new notes from Kanban cards."
      )
      .then(
        createSearchSelect({
          choices: templateFiles,
          key: "new-note-template",
          warningText: templateWarning,
          local,
          placeHolderStr: "No template",
          manager: this,
        })
      );

    new Setting(contentEl)
      .setName("Note folder")
      .setDesc(
        "Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault."
      )
      .then(
        createSearchSelect({
          choices: vaultFolders,
          key: "new-note-folder",
          local,
          placeHolderStr: "Default folder",
          manager: this,
        })
      );

    new Setting(contentEl)
      .setName("Lane width")
      .setDesc("Enter a number to set the lane width in pixels.")
      .addText((text) => {
        const [value, globalValue] = this.getSetting("lane-width", local);

        text.inputEl.setAttr("type", "number");
        text.inputEl.placeholder = `${
          globalValue ? globalValue : "272"
        } (default)`;
        text.inputEl.value = value ? value.toString() : "";

        text.onChange((val) => {
          if (val && numberRegEx.test(val)) {
            text.inputEl.removeClass("error");

            this.applySettingsUpdate({
              "lane-width": {
                $set: parseInt(val),
              },
            });

            return;
          }

          if (val) {
            text.inputEl.addClass("error");
          }

          this.applySettingsUpdate({
            $unset: ["lane-width"],
          });
        });
      });

    new Setting(contentEl)
      .setName("Maximum number of archived cards")
      .setDesc(
        "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely."
      )
      .addText((text) => {
        const [value, globalValue] = this.getSetting("max-archive-size", local);

        text.inputEl.setAttr("type", "number");
        text.inputEl.placeholder = `${
          globalValue ? globalValue : "-1"
        } (default)`;
        text.inputEl.value = value ? value.toString() : "";

        text.onChange((val) => {
          if (val && numberRegEx.test(val)) {
            text.inputEl.removeClass("error");

            this.applySettingsUpdate({
              "max-archive-size": {
                $set: parseInt(val),
              },
            });

            return;
          }

          if (val) {
            text.inputEl.addClass("error");
          }

          this.applySettingsUpdate({
            $unset: ["max-archive-size"],
          });
        });
      });

    new Setting(contentEl)
      .setName("Display card checkbox")
      .setDesc("When toggled, a checkbox will be displayed with each card")
      .addToggle((toggle) => {
        const [value, globalValue] = this.getSetting("show-checkboxes", local);

        if (value !== undefined) {
          toggle.setValue(value as boolean);
        } else if (globalValue !== undefined) {
          toggle.setValue(globalValue as boolean);
        }

        toggle.onChange((newValue) => {
          this.applySettingsUpdate({
            "show-checkboxes": {
              $set: newValue,
            },
          });
        });
      })
      .addExtraButton((b) => {
        b.setIcon("reset")
          .setTooltip("Reset to default")
          .onClick(() => {
            this.applySettingsUpdate({
              $unset: ["show-checkboxes"],
            });
          });
      });

    contentEl.createEl("h4", { text: "Date & Time" });

    new Setting(contentEl)
      .setName("Date trigger")
      .setDesc("When this is typed, it will trigger the date selector")
      .addText((text) => {
        const [value, globalValue] = this.getSetting("date-trigger", local);

        if (value || globalValue) {
          text.setValue((value || globalValue) as string);
        }

        text.setPlaceholder((globalValue as string) || defaultDateTrigger);

        text.onChange((newValue) => {
          if (newValue) {
            this.applySettingsUpdate({
              "date-trigger": {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ["date-trigger"],
            });
          }
        });
      });

    new Setting(contentEl).setName("Date format").then((setting) => {
      setting.addMomentFormat((mf) => {
        setting.descEl.appendChild(
          createFragment((frag) => {
            frag.appendText(
              "This format will be used when saving dates in markdown."
            );
            frag.createEl("br");
            frag.appendText("For more syntax, refer to ");
            frag.createEl(
              "a",
              {
                text: "format reference",
                href: "https://momentjs.com/docs/#/displaying/format/",
              },
              (a) => {
                a.setAttr("target", "_blank");
              }
            );
            frag.createEl("br");
            frag.appendText("Your current syntax looks like this: ");
            mf.setSampleEl(frag.createEl("b", { cls: "u-pop" }));
            frag.createEl("br");
          })
        );

        const [value, globalValue] = this.getSetting("date-format", local);
        const defaultFormat = getDefaultDateFormat(this.app);

        mf.setPlaceholder(defaultFormat);
        mf.setDefaultFormat(defaultFormat);

        if (value || globalValue) {
          mf.setValue((value || globalValue) as string);
        }

        mf.onChange((newValue) => {
          if (newValue) {
            this.applySettingsUpdate({
              "date-format": {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ["date-format"],
            });
          }
        });
      });
    });

    new Setting(contentEl).setName("Date display format").then((setting) => {
      setting.addMomentFormat((mf) => {
        setting.descEl.appendChild(
          createFragment((frag) => {
            frag.appendText(
              "This format will be used when displaying dates in Kanban cards."
            );
            frag.createEl("br");
            frag.appendText("For more syntax, refer to ");
            frag.createEl(
              "a",
              {
                text: "format reference",
                href: "https://momentjs.com/docs/#/displaying/format/",
              },
              (a) => {
                a.setAttr("target", "_blank");
              }
            );
            frag.createEl("br");
            frag.appendText("Your current syntax looks like this: ");
            mf.setSampleEl(frag.createEl("b", { cls: "u-pop" }));
            frag.createEl("br");
          })
        );

        const [value, globalValue] = this.getSetting(
          "date-display-format",
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
              "date-display-format": {
                $set: newValue,
              },
            });
          } else {
            this.applySettingsUpdate({
              $unset: ["date-display-format"],
            });
          }
        });
      });
    });

    new Setting(contentEl)
      .setName("Show relative date")
      .setDesc(
        "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'"
      )
      .addToggle((toggle) => {
        const [value, globalValue] = this.getSetting(
          "show-relative-date",
          local
        );

        if (value !== undefined) {
          toggle.setValue(value as boolean);
        } else if (globalValue !== undefined) {
          toggle.setValue(globalValue as boolean);
        }

        toggle.onChange((newValue) => {
          this.applySettingsUpdate({
            "show-relative-date": {
              $set: newValue,
            },
          });
        });
      })
      .addExtraButton((b) => {
        b.setIcon("reset")
          .setTooltip("Reset to default")
          .onClick(() => {
            this.applySettingsUpdate({
              $unset: ["show-relative-date"],
            });
          });
      });

    // new Setting(contentEl).setName("Time output format").then((setting) => {
    //   setting.addMomentFormat((mf) => {
    //     setting.descEl.appendChild(
    //       createFragment((frag) => {
    //         frag.appendText("For more syntax, refer to ");
    //         frag.createEl(
    //           "a",
    //           {
    //             text: "format reference",
    //             href: "https://momentjs.com/docs/#/displaying/format/",
    //           },
    //           (a) => {
    //             a.setAttr("target", "_blank");
    //           }
    //         );
    //         frag.createEl("br");
    //         frag.appendText("Your current syntax looks like this: ");
    //         mf.setSampleEl(frag.createEl("b", { cls: "u-pop" }));
    //         frag.createEl("br");
    //       })
    //     );

    //     const [value, globalValue] = this.getSetting("time-format", local);
    //     const defaultFormat = getDefaultTimeFormat(this.app);

    //     mf.setPlaceholder(defaultFormat);
    //     mf.setDefaultFormat(defaultFormat);

    //     if (value || globalValue) {
    //       mf.setValue((value || globalValue) as string);
    //     }

    //     mf.onChange((newValue) => {
    //       if (newValue) {
    //         this.applySettingsUpdate({
    //           "time-format": {
    //             $set: newValue,
    //           },
    //         });
    //       } else {
    //         this.applySettingsUpdate({
    //           $unset: ["time-format"],
    //         });
    //       }
    //     });
    //   });
    // });

    // new Setting(contentEl)
    //   .setName("Time trigger")
    //   .setDesc("When this is typed, it will trigger the time selector")
    //   .addText((text) => {
    //     const [value, globalValue] = this.getSetting("time-trigger", local);

    //     if (value || globalValue) {
    //       text.setValue((value || globalValue) as string);
    //     }

    //     text.setPlaceholder((globalValue as string) || defaultTimeTrigger);

    //     text.onChange((newValue) => {
    //       if (newValue) {
    //         this.applySettingsUpdate({
    //           "time-trigger": {
    //             $set: newValue,
    //           },
    //         });
    //       } else {
    //         this.applySettingsUpdate({
    //           $unset: ["time-trigger"],
    //         });
    //       }
    //     });
    //   });

    new Setting(contentEl)
      .setName("Hide card display dates")
      .setDesc(
        "When toggled, formatted dates will not be displayed on the card. Relative dates will still be displayed if they are enabled."
      )
      .addToggle((toggle) => {
        const [value, globalValue] = this.getSetting(
          "hide-date-display",
          local
        );

        if (value !== undefined) {
          toggle.setValue(value as boolean);
        } else if (globalValue !== undefined) {
          toggle.setValue(globalValue as boolean);
        }

        toggle.onChange((newValue) => {
          this.applySettingsUpdate({
            "hide-date-display": {
              $set: newValue,
            },
          });
        });
      })
      .addExtraButton((b) => {
        b.setIcon("reset")
          .setTooltip("Reset to default")
          .onClick(() => {
            this.applySettingsUpdate({
              $unset: ["hide-date-display"],
            });
          });
      });

    new Setting(contentEl)
      .setName("Hide dates in card titles")
      .setDesc(
        "When toggled, dates will be hidden card titles. This will prevent dates from being included in the title when creating new notes."
      )
      .addToggle((toggle) => {
        const [value, globalValue] = this.getSetting(
          "hide-date-in-title",
          local
        );

        if (value !== undefined) {
          toggle.setValue(value as boolean);
        } else if (globalValue !== undefined) {
          toggle.setValue(globalValue as boolean);
        }

        toggle.onChange((newValue) => {
          this.applySettingsUpdate({
            "hide-date-in-title": {
              $set: newValue,
            },
          });
        });
      })
      .addExtraButton((b) => {
        b.setIcon("reset")
          .setTooltip("Reset to default")
          .onClick(() => {
            this.applySettingsUpdate({
              $unset: ["hide-date-in-title"],
            });
          });
      });

    new Setting(contentEl)
      .setName("Link dates to daily notes")
      .setDesc(
        "When toggled, dates will link to daily notes. Eg. [[2021-04-26]]"
      )
      .addToggle((toggle) => {
        const [value, globalValue] = this.getSetting(
          "link-date-to-daily-note",
          local
        );

        if (value !== undefined) {
          toggle.setValue(value as boolean);
        } else if (globalValue !== undefined) {
          toggle.setValue(globalValue as boolean);
        }

        toggle.onChange((newValue) => {
          this.applySettingsUpdate({
            "link-date-to-daily-note": {
              $set: newValue,
            },
          });
        });
      })
      .addExtraButton((b) => {
        b.setIcon("reset")
          .setTooltip("Reset to default")
          .onClick(() => {
            this.applySettingsUpdate({
              $unset: ["link-date-to-daily-note"],
            });
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
    this.settingsManager = new SettingsManager(
      view.app,
      view.plugin,
      config,
      settings
    );
  }

  onOpen() {
    let { contentEl, modalEl } = this;

    modalEl.addClass(c("board-settings-modal"));

    this.settingsManager.constructUI(contentEl, this.view.file.basename, true);
  }

  onClose() {
    let { contentEl } = this;

    this.settingsManager.cleanUp();
    contentEl.empty();
  }
}

export class KanbanSettingsTab extends PluginSettingTab {
  plugin: KanbanPlugin;
  settingsManager: SettingsManager;

  constructor(
    app: App,
    plugin: KanbanPlugin,
    config: SettingsManagerConfig,
    settings: KanbanSettings
  ) {
    super(app, plugin);
    this.plugin = plugin;

    this.settingsManager = new SettingsManager(app, plugin, config, settings);
  }

  display() {
    let { containerEl } = this;

    containerEl.empty();
    containerEl.addClass(c("board-settings-modal"));

    this.settingsManager.constructUI(containerEl, "Kanban Plugin", false);
  }
}
