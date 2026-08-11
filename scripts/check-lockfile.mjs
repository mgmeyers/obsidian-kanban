#!/usr/bin/env node
// Checks which transports yarn.lock resolves dependencies over.
//
// `yarn install --frozen-lockfile` already proves the lockfile agrees with
// package.json. It does not prove the lockfile is installable *here*: two
// installs have broken on the transport alone, and neither is something git
// config can fix, because git config does not travel with the repo.
//
//   - a cm-language git dep resolved over ssh, which needs a GitHub SSH key.
//   - the obsidian-api dep resolved to a codeload.github.com source tarball,
//     which the sandbox egress proxy rejects with a 403.
//
// Both were fixed by rewriting `resolved` lines to git+https. This script keeps
// them fixed, so a stray `yarn add` cannot quietly reintroduce either one.
// See .agent_notes/changelog/2026-08-10-pin-cm-language-over-https-instead-of-ssh.md
// and .agent_notes/changelog/2026-08-10-fetch-the-obsidian-api-dep-over-git-instead-of-a-codeload-tarball.md.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// argv[2] is only there so the checker itself can be pointed at a fixture.
const lockfile =
  process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', 'yarn.lock');

// Transports known to work both on a normal dev machine and behind the proxy.
const allowed = [
  /^https:\/\/registry\.npmjs\.org\//,
  /^git\+https:\/\//,
  // A bare github.com URL pinned to a commit is a git dep, not a download.
  /^https:\/\/github\.com\/[^/]+\/[^/]+#[0-9a-f]{40}$/,
];

// Matched first, so the common breakages explain themselves.
const known = [
  [/^(git\+)?ssh:/, 'resolves over SSH, which needs a GitHub key that CI and the sandbox do not have'],
  [/codeload\.github\.com/, 'downloads a source tarball from codeload.github.com, which the egress proxy blocks with a 403'],
  [/^https:\/\/github\.com\/.*\.(tar\.gz|tgz|zip)$/, 'downloads a source archive from github.com, which the egress proxy blocks'],
];

const problems = [];

readFileSync(lockfile, 'utf8')
  .split('\n')
  .forEach((line, i) => {
    const match = line.match(/^\s+resolved "([^"]+)"$/);
    if (!match) return;

    const url = match[1];
    if (allowed.some((pattern) => pattern.test(url))) return;

    const reason = known.find(([pattern]) => pattern.test(url))?.[1] ?? 'uses an unrecognized transport';
    problems.push({ line: i + 1, url, reason });
  });

if (problems.length > 0) {
  const count = problems.length === 1 ? '1 dependency resolves' : `${problems.length} dependencies resolve`;
  console.error(`${count} over a transport that is not allowed:\n`);
  for (const { line, url, reason } of problems) {
    console.error(`  ${lockfile}:${line}`);
    console.error(`    ${url}`);
    console.error(`    ${reason}\n`);
  }
  console.error('Rewrite the `resolved` line to git+https://github.com/<owner>/<repo>.git#<sha>,');
  console.error('keeping the same commit, then reinstall with --frozen-lockfile to verify.');
  process.exit(1);
}

console.log('yarn.lock: all dependencies resolve over the npm registry or git+https.');
