# 2026-08-11 - Typecheck tests/ in CI

**Why:** `tests/` was in no TS program. `tsconfig.json` includes the app's entry
files plus whatever they import, so `yarn typecheck` never looked at a test or a
test helper, and CI could not catch one that stopped compiling. The suite is this
fork's safety net for the markdown round-trip, so it is worth holding to the same
bar as `src/`.

Pointing `tsc` at the existing `tsconfig.eslint.json` was not an option: that
project covers all of `src/`, including upstream files the app never imports
(the flatpickr plugins), whose implicit-any errors are not this fork's to fix.

**What:** Added `tsconfig.tests.json`, which includes `tests/` and lets the
`src/` modules the tests use arrive through imports — the same way
`tsconfig.json` reaches `src/` subdirectories — plus `src/types.d.ts`, which
declares the globals Obsidian injects and which nothing imports. Added a
`typecheck:tests` script, wired into `yarn ci` and into the workflow as its own
step next to `Typecheck`.

Its `lib` is `es2022`, against `es2018` in the base config. Tests run under node
via vitest rather than in the bundle esbuild targets, so `Array.prototype.at` in
the smoke test is legitimate there. Bumping the base config would change what
`src/` is allowed to compile against and is a separate decision, so `src/` stays
on es2018.

Fixed the nine errors this turned up. `harness.ts` now imports `TFile` from
`../mocks/obsidian` instead of from `obsidian`: the vitest alias means the stub
is what runs, and the stub's constructor takes a path where the published
typings declare a zero-argument one — the cast that would have silenced this
would have hidden a real mismatch. The rest were `TS7011` in `setup.ts`, where
`strictNullChecks` being off widens a returned `null` to `any`; the stubs
returning `null` or `[]` now say what they return.
