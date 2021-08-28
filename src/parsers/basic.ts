import { diffLines } from 'diff';
import update from 'immutability-helper';
import yaml from 'js-yaml';
import { App, TFile, moment } from 'obsidian';

import {
  escapeRegExpStr,
  generateInstanceId,
  getDefaultDateFormat,
  getDefaultTimeFormat,
} from '../components/helpers';
import {
  Board,
  BoardTemplate,
  FileMetadata,
  Item,
  ItemTemplate,
  Lane,
  LaneTemplate,
} from '../components/types';
import { t } from '../lang/helpers';
import { defaultDateTrigger, defaultTimeTrigger } from '../settingHelpers';
import { KanbanSettings, SettingRetrievers } from '../Settings';
import { ParserSettings } from './common';

const newLineRegex = /[\r\n]+/g;

// Begins with one or more # followed by a space
const laneRegex = /^#+\s+(.*)$/;

const itemRegex = new RegExp(
  [
    /^\s*/, // leading whitespace
    /[-+*]\s+?/, // bullet and its whitespace (at least one space required)
    /(?:\[([^\]])\]\s+)?/, // task marker and whitespace (group 1)
    /(.*)$/, // Text (group 2)
  ]
    .map((r) => r.source)
    .join('')
);

const completeString = `**${t('Complete')}**`;
const completeRegex = new RegExp(`^${escapeRegExpStr(completeString)}$`, 'i');
const archiveString = '***';
const archiveMarkerRegex = /^\*\*\*$/;
const tagRegex = /(^|\s)(#[^#\s]+)/g;
const linkRegex = /\[\[([^|\]]+)(?:\||\]\])/;

function getSearchTitle(
  dom: HTMLDivElement,
  tags?: string[],
  fileMetadata?: FileMetadata
) {
  let searchTitle = dom.innerText.trim();

  if (tags?.length) {
    searchTitle += ' ' + tags.join(' ');
  }

  if (fileMetadata) {
    const keys = Object.keys(fileMetadata).join(' ');
    const values = Object.values(fileMetadata)
      .map((v) => {
        if (Array.isArray(v.value)) {
          return v.value.join(' ');
        }

        return v.value.toString();
      })
      .join(' ');

    searchTitle += ' ' + keys + ' ' + values;
  }

  return searchTitle.toLocaleLowerCase();
}

function itemToMd(item: Item) {
  return `- [${item.data.isComplete ? 'x' : ' '}] ${item.data.titleRaw.replace(
    /(\r\n|\n)/g,
    '<br>'
  )}`;
}

function extractItemTags(title: string, settings: ParserSettings) {
  const tags: string[] = [];

  let processedTitle = title;
  let match = tagRegex.exec(title);

  while (match != null) {
    tags.push(match[2]);
    match = tagRegex.exec(title);
  }

  if (settings.shouldHideTags) {
    processedTitle = processedTitle.replace(tagRegex, '$1');
  }

  return {
    processedTitle,
    tags,
  };
}

function extractDates(title: string, settings: ParserSettings) {
  let date: undefined | moment.Moment = undefined;
  let time: undefined | moment.Moment = undefined;
  let processedTitle = title;

  const dateMatch = settings.dateRegEx.exec(title);
  const timeMatch = settings.timeRegEx.exec(title);

  if (dateMatch) {
    date = moment(dateMatch[1], settings.dateFormat as string);
  }

  if (timeMatch) {
    time = moment(timeMatch[1], settings.timeFormat as string);

    if (date) {
      date.hour(time.hour());
      date.minute(time.minute());

      time = date.clone();
    }
  }

  if (settings.shouldHideDate) {
    processedTitle = processedTitle
      .replace(settings.dateRegEx, '')
      .replace(settings.timeRegEx, '');
  }

  return {
    date,
    time,
    processedTitle,
  };
}

function extractFirstLinkedFile(
  app: App,
  settings: ParserSettings,
  sourceFile: TFile,
  title: string
) {
  if (!settings.metaKeys.length) {
    return null;
  }

  const match = title.match(linkRegex);

  if (!match) {
    return null;
  }

  const path = match[1];
  const file = app.metadataCache.getFirstLinkpathDest(path, sourceFile.path);

  if (!file) {
    return null;
  }

  return file;
}

