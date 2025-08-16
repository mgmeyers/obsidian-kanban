import update from 'immutability-helper';
import { Menu, Platform, TFile, TFolder } from 'obsidian';
import { Dispatch, StateUpdater, useCallback } from 'preact/hooks';
import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import { getEntityFromPath, insertEntity, moveEntity, removeEntity } from 'src/dnd/util/data';
import { t } from 'src/lang/helpers';
import KanbanPlugin from 'src/main';

import { BoardModifiers } from '../../helpers/boardModifiers';
import { applyTemplate, escapeRegExpStr, generateInstanceId } from '../helpers';
import { EditState, Item } from '../types';
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
  constructMenuTimePickerOnChange,
  constructTimePicker,
  createCalendarEvent,
  getCalendarDisplayName,
  getFullCalendarDataSync,
} from './helpers';

/**
 * Ensures a file has a StateManager and returns it
 */
async function ensureStateManager(app: any, file: any, plugin: any): Promise<StateManager | null> {
  try {
    // Check if state manager already exists
    if (plugin.stateManagers.has(file)) {
      return plugin.stateManagers.get(file);
    }

    // Read the file content to create a state manager
    const content = await app.vault.read(file);

    // Create a temporary view-like object for state manager creation
    const tempView = {
      file: file,
      app: app,
      plugin: plugin,
    };

    // Create the state manager
    const stateManager = new StateManager(
      app,
      tempView as any,
      content,
      () => plugin.stateManagers.delete(file),
      () => plugin.settings
    );

    // Register it
    plugin.stateManagers.set(file, stateManager);

    return stateManager;
  } catch (error) {
    console.error('Error ensuring state manager for file:', file.path, error);
    return null;
  }
}

/**
 * Moves a card from the current board to a lane in an associated file
 */
async function moveCardToAssociatedFile(
  sourceStateManager: StateManager,
  targetFile: any,
  item: any, // Item type
  sourcePath: number[], // Path type
  targetLaneIndex: number
) {
  try {
    // Get the plugin instance
    const plugin = (sourceStateManager.app as any).plugins.plugins['kanban-plus'];

    if (!plugin) {
      console.error('Kanban Plus plugin not found');
      return;
    }

    // Ensure target file has a state manager
    const targetStateManager = await ensureStateManager(sourceStateManager.app, targetFile, plugin);

    if (!targetStateManager) {
      console.error('Could not create state manager for target file:', targetFile.path);
      return;
    }

    // Get the card entity from source board
    const sourceEntity = getEntityFromPath(sourceStateManager.state, sourcePath);

    if (!sourceEntity) {
      console.error('Could not find card at path:', sourcePath);
      return;
    }

    // Add card to target board first
    targetStateManager.setState((targetBoard) => {
      const targetPath = [targetLaneIndex, 0]; // Add to top of target lane
      return insertEntity(targetBoard, targetPath, [sourceEntity]);
    });

    // Remove card from source board
    sourceStateManager.setState((sourceBoard) => {
      return removeEntity(sourceBoard, sourcePath);
    });

    console.log(
      `Successfully moved card from ${sourceStateManager.file.path} to ${targetFile.path}`
    );
  } catch (error) {
    console.error('Error moving card to associated file:', error);
  }
}

const illegalCharsRegEx = /[\\/:"*?<>|]+/g;
const embedRegEx = /!?\[\[([^\]]*)\.[^\]]+\]\]/g;
const wikilinkRegEx = /!?\[\[([^\]]*)\]\]/g;
const mdLinkRegEx = /!?\[([^\]]*)\]\([^)]*\)/g;
const tagRegEx = /#([^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~[\]\\\s\n\r]+)/g;
const condenceWhiteSpaceRE = /\s+/g;

interface UseItemMenuParams {
  setEditState: Dispatch<StateUpdater<EditState>>;
  item: Item;
  path: Path;
  boardModifiers: BoardModifiers;
  stateManager: StateManager;
}

