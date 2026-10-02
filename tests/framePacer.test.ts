// The map's redraw rate: full while touched, 30 left alone, 15 under a menu.
import { describe, expect, it } from 'vitest';
import { ACTIVE_HOLD_MS, shouldDraw } from '../src/render/framePacer';

/** How many of `seconds` worth of 60 Hz frames redraw. */
function drawn(seconds: number, opts: { activeUntil?: number; covered?: boolean } = {}): number {
  let lastDraw = -Infinity;
  let count = 0;
  for (let i = 0; i < seconds * 60; i++) {
    const now = 10_000 + i * (1000 / 60);
    const lastActive = opts.activeUntil !== undefined && now <= opts.activeUntil ? now : -Infinity;
    if (shouldDraw({ now, lastDraw, lastActive, covered: opts.covered ?? false })) {
      lastDraw = now;
      count++;
    }
  }
  return count;
}

describe('frame pacing', () => {
  it('draws every frame while the map is being touched', () => {
    expect(drawn(1, { activeUntil: Infinity })).toBe(60);
  });

  it('lands on every other 60 Hz frame when left alone', () => {
    expect(drawn(2)).toBe(60);
  });

  it('drops to fifteen under a menu', () => {
    expect(drawn(2, { covered: true })).toBe(30);
  });

  it('keeps the full rate for a while after the last touch', () => {
    const now = 5_000;
    expect(shouldDraw({ now, lastDraw: now - 1, lastActive: now - ACTIVE_HOLD_MS + 1, covered: false })).toBe(true);
    expect(shouldDraw({ now, lastDraw: now - 1, lastActive: now - ACTIVE_HOLD_MS, covered: false })).toBe(false);
  });
});
