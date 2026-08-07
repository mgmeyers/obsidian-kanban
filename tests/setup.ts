/**
 * Obsidian patches a handful of prototypes and exposes a global `app`. The
 * plugin leans on both, so tests need them before any source module loads.
 */

// `src/lang/helpers.ts` reads localStorage at import time
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (!(globalThis as any).window.localStorage) {
  (globalThis as any).window.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}
if (typeof (globalThis as any).activeWindow === 'undefined') {
  (globalThis as any).activeWindow = (globalThis as any).window;
}

function define(proto: any, name: string, fn: any) {
  if (!proto[name]) {
    Object.defineProperty(proto, name, { value: fn, enumerable: false, writable: true });
  }
}

define(Array.prototype, 'first', function (this: any[]) {
  return this.length ? this[0] : undefined;
});

define(Array.prototype, 'last', function (this: any[]) {
  return this.length ? this[this.length - 1] : undefined;
});

define(Array.prototype, 'contains', function (this: any[], target: any) {
  return this.indexOf(target) !== -1;
});

define(Array.prototype, 'remove', function (this: any[], target: any) {
  const index = this.indexOf(target);
  if (index !== -1) this.splice(index, 1);
  return this;
});

define(Array.prototype, 'unique', function (this: any[]) {
  return Array.from(new Set(this));
});

export interface TasksPluginStub {
  apiV1?: {
    executeToggleTaskDoneCommand?: (line: string, path: string) => string;
  };
}

export interface AppStubOptions {
  /** Registers a fake `obsidian-tasks-plugin` when supplied. */
  tasksPlugin?: TasksPluginStub;
  /** Fake Tasks settings, read for status symbols and `recurrenceOnNextLine`. */
  tasksSettings?: any;
}

/**
 * Replaces the global `app` with a stub. Returns a restore function.
 */
export function stubApp(options: AppStubOptions = {}) {
  const previous = (globalThis as any).app;
  const enabledPlugins = new Set<string>();
  const plugins: Record<string, any> = {};

  if (options.tasksPlugin) {
    enabledPlugins.add('obsidian-tasks-plugin');
    plugins['obsidian-tasks-plugin'] = options.tasksPlugin;
  }

  (globalThis as any).app = {
    plugins: { enabledPlugins, plugins },
    internalPlugins: { plugins: {} },
    workspace: {
      editorSuggest: {
        suggests: options.tasksSettings ? [{ settings: options.tasksSettings }] : [],
      },
    },
    metadataCache: {
      getFirstLinkpathDest: () => null,
      getFileCache: () => null,
    },
    vault: {
      getAbstractFileByPath: () => null,
      getMarkdownFiles: () => [],
      getConfig: (key: string) => (key === 'useTab' ? false : undefined),
    },
  };

  return () => {
    (globalThis as any).app = previous;
  };
}

/** A `taskFormat` settings object shaped like the Tasks plugin's. */
export function tasksSettings(overrides: any = {}) {
  return {
    taskFormat: 'tasksPluginEmoji',
    recurrenceOnNextLine: false,
    statusSettings: {
      coreStatuses: [
        { symbol: ' ', type: 'TODO', nextStatusSymbol: 'x' },
        { symbol: 'x', type: 'DONE', nextStatusSymbol: ' ' },
      ],
      customStatuses: [],
    },
    ...overrides,
  };
}

// A default stub so modules that read `app` at import time don't explode.
stubApp();
