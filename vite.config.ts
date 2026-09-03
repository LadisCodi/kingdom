import { defineConfig } from 'vite';
// @ts-expect-error — plain ESM, dev-only, no types worth authoring for it.
import { mapEditorPlugin } from './scripts/vite-map-editor.mjs';

// GitHub Pages serves project sites under /<repo>/; local dev serves from /.
export default defineConfig({
  base: process.env.GHPAGES ? '/kingdom/' : '/',
  // Dev only (the plugin declares `apply: 'serve'`): the save endpoint behind
  // ?dev=map. See scripts/vite-map-editor.mjs.
  plugins: [mapEditorPlugin()],
});
