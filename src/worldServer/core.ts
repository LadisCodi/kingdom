// The world server's rules, as pure functions of its state and `now`
// (Docs/features/19-world-map.md §5–§7, Docs/features/02-map-scopes.md §3.1).
//
// The same shape as the client's `advance()`: everything due is resolved in
// time order the moment the board is read, so the outcome never depends on
// when anyone looks. A store's rate only changes AT an event (a level
// finishing, a chain breaking, a collect), so its contents are anchored at
// the last event and READ as anchor + rate × time — never accumulated step
// by step, which would round differently however the reads fell. A board
// read once after a week and a board read every minute agree to the bit.
//
// The client imports the read-only half (what a hex is worth, whether it
// can be claimed) to draw its buttons; only the server's answer counts.

import { roundPrice } from '../sim/roundPrice';
import {
  boardPower, buildBoard, generateEnemy, poolsAfter, resolveBattle, survivorsOf,
  type BattleLog, type Board as FightBoard, type Side,
} from '../sim/battle';
import {
  ARTIFACTS, LAIRS, VILLAIN_ORDER, WORLD, WORLD_BOTS, WORLD_BUILD, WORLD_CAMPS, WORLD_DUNGEON, WORLD_PORTAL, WORLD_PRECIOUS,
  relicKind,
} from '../sim/data/definitions';
import { parseCrest } from '../sim/crest';
import { spoilsOf, type Spoils } from '../sim/skills';
import { rand, randInt } from '../sim/rng';
import { type ArtifactId, type HeroId, type LairId, type PreciousId, type UnitId } from '../sim/state';
import { SEATS_PER_BOARD, SEAT_INDICES, lumpMaterial, wedgeIndexOf, withDungeons, type Board, type BoardHex } from '../sim/world/board';
import { CAMP_CREATURE, campFightBoard } from '../sim/world/camps';
import { onGround } from '../sim/world/terrainCombat';
import { PORTAL_INDICES, boardNeighbors, hexAt, hexDistance, isBoardIndex, ringOf } from '../sim/world/hex';
import { fastestRoute, homeboundMs, outboundMs, stepTimes } from '../sim/world/travel';
import { boardOf } from '../sim/world/source';
import { WORLD_DISTRICTS, WORLD_UPGRADES, depositMaterial, type WorldDistrict, type WorldUpgrade } from '../sim/world/types';
import type {
  ArmyPurpose, ArmyView, BoardRef, CollectResult, CampFightResult, CommandResult, DelveResult, HexView, PortalView, Refusal, SeatBoost,
  RaidPlan, SendResult, ServerArmy, ServerBoard, ServerHex, ServerWorld, WorldEffect, WorldSnapshot, WorldStoreCurrency,
} from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const emptyWorld = (): ServerWorld => ({ version: 5, boards: [] });

/** The seed of a board the server opens, from its name. */
export const newBoardSeed = (id: string): number => randInt(0x5eed, 0x1_0000_0000, 'board', id);

/** The board as generated from its seed: where the dungeons started. */
const generated = (b: ServerBoard): Board => boardOf({ id: b.id, seed: b.seed, seat: 0 });

/** The board as it stands: the generated one with the dungeons where they
 *  are now (19 §8.1). Every rule reads this one. */
/** The board with its dungeons where they stand now, kept per board until
 *  one of them moves: it is read thousands of times an event, and a world
 *  has 42 dungeons. */
const LIVE_DATA = new WeakMap<ServerBoard, { gen: Board; at: Array<number | null>; live: Board }>();
function boardData(b: ServerBoard): Board {
  const gen = generated(b);
  const ds = dungeonsOf(b);
  const kept = LIVE_DATA.get(b);
  if (kept !== undefined && kept.gen === gen && kept.at.length === ds.length && ds.every((d, i) => d.index === kept.at[i])) {
    return kept.live;
  }
  const live = withDungeons(gen, standingDungeons(b));
  LIVE_DATA.set(b, { gen, at: ds.map((d) => d.index), live });
  return live;
}

/** The sixths' dungeons; a board stored before they moved reads them from
 *  its generated board. */
function dungeonsOf(b: ServerBoard): NonNullable<ServerBoard['dungeons']> {
  b.dungeons ??= generated(b).hexes
    .filter((h) => h.features.includes('Dungeon'))
    .map((h) => ({ wedge: wedgeIndexOf(h.hex) ?? 0, n: 0, index: h.index, returnsAt: null }));
  return b.dungeons;
}

/** The places a dungeon never shares a hex with. */
const SITES = new Set(['Dungeon', 'Sanctuary', 'Landmark']);

const standingDungeons = (b: ServerBoard): number[] =>
  dungeonsOf(b).filter((d) => d.index !== null).map((d) => d.index!);

// ------------------------------------------------------------ what a hex is

/** The district a hex is, decided by its feature (19 §7): null for a hex
 *  that is never held — a city, the Portal, a dungeon. */
export function districtOf(bh: BoardHex): WorldDistrict | null {
  if (bh.seat !== null || bh.role === 'portal' || bh.features.includes('Dungeon')) return null;
  const feature = bh.features[0] ?? 'None';
  return WORLD_DISTRICTS.find((d) => WORLD_BUILD.districts[d].feature === feature) ?? null;
}

/** What a district on this hex makes an hour and how much its store holds,
 *  in its currency: the inner ring multiplies both, so its store lasts the
 *  same hours. */
export function districtRate(
  bh: BoardHex, boost: SeatBoost = NO_BOOST,
): { currency: WorldStoreCurrency | null; perHour: number; cap: number } {
  const d = districtOf(bh);
  const def = d === null ? null : WORLD_BUILD.districts[d];
  if (def === null || def.produces === '') return { currency: null, perHour: 0, cap: 0 };
  const mult = bh.role === 'inner' ? WORLD_BUILD.innerRingMultiplier : 1;
  return { currency: def.produces, perHour: def.perHour * mult * boost.produce, cap: def.store * mult * boost.store };
}

const NO_BOOST: SeatBoost = { produce: 1, store: 1 };

/** What a deposit's district yields an hour of its material and how much
 *  its precious store holds (Docs/plans/precious-deposits.md); nothing on
 *  other ground. The inner ring and a seat's research move it as they move
 *  any district. */
export function preciousRate(
  board: Board, index: number, boost: SeatBoost = NO_BOOST,
): { id: PreciousId | null; perHour: number; cap: number } {
  const bh = board.hexes[index];
  const id = districtOf(bh) !== null ? depositMaterial(bh.features) : null;
  if (id === null) return { id: null, perHour: 0, cap: 0 };
  const mult = bh.role === 'inner' ? WORLD_BUILD.innerRingMultiplier : 1;
  return {
    id,
    perHour: (WORLD_PRECIOUS.perDay / 24) * mult * boost.produce,
    cap: WORLD_PRECIOUS.perDay * WORLD_PRECIOUS.storeDays * mult * boost.store,
  };
}

/** What a seat's research does to its districts' output and stores; none for
 *  a free hex. */
const boostOf = (b: ServerBoard, owner: number | null): SeatBoost =>
  (owner === null ? undefined : b.seats[owner]?.boost) ?? NO_BOOST;

/** The crest a seat's kingdom chose, or null for its nickname's. Nothing
 *  on the board turns on it: it is only drawn. */
export function setCrest(b: ServerBoard, seat: number, crest: string | null): void {
  const s = b.seats[seat];
  if (s === null || s === undefined) return;
  if (parseCrest(crest) === null) delete s.crest;
  else s.crest = crest!;
}

/** A seat's Townhall level, for the ranking to show (19 §12). Nothing on
 *  the board turns on it. */
export function setTownhall(b: ServerBoard, seat: number, level: number): void {
  const s = b.seats[seat];
  if (s === null || s === undefined || !Number.isInteger(level) || level < 1) return;
  s.townhall = level;
}

/**
 * Take a seat's multipliers on its districts' output and stores. A rate
 * changes only at an event, so every store is settled to `t` first: what was
 * made before the research is not repriced, and nothing after it is missed.
 */
export function setBoost(b: ServerBoard, seat: number, boost: SeatBoost, t: number): void {
  const s = b.seats[seat];
  if (s === null || s === undefined) return;
  const next = { produce: Math.max(1, boost.produce), store: Math.max(1, boost.store) };
  const now = s.boost ?? NO_BOOST;
  if (now.produce === next.produce && now.store === next.store) return;
  resolveTo(b, t);
  settleStores(b, t);
  s.boost = next;
}

/** What the next claim costs a seat that already holds or claims `held`
 *  hexes beyond its city. */
export const claimGold = (held: number): number =>
  roundPrice(WORLD_BUILD.claim.gold * WORLD_BUILD.claim.goldGrowth ** held);

const isHeld = (h: ServerHex | undefined, t: number): h is ServerHex => h !== undefined && h.standsAt <= t;

export const hexesOf = (b: ServerBoard, seat: number): number => Object.values(b.hexes).filter((h) => h.owner === seat).length;

/** Whether `seat` may claim `index` now, and why not. */
export function claimRefusal(b: ServerBoard, seat: number, index: number, t: number): Refusal | null {
  if (!isBoardIndex(index)) return 'NoSuchHex';
  const bh = boardData(b).hexes[index];
  if (bh.role === 'portal' || bh.features.includes('Dungeon')) return 'NeverHeld';
  if (SEAT_INDICES.includes(index) || b.hexes[index] !== undefined) return 'Taken';
  if (!touches(b, seat, index, t)) return 'NotAdjacent';
  return guarded(b, seat, index, t) ? 'Guarded' : null;
}

// ------------------------------------------------------------- camps

/** The monster camp on a hex as the board was made (19 §5.4), or null. */
export const campAt = (b: ServerBoard, index: number) => boardData(b).hexes[index]?.camp ?? null;

/** Has `seat` beaten the camp on `index`, and has it not stood again yet?
 *  Each player beats a camp for themselves, and it comes back to them
 *  `returnHours` later. */
export const hasBeaten = (b: ServerBoard, seat: number, index: number, t: number): boolean =>
  (b.beaten?.[seat]?.includes(index) ?? false) && t < (b.campsBack?.[seat]?.[index] ?? Infinity);

/** Does a camp still stand between `seat` and claiming `index`? Once anyone
 *  holds the hex, its camp no longer matters. */
const guarded = (b: ServerBoard, seat: number, index: number, t: number): boolean =>
  b.hexes[index] === undefined && campAt(b, index) !== null && !hasBeaten(b, seat, index, t);

/** `seat` beat or paid off the camp on `index` at `t`: it stands again for
 *  them later, and a raid it had announced on them is off. */
