import React from "react";

export function useRefSetter<T>(def: T) {
  const [, setHaveRef] = React.useState(false);
  const ref = React.useRef<T>(def);

  const setRef = React.useCallback((val: T) => {
    if (!ref.current) {
      setHaveRef(true);
    }

    ref.current = val;
  }, []);

  return [ref, setRef] as [React.MutableRefObject<T>, (val: T) => void];
}
