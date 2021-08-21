import update from "immutability-helper";
import React from "react";
import { DataTypes } from "./types";
import { c, baseClassName } from "./helpers";
import { Lanes } from "./Lane/Lane";
import { KanbanContext, SearchContext } from "./context";
import { KanbanView } from "src/KanbanView";
import { frontMatterKey } from "../parsers/common";
import { t } from "src/lang/helpers";
import { Icon } from "./Icon/Icon";
import { getBoardModifiers } from "./helpers/boardModifiers";
import { DndScope } from "../dnd/components/Scope";
import { DndScrollState } from "src/dnd/components/ScrollStateContext";
import { ScrollContainer } from "src/dnd/components/ScrollContainer";
import { Sortable } from "src/dnd/components/Sortable";
import { SortPlaceholder } from "src/dnd/components/SortPlaceholder";
import classcat from "classcat";
import { StateManager } from "src/StateManager";

const boardScrollTiggers = [DataTypes.Item, DataTypes.Lane];
const boardAccepts = [DataTypes.Lane];

interface KanbanProps {
  stateManager: StateManager;
  view: KanbanView;
}

export const Kanban = ({ view, stateManager }: KanbanProps) => {
  const boardData = stateManager.useState();

  const searchRef = React.useRef<HTMLInputElement>();
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] =
    React.useState<string>("");

  const filePath = stateManager.file.path;
  const maxArchiveLength = stateManager.getSetting("max-archive-size");

  React.useEffect(() => {
    if (boardData.data.isSearching) {
      searchRef.current?.focus();
    }
  }, [boardData.data.isSearching]);

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
      <DndScrollState>
        <KanbanContext.Provider value={kanbanContext}>
          <SearchContext.Provider
            value={
              debouncedSearchQuery
                ? debouncedSearchQuery.toLocaleLowerCase()
                : null
            }
          >
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
            <div
              className={baseClassName}
              onMouseOver={onMouseOver}
              onClick={onClick}
            >
              <ScrollContainer
                id="lanes"
                className={classcat([c("board"), c("horizontal")])}
                triggerTypes={boardScrollTiggers}
              >
                <Sortable axis="horizontal">
                  <Lanes lanes={boardData.children} />
                  <SortPlaceholder
                    className={c("lane-placeholder")}
                    accepts={boardAccepts}
                    index={boardData.children.length}
                  />
                </Sortable>
              </ScrollContainer>
            </div>
          </SearchContext.Provider>
        </KanbanContext.Provider>
      </DndScrollState>
    </DndScope>
  );
};
