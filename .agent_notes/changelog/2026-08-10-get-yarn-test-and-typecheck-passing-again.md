# 2026-08-10 - Get yarn test and yarn typecheck passing again

**Why:** Both were red on a clean install, which made the "run `yarn test`
and `yarn typecheck` before finishing" rule in `CLAUDE.md` impossible to
follow and left the markdown round-trip test, the one guard for "existing
boards must keep parsing", not running at all. None of the causes were in
the plugin logic; they were drift between the pinned dependencies and the
assumptions the code and test setup were written against.

**What:** Three independent fixes.

`yarn typecheck` reported 13 errors. Eleven were `Cannot find name 'app'`:
Obsidian exposes a global `app` at runtime but stopped declaring it in its
published typings, so `src/types.d.ts` now declares it alongside the
existing `Fragment` and `h` declarations. The other two were
`ViewState.state.file` being typed `unknown`; `setViewState` in
`src/main.ts` now reads it once into a typed local.

`yarn test` could not collect either test file. `src/lang/helpers.ts` reads
`window.localStorage` at import time, and `tests/setup.ts` only installed
its stub `if (!window.localStorage)` — under jsdom the property exists but
is a null-prototype object with no `Storage` methods, so the guard skipped
and the call blew up. The guard now checks for a working `getItem`.

The smoke test then failed on `Cannot find module 'obsidian'` from inside
`obsidian-daily-notes-interface`, which ships CJS only and `require`s
`obsidian`. Vite externalizes it, so the existing `obsidian` alias never
applied inside it, and neither `server.deps.inline` nor `ssr.noExternal`
changed that. Added `tests/mocks/obsidian-daily-notes-interface.ts` and
aliased the whole package, matching how `obsidian` and `obsidian-dataview`
are already handled.

40 tests pass, `yarn typecheck` is clean, `yarn build` succeeds.
