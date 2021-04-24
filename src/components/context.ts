import React from "react";
import { KanbanView } from "src/KanbanView";

interface ObsidianContextProps {
  filePath?: string;
  view?: KanbanView;
}

export const ObsidianContext = React.createContext<ObsidianContextProps>({});
