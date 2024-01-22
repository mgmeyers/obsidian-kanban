import Fuse from 'fuse.js';

import { StrategyProps } from './textcomplete/textcomplete-core';

const priorityRegex = /\B!([^\s]*)?$/;

export function getPrioritySearchConfig(
  priorities: string[],
  prioritySearch: Fuse<string>
): StrategyProps<Fuse.FuseResult<string>> {
  return {
    id: 'priority',
    match: priorityRegex,
    index: 1,
    search: (
      term: string,
      callback: (results: Fuse.FuseResult<string>[]) => void
    ) => {
      if (!term) {
        callback(
          priorities
            .slice(0, 50)
            .map((priority, i) => ({ item: priority, refIndex: i }))
        );
      } else {
        callback([
          { item: `<em>!${term}</em>`, refIndex: -1 },
          ...prioritySearch.search(term, { limit: 50 }),
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
