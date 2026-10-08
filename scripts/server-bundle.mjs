// The world server's rules as one ES module for the Supabase edge function
// (Deno): `src/worldServer/serve.ts` and everything it reads — the sim, the
// game data inlined — bundled with no browser in it.
//
//   npm run server:bundle    → supabase/functions/_shared/world.js
//
// The output is built, never committed. tests/serverBundle.test.ts builds it
// in memory and holds it to the same check.

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ENTRY = path.join(root, 'src/worldServer/serve.ts');
export const OUT = path.join(root, 'supabase/functions/_shared/world.js');

/** What a server bundle must never reach for: the browser, and Vite. */
export const FORBIDDEN = ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'HTMLElement', 'import.meta'];

/** Bundle the world server. Returns the code; writes it only when asked. */
export async function bundleWorldServer({ write = false } = {}) {
  const result = await build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    write: false,
    legalComments: 'none',
    // Whitespace and syntax only: names stay readable in a stack trace, and
    // no comment is left for the browser check to misread.
    minifyWhitespace: true,
    minifySyntax: true,
    banner: { js: '// Built by scripts/server-bundle.mjs from src/worldServer/serve.ts. Do not edit.' },
    // The server reads English (Docs/features/28-languages.md §1): the Spanish
    // catalogs and data overlays are left out, as empty documents.
    plugins: [{
      name: 'english-only',
      setup(b) {
        b.onResolve({ filter: /^\.\/es\/.*\.json$/ }, (args) => (args.resolveDir.endsWith(path.join('src', 'i18n'))
          ? { path: args.path, namespace: 'english-only' } : undefined));
        b.onLoad({ filter: /.*/, namespace: 'english-only' }, () => ({ contents: '{}', loader: 'json' }));
      },
    }],
  });
  const code = result.outputFiles[0].text;
  if (write) {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(path.dirname(OUT), { recursive: true });
    await writeFile(OUT, code);
  }
  return code;
}

/** The forbidden names a bundle uses, as code rather than inside a string. */
export function browserReferences(code) {
  return FORBIDDEN.filter((name) => {
    const word = name.replace('.', '\\.');
    return new RegExp(`(?<![\\w.'"\`])${word}(?![\\w'"\`])`).test(code);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const code = await bundleWorldServer({ write: true });
  const bad = browserReferences(code);
  if (bad.length > 0) {
    console.error(`server bundle reaches for the browser: ${bad.join(', ')}`);
    process.exit(1);
  }
  console.log(`${path.relative(root, OUT)} — ${(code.length / 1024).toFixed(0)} KB`);
}
