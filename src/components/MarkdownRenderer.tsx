import classcat from 'classcat';
import Mark from 'mark.js';
import React from 'react';

import { KanbanContext } from './context';
import { c } from './helpers';
import { renderMarkdown } from './helpers/renderMarkdown';

interface MarkdownRendererProps extends React.HTMLProps<HTMLDivElement> {
  className?: string;
  markdownString?: string;
  dom?: HTMLDivElement;
  searchQuery?: string;
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({
  dom,
  className,
  markdownString,
  searchQuery,
  ...divProps
}: MarkdownRendererProps) {
  const { stateManager } = React.useContext(KanbanContext);
  const contentEl = React.useMemo(() => {
    const renderedMarkdown =
      (dom?.cloneNode(true) as HTMLDivElement) ||
      renderMarkdown(stateManager.getAView(), markdownString);

    const checkboxes = renderedMarkdown.querySelectorAll(
      '.task-list-item-checkbox'
    );

    checkboxes.forEach((el, i) => {
      (el as HTMLElement).dataset.checkboxIndex = i.toString();
    });

    return renderedMarkdown;
  }, [dom, stateManager, markdownString]);

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
        if (node && !node.firstChild) {
          node.appendChild(contentEl);
        } else if (node?.firstChild && node.firstChild !== contentEl) {
          node.replaceChild(contentEl, node.firstChild);
        }
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
