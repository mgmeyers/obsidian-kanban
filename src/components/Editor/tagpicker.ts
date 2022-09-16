import Fuse from 'fuse.js';

import { StrategyProps } from './textcomplete/textcomplete-core';

const tagRegex = /\B#([^\s]*)?$/;

export function getTagSearchConfig(
  tags: string[],
  tagSearch: Fuse<string>
): StrategyProps<Fuse.FuseResult<string>> {
  return {
    id: 'tag',
    match: tagRegex,
    index: 1,
    search: (
      term: string,
      callback: (results: Fuse.FuseResult<string>[]) => void
    ) => {
      if (!term) {
        callback(
          tags.slice(0, 50).map((tag, i) => ({ item: tag, refIndex: i }))
        );
      } else {
        callback([
          { item: `<em>#${term}</em>`, refIndex: -1 },
          ...tagSearch.search(term, { limit: 50 }),
        ]);
      }
    },
    template: (result: Fuse.FuseResult<string>) => {
      return result.item;
    },
    replace: (result: Fuse.FuseResult<string>): string => {
      return `${result.item.replace(/<\/?em>/g, '')} `;
    },
  };
}
