import React from "react";
import { KanbanView } from "src/KanbanView";
import { BoardModifiers } from "./types";

export interface ObsidianContextProps {
  filePath?: string;
  view?: KanbanView;
  boardModifiers:  BoardModifiers;
  query: string;
}

export const ObsidianContext = React.createContext<ObsidianContextProps>(null);



