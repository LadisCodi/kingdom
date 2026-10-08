// The modifier layer (Docs/implementation-plan.md §1).
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

import { relicAura } from './hosts';
import type {
  ArtifactId, Coord, CurrencyId, DistrictId, GameState, HarvestSourceId,
} from './state';

/** Everything a modifier can reach. Adding one is a line here plus a
 *  `resolve()` call in the helper that owns that number. */
export type ModifierStat =
  | 'tapYield'
  | 'workerYield'
  | 'taxRate'
  | 'manaRegen'
  | 'revealCost'
  | 'cellRecovery'    // how long a cell waits before it refills in place
  | 'cellRespawn'     // how long a consumed feature waits before it reappears
  | 'knowledgeYield'  // every lump of Knowledge — never the drip
  | 'activeCost'      // Mana an artifact ability costs to cast
  | 'delveSpeed'      // how fast a depth resolves
  // The era-2/3 hooks (Docs/features/tech-tree.md §6.2). Each is reached by
  // the tech tree (a `stat` in `data/techEffectRules.ts`) AND by this stack,
  // in the helper that owns the number — three stages, one place, like
  // everything above.
  | 'buildTime'       // seconds to raise or upgrade a building
  | 'workerSpeed'     // tiles per second a worker walks
  | 'manaCap'         // the ceiling of the pool
  | 'claimCost'       // Gold to claim a landmark
  // TODO(OQ-113): NOTHING READS `stardustYield` since the depths were retired
  // — the rooms were its only payer. The Stargazer's Orb passive and the
  // Prospecting ranks still name it and move nothing.
  | 'stardustYield'   // Stardust a room paid — NOT READ
  // The Warfare batch. Pathfinders reuses `delveSpeed` above rather than
  // adding a twin of it.
  | 'armyCap'         // power the halls can field
  | 'supplyCost'      // what a lair attack costs in supplies
  | 'haulLoss'        // the fraction a failed depth loses
  | 'heroXp'          // XP a delve pays a hero
  | 'recruitCost'     // what a unit costs to recruit
  // Combat. combat.ts stays PURE — these are resolved in expeditions.ts into a
  // `Drill` carried on the Party, the way the hero's level and the carried
  // relic already travel in.
  | 'unitAtk'         // flat ATK on every unit
  | 'unitDef'         // flat DEF on every unit
  | 'typeDisadvantage' // the multiplier a bad matchup applies
  | 'discoverRadius'  // how far a building sees into the fog
  // THE SPEEDS. A wait is owned by the game as a TIME and moved as a SPEED the
  // call site DIVIDES by, so the bonus points up and never arrives at zero
  // (Docs/proposals/legendary-boons.md §2.1). `buildTime` above is the tree's
  // ranks, which are authored as a discount and stay one; this is the stack's
  // half of the same number, and the two multiply.
  | 'buildSpeed'      // how fast the builders work
  | 'recoverySpeed'   // how fast a cell refills in place
  | 'workerStrikeSpeed' // how fast a worker swings
  | 'worldRevealSpeed' // how fast an explorer marches (sim/world/explorers.ts)
  | 'unitHp'          // multiplies every unit's HP, on the board and in the estimate
  // THE GROUND. Both are FLAT on a base the workbook authors and never grows,
  // so flat cannot go stale here the way it does on a rate. The Sickle of Plenty
  // moves the two together — a node gets richer as fast as the swing gets
  // bigger — because either alone saturates: a bigger swing empties a node it
  // cannot exceed, and a richer node nobody can drain faster is just a longer
  // queue (Docs/proposals/relic-effects.md §4.2).
  | 'harvestUnitsPerStrike' // units one extraction takes — the thumb and the crew
  | 'harvestStock'    // units a cell holds before it is spent
  | 'trainingSpeed'   // how fast a building trains — soldiers and villagers alike
  // TODO(OQ-113): NOTHING READS `roomHaul`. It moved a ROOM's Gold and Stone,
  // and the rooms were retired with the depths; it stays defined so the
  // Wisp Lantern that names it still loads. The Lantern needs a new
  // effect (Docs/open-questions.md OQ-113, Docs/proposals/relic-effects.md).
  | 'roomHaul'        // a room's Gold and Stone — NOT READ
  | 'worldImprovementYield'; // what a world-map district grants an hour — NOT READ YET

export type ModifierSource = 'artifact' | 'season' | 'event' | 'hero' | 'debug' | 'item';

/** What a modifier narrows to. `null` means every subject of that stat. */
export type ModifierScope = CurrencyId | HarvestSourceId | DistrictId | null;

/**
 * WHERE a modifier applies, for the ones that apply somewhere.
 *
 * A ZONE IS A MODIFIER WITH A CENTRE. A relic's active is its passive's idea
 * concentrated in one place for a window (Docs/features/09-relics.md §2.1),
 * which is a modifier that already expires, already prunes, already saves and
 * already folds in a defined order — minus a position. Giving it one reuses
 * all of that instead of standing up a parallel system with its own state, its
 * own save key and its own boundary.
 *
 * CHEBYSHEV, like every other area of influence in the game (CLAUDE.md: fog
 * and placement are 4-way, areas are Chebyshev, worker travel is Euclidean).
 */
