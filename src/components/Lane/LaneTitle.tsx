import { getLinkpath } from "obsidian";
import React from "react";
import { t } from "src/lang/helpers";
import { ObsidianContext } from "../context";
import { c } from "../helpers";
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
  const { view, filePath } = React.useContext(ObsidianContext);
  const inputRef = React.useRef<HTMLTextAreaElement>();

  const onAction = () => isEditing && setIsEditing(false);

  const autocompleteProps = useAutocompleteInputProps({
    isInputVisible: isEditing,
    onEnter: onAction,
    onEscape: onAction,
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
    const tempEl = view.renderMarkdown(title);
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
            className={`markdown-preview-view ${c("lane-title-text")}`}
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
