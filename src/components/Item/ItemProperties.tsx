import { memo, useContext } from 'preact/compat';
import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c } from '../helpers';
import { Item } from '../types';

interface ItemPropertiesProps {
  item: Item;
  laneTitle?: string;
}

export const ItemProperties = memo(function ItemProperties({
  item,
  laneTitle,
}: ItemPropertiesProps) {
  const { stateManager } = useContext(KanbanContext);

  const showCreated = stateManager.useSetting('show-created-date') !== false;
  const showModified = stateManager.useSetting('show-modified-date') !== false;
  const showStatus = !!stateManager.useSetting('show-status-property');

  const { createdDate, modifiedDate } = item.data.metadata;
  const createdDateDisplay = createdDate?.split(' ')[0];
  const modifiedDateDisplay = modifiedDate?.split(' ')[0];

  const hasAnyProperty =
    showCreated || showModified || (showStatus && laneTitle);

  if (!hasAnyProperty) return null;

  return (
    <div className={c('item-properties')}>
      {showStatus && laneTitle && (
        <PropertyRow icon="●" label={t('Status')}>
          <span className={c('item-property-status-value')}>{laneTitle}</span>
        </PropertyRow>
      )}
      {showCreated && (
        <PropertyRow icon="➕" label={t('Created date')}>
          <span className={c('item-property-value')}>{createdDateDisplay || '—'}</span>
        </PropertyRow>
      )}
      {showModified && (
        <PropertyRow icon="✏️" label={t('Modified date')}>
          <span className={c('item-property-value')}>{modifiedDateDisplay || '—'}</span>
        </PropertyRow>
      )}
    </div>
  );
});

function PropertyRow({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: any;
}) {
  return (
    <div className={c('item-property-row')}>
      <span className={c('item-property-row-label')}>
        <span className={c('item-property-icon')}>{icon}</span>
        {label}
      </span>
      <span className={c('item-property-row-value')}>{children}</span>
    </div>
  );
}
