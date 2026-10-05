// What can be done on a world hex, read off the server's last snapshot
// (Docs/features/19-world-map.md §5.1, §7). The dispatch sheet draws its
// buttons from this; the server's answer to the command is what counts, so
// nothing here has to be the final word — only the right offer.

import { WORLD_BUILD, WORLD_CAMPS } from '../../sim/data/definitions';
import type { ArtifactId, Wallet, WorldBuildWhat } from '../../sim/state';
import { SEAT_INDICES, type BoardHex } from '../../sim/world/board';
import { boardNeighbors } from '../../sim/world/hex';
import type { HexControl, WorldSource } from '../../sim/world/source';
import { WORLD_UPGRADES, type WorldDistrict, type WorldUpgrade } from '../../sim/world/types';
import { claimGold, districtOf, upgradeLevel } from '../../worldServer/core';
import { campTribute } from '../../sim/world/camps';
import type { ScoutPay } from '../../sim/world/scouting';
import { formatCount } from '../format';

export type HexAction =
  /** Claim the hex: build its district, which its feature decides (19 §5.1). */
  | { kind: 'claim'; district: WorldDistrict; gold: number; seconds: number }
  /** An army: to attack a rival's ground, to take ground nobody holds, or to
   *  man the player's own Fortress (19 §4–§6). */
  | { kind: 'army'; purpose: 'attack' | 'claim' | 'garrison' | 'delve' | 'portal' | 'clear' }
  /** Pay a camp off instead of fighting it (19 §5.4). */
  | { kind: 'tribute'; cost: Wallet }
  /** Go down the Portal's next floor, with the army in it. */
  | { kind: 'descend'; army: string }
  | { kind: 'recall'; army: string }
  /** Fight the next room of a dungeon, with the army camped there. */
  | { kind: 'delve'; army: string }
  /** Open a dungeon's delve screen (19 §8.2). */
  | { kind: 'openDelve' }
  /** Repair a district a camp burnt (19 §5.5). */
  | { kind: 'repair'; gold: number; seconds: number }
  /** Build an upgrade into the district, or raise it a level (19 §7.2). */
  | { kind: 'upgrade'; upgrade: WorldUpgrade; level: number; gold: number; seconds: number; blocked?: string }
  /** Host a restored world relic in the Chapel, or take it out
   *  (relic-restoration.md §5.2). */
  | { kind: 'host'; relic: ArtifactId }
  | { kind: 'unhost'; relic: ArtifactId }
  | { kind: 'collect'; currency: NonNullable<HexControl['stores']>['currency'] | null; amount: number; ready: boolean };

/** Is a world build an upgrade rather than a district's claim? */
export const isUpgrade = (what: WorldBuildWhat): what is WorldUpgrade => (WORLD_UPGRADES as readonly string[]).includes(what);

/** A world build's name: the district's, the upgrade's, or a repair. */
export const worldBuildName = (what: WorldBuildWhat): string =>
  what === 'Repair' ? 'Repair' : isUpgrade(what) ? WORLD_BUILD.upgrades[what].name : WORLD_BUILD.districts[what].name;

/** Seconds a builder spends on a world build: a district, an upgrade's
 *  level, or a repair — a share of a district's build (19 §5.5). */
export const worldBuildSeconds = (what: WorldBuildWhat, level: number): number =>
  what === 'Repair' ? Math.round(WORLD_BUILD.claim.buildSeconds * WORLD_CAMPS.repairTimeShare)
    : isUpgrade(what) ? WORLD_BUILD.upgrades[what].levels[level - 1]?.buildSeconds ?? 0 : WORLD_BUILD.claim.buildSeconds;

/** What the player is told when a world build stands. */
export const worldBuildDone = (what: WorldBuildWhat, level: number): string =>
  what === 'Repair' ? 'Your district is repaired, and works again'
    : !isUpgrade(what) ? `Your ${worldBuildName(what)} stands — the ground is yours`
      : level === 1 ? `Your ${worldBuildName(what)} stands` : `${worldBuildName(what)} reached level ${formatCount(level)}`;

/** What a scouting reward is called, as a player reads it: "1,000 Gold",
 *  "a Green pack". */
export function scoutWords(pay: ScoutPay): string {
  if (pay.pack !== null) return `a ${pay.pack} pack`;
  return [...Object.entries(pay.wallet), ...Object.entries(pay.goods)]
    .map(([c, n]) => `${formatCount(n as number)} ${c === 'HeroXp' ? 'Hero XP' : c}`).join(', ');
}

/** What repairing a burnt district costs: a share of what the next claim
 *  costs, as the server prices it (worldServer/core.ts `repairPrice`). */
export const repairGold = (source: WorldSource, seat: number): number =>
  Math.round(claimGold(Math.max(0, hexesHeldBy(source, seat) - 1)) * WORLD_CAMPS.repairCostShare);

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
  if ((h.repairAt ?? null) !== null) {
    const ms = worldBuildSeconds('Repair', 1) * 1000;
    return { what: 'Repairing the district', startedAt: h.repairAt! - ms, endsAt: h.repairAt! };
  }
  if (h.work === null) return null;
  const def = WORLD_BUILD.upgrades[h.work.upgrade];
  return {
    what: h.work.toLevel === 1 ? `Building the ${def.name}` : `${def.name} to level ${formatCount(h.work.toLevel)}`,
    startedAt: h.work.at - (def.levels[h.work.toLevel - 1]?.buildSeconds ?? 0) * 1000,
    endsAt: h.work.at,
  };
}

