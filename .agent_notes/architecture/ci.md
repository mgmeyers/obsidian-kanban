# CI

What GitHub Actions runs, and the local equivalent (`yarn ci`).

## Workflows

- `.github/workflows/ci.yml` — the gate. Runs on pushes to `custom`, on PRs
  targeting `custom`, and on manual dispatch.
  **Not on `main`**: `main` mirrors upstream and has no `tests/`, no
  `vitest.config.ts` and no fork tooling, so a run there fails for reasons that
  may not be fixed on that branch.
- `.github/workflows/release.yml` — upstream's release job, on tag push. Builds
  with `yarn install --frozen-lockfile` (not `npm install`) so a release is the
  same dependency set CI checked, and takes its node version from `.nvmrc` like
  CI does.

## The gate

One job, one runner, checks as steps. Every step after `Install` carries
`if: ${{ !cancelled() && steps.install.outcome == 'success' }}`, so a failing
typecheck still lets lint, tests and the build report — one run shows every
problem instead of one problem per round trip. Nothing runs if the install
itself failed.

| Step | Command | Guards |
| --- | --- | --- |
| Install | `yarn install --frozen-lockfile` | `yarn.lock` agrees with `package.json` |
| Lockfile untouched | `git diff --exit-code -- yarn.lock package.json` | the install did not rewrite either file |
| Lockfile transports | `yarn check:lock` | every dep resolves over npm or `git+https` |
| Typecheck | `yarn typecheck` | `tsc --noemit` over `tsconfig.json` |
| Lint | `yarn lint` | eslint over `src/` + `tests/`, `--max-warnings 0` |
| Format | `yarn format:check` | prettier check over `src/` + `tests/` |
| Test | `yarn test` | the vitest suite, see [testing.md](testing.md) |
| Build | `yarn build` | esbuild + less actually produce a bundle |

The build's `main.js`, `styles.css` and `manifest.json` are uploaded as an
artifact (14 days). CI cannot open Obsidian, so that download is how a change
gets checked in a real vault before merge.

`yarn ci` chains the same commands locally, in the same order, and takes about
25s on a warm `node_modules`.

## Lockfile checking

`scripts/check-lockfile.mjs` allowlists the transports every `resolved` line may
use: `https://registry.npmjs.org/`, `git+https://`, and a bare
`https://github.com/<owner>/<repo>#<40-char sha>` (a git dep, not a download).
Anything else fails with the line number and a fix hint; SSH URLs and
codeload/github tarballs get a specific message, because those are the two that
have already broken an install here. `--frozen-lockfile` cannot catch them — the
lockfile is perfectly in sync, it just points at something unreachable.

`node scripts/check-lockfile.mjs <path>` runs it against a fixture instead.

## Toolchain pinning

`.nvmrc` holds the node version (22), and both workflows read it with
`setup-node`'s `node-version-file`. Bump it in one place.

## Gotchas

- `tsconfig.json` only includes `src/*.ts(x)` plus what those files import, so
  type-aware eslint rules used to die with "TSConfig does not include this file"
  on 13 files (locales, flatpickr plugins, ambient `.d.ts`). Lint therefore runs
  against **`tsconfig.eslint.json`**, which includes all of `src/` and `tests/`.
  Typecheck still uses `tsconfig.json`, so `tests/` is not typechecked.
- Lint runs with `--max-warnings 0`. Name a deliberately unused argument `_foo`;
  `@typescript-eslint/no-unused-vars` is configured with
  `argsIgnorePattern: '^_'`.
- `yarn lint` used to be `eslint ./src/**/*.{ts,tsx}`, whose coverage depended on
  whether the shell running it expands `**` and braces. It is `eslint src tests
  --ext .ts,.tsx` now, which globs the same way everywhere.
- `src/lang/helpers.ts:22` imports the Ukrainian locale from `./locale/tr`
  (upstream bug), which is why `src/lang/locale/uk.ts` is in no TS program. Left
  alone — fixing it is an upstream change, not a CI one.
- Prettier checks `src/` and `tests/` only. The root `.mjs` files
  (`buffer-es6.mjs`, `version-bump.mjs`) are upstream's and are not
  prettier-clean; reformatting them would create merge conflicts for no gain.
