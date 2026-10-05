// The player's half of an army out on the world board
// (Docs/features/19-world-map.md §4, Docs/features/02-map-scopes.md §3.1).
//
// The army itself is server state from the moment it leaves. What stays here
// is what the city lent it: its troops are off the roster (they still count
// against the halls' cap) and its heroes are busy. When the server says it is
// home, what is left comes back — survivors to the roster, a share of the
// fallen to the Infirmary's beds, each hero with the HP it walked home on.

import { DISTRICTS, WORLD, levelIndexed } from '../data/definitions';
import { applyLosses, woundedCap, woundedCount, woundedOf, woundedShareFor } from '../army';
import { setHeroHp } from '../heroHealth';
import { newId, type GameState, type HeroId, type UnitId, type WorldArmyOut } from '../state';
import { techMultiplier } from '../techEffects';

/**
 * How much faster this kingdom's armies march over every hex — the tree's
 * `armyMarchSpeed`, a speed each hex's time is divided by. The march is
 * timed by the world server; the city prices its own pace and sends it with
 * the army, the way it sends the army's board (worldServer/core.ts#sendArmy).
 */
export const armyMarchSpeed = (state: GameState): number =>
  Math.max(1, techMultiplier(state, 'armyMarchSpeed'));

/** How many armies can be out at once: the base, plus the War Camp's. */
export function armySlots(state: GameState): number {
  let extra = 0;
  for (const d of state.city.districts) {
    const ladder = DISTRICTS[d.definitionId].armySlotsPerLevel ?? [];
    if (d.state === 'Built' && ladder.length > 0) extra = Math.max(extra, levelIndexed(ladder, d.level));
  }
  return WORLD.armySlots + extra;
}

export const freeArmySlots = (state: GameState): number =>
  Math.max(0, armySlots(state) - state.world.armies.length);

/** A hero marching with an army is busy until it is home (10-heroes.md §2.7). */
export const heroAway = (state: GameState, id: HeroId): boolean =>
  state.world.armies.some((a) => a.heroes.includes(id));

/** Soldiers out on the board: still the kingdom's, still in the halls' cap. */
export const troopsAway = (state: GameState): number =>
  state.world.armies.reduce((sum, a) => sum + a.troops.reduce((s, t) => s + t.count, 0), 0);

/** Lend an army its soldiers and heroes. */
export function departArmy(state: GameState, out: WorldArmyOut): void {
  applyLosses(state, out.troops, 0); // off the roster — no one is hurt
  state.world.armies.push(out);
}

/** What the server says came home. */
export interface ArmyHome {
  armyId: string;
  at: number;
  troops: Array<{ unitId: UnitId; count: number }>;
  fallen: Array<{ unitId: UnitId; count: number }>;
  heroes: Array<{ id: HeroId; hp: number }>;
}

/** Take an army home: survivors back on the roster, a share of the fallen
 *  into the Infirmary's beds as far as there is room, each hero's HP. An
 *  army the client does not know is ignored. */
export function receiveArmy(state: GameState, home: ArmyHome): boolean {
  const out = state.world.armies.find((a) => a.id === home.armyId);
  if (out === undefined) return false;
  for (const t of home.troops) {
    for (let i = 0; i < t.count; i++) state.army.push({ uniqueId: newId(state, 'unit'), definitionId: t.unitId });
  }
  const share = woundedShareFor(state, out.heroes);
  let room = Math.max(0, woundedCap(state) - woundedCount(state));
  for (const f of home.fallen) {
    const saved = Math.min(room, Math.round(f.count * share));
    if (saved <= 0) continue;
    room -= saved;
    state.city.wounded[f.unitId] = woundedOf(state, f.unitId) + saved;
  }
  for (const h of home.heroes) setHeroHp(state, h.id, h.hp, home.at);
  state.world.armies = state.world.armies.filter((a) => a !== out);
  return true;
}
