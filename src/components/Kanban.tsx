import { moment } from "obsidian";
import update from "immutability-helper";
import React from "react";
import { DataBridge } from "../DataBridge";
import {
  Droppable,
  DroppableProvided,
  Draggable,
} from "react-beautiful-dnd";
import { Board, BoardModifiers, Item, Lane } from "./types";
import {
  c,
  baseClassName,
  getDefaultDateFormat,
  getDefaultTimeFormat,
} from "./helpers";
import { draggableLaneFactory } from "./Lane/Lane";
import { LaneForm } from "./Lane/LaneForm";
import { KanbanContext, ObsidianContext, SearchContext } from "./context";
import { KanbanView } from "src/KanbanView";
import { frontMatterKey, processTitle } from "../parser";
import { t } from "src/lang/helpers";
import { Icon } from "./Icon/Icon";

interface KanbanProps {
  dataBridge: DataBridge;
  filePath?: string;
  view: KanbanView;
}

interface BoardStateProps {
  view: KanbanView;
  boardData: Board;
  setBoardData: React.Dispatch<Board>;
}

function getBoardModifiers({
  view,
  boardData,
  setBoardData,
}: BoardStateProps): BoardModifiers {
  const shouldAppendArchiveDate = !!view.getSetting("prepend-archive-date");
  const dateFmt =
    view.getSetting("date-format") || getDefaultDateFormat(view.app);
  const timeFmt =
    view.getSetting("time-format") || getDefaultTimeFormat(view.app);
  const archiveDateSeparator =
    (view.getSetting("prepend-archive-separator") as string) || "";
  const archiveDateFormat =
    (view.getSetting("prepend-archive-format") as string) ||
    `${dateFmt} ${timeFmt}`;

  const appendArchiveDate = (item: Item) => {
    const newTitle = [moment().format(archiveDateFormat)];

    if (archiveDateSeparator) newTitle.push(archiveDateSeparator);

    newTitle.push(item.titleRaw);

    const titleRaw = newTitle.join(" ");
    const processed = processTitle(titleRaw, view);

    return update(item, {
      title: { $set: processed.title },
      titleRaw: { $set: titleRaw },
      titleSearch: { $set: processed.titleSearch },
    });
  };

  return {
    addItemsToLane: (laneIndex: number, items: Item[]) => {
      items.forEach((item) =>
        view.app.workspace.trigger("kanban:card-added", view.file, item)
      );

      setBoardData(
        update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $push: items,
              },
            },
          },
        })
      );
    },

    addLane: (lane: Lane) => {
      view.app.workspace.trigger("kanban:lane-added", view.file, lane);

      setBoardData(
        update(boardData, {
          lanes: {
            $push: [lane],
          },
        })
      );
    },

    updateLane: (laneIndex: number, lane: Lane) => {
      view.app.workspace.trigger("kanban:lane-updated", view.file, lane);

      setBoardData(
        update(boardData, {
          lanes: {
            [laneIndex]: {
              $set: lane,
            },
          },
        })
      );
    },

    deleteLane: (laneIndex: number) => {
      view.app.workspace.trigger(
        "kanban:lane-deleted",
        view.file,
        boardData.lanes[laneIndex]
      );

      setBoardData(
        update(boardData, {
          lanes: {
            $splice: [[laneIndex, 1]],
          },
        })
      );
    },

    archiveLane: (laneIndex: number) => {
      view.app.workspace.trigger(
        "kanban:lane-archived",
        view.file,
        boardData.lanes[laneIndex]
      );

      const items = boardData.lanes[laneIndex].items;

      setBoardData(
        update(boardData, {
          lanes: {
            $splice: [[laneIndex, 1]],
          },
          archive: {
            $push: shouldAppendArchiveDate
              ? items.map(appendArchiveDate)
              : items,
          },
        })
      );
    },

    archiveLaneItems: (laneIndex: number) => {
      const items = boardData.lanes[laneIndex].items;
      view.app.workspace.trigger(
        "kanban:lane-cards-archived",
        view.file,
        items
      );

      setBoardData(
        update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $set: [],
              },
            },
          },
          archive: {
            $push: shouldAppendArchiveDate
              ? items.map(appendArchiveDate)
              : items,
          },
        })
      );
    },

    deleteItem: (laneIndex: number, itemIndex: number) => {
      view.app.workspace.trigger(
        "kanban:card-deleted",
        view.file,
        boardData.lanes[laneIndex].items[itemIndex]
      );

      setBoardData(
        update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $splice: [[itemIndex, 1]],
              },
            },
          },
        })
      );
    },

    updateItem: (laneIndex: number, itemIndex: number, item: Item) => {
      view.app.workspace.trigger(
        "kanban:card-updated",
        view.file,
        boardData.lanes[laneIndex],
        item
      );

      setBoardData(
        update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                [itemIndex]: {
                  $set: item,
                },
              },
            },
          },
        })
      );
    },

    archiveItem: (laneIndex: number, itemIndex: number, item: Item) => {
      view.app.workspace.trigger(
        "kanban:card-archived",
        view.file,
        boardData.lanes[laneIndex],
        item
      );

      setBoardData(
        update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $splice: [[itemIndex, 1]],
              },
            },
          },
          archive: {
            $push: [shouldAppendArchiveDate ? appendArchiveDate(item) : item],
          },
        })
      );
    },

    duplicateItem: (laneIndex: number, itemIndex: number) => {
      view.app.workspace.trigger(
        "kanban:card-duplicated",
        view.file,
        boardData.lanes[laneIndex],
        itemIndex
      );

      setBoardData(
        update(boardData, {
          lanes: {
            [laneIndex]: {
              items: {
                $splice: [
                  [itemIndex, 0, boardData.lanes[laneIndex].items[itemIndex]],
                ],
              },
            },
          },
        })
      );
    },
  };
}

