import { generateInstanceId } from 'src/components/helpers';
import { DataTypes } from 'src/components/types';

import { Entity, initialScrollShift, initialScrollState } from '../types';

export function createHTMLDndEntity(
  x: number,
  y: number,
  content: string[],
  viewId: string,
  win: Window
): Entity {
  const scopeId = 'htmldnd';
  const id = generateInstanceId();

  const minX = x - 75;
  const maxX = x + 75;
  const minY = y - 25;
  const maxY = y + 25;

  return {
    scopeId: scopeId,
    entityId: `${scopeId}-${id}`,
    initial: [minX, minY, maxX, maxY],
    getParentScrollState() {
      return initialScrollState;
    },
    getParentScrollShift() {
      return initialScrollShift;
    },
    recalcInitial() {},
    getHitbox() {
      return this.initial;
    },
    getPath() {
      return [];
    },
    getData() {
      return {
        viewId,
        type: DataTypes.Item,
        id,
        content,
        accepts: [],
        win,
      };
    },
  };
}
