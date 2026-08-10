import { Board, BoardTemplate, Item, ItemTemplate, Lane, LaneTemplate } from 'src/components/types';

let idCounter = 0;

function nextId(prefix: string) {
  return `${prefix}-${++idCounter}`;
}

export function resetIds() {
  idCounter = 0;
}

export function makeItem(titleRaw: string, checkChar = ' ', id?: string): Item {
  return {
    ...ItemTemplate,
    id: id || nextId('item'),
    children: [],
    data: {
      checked: checkChar !== ' ',
      checkChar,
      title: titleRaw,
      titleRaw,
      titleSearch: titleRaw.toLocaleLowerCase(),
      titleSearchRaw: titleRaw.toLocaleLowerCase(),
      metadata: {},
    },
  };
}

export function makeLane(
  title: string,
  items: Item[] = [],
  data: Partial<Lane['data']> = {}
): Lane {
  return {
    ...LaneTemplate,
    id: nextId('lane'),
    children: items,
    data: { title, ...data },
  };
}

export function makeBoard(lanes: Lane[]): Board {
  return {
    ...BoardTemplate,
    id: nextId('board'),
    children: lanes,
    data: {
      isSearching: false,
      settings: {},
      frontmatter: {},
      archive: [],
      errors: [],
    },
  };
}

/** Card titles per lane, handy for asserting on board shape. */
export function boardShape(board: Board): Record<string, string[]> {
  return board.children.reduce<Record<string, string[]>>((acc, lane) => {
    acc[lane.data.title] = lane.children.map((item) => item.data.titleRaw);
    return acc;
  }, {});
}
