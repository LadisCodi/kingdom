// The modifier layer (Docs/features/engine-seams.md §2).
//
// Before this, effects came only from upgrade LEVELS, read through the five
// effectiveX helpers in upgrades.ts. Nothing could apply a temporary or
// externally-sourced effect — which is every artifact passive, every hero
// trait, every season and every event.
//
// The pipeline is now three stages: base → upgrade levels → modifier stack.
// An empty stack is the bit-exact identity, `(base + 0) x 1 === base`, which
// is what let this ship without touching a single existing assertion.
//
// Upgrade levels are deliberately NOT re-expressed as modifiers. They are
// persisted as levels, purchasable, and priced on a curve; converting them
// would mean a save migration plus rebuilding stack entries on every purchase,
// in exchange for elegance nobody can see.

import type {
  CurrencyId, DistrictId, GameState, HarvestSourceId,
} from './state';

/** Everything a modifier can reach. Adding one is a line here plus a
 *  `resolve()` call in the helper that owns that number. */
export type ModifierStat =
  | 'tapYield'
  | 'workerYield'
  | 'salePrice'
  | 'taxRate'
  | 'autoTapCooldown'
  | 'manaRegen'
  | 'revealCost'
  | 'cellRecovery'
  | 'knowledgeYield'
  | 'activeCost'      // Mana an artifact ability costs to cast
  | 'delveSpeed'      // how fast a depth resolves
  | 'attunementSlots' // sockets, for a season that lends you one
  // The era-2/3 hooks (Docs/features/tech-tree.md §9). Each is reached by a
  // minor line through `effect()` AND by this stack, in the helper that owns
  // the number — three stages, one place, like everything above.
  | 'buildTime'       // seconds to raise or upgrade a building
  | 'researchTime'    // seconds to complete a research, fixed at start
  | 'workerSpeed'     // tiles per second a worker walks
  | 'manaCap'         // the ceiling of the pool
  | 'claimCost'       // Gold to claim a landmark
  | 'stardustYield'   // Stardust a depth pays
  // The Warfare batch. Pathfinders reuses `delveSpeed` above rather than
  // adding a twin of it.
  | 'armyCap'         // power the halls can field
  | 'supplyCost'      // what an expedition costs to provision
  | 'haulLoss'        // the fraction a failed depth loses
  | 'heroXp'          // XP a delve pays a hero
  | 'recruitCost'     // what a unit costs to recruit
  // Combat. combat.ts stays PURE — these are resolved in expeditions.ts into a
  // `Drill` carried on the Party, the way the hero's level and the carried
  // relic already travel in.
  | 'unitAtk'         // flat ATK on every unit
  | 'unitDef'         // flat DEF on every unit
  | 'typeDisadvantage'; // the multiplier a bad matchup applies

export type ModifierSource = 'artifact' | 'season' | 'event' | 'hero' | 'debug';

/** What a modifier narrows to. `null` means every subject of that stat. */
export type ModifierScope = CurrencyId | HarvestSourceId | DistrictId | null;

export interface Modifier {
  /** newId() — deterministic and persisted, and the fold order (see below). */
  id: string;
  source: ModifierSource;
  stat: ModifierStat;
  scope: ModifierScope;
  op: 'add' | 'mul';
  value: number;
  /** Half-open: active while `t < expiresAt`. null = permanent (a passive).
   *  Half-open matches `recoverIfDue` on harvest cells; keep them consistent. */
  expiresAt: number | null;
}

/** Half-open, so a modifier expiring at exactly T is already gone at T. */
export const isActive = (m: Modifier, t: number): boolean =>
  m.expiresAt === null || t < m.expiresAt;

const applies = (m: Modifier, stat: ModifierStat, scope: ModifierScope): boolean =>
  m.stat === stat && (m.scope === null || m.scope === scope);

/**
 * base → the modifier stack, at the sim's own clock.
 *
 * All adds summed, then all muls multiplied — matching what upgrades already
 * do (additive on flat yields, multiplicative on rates).
 *
 * Folded in `id` order, because floating-point addition and multiplication are
 * not associative: two clients holding the same set of modifiers in different
 * array order could otherwise differ in the last bit. Sorting converts "the
 * order happens to be preserved" into "the order is irrelevant". Stacks are
 * tiny; the sort is free.
 *
 * Expiry is read off `state.lastAdvance` — the sim's own clock — rather than a
 * `now` parameter. Threading `now` was rejected deliberately: effectiveTaxRate
 * is reached from accrueTaxes and from three UI files, effectiveTapYield from
 * tapCell and game.ts, and so on. It would be a wide, noisy diff across six
 * sim files and several ui/ ones, and it would introduce two notions of "now"
 * that can disagree.
 *
 * THE INVARIANT TO ENFORCE BY REVIEW: the stack is exact as of
 * `state.lastAdvance`. That holds because `expiresAt` is a boundary source in
 * `nextBoundary` and `applyDueAt` prunes at every boundary, so no continuous
 * accrual can straddle an expiry at the wrong rate. Residual staleness is a UI
 * read inside one tick (<= 1s, cosmetic), or a player command between ticks
 * using a buff that lapsed milliseconds earlier — sub-second, and in the
 * player's favour.
 */
export function resolve(
  state: GameState,
  stat: ModifierStat,
  base: number,
  scope: ModifierScope = null,
): number {
  const t = state.lastAdvance;
  let add = 0;
  let mul = 1;
  const stack = state.modifiers
    .filter((m) => applies(m, stat, scope) && isActive(m, t))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const m of stack) {
    if (m.op === 'add') add += m.value;
    else mul *= m.value;
  }
  return (base + add) * mul;
}

/** Every currently-active modifier, for the reliquary's breakdown. */
export const activeModifiers = (state: GameState): Modifier[] =>
  state.modifiers.filter((m) => isActive(m, state.lastAdvance));

export function addModifier(state: GameState, m: Modifier): void {
  state.modifiers.push(m);
}

/** Drop every modifier from `source` (a relic being un-attuned, a season
 *  ending). Returns how many went. */
export function removeModifiersFrom(state: GameState, source: ModifierSource, tag?: string): number {
  const before = state.modifiers.length;
  state.modifiers = state.modifiers.filter(
    (m) => m.source !== source || (tag !== undefined && !m.id.startsWith(tag)),
  );
  return before - state.modifiers.length;
}

/** Called from `applyDueAt`: the push half of expiry. Without it a continuous
 *  accrual could straddle an expiry at the wrong rate; with the boundary loop
 *  in place it is free. */
export function pruneExpiredModifiers(state: GameState, t: number): Modifier[] {
  const expired = state.modifiers.filter((m) => !isActive(m, t));
  if (expired.length > 0) {
    state.modifiers = state.modifiers.filter((m) => isActive(m, t));
  }
  return expired;
}

/** The next moment a modifier's window closes, or null. A boundary source. */
export function nextModifierExpiry(state: GameState, after: number): number | null {
  let best: number | null = null;
  for (const m of state.modifiers) {
    if (m.expiresAt === null || m.expiresAt <= after) continue;
    if (best === null || m.expiresAt < best) best = m.expiresAt;
  }
  return best;
}
