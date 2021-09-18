import { StrategyProps } from '@textcomplete/core';
import Fuse from 'fuse.js';
import { TFile, setIcon } from 'obsidian';

import { StateManager } from 'src/StateManager';

import { c } from '../helpers';

const linkRegex = /\B\[\[([^\]]*)?$/;
const embedRegex = /\B!\[\[([^\]]*)?$/;

export interface LinkSuggestion {
  file: TFile;
  path: string;
  alias: string;
}

function getAliasMarkup(
  stateManager: StateManager,
  filePath: string,
  res: Fuse.FuseResult<LinkSuggestion>
) {
  let container = createDiv(c('file-suggestion-wrapper'));

  setIcon(container.createDiv(c('file-suggestion-icon')), 'forward-arrow', 12);

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
  files: LinkSuggestion[],
  fileSearch: Fuse<LinkSuggestion>,
  filePath: string,
  stateManager: StateManager,
  willAutoPairBrackets: boolean,
  isEmbed: boolean
): StrategyProps<Fuse.FuseResult<LinkSuggestion>> {
  return {
    id: 'link',
    match: isEmbed ? embedRegex : linkRegex,
    index: 1,
    template: (res: Fuse.FuseResult<LinkSuggestion>) => {
      if (res.item.alias) {
        return getAliasMarkup(stateManager, filePath, res);
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
        callback(fileSearch.search(term));
      }
    },
    replace: (result: Fuse.FuseResult<LinkSuggestion>): string => {
      const output: string[] = [];

      if (isEmbed) {
        output.push('!');
      }

      output.push(
        `[[${stateManager.app.metadataCache.fileToLinktext(
          result.item.file,
          filePath
        )}`
      );

      if (result.item.alias) {
        output.push(`|${result.item.alias}`);
      }

      if (!willAutoPairBrackets) {
        output.push(']] ');
      }

      console.log('output', output);

      return output.join('');
    },
  };
}