function beat(b: ServerBoard, seat: number, index: number, t: number): void {
  const list = ((b.beaten ??= {})[seat] ??= []);
  if (!list.includes(index)) list.push(index);
  ((b.campsBack ??= {})[seat] ??= {})[index] = t + Math.round(WORLD_CAMPS.returnHours * HOUR);
  const raid = b.raids?.[seat];
  if (raid !== undefined && raid.camp === index) restRaid(b, seat, raid, t);
}

/** The camps `seat` has beaten that have not stood again by `t`. */
const beatenNow = (b: ServerBoard, seat: number, t: number): number[] =>
  (b.beaten?.[seat] ?? []).filter((i) => hasBeaten(b, seat, i, t));

/** The camp's army: its creature's lair is its formation's type, as a lair's
 *  garrison is (18 §2), rolled under the hex. */
function campBoard(b: ServerBoard, index: number): FightBoard {
  return campFightBoard(b.seed, index, campAt(b, index)!);
}

/** Pay a camp off: the client paid its tribute; the camp is beaten for this
 *  seat, and pays nothing. */
export function tribute(b: ServerBoard, seat: number, index: number, t: number): CommandResult {
  resolveTo(b, t);
  if (!isBoardIndex(index)) return { ok: false, why: 'NoSuchHex' };
  if (b.hexes[index] !== undefined) return { ok: false, why: 'Taken' };
  if (!guarded(b, seat, index, t)) return { ok: false, why: 'NothingThere' };
  beat(b, seat, index, t);
  return { ok: true, finishesAt: t, snapshot: snapshotOf(b, seat, t) };
}

// ------------------------------------------------------------ camp raids

/** Whether `seat` can see the camp on `index` — standing, or lurking and
 *  reported seen by its client. */
const campSeen = (b: ServerBoard, seat: number, index: number): boolean => {
  const camp = campAt(b, index);
  return camp !== null && (!camp.lurking || (b.seenCamps?.[seat] ?? []).includes(index));
};

/** The camps that could raid `seat`'s district on `index`: beside it,
 *  standing for `seat`, on ground nobody holds, and seen. */
export function raidersOf(b: ServerBoard, seat: number, index: number, t: number): number[] {
  return boardNeighbors(index).filter((c) => guarded(b, seat, c, t) && campSeen(b, seat, c));
}

/** The client says which lurking camps the player has now seen. */
export function reportSeen(b: ServerBoard, seat: number, indices: readonly number[], t: number): CommandResult {
  resolveTo(b, t);
  const seen = ((b.seenCamps ??= {})[seat] ??= []);
  for (const i of indices) if (isBoardIndex(i) && campAt(b, i)?.lurking && !seen.includes(i)) seen.push(i);
  return { ok: true, finishesAt: t, snapshot: snapshotOf(b, seat, t) };
}

/** What repairing a burnt district costs `seat` now, and how long it takes. */
export const repairPrice = (b: ServerBoard, seat: number): { gold: number; seconds: number } => ({
  gold: roundPrice(claimGold(Math.max(0, hexesOf(b, seat) - 1)) * WORLD_CAMPS.repairCostShare),
  seconds: Math.round(WORLD_BUILD.claim.buildSeconds * WORLD_CAMPS.repairTimeShare),
});

/** Start repairing a burnt district. The client pays the Gold and sends the
 *  builder. */
export function repair(b: ServerBoard, seat: number, index: number, t: number): CommandResult {
  resolveTo(b, t);
  const h = b.hexes[index];
  if (h === undefined || h.owner !== seat) return { ok: false, why: 'NotYours' };
  if (!h.burnt) return { ok: false, why: 'NothingThere' };
  if ((h.repairAt ?? null) !== null) return { ok: false, why: 'Busy' };
  h.repairAt = t + repairPrice(b, seat).seconds * 1000;
  return { ok: true, finishesAt: h.repairAt, snapshot: snapshotOf(b, seat, t) };
}

/** A player's raid plan (19 §5.5). */
export const raidOf = (b: ServerBoard, seat: number): RaidPlan | null => b.raids?.[seat] ?? null;

/** The wait after raid step `n` before a camp chooses again: between
 *  `raidGapMinHours` and `raidGapMaxHours`, rolled for that step. */
const raidGap = (b: ServerBoard, seat: number, n: number): number => {
  const { raidGapMinHours: lo, raidGapMaxHours: hi } = WORLD_CAMPS;
  return Math.round((lo + (Math.max(lo, hi) - lo) * rand(b.seed, 'raidGap', seat, n)) * HOUR);
};

/** Between raids: the next camp chooses a raid-gap after `t`. */
function restRaid(b: ServerBoard, seat: number, raid: RaidPlan, t: number): void {
  raid.n += 1;
  raid.camp = null;
  raid.target = null;
  raid.at = t + raidGap(b, seat, raid.n);
}

/** A camp beaten before camps came back stands again `returnHours` from
 *  where the board stands. */
function dateOldBeats(b: ServerBoard): void {
  for (const [seat, list] of Object.entries(b.beaten ?? {})) {
    const back = ((b.campsBack ??= {})[Number(seat)] ??= {});
    for (const i of list) back[i] ??= b.resolvedTo + Math.round(WORLD_CAMPS.returnHours * HOUR);
  }
}

/** A player just seated rests a raid-gap before the first camp chooses. */
function startRaids(b: ServerBoard, seat: number, t: number): void {
  (b.raids ??= {})[seat] = { n: 0, at: t + raidGap(b, seat, 0), camp: null, target: null };
}

/** Every player's seat has a raid plan; one seated before raids were
 *  planned starts resting from where the board stands. */
function planRaids(b: ServerBoard): void {
  b.seats.forEach((s, seat) => {
    if (s === null || s.bot || b.raids?.[seat] !== undefined) return;
    startRaids(b, seat, b.resolvedTo);
  });
}

/** `seat`'s districts a camp could raid now, with the camps that could:
 *  held, standing, unburnt, in board order. */
function raidChoices(b: ServerBoard, seat: number, t: number): Array<{ camp: number; target: number }> {
  const out: Array<{ camp: number; target: number }> = [];
  for (const index of Object.keys(b.hexes).map(Number).sort((x, y) => x - y)) {
    const h = b.hexes[index];
    if (h.owner !== seat || !isHeld(h, t) || h.burnt) continue;
    for (const camp of raidersOf(b, seat, index, t)) out.push({ camp, target: index });
  }
  return out;
}

/** Is the raid announced on `seat` still on — its camp standing and seen,
 *  its district theirs, held and unburnt? */
function raidStands(b: ServerBoard, seat: number, raid: RaidPlan, t: number): boolean {
  if (raid.camp === null || raid.target === null) return false;
  const h = b.hexes[raid.target];
  return h !== undefined && h.owner === seat && isHeld(h, t) && !h.burnt
    && guarded(b, seat, raid.camp, t) && campSeen(b, seat, raid.camp);
}

/** A raid step due at `t`: a camp chooses one of the player's districts and
 *  announces its raid — or, with none in reach, waits another gap; or the
 *  raid announced lands, and the next is a gap away. */
function stepRaid(b: ServerBoard, seat: number, raid: RaidPlan, t: number): void {
  if (raid.camp === null) {
    const choices = raidChoices(b, seat, t);
    if (choices.length === 0) {
      restRaid(b, seat, raid, t);
      return;
    }
    const pick = choices[Math.floor(rand(b.seed, 'raid', seat, raid.n) * choices.length)];
    raid.n += 1;
    raid.camp = pick.camp;
    raid.target = pick.target;
    raid.at = t + Math.round(WORLD_CAMPS.raidWarnHours * HOUR);
    return;
  }
  if (raidStands(b, seat, raid, t)) raidDistrict(b, seat, raid.target!, raid.camp, t);
  restRaid(b, seat, raid, t);
}

/** The camp on `c` raids `seat`'s district on `index`: a garrisoned Fortress
 *  fights the raiders; otherwise, or if it falls, the district burns and
 *  the raiders carry off `raidShare` of its stores. */
