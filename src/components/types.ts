import { KanbanSettings } from "src/Settings";

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

export interface ItemMetaData {
  date?: moment.Moment
  time?: moment.Moment
}

export interface Item {
  id: string;
  title: string;
  titleRaw: string;
  titleSearch: string;
  metadata: ItemMetaData;
  data: ItemData;
}

export interface Board {
  isSearching: boolean;
  settings: KanbanSettings;
  lanes: Lane[];
  archive: Item[];
}

export interface BoardModifiers {
  addItemToLane: (laneIndex: number, item: Item) => void;
  addLane: (lane: Lane) => void;
  archiveItem: (laneIndex: number, itemIndex: number, item: Item) => void;
  archiveLane: (laneIndex: number) => void;
  archiveLaneItems: (laneIndex: number) => void;
  deleteItem: (laneIndex: number, itemIndex: number) => void;
  deleteLane: (laneIndex: number) => void;
  updateItem: (laneIndex: number, itemIndex: number, item: Item) => void;
  updateLane: (laneIndex: number, lane: Lane) => void;
}
