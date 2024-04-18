import Preact from 'preact/compat';
import { generateInstanceId } from 'src/components/helpers';

import { WithChildren } from '../types';
import { ScopeIdContext, ScrollStateContext } from './context';

interface ScopeProps extends WithChildren {
  id?: string;
}

export function DndScope({ id, children }: ScopeProps) {
  const scrollStateManager = Preact.useContext(ScrollStateContext);
  const scopeId = Preact.useMemo(() => id || generateInstanceId(), [id]);

  Preact.useEffect(() => {
    return () => {
      scrollStateManager.unmountScope(id);
    };
  }, [id]);

  return <ScopeIdContext.Provider value={scopeId}>{children}</ScopeIdContext.Provider>;
}
