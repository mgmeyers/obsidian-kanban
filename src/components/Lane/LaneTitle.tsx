import { getLinkpath } from "obsidian";
import React from "react";
import { t } from "src/lang/helpers";
import { KanbanContext } from "../context";
import { c } from "../helpers";
import { renderMarkdown } from "../helpers/renderMarkdown";
import { useAutocompleteInputProps } from "../Item/autocomplete";

export interface LaneTitleProps {
  itemCount: number;
  title: string;
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
}

export function LaneTitle({
  itemCount,
  isEditing,
  setIsEditing,
  title,
  onChange,
}: LaneTitleProps) {
  const { stateManager, filePath } = React.useContext(KanbanContext);
  const inputRef = React.useRef<HTMLTextAreaElement>();

  const onEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.shiftKey) {
      e.preventDefault();
      isEditing && setIsEditing(false);
    }
  };

  const onEscape = () => {
    isEditing && setIsEditing(false);
  };

  const autocompleteProps = useAutocompleteInputProps({
    isInputVisible: isEditing,
    onEnter,
    onEscape,
    excludeDatePicker: true,
  });

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      const input = inputRef.current;

      inputRef.current.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }
  }, [isEditing]);

  // TODO: use markdown renderer component?
  const markdownContent = React.useMemo(() => {
    const tempEl = renderMarkdown(stateManager.getAView(), title);
    return {
      innerHTML: { __html: tempEl.innerHTML.toString() },
    };
  }, [title, filePath, stateManager]);

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
            className={`markdown-preview-view ${c("markdown-preview-view")} ${c(
              "lane-title-text"
            )}`}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();

              const internalLinkPath =
                e.target instanceof HTMLAnchorElement &&
                e.target.hasClass("internal-link")
                  ? e.target.dataset.href
                  : undefined;

              if (internalLinkPath) {
                (stateManager.app.workspace as any).onLinkContextMenu(
                  e,
                  getLinkpath(internalLinkPath),
                  stateManager.file.path
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
