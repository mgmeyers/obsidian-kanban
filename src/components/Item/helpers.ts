import { FileWithPath, fromEvent } from 'file-selector';
import flatpickr from 'flatpickr';
import {
  MarkdownSourceView,
  TFile,
  TFolder,
  htmlToMarkdown,
  moment,
  parseLinktext,
  setIcon,
} from 'obsidian';

import { Path } from 'src/dnd/types';
import { buildLinkToDailyNote } from 'src/helpers';
import { StateManager } from 'src/StateManager';

import { BoardModifiers } from '../../helpers/boardModifiers';
import { getDefaultLocale } from '../Editor/datePickerLocale';
import { c, escapeRegExpStr } from '../helpers';
import { Item } from '../types';

export function constructDatePicker(
  stateManager: StateManager,
  coordinates: { x: number; y: number },
  onChange: (dates: Date[]) => void,
  date?: Date
) {
  return document.body.createDiv(
    { cls: `${c('date-picker')} ${c('ignore-click-outside')}` },
    (div) => {
      div.style.left = `${coordinates.x || 0}px`;
      div.style.top = `${coordinates.y || 0}px`;

      div.createEl('input', { type: 'text' }, (input) => {
        setTimeout(() => {
          let picker: flatpickr.Instance | null = null;

          const clickHandler = (e: MouseEvent) => {
            if (
              e.target instanceof HTMLElement &&
              e.target.closest(`.${c('date-picker')}`) === null
            ) {
              selfDestruct();
            }
          };

          const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
              selfDestruct();
            }
          };

          const selfDestruct = () => {
            picker.destroy();
            div.remove();
            document.body.removeEventListener('click', clickHandler);
            document.removeEventListener('keydown', keyHandler);
          };

          picker = flatpickr(input, {
            locale: getDefaultLocale(stateManager),
            defaultDate: date,
            inline: true,
            onChange: (dates) => {
              onChange(dates);
              selfDestruct();
            },
          });

          setTimeout(() => {
            const height = div.clientHeight;
            const width = div.clientWidth;

            if (coordinates.y + height > window.innerHeight) {
              div.style.top = `${(coordinates.y || 0) - height}px`;
            }

            if (coordinates.x + width > window.innerWidth) {
              div.style.left = `${(coordinates.x || 0) - width}px`;
            }
          });

          document.body.addEventListener('click', clickHandler);
          document.addEventListener('keydown', keyHandler);
        });
      });
    }
  );
}

interface ConstructMenuDatePickerOnChangeParams {
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
  item: Item;
  hasDate: boolean;
  path: Path;
}

export function constructMenuDatePickerOnChange({
  stateManager,
  boardModifiers,
  item,
  hasDate,
  path,
}: ConstructMenuDatePickerOnChangeParams) {
  const dateFormat = stateManager.getSetting('date-format');
  const shouldLinkDates = stateManager.getSetting('link-date-to-daily-note');
  const dateTrigger = stateManager.getSetting('date-trigger');
  const contentMatch = shouldLinkDates
    ? '(?:\\[[^\\]]+\\]\\([^)]+\\)|\\[\\[[^\\]]+\\]\\])'
    : '{[^}]+}';
  const dateRegEx = new RegExp(
    `(^|\\s)${escapeRegExpStr(dateTrigger as string)}${contentMatch}`
  );

  return (dates: Date[]) => {
    const date = dates[0];
    const formattedDate = moment(date).format(dateFormat);
    const wrappedDate = shouldLinkDates
      ? buildLinkToDailyNote(stateManager.app, formattedDate)
      : `{${formattedDate}}`;

    let titleRaw = item.data.titleRaw;

    if (hasDate) {
      titleRaw = item.data.titleRaw.replace(
        dateRegEx,
        `$1${dateTrigger}${wrappedDate}`
      );
    } else {
      titleRaw = `${item.data.titleRaw} ${dateTrigger}${wrappedDate}`;
    }

    stateManager.parser
      .updateItem(item, titleRaw)
      .then((item) => {
        boardModifiers.updateItem(path, item);
      })
      .catch((e) => console.error(e));
  };
}

export function buildTimeArray(stateManager: StateManager) {
  const format = stateManager.getSetting('time-format');
  const time: string[] = [];

  for (let i = 0; i < 24; i++) {
    time.push(moment({ hour: i }).format(format));
    time.push(moment({ hour: i, minute: 15 }).format(format));
    time.push(moment({ hour: i, minute: 30 }).format(format));
    time.push(moment({ hour: i, minute: 45 }).format(format));
  }

  return time;
}

