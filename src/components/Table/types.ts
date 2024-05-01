import { StateManager } from '../../StateManager';
import { Path } from '../../dnd/types';
import { Item, Lane } from '../types';

export interface TableItem {
  item: Item;
  lane: Lane;
  path: Path;
  stateManager: StateManager;
}

export interface TableData {
  items: TableItem[];
  metadata: string[];
  fileMetadata: string[];
  inlineMetadata: string[];
  metadataLabels: Map<string, string>;
}
