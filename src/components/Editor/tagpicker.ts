import { StrategyProps } from '@textcomplete/core';
import Fuse from 'fuse.js';

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
          tags.slice(0, 10).map((tag, i) => ({ item: tag, refIndex: i }))
        );
      } else {
        callback(tagSearch.search(term));
      }
    },
    template: (result: Fuse.FuseResult<string>) => {
      return result.item;
    },
    replace: (result: Fuse.FuseResult<string>): string => `${result.item} `,
  };
}