export function useItemMenu({
  setEditState,
  item,
  path,
  boardModifiers,
  stateManager,
}: UseItemMenuParams) {
  return useCallback(
    (e: MouseEvent) => {
      const coordinates = { x: e.clientX, y: e.clientY };
      const hasDate = !!item.data.metadata.date;
      const hasTime = !!item.data.metadata.time;

      const menu = new Menu().addItem((i) => {
        i.setIcon('lucide-edit')
          .setTitle(t('Edit card'))
          .onClick(() => setEditState(coordinates));
      });

      menu
        .addItem((i) => {
          i.setIcon('lucide-file-plus-2')
            .setTitle(t('New note from card'))
            .onClick(async () => {
              const prevTitle = item.data.titleRaw.split('\n')[0].trim();
              const sanitizedTitle = prevTitle
                .replace(embedRegEx, '$1')
                .replace(wikilinkRegEx, '$1')
                .replace(mdLinkRegEx, '$1')
                .replace(tagRegEx, '$1')
                .replace(illegalCharsRegEx, ' ')
                .trim()
                .replace(condenceWhiteSpaceRE, ' ');

              const newNoteFolder = stateManager.getSetting('new-note-folder');
              const newNoteTemplatePath = stateManager.getSetting('new-note-template');

              const targetFolder = newNoteFolder
                ? (stateManager.app.vault.getAbstractFileByPath(newNoteFolder as string) as TFolder)
                : stateManager.app.fileManager.getNewFileParent(stateManager.file.path);

              const newFile = (await (stateManager.app.fileManager as any).createNewMarkdownFile(
                targetFolder,
                sanitizedTitle
              )) as TFile;

              const newLeaf = stateManager.app.workspace.splitActiveLeaf();

              await newLeaf.openFile(newFile);

              stateManager.app.workspace.setActiveLeaf(newLeaf, false, true);

              await applyTemplate(stateManager, newNoteTemplatePath as string | undefined);

              const newTitleRaw = item.data.titleRaw.replace(
                prevTitle,
                stateManager.app.fileManager.generateMarkdownLink(newFile, stateManager.file.path)
              );

              boardModifiers.updateItem(path, stateManager.updateItemContent(item, newTitleRaw));
            });
        })
        .addItem((i) => {
          i.setIcon('lucide-link')
            .setTitle(t('Copy link to card'))
            .onClick(() => {
              if (item.data.blockId) {
                navigator.clipboard.writeText(
                  `${this.app.fileManager.generateMarkdownLink(
                    stateManager.file,
                    '',
                    '#^' + item.data.blockId
                  )}`
                );
              } else {
                const id = generateInstanceId(6);

                navigator.clipboard.writeText(
                  `${this.app.fileManager.generateMarkdownLink(stateManager.file, '', '#^' + id)}`
                );

                boardModifiers.updateItem(
                  path,
                  stateManager.updateItemContent(
                    update(item, { data: { blockId: { $set: id } } }),
                    item.data.titleRaw
                  )
                );
              }
            });
        })
        .addSeparator();

      if (/\n/.test(item.data.titleRaw)) {
        menu.addItem((i) => {
          i.setIcon('lucide-wrap-text')
            .setTitle(t('Split card'))
            .onClick(async () => {
              const titles = item.data.titleRaw.split(/[\r\n]+/g).map((t) => t.trim());
              const newItems = await Promise.all(
                titles.map((title) => {
                  return stateManager.getNewItem(title, ' ');
                })
              );

              boardModifiers.splitItem(path, newItems);
            });
        });
      }

      menu
        .addItem((i) => {
          i.setIcon('lucide-copy')
            .setTitle(t('Duplicate card'))
            .onClick(() => boardModifiers.duplicateEntity(path));
        })
        .addItem((i) => {
          i.setIcon('lucide-list-start')
            .setTitle(t('Insert card before'))
            .onClick(() =>
              boardModifiers.insertItems(path, [stateManager.getNewItem('', ' ', true)])
            );
        })
        .addItem((i) => {
          i.setIcon('lucide-list-end')
            .setTitle(t('Insert card after'))
            .onClick(() => {
              const newPath = [...path];

              newPath[newPath.length - 1] = newPath[newPath.length - 1] + 1;

              boardModifiers.insertItems(newPath, [stateManager.getNewItem('', ' ', true)]);
            });
        })
        .addItem((i) => {
          i.setIcon('lucide-arrow-up')
            .setTitle(t('Move to top'))
            .onClick(() => boardModifiers.moveItemToTop(path));
        })
        .addItem((i) => {
          i.setIcon('lucide-arrow-down')
            .setTitle(t('Move to bottom'))
            .onClick(() => boardModifiers.moveItemToBottom(path));
        })
        .addItem((i) => {
          i.setIcon('lucide-archive')
            .setTitle(t('Archive card'))
            .onClick(() => boardModifiers.archiveItem(path));
        })
        .addItem((i) => {
          i.setIcon('lucide-trash-2')
            .setTitle(t('Delete card'))
            .onClick(() => boardModifiers.deleteEntity(path));
        })
        .addSeparator()
        .addItem((i) => {
          i.setIcon('lucide-calendar-check')
            .setTitle(hasDate ? t('Edit date') : t('Add date'))
            .onClick(() => {
              constructDatePicker(
                e.view,
                stateManager,
                coordinates,
                constructMenuDatePickerOnChange({
                  stateManager,
                  boardModifiers,
                  item,
                  hasDate,
                  path,
                }),
                item.data.metadata.date?.toDate()
              );
            });
        });

      if (hasDate) {
        menu.addItem((i) => {
          i.setIcon('lucide-x')
            .setTitle(t('Remove date'))
            .onClick(() => {
              const shouldLinkDates = stateManager.getSetting('link-date-to-daily-note');
              const dateTrigger = stateManager.getSetting('date-trigger');
              const contentMatch = shouldLinkDates
                ? '(?:\\[[^\\]]+\\]\\([^\\)]+\\)|\\[\\[[^\\]]+\\]\\])'
                : '{[^}]+}';
              const dateRegEx = new RegExp(
                `(^|\\s)${escapeRegExpStr(dateTrigger as string)}${contentMatch}`
              );

              const titleRaw = item.data.titleRaw.replace(dateRegEx, '').trim();

              boardModifiers.updateItem(path, stateManager.updateItemContent(item, titleRaw));
            });
        });

        menu.addItem((i) => {
          i.setIcon('lucide-clock')
            .setTitle(hasTime ? t('Edit time') : t('Add time'))
            .onClick(() => {
              constructTimePicker(
                e.view,
                stateManager,
                coordinates,
                constructMenuTimePickerOnChange({
                  stateManager,
                  boardModifiers,
                  item,
                  hasTime,
                  path,
                }),
                item.data.metadata.time
              );
            });
        });

        if (hasTime) {
          menu.addItem((i) => {
            i.setIcon('lucide-x')
              .setTitle(t('Remove time'))
              .onClick(() => {
                const timeTrigger = stateManager.getSetting('time-trigger');
                const timeRegEx = new RegExp(
                  `(^|\\s)${escapeRegExpStr(timeTrigger as string)}{([^}]+)}`
                );

                const titleRaw = item.data.titleRaw.replace(timeRegEx, '').trim();
                boardModifiers.updateItem(path, stateManager.updateItemContent(item, titleRaw));
              });
          });
        }
      }

      menu.addSeparator();

      const addMoveToOptions = (menu: Menu) => {
        const lanes = stateManager.state.children;

        // Add current board lanes
        if (lanes.length > 1) {
          for (let i = 0, len = lanes.length; i < len; i++) {
            menu.addItem((item) =>
              item
                .setIcon('lucide-square-kanban')
                .setChecked(path[0] === i)
                .setTitle(lanes[i].data.title)
                .onClick(() => {
                  if (path[0] === i) return;
                  stateManager.setState((boardData) => {
                    return moveEntity(boardData, path, [i, 0]);
                  });
                })
            );
          }
        }

        // Add associated file lanes
        const associatedFiles = (stateManager.getSetting('associated-files') as string[]) || [];
        console.log('Associated files found:', associatedFiles);

        if (associatedFiles.length > 0) {
          // Add separator if we have current board lanes
          if (lanes.length > 1) {
            menu.addSeparator();
          }

          // Process all associated files synchronously using cached data
          associatedFiles.forEach((filePath) => {
            const file = stateManager.app.vault.getAbstractFileByPath(filePath);
            console.log('Processing associated file:', filePath, 'found:', !!file);

            if (file && 'extension' in file && file.extension === 'md') {
              const fileBasename = (file as any).basename;

              // Add a loading item that will populate lanes when clicked
              menu.addItem((item) =>
                item
                  .setIcon('lucide-file-text')
                  .setTitle(`${fileBasename} →`)
                  .onClick(async () => {
                    try {
                      console.log('Loading lanes for:', fileBasename);

                      // Parse the file content to get lane information
                      const content = await stateManager.app.vault.read(file as TFile);
                      console.log('Read content from:', fileBasename, 'length:', content.length);

                      // Simple markdown parsing to find H2 headers (lanes)
                      const lines = content.split('\n');
                      const lanes: string[] = [];

                      for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('## ') && !trimmed.includes('%%')) {
                          const laneTitle = trimmed.substring(3).trim();
                          if (laneTitle) {
                            lanes.push(laneTitle);
                          }
                        }
                      }

                      console.log('Found lanes in', fileBasename + ':', lanes);

                      if (lanes.length > 0) {
                        // Create a submenu with the lanes
                        const submenu = new Menu();

                        lanes.forEach((laneTitle, laneIndex) => {
                          submenu.addItem((subItem) =>
                            subItem
                              .setIcon('lucide-square-kanban')
                              .setTitle(laneTitle)
                              .onClick(async () => {
                                console.log(`Moving card to ${fileBasename}/${laneTitle}`);
                                await moveCardToAssociatedFile(
                                  stateManager,
                                  file as TFile,
                                  item,
                                  path,
                                  laneIndex
                                );
                              })
                          );
                        });

                        // Show submenu at current position
                        submenu.showAtPosition(coordinates);
                      } else {
                        console.error('No lanes found in:', fileBasename);
                      }
                    } catch (error) {
                      console.error('Error loading lanes for:', fileBasename, error);
                    }
                  })
              );
            }
          });
        }
      };

      if (Platform.isPhone) {
        addMoveToOptions(menu);
      } else {
        menu.addItem((item) => {
          const submenu = (item as any)
            .setTitle(t('Move to list'))
            .setIcon('lucide-square-kanban')
            .setSubmenu();

          addMoveToOptions(submenu);
        });
      }

      // Add Copy to calendar functionality (like Move to list)
      // Only show if the feature is enabled in settings
      const copyToCalendarEnabled = stateManager.getSetting('enable-copy-to-calendar');
      console.log('Copy to calendar enabled:', copyToCalendarEnabled);
      if (copyToCalendarEnabled) {
        const calendars = getFullCalendarDataSync(stateManager);
        console.log('Available calendars:', calendars);

        const addCopyToCalendarOptions = (menu: Menu) => {
          if (calendars.length === 0) {
            menu.addItem((item) => item.setTitle('No calendars found').setDisabled(true));
            return;
          }

          // Helper function to get closest unicode circle for a color
          function getColorCircle(color: string): string {
            console.log(`🎨 Detecting color for: ${color}`);

            const colorLower = color.toLowerCase();
            // Map common colors to Unicode circles
            if (colorLower.includes('red') || colorLower === '#ff0000' || colorLower === '#f00')
              return '🔴';
            if (colorLower.includes('blue') || colorLower === '#0000ff' || colorLower === '#00f')
              return '🔵';
            if (colorLower.includes('green') || colorLower === '#00ff00' || colorLower === '#0f0')
              return '🟢';
            if (colorLower.includes('yellow') || colorLower === '#ffff00' || colorLower === '#ff0')
              return '🟡';
            if (
              colorLower.includes('purple') ||
              colorLower.includes('violet') ||
              colorLower.includes('magenta')
            )
              return '🟣';
            if (colorLower.includes('orange') || colorLower === '#ffa500') return '🟠';
            if (colorLower.includes('brown')) return '🟤';
            if (colorLower.includes('black') || colorLower === '#000000' || colorLower === '#000')
              return '⚫';
            if (colorLower.includes('white') || colorLower === '#ffffff' || colorLower === '#fff')
              return '⚪';

            // For hex colors, try to determine the dominant color
            if (color.startsWith('#')) {
              const hex = color.slice(1);
              const r = parseInt(hex.substr(0, 2), 16);
              const g = parseInt(hex.substr(2, 2), 16);
              const b = parseInt(hex.substr(4, 2), 16);

              console.log(`🎨 RGB values: R=${r}, G=${g}, B=${b}`);

              // Improved color detection logic
              const maxVal = Math.max(r, g, b);
              const minVal = Math.min(r, g, b);
              const diff = maxVal - minVal;

              // Check for purple/magenta (high red + blue, low green)
              if (r > 100 && b > 100 && g < Math.min(r, b) * 0.7) {
                console.log(`🎨 Detected purple: ${color} -> 🟣`);
                return '🟣';
              }

              // Check for orange (high red, medium green, low blue)
              if (r > g && g > b && r > 150 && g > 80 && b < 100) {
                console.log(`🎨 Detected orange: ${color} -> 🟠`);
                return '🟠';
              }

              // Check for yellow (high red + green, low blue)
              if (r > 150 && g > 150 && b < 100) {
                console.log(`🎨 Detected yellow: ${color} -> 🟡`);
                return '🟡';
              }

              // Primary color detection
              if (r > g && r > b && diff > 50) {
                console.log(`🎨 Detected red: ${color} -> 🔴`);
                return '🔴';
              }
              if (g > r && g > b && diff > 50) {
                console.log(`🎨 Detected green: ${color} -> 🟢`);
                return '🟢';
              }
              if (b > r && b > g && diff > 50) {
                console.log(`🎨 Detected blue: ${color} -> 🔵`);
                return '🔵';
              }
            }

            console.log(`🎨 Defaulting to black: ${color} -> ⚫`);
            return '⚫';
          }

          for (let i = 0, len = calendars.length; i < len; i++) {
            const calendar = calendars[i];
            const displayName = getCalendarDisplayName(calendar.directory);
            const colorCircle = getColorCircle(calendar.color);
            const titleWithCircle = `${colorCircle} ${displayName}`;

            menu.addItem((menuItem) =>
              menuItem
                .setIcon('lucide-calendar')
                .setTitle(titleWithCircle)
                .onClick(async () => {
                  await createCalendarEvent(stateManager, item, calendar);
                })
            );
          }
        };

        if (Platform.isPhone) {
          // For mobile, add calendar options directly to main menu
          addCopyToCalendarOptions(menu);
        } else {
          // For desktop, create submenu like "Move to list"
          menu.addItem((menuItem) => {
            console.log('Creating Copy to calendar submenu...');
            const submenu = (menuItem as any)
              .setTitle(t('Copy to calendar'))
              .setIcon('lucide-calendar-plus')
              .setSubmenu();

            console.log('Submenu created, adding calendar options...');
            addCopyToCalendarOptions(submenu);
            console.log('Calendar options added to submenu');
          });
        }
      }

      menu.showAtPosition(coordinates);
    },
    [setEditState, item, path, boardModifiers, stateManager]
  );
}
