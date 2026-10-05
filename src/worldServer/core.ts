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

import {
  boardPower, buildBoard, generateEnemy, resolveBattle, survivorsOf,
  type BattleLog, type Board as FightBoard, type Side,
} from '../sim/battle';
import {
  LAIRS, WORLD, WORLD_BOTS, WORLD_BUILD, WORLD_CAMPS, WORLD_DUNGEON, WORLD_EXCHANGE, WORLD_PORTAL, WORLD_PRECIOUS,
} from '../sim/data/definitions';
import { rand, randInt } from '../sim/rng';
import { PRECIOUS, type HeroId, type LairId, type PreciousId, type UnitId } from '../sim/state';
import { SEAT_INDICES, lumpMaterial, materialAt, wedgeIndexOf, withDungeons, type Board, type BoardHex } from '../sim/world/board';
import { CAMP_CREATURE } from '../sim/world/camps';
import { PORTAL_INDEX, boardNeighbors, hexAt, hexDistance, isBoardIndex } from '../sim/world/hex';
import { fastestRoute, homeboundMs, outboundMs, stepTimes } from '../sim/world/travel';
import { boardOf } from '../sim/world/source';
import { WORLD_DISTRICTS, type WorldDistrict, type WorldUpgrade } from '../sim/world/types';
import type {
  ArmyPurpose, ArmyView, BoardRef, CollectResult, CommandResult, DelveResult, HexView, PortalView, Refusal, SeatBoost,
  SendResult, ServerArmy, ServerBoard, ServerHex, ServerWorld, WorldEffect, WorldSnapshot, WorldStoreCurrency,
  Lot, TradeResult,
} from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const emptyWorld = (): ServerWorld => ({ version: 3, boards: [] });

/** The board as generated from its seed: where the dungeons started. */
const generated = (b: ServerBoard): Board => boardOf({ id: b.id, seed: b.seed, seat: 0 });

/** The board as it stands: the generated one with the dungeons where they
 *  are now (19 §8.1). Every rule reads this one. */
const boardData = (b: ServerBoard): Board => withDungeons(generated(b), standingDungeons(b));

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

/** What a rich district yields an hour of its wedge's precious material and
 *  how much its precious store holds (19 §7.4); nothing on other ground. The
 *  inner ring and a seat's research move it as they move the district. */
