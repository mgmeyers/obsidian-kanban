import { KanbanSettings } from 'src/Settings';

export const frontMatterKey = 'kanban-plugin';

export type ParserSettings = {
  dateFormat: KanbanSettings['date-format'];
  timeFormat: KanbanSettings['time-format'];
  dateTrigger: KanbanSettings['date-trigger'];
  timeTrigger: KanbanSettings['time-trigger'];
  shouldLinkDate: KanbanSettings['link-date-to-daily-note'];
  shouldHideDate: KanbanSettings['hide-date-in-title'];
  shouldHideTags: KanbanSettings['hide-tags-in-title'];
  metaKeys: KanbanSettings['metadata-keys'];
  dateRegEx: RegExp;
  timeRegEx: RegExp;
};

export enum ParserFormats {
  Basic,
}
