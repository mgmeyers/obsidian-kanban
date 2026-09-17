import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^obsidian$/, replacement: resolve(__dirname, 'src/cli/shims/obsidian.ts') },
      {
        find: /^obsidian-daily-notes-interface$/,
        replacement: resolve(__dirname, 'src/cli/shims/dailyNotes.ts'),
      },
      { find: /^choices\.js$/, replacement: resolve(__dirname, 'src/cli/shims/choices.ts') },
      {
        find: /^src\/components\/Item\/MetadataTable$/,
        replacement: resolve(__dirname, 'src/cli/shims/metadataTable.ts'),
      },
      { find: /^src\//, replacement: resolve(__dirname, 'src') + '/' },
    ],
  },
  test: {
    include: ['src/cli/**/*.test.ts'],
    setupFiles: [resolve(__dirname, 'src/cli/shims/globals.ts')],
  },
});
