# Tests

`yarn test` runs vitest (`vitest.config.ts`, specs in `tests/`).

- There is no runtime `obsidian` module, so vitest aliases `obsidian` and `obsidian-dataview` to stubs in `tests/mocks/`.
  The `obsidian` stub implements `moment`, `TFile`, a flat-map `parseYaml` / `stringifyYaml`, and class stubs for everything else.
- `obsidian-daily-notes-interface` is aliased to a stub too.
  It ships CJS only and `require`s `obsidian`, so Vite externalizes it and the `obsidian` alias never applies inside it — aliasing the whole package is the only thing that works.
  `server.deps.inline` and `ssr.noExternal` both fail to stop the externalization.
- `tests/setup.ts` installs the prototype extensions Obsidian adds (`Array.prototype.last` and friends — `dnd/util/data.ts` depends on `last()`), a `window`/`activeWindow`, and a global `app` stub.
  `stubApp({ tasksPlugin, tasksSettings })` swaps in a fake Tasks plugin, which is how the recurring-task behavior is tested.
- The environment is `jsdom`, because `Settings.ts` pulls in `choices.js`, which touches `document` at import time.
- `tests/helpers/harness.ts` boots a **real** `StateManager` over a markdown string with a `FakeKanbanView`.
  `view.saved` collects what `saveToDisk` writes, so a smoke test can assert on markdown in / markdown out through the real parser, settings resolution and serializer.
  `registerView` is async and the constructor does not await it, hence the small delay in `loadBoard`.
- The round-trip test in `tests/completeItem.smoke.test.ts` is the guard for "existing boards must keep parsing" — it asserts serialization is stable across a reparse.
- Two tests load the demo vault's board from disk, so an example that stops working fails the suite.
  See [demo-vault.md](demo-vault.md).

## Gotchas

- `src/lang/helpers.ts` reads `window.localStorage` at **import** time, so every test file needs it before any source module loads.
  Under jsdom `window === globalThis` and `localStorage` is present but is a null-prototype object with no `Storage` methods, so a `if (!window.localStorage)` guard silently skips the stub.
  `tests/setup.ts` checks for `typeof localStorage?.getItem === 'function'` instead.
- Only `src/*.ts` and `src/*.tsx` are in `tsconfig.json`'s `include`; subdirectories are pulled in through imports.
  `tests/` has its own program, `tsconfig.tests.json`, run by `yarn typecheck:tests` — see [ci.md](ci.md).
- `harness.ts` imports `TFile` from `../mocks/obsidian`, not from `obsidian`.
  The alias means the stub is what runs, and its constructor takes a path where the published typings declare a zero-argument one.
- `setup.ts` annotates the return type of every stub that returns `null` or `[]`.
  `strictNullChecks` is off, so `null` widens to `any` and `noImplicitAny` rejects the function (TS7011).
