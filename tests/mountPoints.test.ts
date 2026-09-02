// `src/main.ts` reaches into the DOM with non-null-asserted getElementById.
// The `!` tells the compiler to stop worrying, so renaming an id in
// index.html — or adding a mount to main.ts and forgetting the markup —
// typechecks, builds, deploys, and then throws on the first line of boot().
//
// This is not a DOM test: it reads both files as text via Vite's `?raw`
// (node:fs is untyped here — tsconfig ships only `vite/client`). No jsdom.
import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import main from '../src/main.ts?raw';

describe('DOM mount points', () => {
  it('every id main.ts reaches for exists in index.html', () => {
    const wanted = [...main.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
    expect(wanted.length).toBeGreaterThan(0); // the regex itself must keep working

    const declared = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const missing = [...new Set(wanted)].filter((id) => !declared.has(id));

    expect(missing).toEqual([]);
  });
});
