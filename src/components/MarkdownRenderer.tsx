import React from "react";
import Mark from "mark.js";
import { ObsidianContext } from "./context";

interface MarkdownRendererProps {
  className?: string;
  markdownString?: string;
  dom?: HTMLDivElement;
  searchQuery?: string;
}

export const MarkdownRenderer = React.memo(
  ({ className, dom, markdownString, searchQuery }: MarkdownRendererProps) => {
    const { view } = React.useContext(ObsidianContext);
    const markdownContent = React.useMemo(() => {
      let tempEl: HTMLDivElement = dom || view.renderMarkdown(markdownString);
      if (searchQuery) {
        tempEl = tempEl.cloneNode(true) as HTMLDivElement;
        new Mark(tempEl as HTMLDivElement).mark(searchQuery);
      }

      return {
        innerHTML: { __html: tempEl.innerHTML.toString() },
      };
    }, [dom, markdownString, view, searchQuery]);

    return (
      <div
        className={`markdown-preview-view ${className || ""}`}
        dangerouslySetInnerHTML={markdownContent.innerHTML}
      />
    );
  }
);
