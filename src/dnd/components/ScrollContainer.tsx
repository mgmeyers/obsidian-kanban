import classcat from 'classcat';
import { ComponentChildren } from 'preact';
import { c } from 'src/components/helpers';

import { useStoredScrollState } from './ScrollStateContext';
import { Scrollable } from './Scrollable';

interface ScrollContainerProps {
  children?: ComponentChildren;
  className?: string;
  triggerTypes: string[];
  isStatic?: boolean;
  id: string;
  index?: number;
}

export function ScrollContainer({
  className,
  children,
  triggerTypes,
  isStatic,
  id,
  index,
}: ScrollContainerProps) {
  const { setRef, scrollRef } = useStoredScrollState(id, index);

  return (
    <div ref={setRef} className={classcat([className, c('scroll-container')])}>
      {isStatic ? (
        children
      ) : (
        <Scrollable scrollRef={scrollRef} triggerTypes={triggerTypes}>
          {children}
        </Scrollable>
      )}
    </div>
  );
}
