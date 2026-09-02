// The one node API the tests need, declared rather than depended on.
//
// tsconfig sets `types: ["vite/client"]` and the repo has no @types/node —
// deliberately, since nothing in src/ touches node. `tests/icons.test.ts` and
// `tests/fonts.test.ts` read the stylesheets to check the icon sizes against the atlas cell, and the
// obvious alternative, Vite's `?raw`, returns an EMPTY STRING for a .css file
// under Vitest: the CSS pipeline claims the module first. Pulling in the whole
// of @types/node to type one readFileSync is the worse trade.
declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: 'utf8'): string;
  export function readdirSync(path: string | URL): string[];
}
