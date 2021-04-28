import update from "immutability-helper";
import Choices, { Choices as IChoices } from "choices.js";
import { App, Setting, TFile, TFolder, Vault } from "obsidian";
import KanbanPlugin from "./main";
import { KanbanSettings, SettingsManager } from "./Settings";

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

export function getListOptions(app: App, plugin: KanbanPlugin) {
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
    setting.controlEl.createEl("select", {}, (el) => {
      // el must be in the dom, so we setTimeout
      setTimeout(() => {
        let list = choices;

        const [value, defaultVal] = manager.getSetting(key, local);

        if (defaultVal) {
          const index = choices.findIndex((f) => f.value === defaultVal);
          const choice = choices[index];

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
                label: placeHolderStr,
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

        if (value && typeof value === "string") {
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

        el.addEventListener("change", onChange);

        manager.cleanupFns.push(() => {
          c.destroy();
          el.removeEventListener("change", onChange);
        });
      });

      if (warningText) {
        setting.descEl.createDiv({}, (div) => {
          div.createEl("strong", { text: warningText });
        });
      }
    });
  };
}
