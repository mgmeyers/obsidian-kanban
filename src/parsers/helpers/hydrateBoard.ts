import { Operation } from 'fast-json-patch';
import { moment } from 'obsidian';
import { StateManager } from 'src/StateManager';
import { c, getDateColorFn } from 'src/components/helpers';
import { Board, DataTypes, DateColor, Item, Lane } from 'src/components/types';
import { Path } from 'src/dnd/types';
import { getEntityFromPath } from 'src/dnd/util/data';

import { getSearchValue } from '../common';
import { extractInlineFields, taskFields } from './inlineMetadata';

export function hydrateLane(stateManager: StateManager, lane: Lane) {
  return lane;
}

export function preprocessTitle(stateManager: StateManager, title: string) {
  const getDateColor = getDateColorFn(stateManager);
  const dateTrigger = stateManager.getSetting('date-trigger');
  const dateFormat = stateManager.getSetting('date-format');
  const dateDisplayFormat = stateManager.getSetting('date-display-format');
  const timeTrigger = stateManager.getSetting('time-trigger');
  const timeFormat = stateManager.getSetting('time-format');

  const { app } = stateManager;

  let date: moment.Moment;
  let dateColor: DateColor;
  const getWrapperStyles = (baseClass: string) => {
    let wrapperStyle = '';
    if (dateColor) {
      if (dateColor.backgroundColor) {
        baseClass += ' has-background';
        wrapperStyle = ` style="--date-color: ${dateColor.color}; --date-background-color: ${dateColor.backgroundColor};"`;
      } else {
        wrapperStyle = ` style="--date-color: ${dateColor.color};"`;
      }
    }
    return { wrapperClass: baseClass, wrapperStyle };
  };

  title = title.replace(
    new RegExp(`${dateTrigger}\\[\\[([^\\]]+)\\]\\]`, 'g'),
    (match, content) => {
      const parsed = moment(content, dateFormat);
      if (!parsed.isValid()) return match;
      date = parsed;
      const linkPath = app.metadataCache.getFirstLinkpathDest(content, stateManager.file.path);
      if (!dateColor) dateColor = getDateColor(parsed);
      const { wrapperClass, wrapperStyle } = getWrapperStyles(c('preview-date-wrapper'));
      return `<span data-date="${date.toISOString()}" class="${wrapperClass} ${c('date')} ${c('preview-date-link')}"${wrapperStyle}><a class="${c('preview-date')} internal-link" data-href="${linkPath?.path ?? content}" href="${linkPath?.path ?? content}" target="_blank" rel="noopener">${parsed.format(dateDisplayFormat)}</a></span>`;
    }
  );
  title = title.replace(
    new RegExp(`${dateTrigger}\\[([^\\]]+)\\]\\([^)]+\\)`, 'g'),
    (match, content) => {
      const parsed = moment(content, dateFormat);
      if (!parsed.isValid()) return match;
      date = parsed;
      const linkPath = app.metadataCache.getFirstLinkpathDest(content, stateManager.file.path);
      if (!dateColor) dateColor = getDateColor(parsed);
      const { wrapperClass, wrapperStyle } = getWrapperStyles(c('preview-date-wrapper'));
      return `<span data-date="${date.toISOString()}" class="${wrapperClass} ${c('date')} ${c('preview-date-link')}"${wrapperStyle}><a class="${c('preview-date')} internal-link" data-href="${linkPath.path}" href="${linkPath.path}" target="_blank" rel="noopener">${parsed.format(dateDisplayFormat)}</a></span>`;
    }
  );
  title = title.replace(new RegExp(`${dateTrigger}{([^}]+)}`, 'g'), (match, content) => {
    const parsed = moment(content, dateFormat);
    if (!parsed.isValid()) return match;
    date = parsed;
    if (!dateColor) dateColor = getDateColor(parsed);
    const { wrapperClass, wrapperStyle } = getWrapperStyles(c('preview-date-wrapper'));
    return `<span data-date="${date.toISOString()}" class="${wrapperClass} ${c('date')}"${wrapperStyle}><span class="${c('preview-date')} ${c('item-metadata-date')}">${parsed.format(dateDisplayFormat)}</span></span>`;
  });

  title = title.replace(new RegExp(`${timeTrigger}{([^}]+)}`, 'g'), (match, content) => {
    const parsed = moment(content, timeFormat);
    if (!parsed.isValid()) return match;

    if (!date) {
      date = parsed;
      date.year(1970);
    } else {
      date.hour(parsed.hour());
      date.minute(parsed.minute());
      date.second(parsed.second());
    }

    const { wrapperClass, wrapperStyle } = getWrapperStyles(c('preview-time-wrapper'));
    return `<span data-date="${date.toISOString()}" class="${wrapperClass} ${c('date')}"${wrapperStyle}><span class="${c('preview-time')} ${c('item-metadata-time')}">${parsed.format(timeFormat)}</span></span>`;
  });

  return title;
}

