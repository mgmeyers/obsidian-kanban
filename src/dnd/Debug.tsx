import React from 'react';

import { c } from 'src/components/helpers';

import { DndManagerContext } from './components/context';
import { Hitbox } from './types';
import { useRaf } from './util/raf';

interface HitBoxDebugProps {
  hitbox: Hitbox;
  color: string;
  zIndex: number;
  children?: React.ReactNode;
}

function HitBoxDebug({ color, hitbox, zIndex, children }: HitBoxDebugProps) {
  const style: React.CSSProperties = {
    borderColor: color,
    transform: `translate3d(${hitbox[0]}px, ${hitbox[1]}px, 0px)`,
    width: hitbox[2] - hitbox[0],
    height: hitbox[3] - hitbox[1],
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: zIndex,
    pointerEvents: 'none',
  };

  return (
    <div className={c('hitbox')} style={style}>
      {children}
    </div>
  );
}

export function DebugScrollContainers() {
  const dndManager = React.useContext(DndManagerContext);
  const [, update] = React.useState(0);

  useRaf(({ time }) => {
    update(time);
  }, []);

  if (!dndManager?.scrollEntities) return null;

  return (
    <>
      {Array.from(dndManager?.scrollEntities.entries()).map(([id, hb]) => {
        return (
          <HitBoxDebug
            zIndex={9999}
            color="#8787d3"
            key={id}
            hitbox={hb.getHitbox()}
          >
            {id}
          </HitBoxDebug>
        );
      })}
    </>
  );
}

export function Debug() {
  const dndManager = React.useContext(DndManagerContext);
  const [, update] = React.useState(0);

  useRaf(({ time }) => {
    update(time);
  }, []);

  if (!dndManager?.hitboxEntities) return null;

  return (
    <>
      {Array.from(dndManager?.hitboxEntities.entries()).map(([id, hb]) => {
        return (
          <HitBoxDebug
            zIndex={9998}
            color="tomato"
            key={id}
            hitbox={hb.getHitbox()}
          />
        );
      })}
    </>
  );
}
