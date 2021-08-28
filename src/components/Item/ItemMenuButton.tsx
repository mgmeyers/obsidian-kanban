import React from "react";
import { c } from "../helpers";
import { Icon } from "../Icon/Icon";
import { t } from "src/lang/helpers";

interface ItemMenuButtonProps {
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  showMenu: (e: MouseEvent, internalLinkPath?: string) => void;
}

export const ItemMenuButton = React.memo(
  ({ isEditing, setIsEditing, showMenu }: ItemMenuButtonProps) => {
    const ignoreAttr = React.useMemo(() => {
      if (isEditing) {
        return {
          "data-ignore-drag": true,
        };
      }

      return {};
    }, [isEditing]);

    return (
      <div {...ignoreAttr} className={c("item-postfix-button-wrapper")}>
        {isEditing ? (
          <button
            data-ignore-drag={true}
            onPointerDown={(e) => {
              e.preventDefault();
            }}
            onClick={() => {
              setIsEditing(false);
            }}
            className={`${c("item-postfix-button")} is-enabled`}
            aria-label={t("Cancel")}
          >
            <Icon name="cross" />
          </button>
        ) : (
          <button
            data-ignore-drag={true}
            onPointerDown={(e) => e.preventDefault()}
            onClick={
              showMenu as unknown as React.MouseEventHandler<HTMLButtonElement>
            }
            className={c("item-postfix-button")}
            aria-label={t("More options")}
          >
            <Icon name="vertical-three-dots" />
          </button>
        )}
      </div>
    );
  }
);