/** The Chapels `seat` has built or is building, and how many it may: one,
 *  and one more per `chapelsPerHexes` hexes held — a Shrine district's own
 *  is not counted (worldServer/core.ts `chapelsAllowed`). */
export function chapelRoom(source: WorldSource, seat: number): { built: number; allowed: number } {
  const board = source.board();
  const mine = board.hexes.map((h) => ({ bh: h, h: source.hexOf(h.index) }))
    .filter(({ h }) => h !== null && h.owner === seat);
  const built = mine.filter(({ bh, h }) => districtOf(bh) !== 'Shrine' && (h!.chapel === true || h!.work?.upgrade === 'Chapel')).length;
  return { built, allowed: 1 + Math.floor(mine.length / Math.max(1, WORLD_BUILD.chapelsPerHexes)) };
}

/** What `seat` can do on this hex now, in the order the sheet shows it.
 *  Nothing is claimed, built on or sent an army until it is Revealed: the
 *  player acts only on ground they have seen (19 §3). `relics` are the
 *  player's restored world relics, which a Chapel here could host. */
export function hexActions(
  source: WorldSource, seat: number, bh: BoardHex, seen: { revealed: boolean }, relics: readonly ArtifactId[] = [],
): HexAction[] {
  if (!seen.revealed) return [];
  const h = source.hexOf(bh.index);
  // The Dark Portal: any army may go down while it is open (19 §10.3).
  if (bh.role === 'portal') {
    const portal = source.portal();
    const mine = source.armies().find((a) => a.owner === seat && a.purpose === 'portal' && a.phase !== 'home');
    if (mine !== undefined) return mine.phase === 'camp' ? [{ kind: 'descend', army: mine.id }, { kind: 'recall', army: mine.id }] : [{ kind: 'recall', army: mine.id }];
    return portal?.open ? [{ kind: 'army', purpose: 'portal' }] : [];
  }
  // A dungeon: never held, open to any army (19 §8.1). Everything about it
  // happens on the delve screen; the sheet only opens it.
  if (bh.features.includes('Dungeon')) return [{ kind: 'openDelve' }];
  if (h !== null && h.held && h.owner !== seat) {
    return [{ kind: 'army', purpose: h.owner === null ? 'claim' : 'attack' }];
  }
  // A camp the player has not beaten stands between them and the ground:
  // fight it, or pay it off (19 §5.4).
  if (h === null && bh.camp !== null && !source.campBeaten(bh.index)) {
    const mine = source.armies().find((a) => a.owner === seat && a.target === bh.index && a.purpose === 'clear' && a.phase !== 'home');
    if (mine !== undefined) return [{ kind: 'recall', army: mine.id }];
    return [{ kind: 'army', purpose: 'clear' }, { kind: 'tribute', cost: campTribute(bh.camp.power) }];
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
  // One Collect for both stores: the district's, and a rich one's precious.
  const gems = h.precious != null && h.precious.cap > 0 ? Math.floor(h.precious.amount) : 0;
  if ((h.stores !== null && h.stores.cap > 0) || gems > 0) {
    const amount = h.stores === null ? 0 : Math.floor(h.stores.amount);
    out.push({ kind: 'collect', currency: h.stores?.currency ?? null, amount, ready: amount > 0 || gems > 0 });
  }
  // Burnt by raiders: repaired before anything is built into it (19 §5.5).
  if (h.burnt) {
    if ((h.repairAt ?? null) === null) {
      out.push({ kind: 'repair', gold: repairGold(source, seat), seconds: worldBuildSeconds('Repair', 1) });
    }
    return out;
  }
  // A Chapel's relic: host one of the player's world relics, or take it out.
  if (h.chapel === true) {
    for (const relic of relics) if (h.relic?.id !== relic) out.push({ kind: 'host', relic });
    if (h.relic != null) out.push({ kind: 'unhost', relic: h.relic.id });
  }
  if (h.work !== null || !h.active) return out;
  for (const upgrade of WORLD_UPGRADES) {
    const levels = WORLD_BUILD.upgrades[upgrade].levels;
    // A Shrine district's Chapel is its own: nothing to build.
    if (upgrade === 'Chapel' && h.chapel === true) continue;
    const level = upgradeLevel({ fortress: h.fortress, chapel: h.chapel ? 1 : 0 }, upgrade) + 1;
    if (level > levels.length) continue;
    const room = upgrade === 'Chapel' ? chapelRoom(source, seat) : null;
    out.push({
      kind: 'upgrade', upgrade, level, gold: levels[level - 1].gold, seconds: levels[level - 1].buildSeconds,
      ...(room !== null && room.built >= room.allowed
        ? { blocked: `Hold ${formatCount(room.allowed * WORLD_BUILD.chapelsPerHexes)} hexes to build another Chapel` } : {}),
    });
  }
  return out;
}
