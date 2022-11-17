import Fuse from 'fuse.js';
import { App, TFile, setIcon } from 'obsidian';

import { StateManager } from 'src/StateManager';

import { c, generateInstanceId } from '../helpers';
import { StrategyProps } from './textcomplete/textcomplete-core';

const linkRegex = /\B\[\[([^\]]*)$/;
const embedRegex = /\B!\[\[([^\]]*)$/;

const linkHeadingRegex = /\B\[\[([^#\]]+)#([^\]]*)$/;
const embedHeadingRegex = /\B!\[\[([^#\]]+)#([^\]]*)$/;

const linkBlockRegex = /\B\[\[([^#\]]+)#?\^([^\]]*)$/;
const embedBlockRegex = /\B!\[\[([^#\]]+)#?\^([^\]]*)$/;

export interface LinkSuggestion {
  file: TFile;
  path: string;
  alias: string;
}

function getAliasMarkup(
  win: Window,
  stateManager: StateManager,
  filePath: string,
  res: Fuse.FuseResult<LinkSuggestion>
) {
  let container = win.document.body.createDiv(c('file-suggestion-wrapper'));
  container.detach();

  setIcon(container.createDiv(c('file-suggestion-icon')), 'lucide-forward', 12);

  container.createDiv({}, (div) => {
    div.createDiv({
      cls: c('file-suggestion-title'),
      text: res.item.alias,
    });
    div.createDiv({
      cls: c('file-suggestion-subtitle'),
      text: stateManager.app.metadataCache.fileToLinktext(
        res.item.file,
        filePath
      ),
    });
  });

  const outerHTML = container.outerHTML;

  container.remove();
  container = null;

  return outerHTML;
}

export function getFileSearchConfig(
  win: Window,
  files: LinkSuggestion[],
  fileSearch: Fuse<LinkSuggestion>,
  filePath: string,
  stateManager: StateManager,
  willAutoPairBrackets: boolean,
  isEmbed: boolean
): StrategyProps<Fuse.FuseResult<LinkSuggestion>> {
  return {
    id: `link-${isEmbed ? 'embed' : 'normal'}`,
    match: isEmbed ? embedRegex : linkRegex,
    index: 1,
    template: (res: Fuse.FuseResult<LinkSuggestion>) => {
      if (res.item.file === null) {
        const alias = res.item.path.split('|').pop();

        return `<em>${alias || res.item.path}</em>`;
      }

      if (res.item.alias) {
        return getAliasMarkup(win, stateManager, filePath, res);
      }

      return stateManager.app.metadataCache.fileToLinktext(
        res.item.file,
        filePath
      );
    },
    search: (
      term: string,
      callback: (results: Fuse.FuseResult<LinkSuggestion>[]) => void
    ) => {
      if (!term) {
        callback(
          files.slice(0, 10).map((file, i) => ({ item: file, refIndex: i }))
        );
      } else {
        const split = term.split('|');
        const haveAlias = split.length > 1;
        const search = split[0];
        const aliasSearch = haveAlias ? split.slice(1).join('|') : null;

        let params: string | Record<string, string> = term;

        if (haveAlias) {
          params = {
            'file.basename': search,
            alias: aliasSearch,
          };
        }

        callback([
          { item: { file: null, path: term, alias: '' }, refIndex: -1 },
          ...fileSearch.search(params),
        ]);
      }
    },
    replace: (result: Fuse.FuseResult<LinkSuggestion>): string => {
      const output: string[] = [];

      if (isEmbed && result.item.file.extension === 'md') {
        output.push('!');
      }

      if (result.item.file === null) {
        output.push(`[[${result.item.path}]]`);
      } else {
        output.push(
          stateManager.app.fileManager.generateMarkdownLink(
            result.item.file,
            stateManager.file.path,
            undefined,
            result.item.alias
          )
        );
      }

      const shouldUseMarkdownLinks = !!(
        stateManager.app.vault as any
      ).getConfig('useMarkdownLinks');

      if (willAutoPairBrackets && !shouldUseMarkdownLinks) {
        output[output.length - 1] = output[output.length - 1].slice(0, -2);
      }

      return output.join('');
    },
  };
}

export interface HeadingSuggestion {
  file: TFile;
  heading: string;
  alias: string;
}

function getHeadings(
  app: App,
  sourcePath: string,
  filePath: string,
  searchTerm: string
): Fuse.FuseResult<HeadingSuggestion>[] {
  if (!filePath) {
    return [];
  }

  const aliasSplit = filePath.split('|');
  const file = app.metadataCache.getFirstLinkpathDest(
    aliasSplit[0],
    sourcePath
  );

  if (!file) {
    return [];
  }

  const fileCache = app.metadataCache.getFileCache(file);

  if (!fileCache || !fileCache.headings?.length) {
    return [];
  }

  const headings: HeadingSuggestion[] = fileCache.headings.map((heading) => {
    return {
      file,
      heading: heading.heading,
      alias: aliasSplit[1] || '',
    };
  });

  if (!searchTerm) {
    return headings.map((h, i) => ({ item: h, refIndex: i }));
  }

  return new Fuse(headings, {
    keys: ['heading'],
  }).search(searchTerm);
}

export function getHeadingSearchConfig(
  filePath: string,
  stateManager: StateManager,
  willAutoPairBrackets: boolean,
  isEmbed: boolean
): StrategyProps<Fuse.FuseResult<HeadingSuggestion>> {
  return {
    id: `heading-${isEmbed ? 'embed' : 'normal'}`,
    match: isEmbed ? embedHeadingRegex : linkHeadingRegex,
    index: 1,
    template: (res: Fuse.FuseResult<HeadingSuggestion>) => {
      return res.item.heading;
    },
    search: (
      _: string,
      callback: (results: Fuse.FuseResult<HeadingSuggestion>[]) => void,
      marchArr
    ) => {
      callback(
        getHeadings(stateManager.app, filePath, marchArr[1], marchArr[2])
      );
    },
    replace: (result: Fuse.FuseResult<HeadingSuggestion>): string => {
      const output: string[] = [];

      if (isEmbed && result.item.file.extension === 'md') {
        output.push('!');
      }

      output.push(
        stateManager.app.fileManager.generateMarkdownLink(
          result.item.file,
          stateManager.file.path,
          '#' + result.item.heading,
          result.item.alias
        )
      );

      const shouldUseMarkdownLinks = !!(
        stateManager.app.vault as any
      ).getConfig('useMarkdownLinks');

      if (willAutoPairBrackets && !shouldUseMarkdownLinks) {
        output[output.length - 1] = output[output.length - 1].slice(0, -2);
      } else if (!willAutoPairBrackets && !shouldUseMarkdownLinks) {
        output.push(']] ');
      }

      return output.join('');
    },
  };
}

export class MockRunnable {
  running = false;
  cancelled = false;

  start() {
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  cancel() {
    this.stop();
    this.cancelled = true;
  }

  isRunning() {
    return this.running;
  }

  isCancelled() {
    return this.cancelled;
  }
}

export interface BlockSuggestion {
  file: TFile;
  blockId?: string;
  block: {
    type: string;
    start: number;
    end: number;
  };
  searchString: string;
  alias: string;
}

async function getBlocks(
  app: App,
  sourcePath: string,
  filePath: string,
  searchTerm: string,
  callback: (results: Fuse.FuseResult<BlockSuggestion>[]) => void
) {
  if (!filePath) {
    return callback([]);
  }

  const aliasSplit = filePath.split('|');
  const file = app.metadataCache.getFirstLinkpathDest(
    aliasSplit[0],
    sourcePath
  );

  if (!file) {
    return callback([]);
  }

  const fileCache = app.metadataCache.getFileCache(file);

  if (!fileCache || !fileCache.sections?.length) {
    return callback([]);
  }

  try {
    const blockCache = await (app.metadataCache as any).blockCache.getForFile(
      new MockRunnable(),
      file
    );

    if (!blockCache?.blocks) {
      return callback([]);
    }

    const blockSuggestions: BlockSuggestion[] = blockCache.blocks
      .map((b: any) => {
        if (b.node.type === 'heading') return null;

        return {
          file,
          searchString: b.display,
          blockId: b.node.id,
          block: {
            type: b.node.type,
            start: b.node.position.start.offset,
            end: b.node.position.end.offset,
          },
          alias: aliasSplit[1] || '',
        } as BlockSuggestion;
      })
      .filter((b: BlockSuggestion) => b);

    if (searchTerm) {
      callback(
        new Fuse(blockSuggestions, {
          keys: ['searchString', 'blockId'],
        }).search(searchTerm)
      );
    } else {
      callback(
        blockSuggestions.map((block, i) => ({ item: block, refIndex: i }))
      );
    }
  } catch (e) {
    callback([]);
  }
}

function shouldInsertAfter(blockType: string) {
  return [
    'blockquote',
    'code',
    'table',
    'comment',
    'footnoteDefinition',
  ].includes(blockType);
}

export function getBlockSearchConfig(
  filePath: string,
  stateManager: StateManager,
  willAutoPairBrackets: boolean,
  isEmbed: boolean
): StrategyProps<Fuse.FuseResult<BlockSuggestion>> {
  return {
    id: `block-${isEmbed ? 'embed' : 'normal'}`,
    match: isEmbed ? embedBlockRegex : linkBlockRegex,
    index: 1,
    template: (res: Fuse.FuseResult<BlockSuggestion>) => {
      if (res.item.blockId) {
        return `<div class="${c(
          'file-suggestion-wrapper'
        )}"><div><div class="${c('file-suggestion-title')}">${
          res.item.searchString
        }</div><div class="${c('file-suggestion-subtitle')}">${
          res.item.blockId
        }</div><div></div>`;
      }

      return res.item.searchString;
    },
    search: (
      _: string,
      callback: (results: Fuse.FuseResult<BlockSuggestion>[]) => void,
      marchArr
    ) => {
      getBlocks(stateManager.app, filePath, marchArr[1], marchArr[2], callback);
    },
    replace: (result: Fuse.FuseResult<BlockSuggestion>): string => {
      const output: string[] = [];

      if (isEmbed && result.item.file.extension === 'md') {
        output.push('!');
      }

      let subpath = '#^';

      if (result.item.blockId) {
        subpath += result.item.blockId;
      } else {
        const blockId = generateInstanceId();
        const spacer = shouldInsertAfter(result.item.block.type) ? '\n\n' : ' ';

        stateManager.app.vault
          .cachedRead(result.item.file)
          .then((content) => {
            const newContent = `${content.slice(
              0,
              result.item.block.end
            )}${spacer}^${blockId}${content.slice(result.item.block.end)}`;
            stateManager.app.vault.modify(result.item.file, newContent);
          })
          .catch((e) => {
            stateManager.setError(e);
            console.error(e);
          });

        subpath += blockId;
      }

      output.push(
        stateManager.app.fileManager.generateMarkdownLink(
          result.item.file,
          stateManager.file.path,
          subpath,
          result.item.alias
        )
      );

      const shouldUseMarkdownLinks = !!(
        stateManager.app.vault as any
      ).getConfig('useMarkdownLinks');

      if (willAutoPairBrackets && !shouldUseMarkdownLinks) {
        output[output.length - 1] = output[output.length - 1].slice(0, -2);
      } else if (!willAutoPairBrackets && !shouldUseMarkdownLinks) {
        output.push(']] ');
      }

      return output.join('');
    },
  };
}