export function preciousRate(
  board: Board, index: number, boost: SeatBoost = NO_BOOST,
): { id: PreciousId | null; perHour: number; cap: number } {
  const bh = board.hexes[index];
  const id = bh.rich && districtOf(bh) !== null ? materialAt(board, index) : null;
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
  Math.round(WORLD_BUILD.claim.gold * WORLD_BUILD.claim.goldGrowth ** held);

const isHeld = (h: ServerHex | undefined, t: number): h is ServerHex => h !== undefined && h.standsAt <= t;

export const hexesOf = (b: ServerBoard, seat: number): number => Object.values(b.hexes).filter((h) => h.owner === seat).length;

/** Whether `seat` may claim `index` now, and why not. */
export function claimRefusal(b: ServerBoard, seat: number, index: number, t: number): Refusal | null {
  if (!isBoardIndex(index)) return 'NoSuchHex';
  const bh = boardData(b).hexes[index];
  if (bh.role === 'portal' || bh.features.includes('Dungeon')) return 'NeverHeld';
  if (SEAT_INDICES.includes(index) || b.hexes[index] !== undefined) return 'Taken';
  if (!touches(b, seat, index, t)) return 'NotAdjacent';
  return guarded(b, seat, index) ? 'Guarded' : null;
}

// ------------------------------------------------------------- camps

/** The monster camp on a hex as the board was made (19 §5.4), or null. */
export const campAt = (b: ServerBoard, index: number) => boardData(b).hexes[index]?.camp ?? null;

/** Has `seat` beaten the camp on `index`? Each player beats a camp for
 *  themselves. */
export const hasBeaten = (b: ServerBoard, seat: number, index: number): boolean =>
  b.beaten?.[seat]?.includes(index) ?? false;

/** Does a camp still stand between `seat` and claiming `index`? Once anyone
 *  holds the hex, its camp no longer matters. */
const guarded = (b: ServerBoard, seat: number, index: number): boolean =>
  b.hexes[index] === undefined && campAt(b, index) !== null && !hasBeaten(b, seat, index);

function beat(b: ServerBoard, seat: number, index: number): void {
  const list = ((b.beaten ??= {})[seat] ??= []);
  if (!list.includes(index)) list.push(index);
}

/** The camp's army: its creature's lair is its formation's type, as a lair's
 *  garrison is (18 §2), rolled under the hex. */
function campBoard(b: ServerBoard, index: number): FightBoard {
  const camp = campAt(b, index)!;
  const plan = generateEnemy({
    seed: b.seed, parts: ['camp', index], budget: camp.power, affinity: LAIRS[camp.creature].guard.threat,
  });
  return buildBoard(plan.squads, plan.fighters);
}

/** Pay a camp off: the client paid its tribute; the camp is beaten for this
 *  seat, and pays nothing. */
export function tribute(b: ServerBoard, seat: number, index: number, t: number): CommandResult {
  resolveTo(b, t);
  if (!isBoardIndex(index)) return { ok: false, why: 'NoSuchHex' };
  if (b.hexes[index] !== undefined) return { ok: false, why: 'Taken' };
  if (!guarded(b, seat, index)) return { ok: false, why: 'NothingThere' };
  beat(b, seat, index);
  return { ok: true, finishesAt: t, snapshot: snapshotOf(b, seat, t) };
}

// ------------------------------------------------------------ camp raids

const RAID_MS = (): number => WORLD_CAMPS.raidHours * HOUR;

/** The next raid after `t`: raids land on the same UTC hours on every
 *  board, every `raidHours` (19 §5.5). */
export const nextRaidAt = (t: number): number => (Math.floor(t / RAID_MS()) + 1) * RAID_MS();

/** Whether `seat` can see the camp on `index` — standing, or lurking and
 *  reported seen by its client. */
const campSeen = (b: ServerBoard, seat: number, index: number): boolean => {
  const camp = campAt(b, index);
  return camp !== null && (!camp.lurking || (b.seenCamps?.[seat] ?? []).includes(index));
};

/** The camps that will raid `seat`'s district on `index`: beside it,
 *  unbeaten by `seat`, on ground nobody holds, and seen. */
export function raidersOf(b: ServerBoard, seat: number, index: number): number[] {
  return boardNeighbors(index).filter((c) => guarded(b, seat, c) && campSeen(b, seat, c));
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
  gold: Math.round(claimGold(Math.max(0, hexesOf(b, seat) - 1)) * WORLD_CAMPS.repairCostShare),
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

/** Every player's districts beside a camp they have seen are raided at `t`:
 *  a garrisoned Fortress fights the raiders; otherwise, or if it falls, the
 *  district burns and the raiders carry off `raidShare` of its stores. The
 *  stand-in rivals are never raided. */
function raidAll(b: ServerBoard, t: number): void {
  const keys = Object.keys(b.hexes).map(Number).sort((x, y) => x - y);
  for (const index of keys) {
    const h = b.hexes[index];
    if (h.owner === null || b.seats[h.owner]?.bot !== false) continue;
    if (!isHeld(h, t) || h.burnt) continue;
    const seat = h.owner;
    for (const c of raidersOf(b, seat, index)) {
      if (h.burnt) break;
      const camp = campAt(b, c)!;
      const who = `the camp of ${CAMP_CREATURE[camp.creature]}`;
      const name = WORLD_BUILD.districts[districtOf(boardData(b).hexes[index]) ?? 'Rural'].name;
      const g = h.garrison === null ? undefined : b.armies.find((a) => a.id === h.garrison);
      if (g !== undefined) {
        const log = resolveBattle(campBoard(b, c), g.board);
        const theirs = boardAfter(log, g.board, 'theirs');
        g.board = theirs.board;
        addFallen(g.fallen, theirs.fallen);
        const lost = theirs.fallen.reduce((n, f) => n + f.count, 0);
        if (log.winner === 'theirs') {
          report(b, seat, t, `Your Fortress garrison drove off ${who} at your ${name}${lost > 0 ? ` — ${lost} soldiers lost` : ''}`, true);
          continue;
        }
        h.garrison = null;
        report(b, seat, t, `Your Fortress garrison fell to ${who} at your ${name}`, false);
        sendHome(b, g, t);
      }
      const keep = 1 - WORLD_CAMPS.raidShare;
      const taken = Math.floor(h.stored * WORLD_CAMPS.raidShare);
      h.stored *= keep;
      if ((h.precious ?? 0) > 0) h.precious = (h.precious ?? 0) * keep;
      h.burnt = true;
      const currency = districtRate(boardData(b).hexes[index]).currency;
      report(b, seat, t, `${capitalise(who)} raided your ${name} — it burns${taken > 0 && currency !== null ? `, ${taken} ${currency} taken` : ''}`, false);
    }
  }
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

// ------------------------------------------------------------ the Exchange

/** A fair offer is one for one, of two different materials (19 §7.5). */
const isFair = (o: { give: Lot; want: Lot }): boolean => o.give.amount === o.want.amount && o.give.id !== o.want.id;

/** The stand-in rival that yields what an offer wants, if one sits at the
 *  board — it is who takes a fair offer. */
function botYielding(b: ServerBoard, id: PreciousId, not: number): number | null {
  const materials = boardData(b).materials;
  const seat = b.seats.findIndex((s, i) => s?.bot === true && i !== not && materials[i] === id);
  return seat < 0 ? null : seat;
}

const lotLine = (l: Lot): string => `${l.amount} ${l.id}`;

/** Put an offer up. The client has paid `give`; the server holds it. */
export function postOffer(b: ServerBoard, seat: number, give: Lot, want: Lot, t: number): TradeResult {
  resolveTo(b, t);
  const why = placeOffer(b, seat, give, want, t);
  return why !== null ? { ok: false, why } : { ok: true, received: null, snapshot: snapshotOf(b, seat, t) };
}

/** An offer onto the board at `t`, already resolved to — or why not. */
function placeOffer(b: ServerBoard, seat: number, give: Lot, want: Lot, t: number): Refusal | null {
  const whole = (l: Lot) => Number.isInteger(l.amount) && l.amount > 0 && (PRECIOUS as readonly string[]).includes(l.id);
  if (!whole(give) || !whole(want) || give.id === want.id) return 'BadOffer';
  const offers = (b.offers ??= []);
  if (offers.filter((o) => o.seat === seat).length >= WORLD_EXCHANGE.maxOffers) return 'TooManyOffers';
  const taker = isFair({ give, want }) ? botYielding(b, want.id, seat) : null;
  offers.push({
    id: `offer_${b.nextId++}`, seat, give: { ...give }, want: { ...want }, at: t,
    expiresAt: t + WORLD_EXCHANGE.offerHours * HOUR,
    takeAt: taker === null || b.seats[seat]?.bot ? null : t + WORLD_EXCHANGE.botTakeHours * HOUR,
  });
  return null;
}

/** Take someone's offer. The client has paid its `want`; it receives the
 *  `give` at once, and the offer's maker is owed the `want`. */
export function takeOffer(b: ServerBoard, seat: number, offerId: string, t: number): TradeResult {
  resolveTo(b, t);
  const o = b.offers?.find((x) => x.id === offerId);
  if (o === undefined) return { ok: false, why: 'NoSuchOffer' };
  if (o.seat === seat) return { ok: false, why: 'OwnOffer' };
  b.offers = b.offers!.filter((x) => x !== o);
  const name = b.seats[seat]?.name ?? 'Someone';
  owe(b, o.seat, { kind: 'goods', at: t, lot: { ...o.want }, text: `${name} took your offer — ${lotLine(o.want)} for ${lotLine(o.give)}` });
  return { ok: true, received: { ...o.give }, snapshot: snapshotOf(b, seat, t) };
}

/** Take back one's own offer: what it held comes back at once. */
export function withdrawOffer(b: ServerBoard, seat: number, offerId: string, t: number): TradeResult {
  resolveTo(b, t);
  const o = b.offers?.find((x) => x.id === offerId);
  if (o === undefined) return { ok: false, why: 'NoSuchOffer' };
  if (o.seat !== seat) return { ok: false, why: 'NotYours' };
  b.offers = b.offers!.filter((x) => x !== o);
  return { ok: true, received: { ...o.give }, snapshot: snapshotOf(b, seat, t) };
}

/** Offers due at `t`: a rival takes a fair one, or one comes back. */
function settleOffers(b: ServerBoard, t: number): void {
  if (b.offers === undefined) return;
  const due = b.offers.filter((o) => (o.takeAt !== null && o.takeAt <= t) || o.expiresAt <= t);
  for (const o of due) {
    b.offers = b.offers.filter((x) => x !== o);
    if (o.takeAt !== null && o.takeAt <= t && o.takeAt < o.expiresAt) {
      const by = botYielding(b, o.want.id, o.seat);
      const name = by === null ? 'A rival' : b.seats[by]?.name ?? 'A rival';
      owe(b, o.seat, { kind: 'goods', at: t, lot: { ...o.want }, text: `${name} took your offer — ${lotLine(o.want)} for ${lotLine(o.give)}` });
    } else if (!b.seats[o.seat]?.bot) {
      owe(b, o.seat, { kind: 'goods', at: t, lot: { ...o.give }, text: `Nobody took your offer — ${lotLine(o.give)} came back` });
    }
  }
}

/** A stand-in rival keeps one offer up: its own material, one for one, for
 *  one of the other two. */
function botOffer(b: ServerBoard, seat: number, t: number): void {
  if ((b.offers ?? []).some((o) => o.seat === seat)) return;
  const own = boardData(b).materials[seat];
  if (own === undefined) return;
  const others = PRECIOUS.filter((p) => p !== own);
  const want = others[randInt(b.seed, others.length, 'botOffer', seat, b.nextId)];
  const n = WORLD_EXCHANGE.botOfferAmount;
  placeOffer(b, seat, { id: own, amount: n }, { id: want, amount: n }, t);
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
  return h.fortress >= WORLD_BUILD.upgrades[upgrade].levels.length ? 'MaxLevel' : null;
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
  for (const o of b.offers ?? []) {
    consider(o.expiresAt);
    consider(o.takeAt);
  }
  for (const h of Object.values(b.hexes)) consider(h.repairAt ?? null);
  // A raid lands only if some player has a district a camp can reach.
  if (b.seats.some((s) => s?.bot === false)) consider(nextRaidAt(after));
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
      h.fortress = h.work.toLevel;
      h.work = null;
    }
  }
  recomputeChains(b, t);
  closePortal(b, t);
  settleOffers(b, t);
  finishRepairs(b, t);
  if (t % RAID_MS() === 0) raidAll(b, t);
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
  if (t <= b.resolvedTo) return;
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
  const toLevel = h.fortress + 1;
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
    h.fortress = h.work.toLevel;
    h.work = null;
  } else if (repairing) {
    h.burnt = false;
    h.repairAt = null;
  }
  recomputeChains(b, t);
  return { ok: true, finishesAt: t, snapshot: snapshotOf(b, seat, t) };
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

/** Owed to a seat: delivered with its next snapshot. */
function owe(b: ServerBoard, seat: number, effect: WorldEffect): void {
  (b.effects[seat] ??= []).push(effect);
}

const report = (b: ServerBoard, seat: number, t: number, text: string, good: boolean): void =>
  owe(b, seat, { kind: 'report', at: t, text, good });

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
  const taken = new Map<number, number>();
  for (const e of log.events) if (e.kind === 'attack' && e.to.side === side) taken.set(e.to.id, (taken.get(e.to.id) ?? 0) + e.dealt);
  const fallen: Array<{ unitId: UnitId; count: number }> = [];
  const slots = board.slots.map((s) => {
    if (s.kind === 'hero') return { ...s, hpPool: Math.max(0, s.hpPool - (taken.get(s.id) ?? 0)) };
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
    if (a.target === PORTAL_INDEX && portalOpen(t)) {
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
    // A camp is fought on arrival, as an attack is; won, it is beaten for
    // this seat and pays its loot (19 §5.4).
    const camp = campAt(b, a.target);
    if (camp !== null && guarded(b, a.owner, a.target)) {
      const log = resolveBattle(a.board, campBoard(b, a.target));
      const after = boardAfter(log, a.board, 'ours');
      a.board = after.board;
      addFallen(a.fallen, after.fallen);
      const name = CAMP_CREATURE[camp.creature];
      if (log.winner === 'ours') {
        beat(b, a.owner, a.target);
        owe(b, a.owner, {
          kind: 'loot', at: t, knowledge: 0, stardust: 0,
          gold: Math.round(camp.power * WORLD_CAMPS.goldPerPower),
          heroXp: Math.round(camp.power * WORLD_CAMPS.heroXpPerPower),
          precious: {
            id: lumpMaterial(boardData(b), a.owner, 'camp', a.target, a.owner),
            amount: Math.max(1, Math.round(camp.power * WORLD_PRECIOUS.campPerPower)),
          },
        });
        report(b, a.owner, t, `Your army beat the camp of ${name}`, true);
      } else {
        report(b, a.owner, t, `Your army was beaten back by the camp of ${name}`, false);
      }
    } else report(b, a.owner, t, 'Your army found no camp there and turned back', false);
    turnHome(a, t);
    return;
  }
  if (a.purpose === 'claim') {
    if (h !== undefined && h.owner === null && touches(b, a.owner, a.target, t)) {
      h.owner = a.owner;
      recomputeChains(b, t);
      report(b, a.owner, t, 'Your army took ground nobody held', true);
    } else report(b, a.owner, t, 'Your army found nothing to claim and turned back', false);
    turnHome(a, t);
    return;
  }
  // An attack (19 §6): every covering garrison in turn, then the hex.
  if (h === undefined || h.owner === null || h.owner === a.owner) {
    report(b, a.owner, t, 'Your army found nobody to fight and turned back', false);
    turnHome(a, t);
    return;
  }
  const holder = h.owner;
  for (const g of coveringGarrisons(b, a.target, holder)) {
    const log = resolveBattle(a.board, g.board);
    const ours = boardAfter(log, a.board, 'ours');
    const theirs = boardAfter(log, g.board, 'theirs');
    a.board = ours.board;
    addFallen(a.fallen, ours.fallen);
    g.board = theirs.board;
    addFallen(g.fallen, theirs.fallen);
    if (log.winner === 'theirs') {
      report(b, a.owner, t, `Your army was beaten back by ${seatName(b, holder)}'s Fortress`, false);
      report(b, holder, t, `Your Fortress held against ${seatName(b, a.owner)}`, true);
      turnHome(a, t);
      return;
    }
    b.hexes[g.target].garrison = null;
    report(b, holder, t, `Your Fortress garrison fell to ${seatName(b, a.owner)}`, false);
    sendHome(b, g, t);
  }
  // Nobody left standing in the way: taken beside the attacker's ground,
  // denied anywhere else.
  if (touches(b, a.owner, a.target, t)) {
    h.owner = a.owner;
    report(b, a.owner, t, `Your army took ground from ${seatName(b, holder)}`, true);
    report(b, holder, t, `${seatName(b, a.owner)} took your ground`, false);
  } else {
    h.owner = null;
    h.stored = 0;
    h.work = null;
    report(b, a.owner, t, `Your army denied ${seatName(b, holder)} their ground`, true);
    report(b, holder, t, `${seatName(b, a.owner)} drove you off your ground`, false);
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
    if (index !== PORTAL_INDEX) return 'NothingThere';
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
    if (!guarded(b, seat, index)) return 'NothingThere';
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

/** Call an army home: out of its Fortress, or turned round on the road. */
export function recall(b: ServerBoard, seat: number, armyId: string, t: number): CommandResult {
  resolveTo(b, t);
  const a = b.armies.find((x) => x.id === armyId);
  if (a === undefined || a.owner !== seat) return { ok: false, why: 'NoArmy' };
  if (a.phase === 'home') return { ok: false, why: 'Busy' };
  if (a.phase === 'garrison' || a.phase === 'camp') {
    if (b.hexes[a.target]?.garrison === a.id) b.hexes[a.target].garrison = null;
    turnHome(a, t);
  } else {
    turnHome(a, t, t - a.departedAt);
  }
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
    kind: 'loot', at: t,
    gold: Math.round(last.gold * k), knowledge: Math.round(last.knowledge * k),
    heroXp: Math.round(last.heroXp * k), stardust: Math.round(last.stardust * k),
    precious: { id: lumpMaterial(boardData(b), closer, 'close', dungeonKey(b, index)), amount: Math.round(last.precious * k) },
  });
  report(b, closer, t, 'You cleared the dungeon to the bottom — it is closed', true);
  for (const a of b.armies) {
    if (a.purpose !== 'delve' || a.target !== index || a.phase === 'home') continue;
    if (a.owner !== closer) report(b, a.owner, t, `${seatName(b, closer)} cleared the dungeon first — it is closed`, false);
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
    const ring = hexDistance(h.hex, hexAt(PORTAL_INDEX));
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

/** What a room pays (11-expeditions.md §7.1); a boss, a multiple of it. */
export function roomReward(
  depth: number, room: number,
): { gold: number; knowledge: number; heroXp: number; stardust: number; precious: number } {
  const d = WORLD_DUNGEON;
  const boss = room === d.roomsPerDepth ? d.bossRewardMultiplier : 1;
  const scale = d.rewardBase[depth] * d.rewardGrowth ** (room - 1) * boss;
  return {
    gold: Math.round(d.gold * scale),
    knowledge: Math.max(1, Math.round(d.knowledge * scale)),
    heroXp: Math.round(d.heroXp * scale),
    stardust: Math.round(d.stardust * scale),
    precious: Math.max(1, Math.round(d.precious * scale)),
  };
}

/** A dungeon as a player reads it: its name, the creature that holds it,
 *  who waits at the bottom of each depth — all rolled with the dungeon, so
 *  one that comes back is a new one (19 §8.1). */
export function dungeonInfo(b: ServerBoard, index: number): { name: string; creature: LairId; bosses: string[] } {
  const d = WORLD_DUNGEON;
  const key = dungeonKey(b, index);
  const word = (list: readonly string[], part: string) => list[randInt(b.seed, list.length, 'dungeonName', key, part)];
  // Each sixth keeps its own first word — a board-wide offset plus the
  // sixth — so two standing at once never share a name; one that comes back
  // is told apart by its second.
  const wedge = dungeonAt(b, index)?.wedge ?? 0;
  const first = d.nameFirst[(randInt(b.seed, d.nameFirst.length, 'dungeonFirst') + wedge) % d.nameFirst.length];
  const unit = dungeonAffinity(b, index);
  const creature = (Object.keys(LAIRS) as LairId[]).find((l) => LAIRS[l].guard.threat === unit) ?? 'Orcs';
  return {
    name: `The ${first} ${word(d.nameSecond, 'second')}`,
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
  });
  const log = resolveBattle(a.board, buildBoard(plan.squads, plan.fighters));
  const after = boardAfter(log, a.board, 'ours');
  a.board = after.board;
  addFallen(a.fallen, after.fallen);
  const lost = after.fallen.reduce((n, f) => n + f.count, 0);
  const won = log.winner === 'ours';
  if (won) {
    progress[a.target] = cleared + 1;
    const { precious, ...pay } = roomReward(next.depth, next.room);
    owe(b, seat, {
      kind: 'loot', at: t, ...pay,
      precious: { id: lumpMaterial(boardData(b), seat, 'room', dungeonKey(b, a.target), next.depth, next.room), amount: precious },
    });
  }
  // The last boss down: the dungeon closes for everyone, this army too.
  if (won && nextRoom(cleared + 1) === null) closeDungeon(b, a.target, seat, t);
  // Nothing left to fight with: what is left walks home.
  else if (!a.board.slots.some((s) => s.kind === 'hero')) turnHome(a, t);
  return { ok: true, won, log, ...next, lost, snapshot: snapshotOf(b, seat, t) };
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
  event: portalEvent(t), floors: {}, attempts: {}, milestones: {}, closed: portalEvent(t) - 1,
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
    rankingOf(b.portal).forEach((r, place) => {
      const gems = WORLD_PORTAL.rankGems[place] ?? 0;
      if (gems > 0) owe(b, r.seat, { kind: 'loot', at: t, gold: 0, knowledge: 0, heroXp: 0, stardust: 0, gems });
      report(b, r.seat, t, `The Portal closed — you placed ${place + 1} of ${rankingOf(b.portal).length}, at floor ${r.floor}`, place < 3);
    });
  }
  b.portal.closed = justClosed;
  for (const a of b.armies) if (a.purpose === 'portal' && a.phase === 'camp') turnHome(a, t, 0);
}

/** What a floor fields. */
export const floorPower = (floor: number): number =>
  Math.round(WORLD_PORTAL.powerStart * WORLD_PORTAL.powerGrowth ** (floor - 1));

/** What a floor pays: the dungeon room formula on the Portal's own scale,
 *  and a pack on the floors that carry one. */
export function floorReward(floor: number): { gold: number; knowledge: number; heroXp: number; stardust: number; pack?: 'Rose' | 'Golden' } {
  const scale = WORLD_PORTAL.rewardBase * WORLD_PORTAL.rewardGrowth ** (floor - 1);
  const d = WORLD_DUNGEON;
  const pack = floor % WORLD_PORTAL.goldenEvery === 0 ? 'Golden' : floor % WORLD_PORTAL.roseEvery === 0 ? 'Rose' : undefined;
  return {
    gold: Math.round(d.gold * scale), knowledge: Math.max(1, Math.round(d.knowledge * scale)),
    heroXp: Math.round(d.heroXp * scale), stardust: Math.round(d.stardust * scale),
    ...(pack ? { pack } : {}),
  };
}

const attemptsUsed = (p: ServerBoard['portal'], seat: number, t: number): number =>
  p.attempts[seat]?.day === dayOf(t) ? p.attempts[seat].used : 0;

/** Go down the next floor with the army in the Portal. Floors are taken one
 *  at a time; a clear spends an attempt, a failure spends nothing. */
export function descendPortal(b: ServerBoard, seat: number, armyId: string, t: number): DelveResult {
  resolveTo(b, t);
  const a = b.armies.find((x) => x.id === armyId);
  if (a === undefined || a.owner !== seat || a.phase !== 'camp' || a.purpose !== 'portal') return { ok: false, why: 'NoArmy' };
  if (!portalOpen(t)) return { ok: false, why: 'Shut' };
  const p = portalOf(b, t);
  if (attemptsUsed(p, seat, t) >= WORLD_PORTAL.attemptsPerDay) return { ok: false, why: 'NoAttempts' };
  const floor = (p.floors[seat]?.floor ?? 0) + 1;
  if (floor > WORLD_PORTAL.floors) return { ok: false, why: 'NothingThere' };
  const plan = generateEnemy({ seed: b.seed, parts: ['portal', p.event, floor], budget: floorPower(floor), affinity: 'Any' });
  const log = resolveBattle(a.board, buildBoard(plan.squads, plan.fighters));
  const after = boardAfter(log, a.board, 'ours');
  a.board = after.board;
  addFallen(a.fallen, after.fallen);
  const won = log.winner === 'ours';
  if (won) {
    p.floors[seat] = { floor, at: t };
    p.attempts[seat] = { day: dayOf(t), used: attemptsUsed(p, seat, t) + 1 };
    let gems = 0;
    if (floor % WORLD_PORTAL.milestoneEvery === 0 && p.milestones[floor] === undefined) {
      p.milestones[floor] = seat;
      gems = WORLD_PORTAL.milestoneGems;
      report(b, seat, t, `First to floor ${floor} of the Portal`, true);
    }
    owe(b, seat, { kind: 'loot', at: t, ...floorReward(floor), ...(gems > 0 ? { gems } : {}) });
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
    attemptsLeft: Math.max(0, WORLD_PORTAL.attemptsPerDay - (p === null ? 0 : attemptsUsed(p, seat, t))),
    ranking: p === null ? [] : rankingOf(p),
  };
}

/** What the server owes a seat, handed over once. */
export function drainEffects(b: ServerBoard, seat: number): WorldEffect[] {
  const out = b.effects[seat] ?? [];
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
  botOffer(b, seat, t);
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
  if (!done && (s.claims ?? 0) < WORLD_BOTS.maxHexes) {
    // A rival beats a camp in its way after a while, by the camp's power,
    // without a fight being played out (19 §5.4).
    const pending = ((b.botCamps ??= {})[seat] ??= {});
    for (let i = 0; i < data.hexes.length; i++) {
      if (claimRefusal(b, seat, i, t) !== 'Guarded') continue;
      pending[i] ??= t + Math.round((campAt(b, i)!.power / 1000) * WORLD_CAMPS.botHoursPer1000Power * HOUR);
      if (pending[i] <= t) beat(b, seat, i);
    }
    const open: number[] = [];
    for (let i = 0; i < data.hexes.length; i++) if (claimRefusal(b, seat, i, t) === null) open.push(i);
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
export function join(
  w: ServerWorld, player: { id: string; name: string; prefer?: BoardRef }, t: number,
): { board: ServerBoard; seat: number } {
  for (const b of w.boards) {
    const seat = b.seats.findIndex((s) => s?.playerId === player.id);
    if (seat >= 0) return { board: b, seat };
  }
  for (const b of w.boards) {
    const seat = b.seats.findIndex((s) => s === null);
    if (seat >= 0) {
      b.seats[seat] = { playerId: player.id, name: player.name, bot: false, nextMoveAt: null, moves: 0 };
      return { board: b, seat };
    }
  }
  const seed = player.prefer?.seed ?? randInt(t >>> 0, 0x1_0000_0000, 'board', player.id);
  const seat = player.prefer?.seat ?? randInt(seed, 6, 'seat', player.id);
  let rival = 0;
  const b: ServerBoard = {
    id: player.prefer?.id ?? `local-${seed.toString(36)}`,
    seed,
    seats: Array.from({ length: 6 }, (_, i) => i === seat
      ? { playerId: player.id, name: player.name, bot: false, nextMoveAt: null, moves: 0 }
      : {
        playerId: `bot-${i}`, name: WORLD.rivals[rival++ % WORLD.rivals.length] ?? `Rival ${i + 1}`, bot: true,
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
  w.boards.push(b);
  return { board: b, seat };
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
    seats: b.seats.map((s, i) => ({ seat: i, name: s?.name ?? 'A free city', you: i === seat, bot: s?.bot ?? false })),
    hexes,
    armies,
    delves: { ...(b.delves[seat] ?? {}) },
    beaten: [...(b.beaten?.[seat] ?? [])],
    seenCamps: [...(b.seenCamps?.[seat] ?? [])],
    offers: (b.offers ?? []).map((o) => ({
      id: o.id, seat: o.seat, mine: o.seat === seat, give: { ...o.give }, want: { ...o.want }, expiresAt: o.expiresAt,
    })),
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
  const camps = raidersOf(b, seat, index);
  return camps.length === 0 ? null : { camps, nextRaidAt: nextRaidAt(t) };
}

function garrisonView(b: ServerBoard, h: ServerHex): HexView['garrison'] {
  if (h.garrison === null) return null;
  const g = b.armies.find((a) => a.id === h.garrison);
  return g === undefined ? null : { army: g.id, owner: g.owner, power: boardPower(g.board) };
}
