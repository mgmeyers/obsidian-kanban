import Preact from 'preact/compat';

import { DndManager } from '../managers/DndManager';
import { Entity, WithChildren } from '../types';
import { DndManagerContext } from './context';
import { DndScrollState } from './ScrollStateContext';

interface DndContextProps extends WithChildren {
  win: Window;
  onDrop(dragEntity: Entity, dropEntity: Entity): void;
}

export function DndContext({ win, children, onDrop }: DndContextProps) {
  const onDropRef = Preact.useRef(onDrop);

  onDropRef.current = onDrop;

  const dndManager = Preact.useMemo(() => {
    return new DndManager(win, (dragEntity: Entity, dropEntity: Entity) => {
      return onDropRef.current(dragEntity, dropEntity);
    });
  }, []);

  Preact.useEffect(() => {
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
