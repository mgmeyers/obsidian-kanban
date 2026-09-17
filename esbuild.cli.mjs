import builtins from 'builtin-modules';
import esbuild from 'esbuild';
import { chmodSync } from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const shim = (name) => path.join(root, 'src/cli/shims', name);

/**
 * Modules that only exist for the running plugin. Each one either requires the
 * real `obsidian` module or touches the DOM while it loads, so the CLI bundle
 * swaps in a stub. Keep this list in sync with the aliases in vitest.config.ts.
 */
export const cliAlias = {
  obsidian: shim('obsidian.ts'),
  'obsidian-daily-notes-interface': shim('dailyNotes.ts'),
  'choices.js': shim('choices.ts'),
  'src/components/Item/MetadataTable': shim('metadataTable.ts'),
};

const entry = process.argv[2] ?? 'src/cli/index.ts';
const outfile = process.argv[3] ?? 'bin/kanban-cli.js';

const out = path.resolve(root, outfile);

await esbuild.build({
  entryPoints: [path.resolve(root, entry)],
  outfile: out,
  bundle: true,
  platform: 'node',
  target: 'node16',
  format: 'cjs',
  alias: cliAlias,
  // Must run before any plugin module: some read `window` or `app` while
  // they load. Mirrors `setupFiles` in vitest.config.ts.
  inject: [shim('globals.ts')],
  external: [...builtins],
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'info',
});

chmodSync(out, 0o755);
