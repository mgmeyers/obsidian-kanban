import React from "react";
import Mark from "mark.js";
import { ObsidianContext } from "./context";

interface MarkdownRendererProps {
  className?: string;
  markdownString: string;
  searchQuery?: string;
}

export const MarkdownRenderer = React.memo(
  ({ className, markdownString, searchQuery }: MarkdownRendererProps) => {
    const { view, filePath } = React.useContext(ObsidianContext);
    const markdownContent = React.useMemo(() => {
      const tempEl = view.renderMarkdown(markdownString);
      if (searchQuery) {
        new Mark(tempEl).mark(searchQuery);
      }

      return {
        innerHTML: { __html: tempEl.innerHTML.toString() },
      };
    }, [markdownString, filePath, view, searchQuery]);

    return (
      <div
        className={`markdown-preview-view ${className || ""}`}
        dangerouslySetInnerHTML={markdownContent.innerHTML}
      />
    );
  }
);
