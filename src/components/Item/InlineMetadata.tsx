import classcat from 'classcat';
import { useContext } from 'preact/compat';
import { StateManager } from 'src/StateManager';
import {
  getDataviewPlugin,
  lableToIcon,
  lableToName,
  taskFields,
} from 'src/parsers/helpers/inlineMetadata';

import { SearchContext } from '../context';
import { c, parseMetadataWithOptions } from '../helpers';
import { Item } from '../types';
import { MetadataValue } from './MetadataTable';

interface InlineMetadataProps {
  item: Item;
  stateManager: StateManager;
}

export function InlineMetadata({ item, stateManager }: InlineMetadataProps) {
  const search = useContext(SearchContext);
  const metaKeys = stateManager.getSetting('metadata-keys');
  const showInlineMetadata = stateManager.useSetting('inline-metadata-position') === 'footer';
  const showTaskMetadata = stateManager.useSetting('move-task-metadata');
  const { inlineMetadata } = item.data.metadata;

  if (!inlineMetadata || (!showInlineMetadata && !showTaskMetadata)) return null;

  const dataview = getDataviewPlugin();

  return (
    <span className={c('item-task-metadata')}>
      {inlineMetadata.map((m, i) => {
        const data = parseMetadataWithOptions(m, metaKeys);
        const { metadataKey: key, value, label: explicitLabel } = data;
        const isTaskMetadata = taskFields.has(key);

        if (!showTaskMetadata && isTaskMetadata) return null;
        if (!showInlineMetadata && !isTaskMetadata) return null;

        const isEmoji = m.wrapping === 'emoji-shorthand';
        const val = dataview?.api?.parse(value) ?? value;
        const isEmojiPriority = isEmoji && key === 'priority';
        const isDate = !!val?.ts;
        const classNameSlug = key.replace(/[^a-zA-Z0-9_]/g, '-');

        let label = '';

        if (explicitLabel && !isTaskMetadata) {
          label = explicitLabel;
        } else {
          label = isEmoji ? lableToIcon(key, value) : lableToName(key);
        }

        if (!isEmoji) label += ': ';

        return (
          <span
            className={classcat([
              c('item-task-inline-metadata-item'),
              c(`inline-metadata__${classNameSlug}`),
              {
                'is-task-metadata': isTaskMetadata,
                'is-emoji': isEmoji,
                'is-date': isDate,
              },
            ])}
            key={i}
          >
            {!isDate && <span className={c('item-task-inline-metadata-item-key')}>{label}</span>}
            {!isEmojiPriority && (
              <span className={c('item-task-inline-metadata-item-value')}>
                <MetadataValue
                  searchQuery={search?.query}
                  dateLabel={isDate ? label : undefined}
                  data={data}
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
