/// <reference types="vitest" />
import { defineConfig } from 'vite';
// @ts-expect-error — plain ESM, dev-only, no types worth authoring for it.
import { mapEditorPlugin } from './scripts/vite-map-editor.mjs';
// @ts-expect-error — same.
import { treeEditorPlugin } from './scripts/vite-tree-editor.mjs';
// @ts-expect-error — same.
import { dataEditorPlugin } from './scripts/vite-data-editor.mjs';

// GitHub Pages serves project sites under /<repo>/; local dev serves from /.
export default defineConfig({
  base: process.env.GHPAGES ? '/kingdom/' : '/',
  // Dev only (all three declare `apply: 'serve'`): the save endpoints behind
  // ?dev=data and the map and tree it hosts, and the rule that a data file
  // changing is an event, not a reload (scripts/vite-data-editor.mjs).
  plugins: [mapEditorPlugin(), treeEditorPlugin(), dataEditorPlugin()],
  // Every sprite ships as a cacheable URL. Vite's 4 KB default inlined the
  // small ones as data: URIs, which iOS Safari re-decodes for every fresh
  // <img> — the store's gem packs blinked once a second (host.ts, sprites.ts).
  build: { assetsInlineLimit: 0 },
  // The suite reads numbers in English whatever the machine's locale is.
  test: { setupFiles: ['tests/setup.ts'] },
});
