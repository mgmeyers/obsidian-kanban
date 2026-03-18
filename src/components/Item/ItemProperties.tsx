import { memo, useContext } from 'preact/compat';
import { StateManager } from 'src/StateManager';
import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c } from '../helpers';
import { Item } from '../types';

interface ItemPropertiesProps {
  item: Item;
  laneTitle?: string;
  searchQuery?: string;
}

export const ItemProperties = memo(function ItemProperties({
  item,
  laneTitle,
  searchQuery,
}: ItemPropertiesProps) {
  const { stateManager } = useContext(KanbanContext);

  const showCreated = stateManager.useSetting('show-created-date') !== false;
  const showModified = stateManager.useSetting('show-modified-date') !== false;
  const showStatus = !!stateManager.useSetting('show-status-property');
  const showTags = stateManager.useSetting('show-tags-property') !== false;

  const { createdDate, modifiedDate, tags } = item.data.metadata;
  const createdDateDisplay = createdDate?.split(' ')[0];
  const modifiedDateDisplay = modifiedDate?.split(' ')[0];

  const hasAnyProperty =
    (showCreated && createdDateDisplay) ||
    (showModified && modifiedDateDisplay) ||
    (showStatus && laneTitle) ||
    (showTags && tags?.length);

  if (!hasAnyProperty) return null;

  return (
    <div className={c('item-properties')}>
      {showStatus && laneTitle && (
        <PropertyBadge
          icon="●"
          label={t('Status')}
          value={laneTitle}
          className={c('item-property-status')}
          searchQuery={searchQuery}
        />
      )}
      {showCreated && createdDateDisplay && (
        <PropertyBadge
          icon="➕"
          label={t('Created date')}
          value={createdDateDisplay}
          className={c('item-property-created')}
          searchQuery={searchQuery}
        />
      )}
      {showModified && modifiedDateDisplay && (
        <PropertyBadge
          icon="✏️"
          label={t('Modified date')}
          value={modifiedDateDisplay}
          className={c('item-property-modified')}
          searchQuery={searchQuery}
        />
      )}
      {showTags && tags?.length > 0 && (
        <div className={c('item-property-tags')}>
          <span className={c('item-property-icon')}>#</span>
          {tags.map((tag, i) => (
            <span key={i} className={c('item-property-tag')}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

interface PropertyBadgeProps {
  icon: string;
  label: string;
  value: string;
  className?: string;
  searchQuery?: string;
}

function PropertyBadge({ icon, label, value, className, searchQuery }: PropertyBadgeProps) {
  const isMatch = searchQuery && value.toLocaleLowerCase().contains(searchQuery);
  return (
    <span className={`${c('item-property')} ${className || ''}`} aria-label={label}>
      <span className={c('item-property-icon')}>{icon}</span>
      <span className={`${c('item-property-value')} ${isMatch ? 'is-search-match' : ''}`}>
        {value}
      </span>
    </span>
  );
}
