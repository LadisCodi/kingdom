// Seeded randomness (Docs/features/engine-seams.md §3).
//
// The hardcoded expectation below is the point of this file, not decoration:
// the mixer is the thing that decides where every player's berry bush
// reappears and which hero every pull gives. A "harmless refactor" of it would
// silently reshuffle every existing world, and nothing else in the suite
// would notice.
import { describe, expect, it } from 'vitest';
import { chance, pick, rand, randInt } from '../src/sim/rng';
import { serialize, deserialize } from '../src/sim/save';
import { freshGame, map, T0 } from './helpers';

describe('rand', () => {
  it('is pinned for a fixed (seed, key) pair', () => {
    expect(rand(12345, 'respawn', '4,7', 2)).toBeCloseTo(0.4896101977210492, 15);
    expect(randInt(12345, 100, 'respawn', '4,7', 2)).toBe(87);
  });

  it('lands in [0, 1) and spreads across it', () => {
    const values = Array.from({ length: 2000 }, (_, i) => rand(7, 'k', i));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
    // Ten buckets, none starved: a mixer that collapses would fail here.
    const buckets = new Array(10).fill(0);
    for (const v of values) buckets[Math.floor(v * 10)] += 1;
    expect(Math.min(...buckets)).toBeGreaterThan(120);
  });

  it('is a pure function of the key, not of how many draws came before', () => {
    const a = rand(99, 'delve', 'HollowBarrow', 3);
    for (let i = 0; i < 500; i++) rand(99, 'noise', i);
    expect(rand(99, 'delve', 'HollowBarrow', 3)).toBe(a);
  });

  it('separates its parts, so ("ab","c") and ("a","bc") are different questions', () => {
    expect(rand(1, 'ab', 'c')).not.toBe(rand(1, 'a', 'bc'));
  });

  it('gives different worlds to different seeds', () => {
    const key = ['respawn', '0,0', 1] as const;
    expect(rand(1, ...key)).not.toBe(rand(2, ...key));
  });

  it('avalanches: adjacent keys do not land next to each other', () => {
    const gaps = Array.from({ length: 20 }, (_, i) =>
      Math.abs(rand(5, 'depth', i) - rand(5, 'depth', i + 1)));
    expect(gaps.filter((g) => g > 0.1).length).toBeGreaterThan(12);
  });
});

describe('randInt / pick / chance', () => {
  it('randInt stays in range and never divides by zero', () => {
    for (let i = 0; i < 200; i++) {
      const n = randInt(3, 7, 'r', i);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
    expect(randInt(3, 0, 'empty')).toBe(0);
  });

  it('pick returns a member, and the same one for the same key', () => {
    const items = ['a', 'b', 'c', 'd'];
    const first = pick(11, items, 'k');
    expect(items).toContain(first);
    expect(pick(11, items, 'k')).toBe(first);
  });

  it('chance respects its probability', () => {
    const hits = Array.from({ length: 2000 }, (_, i) => chance(4, 0.25, 'c', i))
      .filter(Boolean).length;
    expect(hits).toBeGreaterThan(400);
    expect(hits).toBeLessThan(600);
  });
});

describe('the seed is world state', () => {
  it('survives a save round-trip', () => {
    const state = freshGame();
    state.seed = 4242;
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(restored.seed).toBe(4242);
  });
});
