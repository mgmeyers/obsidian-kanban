import { App, TFile } from 'obsidian';

import { Board, FileMetadata, Item } from 'src/components/types';
import { t } from 'src/lang/helpers';
import { KanbanSettings } from 'src/Settings';
import { StateManager } from 'src/StateManager';

export const frontMatterKey = 'kanban-plugin';

export enum ParserFormats {
  List,
}

export interface BaseFormat {
  newItem(
    content: string,
    isComplete?: boolean,
    forceEdit?: boolean
  ): Promise<Item>;
  updateItemContent(item: Item, content: string): Promise<Item>;
  boardToMd(board: Board): string;
  mdToBoard(md: string): Promise<Board>;
  reparseBoard(): Promise<Board>;
}

export const completeString = `**${t('Complete')}**`;
export const archiveString = '***';
export const basicFrontmatter = [
  '---',
  '',
  `${frontMatterKey}: basic`,
  '',
  '---',
  '',
  '',
].join('\n');

export function settingsToCodeblock(settings: KanbanSettings): string {
  return [
    '',
    '',
    '%% kanban:settings',
    '```',
    JSON.stringify(settings),
    '```',
    '%%',
  ].join('\n');
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
  const dataviewCache = getDataViewCache(
    stateManager.app,
    linkedFile,
    stateManager.file
  );

  if (!cache && !dataviewCache) {
    return {};
  }

  const metadata: FileMetadata = {};
  const seenTags: { [k: string]: boolean } = {};
  const seenKey: { [k: string]: boolean } = {};
  const order: string[] = [];

  let haveData = false;
  // reducer function to convert dot notation to nested values -- see
  // 	https://stackoverflow.com/questions/6393943/convert-a-javascript-string-in-dot-notation-into-an-object-reference

  function dotToObject(str: string, obj: any) {
    // @ts-ignore
    function dotReducer(h, i) {
      if (!h[i]) return {};
      return h[i];
    }
    if (!obj) {
      return null;
    }
    return str.split('.').reduce(dotReducer, obj);
  }
  console.debug('metakeys foreach', seenKey, order, metadata, metaKeys);
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
          }),
      };

      haveData = true;
      return;
    }

    const serializedObject = dotToObject(k?.metadataKey, cache.frontmatter);
    if (cache?.frontmatter && cache.frontmatter[k.metadataKey]) {
      order.push(k.metadataKey);
      metadata[k.metadataKey] = {
        ...k,
        value: cache.frontmatter[k.metadataKey],
      };
      haveData = true;
    } else if (typeof serializedObject === 'string') {
      console.log('dottoe', serializedObject);
      order.push(k.metadataKey);
      metadata[k.metadataKey] = {
        ...k,
        value: serializedObject,
      };
      haveData = true;
    } else if (dataviewCache && dataviewCache[k.metadataKey]) {
      const cachedValue = dataviewCache[k.metadataKey];
      let val = cachedValue.values || cachedValue.val || cachedValue;

      // Protect against proxy values
      if (val === cachedValue && typeof val === 'object') {
        val = { ...cachedValue };
      } else if (
        !Array.isArray(val) &&
        typeof val !== 'string' &&
        typeof val !== 'number'
      ) {
        return;
      }

      order.push(k.metadataKey);
      metadata[k.metadataKey] = {
        ...k,
        value: val,
      };
      haveData = true;
    }
  });

  return {
    fileMetadata: haveData ? metadata : undefined,
    fileMetadataOrder: order,
  };
}

export function shouldRefreshBoard(
  oldSettings: KanbanSettings,
  newSettings: KanbanSettings
) {
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
