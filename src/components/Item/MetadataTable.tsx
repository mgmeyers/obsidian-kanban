import { TFile, moment } from 'obsidian';
import Preact from 'preact/compat';

import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';

import { KanbanContext } from '../context';
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
        order={item.data.metadata.fileMetadataOrder}
        searchQuery={searchQuery}
      />
    </div>
  );
}

interface MetadataValueProps {
  data: PageData;
  searchQuery: string;
}

function getDateFromObj(v: any, stateManager: StateManager) {
  if (v.ts) {
    const dateFormat = stateManager.getSetting('date-display-format');
    return moment(v.ts).format(dateFormat);
  }

  return null;
}

function getLinkFromObj(v: any, view: KanbanView) {
  if (!v.path) return null;

  const file = app.vault.getAbstractFileByPath(v.path);

  if (file && file instanceof TFile) {
    const link = app.fileManager.generateMarkdownLink(
      file,
      view.file.path,
      v.subpath,
      v.display
    );

    return `${v.embed && link[0] !== '!' ? '!' : ''}${link}`;
  }

  return `${v.embed ? '!' : ''}[[${v.path}${
    v.display ? `|${v.display}` : ''
  }]]`;
}

function MetadataValue({ data, searchQuery }: MetadataValueProps) {
  const { view, stateManager } = Preact.useContext(KanbanContext);

  if (Array.isArray(data.value)) {
    return (
      <span className={c('meta-value')}>
        {data.value.map((v, i, arr) => {
          const str = `${v}`;
          const link =
            typeof v === 'object' &&
            !Array.isArray(v) &&
            (getDateFromObj(v, stateManager) || getLinkFromObj(v, view));
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
    typeof data.value === 'object' &&
    (getDateFromObj(data.value, stateManager) ||
      getLinkFromObj(data.value, view));

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
  order?: string[];
  searchQuery?: string;
}

export const MetadataTable = Preact.memo(function MetadataTable({
  metadata,
  order,
  searchQuery,
}: MetadataTableProps) {
  if (!metadata || !order || order.length === 0) return null;

  return (
    <table className={c('meta-table')}>
      <tbody>
        {order.map((k) => {
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
