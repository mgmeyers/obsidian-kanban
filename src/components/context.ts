import React from "react";
import { KanbanView } from "src/KanbanView";
import { BoardModifiers } from "./types";

export interface KanbanContextProps {
  filePath?: string;
  view?: KanbanView;
  boardModifiers:  BoardModifiers;
}

export const KanbanContext = React.createContext<KanbanContextProps>(null);
export const SearchContext = React.createContext<string | null>(null);