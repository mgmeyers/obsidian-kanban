import { TFile } from 'obsidian';

import { Nestable } from 'src/dnd/types';
import { KanbanSettings } from 'src/Settings';

export interface LaneData {
  shouldMarkItemsComplete?: boolean;
  title: string;
}

export interface DataKey {
  metadataKey: string;
  label: string;
  shouldHideLabel: boolean;
  containsMarkdown: boolean;
}

export interface PageData extends DataKey {
  value: string | number | Array<string | number>;
}

export interface FileMetadata {
  [k: string]: PageData;
}

export interface ItemMetaData {
  date?: moment.Moment;
  time?: moment.Moment;
  tags?: string[];
  file?: TFile | null;
  fileMetadata?: FileMetadata;
}

export interface ItemData {
  isComplete?: boolean;
  title: string;
  titleRaw: string;
  titleSearch: string;
  metadata: ItemMetaData;
  dom: HTMLDivElement;
}

export interface ErrorReport {
  description: string;
  stack: string;
}

export interface BoardData {
  isSearching: boolean;
  settings: KanbanSettings;
  archive: Item[];
  errors: ErrorReport[];
}

export type Item = Nestable<ItemData>;
export type Lane = Nestable<LaneData, Item>;
export type Board = Nestable<BoardData, Lane>;
export type MetadataSetting = Nestable<DataKey>;

export const DataTypes = {
  Item: 'item',
  Lane: 'lane',
  Board: 'board',
  MetadataSetting: 'metadata-setting',
};

export const ItemTemplate = {
  accepts: [DataTypes.Item],
  type: DataTypes.Item,
  children: [] as any[],
};

export const LaneTemplate = {
  accepts: [DataTypes.Lane],
  type: DataTypes.Lane,
};

export const BoardTemplate = {
  accepts: [] as string[],
  type: DataTypes.Board,
};

export const MetadataSettingTemplate = {
  accepts: [DataTypes.MetadataSetting],
  type: DataTypes.MetadataSetting,
  children: [] as any[],
};