export function constructTimePicker(
  stateManager: StateManager,
  coordinates: { x: number; y: number },
  onSelect: (opt: string) => void,
  time?: moment.Moment
) {
  const pickerClassName = c('time-picker');
  const timeFormat = stateManager.getSetting('time-format');
  const selected = time?.format(timeFormat);

  document.body.createDiv(
    { cls: `${pickerClassName} ${c('ignore-click-outside')}` },
    (div) => {
      const options = buildTimeArray(stateManager);

      const clickHandler = (e: MouseEvent) => {
        if (
          e.target instanceof HTMLElement &&
          e.target.hasClass(c('time-picker-item')) &&
          e.target.dataset.value
        ) {
          onSelect(e.target.dataset.value);
          selfDestruct();
        }
      };

      const clickOutsideHandler = (e: MouseEvent) => {
        if (
          e.target instanceof HTMLElement &&
          e.target.closest(`.${pickerClassName}`) === null
        ) {
          selfDestruct();
        }
      };

      const escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          selfDestruct();
        }
      };

      const selfDestruct = () => {
        div.remove();
        div.removeEventListener('click', clickHandler);
        document.body.removeEventListener('click', clickOutsideHandler);
        document.removeEventListener('keydown', escHandler);
      };

      div.style.left = `${coordinates.x || 0}px`;
      div.style.top = `${coordinates.y || 0}px`;

      let selectedItem: HTMLDivElement = null;
      let middleItem: HTMLDivElement = null;

      options.forEach((opt, index) => {
        const isSelected = opt === selected;
        div.createDiv(
          {
            cls: `${c('time-picker-item')} ${isSelected ? 'is-selected' : ''}`,
            text: opt,
          },
          (item) => {
            item.createEl(
              'span',
              { cls: c('time-picker-check'), prepend: true },
              (span) => {
                setIcon(span, 'checkmark');
              }
            );

            if (index % 4 === 0) {
              item.addClass('is-hour');
            }

            item.dataset.value = opt;

            if (isSelected) selectedItem = item;
            if (index === Math.floor(options.length / 2)) {
              middleItem = item;
            }
          }
        );
      });

      setTimeout(() => {
        const height = div.clientHeight;
        const width = div.clientWidth;

        if (coordinates.y + height > window.innerHeight) {
          div.style.top = `${(coordinates.y || 0) - height}px`;
        }

        if (coordinates.x + width > window.innerWidth) {
          div.style.left = `${(coordinates.x || 0) - width}px`;
        }

        (selectedItem || middleItem)?.scrollIntoView({
          block: 'center',
          inline: 'nearest',
        });

        div.addEventListener('click', clickHandler);
        document.body.addEventListener('click', clickOutsideHandler);
        document.addEventListener('keydown', escHandler);
      });
    }
  );
}

interface ConstructMenuTimePickerOnChangeParams {
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
  item: Item;
  hasTime: boolean;
  path: Path;
}

export function constructMenuTimePickerOnChange({
  stateManager,
  boardModifiers,
  item,
  hasTime,
  path,
}: ConstructMenuTimePickerOnChangeParams) {
  const timeTrigger = stateManager.getSetting('time-trigger');
  const timeRegEx = new RegExp(
    `(^|\\s)${escapeRegExpStr(timeTrigger as string)}{([^}]+)}`
  );

  return (time: string) => {
    let titleRaw = item.data.titleRaw;

    if (hasTime) {
      titleRaw = item.data.titleRaw.replace(
        timeRegEx,
        `$1${timeTrigger}{${time}}`
      );
    } else {
      titleRaw = `${item.data.titleRaw} ${timeTrigger}{${time}}`;
    }

    stateManager.parser
      .updateItem(item, titleRaw)
      .then((item) => {
        boardModifiers.updateItem(path, item);
      })
      .catch((e) => console.error(e));
  };
}

export function getItemClassModifiers(item: Item) {
  const date = item.data.metadata.date;
  const classModifiers: string[] = [];

  if (date) {
    if (date.isSame(new Date(), 'day')) {
      classModifiers.push('is-today');
    }

    if (date.isAfter(new Date(), 'day')) {
      classModifiers.push('is-future');
    }

    if (date.isBefore(new Date(), 'day')) {
      classModifiers.push('is-past');
    }
  }

  if (item.data.isComplete) {
    classModifiers.push('is-complete');
  }

  for (const tag of item.data.metadata.tags) {
    classModifiers.push(`has-tag-${tag.slice(1)}`);
  }

  return classModifiers;
}

