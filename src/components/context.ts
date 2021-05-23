import { PreparedQuery } from "obsidian";
import React from "react";
import { KanbanView } from "src/KanbanView";
import { Board, BoardModifiers } from "./types";

export interface ObsidianContextProps {
  filePath?: string;
  view?: KanbanView;
}

export const ObsidianContext = React.createContext<ObsidianContextProps>(null);

export interface KanbanContextProps {
  board: Board;
  boardModifiers: BoardModifiers;
}

export const KanbanContext = React.createContext<KanbanContextProps>(null);

export interface SearchContextProps {
  query: PreparedQuery | null;
}

export const SearchContext = React.createContext<SearchContextProps>(null);