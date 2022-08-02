import { JSX } from 'preact';
import Preact from 'preact/compat';

import { DragEventData } from '../managers/DragManager';
import { Coordinates, Entity, Hitbox } from '../types';
import { getDropDuration, transforms, transitions } from '../util/animation';
import { emptyHitbox } from '../util/hitbox';
import { DndManagerContext } from './context';

export interface DragOverlayProps {
  children(entity: Entity, styles: JSX.CSSProperties): JSX.Element;
}

function getDragOverlayStyles(
  position: Coordinates,
  origin: Coordinates,
  originHitbox: Hitbox,
  margin: Hitbox,
  transition?: string,
  transform?: string
): Preact.CSSProperties {
  const adjustedHitbox = [
    originHitbox[0] - margin[0],
    originHitbox[1] - margin[1],
    originHitbox[2] + margin[2],
    originHitbox[3] + margin[3],
  ];

  return {
    transform:
      transform ||
      `translate3d(${position.x - origin.x + adjustedHitbox[0]}px, ${
        position.y - origin.y + adjustedHitbox[1]
      }px, 0px)`,
    width: `${adjustedHitbox[2] - adjustedHitbox[0]}px`,
    height: `${adjustedHitbox[3] - adjustedHitbox[1]}px`,
    transition,
  };
}

export function DragOverlay({ children }: DragOverlayProps) {
  const dndManager = Preact.useContext(DndManagerContext);

  const [dragEntity, setDragEntity] = Preact.useState<Entity | undefined>();
  const [styles, setStyles] = Preact.useState<
    Preact.CSSProperties | undefined
  >();

  Preact.useEffect(() => {
    if (!dndManager) return;

    let dragOriginHitbox: Hitbox = emptyHitbox;

    const dragStart = ({
      dragEntity,
      dragOrigin,
      dragPosition,
      dragEntityMargin,
    }: DragEventData) => {
      if (!dragEntity || !dragPosition || !dragOrigin) {
        return;
      }
      dragOriginHitbox = dragEntity.getHitbox();
      setDragEntity(dragEntity);
      setStyles(
        getDragOverlayStyles(
          dragPosition,
          dragOrigin,
          dragOriginHitbox,
          dragEntityMargin
        )
      );
    };

    const dragMove = ({
      dragOrigin,
      dragPosition,
      dragEntityMargin,
    }: DragEventData) => {
      if (!dragPosition || !dragOrigin) {
        return;
      }
      setStyles(
        getDragOverlayStyles(
          dragPosition,
          dragOrigin,
          dragOriginHitbox,
          dragEntityMargin
        )
      );
    };

    const dragEnd = ({
      dragOrigin,
      primaryIntersection,
      dragPosition,
      dragEntityMargin,
    }: DragEventData) => {
      if (primaryIntersection && dragPosition && dragOrigin) {
        const dropHitbox = primaryIntersection.getHitbox();
        const dropDestination = {
          x: dropHitbox[0],
          y: dropHitbox[1],
        };
        const dropDuration = getDropDuration({
          position: dragPosition,
          destination: dropDestination,
        });

        const transition = transitions.drop(dropDuration);
        const transform = transforms.drop(dropDestination);

        setStyles(
          getDragOverlayStyles(
            dragPosition,
            dragOrigin,
            dragOriginHitbox,
            dragEntityMargin,
            transition,
            transform
          )
        );

        activeWindow.setTimeout(() => {
          setDragEntity(undefined);
          setStyles(undefined);
        }, dropDuration);
      } else {
        setDragEntity(undefined);
        setStyles(undefined);
      }
    };

    dndManager.dragManager.emitter.on('dragStart', dragStart);
    dndManager.dragManager.emitter.on('dragMove', dragMove);
    dndManager.dragManager.emitter.on('dragEnd', dragEnd);

    return () => {
      dndManager.dragManager.emitter.off('dragStart', dragStart);
      dndManager.dragManager.emitter.off('dragMove', dragMove);
      dndManager.dragManager.emitter.off('dragEnd', dragEnd);
    };
  }, [dndManager]);

  if (!dragEntity || !styles) {
    return null;
  }

  return Preact.createPortal(
    children(dragEntity, styles),
    dragEntity.getData().win.document.body
  );
}

export function useIsAnythingDragging() {
  const dndManager = Preact.useContext(DndManagerContext);
  const [isDragging, setIsDragging] = Preact.useState(false);

  Preact.useEffect(() => {
    const onDragStart = () => {
      setIsDragging(true);
    };

    const onDragEnd = ({
      primaryIntersection,
      dragPosition,
    }: DragEventData) => {
      const dropHitbox = primaryIntersection?.getHitbox() || [0, 0];
      const dropDestination = {
        x: dropHitbox[0],
        y: dropHitbox[1],
      };
      const dropDuration = getDropDuration({
        position: dragPosition || dropDestination,
        destination: dropDestination,
      });

      activeWindow.setTimeout(() => {
        setIsDragging(false);
      }, dropDuration);
    };

    dndManager.dragManager.emitter.on('dragStart', onDragStart);
    dndManager.dragManager.emitter.on('dragEnd', onDragEnd);

    return () => {
      dndManager.dragManager.emitter.off('dragStart', onDragStart);
      dndManager.dragManager.emitter.off('dragEnd', onDragEnd);
    };
  }, [dndManager]);

  return isDragging;
}
