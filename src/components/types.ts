import { TFile } from 'obsidian';
import { KanbanSettings } from 'src/Settings';
import { Nestable } from 'src/dnd/types';
import { InlineField } from 'src/parsers/helpers/inlineMetadata';
import { FileAccessor } from 'src/parsers/helpers/parser';

export enum LaneSort {
  TitleAsc,
  TitleDsc,
  DateAsc,
  DateDsc,
  TagsAsc,
  TagsDsc,
}

export interface LaneData {
  shouldMarkItemsComplete?: boolean;
  isHorizontal?: boolean;
  title: string;
  maxItems?: number;
  dom?: HTMLDivElement;
  forceEditMode?: boolean;
  sorted?: LaneSort | string;
}

export interface DataKey {
  metadataKey: string;
  label: string;
  shouldHideLabel: boolean;
  containsMarkdown: boolean;
}

export interface TagColor {
  tagKey: string;
  color: string;
  backgroundColor: string;
}

export interface TagSort {
  tag: string;
}

export interface Category {
  name: string;
  color: string;
}

export interface DateColor {
  isToday?: boolean;
  isBefore?: boolean;
  isAfter?: boolean;
  distance?: number;
  unit?: 'hours' | 'days' | 'weeks' | 'months';
  direction?: 'before' | 'after';
  color?: string;
  backgroundColor?: string;
}

export type PageDataValue =
  | string
  | number
  | Array<string | number>
  | { [k: string]: PageDataValue };

export interface PageData extends DataKey {
  value: PageDataValue;
}

export interface FileMetadata {
  [k: string]: PageData;
}

export interface ItemMetadata {
  dateStr?: string;
  date?: moment.Moment;
  timeStr?: string;
  time?: moment.Moment;
  storyPoints?: number;
  storyPointsStr?: string;
  priority?: 'low' | 'medium' | 'high';
  priorityStr?: string;
  category?: string;
  categoryStr?: string;
  tags?: string[];
  fileAccessor?: FileAccessor;
  file?: TFile | null;
  fileMetadata?: FileMetadata;
  fileMetadataOrder?: string[];
  inlineMetadata?: InlineField[];
}

export interface ItemData {
  blockId?: string;
  checked: boolean;
  checkChar: string;
  title: string;
  titleRaw: string;
  titleSearch: string;
  titleSearchRaw: string;
  metadata: ItemMetadata;
  forceEditMode?: boolean;
}

export interface ErrorReport {
  description: string;
  stack: string;
}

export interface BoardData {
  isSearching: boolean;
  settings: KanbanSettings;
  frontmatter: Record<string, number | string | Array<number | string>>;
  archive: Item[];
  errors: ErrorReport[];
}

export type Item = Nestable<ItemData>;
export type Lane = Nestable<LaneData, Item>;
export type Board = Nestable<BoardData, Lane>;
export type MetadataSetting = Nestable<DataKey>;
export type TagColorSetting = Nestable<TagColor>;
export type TagSortSetting = Nestable<TagSort>;
export type DateColorSetting = Nestable<DateColor>;

export const DataTypes = {
  Item: 'item',
  Lane: 'lane',
  Board: 'board',
  MetadataSetting: 'metadata-setting',
  TagColorSetting: 'tag-color',
  TagSortSetting: 'tag-sort',
  DateColorSetting: 'date-color',
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

export const TagSortSettingTemplate = {
  accepts: [DataTypes.TagSortSetting],
  type: DataTypes.TagSortSetting,
  children: [] as any[],
};

// TODO: all this is unecessary because these aren't sortable
export const TagColorSettingTemplate = {
  accepts: [] as string[],
  type: DataTypes.TagColorSetting,
  children: [] as any[],
};

// TODO: all this is unecessary because these aren't sortable
export const DateColorSettingTemplate = {
  accepts: [] as string[],
  type: DataTypes.DateColorSetting,
  children: [] as any[],
};

export interface EditCoordinates {
  x: number;
  y: number;
}

export enum EditingState {
  cancel,
  complete,
}

export type EditState = EditCoordinates | EditingState;

export function isEditing(state: EditState): state is EditCoordinates {
  if (state === null) return false;
  if (typeof state === 'number') return false;
  return true;
}
