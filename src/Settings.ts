import update, { Spec } from "immutability-helper";
import Choices, { Choices as IChoices } from "choices.js";
import {
  App,
  Modal,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  Vault,
} from "obsidian";
import { c } from "./components/helpers";
import { KanbanView } from "./KanbanView";
import { frontMatterKey } from "./parser";
import KanbanPlugin from "./main";

type KanbanFormats = "basic";

export interface KanbanSettings {
  [frontMatterKey]?: KanbanFormats;
  "new-note-folder"?: string;
  "new-note-template"?: string;
}

export interface SettingsManagerConfig {
  onSettingsChange: (newSettings: KanbanSettings) => void;
}

function getFolderChoices(app: App) {
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

function getTemplateChoices(app: App, folderStr?: string) {
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

function getListOptions(app: App, plugin: KanbanPlugin) {
  const {
    templateFolder,
    templatesEnabled,
    templaterPlugin,
  } = plugin.getTemplatePlugins();

  const templateFiles = getTemplateChoices(app, templateFolder);
  const vaultFolders = getFolderChoices(app);

  let templateWarning = "";

  if (!templatesEnabled && !templaterPlugin) {
    templateWarning = "Note: No template plugins are currently enabled.";
  }

  return {
    templateFiles,
    vaultFolders,
    templateWarning,
  };
}

export class SettingsManager {
  app: App;
  plugin: KanbanPlugin;
  config: SettingsManagerConfig;
  settings: KanbanSettings;
  cleanupFns: Array<() => void> = [];

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
    this.settings = update(this.settings, spec);
    this.config.onSettingsChange(this.settings);
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
      .then((setting) => {
        setting.controlEl.createEl("select", {}, (el) => {
          // el must be in the dom, so we setTimeout
          setTimeout(() => {
            let list = templateFiles;

            const [value, defaultVal] = this.getSetting(
              "new-note-template",
              local
            );

            if (defaultVal) {
              const index = templateFiles.findIndex(
                (f) => f.value === defaultVal
              );
              const choice = templateFiles[index];

              list = update(list, {
                $splice: [[index, 1]],
                $unshift: [
                  update(choice, {
                    placeholder: {
                      $set: true,
                    },
                    value: {
                      $set: "",
                    },
                    label: {
                      $apply: (v) => `${v} (default)`,
                    },
                  }),
                ],
              });
            } else {
              list = update(list, {
                $unshift: [
                  {
                    placeholder: true,
                    value: "",
                    label: "No template",
                    selected: false,
                    disabled: false,
                  },
                ],
              });
            }

            const c = new Choices(el, {
              placeholder: true,
              position: "bottom" as "auto",
              searchPlaceholderValue: "Search...",
              searchEnabled: list.length > 10,
              choices: list,
            }).setChoiceByValue("");

            if (value) {
              c.setChoiceByValue(value);
            }

            const onChange = (e: CustomEvent) => {
              const val = e.detail.value;

              if (val) {
                this.applySettingsUpdate({
                  "new-note-template": {
                    $set: val,
                  },
                });
              } else {
                this.applySettingsUpdate({
                  $unset: ["new-note-template"],
                });
              }
            };

            el.addEventListener("change", onChange);

            this.cleanupFns.push(() => {
              c.destroy();
              el.removeEventListener("change", onChange);
            });
          });

          if (templateWarning) {
            setting.descEl.createDiv({}, (div) => {
              div.createEl("strong", { text: templateWarning });
            });
          }
        });
      });

    new Setting(contentEl)
      .setName("Note folder")
      .setDesc(
        "Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault."
      )
      .then((setting) => {
        let list = vaultFolders;

        const [value, defaultVal] = this.getSetting("new-note-folder", local);

        if (defaultVal) {
          const index = vaultFolders.findIndex((f) => f.value === defaultVal);
          const choice = vaultFolders[index];

          list = update(list, {
            $splice: [[index, 1]],
            $unshift: [
              update(choice, {
                placeholder: {
                  $set: true,
                },
                value: {
                  $set: "",
                },
                label: {
                  $apply: (v) => `${v} (default)`,
                },
              }),
            ],
          });
        } else {
          list = update(list, {
            $unshift: [
              {
                placeholder: true,
                value: "",
                label: "Default folder",
                selected: false,
                disabled: false,
              },
            ],
          });
        }

        setting.controlEl.createEl("select", {}, (el) => {
          // el must be in the dom, so we setTimeout
          setTimeout(() => {
            const c = new Choices(el, {
              placeholder: true,
              position: "bottom" as "auto",
              searchPlaceholderValue: "Search...",
              searchEnabled: list.length > 10,
              choices: list,
            }).setChoiceByValue("");

            if (value) {
              c.setChoiceByValue(value);
            }

            const onChange = (e: CustomEvent) => {
              const val = e.detail.value;

              if (val) {
                this.applySettingsUpdate({
                  "new-note-folder": {
                    $set: val,
                  },
                });
              } else {
                this.applySettingsUpdate({
                  $unset: ["new-note-folder"],
                });
              }
            };

            el.addEventListener("change", onChange);

            this.cleanupFns.push(() => {
              c.destroy();
              el.removeEventListener("change", onChange);
            });
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
