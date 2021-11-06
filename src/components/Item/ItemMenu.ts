import { Menu, TFile, TFolder, getLinkpath } from 'obsidian';
import React from 'react';

import { Path } from 'src/dnd/types';
import { t } from 'src/lang/helpers';
import { StateManager } from 'src/StateManager';

import { BoardModifiers } from '../../helpers/boardModifiers';
import { applyTemplate, escapeRegExpStr } from '../helpers';
import { Item } from '../types';
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
  constructMenuTimePickerOnChange,
  constructTimePicker,
} from './helpers';

const illegalCharsRegEx = /[\\/:"*?<>|]+/g;

interface UseItemMenuParams {
  setIsEditing: React.Dispatch<boolean>;
  item: Item;
  path: Path;
  boardModifiers: BoardModifiers;
  stateManager: StateManager;
}

export function useItemMenu({
  setIsEditing,
  item,
  path,
  boardModifiers,
  stateManager,
}: UseItemMenuParams) {
  return React.useCallback(
    (e: MouseEvent, internalLinkPath?: string) => {
      if (internalLinkPath) {
        (stateManager.app.workspace as any).onLinkContextMenu(
          e,
          getLinkpath(internalLinkPath),
          stateManager.file.path
        );
      } else {
        const coordinates = { x: e.clientX, y: e.clientY };
        const hasDate = !!item.data.metadata.date;
        const hasTime = !!item.data.metadata.time;

        const menu = new Menu(stateManager.app).addItem((i) => {
          i.setIcon('pencil')
            .setTitle(t('Edit card'))
            .onClick(() => setIsEditing(true));
        });

        menu
          .addItem((i) => {
            i.setIcon('create-new')
              .setTitle(t('New note from card'))
              .onClick(async () => {
                const prevTitle = item.data.title.split('\n')[0].trim();
                let sanitizedTitle = prevTitle
                  .replace(illegalCharsRegEx, ' ')
                  .trim();

                const isEmbed = /^!\[/.test(prevTitle);

                if (isEmbed) {
                  const split = sanitizedTitle
                    .replace(/!\[+([^\]]+).+$/, '$1')
                    .split('.');

                  split.pop();

                  sanitizedTitle = split.join('.').trim();
                }

                const newNoteFolder =
                  stateManager.getSetting('new-note-folder');
                const newNoteTemplatePath =
                  stateManager.getSetting('new-note-template');

                const targetFolder = newNoteFolder
                  ? (stateManager.app.vault.getAbstractFileByPath(
                      newNoteFolder as string
                    ) as TFolder)
                  : stateManager.app.fileManager.getNewFileParent(
                      stateManager.file.path
                    );

                const newFile = (await (
                  stateManager.app.fileManager as any
                ).createNewMarkdownFile(targetFolder, sanitizedTitle)) as TFile;

                const newLeaf = stateManager.app.workspace.splitActiveLeaf();

                await newLeaf.openFile(newFile);

                stateManager.app.workspace.setActiveLeaf(newLeaf, false, true);

                await applyTemplate(
                  stateManager,
                  newNoteTemplatePath as string | undefined
                );

                const newTitleRaw = item.data.titleRaw.replace(
                  prevTitle,
                  isEmbed
                    ? `[${prevTitle}](${encodeURIComponent(newFile.path)})`
                    : stateManager.app.fileManager.generateMarkdownLink(
                        newFile,
                        stateManager.file.path
                      )
                );

                stateManager
                  .updateItemContent(item, newTitleRaw)
                  .then((item) => {
                    boardModifiers.updateItem(path, item);
                  })
                  .catch((e) => console.error(e));
              });
          })
          .addItem((i) => {
            i.setIcon('links-coming-in')
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
                  const id = Math.random().toString(36).substr(2, 6);

                  navigator.clipboard.writeText(
                    `${this.app.fileManager.generateMarkdownLink(
                      stateManager.file,
                      '',
                      '#^' + id
                    )}`
                  );

                  stateManager
                    .updateItemContent(item, `${item.data.titleRaw} ^${id}`)
                    .then((item) => {
                      boardModifiers.updateItem(path, item);
                    })
                    .catch((e) => console.error(e));
                }
              });
          })
          .addSeparator();

        if (/\n/.test(item.data.titleRaw)) {
          menu.addItem((i) => {
            i.setIcon('split')
              .setTitle(t('Split card'))
              .onClick(async () => {
                const titles = item.data.titleRaw
                  .split(/[\r\n]+/g)
                  .map((t) => t.trim());
                const newItems = await Promise.all(
                  titles.map(async (title) => {
                    return await stateManager.getNewItem(title);
                  })
                );

                boardModifiers.splitItem(path, newItems);
              });
          });
        }

        menu
          .addItem((i) => {
            i.setIcon('documents')
              .setTitle(t('Duplicate card'))
              .onClick(() => boardModifiers.duplicateEntity(path));
          })
          .addItem((i) => {
            i.setIcon('plus-with-circle')
              .setTitle(t('Insert card before'))
              .onClick(async () =>
                boardModifiers.insertItems(path, [
                  await stateManager.getNewItem('', false, true),
                ])
              );
          })
          .addItem((i) => {
            i.setIcon('plus-with-circle')
              .setTitle(t('Insert card after'))
              .onClick(async () => {
                const newPath = [...path];

                newPath[newPath.length - 1] = newPath[newPath.length - 1] + 1;

                boardModifiers.insertItems(newPath, [
                  await stateManager.getNewItem('', false, true),
                ]);
              });
          })
          .addItem((i) => {
            i.setIcon('sheets-in-box')
              .setTitle(t('Archive card'))
              .onClick(() => boardModifiers.archiveItem(path));
          })
          .addItem((i) => {
            i.setIcon('trash')
              .setTitle(t('Delete card'))
              .onClick(() => boardModifiers.deleteEntity(path));
          })
          .addSeparator()
          .addItem((i) => {
            i.setIcon('calendar-with-checkmark')
              .setTitle(hasDate ? t('Edit date') : t('Add date'))
              .onClick(() => {
                constructDatePicker(
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
            i.setIcon('cross')
              .setTitle(t('Remove date'))
              .onClick(() => {
                const shouldLinkDates = stateManager.getSetting(
                  'link-date-to-daily-note'
                );
                const dateTrigger = stateManager.getSetting('date-trigger');
                const contentMatch = shouldLinkDates
                  ? '(?:\\[[^\\]]+\\]\\([^\\)]+\\)|\\[\\[[^\\]]+\\]\\])'
                  : '{[^}]+}';
                const dateRegEx = new RegExp(
                  `(^|\\s)${escapeRegExpStr(
                    dateTrigger as string
                  )}${contentMatch}`
                );

                const titleRaw = item.data.titleRaw
                  .replace(dateRegEx, '')
                  .trim();

                stateManager
                  .updateItemContent(item, titleRaw)
                  .then((item) => {
                    boardModifiers.updateItem(path, item);
                  })
                  .catch((e) => console.error(e));
              });
          });

          menu.addItem((i) => {
            i.setIcon('clock')
              .setTitle(hasTime ? t('Edit time') : t('Add time'))
              .onClick(() => {
                constructTimePicker(
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
              i.setIcon('cross')
                .setTitle(t('Remove time'))
                .onClick(() => {
                  const timeTrigger = stateManager.getSetting('time-trigger');
                  const timeRegEx = new RegExp(
                    `(^|\\s)${escapeRegExpStr(timeTrigger as string)}{([^}]+)}`
                  );

                  const titleRaw = item.data.titleRaw
                    .replace(timeRegEx, '')
                    .trim();

                  stateManager
                    .updateItemContent(item, titleRaw)
                    .then((item) => {
                      boardModifiers.updateItem(path, item);
                    })
                    .catch((e) => console.error(e));
                });
            });
          }
        }

        menu.showAtPosition(coordinates);
      }
    },
    [setIsEditing, item, path, boardModifiers, stateManager]
  );
}
