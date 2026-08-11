# 2026-08-10 - Resolve the cm-language git dependency over https instead of ssh

**Why:** `yarn install` failed with `Host key verification failed` on any
machine without a GitHub SSH key. `obsidian-dataview` depends on
`@codemirror/language` as a git dependency
(`https://github.com/lishid/cm-language`), and the inherited `yarn.lock`
pinned it as `git+ssh://git@github.com/...`. This repo is cloned over
https, so no SSH key is set up, and the same is true of the hosted agent
sandbox. Fixing it in git config would not have travelled with the repo,
so the fix has to live in the lockfile.

**What:** Rewrote the single `resolved` line for `@codemirror/language@^6.0.0`
in `yarn.lock` from `git+ssh://` to `git+https://`. The commit SHA is
unchanged, so the installed package contents are identical, only the
transport differs. `yarn install --frozen-lockfile` now succeeds with no
SSH key present.
