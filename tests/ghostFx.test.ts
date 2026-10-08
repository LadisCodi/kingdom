// The placement ghost's motion (src/render/ghostFx.ts): it floats, lifts
// under a finger, glides between cells, and a planted one drops and dusts.
import { describe, expect, it } from 'vitest';
import { GhostFx } from '../src/render/ghostFx';

function clocked() {
  let t = 1000;
  const fx = new GhostFx(() => t);
  return { fx, step: (ms: number) => { t += ms; } };
}

/** Run the pose for `ms` at 60 fps and return the last one. */
function settle(fx: GhostFx, step: (ms: number) => void, ms: number, at = { x: 0, y: 0 }, held = false) {
  let pose = fx.pose(at, held, 'g', false);
  for (let t = 0; t < ms; t += 16) {
    step(16);
    pose = fx.pose(at, held, 'g', false);
  }
  return pose;
}

describe('the placement ghost', () => {
  it('rises off its plot when it appears, and floats above it', () => {
    const { fx, step } = clocked();
    expect(fx.pose({ x: 0, y: 0 }, false, 'g', false).lift).toBe(0);
    const pose = settle(fx, step, 1500);
    expect(pose.lift).toBeGreaterThan(0.04);
    expect(pose.lift).toBeLessThan(0.1);
    expect(pose.alpha).toBe(1);
  });

  it('lifts higher while a finger holds it', () => {
    const { fx, step } = clocked();
    const rest = settle(fx, step, 1500);
    const held = settle(fx, step, 1500, { x: 0, y: 0 }, true);
    expect(held.lift).toBeGreaterThan(rest.lift + 0.05);
  });

  it('glides to a new cell rather than snapping, and arrives', () => {
    const { fx, step } = clocked();
    settle(fx, step, 500);
    step(16);
    const mid = fx.pose({ x: 3, y: 0 }, false, 'g', false);
    expect(mid.at.x).toBeGreaterThan(0);
    expect(mid.at.x).toBeLessThan(3);
    expect(settle(fx, step, 600, { x: 3, y: 0 }).at).toEqual({ x: 3, y: 0 });
  });

  it('a new ghost starts on its own cell, and a build scales in', () => {
    const { fx, step } = clocked();
    settle(fx, step, 500);
    const fresh = fx.pose({ x: 5, y: 5 }, false, 'other', true);
    expect(fresh.at).toEqual({ x: 5, y: 5 });
    expect(fresh.sx).toBeLessThan(1);
  });

  it('a refused confirm shakes it, and the shake dies away', () => {
    const { fx, step } = clocked();
    settle(fx, step, 500);
    fx.shake();
    step(30);
    expect(Math.abs(fx.pose({ x: 0, y: 0 }, false, 'g', false).shake)).toBeGreaterThan(0);
    step(500);
    expect(fx.pose({ x: 0, y: 0 }, false, 'g', false).shake).toBe(0);
  });

  it('a planted building hops, falls from the ghost’s height, squashes, and is let go', () => {
    const { fx, step } = clocked();
    settle(fx, step, 1500);
    fx.land('2,0', { x: 2, y: 0 }, { x: 1, y: 1 });
    expect(fx.settled).toBe(false);
    const start = fx.landing('2,0')!;
    expect(start.lift).toBeGreaterThan(0.04);
    step(80);
    const top = fx.landing('2,0')!.lift;
    expect(top).toBeGreaterThan(start.lift);
    step(70);
    expect(fx.landing('2,0')!.lift).toBeLessThan(top);
    step(70);
    const squash = fx.landing('2,0')!;
    expect(squash.lift).toBe(0);
    expect(squash.sy).toBeLessThan(1);
    expect(fx.dust().length).toBe(1);
    step(1000);
    expect(fx.landing('2,0')).toBe(null);
    expect(fx.dust()).toEqual([]);
    expect(fx.settled).toBe(true);
  });
});
