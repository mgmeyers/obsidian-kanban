import React from "react";
import Mark from "mark.js";
import { KanbanContext } from "./context";
import { c } from "./helpers";

interface MarkdownRendererProps {
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
}: MarkdownRendererProps) {
  const { view } = React.useContext(KanbanContext);
  const contentEl = React.useMemo(() => {
    return (
      (dom?.cloneNode(true) as HTMLDivElement) ||
      view?.renderMarkdown(markdownString)
    );
  }, [dom, view, markdownString]);

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
      className={`markdown-preview-view ${c("markdown-preview-view")} ${
        className || ""
      }`}
    />
  );
});
