// Every number the game prints is written the viewer's way — *25,000* in
// London, *25.000* in Madrid — and through one formatter (src/ui/format.ts).
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  formatCount, formatExact, formatShort, formatUsd, setNumberLocale,
} from '../src/ui/format';

/** Every file under `src/`, relative. Cast because the repo's `node:fs`
 *  types carry only the one-argument `readdirSync`. */
const walk = (dir: URL): string[] =>
  (readdirSync as unknown as (p: URL, o: { recursive: true }) => string[])(
    dir, { recursive: true });

describe('numbers the game prints', () => {
  afterEach(() => setNumberLocale('en-US')); // tests/setup.ts

  it('ask for the locale in one place only', () => {
    // src/ui/format.ts holds the viewer's locale and caches its formatters.
    // A `toLocaleString` or an `Intl.NumberFormat` anywhere else is a number
    // that will not follow it (or, in src/sim, a sim that reads the browser).
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
        if (file.replace(/\\/g, '/') === 'ui/format.ts') continue;
        if (/toLocaleString\(|Intl\.NumberFormat/.test(line)) {
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

  it('groups and points the English way in English', () => {
    setNumberLocale('en-US');
    expect(formatExact(25_000)).toBe('25,000');
    expect(formatExact(1_234_567)).toBe('1,234,567');
    expect(formatExact(999)).toBe('999');
    expect(formatExact(0)).toBe('0');
    expect(formatCount(9_999)).toBe('9,999');
    expect(formatCount(12_345)).toBe('12k');
    expect(formatCount(1_250_000)).toBe('1.3M');
    expect(formatShort(7_299)).toBe('7.2k');
    expect(formatUsd(199)).toBe('$1.99');
    expect(formatUsd(200_000)).toBe('$2,000.00');
  });

  it('groups and points the Spanish way in Spanish', () => {
    setNumberLocale('es-ES');
    expect(formatExact(25_000)).toBe('25.000');
    // Spanish leaves four digits ungrouped: *9999*, then *10.000*.
    expect(formatCount(9_999)).toBe('9999');
    expect(formatCount(1_250_000)).toBe('1,3M');
    expect(formatShort(7_299)).toBe('7,2k');
    expect(formatUsd(200_000)).toBe('$2000,00');
    expect(formatUsd(2_000_000)).toBe('$20.000,00');
  });
});
