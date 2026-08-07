import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  resolve: {
    alias: {
      // `obsidian` and `obsidian-dataview` only exist inside the app
      obsidian: resolve(__dirname, 'tests/mocks/obsidian.ts'),
      'obsidian-dataview': resolve(__dirname, 'tests/mocks/obsidian-dataview.ts'),
      // tsconfig baseUrl makes `src/...` imports absolute from the repo root
      src: resolve(__dirname, 'src'),
      react: resolve(__dirname, 'node_modules/preact/compat'),
      'react-dom': resolve(__dirname, 'node_modules/preact/compat'),
    },
  },
  test: {
    environment: 'jsdom',
    server: {
      // These import `obsidian`, so they have to go through the alias above
      deps: { inline: ['obsidian-daily-notes-interface'] },
    },
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