function getDataViewCache(app: App, linkedFile: TFile, sourceFile: TFile) {
  if (
    (app as any).plugins.enabledPlugins.has('dataview') &&
    (app as any).plugins?.plugins?.dataview?.api
  ) {
    return (app as any).plugins.plugins.dataview.api.page(
      linkedFile.path,
      sourceFile.path
    );
  }
}

function getLinkedPageMetadata(
  linkedFile: TFile | null | undefined,
  sourceFile: TFile,
  settings: ParserSettings,
  app: App
): FileMetadata | undefined {
  if (!settings.metaKeys.length) {
    return;
  }

  if (!linkedFile) {
    return;
  }

  const cache = app.metadataCache.getFileCache(linkedFile);
  const dataviewCache = getDataViewCache(app, linkedFile, sourceFile);

  if (!cache && !dataviewCache) {
    return;
  }

  const metadata: FileMetadata = {};
  const seenTags: { [k: string]: boolean } = {};
  const seenKey: { [k: string]: boolean } = {};

  let haveData = false;

  settings.metaKeys.forEach((k) => {
    if (seenKey[k.metadataKey]) return;

    seenKey[k.metadataKey] = true;

    if (k.metadataKey === 'tags') {
      let tags = cache?.tags || [];

      if (cache?.frontmatter?.tags) {
        tags = [].concat(
          tags,
          cache.frontmatter.tags.map((tag: string) => ({ tag: `#${tag}` }))
        );
      }

      if (tags?.length === 0) return;

      metadata.tags = {
        ...k,
        value: tags
          .map((t) => t.tag)
          .filter((t) => {
            if (seenTags[t]) {
              return false;
            }

            seenTags[t] = true;
            return true;
          }),
      };

      haveData = true;
      return;
    }

    if (cache?.frontmatter && cache.frontmatter[k.metadataKey]) {
      metadata[k.metadataKey] = {
        ...k,
        value: cache.frontmatter[k.metadataKey],
      };
      haveData = true;
    } else if (dataviewCache && dataviewCache[k.metadataKey]) {
      metadata[k.metadataKey] = {
        ...k,
        value: dataviewCache[k.metadataKey],
      };
      haveData = true;
    }
  });

  return haveData ? metadata : undefined;
}

