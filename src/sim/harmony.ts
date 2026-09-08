// Harmony: what a decoration supplies, what an advanced building demands, and
// the gate between them (Docs/plans/builder-30-days.md §6).
//
// Harmony is a city STAT, not a currency — `supply − demand`, computed on read,
// with nothing stored and nothing serialized. It is a **gate and never a
// drain**: it is asked once, when a build or an upgrade STARTS, and never read
// again. A deficit therefore blocks the next thing and can never punish the
// last, which is the first promise the design makes (Docs/README.md).
//
// With the province plot unbounded (OQ-1) a decoration does not compete for
// ground, so what prices Harmony is variety and the workshop queue: every
// piece has its own count cap, so a Townhall's demand needs several KINDS, and
// every kind past the Garden is priced in a refined good. Where a piece stands
// is paid for by adjacency, not by this gate.

import { DISTRICTS, HARMONY, levelIndexed, type DistrictDef } from './data/definitions';
import type { District, GameState } from './state';

/** Harmony a building demands at a level. The column is the TOTAL at that
 *  level rather than an increment, indexed from level 1 like
 *  `armyCapPerLevel`, so entry 0 is the gate on BUILDING it and the rest are
 *  the gates on its levels — one column for both, and no prefix summed
 *  anywhere. A blank column demands nothing at any level. */
export const harmonyCost = (def: DistrictDef, level: number): number =>
  (def.harmonyCostPerLevel.length === 0 ? 0 : levelIndexed(def.harmonyCostPerLevel, level));

/**
 * The level a district's demand is measured at: the one it is upgrading TO if
 * a wait is in flight, else the one it holds.
 *
 * Without this, demand under-counts for as long as an upgrade runs and two
 * waits could be started against the same surplus — the player would pay
 * once and level twice.
 */
export const demandLevel = (state: GameState, district: District): number => {
  const upgrade = state.city.queue.find(
    (q) => q.kind === 'upgrade' && q.districtUniqueId === district.uniqueId);
  return upgrade?.targetLevel ?? district.level;
};

/** Harmony the city supplies: the decorations that are STANDING. A piece
 *  under construction supplies nothing — beauty is delivered, not promised. */
export const harmonySupply = (state: GameState): number => state.city.districts
  .filter((d) => d.state === 'Built')
  .reduce((sum, d) => sum + DISTRICTS[d.definitionId].harmonySupply, 0);

/**
 * Harmony the city demands. Every district counts, including one still under
 * construction: its demand was checked when the build started and it has to
 * keep being counted, or the same surplus would buy the next thing too.
 *
 * `exclude` drops one building from the sum, which is what an upgrade needs:
 * it is replacing its own demand rather than adding to it.
 */
export const harmonyDemand = (state: GameState, exclude?: string): number => state.city.districts
  .filter((d) => d.uniqueId !== exclude)
  .reduce((sum, d) => sum + harmonyCost(DISTRICTS[d.definitionId], demandLevel(state, d)), 0);

/** What is left over, which is what a header shows. Never negative in play:
 *  supply only grows, demand only grows with a purchase this gate approved,
 *  and nothing is ever demolished. */
export const harmonyFree = (state: GameState): number =>
  harmonySupply(state) - harmonyDemand(state);

export type HarmonyBlock = { shortBy: number };

/**
 * May this building start? `null` = yes; otherwise how much Harmony is
 * missing, which is the only thing the player can act on.
 *
 * `district` is the one being UPGRADED, if any: its current demand comes out
 * of the sum, because a level replaces the level below it rather than stacking
 * on top of it. A build passes nothing and adds its whole level-1 cost.
 */
export function harmonyBlock(
  state: GameState,
  def: DistrictDef,
  targetLevel: number,
  district?: District,
): HarmonyBlock | null {
  const cost = harmonyCost(def, targetLevel);
  if (cost === 0) return null;
  const shortBy = harmonyDemand(state, district?.uniqueId) + cost - harmonySupply(state);
  return shortBy > 0 ? { shortBy } : null;
}

/**
 * The tier the city has reached — the last one whose ratio of
 * `supply / demand` it meets — or `null` for none. What a card names, so the
 * Townhall can say what the surplus is paying.
 *
 * **A city that demands nothing has no ratio and no tier.** Otherwise one
 * Garden on the day the first decoration unlocks would pay the top tier for
 * the whole midgame, for free — the bonus is for keeping a city beautiful
 * *past* what its buildings ask of it, and a city asking nothing cannot be
 * past anything.
 */
export function harmonySurplusTier(
  state: GameState,
): { readonly at: number; readonly bonus: number } | null {
  const demand = harmonyDemand(state);
  if (demand <= 0) return null;
  const ratio = harmonySupply(state) / demand;
  let reached = null;
  for (const tier of HARMONY.surplusTiers) if (ratio >= tier.at) reached = tier;
  return reached;
}

/** What a surplus pays, as a multiplier on the number it moves. */
export const harmonySurplusMultiplier = (state: GameState): number =>
  1 + (harmonySurplusTier(state)?.bonus ?? 0);

/** Is this building one of the decorations? Its whole contribution is the
 *  Harmony it supplies: no level, no crew, no residents, no tap. */
export const isDecoration = (def: DistrictDef): boolean => def.harmonySupply > 0;