export function hydrateItem(stateManager: StateManager, item: Item) {
  const { dateStr, timeStr, fileAccessor } = item.data.metadata;

  if (dateStr) {
    item.data.metadata.date = moment(dateStr, stateManager.getSetting('date-format'));
  }

  if (timeStr) {
    let time = moment(timeStr, stateManager.getSetting('time-format'));

    if (item.data.metadata.date) {
      const date = item.data.metadata.date;

      date.hour(time.hour());
      date.minute(time.minute());
      date.second(time.second());

      time = date.clone();
    }

    item.data.metadata.time = time;
  }

  if (fileAccessor) {
    const file = stateManager.app.metadataCache.getFirstLinkpathDest(
      fileAccessor.target,
      stateManager.file.path
    );

    if (file) {
      item.data.metadata.file = file;
    }
  }

  const firstLineEnd = item.data.title.indexOf('\n');
  const inlineFields = extractInlineFields(item.data.title, true);

  if (inlineFields?.length) {
    const inlineMetadata = (item.data.metadata.inlineMetadata = inlineFields.reduce((acc, curr) => {
      if (!taskFields.has(curr.key)) acc.push(curr);
      else if (firstLineEnd <= 0 || curr.end < firstLineEnd) acc.push(curr);

      return acc;
    }, []));

    const moveTaskData = stateManager.getSetting('move-task-metadata');
    const moveMetadata = stateManager.getSetting('inline-metadata-position') !== 'body';

    if (moveTaskData || moveMetadata) {
      let title = item.data.title;
      for (const item of [...inlineMetadata].reverse()) {
        const isTask = taskFields.has(item.key);

        if (isTask && !moveTaskData) continue;
        if (!isTask && !moveMetadata) continue;

        title = title.slice(0, item.start) + title.slice(item.end);
      }

      item.data.title = title;
    }
  }

  item.data.titleSearch = getSearchValue(item, stateManager);
  item.data.title = preprocessTitle(stateManager, item.data.title);

  return item;
}

export function hydrateBoard(stateManager: StateManager, board: Board): Board {
  try {
    board.children.map((lane) => {
      hydrateLane(stateManager, lane);
      lane.children.map((item) => {
        return hydrateItem(stateManager, item);
      });
    });
  } catch (e) {
    stateManager.setError(e);
    throw e;
  }

  return board;
}

function opAffectsHydration(op: Operation) {
  return (
    (op.op === 'add' || op.op === 'replace') &&
    ['/title', '/titleRaw', '/dateStr', '/timeStr', /\d$/, /\/fileAccessor\/.+$/].some(
      (postFix) => {
        if (typeof postFix === 'string') {
          return op.path.endsWith(postFix);
        } else {
          return postFix.test(op.path);
        }
      }
    )
  );
}

export function hydratePostOp(stateManager: StateManager, board: Board, ops: Operation[]): Board {
  const seen: Record<string, boolean> = {};
  const toHydrate = ops.reduce((paths, op) => {
    if (!opAffectsHydration(op)) {
      return paths;
    }

    const path = op.path.split('/').reduce((path, segment) => {
      if (/\d+/.test(segment)) {
        path.push(Number(segment));
      }

      return path;
    }, [] as Path);

    const key = path.join(',');

    if (!seen[key]) {
      seen[key] = true;
      paths.push(path);
    }

    return paths;
  }, [] as Path[]);

  toHydrate.map((path) => {
    const entity = getEntityFromPath(board, path);

    if (entity.type === DataTypes.Lane) {
      return hydrateLane(stateManager, entity);
    }

    if (entity.type === DataTypes.Item) {
      return hydrateItem(stateManager, entity);
    }
  });

  return board;
}
