import update from "immutability-helper";
import React from "react";
import { DataBridge } from "../DataBridge";
import {
  Droppable,
  DroppableProvided,
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
  DraggableRubric,
} from "react-beautiful-dnd";
import { Board } from "./types";
import { c, baseClassName } from "./helpers";
import { DraggableLane } from "./Lane/Lane";
import { LaneForm } from "./Lane/LaneForm";
import { KanbanContext, SearchContext } from "./context";
import { KanbanView } from "src/KanbanView";
import { frontMatterKey } from "../parser";
import { t } from "src/lang/helpers";
import { Icon } from "./Icon/Icon";
import { getBoardModifiers } from "./helpers/boardModifiers";

interface KanbanProps {
  dataBridge: DataBridge<Board>;
  view: KanbanView;
}

export const Kanban = ({ view, dataBridge }: KanbanProps) => {
  const [boardData, setBoardData] = dataBridge.useState();

  const searchRef = React.useRef<HTMLInputElement>();
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] =
    React.useState<string>("");

  const filePath = view.file?.path;
  const maxArchiveLength = view.getSetting("max-archive-size");

  React.useEffect(() => {
    if (boardData.isSearching) {
      searchRef.current?.focus();
    }
  }, [boardData.isSearching]);

  React.useEffect(() => {
    const trimmed = searchQuery.trim();
    let id: number;

    if (trimmed) {
      id = window.setTimeout(() => {
        setDebouncedSearchQuery(trimmed);
      }, 250);
    } else {
      setDebouncedSearchQuery("");
    }

    return () => {
      window.clearTimeout(id);
    };
  }, [searchQuery]);

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
    return getBoardModifiers({ view, setBoardData });
  }, [view, setBoardData]);

  // These rendering functions can't usefully be memoized, because they all use boardData,
  // which will always be "changed" when this component is re-rendered.

  const renderLane = (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => (
    <DraggableLane
      lane={boardData.lanes[rubric.source.index]}
      laneIndex={rubric.source.index}
      provided={provided}
      snapshot={snapshot}
    />
  );

  const renderLaneGhost = (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => (
    <DraggableLane
      lane={boardData.lanes[rubric.source.index]}
      laneIndex={rubric.source.index}
      isGhost={true}
      provided={provided}
      snapshot={snapshot}
    />
  );

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

  const kanbanContext = React.useMemo(() => {
    return {
      view,
      boardModifiers,
      filePath,
    };
  }, [view, boardModifiers, filePath]);

  if (boardData === null) return null;

  return (
    <KanbanContext.Provider value={kanbanContext}>
      <SearchContext.Provider
        value={
          debouncedSearchQuery ? debouncedSearchQuery.toLocaleLowerCase() : null
        }
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
                  setDebouncedSearchQuery("");
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
                setDebouncedSearchQuery("");
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
            droppableId={view.id}
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
  );
};
