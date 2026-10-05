// A RELIC'S HOST (Docs/proposals/relic-restoration.md §5.1, §5.4;
// Docs/plans/relics-and-bag.md step 6).
//
// A restored city relic does nothing until a Shrine holds it. Hosted, its
// passive reaches every cell of the Shrine's aura — the Shrine's footprint
// and `auraRadiusPerLevel` cells round it, Chebyshev — and its spell is cast
// there. Rules this file keeps:
//
//  1. AN AURA IS A STAGE OF ITS OWN, not a modifier: a hosted relic is a fact
//     about the kingdom, so it resolves base → technologies → relic auras →
//     modifiers. `relicAura` is that stage; `resolveAt` folds it in.
//  2. WHERE A RELIC'S AURAS OVERLAP, THE STRONGER COUNTS. They never add.
//  3. ONE RELIC, ONE HOST. Hosting a relic takes it from where it was, and a
//     Shrine that held another hands that one back to the Bag.
//  4. EVERY CHANGE TO AN AURA IS REPRICED: rent is priced house by house, so
//     hosting, unhosting and moving run inside `repriceTaxAnchorAround`.
//  5. A WORLD RELIC IS NOT A SHRINE'S: until its Chapel exists (step 7) its
//     passive stays kingdom-wide (`syncArtifactModifiers`).

import { track } from './analytics';
import { artifactLevel, passiveValue, syncArtifactModifiers } from './artifacts';
import { ARTIFACTS, DISTRICTS, levelIndexed, relicKind } from './data/definitions';
import { removeModifiersWhere, type ModifierArea, type ModifierStat, areaCovers } from './modifiers';
import { repriceTaxAnchorAround } from './population';
import type { ArtifactId, Coord, District, GameState } from './state';
import { cast, type CastReport } from './casting';
import type { MapData } from './grid';

/** Every Shrine standing — built, not under construction. */
export const shrines = (state: GameState): District[] =>
  state.city.districts.filter((d) => DISTRICTS[d.definitionId].hostsRelic && d.state === 'Built');

/** Where a relic is hosted, or null. */
export const hostOf = (state: GameState, relic: ArtifactId): District | null =>
  state.city.districts.find((d) => d.hosts === relic) ?? null;

/** A host's aura: its footprint and the ring its level reaches. */
export const auraOf = (host: District, relic: ArtifactId, since = 0): ModifierArea => ({
  centre: host.location,
  size: DISTRICTS[host.definitionId].size,
  radius: levelIndexed(DISTRICTS[host.definitionId].auraRadiusPerLevel, host.level),
  relic,
  since,
});

/** Does any part of this building stand inside the aura? A building is in
 *  as a whole when one of its cells is. */
export const buildingInAura = (area: ModifierArea, d: District): boolean => {
  const { x: w, y: h } = DISTRICTS[d.definitionId].size;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (areaCovers(area, { x: d.location.x + dx, y: d.location.y + dy })) return true;
    }
  }
  return false;
};

/**
 * THE AURA STAGE: what the hosted city relics do to `stat` at `cell`, as an
 * add and a multiplier to fold before the modifiers. Each relic counts once —
 * the strongest of its auras that covers the cell.
 */
export function relicAura(state: GameState, stat: ModifierStat, cell: Coord): { add: number; mul: number } {
  let add = 0;
  let mul = 1;
  // One relic counts once however many of its auras cover the cell: the
  // stronger, never the sum. A relic's value is one number at its level, so
  // "the stronger" is that number, taken once.
  const counted = new Set<ArtifactId>();
  for (const host of shrines(state)) {
    const relic = host.hosts;
    if (relic === undefined || counted.has(relic) || relicKind(relic) !== 'city' || artifactLevel(state, relic) < 1) continue;
    const entries = ARTIFACTS[relic].passive.stats.filter((s) => s.stat === stat);
    if (entries.length === 0 || !areaCovers(auraOf(host, relic), cell)) continue;
    counted.add(relic);
    const value = passiveValue(state, relic);
    for (const e of entries) {
      if (e.op === 'add') add += value;
      else mul *= value;
    }
  }
  return { add, mul };
}

/** The aura stage over a whole building: the strongest any of its cells
 *  stands in — a house reaching into an aura is in it. */
export function relicAuraOver(state: GameState, stat: ModifierStat, d: District): { add: number; mul: number } {
  const { x: w, y: h } = DISTRICTS[d.definitionId].size;
  let best = { add: 0, mul: 1 };
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const a = relicAura(state, stat, { x: d.location.x + dx, y: d.location.y + dy });
      if (a.mul > best.mul || a.add > best.add) best = a;
    }
  }
  return best;
}

/** End the spell a relic has running in its aura — the zone goes, the
 *  cooldown keeps counting (§6: moving a Shrine ends its active). */
export function endHostedSpell(state: GameState, relic: ArtifactId, now: number): boolean {
  const cast = state.artifacts.casts[relic];
  const removed = removeModifiersWhere(state, (m) => m.area?.relic === relic);
  if (cast !== undefined && cast.endsAt > now) cast.endsAt = now;
  return removed > 0;
}

export type HostResult = 'Hosted' | 'NotRestored' | 'NotACityRelic' | 'NotAShrine';

/**
 * HOST A CITY RELIC IN A SHRINE, at `now`. It leaves wherever it was; a
 * relic the Shrine held goes back to the Bag. Free, and undone the same way.
 */
export function hostRelic(state: GameState, relic: ArtifactId, shrineId: string, now: number): HostResult {
  if (artifactLevel(state, relic) < 1) return 'NotRestored';
  if (relicKind(relic) !== 'city') return 'NotACityRelic';
  const shrine = shrines(state).find((d) => d.uniqueId === shrineId);
  if (shrine === undefined) return 'NotAShrine';
  repriceTaxAnchorAround(state, now, () => {
    const was = hostOf(state, relic);
    if (was !== null && was !== shrine) {
      endHostedSpell(state, relic, now);
      delete was.hosts;
    }
    if (shrine.hosts !== undefined && shrine.hosts !== relic) {
      endHostedSpell(state, shrine.hosts, now);
    }
    shrine.hosts = relic;
    syncArtifactModifiers(state);
  });
  track(state, 'relic_hosted', { relic });
  return 'Hosted';
}

/** Take a relic out of its Shrine, back to the Bag. */
export function unhostRelic(state: GameState, relic: ArtifactId, now: number): boolean {
  const host = hostOf(state, relic);
  if (host === null) return false;
  repriceTaxAnchorAround(state, now, () => {
    endHostedSpell(state, relic, now);
    delete host.hosts;
  });
  return true;
}

/** Cast a hosted city relic's spell over its Shrine's aura, at `now`. */
export function castHosted(state: GameState, map: MapData, relic: ArtifactId, now: number): CastReport {
  const host = hostOf(state, relic);
  if (host === null || host.state !== 'Built') return cast(state, map, relic, null, now);
  return cast(state, map, relic, null, now, auraOf(host, relic, now));
}
