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
import { c } from '../helpers';
import { DataKey, Item, PageData } from '../types';
import { MetadataValue } from './MetadataTable';

interface InlineMetadataProps {
  item: Item;
  stateManager: StateManager;
}

function parseMetadataWithOptions(data: InlineField, metadataKeys: DataKey[]): PageData {
  const options = metadataKeys.find((opts) => opts.metadataKey === data.key);

  return options
    ? {
        ...options,
        value: data.value,
      }
    : {
        containsMarkdown: false,
        label: data.key,
        metadataKey: data.key,
        shouldHideLabel: false,
        value: data.value,
      };
}

export function InlineMetadata({ item, stateManager }: InlineMetadataProps) {
  const search = useContext(SearchContext);
  const metaKeys = stateManager.getSetting('metadata-keys');
  const moveMetadata = stateManager.useSetting('move-inline-metadata');
  const moveTaskMetadata = stateManager.useSetting('move-task-metadata');
  const { inlineMetadata } = item.data.metadata;

  if (!inlineMetadata || (!moveMetadata && !moveTaskMetadata)) return null;
  const dataview = getDataviewPlugin();

  return (
    <span className={c('item-task-metadata')}>
      {inlineMetadata.map((m, i) => {
        const { metadataKey: key, label: metaLabel, value } = parseMetadataWithOptions(m, metaKeys);
        const isTaskMetadata = taskFields.has(key);
        if (!moveTaskMetadata && isTaskMetadata) return null;
        if (!moveMetadata && !isTaskMetadata) return null;

        const isEmoji = m.wrapping === 'emoji-shorthand';
        const val = dataview?.api?.parse(value) ?? value;
        const isEmojiPriority = isEmoji && key === 'priority';
        const isDate = !!val?.ts;
        let label = isEmoji ? lableToIcon(metaLabel, value) : lableToName(metaLabel);

        if (!isEmoji) label += ': ';

        return (
          <span
            className={classcat([
              c('item-task-inline-metadata-item'),
              key.replace(/[^a-z0-9]/g, '-'),
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
                    metadataKey: key,
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
