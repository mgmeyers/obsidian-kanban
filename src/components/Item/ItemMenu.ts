import { Menu, TFolder, getLinkpath } from 'obsidian';
import React from 'react';

import { Path } from 'src/dnd/types';
import { t } from 'src/lang/helpers';
import { StateManager } from 'src/StateManager';

import { applyTemplate, escapeRegExpStr } from '../helpers';
import { BoardModifiers } from '../helpers/boardModifiers';
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
                const prevTitle = item.data.title;
                const sanitizedTitle = item.data.title.replace(
                  illegalCharsRegEx,
                  ' '
                );

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

                const newFile = await (
                  stateManager.app.fileManager as any
                ).createNewMarkdownFile(targetFolder, sanitizedTitle);

                const newLeaf = stateManager.app.workspace.splitActiveLeaf();

                await newLeaf.openFile(newFile);

                stateManager.app.workspace.setActiveLeaf(newLeaf, false, true);

                await applyTemplate(
                  stateManager,
                  newNoteTemplatePath as string | undefined
                );

                const newTitleRaw = item.data.titleRaw.replace(
                  prevTitle,
                  `[[${sanitizedTitle}]]`
                );

                boardModifiers.updateItem(
                  path,
                  stateManager.parser.updateItem(item, newTitleRaw)
                );
              });
          })
          .addSeparator()
          .addItem((i) => {
            i.setIcon('documents')
              .setTitle(t('Duplicate card'))
              .onClick(() => boardModifiers.duplicateEntity(path));
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
                  ? '\\[\\[[^}]+\\]\\]'
                  : '{[^}]+}';
                const dateRegEx = new RegExp(
                  `(^|\\s)${escapeRegExpStr(
                    dateTrigger as string
                  )}${contentMatch}`
                );

                const titleRaw = item.data.titleRaw
                  .replace(dateRegEx, '')
                  .trim();
                boardModifiers.updateItem(
                  path,
                  stateManager.parser.updateItem(item, titleRaw)
                );
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
                  boardModifiers.updateItem(
                    path,
                    stateManager.parser.updateItem(item, titleRaw)
                  );
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
