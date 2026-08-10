# 2026-08-10 - Fetch the obsidian-api dep over git instead of a codeload tarball

**Why:** `yarn install` still failed in the Claude Code cloud sandbox, after
the cm-language ssh fix, on a different dependency:
`https://codeload.github.com/obsidianmd/obsidian-api/tar.gz/cc17443... 403
Forbidden`. `package.json` asks for `obsidian@^1.5.7-1`, and the inherited
`yarn.lock` resolved it to a source tarball on `codeload.github.com`. The
sandbox routes outbound https through a policy-enforcing egress proxy that
does not allow that host, nor `github.com/.../archive/*.tar.gz`. The git
transport to the same repo is allowed, so the content was reachable — only
the tarball download path was not. Like the cm-language case, git config
would not travel with the repo, so the fix has to live in the lockfile.

**What:** Rewrote the single `resolved` line for
`obsidian@^1.5.7-1, obsidian@obsidianmd/obsidian-api#master` in `yarn.lock`
from the `codeload.github.com` tarball URL to
`git+https://github.com/obsidianmd/obsidian-api.git#<sha>`. The commit SHA is
unchanged, so the installed package contents are identical, only the
transport differs. Verified with a cold yarn cache and
`--frozen-lockfile` (so yarn accepts the lockfile without rewriting it): the
install resolves `obsidian@1.13.2` and `yarn typecheck`, `yarn test` and
`yarn build` all pass. `git+https` needs no SSH key and no proxy allowance,
so it works on a normal dev machine and in the sandbox alike.
