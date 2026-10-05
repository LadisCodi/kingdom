// What can be done on a world hex, read off the server's last snapshot
// (Docs/features/19-world-map.md §5.1, §7). The dispatch sheet draws its
// buttons from this; the server's answer to the command is what counts, so
// nothing here has to be the final word — only the right offer.

import { WORLD_BUILD } from '../../sim/data/definitions';
import type { WorldBuildWhat } from '../../sim/state';
import { SEAT_INDICES, type BoardHex } from '../../sim/world/board';
import { boardNeighbors } from '../../sim/world/hex';
import type { HexControl, WorldSource } from '../../sim/world/source';
import { WORLD_UPGRADES, type WorldDistrict, type WorldUpgrade } from '../../sim/world/types';
import { claimGold, districtOf } from '../../worldServer/core';
import { formatCount } from '../format';

export type HexAction =
  /** Claim the hex: build its district, which its feature decides (19 §5.1). */
  | { kind: 'claim'; district: WorldDistrict; gold: number; seconds: number }
  /** An army: to attack a rival's ground, to take ground nobody holds, or to
   *  man the player's own Fortress (19 §4–§6). */
  | { kind: 'army'; purpose: 'attack' | 'claim' | 'garrison' | 'delve' | 'portal' }
  /** Go down the Portal's next floor, with the army in it. */
  | { kind: 'descend'; army: string }
  | { kind: 'recall'; army: string }
  /** Fight the next room of a dungeon, with the army camped there. */
  | { kind: 'delve'; army: string }
  /** Build an upgrade into the district, or raise it a level (19 §7.2). */
  | { kind: 'upgrade'; upgrade: WorldUpgrade; level: number; gold: number; seconds: number }
  | { kind: 'collect'; currency: NonNullable<HexControl['stores']>['currency']; amount: number; ready: boolean };

/** Is a world build an upgrade rather than a district's claim? */
export const isUpgrade = (what: WorldBuildWhat): what is WorldUpgrade => (WORLD_UPGRADES as readonly string[]).includes(what);

/** A world build's name: the district's, or the upgrade's. */
export const worldBuildName = (what: WorldBuildWhat): string =>
  isUpgrade(what) ? WORLD_BUILD.upgrades[what].name : WORLD_BUILD.districts[what].name;

/** Seconds a builder spends on a world build: a district, or an upgrade's level. */
export const worldBuildSeconds = (what: WorldBuildWhat, level: number): number =>
  isUpgrade(what) ? WORLD_BUILD.upgrades[what].levels[level - 1]?.buildSeconds ?? 0 : WORLD_BUILD.claim.buildSeconds;

/** What the player is told when a world build stands. */
export const worldBuildDone = (what: WorldBuildWhat, level: number): string =>
  !isUpgrade(what) ? `Your ${worldBuildName(what)} stands — the ground is yours`
    : level === 1 ? `Your ${worldBuildName(what)} stands` : `${worldBuildName(what)} reached level ${formatCount(level)}`;

/** Hexes `seat` holds or is claiming beyond its city. */
export const hexesHeldBy = (source: WorldSource, seat: number): number =>
  source.board().hexes.filter((h) => source.hexOf(h.index)?.owner === seat).length;

/** Whether `seat` reaches `index` from held, active ground or its city. */
function touches(source: WorldSource, seat: number, index: number): boolean {
  return boardNeighbors(index).some((n) => {
    if (n === SEAT_INDICES[seat]) return true;
    const h = source.hexOf(n);
    return h !== null && h.owner === seat && h.held && h.active;
  });
}

/** What a builder is doing on a hex, and when it began and ends: its
 *  district going up, or an upgrade's level. Every job takes exactly its
 *  data's time, so when it began is when it ends less that. Null when
 *  nothing is building. */
export function hexWork(h: HexControl): { what: string; startedAt: number; endsAt: number } | null {
  if (!h.held) {
    const ms = WORLD_BUILD.claim.buildSeconds * 1000;
    return { what: `Building the ${WORLD_BUILD.districts[h.district].name}`, startedAt: h.standsAt - ms, endsAt: h.standsAt };
  }
  if (h.work === null) return null;
  const def = WORLD_BUILD.upgrades[h.work.upgrade];
  return {
    what: h.work.toLevel === 1 ? `Building the ${def.name}` : `${def.name} to level ${formatCount(h.work.toLevel)}`,
    startedAt: h.work.at - (def.levels[h.work.toLevel - 1]?.buildSeconds ?? 0) * 1000,
    endsAt: h.work.at,
  };
}

/** What `seat` can do on this hex now, in the order the sheet shows it.
 *  Nothing is claimed, built on or sent an army until it is Revealed: the
 *  player acts only on ground they have seen (19 §3). */
export function hexActions(source: WorldSource, seat: number, bh: BoardHex, seen: { revealed: boolean }): HexAction[] {
  if (!seen.revealed) return [];
  const h = source.hexOf(bh.index);
  // The Dark Portal: any army may go down while it is open (19 §10.3).
  if (bh.role === 'portal') {
    const portal = source.portal();
    const mine = source.armies().find((a) => a.owner === seat && a.purpose === 'portal' && a.phase !== 'home');
    if (mine !== undefined) return mine.phase === 'camp' ? [{ kind: 'descend', army: mine.id }, { kind: 'recall', army: mine.id }] : [{ kind: 'recall', army: mine.id }];
    return portal?.open ? [{ kind: 'army', purpose: 'portal' }] : [];
  }
  // A dungeon: never held, open to any army (19 §8.1).
  if (bh.features.includes('Dungeon')) {
    const mine = source.armies().find((a) => a.owner === seat && a.target === bh.index && a.purpose === 'delve' && a.phase !== 'home');
    if (mine === undefined) return [{ kind: 'army', purpose: 'delve' }];
    if (mine.phase === 'camp') return [{ kind: 'delve', army: mine.id }, { kind: 'recall', army: mine.id }];
    return [{ kind: 'recall', army: mine.id }];
  }
  if (h !== null && h.held && h.owner !== seat) {
    return [{ kind: 'army', purpose: h.owner === null ? 'claim' : 'attack' }];
  }
  if (h === null) {
    const district = districtOf(bh);
    if (district === null || !touches(source, seat, bh.index)) return [];
    return [{ kind: 'claim', district, gold: claimGold(hexesHeldBy(source, seat)), seconds: WORLD_BUILD.claim.buildSeconds }];
  }
  if (h.owner !== seat || !h.held) return [];
  const out: HexAction[] = [];
  // The player's own Fortress: man it, or call its garrison home.
  if (h.fortress > 0) {
    if (h.garrison && h.garrison.owner === seat) out.push({ kind: 'recall', army: h.garrison.army });
    else out.push({ kind: 'army', purpose: 'garrison' });
  }
  if (h.stores !== null && h.stores.cap > 0) {
    const amount = Math.floor(h.stores.amount);
    out.push({ kind: 'collect', currency: h.stores.currency, amount, ready: amount > 0 });
  }
  if (h.work !== null || !h.active) return out;
  for (const upgrade of WORLD_UPGRADES) {
    const levels = WORLD_BUILD.upgrades[upgrade].levels;
    const level = h.fortress + 1;
    if (level > levels.length) continue;
    out.push({ kind: 'upgrade', upgrade, level, gold: levels[level - 1].gold, seconds: levels[level - 1].buildSeconds });
  }
  return out;
}
