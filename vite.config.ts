import { defineConfig } from 'vite';
// @ts-expect-error — plain ESM, dev-only, no types worth authoring for it.
import { mapEditorPlugin } from './scripts/vite-map-editor.mjs';
// @ts-expect-error — same.
import { treeEditorPlugin } from './scripts/vite-tree-editor.mjs';

// GitHub Pages serves project sites under /<repo>/; local dev serves from /.
export default defineConfig({
  base: process.env.GHPAGES ? '/kingdom/' : '/',
  // Dev only (both plugins declare `apply: 'serve'`): the save endpoints
  // behind ?dev=map and ?dev=tree. See scripts/vite-map-editor.mjs and
  // scripts/vite-tree-editor.mjs.
  plugins: [mapEditorPlugin(), treeEditorPlugin()],
});