function raidDistrict(b: ServerBoard, seat: number, index: number, c: number, t: number): void {
  const h = b.hexes[index];
  const camp = campAt(b, c)!;
  const who = `the camp of ${CAMP_CREATURE[camp.creature]}`;
  const name = WORLD_BUILD.districts[districtOf(boardData(b).hexes[index]) ?? 'Rural'].name;
  const g = h.garrison === null ? undefined : b.armies.find((a) => a.id === h.garrison);
  if (g !== undefined) {
    // Fought on the raided district's ground (19 §4.2).
    const ground = boardData(b).hexes[index];
    const log = resolveBattle(onGround(campBoard(b, c), ground), onGround(g.board, ground));
    const theirs = boardAfter(log, g.board, 'theirs');
    g.board = theirs.board;
    addFallen(g.fallen, theirs.fallen);
    const lost = theirs.fallen.reduce((n, f) => n + f.count, 0);
    if (log.winner === 'theirs') {
      report(b, seat, t, `Your Fortress garrison drove off ${who} at your ${name}${lost > 0 ? ` — ${lost} soldiers lost` : ''}`, true, index);
      return;
    }
    h.garrison = null;
    report(b, seat, t, `Your Fortress garrison fell to ${who} at your ${name}`, false, index);
    sendHome(b, g, t);
  }
  const keep = 1 - WORLD_CAMPS.raidShare;
  const taken = Math.floor(h.stored * WORLD_CAMPS.raidShare);
  h.stored *= keep;
  if ((h.precious ?? 0) > 0) h.precious = (h.precious ?? 0) * keep;
  h.burnt = true;
  const currency = districtRate(boardData(b).hexes[index]).currency;
  report(b, seat, t, `${capitalise(who)} raided your ${name} — it burns${taken > 0 && currency !== null ? `, ${taken} ${currency} taken` : ''}`, false, index);
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Repairs done by `t`: the district stands whole again. */
function finishRepairs(b: ServerBoard, t: number): void {
  for (const h of Object.values(b.hexes)) {
    if ((h.repairAt ?? null) !== null && h.repairAt! <= t) {
      h.burnt = false;
      h.repairAt = null;
    }
  }
}

// ------------------------------------------------------------ the Exchange, closed

/** The Exchange is gone (friends trade instead, 15-social.md §2.4). An offer
 *  a board still holds from before goes back whole to the player who made
 *  it — a rival's simply goes — the first time the board is resolved. */
function closeExchange(b: ServerBoard, t: number): void {
  for (const o of b.offers ?? []) {
    if (b.seats[o.seat]?.bot === false) {
      owe(b, o.seat, { kind: 'goods', at: t, lot: { ...o.give }, text: `The Exchange has closed — ${o.give.amount} ${o.give.id} came back` });
    }
  }
  delete b.offers;
}

/** Whether a hex lies beside `seat`'s city or its held, active ground. */
function touches(b: ServerBoard, seat: number, index: number, t: number): boolean {
  return boardNeighbors(index).some((n) =>
    n === SEAT_INDICES[seat] || (b.hexes[n]?.owner === seat && b.hexes[n].active && isHeld(b.hexes[n], t)));
}

/** Whether `seat` may build or raise `upgrade` in its district on `index`
 *  now, and why not. Any district takes the Fortress (19 §7.2). */
export function upgradeRefusal(b: ServerBoard, seat: number, index: number, upgrade: WorldUpgrade, t: number): Refusal | null {
  if (!isBoardIndex(index)) return 'NoSuchHex';
  const h = b.hexes[index];
  if (h === undefined || h.owner !== seat) return 'NotYours';
  if (!isHeld(h, t)) return 'NotStanding';
  if (h.work !== null) return 'Busy';
  if (!h.active) return 'Inactive';
  if (upgradeLevel(h, upgrade) >= WORLD_BUILD.upgrades[upgrade].levels.length) return 'MaxLevel';
  if (upgrade === 'Chapel') {
    // A Shrine district has a Chapel of its own; the rest are counted.
    if (hasChapel(b, index)) return 'MaxLevel';
    if (chapelsOf(b, seat) >= chapelsAllowed(b, seat)) return 'TooManyChapels';
  }
  // A building that is not there yet takes a slot of its own (19 §7.2).
  if (upgradeLevel(h, upgrade) === 0 && slotsUsed(b, index) >= districtSlots(b, index)) return 'NoSlot';
  return null;
}

/** How many buildings the district on `index` holds: one, two on bare
 *  ground (19 §7.2). */
export function districtSlots(b: ServerBoard, index: number): number {
  const d = districtOf(boardData(b).hexes[index]);
  return d === null ? 0 : WORLD_BUILD.districts[d].slots;
}

/** The buildings standing or going up in the district on `index` — a
 *  Shrine district's own Chapel among them. */
export function slotsUsed(b: ServerBoard, index: number): number {
  const h = b.hexes[index];
  if (h === undefined) return 0;
  return WORLD_UPGRADES.filter((u) => (u === 'Chapel' ? hasChapel(b, index) : upgradeLevel(h, u) > 0)
    || h.work?.upgrade === u).length;
}

/** An upgrade's level on a hex: 0 for none. */
export const upgradeLevel = (h: Pick<ServerHex, 'fortress' | 'chapel'>, upgrade: WorldUpgrade): number =>
  upgrade === 'Fortress' ? h.fortress : h.chapel ?? 0;

function setUpgradeLevel(h: ServerHex, upgrade: WorldUpgrade, level: number): void {
  if (upgrade === 'Fortress') h.fortress = level;
  else h.chapel = level;
}

// ---------------------------------------------------------------- chapels

/** Does a Chapel stand in this hex — built, or its Shrine district's own? */
export function hasChapel(b: ServerBoard, index: number): boolean {
  const h = b.hexes[index];
  if (h === undefined) return false;
  return (h.chapel ?? 0) > 0 || districtOf(boardData(b).hexes[index]) === 'Shrine';
}

/** The Chapels a seat has built or is building — a Shrine district's own
 *  does not count. */
export const chapelsOf = (b: ServerBoard, seat: number): number => Object.values(b.hexes)
  .filter((h) => h.owner === seat && ((h.chapel ?? 0) > 0 || h.work?.upgrade === 'Chapel')).length;

/** How many Chapels a seat may build: one, and one more per
 *  `chapelsPerHexes` hexes it holds. */
export const chapelsAllowed = (b: ServerBoard, seat: number): number =>
  1 + Math.floor(hexesOf(b, seat) / Math.max(1, WORLD_BUILD.chapelsPerHexes));

/**
 * HOST A WORLD RELIC in the Chapel on `seat`'s hex, at the level the client
 * sends. One relic, one Chapel: hosting it takes it from wherever it was, and
 * a relic the Chapel held goes home.
 */
export function hostRelic(
  b: ServerBoard, seat: number, index: number, relic: ArtifactId, level: number, t: number,
): CommandResult {
  resolveTo(b, t);
  if (!isBoardIndex(index)) return { ok: false, why: 'NoSuchHex' };
  const h = b.hexes[index];
  if (h === undefined || h.owner !== seat) return { ok: false, why: 'NotYours' };
  if (!isHeld(h, t)) return { ok: false, why: 'NotStanding' };
  if (!hasChapel(b, index)) return { ok: false, why: 'NoChapel' };
  if (ARTIFACTS[relic] === undefined || relicKind(relic) !== 'world' || !(level >= 1)) {
    return { ok: false, why: 'NotAWorldRelic' };
  }
  for (const other of Object.values(b.hexes)) {
    if (other !== h && other.owner === seat && other.relic === relic) other.relic = null;
  }
  h.relic = relic;
  const s = b.seats[seat];
  if (s) (s.relics ??= {})[relic] = Math.floor(level);
  return { ok: true, finishesAt: t, snapshot: snapshotOf(b, seat, t) };
}

/** Take a world relic out of its Chapel, home to its owner. */
export function unhostRelic(b: ServerBoard, seat: number, relic: ArtifactId, t: number): CommandResult {
  resolveTo(b, t);
  const h = Object.values(b.hexes).find((x) => x.owner === seat && x.relic === relic);
  if (h === undefined) return { ok: false, why: 'NothingThere' };
  h.relic = null;
  return { ok: true, finishesAt: t, snapshot: snapshotOf(b, seat, t) };
}

/** A hex lost — taken or denied: its relic goes home to whoever held it, at
 *  its level, and the Chapel stands empty (relic-restoration.md §5.3). */
function relicGoesHome(b: ServerBoard, h: ServerHex, holder: number, t: number, index: number): void {
  if (h.relic === undefined || h.relic === null) return;
  report(b, holder, t, `${ARTIFACTS[h.relic].name} came home from the ground you lost`, false, index);
  h.relic = null;
}

// ------------------------------------------------------------- resolving

/** What a hex's store holds at `t`: its anchor, plus its rate since. */
export function storedAt(b: ServerBoard, index: number, t: number): number {
  const h = b.hexes[index];
  if (h === undefined) return 0;
  const dt = t - h.storeAt;
  if (dt <= 0 || !h.active || h.burnt || !isHeld(h, h.storeAt)) return h.stored;
  const { perHour, cap } = districtRate(boardData(b).hexes[index], boostOf(b, h.owner));
  return Math.min(Math.max(cap, h.stored), h.stored + (perHour * dt) / HOUR);
}

/** What a rich hex's precious store holds at `t`, from the same anchor. */
export function preciousAt(b: ServerBoard, index: number, t: number): number {
  const h = b.hexes[index];
  if (h === undefined) return 0;
  const held = h.precious ?? 0;
  const dt = t - h.storeAt;
  if (dt <= 0 || !h.active || h.burnt || !isHeld(h, h.storeAt)) return held;
  const { perHour, cap } = preciousRate(boardData(b), index, boostOf(b, h.owner));
  return Math.min(Math.max(cap, held), held + (perHour * dt) / HOUR);
}

/** Move one hex's anchor to `t`. */
function settleHex(b: ServerBoard, index: number, t: number): void {
  const h = b.hexes[index];
  if (h === undefined || t <= h.storeAt) return;
  const precious = preciousAt(b, index, t);
  if (precious > 0) h.precious = precious;
  h.stored = storedAt(b, index, t);
  h.storeAt = t;
}

/** Move every anchor to `t` — at an event only, before the rates change. */
function settleStores(b: ServerBoard, t: number): void {
  for (const key of Object.keys(b.hexes)) settleHex(b, Number(key), t);
}

/** Every hex's chain back to its owner's city, in one pass (19 §5.2). The
 *  Portal carries nothing; an inactive hex carries nothing. */
export function recomputeChains(b: ServerBoard, t: number): void {
  for (const h of Object.values(b.hexes)) h.active = false;
  SEAT_INDICES.forEach((city, seat) => {
    const seen = new Set<number>([city]);
    const frontier = [city];
    while (frontier.length > 0) {
      const at = frontier.pop()!;
      for (const n of boardNeighbors(at)) {
        const h = b.hexes[n];
        if (seen.has(n) || h === undefined || h.owner !== seat || !isHeld(h, t)) continue;
        seen.add(n);
        h.active = true;
        frontier.push(n);
      }
    }
  });
}

/** The next moment strictly after `after` at which something is due. */
function nextEvent(b: ServerBoard, after: number): number {
  let next = Infinity;
  const consider = (at: number | null) => { if (at !== null && at > after && at < next) next = at; };
  for (const h of Object.values(b.hexes)) {
    consider(h.standsAt);
    consider(h.work?.at ?? null);
  }
  for (const s of b.seats) consider(s?.bot ? s.nextMoveAt : null);
  for (const a of b.armies) consider(a.at);
  for (const d of dungeonsOf(b)) consider(d.returnsAt);
  for (const h of Object.values(b.hexes)) consider(h.repairAt ?? null);
  // Each player's raid: a camp choosing, or its raid landing (19 §5.5).
  for (const r of Object.values(b.raids ?? {})) consider(r.at);
  // The Portal's close pays the ranking and sends its divers home.
  const k = portalEvent(after);
  consider(portalClosesAt(k) > after ? portalClosesAt(k) : portalClosesAt(k + 1));
  return next;
}

function applyDue(b: ServerBoard, t: number): void {
  // Levels finishing, in board order.
  const keys = Object.keys(b.hexes).map(Number).sort((x, y) => x - y);
  for (const k of keys) {
    const h = b.hexes[k];
    if (h.work !== null && h.work.at <= t) {
      setUpgradeLevel(h, h.work.upgrade, h.work.toLevel);
      h.work = null;
    }
  }
  recomputeChains(b, t);
  closePortal(b, t);
  finishRepairs(b, t);
  for (const [seat, r] of Object.entries(b.raids ?? {})) if (r.at <= t) stepRaid(b, Number(seat), r, t);
  for (const d of dungeonsOf(b)) if (d.returnsAt !== null && d.returnsAt <= t) returnDungeon(b, d, t);
  // Armies reaching where they were going, in the order they get there.
  const due = b.armies.filter((a) => a.at !== null && a.at <= t)
    .sort((x, y) => x.at! - y.at! || (x.id < y.id ? -1 : 1));
  for (const a of due) {
    if (!b.armies.includes(a)) continue; // fell in a fight earlier in this instant
    if (a.phase === 'home') sendHome(b, a, t);
    else arrive(b, a, t);
  }
  b.seats.forEach((s, seat) => {
    if (s?.bot && s.nextMoveAt !== null && s.nextMoveAt <= t) {
      botMove(b, seat, t);
      recomputeChains(b, t);
    }
  });
}

/** Resolve everything due up to `t`. Idempotent; never goes backwards. */
export function resolveTo(b: ServerBoard, t: number): void {
  if (b.offers !== undefined) closeExchange(b, b.resolvedTo);
  if (t <= b.resolvedTo) return;
  planRaids(b);
  dateOldBeats(b);
  for (let guard = 0; guard < 10_000; guard++) {
    const next = nextEvent(b, b.resolvedTo);
    if (next > t) break;
    settleStores(b, next);
    applyDue(b, next);
    b.resolvedTo = next;
  }
  b.resolvedTo = t;
}

// ------------------------------------------------------------- commands

function startClaim(b: ServerBoard, seat: number, index: number, t: number): number {
  const at = t + WORLD_BUILD.claim.buildSeconds * 1000;
  b.hexes[index] = {
    owner: seat, standsAt: at, fortress: 0, work: null, active: false, stored: 0, storeAt: t, garrison: null,
  };
  return at;
}

function startUpgrade(b: ServerBoard, index: number, upgrade: WorldUpgrade, t: number): number {
  const h = b.hexes[index];
  const toLevel = upgradeLevel(h, upgrade) + 1;
  const at = t + WORLD_BUILD.upgrades[upgrade].levels[toLevel - 1].buildSeconds * 1000;
  h.work = { upgrade, toLevel, at };
  return at;
}

/** Claim a hex: build its district. */
export function claim(b: ServerBoard, seat: number, index: number, t: number): CommandResult {
  resolveTo(b, t);
  const why = claimRefusal(b, seat, index, t);
  if (why !== null) return { ok: false, why };
  const finishesAt = startClaim(b, seat, index, t);
  return { ok: true, finishesAt, snapshot: snapshotOf(b, seat, t) };
}

/** Build an upgrade into a district, or raise it a level. */
export function upgrade(b: ServerBoard, seat: number, index: number, what: WorldUpgrade, t: number): CommandResult {
  resolveTo(b, t);
  const why = upgradeRefusal(b, seat, index, what, t);
  if (why !== null) return { ok: false, why };
  const finishesAt = startUpgrade(b, index, what, t);
  return { ok: true, finishesAt, snapshot: snapshotOf(b, seat, t) };
}

/** Finish what a builder is doing on `seat`'s hex now — its district, or the
 *  upgrade being raised. What it is paid with is the client's: the server
 *  only makes it stand. */
export function finish(b: ServerBoard, seat: number, index: number, t: number): CommandResult {
  resolveTo(b, t);
  const h = b.hexes[index];
  if (h === undefined || h.owner !== seat) return { ok: false, why: 'NotYours' };
  const claiming = h.standsAt > t;
  const repairing = (h.repairAt ?? null) !== null;
  if (!claiming && h.work === null && !repairing) return { ok: false, why: 'NothingBuilding' };
  // Every store to now first: what stands changes the rates, as at an event.
  settleStores(b, t);
  if (claiming) {
    h.standsAt = t;
    h.storeAt = t;
  } else if (h.work !== null) {
    setUpgradeLevel(h, h.work.upgrade, h.work.toLevel);
    h.work = null;
  } else if (repairing) {
    h.burnt = false;
    h.repairAt = null;
  }
  recomputeChains(b, t);
  return { ok: true, finishesAt: t, snapshot: snapshotOf(b, seat, t) };
}

/**
 * TAKE `seconds` OFF A BUILDER'S WORK on `seat`'s hex — a speed-up, paid for
 * by the client from its Bag. The end moves; a speed-up that covers what is
 * left finishes it now, exactly as `finish` does.
 */
export function hurry(b: ServerBoard, seat: number, index: number, seconds: number, t: number): CommandResult {
  resolveTo(b, t);
  const h = b.hexes[index];
  if (h === undefined || h.owner !== seat) return { ok: false, why: 'NotYours' };
  if (!(seconds > 0)) return { ok: false, why: 'NothingBuilding' };
  const ms = seconds * 1000;
  const claiming = h.standsAt > t;
  const ends = claiming ? h.standsAt : h.work !== null ? h.work.at : (h.repairAt ?? null);
  if (ends === null) return { ok: false, why: 'NothingBuilding' };
  if (ends - t <= ms) return finish(b, seat, index, t);
  if (claiming) h.standsAt -= ms;
  else if (h.work !== null) h.work.at -= ms;
  else h.repairAt = h.repairAt! - ms;
  return { ok: true, finishesAt: ends - ms, snapshot: snapshotOf(b, seat, t) };
}

/** A speed-up from the Bag, or Gems, on an army on the road: `seconds` off
 *  its march out or home. Its whole route moves with it — its departure and
 *  its arrival together — so where it stands on the board stays true; the
 *  whole of what is left, and it arrives now. Paid for by the client. */
export function hurryArmy(b: ServerBoard, seat: number, armyId: string, seconds: number, t: number): CommandResult {
  resolveTo(b, t);
  const a = b.armies.find((x) => x.id === armyId);
  if (a === undefined || a.owner !== seat) return { ok: false, why: 'NoArmy' };
  if ((a.phase !== 'out' && a.phase !== 'home') || a.at === null || !(seconds > 0)) return { ok: false, why: 'Busy' };
  const ms = Math.min(seconds * 1000, Math.max(0, a.at - t));
  a.at -= ms;
  if (a.phase === 'out') a.departedAt -= ms;
  const finishesAt = a.at;
  // Hurried all the way: it gets there now, as `applyDue` would land it.
  if (a.at <= t) {
    if (a.phase === 'home') sendHome(b, a, t);
    else arrive(b, a, t);
  }
  return { ok: true, finishesAt, snapshot: snapshotOf(b, seat, t) };
}

/** Empty a district's store into its owner's purse: whole units only, the
 *  fraction left to carry. */
export function collect(b: ServerBoard, seat: number, index: number, t: number): CollectResult {
  resolveTo(b, t);
  const h = b.hexes[index];
  if (h === undefined || h.owner !== seat) return { ok: false, why: 'NotYours' };
  settleHex(b, index, t);
  const whole = Math.floor(h.stored);
  h.stored -= whole;
  const { currency } = districtRate(boardData(b).hexes[index]);
  const gem = Math.floor(h.precious ?? 0);
  if (gem > 0) h.precious = (h.precious ?? 0) - gem;
  const material = preciousRate(boardData(b), index).id;
  return {
    ok: true,
    paid: currency === null || whole === 0 ? null : { currency, amount: whole },
    precious: material === null || gem === 0 ? null : { id: material, amount: gem },
    snapshot: snapshotOf(b, seat, t),
  };
}

// ---------------------------------------------------------------- armies

/** A path a client sent: from the seat's city to the target, a step at a
 *  time, on the board. */
const walksFrom = (from: number, to: number, path: readonly number[]): boolean =>
  path.length >= 2 && path[0] === from && path[path.length - 1] === to && path.every(isBoardIndex)
  && path.every((i, k) => k === 0 || hexDistance(hexAt(path[k - 1]), hexAt(i)) === 1);

/** Owed to a seat: delivered with every snapshot until it is acknowledged. */
function owe(b: ServerBoard, seat: number, effect: WorldEffect): void {
  (b.effects[seat] ??= []).push({ ...effect, seq: nextSeq(b, seat) });
}

function nextSeq(b: ServerBoard, seat: number): number {
  const seqs = (b.effectSeq ??= {});
  seqs[seat] = (seqs[seat] ?? 0) + 1;
  return seqs[seat];
}

/** A line for a seat's notices, and the hex it happened on when it has one
 *  (Docs/features/26-notices.md §2.1). */
const report = (b: ServerBoard, seat: number, t: number, text: string, good: boolean, hex?: number): void =>
  owe(b, seat, { kind: 'report', at: t, text, good, ...(hex === undefined ? {} : { hex }) });

const seatName = (b: ServerBoard, seat: number | null): string =>
  seat === null ? 'nobody' : b.seats[seat]?.name ?? 'a rival';

/** Walk home from wherever it stands, by the way it came. */
function turnHome(a: ServerArmy, t: number, walked = homeboundMs(a.stepMs)): void {
  a.phase = 'home';
  a.at = t + walked;
}

/** Home: what is left of it goes back to its owner's city. */
function sendHome(b: ServerBoard, a: ServerArmy, t: number): void {
  const troops = new Map<UnitId, number>();
  for (const s of a.board.slots) {
    if (s.kind === 'troop' && s.unitId !== null && s.count > 0) troops.set(s.unitId, (troops.get(s.unitId) ?? 0) + s.count);
  }
  const heroes = a.heroes.map((id) => {
    const slot = a.board.slots.find((s) => s.kind === 'hero' && s.fighterId === id);
    return { id, hp: slot === undefined ? 0 : Math.max(0, slot.hpPool) };
  });
  owe(b, a.owner, {
    kind: 'armyHome', armyId: a.id, at: t,
    troops: [...troops].map(([unitId, count]) => ({ unitId, count })),
    fallen: a.fallen, heroes,
  });
  b.armies = b.armies.filter((x) => x !== a);
}

/** What a side has left when a fight ends: each squad its survivors (a
 *  squad's HP resets between fights, combat.md §4), each hero what it was
 *  not hit for. A slot with nothing left leaves the board. */
function boardAfter(log: BattleLog, board: FightBoard, side: Side): { board: FightBoard; fallen: Array<{ unitId: UnitId; count: number }> } {
  const alive = survivorsOf(log, side);
  const pools = poolsAfter(log, side);
  const fallen: Array<{ unitId: UnitId; count: number }> = [];
  const slots = board.slots.map((s) => {
    if (s.kind === 'hero') return { ...s, hpPool: pools.get(s.id) ?? s.hpPool };
    const left = alive.get(s.id) ?? s.count;
    if (s.unitId !== null && left < s.count) fallen.push({ unitId: s.unitId, count: s.count - left });
    return { ...s, count: left, hpPool: left * s.hpUnit };
  }).filter((s) => (s.kind === 'hero' ? s.hpPool > 0 : s.count > 0));
  return { board: { slots }, fallen };
}

const addFallen = (into: Array<{ unitId: UnitId; count: number }>, more: Array<{ unitId: UnitId; count: number }>): void => {
  for (const f of more) {
    const row = into.find((x) => x.unitId === f.unitId);
    if (row) row.count += f.count; else into.push({ ...f });
  }
};

/** The garrisons that cover a hex: its own Fortress's and its neighbours',
 *  if they are its holder's (19 §6.1). Fought in board order. */
const coveringGarrisons = (b: ServerBoard, index: number, holder: number): ServerArmy[] => b.armies
  .filter((g) => g.phase === 'garrison' && g.owner === holder
    && (g.target === index || boardNeighbors(index).includes(g.target)))
  .sort((x, y) => x.target - y.target || (x.id < y.id ? -1 : 1));

function arrive(b: ServerBoard, a: ServerArmy, t: number): void {
  const h = b.hexes[a.target];
  if (a.purpose === 'portal') {
    if (PORTAL_INDICES.includes(a.target) && portalOpen(t)) {
      a.phase = 'camp';
      a.at = null;
    } else turnHome(a, t);
    return;
  }
  if (a.purpose === 'delve') {
    if (isDungeon(b, a.target)) {
      a.phase = 'camp';
      a.at = null;
    } else turnHome(a, t);
    return;
  }
  if (a.purpose === 'garrison') {
    if (h !== undefined && h.owner === a.owner && isHeld(h, t) && h.fortress > 0 && h.garrison === null) {
      a.phase = 'garrison';
      a.at = null;
      h.garrison = a.id;
    } else turnHome(a, t);
    return;
  }
  if (a.purpose === 'clear') {
    // At a camp the army waits, ready, for its player to call the attack
    // (`fightCamp`, 19 §5.4). No camp to fight: back home.
    const camp = campAt(b, a.target);
    if (camp !== null && guarded(b, a.owner, a.target, t)) {
      a.phase = 'camp';
      a.at = null;
      report(b, a.owner, t, `Your army reached the camp of ${CAMP_CREATURE[camp.creature]} and is ready to attack`, true, a.target);
    } else {
      report(b, a.owner, t, 'Your army found no camp there and turned back', false, a.target);
      turnHome(a, t);
    }
    return;
  }
  if (a.purpose === 'claim') {
    if (h !== undefined && h.owner === null && touches(b, a.owner, a.target, t)) {
      h.owner = a.owner;
      recomputeChains(b, t);
      report(b, a.owner, t, 'Your army took ground nobody held', true, a.target);
    } else report(b, a.owner, t, 'Your army found nothing to claim and turned back', false, a.target);
    turnHome(a, t);
    return;
  }
  // An attack (19 §6): every covering garrison in turn, then the hex.
  if (h === undefined || h.owner === null || h.owner === a.owner) {
    report(b, a.owner, t, 'Your army found nobody to fight and turned back', false, a.target);
    turnHome(a, t);
    return;
  }
  const holder = h.owner;
  for (const g of coveringGarrisons(b, a.target, holder)) {
    const ground = boardData(b).hexes[a.target];
    const log = resolveBattle(onGround(a.board, ground), onGround(g.board, ground));
    const ours = boardAfter(log, a.board, 'ours');
    const theirs = boardAfter(log, g.board, 'theirs');
    a.board = ours.board;
    addFallen(a.fallen, ours.fallen);
    g.board = theirs.board;
    addFallen(g.fallen, theirs.fallen);
    if (log.winner === 'theirs') {
      report(b, a.owner, t, `Your army was beaten back by ${seatName(b, holder)}'s Fortress`, false, a.target);
      report(b, holder, t, `Your Fortress held against ${seatName(b, a.owner)}`, true, g.target);
      turnHome(a, t);
      return;
    }
    b.hexes[g.target].garrison = null;
    report(b, holder, t, `Your Fortress garrison fell to ${seatName(b, a.owner)}`, false, g.target);
    sendHome(b, g, t);
  }
  // Nobody left standing in the way: taken beside the attacker's ground,
  // denied anywhere else. Either way its relic goes home.
  relicGoesHome(b, h, holder, t, a.target);
  if (touches(b, a.owner, a.target, t)) {
    h.owner = a.owner;
    report(b, a.owner, t, `Your army took ground from ${seatName(b, holder)}`, true, a.target);
    report(b, holder, t, `${seatName(b, a.owner)} took your ground`, false, a.target);
  } else {
    h.owner = null;
    h.stored = 0;
    h.work = null;
    report(b, a.owner, t, `Your army denied ${seatName(b, holder)} their ground`, true, a.target);
    report(b, holder, t, `${seatName(b, a.owner)} drove you off your ground`, false, a.target);
  }
  h.garrison = null;
  recomputeChains(b, t);
  turnHome(a, t);
}

/** Why `seat` cannot send an army for `purpose` to `index` now, or null. */
export function sendRefusal(b: ServerBoard, seat: number, purpose: ArmyPurpose, index: number, t: number): Refusal | null {
  if (!isBoardIndex(index)) return 'NoSuchHex';
  const h = b.hexes[index];
  if (purpose === 'portal') {
    if (!PORTAL_INDICES.includes(index)) return 'NothingThere';
    if (!portalOpen(t)) return 'Shut';
    return b.armies.some((a) => a.owner === seat && a.purpose === 'portal' && a.phase !== 'home') ? 'Busy' : null;
  }
  if (purpose === 'delve') {
    if (!isDungeon(b, index)) return 'NothingThere';
    return b.armies.some((a) => a.owner === seat && a.target === index && a.purpose === 'delve' && a.phase !== 'home')
      ? 'Busy' : null;
  }
  if (purpose === 'garrison') {
    if (h === undefined || h.owner !== seat) return 'NotYours';
    if (!isHeld(h, t) || h.fortress === 0) return 'NotAFortress';
    const heading = b.armies.some((a) => a.owner === seat && a.target === index && a.purpose === 'garrison' && a.phase !== 'home');
    return h.garrison !== null || heading ? 'Garrisoned' : null;
  }
  if (purpose === 'claim') return h !== undefined && h.owner === null ? null : 'NothingThere';
  if (purpose === 'clear') {
    if (!guarded(b, seat, index, t)) return 'NothingThere';
    return b.armies.some((a) => a.owner === seat && a.target === index && a.purpose === 'clear' && a.phase !== 'home')
      ? 'Busy' : null;
  }
  if (h === undefined || h.owner === null) return 'NothingThere';
  return h.owner === seat ? 'OwnGround' : null;
}

/** Set an army out from `seat`'s city. The client built its board and took
 *  its troops off the roster; the server trusts what it was sent. */
export function sendArmy(
  b: ServerBoard, seat: number,
  req: { purpose: ArmyPurpose; target: number; heroes: HeroId[]; board: FightBoard; path?: number[]; speed?: number },
  t: number,
): SendResult {
  resolveTo(b, t);
  const why = sendRefusal(b, seat, req.purpose, req.target, t);
  if (why !== null) return { ok: false, why };
  const path = req.path !== undefined ? (walksFrom(SEAT_INDICES[seat], req.target, req.path) ? req.path : null)
    : fastestRoute(boardData(b).hexes, SEAT_INDICES[seat], req.target, 'army', () => true)?.path ?? null;
  if (path === null) return { ok: false, why: 'NoRoute' };
  const a = launch(b, seat, { ...req, path }, t);
  return { ok: true, army: a.id, arrivesAt: a.at!, snapshot: snapshotOf(b, seat, t) };
}

/** Put an army on the road — inside the resolve loop as well as from it. */
function launch(
  b: ServerBoard, seat: number,
  req: { purpose: ArmyPurpose; target: number; heroes: HeroId[]; board: FightBoard; path: number[]; speed?: number },
  t: number,
): ServerArmy {
  const path = req.path;
  // Every hex adds its own time as it is left; the server prices it, at the
  // pace the client sent.
  const speed = Math.max(1, req.speed ?? 1);
  const stepMs = stepTimes(boardData(b).hexes, path, 'army', () => speed);
  const a: ServerArmy = {
    id: `army_${b.nextId++}`, owner: seat, heroes: [...req.heroes], board: req.board, path,
    departedAt: t, stepMs, purpose: req.purpose,
    phase: 'out', target: req.target, at: t + outboundMs(stepMs), fallen: [],
  };
  b.armies.push(a);
  return a;
}

/** Call an army home from where it stands: its Fortress, a dungeon or the
 *  Portal. An army on the road is not called back, only hurried. */
export function recall(b: ServerBoard, seat: number, armyId: string, t: number): CommandResult {
  resolveTo(b, t);
  const a = b.armies.find((x) => x.id === armyId);
  if (a === undefined || a.owner !== seat) return { ok: false, why: 'NoArmy' };
  if (a.phase === 'home') return { ok: false, why: 'Busy' };
  if (a.phase === 'out') return { ok: false, why: 'Marching' };
  if (b.hexes[a.target]?.garrison === a.id) b.hexes[a.target].garrison = null;
  turnHome(a, t);
  return { ok: true, finishesAt: a.at!, snapshot: snapshotOf(b, seat, t) };
}

// --------------------------------------------------------------- dungeons

const isDungeon = (b: ServerBoard, index: number): boolean =>
  isBoardIndex(index) && dungeonsOf(b).some((d) => d.index === index);

const dungeonAt = (b: ServerBoard, index: number) => dungeonsOf(b).find((d) => d.index === index);

/** Which dungeon this is — its sixth and how many times it has moved — so a
 *  dungeon that comes back is a new one, rooms and all. */
const dungeonKey = (b: ServerBoard, index: number): string => {
  const d = dungeonAt(b, index);
  return d === undefined ? `hex${index}` : `${d.wedge}:${d.n}`;
};

/**
 * The first to clear a dungeon's last boss closes it for everyone (19 §8.1):
 * they are paid its last boss again `closeRewardMultiplier` times over, every
 * army camped there walks home, everyone's progress in it is gone, and it
 * comes back elsewhere in its sixth after a rolled while.
 */
function closeDungeon(b: ServerBoard, index: number, closer: number, t: number): void {
  const d = dungeonAt(b, index);
  if (d === undefined) return;
  const last = roomReward(WORLD_DUNGEON.depths - 1, WORLD_DUNGEON.roomsPerDepth);
  const k = WORLD_DUNGEON.closeRewardMultiplier;
  owe(b, closer, {
    kind: 'loot', at: t, from: 'boss',
    gold: Math.round(last.gold * k), knowledge: Math.round(last.knowledge * k),
    heroXp: roundPrice(last.heroXp * WORLD_DUNGEON.closeHeroXpMultiplier), stardust: Math.round(last.stardust * k),
    precious: { id: lumpMaterial(boardData(b), closer, 'close', dungeonKey(b, index)), amount: Math.round(last.precious * k) },
  });
  report(b, closer, t, 'You cleared the dungeon to the bottom — it is closed', true, index);
  for (const a of b.armies) {
    if (a.purpose !== 'delve' || a.target !== index || a.phase === 'home') continue;
    if (a.owner !== closer) report(b, a.owner, t, `${seatName(b, closer)} cleared the dungeon first — it is closed`, false, index);
    if (a.phase === 'camp') turnHome(a, t);
  }
  for (const progress of Object.values(b.delves)) delete progress[index];
  const { returnHoursMin: lo, returnHoursMax: hi } = WORLD_DUNGEON;
  d.returnsAt = t + Math.round((lo + rand(b.seed, 'dungeonReturn', d.wedge, d.n) * Math.max(0, hi - lo)) * HOUR);
  d.left = index;
  d.index = null;
  d.n += 1;
}

/**
 * A closed dungeon comes back in its own sixth, on rings 3–5: on ground
 * nobody holds and no other site stands on, never beside a city, never where
 * it last stood. It covers what the ground holds while it stands. With
 * nowhere to go it tries again an hour later.
 */
function returnDungeon(b: ServerBoard, d: NonNullable<ServerBoard['dungeons']>[number], t: number): void {
  const board = boardData(b);
  const nearCity = new Set(SEAT_INDICES.flatMap((i) => boardNeighbors(i)));
  const taken = new Set(standingDungeons(b));
  const camped = new Set(b.armies.filter((a) => a.phase !== 'home').map((a) => a.target));
  const room = board.hexes.filter((h) => {
    const ring = ringOf(h.hex);
    return ring >= 3 && wedgeIndexOf(h.hex) === d.wedge && h.seat === null && !h.features.some((f) => SITES.has(f))
      && h.index !== d.left && !nearCity.has(h.index) && !taken.has(h.index) && !camped.has(h.index)
      && b.hexes[h.index] === undefined;
  });
  if (room.length === 0) { d.returnsAt = t + HOUR; return; }
  d.index = room[Math.floor(rand(b.seed, 'dungeonPlace', d.wedge, d.n) * room.length)].index;
  d.returnsAt = null;
}

/** The room a seat faces next in a dungeon, or null when it is cleared to
 *  the bottom. Depth is 0-based, room 1-based; the last room is the boss. */
export function nextRoom(cleared: number): { depth: number; room: number; boss: boolean } | null {
  const per = WORLD_DUNGEON.roomsPerDepth;
  if (cleared >= WORLD_DUNGEON.depths * per) return null;
  const room = (cleared % per) + 1;
  return { depth: Math.floor(cleared / per), room, boss: room === per };
}

/** What a room fields. */
export function roomPower(depth: number, room: number): number {
  const base = WORLD_DUNGEON.powerStart[depth] + WORLD_DUNGEON.powerStep[depth] * (room - 1);
  return Math.round(room === WORLD_DUNGEON.roomsPerDepth ? base * WORLD_DUNGEON.bossMultiplier : base);
}

/** A won fight's pay with the party's spoils skills on it (sim/skills.ts):
 *  Plunder on the Gold, Lore on the Knowledge, Seasoned on the Hero XP. */
function withSpoils<P extends { gold: number; knowledge: number; heroXp: number }>(pay: P, sp: Spoils): P {
  return {
    ...pay,
    gold: roundPrice(pay.gold * (1 + sp.plunder)),
    knowledge: roundPrice(pay.knowledge * (1 + sp.lore)),
    heroXp: roundPrice(pay.heroXp * (1 + sp.seasoned)),
  };
}

/** What a room pays (11-expeditions.md §7.1); a boss, a multiple of it. */
export function roomReward(
  depth: number, room: number,
): { gold: number; knowledge: number; heroXp: number; stardust: number; precious: number } {
  const d = WORLD_DUNGEON;
  const boss = room === d.roomsPerDepth ? d.bossRewardMultiplier : 1;
  const scale = d.rewardBase[depth] * d.rewardGrowth ** (room - 1) * boss;
  return {
    gold: roundPrice(d.gold * scale),
    knowledge: Math.max(1, roundPrice(d.knowledge * scale)),
    heroXp: roundPrice(d.heroXp * scale),
    stardust: roundPrice(d.stardust * scale),
    precious: Math.max(1, roundPrice(d.precious * scale)),
  };
}

/** A dungeon as a player reads it: its name, the creature that holds it,
 *  who waits at the bottom of each depth — all rolled with the dungeon, so
 *  one that comes back is a new one (19 §8.1). */
export function dungeonInfo(b: ServerBoard, index: number): { name: string; creature: LairId; bosses: string[] } {
  const d = WORLD_DUNGEON;
  const key = dungeonKey(b, index);
  // Each sixth of the world owns two names of its own — a world-wide offset
  // plus twice the sixth — and its dungeon takes them in turn as it closes
  // and comes back: two standing at once never share a name, and one that
  // comes back is a new one (the data rules keep enough words for it).
  const at = dungeonAt(b, index);
  const combos = d.nameFirst.length * d.nameSecond.length;
  const c = (randInt(b.seed, combos, 'dungeonName') + 2 * (at?.wedge ?? 0) + ((at?.n ?? 0) % 2)) % combos;
  const unit = dungeonAffinity(b, index);
  const creature = (Object.keys(LAIRS) as LairId[]).find((l) => LAIRS[l].guard.threat === unit) ?? 'Orcs';
  return {
    name: `The ${d.nameFirst[c % d.nameFirst.length]} ${d.nameSecond[Math.floor(c / d.nameFirst.length) % d.nameSecond.length]}`,
    creature,
    bosses: Array.from({ length: d.depths }, (_, depth) => d.bossNames[randInt(b.seed, d.bossNames.length, 'dungeonBoss', key, depth)]),
  };
}

const UNIT_ORDER: UnitId[] = ['Warrior', 'Lancer', 'Archer', 'Cavalry'];

/** A dungeon fields one kind of soldier more than the rest, fixed by its hex. */
const dungeonAffinity = (b: ServerBoard, index: number): UnitId =>
  UNIT_ORDER[randInt(b.seed, UNIT_ORDER.length, 'dungeonAffinity', dungeonKey(b, index))];

/** Fight the next room with the army camped at the dungeon. Each fight
 *  resolves at once; the army keeps its losses and its heroes their wounds
 *  from room to room, and a wiped army goes home. */
export function delveRoom(b: ServerBoard, seat: number, armyId: string, t: number): DelveResult {
  resolveTo(b, t);
  const a = b.armies.find((x) => x.id === armyId);
  if (a === undefined || a.owner !== seat || a.phase !== 'camp') return { ok: false, why: 'NoArmy' };
  const progress = (b.delves[seat] ??= {});
  const cleared = progress[a.target] ?? 0;
  const next = nextRoom(cleared);
  if (next === null) return { ok: false, why: 'NothingThere' };
  const plan = generateEnemy({
    seed: b.seed, parts: ['dungeon', dungeonKey(b, a.target), next.depth, next.room],
    budget: roomPower(next.depth, next.room), affinity: dungeonAffinity(b, a.target),
    // A depth's boss room is held by villains — the heroes' counterpoint
    // (combat.md §9.3).
    ...(next.boss ? { villainPool: VILLAIN_ORDER } : {}),
  });
  const sp = spoilsOf(a.board.slots);
  const log = resolveBattle(a.board, buildBoard(plan.squads, plan.fighters));
  const after = boardAfter(log, a.board, 'ours');
  a.board = after.board;
  addFallen(a.fallen, after.fallen);
  const lost = after.fallen.reduce((n, f) => n + f.count, 0);
  const won = log.winner === 'ours';
  if (won) {
    progress[a.target] = cleared + 1;
    const { precious, ...pay } = withSpoils(roomReward(next.depth, next.room), sp);
    owe(b, seat, {
      kind: 'loot', at: t, ...pay, from: next.room === WORLD_DUNGEON.roomsPerDepth ? 'boss' : 'room',
      precious: { id: lumpMaterial(boardData(b), seat, 'room', dungeonKey(b, a.target), next.depth, next.room), amount: precious },
    });
  }
  // The last boss down: the dungeon closes for everyone, this army too.
  if (won && nextRoom(cleared + 1) === null) closeDungeon(b, a.target, seat, t);
  // Nothing left to fight with: what is left walks home.
  else if (!a.board.slots.some((s) => s.kind === 'hero')) turnHome(a, t);
  return { ok: true, won, log, ...next, lost, snapshot: snapshotOf(b, seat, t) };
}

// ------------------------------------------------------------ camps

/** Fight the camp an army waits at, on its player's word (19 §5.4): won,
 *  the camp is beaten for that seat and pays its loot. Either way, what is
 *  left of the army marches home. */
export function fightCamp(b: ServerBoard, seat: number, armyId: string, t: number): CampFightResult {
  resolveTo(b, t);
  const a = b.armies.find((x) => x.id === armyId);
  if (a === undefined || a.owner !== seat || a.purpose !== 'clear' || a.phase !== 'camp') return { ok: false, why: 'NoArmy' };
  const camp = campAt(b, a.target);
  if (camp === null || !guarded(b, seat, a.target, t)) {
    turnHome(a, t);
    return { ok: false, why: 'NothingThere' };
  }
  const fighters = a.board.slots;
  const ground = boardData(b).hexes[a.target];
  const log = resolveBattle(onGround(a.board, ground), onGround(campBoard(b, a.target), ground));
  const after = boardAfter(log, a.board, 'ours');
  a.board = after.board;
  addFallen(a.fallen, after.fallen);
  const lost = after.fallen.reduce((n, f) => n + f.count, 0);
  const won = log.winner === 'ours';
  const name = CAMP_CREATURE[camp.creature];
  if (won) {
    beat(b, seat, a.target, t);
    const sp = spoilsOf(fighters);
    owe(b, seat, {
      kind: 'loot', at: t, knowledge: 0, stardust: 0,
      gold: roundPrice(camp.power * WORLD_CAMPS.goldPerPower * (1 + sp.plunder)),
      heroXp: roundPrice(camp.power * WORLD_CAMPS.heroXpPerPower * (1 + sp.seasoned)),
      hours: (camp.power / 1000) * WORLD_CAMPS.productionHoursPer1000Power,
      precious: {
        id: lumpMaterial(boardData(b), seat, 'camp', a.target, seat),
        amount: Math.max(1, Math.round(camp.power * WORLD_PRECIOUS.campPerPower)),
      },
    });
    report(b, seat, t, `Your army beat the camp of ${name}`, true, a.target);
  } else {
    report(b, seat, t, `Your army was beaten back by the camp of ${name}`, false, a.target);
  }
  turnHome(a, t);
  return { ok: true, won, log, lost, creature: camp.creature, snapshot: snapshotOf(b, seat, t) };
}

// ------------------------------------------------------------ the Portal

/** The UTC day of `t`. */
const dayOf = (t: number): number => Math.floor(t / DAY);

/** Days from the epoch (a Thursday) to the first opening weekday. */
const FIRST_OPEN_DAY = ((WORLD_PORTAL.openWeekday - 4) % 7 + 7) % 7;

/** Which weekly opening `t` falls in (or after): openings are counted from
 *  the first opening weekday after the epoch, so every board agrees. */
export const portalEvent = (t: number): number => Math.floor((dayOf(t) - FIRST_OPEN_DAY) / 7);
export const portalOpensAt = (k: number): number => (FIRST_OPEN_DAY + 7 * k) * DAY;
export const portalClosesAt = (k: number): number => portalOpensAt(k) + WORLD_PORTAL.openDays * DAY;
export const portalOpen = (t: number): boolean => t >= portalOpensAt(portalEvent(t)) && t < portalClosesAt(portalEvent(t));

export const freshPortal = (t: number): ServerBoard['portal'] => ({
  event: portalEvent(t), floors: {}, milestones: {}, closed: portalEvent(t) - 1,
});

/** The Portal's state for the opening `t` is in; a stale one is wiped. */
function portalOf(b: ServerBoard, t: number): ServerBoard['portal'] {
  const k = portalEvent(t);
  if (b.portal.event !== k) b.portal = { ...freshPortal(t), closed: b.portal.closed };
  return b.portal;
}

const rankingOf = (p: ServerBoard['portal']): Array<{ seat: number; floor: number }> =>
  Object.entries(p.floors)
    .map(([seat, f]) => ({ seat: Number(seat), floor: f.floor, at: f.at }))
    .filter((r) => r.floor > 0)
    .sort((x, y) => y.floor - x.floor || x.at - y.at || x.seat - y.seat)
    .map(({ seat, floor }) => ({ seat, floor }));

/** At an opening's close: the final ranking pays, and every diver walks
 *  home. Once per opening. */
function closePortal(b: ServerBoard, t: number): void {
  const k = portalEvent(t);
  const justClosed = t >= portalClosesAt(k) ? k : k - 1;
  if (b.portal.closed >= justClosed) return;
  if (b.portal.event === justClosed) {
    const ranking = rankingOf(b.portal);
    ranking.forEach((r, place) => owe(b, r.seat, {
      kind: 'portalClosed', at: t, event: justClosed, place: place + 1, of: ranking.length, floor: r.floor,
      gems: WORLD_PORTAL.rankGems[place] ?? 0,
    }));
  }
  b.portal.closed = justClosed;
  for (const a of b.armies) if (a.purpose === 'portal' && a.phase === 'camp') turnHome(a, t, 0);
}

/** What a floor fields. */
export const floorPower = (floor: number): number =>
  Math.round(WORLD_PORTAL.powerStart * WORLD_PORTAL.powerGrowth ** (floor - 1));

/** What a floor pays: the dungeon room formula on the Portal's own scale,
 *  and a pack on the floors that carry one. */
export function floorReward(
  floor: number,
): { gold: number; knowledge: number; heroXp: number; stardust: number; pack?: 'Rose' | 'Golden'; precious: number } {
  const scale = WORLD_PORTAL.rewardBase * WORLD_PORTAL.rewardGrowth ** (floor - 1);
  const d = WORLD_DUNGEON;
  const pack = floor % WORLD_PORTAL.goldenEvery === 0 ? 'Golden' : floor % WORLD_PORTAL.roseEvery === 0 ? 'Rose' : undefined;
  return {
    gold: roundPrice(d.gold * scale), knowledge: Math.max(1, roundPrice(d.knowledge * scale)),
    heroXp: roundPrice(d.heroXp * scale), stardust: roundPrice(d.stardust * scale),
    ...(pack ? { pack } : {}),
    // Every `preciousEvery` floors, a lump of precious material (19 §10.4).
    precious: floor % WORLD_PORTAL.preciousEvery === 0 ? Math.max(1, roundPrice(WORLD_PORTAL.precious * scale)) : 0,
  };
}

/** Go down the next floor with the army in the Portal. Floors are taken one
 *  at a time; a clear spends an attempt, a failure spends nothing. */
export function descendPortal(b: ServerBoard, seat: number, armyId: string, t: number): DelveResult {
  resolveTo(b, t);
  const a = b.armies.find((x) => x.id === armyId);
  if (a === undefined || a.owner !== seat || a.phase !== 'camp' || a.purpose !== 'portal') return { ok: false, why: 'NoArmy' };
  if (!portalOpen(t)) return { ok: false, why: 'Shut' };
  const p = portalOf(b, t);
  const floor = (p.floors[seat]?.floor ?? 0) + 1;
  if (floor > WORLD_PORTAL.floors) return { ok: false, why: 'NothingThere' };
  const plan = generateEnemy({ seed: b.seed, parts: ['portal', p.event, floor], budget: floorPower(floor), affinity: 'Any' });
  const sp = spoilsOf(a.board.slots);
  const log = resolveBattle(a.board, buildBoard(plan.squads, plan.fighters));
  const after = boardAfter(log, a.board, 'ours');
  a.board = after.board;
  addFallen(a.fallen, after.fallen);
  const won = log.winner === 'ours';
  if (won) {
    p.floors[seat] = { floor, at: t };
    let gems = 0;
    if (floor % WORLD_PORTAL.milestoneEvery === 0 && p.milestones[floor] === undefined) {
      p.milestones[floor] = seat;
      gems = WORLD_PORTAL.milestoneGems;
      report(b, seat, t, `First to floor ${floor} of the Portal`, true, a.target);
    }
    const { precious, ...pay } = withSpoils(floorReward(floor), sp);
    owe(b, seat, {
      kind: 'loot', at: t, ...pay, from: 'portal', ...(gems > 0 ? { gems } : {}),
      ...(precious > 0 ? { precious: { id: lumpMaterial(boardData(b), seat, 'portal', p.event, floor), amount: precious } } : {}),
    });
  }
  if (!a.board.slots.some((s) => s.kind === 'hero')) turnHome(a, t);
  const lost = after.fallen.reduce((n, f) => n + f.count, 0);
  return { ok: true, won, log, depth: 0, room: floor, boss: false, lost, snapshot: snapshotOf(b, seat, t) };
}

function portalView(b: ServerBoard, seat: number, t: number): PortalView {
  const k = portalEvent(t);
  const open = portalOpen(t);
  const p = b.portal.event === k ? b.portal : null;
  return {
    open,
    opensAt: open ? portalOpensAt(k) : portalOpensAt(t >= portalClosesAt(k) ? k + 1 : k),
    closesAt: open ? portalClosesAt(k) : portalClosesAt(t >= portalClosesAt(k) ? k + 1 : k),
    floor: p?.floors[seat]?.floor ?? 0,
    ranking: p === null ? [] : rankingOf(p),
  };
}

/** What the server still owes a seat once it has acknowledged every effect
 *  up to `ack`: those are forgotten, the rest delivered again. An effect
 *  owed before effects were numbered is numbered now. */
export function owedTo(b: ServerBoard, seat: number, ack: number): WorldEffect[] {
  const owed = b.effects[seat];
  if (owed === undefined) return [];
  for (const e of owed) e.seq ??= nextSeq(b, seat);
  const left = owed.filter((e) => e.seq! > ack);
  if (left.length === 0) delete b.effects[seat];
  else b.effects[seat] = left;
  return left.map((e) => ({ ...e }));
}

/** Everything owed to a seat, acknowledged as it is handed over. */
export function drainEffects(b: ServerBoard, seat: number): WorldEffect[] {
  const out = owedTo(b, seat, 0);
  delete b.effects[seat];
  return out;
}

/** A stand-in rival's army: rolled from a budget, keyed by the seat and the
 *  move that raised it. */
function botBoard(b: ServerBoard, seat: number, move: number, power: number): FightBoard {
  const plan = generateEnemy({ seed: b.seed, parts: ['botArmy', seat, move], budget: power, affinity: 'Any' });
  return buildBoard(plan.squads, plan.fighters);
}

// ----------------------------------------------------------------- bots

/** A stand-in rival's move: man an empty Fortress, now and then attack a
 *  neighbour, claim ground while it is under its size, then build a
 *  Fortress into one of its districts and raise it. It pays nothing. */
function botMove(b: ServerBoard, seat: number, t: number): void {
  const s = b.seats[seat]!;
  const roll = (what: string, max: number) => randInt(b.seed, max, 'bot', seat, s.moves, what);
  const data = boardData(b);
  const mine = Object.entries(b.hexes).map(([k, h]) => [Number(k), h] as const).filter(([, h]) => h.owner === seat);
  let done = false;
  // An empty Fortress is manned at once, from the city.
  const empty = mine.find(([, h]) => h.fortress > 0 && isHeld(h, t) && h.garrison === null);
  if (empty !== undefined) {
    const [i, h] = empty;
    const g: ServerArmy = {
      id: `army_${b.nextId++}`, owner: seat, heroes: [], board: botBoard(b, seat, s.moves, WORLD_BOTS.garrisonPower),
      path: [SEAT_INDICES[seat], i], departedAt: t, stepMs: [1, 1],
      purpose: 'garrison', phase: 'garrison', target: i, at: null, fallen: [],
    };
    b.armies.push(g);
    h.garrison = g.id;
    done = true;
  }
  // Now and then, an attack on a neighbour's ground beside its own.
  if (!done && rand(b.seed, 'botAttack', seat, s.moves) < WORLD_BOTS.attackChance
    && !b.armies.some((a) => a.owner === seat && a.phase !== 'garrison')) {
    const prey: number[] = [];
    for (const [k, h] of Object.entries(b.hexes)) {
      const i = Number(k);
      if (h.owner !== null && h.owner !== seat && isHeld(h, t) && touches(b, seat, i, t)) prey.push(i);
    }
    const target = prey.length > 0 ? prey[roll('prey', prey.length)] : null;
    const route = target === null ? null : fastestRoute(data.hexes, SEAT_INDICES[seat], target, 'army', () => true);
    if (target !== null && route !== null) {
      launch(b, seat, {
        purpose: 'attack', target, heroes: [], board: botBoard(b, seat, s.moves, WORLD_BOTS.armyPower), path: route.path,
      }, t);
      done = true;
    }
  }
  // Its size is the ground it holds now: a rival whose ground was taken
  // grows again rather than standing empty for good.
  if (!done && mine.length < WORLD_BOTS.maxHexes) {
    // Only ground beside its own can be claimed or be in its way: its
    // frontier, in index order — the same list a walk of the whole world
    // gives, without walking it (a world of seven boards is 889 hexes).
    const frontier = [...new Set([SEAT_INDICES[seat], ...mine.map(([i]) => i)].flatMap(boardNeighbors))].sort((x, y) => x - y);
    // A rival beats a camp in its way after a while, by the camp's power,
    // without a fight being played out (19 §5.4).
    const pending = ((b.botCamps ??= {})[seat] ??= {});
    for (const i of frontier) {
      if (claimRefusal(b, seat, i, t) !== 'Guarded') continue;
      pending[i] ??= t + Math.round((campAt(b, i)!.power / 1000) * WORLD_CAMPS.botHoursPer1000Power * HOUR);
      if (pending[i] <= t) {
        beat(b, seat, i, t);
        // Should it stand again before the rival claims, it waits again.
        delete pending[i];
      }
    }
    const open = frontier.filter((i) => claimRefusal(b, seat, i, t) === null);
    if (open.length > 0) {
      startClaim(b, seat, open[roll('claim', open.length)], t);
      s.claims = (s.claims ?? 0) + 1;
      done = true;
    }
  }
  if (!done) {
    // One Fortress, raised as far as it goes.
    const fort = mine.find(([, h]) => h.fortress > 0 || h.work !== null);
    const at = fort ?? mine.find(([i]) => upgradeRefusal(b, seat, i, 'Fortress', t) === null);
    if (at !== undefined && upgradeRefusal(b, seat, at[0], 'Fortress', t) === null) startUpgrade(b, at[0], 'Fortress', t);
  }
  // While the Portal is open, a rival goes down a floor now and then.
  if (portalOpen(t) && rand(b.seed, 'botPortal', seat, s.moves) < WORLD_PORTAL.botFloorChance) {
    const p = portalOf(b, t);
    const now = p.floors[seat]?.floor ?? 0;
    if (now < WORLD_PORTAL.floors) p.floors[seat] = { floor: now + 1, at: t };
  }
  s.moves += 1;
  s.nextMoveAt = t + Math.round(WORLD_BOTS.actEveryHours * HOUR * (0.5 + rand(b.seed, 'botNext', seat, s.moves)));
}

// ---------------------------------------------------------------- joining

/**
 * Seat a player: on the board that already has them, else the first board
 * with a free city, else a new board whose other five cities are bots.
 * `prefer` lets a player who already explored a locally generated board keep
 * it — its id, seed and seat — so their fog still means something.
 */
/**
 * Seat a player (19 §1.3): where they already sit; else in a rival's city on
 * the newest board that still has a rival, the rival leaving it; else on a
 * new board of their own with five rivals, named `fresh` when the server
 * names it. `prefer` makes that new board a given one, and skips the rivals'
 * cities — the tests' way to a known board.
 */
export function join(
  w: ServerWorld, player: { id: string; name: string; prefer?: BoardRef; fresh?: { id: string; seed: number } }, t: number,
): { board: ServerBoard; seat: number } {
  for (const b of w.boards) {
    const seat = b.seats.findIndex((s) => s?.playerId === player.id);
    if (seat >= 0) return { board: b, seat };
  }
  for (const b of w.boards) {
    const seat = b.seats.findIndex((s) => s === null);
    if (seat >= 0) {
      b.seats[seat] = { playerId: player.id, name: player.name, bot: false, nextMoveAt: null, moves: 0 };
      startRaids(b, seat, t);
      return { board: b, seat };
    }
  }
  if (player.prefer === undefined) {
    for (const b of [...w.boards].reverse()) {
      const seat = rivalSeatFor(b);
      if (seat >= 0) {
        takeOver(b, seat, player, t);
        startRaids(b, seat, t);
        return { board: b, seat };
      }
    }
  }
  const seed = player.prefer?.seed ?? player.fresh?.seed ?? randInt(t >>> 0, 0x1_0000_0000, 'board', player.id);
  // A new world's first player sits on the middle mini-board.
  const seat = player.prefer?.seat ?? randInt(seed, SEATS_PER_BOARD, 'seat', player.id);
  let rival = 0;
  const b: ServerBoard = {
    id: player.prefer?.id ?? player.fresh?.id ?? `local-${seed.toString(36)}`,
    seed,
    seats: Array.from({ length: SEAT_INDICES.length }, (_, i) => i === seat
      ? { playerId: player.id, name: player.name, bot: false, nextMoveAt: null, moves: 0 }
      : {
        playerId: `bot-${i}`, name: rivalName(rival++), bot: true,
        nextMoveAt: t + Math.round(WORLD_BOTS.actEveryHours * HOUR * (0.25 + rand(seed, 'botFirst', i))), moves: 0,
      }),
    hexes: {},
    resolvedTo: t,
    armies: [],
    effects: {},
    nextId: 1,
    delves: {},
    portal: freshPortal(t),
  };
  startRaids(b, seat, t);
  w.boards.push(b);
  return { board: b, seat };
}

/** The rivals' names, in turn; past the list, numbered: *Aldermoor II*. */
function rivalName(i: number): string {
  const names = WORLD.rivals;
  if (names.length === 0) return `Rival ${i + 1}`;
  const round = Math.floor(i / names.length);
  const numeral = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'][round] ?? ` ${round + 1}`;
  return `${names[i % names.length]}${numeral}`;
}

/**
 * The rival's seat a new player takes on this world: on the mini-board with
 * the most players that still has a rival — the middle one first — so a
 * world fills board by board (Docs/plans/precious-deposits.md §3.1). -1
 * when no rival is left.
 */
function rivalSeatFor(b: ServerBoard): number {
  let best = -1;
  let bestPlayers = -1;
  for (let board = 0; board * SEATS_PER_BOARD < b.seats.length; board++) {
    const seats = b.seats.slice(board * SEATS_PER_BOARD, (board + 1) * SEATS_PER_BOARD);
    const rival = seats.findIndex((s) => s?.bot === true);
    if (rival < 0) continue;
    const players = seats.filter((s) => s?.bot === false).length;
    if (players > bestPlayers) {
      best = board * SEATS_PER_BOARD + rival;
      bestPlayers = players;
    }
  }
  return best;
}

/**
 * A player takes a rival's city (19 §1.3). The rival leaves the board with
 * everything that was only its own — armies, offers, plans, claims still
 * being built — and its districts stand on, nobody's, to be claimed. Its
 * stores go with it.
 */
function takeOver(b: ServerBoard, seat: number, player: { id: string; name: string }, t: number): void {
  resolveTo(b, t);
  settleStores(b, t);
  const gone = new Set(b.armies.filter((a) => a.owner === seat).map((a) => a.id));
  b.armies = b.armies.filter((a) => a.owner !== seat);
  for (const [key, h] of Object.entries(b.hexes)) {
    if (h.garrison !== null && gone.has(h.garrison)) h.garrison = null;
    if (h.owner !== seat) continue;
    if (!isHeld(h, t)) {
      delete b.hexes[Number(key)];
      continue;
    }
    h.owner = null;
    h.stored = 0;
    h.precious = 0;
    h.work = null;
  }
  for (const perSeat of [b.effects, b.effectSeq, b.ops, b.delves, b.beaten, b.campsBack, b.raids, b.botCamps, b.seenCamps, b.portal.floors]) {
    if (perSeat !== undefined) delete perSeat[seat];
  }
  b.seats[seat] = { playerId: player.id, name: player.name, bot: false, nextMoveAt: null, moves: 0 };
  recomputeChains(b, t);
}

// ------------------------------------------------------------------ views

export function snapshotOf(b: ServerBoard, seat: number, t: number): WorldSnapshot {
  const data = boardData(b);
  const hexes: HexView[] = Object.entries(b.hexes).map(([k, h]) => {
    const index = Number(k);
    const bh = data.hexes[index];
    const mineHex = h.owner === seat;
    const rate = districtRate(bh, boostOf(b, h.owner));
    const gems = preciousRate(data, index, boostOf(b, h.owner));
    return {
      index, owner: h.owner, held: isHeld(h, t), standsAt: h.standsAt,
      district: districtOf(bh) ?? 'Rural', fortress: h.fortress, work: h.work, active: h.active,
      chapel: hasChapel(b, index),
      relic: h.relic ? { id: h.relic, level: (h.owner === null ? undefined : b.seats[h.owner]?.relics?.[h.relic]) ?? 1 } : null,
      stores: mineHex && rate.currency !== null ? { currency: rate.currency, amount: storedAt(b, index, t), cap: rate.cap } : null,
      precious: mineHex && gems.id !== null ? { id: gems.id, amount: preciousAt(b, index, t), cap: gems.cap } : null,
      garrison: garrisonView(b, h),
      burnt: h.burnt === true,
      repairAt: h.repairAt ?? null,
      threat: mineHex && isHeld(h, t) ? threatView(b, seat, index, t) : null,
    };
  }).sort((x, y) => x.index - y.index);
  const armies: ArmyView[] = b.armies.map((a) => ({
    id: a.id, owner: a.owner, purpose: a.purpose, phase: a.phase, path: a.path,
    departedAt: a.departedAt, stepMs: a.stepMs, target: a.target, at: a.at,
    power: boardPower(a.board), heroes: a.owner === seat ? [...a.heroes] : null,
    ...(a.owner === seat ? {
      slots: a.board.slots.map((s) => ({
        kind: s.kind, unitId: s.unitId, fighterId: s.fighterId, name: s.name, count: s.count,
        hp: s.hpPool, hpMax: s.hpUnit * Math.max(1, s.count),
      })),
      fallen: a.fallen.map((f) => ({ ...f })),
    } : {}),
  }));
  return {
    board: { id: b.id, seed: b.seed, seat },
    at: t,
    seats: b.seats.map((s, i) => ({
      seat: i, name: s?.name ?? 'A free city', you: i === seat, bot: s?.bot ?? false, crest: s?.crest ?? null,
      townhall: s?.townhall ?? null, ...(s === null || s === undefined ? { free: true } : {}),
    })),
    hexes,
    armies,
    delves: { ...(b.delves[seat] ?? {}) },
    beaten: beatenNow(b, seat, t),
    seenCamps: [...(b.seenCamps?.[seat] ?? [])],
    dungeons: standingDungeons(b),
    // Every standing dungeon: its name, and the race — how far each player
    // has gone in it (19 §8.1).
    dungeonInfo: standingDungeons(b).map((index) => ({
      index, key: dungeonKey(b, index), ...dungeonInfo(b, index),
      race: Object.entries(b.delves)
        .map(([s, p]) => ({ seat: Number(s), cleared: p[index] ?? 0 }))
        .filter((r) => r.cleared > 0)
        .sort((x, y) => y.cleared - x.cleared || x.seat - y.seat),
    })),
    portal: portalView(b, seat, t),
    effects: [],
  };
}

function threatView(b: ServerBoard, seat: number, index: number, t: number): HexView['threat'] {
  const raid = raidOf(b, seat);
  return raid !== null && raid.target === index && raidStands(b, seat, raid, t)
    ? { camps: [raid.camp!], nextRaidAt: raid.at } : null;
}

function garrisonView(b: ServerBoard, h: ServerHex): HexView['garrison'] {
  if (h.garrison === null) return null;
  const g = b.armies.find((a) => a.id === h.garrison);
  return g === undefined ? null : { army: g.id, owner: g.owner, power: boardPower(g.board) };
}
