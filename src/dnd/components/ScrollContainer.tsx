import React from "react";
import classcat from "classcat";
import { Scrollable } from "./Scrollable";
import { useStoredScrollState } from "./ScrollStateContext";

interface ScrollContainerProps {
  children?: React.ReactNode;
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
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useStoredScrollState(id, index, scrollRef);

  React.useEffect(() => {
    if (isStatic) {
      scrollRef.current?.style.setProperty("overflow", "hidden");
    } else {
      scrollRef.current?.style.removeProperty("overflow");
    }
  }, [isStatic]);

  React.useEffect(() => {
    if (isStatic) return;

    scrollRef.current?.style.setProperty("overflow", "hidden");

    const timeout = setTimeout(() => {
      scrollRef.current?.style.removeProperty("overflow");
    }, 10);

    return () => {
      clearTimeout(timeout);
    };
  }, [id, index, isStatic]);

  return (
    <div ref={scrollRef} className={classcat([className, "scroll-container"])}>
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
