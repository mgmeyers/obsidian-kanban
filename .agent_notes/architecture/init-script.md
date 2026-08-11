# Init Script and Project Initialization

The project initialization is managed through `yarn` commands defined in `package.json`.
The main verification pipeline is `yarn ci`, which runs all checks in sequence.

## Initialization Commands

### Installation
```bash
yarn install
```
Installs all dependencies. The `yarn.lock` file is committed and should resolve all dependencies
without requiring SSH credentials or external network access (uses git+https for all git deps).

### Full CI Pipeline
```bash
yarn ci
```
Runs the complete verification pipeline in order:
1. `yarn check:lock` - Verifies lockfile dependencies
2. `yarn typecheck` - TypeScript compilation check
3. `yarn typecheck:tests` - TypeScript compilation for test files
4. `yarn lint` - ESLint with max-warnings=0 (strict mode)
5. `yarn format:check` - Prettier formatting check
6. `yarn test` - vitest unit tests
7. `yarn build` - Production build (esbuild)

All steps must pass. A single failure blocks the pipeline.

## Individual Commands

### Development
- `yarn dev` - Watch mode for development (rebuilds on file changes)
- `yarn dev:demo` - Demo vault watch build

### Building
- `yarn build` - Production build → `main.js`, `styles.css`
- `yarn build:demo` - Build into demo vault → `demo_vault/.obsidian/plugins/kanban-custom/`

### Testing
- `yarn test` - Run vitest once
- `yarn test:watch` - Watch mode for tests

### Code Quality
- `yarn typecheck` - Type check source
- `yarn typecheck:tests` - Type check tests
- `yarn lint` - ESLint check (fails on warnings)
- `yarn lint:fix` - Auto-fix eslint violations
- `yarn format:check` - Check prettier formatting
- `yarn prettier` - Auto-format with prettier
- `yarn clean` - Run `prettier` then `lint:fix` (safe to run anytime)

## Dependencies Note

The `yarn.lock` is configured so all dependencies resolve over:
- npm registry (default)
- git+https (for git-hosted deps)

This means the project works in sandboxed environments that block SSH and tarballs from codeload.
Key examples:
- `obsidian` dep resolves via git+https instead of codeload tarball
- `cm-language` dep resolves via git+https instead of SSH

See `.agent_notes/changelog/2026-08-10-*` for the history of these fixes.
