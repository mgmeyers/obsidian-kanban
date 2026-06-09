import { moment } from 'obsidian';
import { useCallback, useContext, useMemo } from 'preact/compat';
import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { Path } from 'src/dnd/types';
import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c, useGetDateColorFn } from '../helpers';
import { Item } from '../types';
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
} from './helpers';

function getDaysUntilLabel(date: moment.Moment): string {
  const today = moment().startOf('day');
  const diff = date.clone().startOf('day').diff(today, 'days');

  if (diff === 0) return t('today');
  if (diff === 1) return `1 ${t('day')}`;
  if (diff === -1) return `-1 ${t('day')}`;
  return `${diff} ${diff > 0 ? t('days') : t('days')}`;
}

interface DateBubbleProps {
  item: Item;
  isStatic?: boolean;
  explicitPath?: Path;
}

export function DateBubble({ item, isStatic, explicitPath }: DateBubbleProps) {
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const path = explicitPath || useNestedEntityPath();
  const getDateColor = useGetDateColorFn(stateManager);
  const dateDisplayFormat = stateManager.useSetting('date-display-format');

  const hasDate = !!item.data.metadata.date;
  const targetDate = item.data.metadata.time ?? item.data.metadata.date;

  const dateColor = useMemo(() => {
    if (!targetDate) return null;
    return getDateColor(targetDate);
  }, [targetDate, getDateColor]);

  const displayStr = targetDate ? targetDate.format(dateDisplayFormat) : null;
  const daysLabel = targetDate ? getDaysUntilLabel(targetDate) : null;

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (isStatic) return;
      e.stopPropagation();
      constructDatePicker(
        e.view,
        stateManager,
        { x: e.clientX, y: e.clientY },
        constructMenuDatePickerOnChange({
          stateManager,
          boardModifiers,
          item,
          hasDate,
          path,
        }),
        item.data.metadata.date?.toDate()
      );
    },
    [stateManager, boardModifiers, item, hasDate, path, isStatic]
  );

  const style = dateColor
    ? {
        '--date-color': dateColor.color,
        '--date-background-color': dateColor.backgroundColor,
      }
    : undefined;

  return (
    <span
      className={`${c('item-date-bubble')} ${hasDate ? 'has-date' : ''} ${dateColor?.backgroundColor ? 'has-background' : ''}`}
      style={style}
      onClick={handleClick}
      aria-label={hasDate ? t('Change date') : t('Add date')}
    >
      {hasDate ? (
        <>
          <span className={c('item-date-bubble-date')}>{displayStr}</span>
          <span className={c('item-date-bubble-countdown')}>{daysLabel}</span>
        </>
      ) : (
        <span className={c('item-date-bubble-empty')}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
      )}
    </span>
  );
}
