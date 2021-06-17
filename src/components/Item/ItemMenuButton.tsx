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
    return (
      <div className={c("item-postfix-button-wrapper")}>
        {isEditing ? (
          <button
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