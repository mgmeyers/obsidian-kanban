import classcat from 'classcat';
import { useMemo, useRef } from 'preact/compat';
import { c, generateInstanceId } from 'src/components/helpers';

import { EntityData, WithChildren } from '../types';
import { Droppable } from './Droppable';

export interface SortPlaceholderProps extends WithChildren {
  index: number;
  accepts: string[];
  className?: string;
  isStatic?: boolean;
}

export function SortPlaceholder({
  index,
  accepts,
  className,
  isStatic,
  children,
}: SortPlaceholderProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const data = useMemo<EntityData>(() => {
    return {
      id: generateInstanceId(),
      type: 'placeholder',
      accepts,
    };
  }, accepts);

  return (
    <div ref={measureRef} className={classcat([className, c('placeholder')])}>
      <div ref={elementRef}>
        {!isStatic ? (
          <Droppable
            elementRef={elementRef}
            measureRef={measureRef}
            id={data.id}
            index={index}
            data={data}
          >
            {children}
          </Droppable>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
