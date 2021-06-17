import React from "react";
import {
  DraggableProvided,
  DraggableStateSnapshot,
} from "react-beautiful-dnd";

import { Item } from "../types";
import { c, noop } from "../helpers";
import { getItemClassModifiers } from "./helpers";
import { KanbanContext, SearchContext } from "../context";
import { ItemContent, ItemMetadata } from "./ItemContent";
import { useItemMenu } from "./ItemMenu";
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
  constructMenuTimePickerOnChange,
  constructTimePicker,
} from "./helpers";
import { ItemCheckbox } from "./ItemCheckbox";
import { ItemMenuButton } from "./ItemMenuButton";
import { KanbanView } from "src/KanbanView";
import { BoardModifiers } from "../helpers/boardModifiers";

interface UseItemContentEventsParams {
  view: KanbanView;
  boardModifiers: BoardModifiers;
  laneIndex: number;
  itemIndex: number;
  item: Item;
}

function useItemContentEvents({
  boardModifiers,
  laneIndex,
  itemIndex,
  item,
  view,
}: UseItemContentEventsParams) {
  return React.useMemo(() => {
    const onContentChange: React.ChangeEventHandler<HTMLTextAreaElement> = (
      e
    ) => {
      const titleRaw = e.target.value.replace(/[\r\n]+/g, " ");
      boardModifiers.updateItem(
        laneIndex,
        itemIndex,
        view.parser.updateItem(item, titleRaw)
      );
    };

    const onEditDate: React.MouseEventHandler = (e) => {
      constructDatePicker(
        { x: e.clientX, y: e.clientY },
        constructMenuDatePickerOnChange({
          view,
          boardModifiers,
          item,
          hasDate: true,
          laneIndex,
          itemIndex,
        }),
        item.metadata.date?.toDate()
      );
    };

    const onEditTime: React.MouseEventHandler = (e) => {
      constructTimePicker(
        view,
        { x: e.clientX, y: e.clientY },
        constructMenuTimePickerOnChange({
          view,
          boardModifiers,
          item,
          hasTime: true,
          laneIndex,
          itemIndex,
        }),
        item.metadata.time
      );
    };

    return {
      onContentChange,
      onEditDate,
      onEditTime,
    };
  }, [boardModifiers, laneIndex, itemIndex, item, view]);
}

export interface DraggableItemProps {
  item: Item;
  itemIndex: number;
  shouldMarkItemsComplete: boolean;
  laneIndex: number;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
}

interface GhostItemProps {
  shouldMarkItemsComplete: boolean;
  item: Item;
}

export function GhostItem({ item, shouldMarkItemsComplete }: GhostItemProps) {
  const classModifiers = getItemClassModifiers(item);
  const { view, boardModifiers } = React.useContext(KanbanContext);

  return (
    <div className={`${c("item")} ${classModifiers.join(" ")}`}>
      <div className={c("item-content-wrapper")}>
        <div className={c("item-title-wrapper")}>
          <ItemCheckbox
            item={item}
            shouldMarkItemsComplete={shouldMarkItemsComplete}
            boardModifiers={boardModifiers}
            view={view}
          />
          <ItemContent isSettingsVisible={false} item={item} />
          <ItemMenuButton
            isEditing={false}
            setIsEditing={noop}
            showMenu={noop}
          />
        </div>
        <ItemMetadata isSettingsVisible={false} item={item} />
      </div>
    </div>
  );
}

export const DraggableItem = React.memo(function DraggableItem({
  item,
  itemIndex,
  laneIndex,
  shouldMarkItemsComplete,
  snapshot,
  provided,
}: DraggableItemProps) {
  const { view, boardModifiers } = React.useContext(KanbanContext);
  const searchQuery = React.useContext(SearchContext);
  const [isEditing, setIsEditing] = React.useState(false);

  const isMatch = searchQuery ? item.titleSearch.contains(searchQuery) : false;
  const classModifiers: string[] = getItemClassModifiers(item);

  if (snapshot.isDragging) classModifiers.push("is-dragging");

  if (searchQuery) {
    if (isMatch) {
      classModifiers.push("is-search-hit");
    } else {
      classModifiers.push("is-search-miss");
    }
  }

  const showItemMenu = useItemMenu({
    boardModifiers,
    item,
    itemIndex,
    laneIndex,
    setIsEditing,
    view,
  });

  const contentEvents = useItemContentEvents({
    boardModifiers,
    item,
    itemIndex,
    laneIndex,
    view,
  });

  const onContextMenu: React.MouseEventHandler = React.useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const internalLinkPath =
        e.target instanceof HTMLAnchorElement &&
        e.target.hasClass("internal-link")
          ? e.target.dataset.href
          : undefined;

      showItemMenu(e.nativeEvent, internalLinkPath);
    },
    [showItemMenu]
  );

  const onDoubleClick: React.MouseEventHandler = React.useCallback(() => {
    setIsEditing(true);
  }, [setIsEditing]);

  return (
    <div
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      className={`${c("item")} ${classModifiers.join(" ")}`}
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      <div className={c("item-content-wrapper")}>
        <div className={c("item-title-wrapper")}>
          <ItemCheckbox
            boardModifiers={boardModifiers}
            item={item}
            itemIndex={itemIndex}
            laneIndex={laneIndex}
            shouldMarkItemsComplete={shouldMarkItemsComplete}
            view={view}
          />
          <ItemContent
            isSettingsVisible={isEditing}
            item={item}
            onChange={contentEvents.onContentChange}
            onEditDate={contentEvents.onEditDate}
            onEditTime={contentEvents.onEditTime}
            searchQuery={isMatch ? searchQuery : undefined}
            setIsSettingsVisible={setIsEditing}
          />
          <ItemMenuButton
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            showMenu={showItemMenu}
          />
        </div>
        <ItemMetadata
          searchQuery={isMatch ? searchQuery : undefined}
          isSettingsVisible={isEditing}
          item={item}
        />
      </div>
    </div>
  );
});
