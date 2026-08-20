import Choices, { Choices as IChoices } from 'choices.js';
import update from 'immutability-helper';
import { App, Setting, TFile, TFolder, Vault } from 'obsidian';

import { KanbanSettings, SettingsManager } from './Settings';
import { getTemplatePlugins } from './components/helpers';
import { t } from './lang/helpers';

export const defaultDateTrigger = '@';
export const defaultTimeTrigger = '@@';
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

        // [Kanban-DIAG] diagnostic logging — gated behind the "debug-logging" setting.
        // Surfaces Choices.js / popout-window interactions that otherwise fail silently.
        const debugOn = !!manager.getSetting('debug-logging', local)[0];
        if (debugOn) {
          const tag = '[Kanban-DIAG]';
          const win = el.win as any;
          const doc = (win as any).document ?? (manager as any).activeDocument ?? (globalThis as any).activeDocument;
          const log = (...args: any[]) => {
            try { (console as any).log(tag, ...args); } catch (_) {}
          };

          try {
            const snapshot: Record<string, unknown> = {
              key: String(key),
              local,
              listLen: list.length,
              searchEnabled: list.length > 10,
              value,
              globalValue,
              choicesApi: typeof c,
              hasShowDropdown: typeof (c as any).showDropdown === 'function',
              hasHideDropdown: typeof (c as any).hideDropdown === 'function',
              hasDestroy: typeof (c as any).destroy === 'function',
              isActiveWindow: typeof (win as any).activeDocument === 'object',
              docIsWinDoc: doc === (win as any).document,
              docIsGlobalDoc: doc === (globalThis as any).document,
              docIsActiveDoc: doc === (globalThis as any).activeDocument,
              containerInitial: !!(c as any).containerOuter,
              inputInitial: !!(c as any).containerOuter?.input,
            };
            log('snapshot', snapshot);
          } catch (e) {
            log('snapshot-error', e);
          }

          // Intercept showDropdown / hideDropdown to log when they fire and what state they observe.
          try {
            const origShow = (c as any).showDropdown?.bind(c);
            if (typeof origShow === 'function') {
              (c as any).showDropdown = (...args: any[]) => {
                let outer: any = null;
                try { outer = (c as any).containerOuter?.element ?? null; } catch (_) {}
                log('showDropdown() CALLED', {
                  isOpenBefore: !!(c as any).currentState?.isOpen,
                  containerInDom: outer ? !!(outer.getRootNode?.() as any) : false,
                  outerClass: outer?.className ?? null,
                });
                return origShow(...args);
              };
            }
            const origHide = (c as any).hideDropdown?.bind(c);
            if (typeof origHide === 'function') {
              (c as any).hideDropdown = (...args: any[]) => {
                log('hideDropdown() CALLED');
                return origHide(...args);
              };
            }
          } catch (e) {
            log('intercept-error', e);
          }

          // Poll the DOM a few times right after init — confirms container lands in the right document.
          try {
            const outerEl = (c as any).containerOuter?.element as HTMLElement | undefined;
            let poll = 0;
            const pollId = win.setInterval(() => {
              poll += 1;
              try {
                log('poll', {
                  n: poll,
                  outerExists: !!outerEl,
                  outerInDom: outerEl ? outerEl.isConnected : false,
                  outerOwnerDocSameAsWin:
                    outerEl && (win as any).document
                      ? outerEl.ownerDocument === (win as any).document
                      : null,
                  hasChoicesOpen: !!doc?.querySelector?.('.choices.is-open'),
                });
              } catch (_) {}
              if (poll >= 5) win.clearInterval(pollId);
            }, 100);
          } catch (e) {
            log('poll-setup-error', e);
          }

          // Listen for click/show events directly on the choices container.
          try {
            const choicesContainer = (c as any).containerOuter?.element as HTMLElement | undefined;
            if (choicesContainer) {
              const evtNames = ['click', 'mousedown', 'keydown', 'focus'];
              evtNames.forEach((evtName) => {
                choicesContainer.addEventListener(evtName, (e: Event) => {
                  log('container:' + evtName, {
                    targetTag: (e.target as HTMLElement)?.tagName,
                    targetClass: (e.target as HTMLElement)?.className,
                  });
                });
              });
              manager.cleanupFns.push(() => {
                evtNames.forEach((evtName) => {
                  choicesContainer.removeEventListener(evtName, null as any);
                });
              });
            }
          } catch (e) {
            log('container-listener-error', e);
          }

          // Global click listener on the window's document — confirms which document
          // receives the click when the dropdown is in a popout window.
          try {
            const onDocClick = (e: Event) => {
              const outerEl = (c as any).containerOuter?.element as HTMLElement | undefined;
              log('doc:click', {
                targetTag: (e.target as HTMLElement)?.tagName,
                containsOuter: outerEl ? outerEl.contains(e.target as Node) : 'no-outer',
                activeElTag: (doc as any)?.activeElement?.tagName,
              });
            };
            doc?.addEventListener?.('click', onDocClick, true);
            manager.cleanupFns.push(() => {
              doc?.removeEventListener?.('click', onDocClick, true);
            });
          } catch (e) {
            log('doc-listener-error', e);
          }
        }

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
