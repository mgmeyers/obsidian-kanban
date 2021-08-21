import React from "react";
import { DndManager } from "../managers/DndManager";
import { Entity, WithChildren } from "../types";
import { DndManagerContext } from "./context";

interface DndContextProps extends WithChildren {
  onDrop(dragEntity: Entity, dropEntity: Entity): void;
}

export function DndContext({ children, onDrop }: DndContextProps) {
  const onDropRef = React.useRef(onDrop);

  onDropRef.current = onDrop;

  const dndManager = React.useMemo(() => {
    console.log("creating DND manager");
    return new DndManager((dragEntity: Entity, dropEntity: Entity) => {
      console.log("calling DND manager drop ref");
      return onDropRef.current(dragEntity, dropEntity);
    });
  }, []);

  React.useEffect(() => {
    return () => {
      console.log('destroying dndmanager')
      dndManager.destroy();
    };
  }, [dndManager]);

  return (
    <DndManagerContext.Provider value={dndManager}>
      {children}
    </DndManagerContext.Provider>
  );
}