function laneToMd(lane: Lane) {
  const lines: string[] = [];

  lines.push(`## ${lane.data.title}`);

  lines.push('');

  if (lane.data.shouldMarkItemsComplete) {
    lines.push(completeString);
  }

  lane.children.forEach((item) => {
    lines.push(itemToMd(item));
  });

  lines.push('');
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

function archiveToMd(archive: Item[]) {
  if (archive.length) {
    const lines: string[] = [archiveString, '', `## ${t('Archive')}`, ''];

    archive.forEach((item) => {
      lines.push(itemToMd(item));
    });

    return lines.join('\n');
  }

  return '';
}

function settingsToFrontmatter(settings: KanbanSettings): string {
  return ['---', '', yaml.dump(settings), '---', '', ''].join('\n');
}

export class KanbanParser {
  settings: ParserSettings;
  previousFrontMatter: string;
  previousBody: string;
  previousSettings: KanbanSettings;
  previousGlobalSettings: KanbanSettings;
  previousItems: Map<string, Item[]> = new Map();
  previousLanes: Map<string, Lane> = new Map();
  fileCache: Map<TFile, FileMetadata> = new Map();

  app: App;
  sourceFile: TFile;
  renderMarkdown: (md: string) => HTMLDivElement;
  settingRetrievers: SettingRetrievers;

  // we use a string instead of a file, because a file changing path could change the meaning of links
  PreviousParsedPath: string;

  constructor(
    app: App,
    sourceFile: TFile,
    renderMarkdown: (md: string) => HTMLDivElement,
    settingRetrievers: SettingRetrievers
  ) {
    this.app = app;
    this.sourceFile = sourceFile;
    this.renderMarkdown = renderMarkdown;
    this.settingRetrievers = settingRetrievers;
  }

  newItem(titleRaw: string): Item {
    const processed = this.processTitle(titleRaw);

    return {
      ...ItemTemplate,
      id: generateInstanceId(),
      data: {
        title: processed.title,
        titleRaw: titleRaw,
        titleSearch: processed.titleSearch,
        metadata: processed.metadata,
        dom: processed.dom,
      },
    };
  }

  updateItem(item: Item, titleRaw: string) {
    const processed = this.processTitle(titleRaw);

    return update(item, {
      data: {
        title: { $set: processed.title },
        titleRaw: { $set: titleRaw },
        titleSearch: { $set: processed.titleSearch },
        metadata: { $set: processed.metadata },
        dom: { $set: processed.dom },
      },
    });
  }

  boardToMd(board: Board) {
    const lanes = board.children.reduce((md, lane) => {
      return md + laneToMd(lane);
    }, '');

    return (
      settingsToFrontmatter(board.data.settings) +
      lanes +
      archiveToMd(board.data.archive)
    );
  }

  private processTitle(title: string) {
    const date = extractDates(title, this.settings);
    const tags = extractItemTags(date.processedTitle, this.settings);
    const file = extractFirstLinkedFile(
      this.app,
      this.settings,
      this.sourceFile,
      tags.processedTitle
    );

    let fileMetadata: FileMetadata;

    if (file) {
      fileMetadata = this.fileCache.has(file)
        ? this.fileCache.get(file)
        : getLinkedPageMetadata(file, this.sourceFile, this.settings, this.app);

      this.fileCache.set(file, fileMetadata);
    }

    const dom = this.renderMarkdown(tags.processedTitle);

    return {
      title: tags.processedTitle.trim(),
      titleSearch: getSearchTitle(dom, tags.tags, fileMetadata),
      metadata: {
        date: date.date,
        time: date.time,
        tags: tags.tags,
        file,
        fileMetadata,
      },
      dom,
    };
  }

  invalidateFile(file: TFile) {
    if (this.fileCache.has(file)) {
      this.fileCache.delete(file);
      return true;
    }
  }

  diffBody(body: string) {
    const diff = diffLines(this.previousBody, body, { newlineIsToken: true });

    if (diff.length === 4) {
      const [, oldLine, newLine] = diff;
      if (
        oldLine.removed &&
        oldLine.count === 1 &&
        newLine.added &&
        newLine.count === 1
      ) {
        // We found a one-line change of text only -- see if it was and still is an item
        const oldItem = this.previousItems.get(oldLine.value)?.shift();
        const itemMatch = newLine.value.match(itemRegex);
        if (itemMatch && oldItem) {
          // Generaate a new item, but with the old ID
          const [, marker, title] = itemMatch;
          const titleRaw = title.replace(/<br(\s+\/)?>/g, '\n');
          const processed = this.processTitle(titleRaw);
          const line = newLine.value;
          const item: Item = {
            ...ItemTemplate,
            id: oldItem.id,
            data: {
              title: processed.title,
              titleSearch: processed.titleSearch,
              titleRaw,
              isComplete: marker && marker !== ' ',
              metadata: processed.metadata,
              dom: processed.dom,
            },
          };
          // Save it in the cache for reuse, and update whatever (cached) lane it's in
          // (Theoretically we could just issue an update to the baord itself here, and skip
          // the parsing altogether.  For now, just update the lane cache, as that's still
          // pretty darn fast.)
          this.previousItems.has(line)
            ? this.previousItems.get(line).push(item)
            : this.previousItems.set(line, [item]);

          for (const [key, lane] of this.previousLanes.entries()) {
            const pos = lane.children.indexOf(oldItem);
            if (pos >= 0) {
              this.previousLanes.set(
                key,
                update(lane, { children: { $splice: [[pos, 1, item]] } })
              );
            }
          }
        }
      }
    }
  }

  parseSettings(suppliedSettings: KanbanSettings) {
    this.previousItems.clear(); // Settings changed, must re-parse items
    this.fileCache.clear(); // including metadata, since the keys might be different
    this.previousLanes.clear();
    this.previousBody = null;

    const globalKeys =
      this.settingRetrievers.getGlobalSetting('metadata-keys') || [];
    const localKeys =
      this.settingRetrievers.getSetting('metadata-keys', suppliedSettings) ||
      [];

    const dateTrigger =
      this.settingRetrievers.getSetting('date-trigger', suppliedSettings) ||
      defaultDateTrigger;
    const timeTrigger =
      this.settingRetrievers.getSetting('time-trigger', suppliedSettings) ||
      defaultTimeTrigger;
    const shouldLinkDate = this.settingRetrievers.getSetting(
      'link-date-to-daily-note',
      suppliedSettings
    );
    const contentMatch = shouldLinkDate ? '\\[\\[([^}]+)\\]\\]' : '{([^}]+)}';

    this.settings = {
      dateFormat:
        this.settingRetrievers.getSetting('date-format', suppliedSettings) ||
        getDefaultDateFormat(this.app),
      timeFormat:
        this.settingRetrievers.getSetting('time-format', suppliedSettings) ||
        getDefaultTimeFormat(this.app),
      dateTrigger,
      timeTrigger,
      shouldLinkDate,
      shouldHideDate: this.settingRetrievers.getSetting(
        'hide-date-in-title',
        suppliedSettings
      ),
      shouldHideTags: this.settingRetrievers.getSetting(
        'hide-tags-in-title',
        suppliedSettings
      ),
      metaKeys: [...globalKeys, ...localKeys],
      dateRegEx: new RegExp(
        `(?:^|\\s)${escapeRegExpStr(dateTrigger)}${contentMatch}`
      ),
      timeRegEx: new RegExp(
        `(?:^|\\s)${escapeRegExpStr(timeTrigger as string)}{([^}]+)}`
      ),
    };
  }

  refreshBoard(board: Board): Board {
    this.parseSettings(board.data.settings);

    return update(board, {
      children: {
        $set: board.children.map((lane) =>
          update(lane, {
            children: {
              $set: lane.children.map((item) =>
                this.updateItem(item, item.data.titleRaw)
              ),
            },
          })
        ),
      },
    });
  }

  shouldRefreshBoard(oldSettings: KanbanSettings, newSettings: KanbanSettings) {
    if (!oldSettings && newSettings) {
      return true;
    }

    const toCompare: Array<keyof KanbanSettings> = [
      'metadata-keys',
      'date-trigger',
      'time-trigger',
      'link-date-to-daily-note',
      'date-format',
      'time-format',
      'hide-date-in-title',
      'hide-tags-in-title',
    ];

    return !toCompare.every((k) => {
      return oldSettings[k] === newSettings[k];
    });
  }

  mdToBoard(boardMd: string, filePath: string): Board {
    /*
    Steps:

    1. Split front matter from board
    2. If it's the same as the last, reuse the local settings calc
    3. If the file path, global and local settings are all the same as before, reuse them
    4. Otherwise, recalc settings and clear the cache

    Issues:
    * Should internal link be resolved from DOM instead of regex?
    */

    const [beforeFrontMatter, frontMatter, ...bodyParts] =
      boardMd.split(/^---$/m);
    const body = bodyParts.join('---');

    if (beforeFrontMatter.trim())
      throw new Error(t('Invalid Kanban file: problems parsing frontmatter'));

    const settings =
      frontMatter === this.previousFrontMatter
        ? this.previousSettings
        : (yaml.load(frontMatter) as KanbanSettings);

    const globalSettings = this.settingRetrievers.getGlobalSettings();

    if (
      settings !== this.previousSettings ||
      globalSettings !== this.previousGlobalSettings ||
      this.PreviousParsedPath !== filePath
    ) {
      this.parseSettings(settings);
    }

    // Try to recognize single-line item edits, and try to keep the same ID
    // (So the item will be refreshed, but not re-created)
    if (this.previousBody && this.previousBody !== body) {
      this.diffBody(body);
    }

    const lines = body.split(newLineRegex);
    const lanes: Lane[] = [];
    const archive: Item[] = [];
    const thisItems: Map<string, Item[]> = new Map();
    const thisLanes: Map<string, Lane> = new Map();
    const lastLanes = this.previousLanes;

    let haveSeenArchiveMarker = false;
    let currentLane: Lane | null = null;

    const pushLane = () => {
      // Don't replace lanes and items more than necessary
      const laneKey = `${
        currentLane.data.shouldMarkItemsComplete
      } ${currentLane.children.map((item) => item.id).join(',')}`;

      const oldLane = lastLanes.get(laneKey);

      if (oldLane) {
        if (oldLane.data.title === currentLane.data.title) {
          // Title is the only thing that isn't in the key
          currentLane = oldLane;
        } else {
          // At least save the items and other props
          currentLane.children = oldLane.children;
          currentLane.data = oldLane.data;
          currentLane.id = oldLane.id;
        }
      }
      thisLanes.set(laneKey, currentLane);
      lanes.push(currentLane);
    };

    for (const line of lines) {
      const itemMatch = line.match(itemRegex);
      let item: Item;

      if (itemMatch) {
        item = this.previousItems.get(line)?.shift();

        if (!item) {
          const [, marker, title] = itemMatch;
          const titleRaw = title.replace(/<br(\s+\/)?>/g, '\n');
          const processed = this.processTitle(titleRaw);

          item = {
            ...ItemTemplate,
            id: generateInstanceId(),
            data: {
              title: processed.title,
              titleSearch: processed.titleSearch,
              titleRaw,
              isComplete: marker !== ' ',
              metadata: processed.metadata,
              dom: processed.dom,
            },
          };
        } else {
          // Using a cached item; verify its metadata and maybe fetch it again
          const file = item.data.metadata.file;

          if (file) {
            const fileMetadata = this.fileCache.has(file)
              ? this.fileCache.get(file)
              : getLinkedPageMetadata(
                  file,
                  this.sourceFile,
                  this.settings,
                  this.app
                );

            this.fileCache.set(file, fileMetadata);

            if (item.data.metadata.fileMetadata !== fileMetadata) {
              // Make a new item with updated metadata
              item = update(item, {
                data: {
                  metadata: { fileMetadata: { $set: fileMetadata } },
                },
              });
            }
          }
        }

        thisItems.has(line)
          ? thisItems.get(line).push(item)
          : thisItems.set(line, [item]);

        if (haveSeenArchiveMarker) {
          archive.push(item);
        } else {
          if (!currentLane) {
            // Auto-generate an empty column
            currentLane = {
              ...LaneTemplate,
              children: [],
              id: generateInstanceId(),
              data: {
                title: t('Untitled'),
              },
            };
          }
          currentLane.children.push(item);
        }
        continue;
      }

      // New lane
      if (!haveSeenArchiveMarker && laneRegex.test(line)) {
        if (currentLane !== null) pushLane();

        const match = line.match(laneRegex);

        currentLane = {
          ...LaneTemplate,
          children: [],
          id: generateInstanceId(),
          data: {
            title: match[1],
          },
        };

        continue;
      }

      // Archive lane title
      if (haveSeenArchiveMarker && laneRegex.test(line)) {
        continue;
      }

      if (archiveMarkerRegex.test(line)) {
        haveSeenArchiveMarker = true;
        continue;
      }

      // Check if this is a completed lane
      if (!haveSeenArchiveMarker && completeRegex.test(line)) {
        currentLane.data.shouldMarkItemsComplete = true;
        continue;
      }

      if (line.trim())
        throw new Error(
          t("I don't know how to interpret this line:") + '\n' + line
        );
    }

    // Push the last lane
    if (currentLane !== null) pushLane();

    this.previousBody = body;
    this.previousItems = thisItems;
    this.previousLanes = thisLanes;
    this.previousSettings = settings;
    this.previousGlobalSettings = globalSettings;
    this.previousFrontMatter = frontMatter;
    this.PreviousParsedPath = filePath;

    return {
      ...BoardTemplate,
      id: this.sourceFile.path,
      children: lanes,
      data: {
        settings,
        archive,
        isSearching: false,
        errors: [],
      },
    };
  }
}
