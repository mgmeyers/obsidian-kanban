import React from "react";
import { DndManager } from "../managers/DndManager";
import { EntityManager } from "../managers/EntityManager";
import { ScrollManager } from "../managers/ScrollManager";
import { SortManager } from "../managers/SortManager";
import { CoordinateShift } from "../types";

export const DndManagerContext = React.createContext<DndManager | null>(null);

export const ScopeIdContext = React.createContext<string>("");

export const ScrollManagerContext = React.createContext<ScrollManager | null>(
  null
);

export const ScrollStateContext = React.createContext<
  Map<string, CoordinateShift>
>(new Map());

export const SortManagerContext = React.createContext<SortManager | null>(null);

export const EntityManagerContext = React.createContext<EntityManager | null>(
  null
);
