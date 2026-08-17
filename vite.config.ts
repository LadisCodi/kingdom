import { defineConfig } from 'vite';

// GitHub Pages serves project sites under /<repo>/; local dev serves from /.
export default defineConfig({
  base: process.env.GHPAGES ? '/kingdom/' : '/',
});
