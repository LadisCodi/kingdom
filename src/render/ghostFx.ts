// THE PLACEMENT GHOST'S MOTION (Docs/features/05-city-and-districts.md §4.3).
//
// The ghost floats a little above the plot it would land on, bobbing; a
// finger on it lifts it higher; it glides from cell to cell instead of
// snapping; picking it up punches it, a refused confirm shakes it, and
// planting it drops it onto its plot with a squash and a puff of dust.
//
// Purely visual and transient, like TapFx: the renderer samples it once a
// frame, and the springs are integrated on that frame's clock. Nothing here
// is read by the sim. Lifts and offsets are fractions of the plot's width,
// so they read the same at every zoom.

import type { Coord } from '../sim/state';

/** How high the ghost floats at rest, and while a finger holds it. */
const FLOAT = 0.07;
const HELD = 0.17;
/** The bob at rest: amplitude and period. */
const BOB = 0.014;
const BOB_MS = 1800;
/** The lift's spring: a little overshoot on the way up, none to speak of
 *  on the way down. */
const STIFFNESS = 320;
const DAMPING = 20;
/** The glide between cells: the time constant of its ease. */
const GLIDE_MS = 45;
/** A new ghost scales in over this; a pick-up punch, a refusal's shake. */
const APPEAR_MS = 260;
const PUNCH_MS = 320;
const SHAKE_MS = 380;
/** Planting: a hop up (the anticipation), the fall, then the squash; the
 *  dust rises as it hits and settles. */
const HOP_MS = 80;
const HOP = 0.1;
const FALL_MS = 130;
const SQUASH_MS = 320;
const DUST_MS = 700;

export interface GhostPose {
  /** The anchor cell the ghost is drawn at — fractional while it glides. */
  at: Coord;
  /** How far above its plot, in plot widths. */
  lift: number;
  /** Scale about the point it stands on. */
  sx: number;
  sy: number;
  /** Sideways offset, in plot widths — the refusal's shake. */
  shake: number;
  /** Opacity multiplier while it appears. */
  alpha: number;
}

/** A building just planted: its fall and squash, sampled by the renderer. */
export interface LandingSample { lift: number; sx: number; sy: number }

/** One puff of a landing's dust ring: the footprint and how far along. */
export interface DustSample { cell: Coord; size: Coord; k: number }

const reducedMotionQuery = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const calm = (): boolean => reducedMotionQuery?.matches ?? false;

export class GhostFx {
  private readonly clock: () => number;
  /** Which ghost is out (`kind:definition:id`); null when none is. */
  private id: string | null = null;
  private pos: Coord = { x: 0, y: 0 };
  private lift = 0;
  private liftVel = 0;
  private lastT = 0;
  private appearAt = -Infinity;
  private appearScale = false;
  private punchAt = -Infinity;
  private shakeAt = -Infinity;
  private landings = new Map<string, { at: number; from: number }>();
  private dusts: Array<{ cell: Coord; size: Coord; at: number }> = [];

  constructor(clock: () => number = () => performance.now()) {
    this.clock = clock;
  }

