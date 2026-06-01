import { Board, Item, Lane, LaneSort } from 'src/components/types';

export type DateSortDirection = 'asc' | 'dsc';

interface SortResult<T> {
  changed: boolean;
  orderChanged: boolean;
  value: T;
}

function getItemDateTime(item: Item): number | null {
  const date = item.data.metadata.time || item.data.metadata.date;

  if (!date || !date.isValid()) {
    return null;
  }

  return date.valueOf();
}

function hasSameItemOrder(left: Item[], right: Item[]) {
  return left.every((item, index) => item.id === right[index]?.id);
}

export function sortLaneByDate(
  lane: Lane,
  direction: DateSortDirection = 'asc'
): SortResult<Lane> {
  const datedItems = lane.children.some((item) => getItemDateTime(item) !== null);

  if (!datedItems) {
    return { changed: false, orderChanged: false, value: lane };
  }

  const modifier = direction === 'asc' ? 1 : -1;
  const sortedChildren = lane.children
    .map((item, index) => ({ item, index, time: getItemDateTime(item) }))
    .sort((left, right) => {
      if (left.time !== null && right.time === null) return -1;
      if (left.time === null && right.time !== null) return 1;
      if (left.time === null && right.time === null) return left.index - right.index;

      const diff = left.time - right.time;
      if (diff === 0) return left.index - right.index;

      return diff * modifier;
    })
    .map(({ item }) => item);

  const sorted = direction === 'asc' ? LaneSort.DateAsc : LaneSort.DateDsc;
  const orderChanged = !hasSameItemOrder(lane.children, sortedChildren);
  const sortedChanged = lane.data.sorted !== sorted;

  if (!orderChanged && !sortedChanged) {
    return { changed: false, orderChanged: false, value: lane };
  }

  return {
    changed: true,
    orderChanged,
    value: {
      ...lane,
      children: orderChanged ? sortedChildren : lane.children,
      data: {
        ...lane.data,
        sorted,
      },
    },
  };
}

export function sortBoardByDate(board: Board): SortResult<Board> {
  const laneResults = board.children.map((lane) => sortLaneByDate(lane));
  const changed = laneResults.some((result) => result.changed);
  const orderChanged = laneResults.some((result) => result.orderChanged);

  if (!changed) {
    return { changed: false, orderChanged: false, value: board };
  }

  return {
    changed,
    orderChanged,
    value: {
      ...board,
      children: laneResults.map((result) => result.value),
    },
  };
}
