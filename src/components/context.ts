import React from "react";
import { KanbanView } from "src/KanbanView";
import { Board, BoardModifiers } from "./types";

interface ObsidianContextProps {
  filePath?: string;
  view?: KanbanView;
}

export const ObsidianContext = React.createContext<ObsidianContextProps>(null);

export interface KanbanContext {
  board: Board;
  boardModifiers: BoardModifiers;
}

export const KanbanContext = React.createContext<KanbanContext>(null);
