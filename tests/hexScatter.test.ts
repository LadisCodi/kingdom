// What is scattered over a world hex (Docs/plans/world-hex-art.md §3.1).
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DECO_SPRITES, featureNudge, hash01, hexDecorations } from '../src/render/world/hexScatter';

describe('decorations', () => {
  it('are the same every time for the same hex, and differ between hexes', () => {
    expect(hexDecorations(17, null)).toEqual(hexDecorations(17, null));
    expect(hexDecorations(17, null)).not.toEqual(hexDecorations(18, null));
    expect(featureNudge(5)).toEqual(featureNudge(5));
  });

  it('fill bare ground most, and keep a feature\'s middle clear for its drawing', () => {
    expect(hexDecorations(3, null).length).toBeGreaterThan(hexDecorations(3, 'Forest').length);
    for (let i = 0; i < 127; i++) {
      for (const d of hexDecorations(i, 'Forest')) expect(Math.hypot(d.dx, d.dy)).toBeGreaterThanOrEqual(0.55 - 1e-9);
      for (const d of hexDecorations(i, null)) expect(Math.hypot(d.dx, d.dy)).toBeLessThanOrEqual(1.02 + 1e-9);
    }
  });

  it('stand back to front, so the nearer one is drawn over the farther', () => {
    const ds = hexDecorations(40, 'Mountain');
    for (let k = 1; k < ds.length; k++) expect(ds[k].dy).toBeGreaterThanOrEqual(ds[k - 1].dy);
  });

  it('a forest scatters trees, a mountain rocks', () => {
    const trees = new Set<string>(DECO_SPRITES.tree);
    const rocks = new Set<string>(DECO_SPRITES.rock);
    const all = (f: 'Forest' | 'Mountain') => Array.from({ length: 50 }, (_, i) => hexDecorations(i, f)).flat();
    expect(all('Forest').filter((d) => trees.has(d.sprite)).length).toBeGreaterThan(all('Forest').length / 3);
    expect(all('Mountain').filter((d) => rocks.has(d.sprite)).length).toBeGreaterThan(all('Mountain').length / 3);
  });

  it('every one has its art', () => {
    for (const name of Object.values(DECO_SPRITES).flat()) expect(existsSync(`src/render/assets/${name}.png`), name).toBe(true);
  });

  it('hashes into [0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const x = hash01(i, 7, 3);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});
