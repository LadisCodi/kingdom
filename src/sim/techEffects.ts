// What the completed technologies are doing to a number, right now.
//
// The twin of `src/sim/adjacency.ts`, and the same philosophy: an effect is
// computed ON READ at the BASE stage of whatever number it moves, never as a
// modifier. A modifier is a thing that happened to you and expires; a
// researched technology is a fact about your kingdom, and `CLAUDE.md` says
// not to re-express one as the other.
//
// So the pipeline keeps its three stages and only the middle one changes
// shape:
//
//     base  ->  the technologies  ->  the modifier stack
//               (here)                (resolve(), modifiers.ts)
//
// Two rules hold the arithmetic together, and both are load-bearing:
//
//  1. **A percent is divided PER EFFECT, before the sum.** `5/100 + 5/100 +
//     5/100` is bit-identical to `3 * 0.05`; `15/100` is a different double.
//     That one line is what lets a designer author `-22` and still leaves the
//     shipped numbers exactly where they were.
//  2. **The fold order is `TECH_ORDER`, never `state.research.completed`.**
//     Completion order depends on save and migration history, float addition
//     is not associative, and two clients holding the same technologies would
//     otherwise differ in the last bit — the hazard `resolve()`'s `id` sort
//     exists to close.
//
// And one about aim: **a target is an exact-match key, not a `ModifierScope`.**
// There, a `null` scope is a wildcard. Here, an effect with no target
// contributes only to an unaimed query and an aimed one only to its own key.
// Without that, `Sawpits` would lift the crops and the Drill would count
// `Warhorns` once per tag a unit carries.

import { TECHNOLOGIES, TECH_ORDER } from './data/definitions';
import { effectKey, type TechStat, type TechTarget } from './data/techEffectRules';
import type { GameState } from './state';

/** What the tree is adding to a number, and what it is scaling it by. */
export interface TechTotals {
  /** In the base's own units. Signed. */
  flat: number;
  /** As a fraction: `0.15` for fifteen points. Signed. */
  pct: number;
}

const NOTHING: TechTotals = { flat: 0, pct: 0 };

/**
 * Every completed technology's effects, folded by `(stat, target)`.
 *
 * Memoised on the state object, because these are read on hot paths —
 * `effectiveWorkerStrike` runs per worker strike and `cityGatherPerSecond`
 * loops every district — and a walk of 180 technologies per call would be a
 * walk per strike. It is a pure function of the state, so the cache is an
 * optimisation and never a fact: `completed` only ever grows inside a save
 * (research pushes; a load builds a fresh array), so its length identifies a
 * fold.
 */
const CACHE = new WeakMap<GameState, { size: number; byKey: Map<string, TechTotals> }>();

function folded(state: GameState): Map<string, TechTotals> {
  const size = state.research.completed.length;
  const hit = CACHE.get(state);
  if (hit !== undefined && hit.size === size) return hit.byKey;
  const done = new Set(state.research.completed);
  const byKey = new Map<string, TechTotals>();
  for (const id of TECH_ORDER) { // the FILE's order — see rule 2 above
    if (!done.has(id)) continue;
    for (const effect of TECHNOLOGIES[id].effects) {
      const key = effectKey(effect.stat, effect.target);
      const totals = byKey.get(key) ?? { flat: 0, pct: 0 };
      if (effect.op === 'flat') totals.flat += effect.value;
      else totals.pct += effect.value / 100; // per effect — see rule 1 above
      byKey.set(key, totals);
    }
  }
  CACHE.set(state, { size, byKey });
  return byKey;
}

/**
 * What the tree is doing to this stat for this subject: the unaimed effects
 * plus the ones aimed at exactly this target.
 */
export function techTotals(
  state: GameState, stat: TechStat, target?: TechTarget,
): TechTotals {
  const byKey = folded(state);
  const global = byKey.get(effectKey(stat)) ?? NOTHING;
  if (target === undefined) return global;
  const aimed = byKey.get(effectKey(stat, target)) ?? NOTHING;
  return { flat: global.flat + aimed.flat, pct: global.pct + aimed.pct };
}

/** The signed sum the tree adds to this number, in the base's own units. */
export const techFlat = (state: GameState, stat: TechStat, target?: TechTarget): number =>
  techTotals(state, stat, target).flat;

/** What the tree scales this number by: `1.15` for fifteen points up. */
export const techMultiplier = (
  state: GameState, stat: TechStat, target?: TechTarget,
): number => 1 + techTotals(state, stat, target).pct;

/**
 * ONLY the effects aimed at exactly this target — no unaimed ones.
 *
 * For a reader that adds the unaimed term itself, which is `drillOf`: combat
 * sums a unit's `all` bucket plus every tag it carries, and `Cavalry` carries
 * two, so an aimed query that included the global term would pay `Warhorns`
 * twice on an Archer and three times on a Cavalry.
 */
export function techFlatAimed(
  state: GameState, stat: TechStat, target: TechTarget,
): number {
  return (folded(state).get(effectKey(stat, target)) ?? NOTHING).flat;
}

/**
 * The base, after the technologies: `(base + flat) × (1 + pct)`.
 *
 * The one shape almost every reader wants, and flat lands before percent on
 * purpose — "+1 Wood a strike" is about the ground, so it must not become a
 * different number of units depending on which percent ranks happen to be
 * bought. With no effects it is the bit-exact identity (`(base + 0) × (1 + 0)`),
 * which is what makes a stat nothing authors free to leave in place.
 */
export function techValue(
  state: GameState, stat: TechStat, base: number, target?: TechTarget,
): number {
  const { flat, pct } = techTotals(state, stat, target);
  return (base + flat) * (1 + pct);
}
