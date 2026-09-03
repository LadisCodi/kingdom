// Tap punch curves: squash on impact, rebound past 1 on different curves
// per axis, flash decaying fast, and expiry after the duration.
import { describe, expect, it } from 'vitest';
import { TapFx } from '../src/render/tapFx';

const at = (ms: number) => {
  let now = 0;
  const fx = new TapFx(() => now);
  fx.add('0,0');
  now = ms;
  return fx.sample('0,0');
};

describe('tap punch', () => {
  it('starts squashed (wide + short) with a full flash', () => {
    const p = at(0)!;
    expect(p.sx).toBeGreaterThan(1.15);
    expect(p.sy).toBeLessThan(0.8);
    expect(p.flash).toBe(1);
  });

  it('rebounds with different curves per axis, flash mostly gone', () => {
    const p = at(80)!; // mid-rebound
    expect(p.sx).toBeLessThan(1); // X already overshot the other way
    expect(p.sy).toBeGreaterThan(1); // Y stretches tall on the rebound
    expect(p.flash).toBeLessThan(0.2);
  });

  // A worker's strike is the player's gesture performed by somebody else: the
  // same punch, quieter, and WITHOUT the white flash — because the flash is
  // what says "that was me", and thirty woodcutters would drown it
  // (Docs/features/04-harvest.md §5).
  it("a worker's strike punches but never flashes", () => {
    let now = 0;
    const fx = new TapFx(() => now);
    fx.add('2,3', 0.55); // a strike
    const p = fx.sample('2,3')!;
    expect(p.flash).toBe(0);
    expect(p.sx).toBeGreaterThan(1); // still squashes, so it still reads
    expect(p.sx).toBeLessThan(at(0)!.sx); // but less than the player's own tap
  });

  it('expires after the duration and cleans up; re-tap restarts', () => {
    expect(at(300)).toBeNull();
    let now = 0;
    const fx = new TapFx(() => now);
    fx.add('0,0');
    now = 250;
    fx.add('0,0'); // re-tap mid-settle restarts the punch
    now = 260;
    expect(fx.sample('0,0')!.flash).toBeGreaterThan(0.7);
    expect(fx.sample('1,1')).toBeNull(); // other anchors untouched
  });
});
