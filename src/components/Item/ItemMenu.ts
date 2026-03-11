import update from 'immutability-helper';
import { Menu, Notice, Platform, SuggestModal, TFile, TFolder } from 'obsidian';
import { Dispatch, StateUpdater, useCallback } from 'preact/hooks';
import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import { getEntityFromPath, moveEntity, removeEntity } from 'src/dnd/util/data';
import { t } from 'src/lang/helpers';
import { frontmatterKey } from 'src/parsers/common';
import { parseMarkdown } from 'src/parsers/parseMarkdown';
import { astToUnhydratedBoard, boardToMd } from 'src/parsers/formats/list';
import { hydrateBoard } from 'src/parsers/helpers/hydrateBoard';

import { BoardModifiers } from '../../helpers/boardModifiers';
import { applyTemplate, escapeRegExpStr, generateInstanceId } from '../helpers';
import { DataTypes, EditState, Item } from '../types';
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
  constructMenuTimePickerOnChange,
  constructTimePicker,
} from './helpers';

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

interface MoveBoardOption {
  file: TFile;
}

interface MoveListOption {
  laneIndex: number;
  laneTitle: string;
}

class MoveBoardSuggestModal extends SuggestModal<MoveBoardOption> {
  constructor(
    stateManager: StateManager,
    private readonly options: MoveBoardOption[],
    private readonly onChoose: (option: MoveBoardOption) => void
  ) {
    super(stateManager.app);
    this.setPlaceholder(t('Select a board'));
    this.emptyStateText = t('No other kanban boards found');
  }

  getSuggestions(query: string): MoveBoardOption[] {
    const normalizedQuery = query.toLowerCase();
    return this.options.filter((o) => o.file.path.toLowerCase().includes(normalizedQuery));
  }

  renderSuggestion(value: MoveBoardOption, el: HTMLElement) {
    el.createDiv({ text: value.file.path });
  }

  onChooseSuggestion(item: MoveBoardOption): void {
    this.onChoose(item);
  }
}

class MoveListSuggestModal extends SuggestModal<MoveListOption> {
  constructor(
    stateManager: StateManager,
    private readonly boardFile: TFile,
    private readonly options: MoveListOption[],
    private readonly onChoose: (option: MoveListOption) => void
  ) {
    super(stateManager.app);
    this.setPlaceholder(t('Select a list'));
    this.setInstructions([{ command: boardFile.path, purpose: t('Target board') }]);
    this.emptyStateText = t('No lists found in this board');
  }

  getSuggestions(query: string): MoveListOption[] {
    const normalizedQuery = query.toLowerCase();
    return this.options.filter((o) => o.laneTitle.toLowerCase().includes(normalizedQuery));
  }

  renderSuggestion(value: MoveListOption, el: HTMLElement) {
    el.createDiv({ text: value.laneTitle });
  }

  onChooseSuggestion(item: MoveListOption): void {
    this.onChoose(item);
  }
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
        if (lanes.length <= 1) return;
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

      menu.addItem((i) => {
        i.setIcon('lucide-send')
          .setTitle(t('Move to board'))
          .onClick(async () => {
            const allMarkdownFiles = stateManager.app.vault.getMarkdownFiles();
            const boardOptions = allMarkdownFiles
              .filter((file) => {
                if (file.path === stateManager.file.path) return false;
                return !!stateManager.app.metadataCache.getFileCache(file)?.frontmatter?.[
                  frontmatterKey
                ];
              })
              .map((file) => ({ file }));

            if (!boardOptions.length) {
              new Notice(t('No other kanban boards found'));
              return;
            }

            new MoveBoardSuggestModal(stateManager, boardOptions, async ({ file }) => {
              const boardData = await stateManager.app.vault.cachedRead(file);
              const { ast, settings, frontmatter } = parseMarkdown(stateManager, boardData);
              const targetBoard = hydrateBoard(
                stateManager,
                astToUnhydratedBoard(stateManager, settings, frontmatter, ast, boardData)
              );

              if (!targetBoard.children.length) {
                new Notice(t('No lists found in this board'));
                return;
              }

              const laneOptions = targetBoard.children.map((lane, laneIndex) => ({
                laneIndex,
                laneTitle: lane.data.title,
              }));

              new MoveListSuggestModal(stateManager, file, laneOptions, async (lane) => {
                const currentItem = getEntityFromPath(stateManager.state, path);

                if (!currentItem || currentItem.type !== DataTypes.Item) {
                  return;
                }

                targetBoard.children[lane.laneIndex].children.push(currentItem);
                await stateManager.app.vault.modify(file, boardToMd(targetBoard));

                stateManager.setState((boardState) => removeEntity(boardState, path));

                new Notice(t('Card moved to board'));
              }).open();
            }).open();
          });
      });

      menu.showAtPosition(coordinates);
    },
    [setEditState, item, path, boardModifiers, stateManager]
  );
}
