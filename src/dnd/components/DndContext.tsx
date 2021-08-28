import React from 'react';

import { DndManager } from '../managers/DndManager';
import { Entity, WithChildren } from '../types';
import { DndManagerContext } from './context';
import { DndScrollState } from './ScrollStateContext';

interface DndContextProps extends WithChildren {
  onDrop(dragEntity: Entity, dropEntity: Entity): void;
}

export function DndContext({ children, onDrop }: DndContextProps) {
  const onDropRef = React.useRef(onDrop);

  onDropRef.current = onDrop;

  const dndManager = React.useMemo(() => {
    return new DndManager((dragEntity: Entity, dropEntity: Entity) => {
      return onDropRef.current(dragEntity, dropEntity);
    });
  }, []);

  React.useEffect(() => {
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
