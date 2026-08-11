# 2026-08-10 - Add a CI workflow and make lint enforceable

**Why:** Nothing ran the checks except a human remembering to. The last three
fixes on this fork were all "the checks stopped passing" — a lockfile that
needed an SSH key, a lockfile that needed a blocked tarball host, and a typecheck
that had drifted — which is exactly the class of breakage CI catches for free.

Two things had to change before a gate was possible. `yarn lint` failed on a
clean tree with 13 parse errors, because `tsconfig.json` only includes the files
the app imports and type-aware eslint rules refuse to parse anything outside the
program; gating on a command that never passed would have made CI permanently
red. And `yarn lint`'s `./src/**/*.{ts,tsx}` glob was expanded by whichever shell
ran it, so what actually got linted varied between dash, bash and eslint's own
globbing.

**What:** Added `.github/workflows/ci.yml` — one job on pushes to and PRs
against `custom` (never `main`, which mirrors upstream and has no test setup),
running install with `--frozen-lockfile`, a lockfile transport check, typecheck,
lint, format check, tests and a build. The checks report even after an earlier
one fails, so a run surfaces every problem at once; the build is left on the
default `success()`, because a bundle from a red tree is worth nothing.

Nothing is published from CI. An artifact would not have been installable
anyway — BRAT reads `manifest.json` / `main.js` / `styles.css` from GitHub
release assets, and an Actions artifact is a zip behind an authenticated API
call. Local `yarn build:demo` is reproducible enough via the lockfile.

Added `scripts/check-lockfile.mjs`, which allowlists the transports `yarn.lock`
may resolve over. `--frozen-lockfile` proves the lockfile matches
`package.json`; it does not prove the lockfile is installable here, which is
what actually broke twice.

Added `tsconfig.eslint.json` covering `src/` and `tests/` and pointed eslint at
it, switched the lint scripts to `eslint src tests --ext .ts,.tsx
--max-warnings 0`, and configured `no-unused-vars` with `argsIgnorePattern:
'^_'` so the two intentional unused args in the test mocks stay silent. Added
`format:check`, `check:lock` and a `ci` script that chains the whole gate.
Pinned node in `.nvmrc` and switched `release.yml` from `npm install` to
`yarn install --frozen-lockfile` so a release ships the dependency set CI
checked.
