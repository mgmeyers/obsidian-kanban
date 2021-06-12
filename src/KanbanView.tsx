import update from "immutability-helper";
import ReactDOM from "react-dom";
import React from "react";
import {
  HoverParent,
  HoverPopover,
  Menu,
  TextFileView,
  WorkspaceLeaf,
  moment,
  TFile,
} from "obsidian";
import { dispatch } from "use-bus";

import { KanbanParser } from "./parser";
import { Kanban } from "./components/Kanban";
import { DataBridge } from "./DataBridge";
import { Board, Item } from "./components/types";
import KanbanPlugin from "./main";
import { KanbanSettings, SettingsModal } from "./Settings";
import {
  getDefaultDateFormat,
  getDefaultTimeFormat,
} from "./components/helpers";
import { t } from "./lang/helpers";

export const kanbanViewType = "kanban";
export const kanbanIcon = "blocks";

export class KanbanView extends TextFileView implements HoverParent {
  plugin: KanbanPlugin;
  parser: KanbanParser = new KanbanParser(this);

  dataBridge: DataBridge<Board> = new DataBridge(null);
  setBoard(board: Board) { this.dataBridge.setExternal(board); }
  getBoard(): Board { return this.dataBridge.getData(); }

  errorBridge: DataBridge<ErrorHandlerState> = new DataBridge({errorMessage: ""});
  setError(err?: Error) { this.errorBridge.setExternal(err ? ErrorHandler.getDerivedStateFromError(err) : {errorMessage: ""}); }
  getError() { return this.errorBridge.getData(); }

  hoverPopover: HoverPopover | null;
  id: string = (this.leaf as any).id;

  getViewType() {
    return kanbanViewType;
  }

  getIcon() {
    return kanbanIcon;
  }

  getDisplayText() {
    return this.file?.basename || "Kanban";
  }

  constructor(leaf: WorkspaceLeaf, plugin: KanbanPlugin) {
    super(leaf);
    this.plugin = plugin;
    // When the board has been updated by react, update Obsidian
    this.dataBridge.onInternalSet(this.requestUpdate);
  }

  async onClose() {
    // Remove draggables from render, as the DOM has already detached
    this.plugin.removeView(this);
  }

  getSetting(
    key: keyof KanbanSettings,
    suppliedLocalSettings?: KanbanSettings
  ) {
    const localSetting = suppliedLocalSettings
      ? suppliedLocalSettings[key]
      : this.dataBridge.getData()?.settings[key];

    if (localSetting !== undefined) return localSetting;

    const globalSetting = this.plugin?.settings[key];

    if (globalSetting !== undefined) return globalSetting;

    return null;
  }

  getGlobalSetting(key: keyof KanbanSettings) {
    const globalSetting = this.plugin?.settings[key];

    if (globalSetting !== undefined) return globalSetting;

    return null;
  }

  onFileMetadataChange(file: TFile) {
    dispatch(`metadata:update:${file.path}`);
  }

  onMoreOptionsMenu(menu: Menu) {
    // Add a menu item to force the board to markdown view
    menu
      .addItem((item) => {
        item
          .setTitle(t("Open as markdown"))
          .setIcon("document")
          .onClick(() => {
            this.plugin.kanbanFileModes[
              this.id || this.file.path
            ] = "markdown";
            this.plugin.setMarkdownView(this.leaf);
          });
      })
      .addItem((item) => {
        item
          .setTitle(t("Open board settings"))
          .setIcon("gear")
          .onClick(() => {
            const board = this.dataBridge.getData();

            new SettingsModal(
              this,
              {
                onSettingsChange: (settings) => {
                  this.dataBridge.setExternal(
                    update(board, {
                      settings: {
                        $set: settings,
                      },
                    })
                  );

                  setTimeout(() => {
                    this.setViewData(this.data, true);
                  }, 100);
                },
              },
              board.settings
            ).open();
          });
      })
      .addItem((item) => {
        item
          .setTitle(t("Archive completed cards"))
          .setIcon("sheets-in-box")
          .onClick(() => {
            this.archiveCompletedCards();
          });
      })
      .addSeparator();

    super.onMoreOptionsMenu(menu);
  }

  clear() {
    /*
      Obsidian *only* calls this after unloading a file, before loading the next.
      Specifically, from onUnloadFile, which calls save(true), and then optionally
      calls clear, if and only if this.file is still non-empty.  That means that
      in this function, this.file is still the *old* file, so we should not do
      anything here that might try to use the file (including its path), so we
      should avoid doing anything that refreshes the display.  (Since that could
      use the file, and would also flash an empty pane during navigation, depending
      on how long the next file load takes.)

      Given all that, it makes more sense to clean up our state from onLoadFile, as
      following a clear there are only two possible states: a successful onLoadFile
      updates our full state via setViewData(), or else it aborts with an error
      first.  So as long as setViewData() and the error handler for onLoadFile()
      fully reset the state (to a valid load state or a valid error state),
      there's nothing to do in this method.  (We can't omit it, since it's
      abstract.)
    */
  }

