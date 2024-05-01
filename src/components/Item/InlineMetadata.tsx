import classcat from 'classcat';
import { useContext } from 'preact/compat';
import { StateManager } from 'src/StateManager';
import {
  InlineField,
  getDataviewPlugin,
  lableToIcon,
  lableToName,
  taskFields,
} from 'src/parsers/helpers/inlineMetadata';

import { SearchContext } from '../context';
import { c, parseMetadataWithOptions } from '../helpers';
import { DataKey, Item, PageData } from '../types';
import { MetadataValue } from './MetadataTable';

interface InlineMetadataProps {
  item: Item;
  stateManager: StateManager;
}

export function InlineMetadata({ item, stateManager }: InlineMetadataProps) {
  const search = useContext(SearchContext);
  const metaKeys = stateManager.getSetting('metadata-keys');
  const displayMetadataInFooter = stateManager.useSetting('inline-metadata-position') === 'footer';
  const moveTaskMetadata = stateManager.useSetting('move-task-metadata');
  const { inlineMetadata } = item.data.metadata;

  if (!inlineMetadata || (!displayMetadataInFooter && !moveTaskMetadata)) return null;

  const dataview = getDataviewPlugin();

  return (
    <span className={c('item-task-metadata')}>
      {inlineMetadata.map((m, i) => {
        const data = parseMetadataWithOptions(m, metaKeys);
        const { metadataKey: key, label: metaLabel, value } = data;
        const isTaskMetadata = taskFields.has(key);
        if (!moveTaskMetadata && isTaskMetadata) return null;
        if (!displayMetadataInFooter && !isTaskMetadata) return null;

        const isEmoji = m.wrapping === 'emoji-shorthand';
        const val = dataview?.api?.parse(value) ?? value;
        const isEmojiPriority = isEmoji && key === 'priority';
        const isDate = !!val?.ts;

        let label = isEmoji ? lableToIcon(m.key, m.value) : lableToName(m.key);
        const slug = m.key.replace(/[^a-zA-Z0-9_]/g, '-');

        if (!isEmoji) label += ': ';

        return (
          <span
            className={classcat([
              c('item-task-inline-metadata-item'),
              c(`inline-metadata__${slug}`),
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
