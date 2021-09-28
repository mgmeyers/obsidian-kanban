import yaml from 'js-yaml';
import { App, TFile, moment } from 'obsidian';

import { escapeRegExpStr } from 'src/components/helpers';
import { FileMetadata } from 'src/components/types';
import { getNormalizedPath } from 'src/helpers/renderMarkdown';
import { t } from 'src/lang/helpers';
import { KanbanSettings } from 'src/Settings';

export const frontMatterKey = 'kanban-plugin';

export type ParserSettings = {
  dateFormat: KanbanSettings['date-format'];
  timeFormat: KanbanSettings['time-format'];
  dateTrigger: KanbanSettings['date-trigger'];
  timeTrigger: KanbanSettings['time-trigger'];
  shouldLinkDate: KanbanSettings['link-date-to-daily-note'];
  shouldHideDate: KanbanSettings['hide-date-in-title'];
  shouldHideTags: KanbanSettings['hide-tags-in-title'];
  metaKeys: KanbanSettings['metadata-keys'];
  dateRegEx: RegExp;
  timeRegEx: RegExp;
};

export enum ParserFormats {
  Basic,
}

export const newLineRegex = /[\r\n]+/g;
export const anyHeadingRegex = /^#+\s+(.*)$/;
export const completeString = `**${t('Complete')}**`;
export const completeRegex = new RegExp(
  `^${escapeRegExpStr(completeString)}$`,
  'i'
);
export const archiveString = '***';
export const archiveMarkerRegex = /^\*\*\*$/;
export const tagRegex = /(^|\s)(#[^#\s]+)/g;
export const linkRegex = /(?:\[\[([^|\]]+)(?:\||\]\])|\[([^\]]+)\]\(([^)]+)\))/;

export function settingsToFrontmatter(settings: KanbanSettings): string {
  return ['---', '', yaml.dump(settings), '---', '', ''].join('\n');
}

export function getSearchValue(
  dom: HTMLDivElement,
  tags?: string[],
  fileMetadata?: FileMetadata
) {
  let searchValue = dom.innerText.trim();

  if (tags?.length) {
    searchValue += ' ' + tags.join(' ');
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

    searchValue += ' ' + keys + ' ' + values;
  }

  return searchValue.toLocaleLowerCase();
}

export function extractItemTags(content: string, settings: ParserSettings) {
  const tags: string[] = [];

  let processedContent = content;
  let match = tagRegex.exec(content);

  while (match != null) {
    tags.push(match[2]);
    match = tagRegex.exec(content);
  }

  if (settings.shouldHideTags) {
    processedContent = processedContent.replace(tagRegex, '$1');
  }

  return {
    processed: processedContent,
    tags,
  };
}

export function extractDates(content: string, settings: ParserSettings) {
  let date: undefined | moment.Moment = undefined;
  let time: undefined | moment.Moment = undefined;
  let processedContent = content;

  const dateMatch = settings.dateRegEx.exec(content);
  const timeMatch = settings.timeRegEx.exec(content);

  if (dateMatch) {
    date = moment(dateMatch[1] || dateMatch[2], settings.dateFormat as string);
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
    processedContent = processedContent
      .replace(settings.dateRegEx, '')
      .replace(settings.timeRegEx, '');
  }

  return {
    date,
    time,
    processed: processedContent,
  };
}

export function extractFirstLinkedFile(
  app: App,
  sourceFile: TFile,
  content: string
) {
  const match = content.match(linkRegex);

  if (!match) {
    return null;
  }

  const path = getNormalizedPath(
    match[2] ? decodeURIComponent(match[2]) : match[1]
  );
  const file = app.metadataCache.getFirstLinkpathDest(
    path.root,
    sourceFile.path
  );

  if (!file) {
    return null;
  }

  return file;
}

export function getDataViewCache(
  app: App,
  linkedFile: TFile,
  sourceFile: TFile
) {
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

export function getLinkedPageMetadata(
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