  async onLoadFile(file: TFile) {
    try {
      return await super.onLoadFile(file);
    }
    catch(e) {
      // Update to display details of the problem
      this.setBoard(null);
      this.setError(e);
      throw e;
    }
  }

  requestUpdate = (data: Board) => {
    if (data === null || this.getError().errorMessage) return; // don't save corrupt data
      const newData = this.parser.boardToMd(data)
      if (this.data !== newData) {
        this.data = newData;
        this.requestSave();
      }
  };

  toggleSearch() {
    this.dataBridge.setExternal(
      update(this.dataBridge.data, {
        $toggle: ["isSearching"],
      })
    );
  }

  getViewData() {
    // In theory, we could unparse the board here.  In practice, the board can be
    // in an error state, so we return the last good data here.  (In addition,
    // unparsing is slow, and getViewData() can be called more often than the
    // data actually changes.)
    return this.data;
  }

  setViewData(data: string, clear: boolean) {
    const trimmedContent = data.trim();
    let board: Board = null;
    try {
      board = {
            lanes: [],
            archive: [],
            settings: { "kanban-plugin": "basic" },
            isSearching: false,
          };
      if (trimmedContent) board = this.parser.mdToBoard(trimmedContent);
      this.setError()
    } catch (e) {
      console.error(e);
      this.setError(e);
      board = null;
    }

    // Tell react we have a new board
    this.setBoard(board);

    // And make sure we're visible (no-op if we already are)
    this.plugin.addView(this)
  }

  archiveCompletedCards() {
    const archived: Item[] = [];
    const board = this.dataBridge.data;
    const shouldAppendArchiveDate = !!this.getSetting("prepend-archive-date");
    const dateFmt =
      this.getSetting("date-format") || getDefaultDateFormat(this.app);
    const timeFmt =
      this.getSetting("time-format") || getDefaultTimeFormat(this.app);
    const archiveDateSeparator =
      (this.getSetting("prepend-archive-separator") as string) || "";
    const archiveDateFormat =
      (this.getSetting("prepend-archive-format") as string) ||
      `${dateFmt} ${timeFmt}`;

    const appendArchiveDate = (item: Item) => {
      const newTitle = [moment().format(archiveDateFormat)];

      if (archiveDateSeparator) newTitle.push(archiveDateSeparator);

      newTitle.push(item.titleRaw);

      const titleRaw = newTitle.join(" ");
      const processed = this.parser.processTitle(titleRaw);

      return update(item, {
        title: { $set: processed.title },
        titleRaw: { $set: titleRaw },
        titleSearch: { $set: processed.titleSearch },
      });
    };

    const lanes = board.lanes.map((lane) => {
      return update(lane, {
        items: {
          $set: lane.items.filter((item) => {
            if (item.data.isComplete) {
              archived.push(
                shouldAppendArchiveDate ? appendArchiveDate(item) : item
              );
            }

            return !item.data.isComplete;
          }),
        },
      });
    });

    this.app.workspace.trigger(
      "kanban:board-cards-archived",
      this.file,
      archived
    );

    this.dataBridge.setExternal(
      update(board, {
        lanes: {
          $set: lanes,
        },
        archive: {
          $push: archived,
        },
      })
    );
  }

  getPortal() {
      return (
        <ErrorHandler view={this} key={this.id}>
          <Kanban
            dataBridge={this.dataBridge}
            view={this}
          />
        </ErrorHandler>
      );
  }
}

// Catch internal errors or display parsing errors

interface ErrorHandlerState {
  errorMessage: string;
  stack?: string;
}

class ErrorHandler extends React.Component<{view: KanbanView}> {
  state: ErrorHandlerState;
  remove?: () => void;

  constructor(props: {view: KanbanView}) {
    super(props);
    this.state = { errorMessage: "" };
  }

  stateSetter = (state: ErrorHandlerState) => this.setState(state);

  componentWillMount(){
    // Send error state outward; save unsubs function for unmount
    this.remove = this.props.view.errorBridge.onExternalSet(this.stateSetter);
  }

  componentWillUnmount(){
    // Unsubscribe from the databridge
    this.remove?.()
  }

  static getDerivedStateFromError(error: Error): ErrorHandlerState {
    // Update state so the next render will show the fallback UI.
    return { errorMessage: error.toString(), stack: error.stack };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error(errorInfo.componentStack, error);
  }

  render() {
    const error = this.state.errorMessage;
    const stack = this.state.stack;

    if (error) {
      return (
        <div style={{ margin: "2em" }}>
          <h1>{t("Something went wrong")}</h1>
          <p>{error}</p>
          {stack && <pre>{stack}</pre>}
        </div>
      );
    }

    return this.props.children;
  }
}
