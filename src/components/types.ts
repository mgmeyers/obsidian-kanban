export interface LaneData {
  shouldMarkItemsComplete?: boolean;
}

export interface Lane {
  id: string;
  title: string;
  data: LaneData;
  items: Item[];
}

export interface ItemData {
  isComplete?: boolean; 
}

export interface Item {
  id: string;
  title: string;
  data: ItemData;
}

export interface Board {
  lanes: Lane[];
  archive: Item[];
}
