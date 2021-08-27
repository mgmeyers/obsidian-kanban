import update from "immutability-helper";
import React from "react";
import { DataTypes } from "./types";
import { c, baseClassName } from "./helpers";
import { Lanes } from "./Lane/Lane";
import { LaneForm } from "./lane/LaneForm";
import { KanbanContext, SearchContext } from "./context";
import { KanbanView } from "src/KanbanView";
import { frontMatterKey } from "../parsers/common";
import { t } from "src/lang/helpers";
import { Icon } from "./Icon/Icon";
import { getBoardModifiers } from "./helpers/boardModifiers";
import { DndScope } from "../dnd/components/Scope";
import { ScrollContainer } from "src/dnd/components/ScrollContainer";
import { Sortable } from "src/dnd/components/Sortable";
import { SortPlaceholder } from "src/dnd/components/SortPlaceholder";
import classcat from "classcat";
import { StateManager } from "src/StateManager";
import animateScrollTo from "animated-scroll-to";

const boardScrollTiggers = [DataTypes.Item, DataTypes.Lane];
const boardAccepts = [DataTypes.Lane];

interface KanbanProps {
  stateManager: StateManager;
  view: KanbanView;
}

export const Kanban = ({ view, stateManager }: KanbanProps) => {
  const boardData = stateManager.useState();

  const rootRef = React.useRef<HTMLDivElement>();
  const searchRef = React.useRef<HTMLInputElement>();
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [isSearching, setIsSearching] = React.useState<boolean>(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] =
    React.useState<string>("");

  const [isLaneFormVisible, setIsLaneFormVisible] =
    React.useState<boolean>(false);

  const filePath = stateManager.file.path;
  const maxArchiveLength = stateManager.getSetting("max-archive-size");

  const closeLaneForm = React.useCallback(() => {
    setIsLaneFormVisible(false);
  }, []);

  const onNewLane = React.useCallback(() => {
    setTimeout(() => {
      const board = rootRef.current?.getElementsByClassName(c("board"));

      if (board.length) {
        animateScrollTo([board[0].scrollWidth, 0], {
          elementToScroll: board[0],
          speed: 300,
          minDuration: 150,
          easing: (x: number) => {
            return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
          },
        });
      }
    });
  }, []);

  React.useEffect(() => {
    const toggleSearch = () => {
      setIsSearching((val) => !val);
    };

    const showLaneForm = () => {
      setIsLaneFormVisible(true);
    };

    view.emitter.on("toggleSearch", toggleSearch);
    view.emitter.on("showLaneForm", showLaneForm);

    return () => {
      view.emitter.off("toggleSearch", toggleSearch);
      view.emitter.off("showLaneForm", showLaneForm);
    };
  }, [view]);

  React.useEffect(() => {
    if (isSearching) {
      searchRef.current?.focus();
    }
  }, [isSearching]);

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
      boardData.data.archive.length > maxArchiveLength
    ) {
      stateManager.setState((board) =>
        update(board, {
          data: {
            archive: {
              $set: board.data.archive.slice(maxArchiveLength * -1),
            },
          },
        })
      );
    }
  }, [boardData.data.archive.length, maxArchiveLength]);

  const boardModifiers = React.useMemo(() => {
    return getBoardModifiers(stateManager);
  }, [stateManager]);

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

        stateManager.app.workspace.openLinkText(
          targetEl.getAttr("href"),
          filePath,
          e.ctrlKey || e.metaKey
        );

        return;
      }

      // Open a tag search
      if (targetEl.hasClass("tag")) {
        e.preventDefault();

        (stateManager.app as any).internalPlugins
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
    [stateManager, filePath]
  );

  const kanbanContext = React.useMemo(() => {
    return {
      view,
      stateManager,
      boardModifiers,
      filePath,
    };
  }, [view, stateManager, boardModifiers, filePath]);

  if (boardData === null) return null;

  if (boardData.data.errors.length > 0) {
    return (
      <div>
        <div>Error:</div>
        {boardData.data.errors.map((e, i) => {
          return (
            <div key={i}>
              <div>{e.description}</div>
              <pre>{e.stack}</pre>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <DndScope id={view.id}>
      <KanbanContext.Provider value={kanbanContext}>
        <SearchContext.Provider
          value={
            debouncedSearchQuery
              ? debouncedSearchQuery.toLocaleLowerCase()
              : null
          }
        >
          <div
            ref={rootRef}
            className={baseClassName}
            onMouseOver={onMouseOver}
            onClick={onClick}
          >
            {isLaneFormVisible && (
              <LaneForm onNewLane={onNewLane} closeLaneForm={closeLaneForm} />
            )}
            {boardData.data.isSearching && (
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
                      stateManager.toggleSearch();
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
                    stateManager.toggleSearch();
                  }}
                  aria-label={t("Cancel")}
                >
                  <Icon name="cross" />
                </button>
              </div>
            )}
            <ScrollContainer
              id="lanes"
              className={classcat([
                c("board"),
                c("horizontal"),
                {
                  "is-adding-lane": isLaneFormVisible,
                },
              ])}
              triggerTypes={boardScrollTiggers}
            >
              <div>
                <Sortable axis="horizontal">
                  <Lanes lanes={boardData.children} />
                  <SortPlaceholder
                    className={c("lane-placeholder")}
                    accepts={boardAccepts}
                    index={boardData.children.length}
                  />
                </Sortable>
              </div>
            </ScrollContainer>
          </div>
        </SearchContext.Provider>
      </KanbanContext.Provider>
    </DndScope>
  );
};
