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
import { c } from '../helpers';
import { Item } from '../types';
import { MetadataValue } from './MetadataTable';

interface InlineMetadataProps {
  item: Item;
  stateManager: StateManager;
}

export function InlineMetadata({ item, stateManager }: InlineMetadataProps) {
  const search = useContext(SearchContext);
  const moveMetadata = stateManager.useSetting('move-inline-metadata');
  const moveTaskMetadata = stateManager.useSetting('move-task-metadata');
  const { inlineMetadata } = item.data.metadata;

  if (!inlineMetadata || (!moveMetadata && !moveTaskMetadata)) return null;
  const dataview = getDataviewPlugin();

  return (
    <span className={c('item-task-metadata')}>
      {inlineMetadata.map((m, i) => {
        const isTaskMetadata = taskFields.has(m.key);
        if (!moveTaskMetadata && isTaskMetadata) return null;
        if (!moveMetadata && !isTaskMetadata) return null;

        const isEmoji = m.wrapping === 'emoji-shorthand';
        const val = dataview?.api?.parse(m.value) ?? m.value;
        const isEmojiPriority = isEmoji && m.key === 'priority';
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
                  data={{
                    value: val,
                    label: label,
                    metadataKey: m.key,
                    shouldHideLabel: false,
                    containsMarkdown: false,
                  }}
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
