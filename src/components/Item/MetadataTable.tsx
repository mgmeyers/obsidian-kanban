import classcat from 'classcat';
import { TFile, moment } from 'obsidian';
import { ComponentChild } from 'preact';
import { memo, useContext } from 'preact/compat';
import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';

import { StaticMarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer';
import { KanbanContext } from '../context';
import { c } from '../helpers';
import { Item, PageData } from '../types';
import { Tags } from './ItemContent';

export interface ItemMetadataProps {
  item: Item;
  searchQuery?: string;
}

export function ItemMetadata({ item, searchQuery }: ItemMetadataProps) {
  if (!item.data.metadata.fileMetadata) return null;

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
  searchQuery?: string;
}

export function getDateFromObj(v: any, stateManager: StateManager) {
  let m: moment.Moment;

  if (v.ts) {
    m = moment(v.ts);
  } else if (moment.isMoment(v)) {
    m = v;
  } else if (v instanceof Date) {
    m = moment(v);
  }

  if (m) {
    const dateFormat = stateManager.getSetting(
      m.hours() === 0 ? 'date-display-format' : 'date-time-display-format'
    );

    return m.format(dateFormat);
  }

  return null;
}

export function getLinkFromObj(v: any, view: KanbanView) {
  if (typeof v !== 'object' || !v.path) return null;

  const file = app.vault.getAbstractFileByPath(v.path);
  if (file && file instanceof TFile) {
    const link = app.fileManager.generateMarkdownLink(file, view.file.path, v.subpath, v.display);
    return `${v.embed && link[0] !== '!' ? '!' : ''}${link}`;
  }

  return `${v.embed ? '!' : ''}[[${v.path}${v.display ? `|${v.display}` : ''}]]`;
}

function getDate(v: any) {
  if (moment.isMoment(v)) return v;
  if (v.ts) return moment(v.ts);
  if (v instanceof Date) return moment(v);
  return null;
}

export function anyToString(v: any, stateManager: StateManager): string {
  if (v.value) v = v.value;
  if (typeof v === 'string') return v;
  if (v instanceof TFile) return v.path;
  const date = getDate(v);
  if (date) return getDateFromObj(date, stateManager);
  if (typeof v === 'object' && v.path) return v.display || v.path;
  if (Array.isArray(v)) {
    return v.map((v2) => anyToString(v2, stateManager)).join(' ');
  }
  return `${v}`;
}

export function pageDataToString(data: PageData, stateManager: StateManager): string {
  return anyToString(data.value, stateManager);
}

export function MetadataValue({ data, searchQuery }: MetadataValueProps) {
  const { view, stateManager, getDateColor } = useContext(KanbanContext);

  const renderChild = (v: any, sep?: string) => {
    const link = getLinkFromObj(v, view);
    const date = getDate(v);
    const str = anyToString(v, stateManager);
    const isMatch = searchQuery && str.toLocaleLowerCase().contains(searchQuery);

    let content: ComponentChild;
    if (link || data.containsMarkdown) {
      content = (
        <StaticMarkdownRenderer
          className="inline"
          markdownString={link ? link : str}
          searchQuery={searchQuery}
        />
      );
    } else if (date) {
      const dateColor = getDateColor(date);
      content = (
        <span
          className={classcat({
            [c('date')]: true,
            'is-search-match': isMatch,
            'has-background': dateColor?.backgroundColor,
          })}
          style={
            dateColor && {
              '--date-color': dateColor.color,
              '--date-background-color': dateColor.backgroundColor,
            }
          }
        >
          <span className={c('item-metadata-date')}>{str}</span>
        </span>
      );
    } else if (isMatch) {
      content = <span className="is-search-match">{str}</span>;
    } else {
      content = str;
    }

    return (
      <>
        {content}
        {sep ? <span>{sep}</span> : null}
      </>
    );
  };

  if (Array.isArray(data.value)) {
    return (
      <span className={classcat([c('meta-value'), 'mod-array'])}>
        {data.value.map((v, i, arr) => {
          return renderChild(v, i < arr.length - 1 ? ', ' : undefined);
        })}
      </span>
    );
  }

  return <span className={classcat([c('meta-value')])}>{renderChild(data.value)}</span>;
}

export interface MetadataTableProps {
  metadata: { [k: string]: PageData } | null;
  order?: string[];
  searchQuery?: string;
}

export const MetadataTable = memo(function MetadataTable({
  metadata,
  order,
  searchQuery,
}: MetadataTableProps) {
  const { stateManager } = useContext(KanbanContext);

  if (!metadata || !order || order.length === 0) return null;

  return (
    <table className={c('meta-table')}>
      <tbody>
        {order.map((k) => {
          const data = metadata[k];
          const isSearchMatch = (data.label || k).toLocaleLowerCase().contains(searchQuery);
          return (
            <tr key={k} className={c('meta-row')}>
              {!data.shouldHideLabel && (
                <td
                  className={classcat([
                    c('meta-key'),
                    {
                      'is-search-match': isSearchMatch,
                    },
                  ])}
                  data-key={k}
                >
                  <span>{data.label || k}</span>
                </td>
              )}
              <td
                colSpan={data.shouldHideLabel ? 2 : 1}
                className={c('meta-value-wrapper')}
                data-value={pageDataToString(data, stateManager)}
              >
                {k === 'tags' ? (
                  <Tags searchQuery={searchQuery} tags={data.value as string[]} isDisplay={false} />
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
