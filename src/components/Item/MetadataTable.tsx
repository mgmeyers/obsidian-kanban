import { Link } from 'obsidian-dataview';
import React from 'react';

import { c } from '../helpers';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { Item, PageData } from '../types';

export interface ItemMetadataProps {
  item: Item;
  isSettingsVisible: boolean;
  searchQuery?: string;
}

export function ItemMetadata({
  item,
  isSettingsVisible,
  searchQuery,
}: ItemMetadataProps) {
  if (isSettingsVisible || !item.data.metadata.fileMetadata) return null;

  return (
    <div className={c('item-metadata-wrapper')}>
      <MetadataTable
        metadata={item.data.metadata.fileMetadata}
        searchQuery={searchQuery}
      />
    </div>
  );
}

interface MetadataValueProps {
  data: PageData;
  searchQuery: string;
}

function getLinkFromObj(v: Link) {
  return `[[${v.path}${v.display ? `|${v.display}` : ''}]]`;
}

function MetadataValue({ data, searchQuery }: MetadataValueProps) {
  if (Array.isArray(data.value)) {
    return (
      <span className={c('meta-value')}>
        {data.value.map((v, i, arr) => {
          const str = `${v}`;
          const link = typeof v === 'object' && getLinkFromObj(v as Link);
          const isMatch = str.toLocaleLowerCase().contains(searchQuery);

          return (
            <>
              {link || data.containsMarkdown ? (
                <MarkdownRenderer
                  className="inline"
                  markdownString={link ? link : str}
                  searchQuery={searchQuery}
                />
              ) : isMatch ? (
                <span className="is-search-match">{str}</span>
              ) : (
                str
              )}
              {i < arr.length - 1 ? <span>{', '}</span> : ''}
            </>
          );
        })}
      </span>
    );
  }

  const str = `${data.value}`;
  const isMatch = str.toLocaleLowerCase().contains(searchQuery);
  const link =
    typeof data.value === 'object' && getLinkFromObj(data.value as Link);

  return (
    <span
      className={`${c('meta-value')} ${
        isMatch && !data.containsMarkdown ? 'is-search-match' : ''
      }`}
    >
      {data.containsMarkdown || !!link ? (
        <MarkdownRenderer
          markdownString={link ? link : str}
          searchQuery={searchQuery}
        />
      ) : (
        str
      )}
    </span>
  );
}

export interface MetadataTableProps {
  metadata: { [k: string]: PageData } | null;
  searchQuery?: string;
}

export const MetadataTable = React.memo(function MetadataTable({
  metadata,
  searchQuery,
}: MetadataTableProps) {
  if (!metadata) return null;

  return (
    <table className={c('meta-table')}>
      <tbody>
        {Object.keys(metadata).map((k) => {
          const data = metadata[k];
          return (
            <tr key={k} className={c('meta-row')}>
              {!data.shouldHideLabel && (
                <td
                  className={`${c('meta-key')} ${
                    (data.label || k).toLocaleLowerCase().contains(searchQuery)
                      ? 'is-search-match'
                      : ''
                  }`}
                  data-key={k}
                >
                  <span>{data.label || k}</span>
                </td>
              )}
              <td
                colSpan={data.shouldHideLabel ? 2 : 1}
                className={c('meta-value-wrapper')}
                data-value={
                  Array.isArray(data.value)
                    ? data.value.join(', ')
                    : `${data.value}`
                }
              >
                {k === 'tags' ? (
                  (data.value as string[]).map((tag, i) => {
                    return (
                      <a
                        href={tag}
                        key={i}
                        className={`tag ${c('item-tag')} ${
                          tag.toLocaleLowerCase().contains(searchQuery)
                            ? 'is-search-match'
                            : ''
                        }`}
                      >
                        <span>{tag[0]}</span>
                        {tag.slice(1)}
                      </a>
                    );
                  })
                ) : (
                  <MetadataValue data={data} searchQuery={searchQuery} />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
});
