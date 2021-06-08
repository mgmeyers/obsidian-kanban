import React from "react";
import { MarkdownRenderer as ObsidianMarkdownRenderer, TFile } from "obsidian";
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
      const tempEl = createDiv();
      ObsidianMarkdownRenderer.renderMarkdown(
        markdownString,
        tempEl,
        filePath,
        view
      );

      tempEl.findAll(".internal-embed").forEach((el) => {
        const src = el.getAttribute("src");
        const target =
          typeof src === "string" &&
          view.app.metadataCache.getFirstLinkpathDest(src, filePath);
        if (target instanceof TFile && target.extension !== "md") {
          el.innerText = "";
          el.createEl(
            "img",
            { attr: { src: view.app.vault.getResourcePath(target) } },
            (img) => {
              if (el.hasAttribute("width"))
                img.setAttribute("width", el.getAttribute("width"));
              if (el.hasAttribute("alt"))
                img.setAttribute("alt", el.getAttribute("alt"));
            }
          );
          el.addClasses(["image-embed", "is-loaded"]);
        }
      });

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
