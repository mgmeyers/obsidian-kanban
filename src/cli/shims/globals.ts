/**
 * Obsidian augments a handful of built-in prototypes and runs the plugin inside
 * a browser window. The parser relies on both. This module recreates only the
 * pieces it touches, and must be evaluated before any `src/` module is loaded.
 */

declare global {
  interface Array<T> {
    first(): T | undefined;
    last(): T | undefined;
    remove(item: T): void;
  }

  interface String {
    contains(target: string): boolean;
  }
}

function define(target: any, name: string, value: any) {
  if (target[name]) return;
  Object.defineProperty(target, name, { value, enumerable: false, writable: true });
}

define(Array.prototype, 'first', function (this: any[]) {
  return this.length ? this[0] : undefined;
});

define(Array.prototype, 'last', function (this: any[]) {
  return this.length ? this[this.length - 1] : undefined;
});

define(Array.prototype, 'remove', function (this: any[], item: any) {
  const index = this.indexOf(item);
  if (index > -1) this.splice(index, 1);
});

define(String.prototype, 'contains', function (this: string, target: string) {
  return this.indexOf(target) > -1;
});

const store = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => (store.has(key) ? store.get(key) : null),
  setItem: (key: string, value: string): void => void store.set(key, String(value)),
  removeItem: (key: string): void => void store.delete(key),
  clear: () => store.clear(),
};

const g = globalThis as any;

if (!g.window) g.window = g;
if (!g.window.localStorage) g.window.localStorage = localStorage;
if (!g.localStorage) g.localStorage = localStorage;

// Obsidian exposes the app as a global; the parser reads it to check for
// optional plugins such as dataview.
if (!g.app) {
  g.app = {
    plugins: { plugins: {}, enabledPlugins: new Set<string>() },
    internalPlugins: { plugins: {} },
    workspace: { editorSuggest: { suggests: [] as any[] } },
    metadataCache: {
      getFirstLinkpathDest: (): null => null,
      getFileCache: (): null => null,
    },
    // Obsidian defaults to tab indentation; multi-line cards are written the
    // same way here so boards edited in either place stay byte-identical.
    vault: { getConfig: (key: string) => (key === 'useTab' ? true : undefined) },
  };
}

export {};
