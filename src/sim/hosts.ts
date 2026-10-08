// A RELIC'S HOST (Docs/features/09-relics.md §2).
//
// A restored city relic does nothing until a Shrine holds it AND the player
// activates it: Mana paid, a window opens, and for the window its effect
// reaches every cell of the Shrine's aura — the Shrine's footprint and the
// relic's radius round it, Chebyshev. The relic's level is the POWER (its
// number, its reach and its window), raised one at a time round a cycle
// (`cityRelicSteps`); the Shrine has one level and adds nothing of its own.
// Rules this file keeps:
//
//  1. AN AURA IS A STAGE OF ITS OWN, not a modifier: a hosted relic is a fact
//     about the kingdom, so it resolves base → technologies → relic auras →
//     modifiers. `relicAura` is that stage; `resolveAt` folds it in.
//  2. WHERE A RELIC'S AURAS OVERLAP, THE STRONGER COUNTS. They never add.
//  3. ONE RELIC, ONE HOST. Hosting a relic takes it from where it was, and a
//     Shrine that held another hands that one back to the Bag. A relic that
//     leaves its Shrine loses the window it had running.
//  4. EVERY CHANGE TO AN AURA IS REPRICED: rent is priced house by house, so
//     hosting, unhosting, moving, activating and a window CLOSING all run
//     inside `repriceTaxAnchorAround` — the close at its own boundary in
//     `advance` (`nextRelicWindowEnd` / `closeRelicWindows`).
//  5. THE WINDOW IS STATE, NOT A CLOCK READ. It is the relic's entry in
//     `state.artifacts.casts`, priced by the relic's level when it opens and
//     deleted at the boundary where it ends, so the aura stage asks only
//     whether the entry is there — `advance` has no `now` to give it.
//  6. A WORLD RELIC IS NOT A SHRINE'S: it acts while a Chapel holds it
//     (`syncArtifactModifiers`).

import { track } from './analytics';
import {
  artifactLevel, cityRelicSteps, ownsArtifact, passiveValue, relicWindowMsAt, syncArtifactModifiers,
} from './artifacts';
import { ARTIFACTS, DISTRICTS, relicKind } from './data/definitions';
import { mana, payMana } from './mana';
import { resolve, type ModifierArea, type ModifierStat, areaCovers } from './modifiers';
import { harvestSpecAt, isInexhaustible } from './harvest';
import { repriceTaxAnchorAround, residentsOf } from './population';
import type { MapData } from './grid';
import type { ArtifactId, Coord, District, GameState } from './state';

/** Every Shrine standing — built, not under construction. */
export const shrines = (state: GameState): District[] =>
  state.city.districts.filter((d) => DISTRICTS[d.definitionId].hostsRelic && d.state === 'Built');

/** Where a relic is hosted, or null. */
export const hostOf = (state: GameState, relic: ArtifactId): District | null =>
  state.city.districts.find((d) => d.hosts === relic) ?? null;

/** How far a city relic's aura reaches round its Shrine at `level`: its
 *  authored radius, one ring more at each radius step of its cycle. */
export function auraRadiusAt(relic: ArtifactId, level: number): number {
  const base = ARTIFACTS[relic].activation?.radius ?? 0;
  return base + cityRelicSteps(relic, level).radius;
}

/** A host's aura: its footprint and the ring its relic's level reaches. */
export const auraOf = (state: GameState, host: District, relic: ArtifactId, since = 0): ModifierArea => ({
  centre: host.location,
  size: DISTRICTS[host.definitionId].size,
  radius: auraRadiusAt(relic, artifactLevel(state, relic)),
  relic,
  since,
});

/** How long an activation of this relic lasts now, in ms — its level's
 *  window, wherever it is hosted. */
export const relicWindowMs = (state: GameState, relic: ArtifactId): number =>
  relicWindowMsAt(relic, artifactLevel(state, relic));

/** Is this relic's window open? See rule 5: the entry IS the window. */
export const isAwake = (state: GameState, relic: ArtifactId): boolean =>
  relicKind(relic) === 'city' && state.artifacts.casts[relic] !== undefined;

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
 * THE AURA STAGE: what the awake city relics do to `stat` at `cell`, as an
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
    if (relic === undefined || counted.has(relic) || !isAwake(state, relic) || artifactLevel(state, relic) < 1) continue;
    const entries = ARTIFACTS[relic].passive.stats.filter((s) => s.stat === stat);
    if (entries.length === 0 || !areaCovers(auraOf(state, host, relic), cell)) continue;
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

/** Close a relic's window now — it left its Shrine (rule 3). The caller
 *  brackets it in `repriceTaxAnchorAround`. */
function closeWindow(state: GameState, relic: ArtifactId): void {
  if (relicKind(relic) === 'city') delete state.artifacts.casts[relic];
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
      closeWindow(state, relic);
      delete was.hosts;
    }
    if (shrine.hosts !== undefined && shrine.hosts !== relic) {
      closeWindow(state, shrine.hosts);
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
    closeWindow(state, relic);
    delete host.hosts;
  });
  return true;
}

export type ActivateBlock =
  | 'NotRestored' | 'NotACityRelic' | 'NotHosted' | 'Active' | 'NotEnoughMana';

/** What activating this relic costs right now — `activeCost` (Resonance)
 *  buys it down, as it did a cast. */