export const Kanban = ({ filePath, view, dataBridge }: KanbanProps) => {
  const [boardData, setBoardData] = React.useState<Board | null>(
    dataBridge.data
  );

  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const searchRef = React.useRef<HTMLInputElement>();

  const maxArchiveLength = view.getSetting("max-archive-size");

  React.useEffect(() => dataBridge.onExternalSet(setBoardData));

  React.useEffect(() => {
    if (boardData !== null) {
      dataBridge.setInternal(boardData);
    }
  }, [boardData]);

  React.useEffect(() => {
    if (boardData.isSearching) {
      searchRef.current?.focus();
    }
  }, [boardData.isSearching]);

  React.useEffect(() => {
    if (maxArchiveLength === undefined || maxArchiveLength === -1) {
      return;
    }

    if (
      typeof maxArchiveLength === "number" &&
      boardData.archive.length > maxArchiveLength
    ) {
      setBoardData(
        update(boardData, {
          archive: {
            $set: boardData.archive.slice(maxArchiveLength * -1),
          },
        })
      );
    }
  }, [boardData.archive.length, maxArchiveLength]);

  const boardModifiers = React.useMemo(() => {
    return getBoardModifiers({ view, boardData, setBoardData });
  }, [view, boardData, setBoardData]);

  if (boardData === null) return null;

  const renderLane = draggableLaneFactory({
    lanes: boardData.lanes,
  });

  const renderLaneGhost = draggableLaneFactory({
    lanes: boardData.lanes,
    isGhost: true,
  });

  const renderLanes = (provided: DroppableProvided) => (
    <div
      className={c("board")}
      ref={provided.innerRef}
      {...provided.droppableProps}
    >
      {boardData.lanes.map((lane, i) => {
        return (
          <Draggable draggableId={lane.id} key={lane.id} index={i}>
            {renderLane}
          </Draggable>
        );
      })}
      {provided.placeholder}
      <LaneForm />
    </div>
  );

  const onMouseOver = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const targetEl = e.target as HTMLElement;

      if (targetEl.tagName !== "A") return;

      if (targetEl.hasClass("internal-link")) {
        view.app.workspace.trigger("hover-link", {
          event: e.nativeEvent,
          source: frontMatterKey,
          hoverParent: view,
          targetEl,
          linktext: targetEl.getAttr("href"),
          sourcePath: view.file.path,
        });
      }
    },
    [view]
  );

  const onClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const targetEl = e.target as HTMLElement;

      if (targetEl.tagName !== "A") return;

      // Open an internal link in a new pane
      if (targetEl.hasClass("internal-link")) {
        e.preventDefault();

        view.app.workspace.openLinkText(
          targetEl.getAttr("href"),
          filePath,
          e.ctrlKey || e.metaKey
        );

        return;
      }

      // Open a tag search
      if (targetEl.hasClass("tag")) {
        e.preventDefault();

        (view.app as any).internalPlugins
          .getPluginById("global-search")
          .instance.openGlobalSearch(`tag:${targetEl.getAttr("href")}`);

        return;
      }

      // Open external link
      if (targetEl.hasClass("external-link")) {
        e.preventDefault();
        window.open(targetEl.getAttr("href"), "_blank");
      }
    },
    [view, filePath]
  );

  return (
    <ObsidianContext.Provider value={{ filePath, view }}>
      <KanbanContext.Provider value={{ boardModifiers, board: boardData }}>
        <SearchContext.Provider
          value={{ query: searchQuery.toLocaleLowerCase() }}
        >
          {boardData.isSearching && (
            <div className={c("search-wrapper")}>
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchQuery("");
                    (e.target as HTMLInputElement).blur();
                    view.toggleSearch();
                  }
                }}
                type="text"
                className={c("filter-input")}
                placeholder={t("Search...")}
              />
              <button
                className={c("search-cancel-button")}
                onClick={() => {
                  setSearchQuery("");
                  view.toggleSearch();
                }}
                aria-label={t("Cancel")}
              >
                <Icon name="cross" />
              </button>
            </div>
          )}
          <div
            className={baseClassName}
            onMouseOver={onMouseOver}
            onClick={onClick}
          >
            <Droppable
              droppableId={(view.leaf as any).id}
              type="LANE"
              direction="horizontal"
              ignoreContainerClipping={false}
              renderClone={renderLaneGhost}
            >
              {renderLanes}
            </Droppable>
          </div>
        </SearchContext.Provider>
      </KanbanContext.Provider>
    </ObsidianContext.Provider>
  );
};
