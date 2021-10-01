import classcat from 'classcat';
import Mark from 'mark.js';
import React from 'react';

import { renderMarkdown } from '../helpers/renderMarkdown';
import { KanbanContext } from './context';
import { c } from './helpers';

interface MarkdownRendererProps extends React.HTMLProps<HTMLDivElement> {
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

export const MarkdownRenderer = React.memo(function MarkdownRenderer({
  className,
  markdownString,
  searchQuery,
  ...divProps
}: MarkdownRendererProps) {
  const { stateManager } = React.useContext(KanbanContext);
  const wrapperRef = React.useRef<HTMLDivElement>();
  const contentRef = React.useRef<HTMLDivElement>();
  const markRef = React.useRef<Mark>();

  React.useEffect(() => {
    renderMarkdown(stateManager.getAView(), markdownString).then((el) => {
      contentRef.current = el;
      markRef.current = new Mark(el);

      if (wrapperRef.current) {
        appendOrReplaceFirstChild(wrapperRef.current, el);
      }
    });
  }, [stateManager, markdownString]);

  React.useEffect(() => {
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

interface MarkdownDomRendererProps extends React.HTMLProps<HTMLDivElement> {
  className?: string;
  dom: HTMLDivElement;
  searchQuery?: string;
}

export const MarkdownDomRenderer = React.memo(function MarkdownDomRenderer({
  dom,
  className,
  searchQuery,
  ...divProps
}: MarkdownDomRendererProps) {
  const { stateManager } = React.useContext(KanbanContext);

  const contentEl = React.useMemo(() => {
    return dom.cloneNode(true) as HTMLDivElement;
  }, [dom, stateManager]);

  const marker = React.useMemo(() => {
    return new Mark(contentEl);
  }, [contentEl]);

  React.useEffect(() => {
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
