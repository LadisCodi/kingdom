// A number the game states is not a number the reader's system settings get
// a vote on.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatExact } from '../src/ui/format';

const walk = (dir: URL): string[] => readdirSync(dir).flatMap((name) => {
  const child = new URL(`${name}${statSync(new URL(name, dir)).isDirectory() ? '/' : ''}`, dir);
  return statSync(child).isDirectory() ? walk(child) : [child.pathname];
});

describe('numbers the game prints', () => {
  it('never asks the viewer’s browser how to group them', () => {
    // `n.toLocaleString()` with no locale reads the BROWSER's. The collection
    // sheet's 25,000-Gem prize rendered "25.000" on a Spanish machine, where
    // an English-reading player sees twenty-five. The tree editor had already
    // been bitten and worked around it locally; this is the rule instead.
    const offenders: string[] = [];
    for (const file of walk(new URL('../src/', import.meta.url))) {
      if (!/\.ts$/.test(file)) continue;
      const src = readFileSync(file, 'utf8');
      for (const [i, line] of src.split('\n').entries()) {
        // Only a COMMENT is exempt, matched as one: `line.includes('*')`
        // would also excuse `(a * b).toLocaleString()`.
        const t = line.trim();
        if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) continue;
        if (/toLocaleString\(\s*\)/.test(line)) {
          offenders.push(`${file.split('/src/')[1]}:${i + 1}`);
        }
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
