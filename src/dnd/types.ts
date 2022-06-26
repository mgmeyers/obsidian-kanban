import { ComponentChildren } from 'preact';

export type Axis = 'horizontal' | 'vertical';
export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Path = number[];

export interface NestableProps {
  id: string;
  type: string;
  accepts: string[];
}

export interface Nestable<D = any, T = any> extends NestableProps {
  children: T[];
  data: D;
}

// [minX, minY, maxX, maxY]
export type Hitbox = [number, number, number, number];

export interface Coordinates {
  x: number;
  y: number;
}

export interface CoordinateShift {
  x: number;
  y: number;
}

export interface ScrollState {
  x: number;
  y: number;
  maxX: number;
  maxY: number;
}

export interface EntityData {
  type: string;
  id: string;
  accepts: string[];
  sortAxis?: Axis;
  [k: string]: any;
}

export interface ScopedEntityData extends EntityData {
  win: Window;
}

export interface Entity {
  getPath(): Path;
  getHitbox(): Hitbox;
  getData(): ScopedEntityData;
  recalcInitial(): void;
  getParentScrollState(): ScrollState;
  getParentScrollShift(): CoordinateShift;

  scopeId: string;
  entityId: string;
  initial: Hitbox;
}

export interface WithChildren {
  children?: ComponentChildren;
}

export const initialScrollState: ScrollState = {
  x: 0,
  y: 0,
  maxX: 0,
  maxY: 0,
};

export const initialScrollShift: CoordinateShift = {
  x: 0,
  y: 0,
};
