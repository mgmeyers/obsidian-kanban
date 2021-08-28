import { CoordinateShift, initialScrollState } from '../types';

export class ScrollStateManager {
  scrollStates: Map<string, CoordinateShift>;
  idScopes: Map<string, Set<string>>;

  constructor() {
    this.scrollStates = new Map();
    this.idScopes = new Map();
  }

  setScrollState(scopeId: string, id: string, state: CoordinateShift) {
    this.scrollStates.set(id, state);

    if (this.idScopes.has(id)) {
      const scopes = this.idScopes.get(id);

      if (!scopes.has(scopeId)) {
        scopes.add(scopeId);
      }
    } else {
      this.idScopes.set(id, new Set([scopeId]));
    }
  }

  getScrollState(id: string): CoordinateShift {
    if (this.scrollStates.has(id)) {
      return this.scrollStates.get(id);
    }

    return initialScrollState;
  }

  unmountScope(scopeId: string) {
    const toRemove: string[] = [];

    this.idScopes.forEach((scopes, id) => {
      if (scopes.has(scopeId)) {
        scopes.delete(scopeId);
        if (scopes.size === 0) {
          toRemove.push(id);
        }
      }
    });

    toRemove.forEach((id) => {
      this.idScopes.delete(id);
      this.scrollStates.delete(id);
    });
  }
}
