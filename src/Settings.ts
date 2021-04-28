import update, { Spec } from "immutability-helper";
import { App, Modal, PluginSettingTab, Setting, debounce } from "obsidian";
import { c } from "./components/helpers";
import { KanbanView } from "./KanbanView";
import { frontMatterKey } from "./parser";
import KanbanPlugin from "./main";
import { createSearchSelect, getListOptions } from "./settingHelpers";

const numberRegEx = /^\d+(?:\.\d+)?$/;

export type KanbanFormats = "basic";

export interface KanbanSettings {
  [frontMatterKey]?: KanbanFormats;
  "new-note-folder"?: string;
  "new-note-template"?: string;
  "lane-width"?: number;
  "display-tags"?: boolean;
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
    }, 100);
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

        console.log("lane-width", value);

        text.inputEl.setAttr("type", "number");
        text.inputEl.placeholder = `${
          globalValue ? globalValue : "272"
        } (default)`;
        text.inputEl.value = value ? value.toString() : "";

        text.onChange((val) => {
          if (numberRegEx.test(val)) {
            text.inputEl.removeClass("error");

            this.applySettingsUpdate({
              "lane-width": {
                $set: parseInt(val),
              },
            });
          } else {
            text.inputEl.addClass("error");

            this.applySettingsUpdate({
              $unset: ["lane-width"],
            });
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
