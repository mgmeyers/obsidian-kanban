import { FileWithPath, fromEvent } from 'file-selector';
import update from 'immutability-helper';
import { Platform, TFile, TFolder, htmlToMarkdown, moment, parseLinktext, setIcon, Notice } from 'obsidian';
import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import { buildLinkToDailyNote } from 'src/helpers';
import { getTaskStatusDone } from 'src/parsers/helpers/inlineMetadata';

import { BoardModifiers } from '../../helpers/boardModifiers';
import { getDefaultLocale } from '../Editor/datePickerLocale';
import flatpickr from '../Editor/flatpickr';
import { Instance } from '../Editor/flatpickr/types/instance';
import { c, escapeRegExpStr, getContrastTextColor } from '../helpers';
import { Item } from '../types';

/**
 * Interface for Full Calendar plugin calendar sources
 * Used for the "Copy to calendar" feature integration
 */
interface CalendarSource {
  type: string;    // Calendar type (typically 'local' for file-based calendars)
  color: string;   // Display color for the calendar picker UI
  directory: string; // Target directory path for calendar events (may contain wildcards like '/*')
}

export function constructDatePicker(
  win: Window,
  stateManager: StateManager,
  coordinates: { x: number; y: number },
  onChange: (dates: Date[]) => void,
  date?: Date
) {
  return win.document.body.createDiv(
    { cls: `${c('date-picker')} ${c('ignore-click-outside')}` },
    (div) => {
      div.style.left = `${coordinates.x || 0}px`;
      div.style.top = `${coordinates.y || 0}px`;

      div.createEl('input', { type: 'text' }, (input) => {
        div.win.setTimeout(() => {
          let picker: Instance | null = null;

          const clickHandler = (e: MouseEvent) => {
            if (
              e.target instanceof (e.view as Window & typeof globalThis).HTMLElement &&
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
            win.document.body.removeEventListener('click', clickHandler);
            win.document.removeEventListener('keydown', keyHandler);
          };

          picker = flatpickr(input, {
            locale: getDefaultLocale(stateManager),
            defaultDate: date,
            inline: true,
            onChange: (dates) => {
              onChange(dates);
              selfDestruct();
            },
            win,
          });

          div.win.setTimeout(() => {
            const height = div.clientHeight;
            const width = div.clientWidth;

            if (coordinates.y + height > win.innerHeight) {
              div.style.top = `${(coordinates.y || 0) - height}px`;
            }

            if (coordinates.x + width > win.innerWidth) {
              div.style.left = `${(coordinates.x || 0) - width}px`;
            }
          });

          win.document.body.addEventListener('click', clickHandler);
          win.document.addEventListener('keydown', keyHandler);
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
  const dateRegEx = new RegExp(`(^|\\s)${escapeRegExpStr(dateTrigger as string)}${contentMatch}`);

  return (dates: Date[]) => {
    const date = dates[0];
    const formattedDate = moment(date).format(dateFormat);
    const wrappedDate = shouldLinkDates
      ? buildLinkToDailyNote(stateManager.app, formattedDate)
      : `{${formattedDate}}`;

    let titleRaw = item.data.titleRaw;

    if (hasDate) {
      titleRaw = item.data.titleRaw.replace(dateRegEx, `$1${dateTrigger}${wrappedDate}`);
    } else {
      titleRaw = `${item.data.titleRaw} ${dateTrigger}${wrappedDate}`;
    }

    boardModifiers.updateItem(path, stateManager.updateItemContent(item, titleRaw));
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
  win: Window,
  stateManager: StateManager,
  coordinates: { x: number; y: number },
  onSelect: (opt: string) => void,
  time?: moment.Moment
) {
  const pickerClassName = c('time-picker');
  const timeFormat = stateManager.getSetting('time-format');
  const selected = time?.format(timeFormat);

  win.document.body.createDiv({ cls: `${pickerClassName} ${c('ignore-click-outside')}` }, (div) => {
    const options = buildTimeArray(stateManager);

    const clickHandler = (e: MouseEvent) => {
      if (
        e.target instanceof (e.view as Window & typeof globalThis).HTMLElement &&
        e.target.hasClass(c('time-picker-item')) &&
        e.target.dataset.value
      ) {
        onSelect(e.target.dataset.value);
        selfDestruct();
      }
    };

    const clickOutsideHandler = (e: MouseEvent) => {
      if (
        e.target instanceof (e.view as Window & typeof globalThis).HTMLElement &&
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
      win.document.body.removeEventListener('click', clickOutsideHandler);
      win.document.removeEventListener('keydown', escHandler);
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
          item.createEl('span', { cls: c('time-picker-check'), prepend: true }, (span) => {
            setIcon(span, 'lucide-check');
          });

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

    div.win.setTimeout(() => {
      const height = div.clientHeight;
      const width = div.clientWidth;

      if (coordinates.y + height > win.innerHeight) {
        div.style.top = `${(coordinates.y || 0) - height}px`;
      }

      if (coordinates.x + width > win.innerWidth) {
        div.style.left = `${(coordinates.x || 0) - width}px`;
      }

      (selectedItem || middleItem)?.scrollIntoView({
        block: 'center',
        inline: 'nearest',
      });

      div.addEventListener('click', clickHandler);
      win.document.body.addEventListener('click', clickOutsideHandler);
      win.document.addEventListener('keydown', escHandler);
    });
  });
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
  const timeRegEx = new RegExp(`(^|\\s)${escapeRegExpStr(timeTrigger as string)}{([^}]+)}`);

  return (time: string) => {
    let titleRaw = item.data.titleRaw;

    if (hasTime) {
      titleRaw = item.data.titleRaw.replace(timeRegEx, `$1${timeTrigger}{${time}}`);
    } else {
      titleRaw = `${item.data.titleRaw} ${timeTrigger}{${time}}`;
    }

    boardModifiers.updateItem(path, stateManager.updateItemContent(item, titleRaw));
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

  if (item.data.checked && item.data.checkChar === getTaskStatusDone()) {
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
  return stateManager.app.fileManager.generateMarkdownLink(file, sourcePath, subpath);
}

export function getMarkdown(html: string) {
  return htmlToMarkdown(html);
}

export function fixLinks(text: string) {
  // Internal links from e.g. dataview plugin incorrectly begin with `app://obsidian.md/`, and
  // we also want to remove bullet points and task markers from text and markdown
  return text.replace(/^\[(.*)\]\(app:\/\/obsidian.md\/(.*)\)$/, '[$1]($2)');
}

interface FileData {
  buffer: ArrayBuffer;
  mimeType: string;
  originalName: string;
}

export function getFileListFromClipboard(win: Window & typeof globalThis) {
  const clipboard = win.require('electron').remote.clipboard;

  if (process.platform === 'darwin') {
    // https://github.com/electron/electron/issues/9035#issuecomment-359554116
    if (clipboard.has('NSFilenamesPboardType')) {
      return (
        (clipboard.read('NSFilenamesPboardType') as string)
          .match(/<string>.*<\/string>/g)
          ?.map((item) => item.replace(/<string>|<\/string>/g, '')) || []
      );
    } else {
      const clipboardImage = clipboard.readImage('clipboard');
      if (!clipboardImage.isEmpty()) {
        const png = clipboardImage.toPNG();
        const fileInfo: FileData = {
          buffer: png,
          mimeType: 'image/png',
          originalName: `Pasted image ${moment().format('YYYYMMDDHHmmss')}.png`,
        };
        return [fileInfo];
      } else {
        return [(clipboard.read('public.file-url') as string).replace('file://', '')].filter(
          (item) => item
        );
      }
    }
  } else {
    // https://github.com/electron/electron/issues/9035#issuecomment-536135202
    // https://docs.microsoft.com/en-us/windows/win32/shell/clipboard#cf_hdrop
    // https://www.codeproject.com/Reference/1091137/Windows-Clipboard-Formats
    if (clipboard.has('CF_HDROP')) {
      const rawFilePathStr = clipboard.read('CF_HDROP') || '';
      let formatFilePathStr = [...rawFilePathStr]
        .filter((_, index) => rawFilePathStr.charCodeAt(index) !== 0)
        .join('')
        .replace(/\\/g, '\\');

      const drivePrefix = formatFilePathStr.match(/[a-zA-Z]:\\/);

      if (drivePrefix) {
        const drivePrefixIndex = formatFilePathStr.indexOf(drivePrefix[0]);
        if (drivePrefixIndex !== 0) {
          formatFilePathStr = formatFilePathStr.slice(drivePrefixIndex);
        }
        return formatFilePathStr
          .split(drivePrefix[0])
          .filter((item) => item)
          .map((item) => drivePrefix + item);
      }
    } else {
      const clipboardImage = clipboard.readImage('clipboard');
      if (!clipboardImage.isEmpty()) {
        const png = clipboardImage.toPNG();
        const fileInfo: FileData = {
          buffer: png,
          mimeType: 'image/png',
          originalName: `Pasted image ${moment().format('YYYYMMDDHHmmss')}.png`,
        };
        return [fileInfo];
      } else {
        return [
          (clipboard.readBuffer('FileNameW').toString('ucs2') as string).replace(
            RegExp(String.fromCharCode(0), 'g'),
            ''
          ),
        ].filter((item) => item);
      }
    }
  }

  return null;
}

function getFileFromPath(file: string) {
  return file.split('\\').pop().split('/').pop();
}

async function linkFromBuffer(
  stateManager: StateManager,
  fileName: string,
  ext: string,
  buffer: ArrayBuffer
) {
  const path = (await (stateManager.app.vault as any).getAvailablePathForAttachments(
    fileName,
    ext,
    stateManager.file
  )) as string;

  const newFile = await stateManager.app.vault.createBinary(path, buffer);

  return linkTo(stateManager, newFile, stateManager.file.path);
}

async function handleElectronPaste(stateManager: StateManager, win: Window & typeof globalThis) {
  const list = getFileListFromClipboard(win);

  if (!list || list.length === 0) return null;

  const fs = win.require('fs/promises');
  const nPath = win.require('path');

  return (
    await Promise.all(
      list.map(async (file) => {
        if (typeof file === 'string') {
          const fileStr = getFileFromPath(file);

          const splitFile = fileStr.split('.');
          const ext = splitFile.pop();
          const fileName = splitFile.join('.');

          const path = (await (stateManager.app.vault as any).getAvailablePathForAttachments(
            fileName,
            ext,
            stateManager.file
          )) as string;

          const basePath = (stateManager.app.vault.adapter as any).basePath;

          await fs.copyFile(file, nPath.join(basePath, path));

          // Wait for Obsidian to update
          await new Promise((resolve) => win.setTimeout(resolve, 50));

          const newFile = stateManager.app.vault.getAbstractFileByPath(path) as TFile;

          return linkTo(stateManager, newFile, stateManager.file.path);
        } else {
          const splitFile = file.originalName.split('.');
          const ext = splitFile.pop();
          const fileName = splitFile.join('.');

          return await linkFromBuffer(stateManager, fileName, ext, file.buffer);
        }
      })
    )
  ).filter((file) => file);
}

function handleFiles(stateManager: StateManager, files: FileWithPath[], isPaste?: boolean) {
  return Promise.all(
    files.map((file) => {
      const splitFileName = file.name.split('.');

      let ext = splitFileName.pop();
      let fileName = splitFileName.join('.');

      if (isPaste) {
        switch (file.type) {
          case 'text/jpg':
            ext = 'jpg';
            break;
          case 'text/jpeg':
            ext = 'jpeg';
            break;
          case 'text/png':
            ext = 'png';
            break;
        }

        fileName = 'Pasted image ' + moment().format('YYYYMMDDHHmmss');
      }

      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const path = (await (stateManager.app.vault as any).getAvailablePathForAttachments(
              fileName,
              ext,
              stateManager.file
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
  e: DragEvent | ClipboardEvent,
  win: Window & typeof globalThis
) {
  const isClipboardEvent = (e as DragEvent).view ? false : true;
  const forcePlaintext = isClipboardEvent ? stateManager.getAView().isShiftPressed : false;
  const transfer = isClipboardEvent
    ? (e as ClipboardEvent).clipboardData
    : (e as DragEvent).dataTransfer;
  const clipboard =
    isClipboardEvent && Platform.isDesktopApp ? win.require('electron').remote.clipboard : null;
  const formats = clipboard ? clipboard.availableFormats() : [];

  if (!isClipboardEvent) {
    const files = await fromEvent(e);
    if (files.length) {
      return await handleFiles(stateManager, files as FileWithPath[]);
    }
  } else if (isClipboardEvent && !forcePlaintext && !formats.includes('text/rtf')) {
    if (Platform.isDesktopApp) {
      const links = await handleElectronPaste(stateManager, win);

      if (links?.length) {
        return links;
      }
    }

    const files: File[] = [];
    const items = (e as ClipboardEvent).clipboardData.items;

    for (const index in items) {
      const item = items[index];
      if (item.kind === 'file') {
        files.push(item.getAsFile());
      }
    }

    if (files.length) {
      return await handleFiles(stateManager, files, true);
    }
  }

  const html = transfer.getData('text/html');
  const plain = transfer.getData('text/plain');
  const uris = transfer.getData('text/uri-list');

  const text = forcePlaintext ? plain || html : getMarkdown(html);

  return [fixLinks(text || uris || plain || html || '').trim()];
}

export async function handleDragOrPaste(
  stateManager: StateManager,
  e: DragEvent | ClipboardEvent,
  win: Window & typeof globalThis
): Promise<string[]> {
  const draggable = (stateManager.app as any).dragManager.draggable;
  const transfer = (e as DragEvent).view
    ? (e as DragEvent).dataTransfer
    : (e as ClipboardEvent).clipboardData;

  switch (draggable?.type) {
    case 'file':
      return [linkTo(stateManager, draggable.file, stateManager.file.path)];
    case 'files':
      return draggable.files.map((f: TFile) => linkTo(stateManager, f, stateManager.file.path));
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
        ? linkTo(stateManager, draggable.file, parseLinktext(draggable.linktext).subpath)
        : `[[${draggable.linktext}]]`;
      const alias = new DOMParser().parseFromString(transfer.getData('text/html'), 'text/html')
        .documentElement.textContent; // Get raw text
      link = link.replace(/]]$/, `|${alias}]]`).replace(/^\[[^\]].+]\(/, `[${alias}](`);
      return [link];
    }
    default: {
      return await handleNullDraggable(stateManager, e, win);
    }
  }
}

/**
 * Synchronously retrieves Full Calendar plugin configuration data
 * Supports both direct plugin access and file-based fallback for robustness
 * 
 * @param stateManager - StateManager instance for accessing Obsidian app
 * @returns Array of CalendarSource objects from Full Calendar plugin configuration
 */
export function getFullCalendarDataSync(stateManager: StateManager): CalendarSource[] {
  try {
    console.log('Looking for Full Calendar data synchronously...');
    
    // Try direct access via Obsidian's plugin system first
    if ((stateManager.app as any).plugins?.plugins?.['obsidian-full-calendar']) {
      const fullCalendarPlugin = (stateManager.app as any).plugins.plugins['obsidian-full-calendar'];
      console.log('Found Full Calendar plugin:', fullCalendarPlugin);
      
      if (fullCalendarPlugin.settings?.calendarSources) {
        console.log('Found calendar sources from plugin settings:', fullCalendarPlugin.settings.calendarSources);
        return fullCalendarPlugin.settings.calendarSources;
      }
    }
    
    // Try reading the file directly via Node.js (desktop only)
    if (Platform.isDesktopApp && (window as any).require) {
      try {
        const fs = (window as any).require('fs');
        const path = (window as any).require('path');
        
        const vaultPath = (stateManager.app.vault.adapter as any).path || 
                         (stateManager.app.vault.adapter as any).basePath;
        const fullCalendarDataPath = path.join(vaultPath, '.obsidian', 'plugins', 'obsidian-full-calendar', 'data.json');
        
        console.log('Trying file path:', fullCalendarDataPath);
        
        if (fs.existsSync(fullCalendarDataPath)) {
          const content = fs.readFileSync(fullCalendarDataPath, 'utf8');
          const data = JSON.parse(content);
          console.log('Found Full Calendar data from file:', data);
          return data.calendarSources || [];
        } else {
          console.log('File does not exist at:', fullCalendarDataPath);
        }
      } catch (fsError) {
        console.log('Direct file access failed:', fsError);
      }
    }
    
    console.log('No calendar sources found');
    return [];
    
  } catch (error) {
    console.error('Error reading Full Calendar data:', error);
    return [];
  }
}

/**
 * Asynchronously retrieves Full Calendar plugin configuration data
 * Identical to getFullCalendarDataSync but returns a Promise for async contexts
 * 
 * @param stateManager - StateManager instance for accessing Obsidian app
 * @returns Promise resolving to array of CalendarSource objects
 */
export async function getFullCalendarData(stateManager: StateManager): Promise<CalendarSource[]> {
  try {
    console.log('Looking for Full Calendar data...');
    
    // Try direct access via Obsidian's plugin system
    if ((stateManager.app as any).plugins?.plugins?.['obsidian-full-calendar']) {
      const fullCalendarPlugin = (stateManager.app as any).plugins.plugins['obsidian-full-calendar'];
      console.log('Found Full Calendar plugin:', fullCalendarPlugin);
      
      if (fullCalendarPlugin.settings?.calendarSources) {
        console.log('Found calendar sources from plugin settings:', fullCalendarPlugin.settings.calendarSources);
        return fullCalendarPlugin.settings.calendarSources;
      }
    }
    
    // Try reading the file directly via Node.js (desktop only)
    if (Platform.isDesktopApp && (window as any).require) {
      try {
        const fs = (window as any).require('fs');
        const path = (window as any).require('path');
        
        const vaultPath = (stateManager.app.vault.adapter as any).path || 
                         (stateManager.app.vault.adapter as any).basePath;
        const fullCalendarDataPath = path.join(vaultPath, '.obsidian', 'plugins', 'obsidian-full-calendar', 'data.json');
        
        console.log('Trying file path:', fullCalendarDataPath);
        
        if (fs.existsSync(fullCalendarDataPath)) {
          const content = fs.readFileSync(fullCalendarDataPath, 'utf8');
          const data = JSON.parse(content);
          console.log('Found Full Calendar data from file:', data);
          return data.calendarSources || [];
        } else {
          console.log('File does not exist at:', fullCalendarDataPath);
        }
      } catch (fsError) {
        console.log('Direct file access failed:', fsError);
      }
    }
    
    // Fallback: hardcoded test data (remove this once it works)
    console.log('Using fallback test data');
    return [
      { type: 'local', color: '#ff0000', directory: 'Test Calendar 1' },
      { type: 'local', color: '#00ff00', directory: 'Test Calendar 2' }
    ];
    
  } catch (error) {
    console.error('Error reading Full Calendar data:', error);
    return [];
  }
}

/**
 * Extracts a user-friendly display name from a calendar directory path
 * Handles special characters and wildcard patterns appropriately
 * 
 * @param directory - Full directory path from calendar configuration
 * @returns User-friendly display name for the calendar picker UI
 */
export function getCalendarDisplayName(directory: string): string {
  // Extract the leaf directory name from the path
  const parts = directory.split('/');
  const leafName = parts[parts.length - 1];
  
  // Handle special cases and wildcards
  if (leafName === '*' || leafName === '#' || leafName === '!' || 
      leafName === '%' || leafName === '=' || leafName === '$') {
    return leafName;
  }
  
  return leafName || directory;
}

function sanitizeFileName(name: string, maxLength: number = 30): string {
  // Remove illegal file name characters and limit length
  const illegalCharsRegEx = /[\\/:"*?<>|]+/g;
  const embedRegEx = /!?\[\[([^\]]*)\.[^\]]+\]\]/g;
  const wikilinkRegEx = /!?\[\[([^\]]*)\]\]/g;
  const mdLinkRegEx = /!?\[([^\]]*)\]\([^)]*\)/g;
  const tagRegEx = /#([^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~[\]\\\s\n\r]+)/g;
  const condenceWhiteSpaceRE = /\s+/g;

  return name
    .replace(embedRegEx, '$1')
    .replace(wikilinkRegEx, '$1')
    .replace(mdLinkRegEx, '$1')
    .replace(tagRegEx, '$1')
    .replace(illegalCharsRegEx, ' ')
    .trim()
    .replace(condenceWhiteSpaceRE, ' ')
    .substring(0, maxLength)
    .trim();
}

export function constructCalendarPicker(
  win: Window,
  stateManager: StateManager,
  coordinates: { x: number; y: number },
  onSelect: (calendar: CalendarSource) => void,
  item: Item
) {
  const pickerClassName = c('calendar-picker');

  win.document.body.createDiv({ cls: `${pickerClassName} ${c('ignore-click-outside')}` }, async (div) => {
    const calendars = await getFullCalendarData(stateManager);

    if (calendars.length === 0) {
      div.createDiv({ cls: c('calendar-picker-empty'), text: 'No calendars found in Full Calendar plugin' });
    }

    const clickHandler = (e: MouseEvent) => {
      if (
        e.target instanceof (e.view as Window & typeof globalThis).HTMLElement &&
        e.target.hasClass(c('calendar-picker-item'))
      ) {
        const calendarIndex = parseInt(e.target.dataset.calendarIndex || '0', 10);
        if (calendars[calendarIndex]) {
          onSelect(calendars[calendarIndex]);
          selfDestruct();
        }
      }
    };

    const clickOutsideHandler = (e: MouseEvent) => {
      if (
        e.target instanceof (e.view as Window & typeof globalThis).HTMLElement &&
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
      win.document.body.removeEventListener('click', clickOutsideHandler);
      win.document.removeEventListener('keydown', escHandler);
    };

    div.style.left = `${coordinates.x || 0}px`;
    div.style.top = `${coordinates.y || 0}px`;

    calendars.forEach((calendar, index) => {
      div.createDiv(
        {
          cls: c('calendar-picker-item'),
        },
        (item) => {
          // Add color circle
          item.createEl('span', { cls: c('calendar-color-circle') }, (circle) => {
            circle.style.backgroundColor = calendar.color;
          });
          
          // Add calendar name
          item.createEl('span', { 
            cls: c('calendar-name'), 
            text: getCalendarDisplayName(calendar.directory) 
          });

          item.dataset.calendarIndex = index.toString();
        }
      );
    });

    div.win.setTimeout(() => {
      const height = div.clientHeight;
      const width = div.clientWidth;

      if (coordinates.y + height > win.innerHeight) {
        div.style.top = `${(coordinates.y || 0) - height}px`;
      }

      if (coordinates.x + width > win.innerWidth) {
        div.style.left = `${(coordinates.x || 0) - width}px`;
      }

      div.addEventListener('click', clickHandler);
      win.document.body.addEventListener('click', clickOutsideHandler);
      win.document.addEventListener('keydown', escHandler);
    });
  });
}

/**
 * Creates a calendar event file from a Kanban card
 * 
 * Integrates with Full Calendar plugin's "Full note" mode by creating markdown files
 * with appropriate frontmatter. Events are created as all-day events on the current
 * date and can be easily moved to specific times within Full Calendar.
 * 
 * Handles edge cases including:
 * - Directories with special characters (like '*')
 * - Wildcard patterns vs literal directory names
 * - File name sanitization and collision detection
 * - Robust error handling with user-friendly notifications
 * 
 * @param stateManager - StateManager instance for vault operations
 * @param item - Kanban card item to copy to calendar
 * @param calendar - Target calendar source configuration
 * @returns Promise<boolean> - true if event was created successfully, false otherwise
 */
export async function createCalendarEvent(
  stateManager: StateManager,
  item: Item,
  calendar: CalendarSource
): Promise<boolean> {
  try {
    const cardTitle = item.data.titleRaw.split('\n')[0].trim();
    const sanitizedTitle = sanitizeFileName(cardTitle);
    const today = moment().format('YYYY-MM-DD');
    const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
    
    const fileName = `${today} ${sanitizedTitle}.md`;
    const fileContent = `---
title: ${sanitizedTitle}
allDay: true
date: ${today}
endDate: ${tomorrow}
completed: null
---
`;

    // Get the target directory from the calendar configuration
    let targetDirectory = calendar.directory;
    
    // Handle wildcard directories vs literal directories containing '*'
    // This addresses the edge case where directories are literally named with '*' characters
    // versus using '/*' as a wildcard pattern in Full Calendar configuration
    if (targetDirectory.endsWith('/*')) {
      // Check if a directory with the literal name (including /*) exists first
      const literalDirectory = stateManager.app.vault.getAbstractFileByPath(targetDirectory);
      if (!literalDirectory) {
        // If literal directory doesn't exist, treat /* as wildcard and remove it
        // This supports the standard Full Calendar wildcard pattern usage
        targetDirectory = targetDirectory.slice(0, -2);
      }
      // If literal directory exists, keep the full path including /*
      // This supports edge cases where directories are literally named with '*'
    }
    
    // Normalize the directory path to handle special characters properly
    // This handles cases where the directory name contains special chars like '*'
    targetDirectory = targetDirectory.replace(/[\\\/]+/g, '/').replace(/^\/+|\/+$/g, '');
    
    // Ensure the directory exists using proper path handling
    let targetFolder = null;
    try {
      targetFolder = stateManager.app.vault.getAbstractFileByPath(targetDirectory);
    } catch (error) {
      console.log('Error getting folder, will attempt to create:', error);
    }
    
    if (!targetFolder) {
      try {
        await stateManager.app.vault.createFolder(targetDirectory);
      } catch (folderError) {
        console.error('Error creating folder:', folderError);
        // If folder creation fails, try to normalize the path further
        const normalizedPath = targetDirectory.replace(/[*?"<>|:]/g, '_');
        console.log(`Attempting to create normalized folder: ${normalizedPath}`);
        try {
          await stateManager.app.vault.createFolder(normalizedPath);
          targetDirectory = normalizedPath;
        } catch (normalizedError) {
          throw new Error(`Could not create calendar directory: ${targetDirectory}. ${normalizedError.message}`);
        }
      }
    }
    
    const fullPath = `${targetDirectory}/${fileName}`;
    
    // Check if file already exists
    let existingFile = null;
    try {
      existingFile = stateManager.app.vault.getAbstractFileByPath(fullPath);
    } catch (error) {
      console.log('Error checking existing file, proceeding with creation:', error);
    }
    
    if (existingFile) {
      // Show notification that file already exists
      new Notice(`File already exists: ${fileName}`);
      return false;
    }
    
    // Create the file
    try {
      await stateManager.app.vault.create(fullPath, fileContent);
      new Notice(`Created calendar event: ${fileName}`);
      
      // Apply calendar color to the card
      await applyCalendarColorToCard(stateManager, item, calendar);
      
      return true;
    } catch (fileError) {
      console.error('Error creating file:', fileError);
      throw new Error(`Could not create calendar file: ${fileName}. ${fileError.message}`);
    }
    
  } catch (error) {
    console.error('Error creating calendar event:', error);
    new Notice(`Error creating calendar event: ${error.message}`);
    return false;
  }
}

/**
 * Applies the calendar's color to a card by storing the color mapping in board settings
 */
async function applyCalendarColorToCard(
  stateManager: StateManager,
  item: Item,
  calendar: CalendarSource
) {
  try {
    const currentCardColors = stateManager.getSetting('card-colors') || [];
    const calendarDisplayName = getCalendarDisplayName(calendar.directory);
    
    // Calculate appropriate text color for contrast
    const textColor = getContrastTextColor(calendar.color);
    
    // Create new card color entry
    const newCardColor = {
      cardId: item.id,
      backgroundColor: calendar.color,
      color: textColor,
      calendarName: calendarDisplayName,
    };
    
    // Remove existing color for this card (if any) and add the new one
    const updatedCardColors = currentCardColors.filter(cc => cc.cardId !== item.id);
    updatedCardColors.push(newCardColor);
    
    // Update the board settings with the new card color
    const updatedBoard = update(stateManager.state, {
      data: {
        settings: {
          'card-colors': {
            $set: updatedCardColors,
          },
        },
      },
    });
    
    // Apply the updated board state
    stateManager.setState(() => updatedBoard);
    
    console.log(`Applied calendar color ${calendar.color} to card ${item.id} (${calendarDisplayName})`);
    
  } catch (error) {
    console.error('Error applying calendar color to card:', error);
    // Don't throw here - the calendar event was created successfully
  }
}
