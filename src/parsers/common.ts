import { App, TFile, moment } from 'obsidian';
import { KanbanSettings } from 'src/Settings';
import { StateManager } from 'src/StateManager';
import { anyToString } from 'src/components/Item/MetadataTable';
import { Board, FileMetadata, Item } from 'src/components/types';
import { defaultSort } from 'src/helpers/util';
import { t } from 'src/lang/helpers';

export const frontmatterKey = 'kanban-plugin';

export enum ParserFormats {
  List,
}

export interface BaseFormat {
  newItem(content: string, checkChar: string, forceEdit?: boolean): Item;
  updateItemContent(item: Item, content: string): Item;
  boardToMd(board: Board): string;
  mdToBoard(md: string): Board;
  reparseBoard(): Board;
}

export const completeString = `**${t('Complete')}**`;
export const horizontalString = '%% kanban:horizontal %%';
export const archiveString = '***';
export const basicFrontmatter = ['---', '', `${frontmatterKey}: board`, '', '---', '', ''].join(
  '\n'
);

export function settingsToCodeblock(board: Board): string {
  return [
    '',
    '',
    '%% kanban:settings',
    '```',
    JSON.stringify(board.data.settings),
    '```',
    '%%',
  ].join('\n');
}

export function getSearchValue(item: Item, stateManager: StateManager) {
  const fileMetadata = item.data.metadata.fileMetadata;
  const { titleSearchRaw } = item.data;

  const searchValue = [titleSearchRaw];

  if (fileMetadata) {
    const presentKeys = Object.keys(fileMetadata).filter((k) => {
      return item.data.metadata.fileMetadataOrder?.includes(k);
    });
    if (presentKeys.length) {
      const keys = anyToString(presentKeys, stateManager);
      const values = anyToString(
        presentKeys.map((k) => fileMetadata[k]),
        stateManager
      );

      if (keys) searchValue.push(keys);
      if (values) searchValue.push(values);
    }
  }

  if (item.data.metadata.time) {
    searchValue.push(item.data.metadata.time.format('LLLL'));
    searchValue.push(anyToString(item.data.metadata.time, stateManager));
  } else if (item.data.metadata.date) {
    searchValue.push(item.data.metadata.date.format('LLLL'));
    searchValue.push(anyToString(item.data.metadata.date, stateManager));
  }

  return searchValue.join(' ').toLocaleLowerCase();
}

export function getDataViewCache(app: App, linkedFile: TFile, sourceFile: TFile) {
  if (
    (app as any).plugins.enabledPlugins.has('dataview') &&
    (app as any).plugins?.plugins?.dataview?.api
  ) {
    return (app as any).plugins.plugins.dataview.api.page(linkedFile.path, sourceFile.path);
  }
}

function getPageData(obj: any, path: string) {
  if (!obj) return null;
  if (obj[path]) return obj[path];

  const split = path.split('.');
  let ctx = obj;

  for (const p of split) {
    if (typeof ctx === 'object' && p in ctx) {
      ctx = ctx[p];
    } else {
      ctx = null;
      break;
    }
  }

  return ctx;
}

export function getLinkedPageMetadata(
  stateManager: StateManager,
  linkedFile: TFile | null | undefined
): { fileMetadata?: FileMetadata; fileMetadataOrder?: string[] } {
  const metaKeys = stateManager.getSetting('metadata-keys');

  if (!metaKeys.length) {
    return {};
  }

  if (!linkedFile) {
    return {};
  }

  const cache = stateManager.app.metadataCache.getFileCache(linkedFile);
  const dataviewCache = getDataViewCache(stateManager.app, linkedFile, stateManager.file);

  if (!cache && !dataviewCache) {
    return {};
  }

  const metadata: FileMetadata = {};
  const seenTags: { [k: string]: boolean } = {};
  const seenKey: { [k: string]: boolean } = {};
  const order: string[] = [];

  let haveData = false;

  metaKeys.forEach((k) => {
    if (seenKey[k.metadataKey]) return;

    seenKey[k.metadataKey] = true;

    if (k.metadataKey === 'tags') {
      let tags = cache?.tags || [];

      if (Array.isArray(cache?.frontmatter?.tags)) {
        tags = [].concat(
          tags,
          cache.frontmatter.tags.map((tag: string) => ({ tag: `#${tag}` }))
        );
      }

      if (tags?.length === 0) return;

      order.push(k.metadataKey);
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
          })
          .sort(defaultSort),
      };

      haveData = true;
      return;
    }

    const dataviewVal = getPageData(dataviewCache, k.metadataKey);
    let cacheVal = getPageData(cache?.frontmatter, k.metadataKey);
    if (
      cacheVal !== null &&
      cacheVal !== undefined &&
      cacheVal !== '' &&
      !(Array.isArray(cacheVal) && cacheVal.length === 0)
    ) {
      if (typeof cacheVal === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(cacheVal)) {
          cacheVal = moment(cacheVal);
        } else if (/^\[\[[^\]]+\]\]$/.test(cacheVal)) {
          const link = (cache.frontmatterLinks || []).find((l) => l.key === k.metadataKey);
          if (link) {
            const file = stateManager.app.metadataCache.getFirstLinkpathDest(
              link.link,
              stateManager.file.path
            );
            if (file) {
              cacheVal = file;
            }
          }
        }
      } else if (Array.isArray(cacheVal)) {
        cacheVal = cacheVal.map<any>((v, i) => {
          if (typeof v === 'string' && /^\[\[[^\]]+\]\]$/.test(v)) {
            const link = (cache.frontmatterLinks || []).find(
              (l) => l.key === k.metadataKey + '.' + i.toString()
            );
            if (link) {
              const file = stateManager.app.metadataCache.getFirstLinkpathDest(
                link.link,
                stateManager.file.path
              );
              if (file) {
                return file;
              }
            }
          }
          return v;
        });
      }

      order.push(k.metadataKey);
      metadata[k.metadataKey] = {
        ...k,
        value: cacheVal,
      };
      haveData = true;
    } else if (
      dataviewVal !== undefined &&
      dataviewVal !== null &&
      dataviewVal !== '' &&
      !(Array.isArray(dataviewVal) && dataviewVal.length === 0)
    ) {
      const cachedValue = dataviewCache[k.metadataKey];

      order.push(k.metadataKey);
      metadata[k.metadataKey] = {
        ...k,
        value: cachedValue,
      };
      haveData = true;
    }
  });

  return {
    fileMetadata: haveData ? metadata : undefined,
    fileMetadataOrder: order,
  };
}

export function shouldRefreshBoard(oldSettings: KanbanSettings, newSettings: KanbanSettings) {
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
    'move-dates',
    'move-tags',
    'inline-metadata-position',
    'move-task-metadata',
    'hide-card-count',
    'tag-colors',
    'date-colors',
  ];

  return !toCompare.every((k) => {
    return oldSettings[k] === newSettings[k];
  });
}
