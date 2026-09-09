// The one node API the tests need, declared rather than depended on.
//
// tsconfig sets `types: ["vite/client"]` and the repo has no @types/node —
// deliberately, since nothing in src/ touches node. `tests/icons.test.ts` and
// `tests/fonts.test.ts` read the stylesheets to check the icon sizes against the atlas cell, and the
// obvious alternative, Vite's `?raw`, returns an EMPTY STRING for a .css file
// under Vitest: the CSS pipeline claims the module first. Pulling in the whole
// of @types/node to type one readFileSync is the worse trade.
// `latin1` maps every byte to one char, so a test can read a PNG header
// without Buffer: `tests/characters.test.ts` checks the atlas size that way.
declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: 'utf8' | 'latin1'): string;
  export function readdirSync(path: string | URL): string[];
}

// And the one global: a slow harness reads an env knob to shorten a run while
// its policy is being written (`tests/thirtyDays.test.ts`).
declare const process: { env: Record<string, string | undefined> };
