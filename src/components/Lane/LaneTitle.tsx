import { getLinkpath, MarkdownRenderer } from "obsidian";
import React from "react";
import { t } from "src/lang/helpers";
import { ObsidianContext } from "../context";
import { c, useIMEInputProps } from "../helpers";
import { useAutocompleteInputProps } from "../Item/autocomplete";

export interface LaneTitleProps {
  itemCount: number;
  title: string;
  isEditing: boolean;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  cancelEditing: () => void;
}

export function LaneTitle({
  itemCount,
  isEditing,
  title,
  onChange,
  cancelEditing,
}: LaneTitleProps) {
  const { view, filePath } = React.useContext(ObsidianContext);
  const inputRef = React.useRef<HTMLTextAreaElement>();

  const autocompleteProps = useAutocompleteInputProps({
    isInputVisible: isEditing,
    onEnter: cancelEditing,
    onEscape: cancelEditing,
    excludeDatePicker: true,
  });

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      const input = inputRef.current;

      inputRef.current.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }
  }, [isEditing]);

  const markdownContent = React.useMemo(() => {
    const tempEl = createDiv();
    MarkdownRenderer.renderMarkdown(title, tempEl, filePath, view);

    return {
      innerHTML: { __html: tempEl.innerHTML.toString() },
    };
  }, [title, filePath, view]);

  return (
    <div className={c("lane-title")}>
      {isEditing ? (
        <div data-replicated-value={title} className={c("grow-wrap")}>
          <textarea
            ref={inputRef}
            rows={1}
            value={title}
            className={c("lane-input")}
            placeholder={t("Enter list title...")}
            onChange={onChange}
            {...autocompleteProps}
          />
        </div>
      ) : (
        <>
          <span
            className={c("lane-title-text")}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();

              const internalLinkPath =
                e.target instanceof HTMLAnchorElement &&
                e.target.hasClass("internal-link")
                  ? e.target.dataset.href
                  : undefined;

              if (internalLinkPath) {
                // @ts-ignore
                view.app.workspace.onLinkContextMenu(
                  e,
                  getLinkpath(internalLinkPath),
                  view.file.path
                );
              }
            }}
            dangerouslySetInnerHTML={markdownContent.innerHTML}
          ></span>
          <span className={c("lane-title-count")}>{itemCount}</span>
        </>
      )}
    </div>
  );
}
