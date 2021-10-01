import React from 'react';

import { generateInstanceId } from 'src/components/helpers';

import { WithChildren } from '../types';
import { ScopeIdContext, ScrollStateContext } from './context';

interface ScopeProps extends WithChildren {
  id?: string;
}

export function DndScope({ id, children }: ScopeProps) {
  const scrollStateManager = React.useContext(ScrollStateContext);
  const scopeId = React.useMemo(() => id || generateInstanceId(), [id]);

  React.useEffect(() => {
    return () => {
      scrollStateManager.unmountScope(id);
    };
  }, [id]);

  return (
    <ScopeIdContext.Provider value={scopeId}>
      {children}
    </ScopeIdContext.Provider>
  );
}
