// A number the game states is not a number the reader's system settings get
// a vote on.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatExact } from '../src/ui/format';

/** Every file under `src/`, relative. Cast because the repo's `node:fs`
 *  types carry only the one-argument `readdirSync`. */
const walk = (dir: URL): string[] =>
  (readdirSync as unknown as (p: URL, o: { recursive: true }) => string[])(
    dir, { recursive: true });

describe('numbers the game prints', () => {
  it('never asks the viewer’s browser how to group them', () => {
    // `n.toLocaleString()` with no locale reads the BROWSER's. The collection
    // sheet's 25,000-Gem prize rendered "25.000" on a Spanish machine, where
    // an English-reading player sees twenty-five. The tree editor had already
    // been bitten and worked around it locally; this is the rule instead.
    const offenders: string[] = [];
    const root = new URL('../src/', import.meta.url);
    for (const file of walk(root)) {
      if (!/\.ts$/.test(file)) continue;
      const src = readFileSync(new URL(file, root), 'utf8');
      for (const [i, line] of src.split('\n').entries()) {
        // Only a COMMENT is exempt, matched as one: `line.includes('*')`
        // would also excuse `(a * b).toLocaleString()`.
        const t = line.trim();
        if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) continue;
        if (/toLocaleString\(\s*\)/.test(line)) {
          offenders.push(`${file}:${i + 1}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('prices in one currency, through one formatter', () => {
    // The pass sheet and the daily sheet each wrote their own
    // `€${x.priceUsd.toFixed(2)}` — a euro sign over a field named USD,
    // contradicting their own data and the $ every other price uses. The
    // game prices in dollars and `formatUsd` is where that is decided, so
    // no other currency sign belongs in the source at all.
    const offenders: string[] = [];
    const root = new URL('../src/', import.meta.url);
    for (const file of walk(root)) {
      if (!/\.ts$/.test(file)) continue;
      for (const [i, line] of readFileSync(new URL(file, root), 'utf8').split('\n').entries()) {
        const t2 = line.trim();
        if (t2.startsWith('*') || t2.startsWith('//') || t2.startsWith('/*')) continue;
        if (/[€£¥]/.test(line)) offenders.push(`${file}:${i + 1}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('groups the same way wherever it runs', () => {
    expect(formatExact(25_000)).toBe('25,000');
    expect(formatExact(1_234_567)).toBe('1,234,567');
    expect(formatExact(999)).toBe('999');
    expect(formatExact(0)).toBe('0');
  });
});
