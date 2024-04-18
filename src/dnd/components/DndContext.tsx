import { useEffect, useMemo, useRef } from 'preact/compat';

import { DndManager } from '../managers/DndManager';
import { Entity, WithChildren } from '../types';
import { DndScrollState } from './ScrollStateContext';
import { DndManagerContext } from './context';

interface DndContextProps extends WithChildren {
  win: Window;
  onDrop(dragEntity: Entity, dropEntity: Entity): void;
}

export function DndContext({ win, children, onDrop }: DndContextProps) {
  const onDropRef = useRef(onDrop);

  onDropRef.current = onDrop;

  const dndManager = useMemo(() => {
    return new DndManager(win, (dragEntity: Entity, dropEntity: Entity) => {
      return onDropRef.current(dragEntity, dropEntity);
    });
  }, []);

  useEffect(() => {
    return () => {
      dndManager.destroy();
    };
  }, [dndManager]);

  return (
    <DndManagerContext.Provider value={dndManager}>
      <DndScrollState>{children}</DndScrollState>
    </DndManagerContext.Provider>
  );
}