export interface ModifierArea {
  /** The zone's anchor: its centre cell, or the top-left cell of `size`. */
  centre: Coord;
  /** Chebyshev, from the anchor or from every cell of `size`. 0 covers the
   *  anchor (or the footprint) alone. */
  radius: number;
  /** A FOOTPRINT the radius is measured from — a Shrine's aura is its 2×2
   *  and the ring round it. Absent = the one anchor cell. */
  size?: Coord;
  /**
   * WHOSE ZONE IT IS, and WHEN IT WAS CAST.
   *
   * Neither is read by `resolve` — a zone's effect does not care who placed
   * it. They are here for the map, which has to draw *"there is magic here"*
   * and a wheel counting the window down, and cannot do either from an
   * expiry alone: a countdown needs the length it is counting, and one cast
   * that places two modifiers (the Hammer's swing and walk) must draw ONE
   * wheel, which is what the pair identifies.
   */
  relic: ArtifactId;
  since: number;
}

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
  /** A ZONE. Absent on the global modifiers, which is every one that existed
   *  before relic actives. An area modifier is invisible to `resolve()` and
   *  visible only to `resolveAt()`, so a global read can never pick up a
   *  local zone by accident — that asymmetry is the whole safety of this. */
  area?: ModifierArea;
}

/** Chebyshev, inclusive of the centre — so radius 2 is the 5×5 the preview
 *  draws. */
export const areaCovers = (area: ModifierArea, cell: Coord): boolean => {
  const w = area.size?.x ?? 1;
  const h = area.size?.y ?? 1;
  const dx = Math.max(area.centre.x - cell.x, 0, cell.x - (area.centre.x + w - 1));
  const dy = Math.max(area.centre.y - cell.y, 0, cell.y - (area.centre.y + h - 1));
  return Math.max(dx, dy) <= area.radius;
};

/** Half-open, so a modifier expiring at exactly T is already gone at T. */
export const isActive = (m: Modifier, t: number): boolean =>
  m.expiresAt === null || t < m.expiresAt;

const applies = (m: Modifier, stat: ModifierStat, scope: ModifierScope): boolean =>
  m.stat === stat && (m.scope === null || m.scope === scope);

/** A cell-blind read takes the global modifiers ONLY. A zone that leaked into
 *  `resolve()` would apply everywhere, which is the one bug this whole shape
 *  exists to make impossible. */
const isGlobal = (m: Modifier): boolean => m.area === undefined;

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
 * is reached from accrueTaxes and from three UI files, tapWorkSeconds from
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
    .filter((m) => isGlobal(m) && applies(m, stat, scope) && isActive(m, t))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const m of stack) {
    if (m.op === 'add') add += m.value;
    else mul *= m.value;
  }
  return (base + add) * mul;
}

/**
 * `resolve()` AT A PLACE: the global stack plus every zone covering `cell`.
 *
 * Call this wherever the number being resolved belongs to a spot on the map —
 * a harvest cell's recovery, a crew's swing, a house's tax rate. Everything
 * else keeps calling `resolve()`, and the two agree exactly wherever no zone
 * is standing, because an empty area set folds to the same identity.
 *
 * ZONES OVERLAP FREELY and their values multiply. The cooldown is what stops a
 * player carpeting the map, so two zones on one cell is a choice the player
 * made — an area taking two effects is an area somewhere else taking none —
 * rather than a rule to police (Docs/features/09-relics.md §2.1).
 */
export function resolveAt(
  state: GameState,
  stat: ModifierStat,
  base: number,
  cell: Coord,
  scope: ModifierScope = null,
): number {
  const t = state.lastAdvance;
  // The aura stage first: a hosted relic is a fact about the kingdom, so it
  // folds before the modifiers (sim/hosts.ts). Unscoped, like a relic's
  // passive always was.
  if (scope === null) {
    const aura = relicAura(state, stat, cell);
    base = (base + aura.add) * aura.mul;
  }
  let add = 0;
  let mul = 1;
  const stack = state.modifiers
    .filter((m) => applies(m, stat, scope) && isActive(m, t)
      && (m.area === undefined || areaCovers(m.area, cell)))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const m of stack) {
    if (m.op === 'add') add += m.value;
    else mul *= m.value;
  }
  return (base + add) * mul;
}

/** Every zone standing right now — what the map renderer draws and what the
 *  relic card counts down. */
export const activeZones = (state: GameState): Modifier[] =>
  state.modifiers.filter((m) => m.area !== undefined && isActive(m, state.lastAdvance));

/** Every currently-active modifier, for the reliquary's breakdown. */
export const activeModifiers = (state: GameState): Modifier[] =>
  state.modifiers.filter((m) => isActive(m, state.lastAdvance));

export function addModifier(state: GameState, m: Modifier): void {
  state.modifiers.push(m);
}

/** Drop every modifier the predicate picks. Returns how many went. */
export function removeModifiersWhere(state: GameState, pick: (m: Modifier) => boolean): number {
  const before = state.modifiers.length;
  state.modifiers = state.modifiers.filter((m) => !pick(m));
  return before - state.modifiers.length;
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
