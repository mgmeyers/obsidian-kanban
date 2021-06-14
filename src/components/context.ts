import React from "react";
import { KanbanView } from "src/KanbanView";
import { Board, BoardModifiers } from "./types";

export interface ObsidianContextProps {
  filePath?: string;
  view?: KanbanView;
}

export const ObsidianContext = React.createContext<ObsidianContextProps>(null);

export const KanbanContext = React.createContext<BoardModifiers>(null);

export interface SearchContextProps {
  query: string;
}

export const SearchContext = React.createContext<SearchContextProps>(null);
