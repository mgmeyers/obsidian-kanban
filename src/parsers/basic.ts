import { diffLines } from 'diff';
import update from 'immutability-helper';
import yaml from 'js-yaml';
import { App, TFile } from 'obsidian';

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
  ItemData,
  ItemTemplate,
  Lane,
  LaneTemplate,
} from '../components/types';
import { t } from '../lang/helpers';
import { defaultDateTrigger, defaultTimeTrigger } from '../settingHelpers';
import { KanbanSettings, SettingRetrievers } from '../Settings';
import {
  ParserSettings,
  anyHeadingRegex,
  archiveMarkerRegex,
  archiveString,
  completeRegex,
  completeString,
  extractDates,
  extractFirstLinkedFile,
  extractItemTags,
  getLinkedPageMetadata,
  getSearchValue,
  newLineRegex,
  settingsToFrontmatter,
} from './common';

const listItemRegex = new RegExp(
  [
    /^\s*/, // leading whitespace
    /[-+*]\s+?/, // bullet and its whitespace (at least one space required)
    /(?:\[([^\]])\]\s+)?/, // task marker and whitespace (group 1)
    /(.*)$/, // Text (group 2)
  ]
    .map((r) => r.source)
    .join('')
);

function itemToMd(item: Item) {
  return `- [${item.data.isComplete ? 'x' : ' '}] ${item.data.titleRaw.replace(
    /(\r\n|\n)/g,
    '<br>'
  )}`;
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
  renderMarkdown: (md: string) => Promise<HTMLDivElement>;
  settingRetrievers: SettingRetrievers;

  // we use a string instead of a file, because a file changing path could change the meaning of links
  PreviousParsedPath: string;

  constructor(
    app: App,
    sourceFile: TFile,
    renderMarkdown: (md: string) => Promise<HTMLDivElement>,
    settingRetrievers: SettingRetrievers
  ) {
    this.app = app;
    this.sourceFile = sourceFile;
    this.renderMarkdown = renderMarkdown;
    this.settingRetrievers = settingRetrievers;
  }

  async newItem(titleRaw: string): Promise<Item> {
    const processed = await this.processTitle(titleRaw);

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

  async updateItem(item: Item, titleRaw: string) {
    const processed = await this.processTitle(titleRaw);

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

  private async processTitle(
    title: string,
    isComplete?: boolean
  ): Promise<ItemData> {
    const date = extractDates(title, this.settings);
    const tags = extractItemTags(date.processed, this.settings);
    const file = extractFirstLinkedFile(
      this.app,
      this.sourceFile,
      tags.processed
    );

    let fileMetadata: FileMetadata;

    if (file) {
      fileMetadata = this.fileCache.has(file)
        ? this.fileCache.get(file)
        : getLinkedPageMetadata(file, this.sourceFile, this.settings, this.app);

      this.fileCache.set(file, fileMetadata);
    }

    const dom = await this.renderMarkdown(tags.processed);

    return {
      titleRaw: title,
      title: tags.processed.trim(),
      titleSearch: getSearchValue(dom, tags.tags, fileMetadata),
      metadata: {
        date: date.date,
        time: date.time,
        tags: tags.tags,
        file,
        fileMetadata,
      },
      dom,
      isComplete,
    };
  }

  invalidateFile(file: TFile) {
    if (this.fileCache.has(file)) {
      this.fileCache.delete(file);
      return true;
    }
  }

  async diffBody(body: string) {
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
        const itemMatch = newLine.value.match(listItemRegex);
        if (itemMatch && oldItem) {
          // Generaate a new item, but with the old ID
          const [, marker, title] = itemMatch;
          const titleRaw = title.replace(/<br(\s+\/)?>/g, '\n');
          const processed = await this.processTitle(
            titleRaw,
            marker && marker !== ' '
          );
          const line = newLine.value;
          const item: Item = {
            ...ItemTemplate,
            id: oldItem.id,
            data: processed,
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

  compileParserSettings(suppliedSettings: KanbanSettings) {
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

  async refreshBoard(board: Board): Promise<Board> {
    this.compileParserSettings(board.data.settings);

    return update(board, {
      children: {
        $set: await Promise.all(
          board.children.map(async (lane) =>
            update(lane, {
              children: {
                $set: await Promise.all(
                  lane.children.map(
                    async (item) =>
                      await this.updateItem(item, item.data.titleRaw)
                  )
                ),
              },
            })
          )
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

  async mdToBoard(boardMd: string, filePath: string): Promise<Board> {
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
      this.compileParserSettings(settings);
    }

    // Try to recognize single-line item edits, and try to keep the same ID
    // (So the item will be refreshed, but not re-created)
    if (this.previousBody && this.previousBody !== body) {
      await this.diffBody(body);
    }

    const lines = body.split(newLineRegex);
    const lanes: Lane[] = [];
    const archive: Item[] = [];
    const thisItems: Map<string, Item[]> = new Map();
    const thisLanes: Map<string, Lane> = new Map();
    const lastLanes = this.previousLanes;
    const invalidatedFiles: Set<TFile> = new Set();

    let haveSeenArchiveMarker = false;
    let currentLane: Lane | null = null;

    const pushLane = (wasChildModified: boolean) => {
      // Don't replace lanes and items more than necessary
      const laneKey = `${
        currentLane.data.shouldMarkItemsComplete
      } ${currentLane.children.map((item) => item.id).join(',')}`;

      const oldLane = lastLanes.get(laneKey);

      if (oldLane) {
        currentLane.id = oldLane.id;

        if (oldLane.data.title === currentLane.data.title) {
          currentLane.data = oldLane.data;
        }

        if (!wasChildModified) {
          currentLane.children = oldLane.children;
        }
      }

      thisLanes.set(laneKey, currentLane);
      lanes.push(currentLane);
    };

    let wasExistingLaneItemModified = false;

    for (const line of lines) {
      if (!line) continue;

      const itemMatch = line.match(listItemRegex);
      let item: Item;

      if (itemMatch) {
        item = this.previousItems.get(line)?.shift();

        if (!item) {
          const [, marker, title] = itemMatch;
          const titleRaw = title.replace(/<br(\s+\/)?>/g, '\n');
          const processed = await this.processTitle(titleRaw, marker !== ' ');

          item = {
            ...ItemTemplate,
            id: generateInstanceId(),
            data: processed,
          };
        } else {
          // Using a cached item; verify its metadata and maybe fetch it again
          const file = item.data.metadata.file;

          if (file) {
            const haveFileCache = this.fileCache.has(file);
            const fileMetadata = haveFileCache
              ? this.fileCache.get(file)
              : getLinkedPageMetadata(
                  file,
                  this.sourceFile,
                  this.settings,
                  this.app
                );

            if (!haveFileCache) {
              invalidatedFiles.add(file);
            }

            this.fileCache.set(file, fileMetadata);

            const isFileInvalid = !haveFileCache || invalidatedFiles.has(file);

            if (
              item.data.metadata.fileMetadata &&
              item.data.metadata.fileMetadata !== fileMetadata
            ) {
              // Make a new item with updated metadata
              item = update(item, {
                // id: { $set: generateInstanceId() },
                data: {
                  metadata: { fileMetadata: { $set: fileMetadata } },
                },
              });
              wasExistingLaneItemModified = true;
            } else if (isFileInvalid) {
              // Make a new item to refresh embeds
              const processed = await this.processTitle(
                item.data.titleRaw,
                item.data.isComplete
              );

              item = update(item, {
                // id: { $set: generateInstanceId() },
                data: {
                  $set: processed,
                },
              });
              wasExistingLaneItemModified = true;
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
      if (!haveSeenArchiveMarker && anyHeadingRegex.test(line)) {
        if (currentLane !== null) pushLane(wasExistingLaneItemModified);
        wasExistingLaneItemModified = false;

        const match = line.match(anyHeadingRegex);

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
      if (haveSeenArchiveMarker && anyHeadingRegex.test(line)) {
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
    if (currentLane !== null) pushLane(wasExistingLaneItemModified);

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