export function activationCost(state: GameState, relic: ArtifactId): number {
  const base = ARTIFACTS[relic].activation?.manaCost ?? 0;
  return Math.max(0, Math.round(resolve(state, 'activeCost', base)));
}

/** Why this relic cannot be activated right now, or null when it can. The
 *  window before the purse: a relic already running says so. */
export function activateBlock(state: GameState, relic: ArtifactId): ActivateBlock | null {
  if (!ownsArtifact(state, relic)) return 'NotRestored';
  if (ARTIFACTS[relic].activation === null) return 'NotACityRelic';
  const host = hostOf(state, relic);
  if (host === null || host.state !== 'Built') return 'NotHosted';
  if (isAwake(state, relic)) return 'Active';
  if (mana(state) < activationCost(state, relic)) return 'NotEnoughMana';
  return null;
}

/**
 * ACTIVATE A HOSTED CITY RELIC at `now`: pay its Mana, and its effect reaches
 * the Shrine's aura for the relic's window. The window is priced by the
 * relic's level NOW and stored, so a level-up mid-window does not stretch it.
 * No cooldown: it can be activated again the moment it closes.
 */
export function activateRelic(state: GameState, relic: ArtifactId, now: number): ActivateBlock | 'Activated' {
  const block = activateBlock(state, relic);
  if (block !== null) return block;
  const cost = activationCost(state, relic);
  const endsAt = now + relicWindowMs(state, relic);
  repriceTaxAnchorAround(state, now, () => {
    payMana(state, cost);
    state.artifacts.casts[relic] = { endsAt, readyAt: endsAt };
  });
  track(state, 'relic_activated', {
    relic, level: artifactLevel(state, relic), mana: cost,
  });
  return 'Activated';
}

/** The earliest window to close strictly after `after` — a boundary. */
export function nextRelicWindowEnd(state: GameState, after: number): number | null {
  let best: number | null = null;
  for (const [relic, c] of Object.entries(state.artifacts.casts)) {
    if (c === undefined || relicKind(relic as ArtifactId) !== 'city' || c.endsAt <= after) continue;
    if (best === null || c.endsAt < best) best = c.endsAt;
  }
  return best;
}

/** Close every window due at `t`. Called inside `applyDueAt`'s reprice
 *  bracket, so the rent before `t` is priced with the aura and after without.
 *  Returns the relics whose window closed, for the offline report. */
export function closeRelicWindows(state: GameState, t: number): ArtifactId[] {
  const closed: ArtifactId[] = [];
  for (const [relic, c] of Object.entries(state.artifacts.casts)) {
    if (c === undefined || relicKind(relic as ArtifactId) !== 'city' || c.endsAt > t) continue;
    delete state.artifacts.casts[relic as ArtifactId];
    closed.push(relic as ArtifactId);
  }
  return closed;
}

// ------------------------------------------------------------- what it reaches

/** The stats that act on the GROUND — a cell's stock, its regrowth, a swing
 *  or a tap on it — rather than on a building. */
const GROUND_STATS: ReadonlySet<ModifierStat> = new Set(['harvestStock', 'recoverySpeed', 'harvestUnitsPerStrike']);

/** Does this relic work on the ground (the Staff, the Sickle) rather than on
 *  buildings (the Hammer, the Crown)? */
export const worksOnGround = (relic: ArtifactId): boolean =>
  ARTIFACTS[relic].passive.stats.some((s) => GROUND_STATS.has(s.stat));

/** Does this relic's number move anything on this cell? A resource that
 *  never runs dry holds no stock and never regrows, so only a relic that
 *  moves a swing reaches it. */
export function reachesCell(state: GameState, relic: ArtifactId, cell: Coord): boolean {
  const spec = harvestSpecAt(state, cell);
  if (spec === null) return false;
  return !isInexhaustible(spec) || ARTIFACTS[relic].passive.stats.some((s) => s.stat === 'harvestUnitsPerStrike');
}

/** Does this relic's number move anything in this building: the Crown's
 *  houses with residents, the Hammer's buildings with a crew or that train. */
export function reachesBuilding(state: GameState, relic: ArtifactId, d: District): boolean {
  const def = DISTRICTS[d.definitionId];
  return ARTIFACTS[relic].passive.stats.some((s) => {
    switch (s.stat) {
      case 'taxRate': return residentsOf(state, d) > 0;
      case 'workerStrikeSpeed': case 'workerSpeed': return def.maxWorkersPerLevel.length > 0;
      case 'trainingSpeed': return def.trains.length > 0;
      default: return false;
    }
  });
}

/**
 * WHAT AN AURA WOULD REACH: the cells a ground relic works on, or the
 * anchors of the buildings a building relic works on — built ones, never the
 * Shrine itself. The answer a Shrine on the move is placed by.
 */
export function auraTargets(
  state: GameState, map: MapData, relic: ArtifactId, area: ModifierArea, shrineId: string,
): Coord[] {
  if (worksOnGround(relic)) {
    return map.cells.filter((c) => areaCovers(area, c) && reachesCell(state, relic, c));
  }
  return state.city.districts
    .filter((d) => d.uniqueId !== shrineId && d.state === 'Built'
      && reachesBuilding(state, relic, d) && buildingInAura(area, d))
    .map((d) => d.location);
}
