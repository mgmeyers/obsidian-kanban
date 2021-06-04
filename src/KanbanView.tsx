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
  App,
  Notice,
} from "obsidian";
import { dispatch } from 'use-bus';

import { boardToMd, mdToBoard, processTitle } from "./parser";
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
  dataBridge: DataBridge;
  hoverPopover: HoverPopover | null;
  parseError: string;

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
    this.clear();
  }

  async onClose() {
    this.plugin.refreshViews();
  }

  getSetting(
    key: keyof KanbanSettings,
    suppliedLocalSettings?: KanbanSettings
  ) {
    const localSetting = suppliedLocalSettings
      ? suppliedLocalSettings[key]
      : this.dataBridge.getData().settings[key];

    if (localSetting !== undefined) return localSetting;

    const globalSetting = this.plugin.settings[key];

    if (globalSetting !== undefined) return globalSetting;

    return null;
  }

  getGlobalSetting(key: keyof KanbanSettings) {
    const globalSetting = this.plugin.settings[key];

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
              (this.leaf as any).id || this.file.path
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
    this.parseError = ""
    this.dataBridge = new DataBridge();
    // When the board has been updated by react
    this.dataBridge.onInternalSet((data) => {
      if (data === null || this.parseError) return;  // don't save corrupt data
      this.data = boardToMd(data);
      this.requestSave();
    });
  }

  toggleSearch() {
    this.dataBridge.setExternal(
      update(this.dataBridge.data, {
        $toggle: ["isSearching"],
      })
    );
  }

  getViewData() {
    return boardToMd(this.dataBridge.getData());
  }

  setViewData(data: string, clear: boolean) {
    const trimmedContent = data.trim();
    let board: Board = null;
    this.parseError = "";
    try {
      board = trimmedContent
      ? mdToBoard(trimmedContent, this)
      : {
          lanes: [],
          archive: [],
          settings: { "kanban-plugin": "basic" },
          isSearching: false,
        };
    } catch (e) {
      console.error(e);
      // Force a new databridge to ensure Kanban re-renders when the error goes away
      this.clear()
      this.parseError = "Error parsing document: " + e;
    }

    // Tell react we have a new board
    this.dataBridge.setExternal(board);
    this.plugin.refreshViews();
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
      const processed = processTitle(titleRaw, this);

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
    return ReactDOM.createPortal(
      <HandleErrors errorMessage={this.parseError}>
        <Kanban
          dataBridge={this.dataBridge}
          filePath={this.file?.path}
          view={this}
        />
      </HandleErrors>,
      this.contentEl
    );
  }
}


// Catch internal errors or display parsing errors

type ErrorProps = {errorMessage: string};

class HandleErrors extends React.Component<ErrorProps> {
  state: {errorMessage: string}
  constructor(props: ErrorProps) {
    super(props);
    this.state = { errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): typeof HandleErrors.prototype.state {
    // Update state so the next render will show the fallback UI.
    return { errorMessage: error.toString() };
  }

  componentDidCatch(error: Error, errorInfo: {componentStack: string}) {
    console.log(errorInfo.componentStack, error);
  }

  render() {
    const error = this.props.errorMessage || this.state.errorMessage;
    if (error) {
      return <div style={{margin: "2em"}}><h1>Something went wrong.</h1><p>{error}</p></div>;
    }
    return this.props.children;
  }
}