export function linkTo(
  stateManager: StateManager,
  file: TFile,
  sourcePath: string,
  subpath?: string
) {
  // Generate a link relative to this Kanban board, respecting user link type preferences
  return stateManager.app.fileManager.generateMarkdownLink(
    file,
    sourcePath,
    subpath
  );
}

export function getMarkdown(
  stateManager: StateManager,
  transfer: DataTransfer,
  html: string
) {
  // 0.12.5 -- remove handleDataTransfer below when this version is more widely supported
  if (htmlToMarkdown) {
    return htmlToMarkdown(html);
  }

  // crude hack to use Obsidian's html-to-markdown converter (replace when Obsidian exposes it in API):
  return (MarkdownSourceView.prototype as any).handleDataTransfer.call(
    { app: stateManager.app },
    transfer
  ) as string;
}

export function fixLinks(text: string) {
  // Internal links from e.g. dataview plugin incorrectly begin with `app://obsidian.md/`, and
  // we also want to remove bullet points and task markers from text and markdown
  return text.replace(/^\[(.*)\]\(app:\/\/obsidian.md\/(.*)\)$/, '[$1]($2)');
}

function handleFiles(stateManager: StateManager, files: FileWithPath[]) {
  return Promise.all(
    files.map((file) => {
      const splitFileName = (file as FileWithPath).name.split('.');

      const ext = splitFileName.pop();
      const fileName = splitFileName.join('.');

      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const path = (await (
              stateManager.app.vault as any
            ).getAvailablePathForAttachments(
              fileName,
              ext,
              stateManager.file.path
            )) as string;
            const newFile = await stateManager.app.vault.createBinary(
              path,
              e.target.result as ArrayBuffer
            );

            resolve(linkTo(stateManager, newFile, stateManager.file.path));
          } catch (e) {
            console.error(e);
            reject(e);
          }
        };
        reader.readAsArrayBuffer(file as FileWithPath);
      });
    })
  );
}

async function handleNullDraggable(
  stateManager: StateManager,
  e: DragEvent | ClipboardEvent
) {
  const forcePlaintext = e instanceof DragEvent ? e.shiftKey : false;
  const transfer = e instanceof DragEvent ? e.dataTransfer : e.clipboardData;

  if (e instanceof DragEvent) {
    const files = await fromEvent(e);
    if (files.length) {
      return await handleFiles(stateManager, files as FileWithPath[]);
    }
  }

  const html = transfer.getData('text/html');
  const plain = transfer.getData('text/plain');
  const uris = transfer.getData('text/uri-list');

  const text = forcePlaintext
    ? plain || html
    : getMarkdown(stateManager, transfer, html);

  return [fixLinks(text || uris || plain || html || '')];
}

export async function handleDragOrPaste(
  stateManager: StateManager,
  e: DragEvent | ClipboardEvent
): Promise<string[]> {
  const draggable = (stateManager.app as any).dragManager.draggable;
  const transfer = e instanceof DragEvent ? e.dataTransfer : e.clipboardData;

  switch (draggable?.type) {
    case 'file':
      return [linkTo(stateManager, draggable.file, stateManager.file.path)];
    case 'files':
      return draggable.files.map((f: TFile) =>
        linkTo(stateManager, f, stateManager.file.path)
      );
    case 'folder': {
      return draggable.file.children
        .map((f: TFile | TFolder) => {
          if (f instanceof TFolder) {
            return null;
          }

          return linkTo(stateManager, f, stateManager.file.path);
        })
        .filter((link: string | null) => link);
    }
    case 'link': {
      let link = draggable.file
        ? linkTo(
            stateManager,
            draggable.file,
            parseLinktext(draggable.linktext).subpath
          )
        : `[[${draggable.linktext}]]`;
      const alias = new DOMParser().parseFromString(
        transfer.getData('text/html'),
        'text/html'
      ).documentElement.textContent; // Get raw text
      link = link
        .replace(/]]$/, `|${alias}]]`)
        .replace(/^\[[^\]].+]\(/, `[${alias}](`);
      return [link];
    }
    default: {
      return await handleNullDraggable(stateManager, e);
    }
  }
}
