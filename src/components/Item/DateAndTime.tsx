import classcat from 'classcat';
import { getLinkpath, moment } from 'obsidian';
import { JSX, useMemo } from 'preact/compat';
import { StateManager } from 'src/StateManager';
import { defaultSort } from 'src/helpers/util';
import { t } from 'src/lang/helpers';
import { lableToIcon } from 'src/parsers/helpers/obsidian-tasks';

import { c } from '../helpers';
import { DateColor, Item } from '../types';

export function getRelativeDate(date: moment.Moment, time: moment.Moment) {
  if (time) {
    return time.from(moment());
  }

  const today = moment().startOf('day');

  if (today.isSame(date, 'day')) {
    return t('today');
  }

  const diff = date.diff(today, 'day');

  if (diff === -1) {
    return t('yesterday');
  }

  if (diff === 1) {
    return t('tomorrow');
  }

  return date.from(today);
}

interface DateProps {
  item: Item;
  stateManager: StateManager;
}

export function RelativeDate({ item, stateManager }: DateProps) {
  const shouldShowRelativeDate = stateManager.useSetting('show-relative-date');

  if (!shouldShowRelativeDate || !item.data.metadata.date) {
    return null;
  }

  const relativeDate = getRelativeDate(item.data.metadata.date, item.data.metadata.time);

  return <span className={c('item-metadata-date-relative')}>{relativeDate}</span>;
}

interface DateAndTimeProps {
  onEditDate?: JSX.MouseEventHandler<HTMLSpanElement>;
  onEditTime?: JSX.MouseEventHandler<HTMLSpanElement>;
  filePath: string;
  getDateColor: (date: moment.Moment) => DateColor;
}

export function DateAndTime({
  item,
  stateManager,
  filePath,
  onEditDate,
  onEditTime,
  getDateColor,
}: DateProps & DateAndTimeProps) {
  const hideDateDisplay = stateManager.useSetting('hide-date-display');
  const dateFormat = stateManager.useSetting('date-format');
  const timeFormat = stateManager.useSetting('time-format');
  const dateDisplayFormat = stateManager.useSetting('date-display-format');
  const shouldLinkDate = stateManager.useSetting('link-date-to-daily-note');

  const targetDate = item.data.metadata.time ?? item.data.metadata.date;
  const dateColor = useMemo(() => {
    if (!targetDate) return null;
    return getDateColor(targetDate);
  }, [targetDate, getDateColor]);

  if (hideDateDisplay || !targetDate) return null;

  const dateStr = targetDate.format(dateFormat);

  if (!dateStr) return null;

  const hasDate = !!item.data.metadata.date;
  const hasTime = !!item.data.metadata.time;
  const dateDisplayStr = targetDate.format(dateDisplayFormat);
  const timeDisplayStr = !hasTime ? null : targetDate.format(timeFormat);

  const datePath = dateStr ? getLinkpath(dateStr) : null;
  const isResolved = dateStr
    ? stateManager.app.metadataCache.getFirstLinkpathDest(datePath, filePath)
    : null;
  const date =
    datePath && shouldLinkDate ? (
      <a
        href={datePath}
        data-href={datePath}
        className={`internal-link ${isResolved ? '' : 'is-unresolved'}`}
        target="blank"
        rel="noopener"
      >
        {dateDisplayStr}
      </a>
    ) : (
      dateDisplayStr
    );

  const dateProps: HTMLAttributes<HTMLSpanElement> = {};

  if (!shouldLinkDate) {
    dateProps['aria-label'] = t('Change date');
    dateProps.onClick = onEditDate;
  }

  return (
    <span
      style={
        dateColor && {
          '--date-color': dateColor.color,
          '--date-background-color': dateColor.backgroundColor,
        }
      }
      className={classcat([
        c('item-metadata-date-wrapper'),
        c('date'),
        {
          'has-background': !!dateColor?.backgroundColor,
        },
      ])}
    >
      {hasDate && (
        <>
          <span
            {...dateProps}
            className={`${c('item-metadata-date')} ${!shouldLinkDate ? 'is-button' : ''}`}
          >
            {date}
          </span>{' '}
        </>
      )}
      {hasTime && (
        <span
          onClick={onEditTime}
          className={`${c('item-metadata-time')} is-button`}
          aria-label={t('Change time')}
        >
          {timeDisplayStr}
        </span>
      )}
    </span>
  );
}

interface TaskMetadataProps {
  item: Item;
  stateManager: StateManager;
}

export function TaskMetadata({ item, stateManager }: TaskMetadataProps) {
  const hideDateDisplay = stateManager.useSetting('hide-date-display');
  const dateDisplayFormat = stateManager.useSetting('date-display-format');

  const taskMetadata = item.data.metadata.taskMetadata;

  if (hideDateDisplay || !taskMetadata) return null;

  const data = Object.keys(taskMetadata)
    .sort((a, b) => {
      if (a === 'priority') return 1;
      if (b === 'priority') return -1;
      return defaultSort(a, b);
    })
    .map((k, i) => {
      let val = taskMetadata[k];

      const key = lableToIcon(k, val);
      if (!key) return null;

      if (moment.isMoment(val)) {
        val = val.format(dateDisplayFormat);
      }

      return (
        <span className={c('item-task-metadata-item')} key={i}>
          <span className={c('item-task-metadata-item-key')}>{key}</span>
          {k !== 'priority' && <span className={c('item-task-metadata-item-value')}>{val}</span>}
        </span>
      );
    });

  return <span className={c('item-task-metadata')}>{data}</span>;
}
