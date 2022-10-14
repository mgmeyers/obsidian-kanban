import classcat from 'classcat';
import Mark from 'mark.js';
import Preact from 'preact/compat';

import { renderMarkdown } from '../helpers/renderMarkdown';
import { KanbanContext } from './context';
import { c } from './helpers';

interface MarkdownRendererProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  markdownString: string;
  searchQuery?: string;
}

function appendOrReplaceFirstChild(
  wrapper?: HTMLDivElement,
  child?: HTMLDivElement
) {
  if (!child || !wrapper) return;

  if (wrapper && !wrapper.firstChild) {
    wrapper.appendChild(child);
  } else if (wrapper.firstChild && wrapper.firstChild !== child) {
    wrapper.replaceChild(child, wrapper.firstChild);
  }
}

export const MarkdownRenderer = Preact.memo(function MarkdownRenderer({
  className,
  markdownString,
  searchQuery,
  ...divProps
}: MarkdownRendererProps) {
  const { stateManager } = Preact.useContext(KanbanContext);
  const wrapperRef = Preact.useRef<HTMLDivElement>();
  const contentRef = Preact.useRef<HTMLDivElement>();
  const markRef = Preact.useRef<Mark>();

  Preact.useEffect(() => {
    renderMarkdown(stateManager.getAView(), markdownString)
      .then((el) => {
        contentRef.current = el;
        markRef.current = new Mark(el);

        if (wrapperRef.current) {
          appendOrReplaceFirstChild(wrapperRef.current, el);
        }
      })
      .catch((e) => {
        stateManager.setError(e);
        console.error(e);
      });
  }, [stateManager, markdownString]);

  Preact.useEffect(() => {
    markRef.current?.unmark();

    if (searchQuery && searchQuery.trim()) {
      markRef.current?.mark(searchQuery);
    }
  }, [searchQuery]);

  return (
    <div
      ref={(node) => {
        wrapperRef.current = node;
        appendOrReplaceFirstChild(node, contentRef.current);
      }}
      className={classcat([
        'markdown-preview-view',
        c('markdown-preview-view'),
        className,
      ])}
      {...divProps}
    />
  );
});

interface MarkdownDomRendererProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  dom: HTMLDivElement;
  searchQuery?: string;
}

export const MarkdownDomRenderer = Preact.memo(function MarkdownDomRenderer({
  dom,
  className,
  searchQuery,
  ...divProps
}: MarkdownDomRendererProps) {
  const { stateManager } = Preact.useContext(KanbanContext);

  const contentEl = Preact.useMemo(() => {
    return dom ? (dom.cloneNode(true) as HTMLDivElement) : createDiv();
  }, [dom, stateManager]);

  const marker = Preact.useMemo(() => {
    return new Mark(contentEl);
  }, [contentEl]);

  Preact.useEffect(() => {
    marker.unmark();

    if (searchQuery && searchQuery.trim()) {
      marker.mark(searchQuery);
    }
  }, [marker, searchQuery]);

  return (
    <div
      ref={(node) => {
        appendOrReplaceFirstChild(node, contentEl);
      }}
      className={classcat([
        'markdown-preview-view',
        c('markdown-preview-view'),
        className,
      ])}
      {...divProps}
    />
  );
});