  /**
   * The ghost's pose this frame. `id` names the ghost: a new one appears —
   * a new BUILD scales in from nothing, a MOVE rises off its own plot.
   */
  pose(target: Coord, held: boolean, id: string, scaleIn: boolean): GhostPose {
    const t = this.clock();
    if (id !== this.id) {
      this.id = id;
      this.pos = { ...target };
      this.lift = 0;
      this.liftVel = 0;
      this.lastT = t;
      this.appearAt = t;
      this.appearScale = scaleIn;
    }
    const dt = Math.min(0.05, Math.max(0, (t - this.lastT) / 1000));
    this.lastT = t;
    const still = calm();
    if (still) {
      this.pos = { ...target };
      this.lift = held ? HELD : FLOAT;
      this.liftVel = 0;
    } else {
      const ease = 1 - Math.exp(-(dt * 1000) / GLIDE_MS);
      this.pos = {
        x: this.pos.x + (target.x - this.pos.x) * ease,
        y: this.pos.y + (target.y - this.pos.y) * ease,
      };
      if (Math.abs(target.x - this.pos.x) + Math.abs(target.y - this.pos.y) < 0.004) this.pos = { ...target };
      const goal = held ? HELD : FLOAT;
      const accel = STIFFNESS * (goal - this.lift) - DAMPING * this.liftVel;
      this.liftVel += accel * dt;
      this.lift += this.liftVel * dt;
    }
    const bob = still || held ? 0 : BOB * Math.sin((t % BOB_MS) / BOB_MS * Math.PI * 2);

    let sx = 1;
    let sy = 1;
    let alpha = 1;
    const a = (t - this.appearAt) / APPEAR_MS;
    if (a < 1) {
      alpha = Math.min(1, a * 2.5);
      if (this.appearScale && !still) {
        const s = easeOutBack(a);
        sx *= 0.6 + 0.4 * s;
        sy *= 0.6 + 0.4 * s;
      }
    }
    const p = (t - this.punchAt) / PUNCH_MS;
    if (p < 1 && !still) {
      // Picked up: it stretches up off the ground, then wobbles back.
      const d = Math.exp(-4 * p);
      sx *= 1 - 0.1 * d * Math.cos(p * Math.PI * 3);
      sy *= 1 + 0.14 * d * Math.cos(p * Math.PI * 3);
    }
    const k = (t - this.shakeAt) / SHAKE_MS;
    const shake = k < 1 && !still ? 0.05 * (1 - k) * Math.sin(k * Math.PI * 2 * 4.5) : 0;
    return { at: this.pos, lift: Math.max(0, this.lift + bob), sx, sy, shake, alpha };
  }

  /** No ghost on the map this frame. */
  clear(): void {
    this.id = null;
  }

  /** A finger took the ghost. */
  grab(): void {
    this.punchAt = this.clock();
  }

  /** A confirm the ghost's spot refused. */
  shake(): void {
    this.shakeAt = this.clock();
  }

  /**
   * The ghost was planted at `cell`: the building that now stands there
   * falls the rest of the way from the ghost's height and squashes, and a
   * ring of dust puffs out round its plot.
   */
  land(anchorKey: string, cell: Coord, size: Coord): void {
    if (calm()) return;
    const at = this.clock();
    this.landings.set(anchorKey, { at, from: Math.max(this.lift, FLOAT) });
    this.dusts.push({ cell, size, at: at + HOP_MS + FALL_MS });
  }

  /** The landing of the building anchored here, or null. */
  landing(anchorKey: string): LandingSample | null {
    const l = this.landings.get(anchorKey);
    if (l === undefined) return null;
    const t = this.clock() - l.at;
    const top = l.from + HOP;
    if (t < HOP_MS) {
      // A little hop first, stretching as it goes up.
      const k = t / HOP_MS;
      const up = 1 - (1 - k) * (1 - k);
      return { lift: l.from + HOP * up, sx: 1 - 0.06 * up, sy: 1 + 0.08 * up };
    }
    if (t < HOP_MS + FALL_MS) {
      const k = (t - HOP_MS) / FALL_MS;
      return { lift: top * (1 - k * k), sx: 0.94 + 0.02 * k, sy: 1.08 };
    }
    const k = (t - HOP_MS - FALL_MS) / SQUASH_MS;
    if (k >= 1) {
      this.landings.delete(anchorKey);
      return null;
    }
    const d = Math.exp(-4.5 * k);
    return {
      lift: 0,
      sx: 1 + 0.2 * d * Math.cos(k * Math.PI * 3),
      sy: 1 - 0.24 * d * Math.cos(k * Math.PI * 3.6),
    };
  }

  /** Nothing has landed lately — most frames. */
  get settled(): boolean {
    return this.landings.size === 0 && this.dusts.length === 0;
  }

  /** The dust rings still in the air, each with how far along it is. */
  dust(): DustSample[] {
    const t = this.clock();
    this.dusts = this.dusts.filter((d) => t - d.at < DUST_MS);
    return this.dusts
      .filter((d) => t >= d.at)
      .map((d) => ({ cell: d.cell, size: d.size, k: (t - d.at) / DUST_MS }));
  }
}

/** Overshoots a little past 1 and settles: a thing popping into place. */
function easeOutBack(k: number): number {
  const c = 1.7;
  const u = k - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}
