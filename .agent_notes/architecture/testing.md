# Tests

`yarn test` runs vitest (`vitest.config.ts`, specs in `tests/`).

- There is no runtime `obsidian` module, so vitest aliases `obsidian` and `obsidian-dataview` to stubs in `tests/mocks/`.
  The `obsidian` stub implements `moment`, `TFile`, a flat-map `parseYaml` / `stringifyYaml`, and class stubs for everything else.
- `tests/setup.ts` installs the prototype extensions Obsidian adds (`Array.prototype.last` and friends — `dnd/util/data.ts` depends on `last()`), a `window`/`activeWindow`, and a global `app` stub.
  `stubApp({ tasksPlugin, tasksSettings })` swaps in a fake Tasks plugin, which is how the recurring-task behavior is tested.
- The environment is `jsdom`, because `Settings.ts` pulls in `choices.js`, which touches `document` at import time.
- `tests/helpers/harness.ts` boots a **real** `StateManager` over a markdown string with a `FakeKanbanView`.
  `view.saved` collects what `saveToDisk` writes, so a smoke test can assert on markdown in / markdown out through the real parser, settings resolution and serializer.
  `registerView` is async and the constructor does not await it, hence the small delay in `loadBoard`.
- The round-trip test in `tests/completeItem.smoke.test.ts` is the guard for "existing boards must keep parsing" — it asserts serialization is stable across a reparse.
- Two tests load the demo vault's board from disk, so an example that stops working fails the suite.
  See [demo-vault.md](demo-vault.md).
