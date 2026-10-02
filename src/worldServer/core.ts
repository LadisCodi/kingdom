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
import { WORLD, WORLD_BOTS, WORLD_BUILD, type WorldImprovementDef } from '../sim/data/definitions';
import { rand, randInt } from '../sim/rng';
import type { HeroId, UnitId } from '../sim/state';
import { SEAT_INDICES, type Board, type BoardHex } from '../sim/world/board';
import { boardNeighbors, hexAt, hexIndex, hexLine, isBoardIndex } from '../sim/world/hex';
import { boardOf } from '../sim/world/source';
import { WORLD_IMPROVEMENTS, type WorldImprovement } from '../sim/world/types';
import type {
  ArmyPurpose, ArmyView, BoardRef, CollectResult, CommandResult, HexView, Refusal, SendResult,
  ServerArmy, ServerBoard, ServerHex, ServerWorld, WorldEffect, WorldSnapshot,
} from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const emptyWorld = (): ServerWorld => ({ version: 1, boards: [] });

const boardData = (b: ServerBoard): Board => boardOf({ id: b.id, seed: b.seed, seat: 0 });

// ------------------------------------------------------------ what a hex is

/** Whether an improvement may stand on this ground. */
export function fits(bh: BoardHex, def: WorldImprovementDef): boolean {
  switch (def.needs) {
    case 'Forest': return bh.features.includes('Forest');
    case 'Mountain': return bh.terrain === 'Mountain';
    case 'Open': return bh.terrain !== 'Mountain'
      && !bh.features.some((f) => f === 'Forest' || f === 'Dungeon' || f === 'Sanctuary' || f === 'Landmark');
    case 'Any': return true;
  }
}

/** The improvements a hex could take, in the data's order. */
export const fittingImprovements = (bh: BoardHex): WorldImprovement[] =>
  WORLD_IMPROVEMENTS.filter((id) => fits(bh, WORLD_BUILD.improvements[id]));

/** What one level makes an hour on this hex, and how much its store holds:
 *  the inner ring multiplies both, so its store lasts the same hours. */
export function improvementRate(bh: BoardHex, kind: WorldImprovement, level: number): { perHour: number; cap: number } {
  const def = WORLD_BUILD.improvements[kind];
  const l = def.levels[Math.min(level, def.levels.length) - 1];
  if (def.produces === '' || l === undefined) return { perHour: 0, cap: 0 };
  let mult = bh.role === 'inner' ? WORLD_BUILD.innerRingMultiplier : 1;
  if (kind === 'Homestead') {
    const extras = bh.features.filter((f) => f === 'FertileLand' || f === 'Game').length;
    mult *= 1 + WORLD_BUILD.featureFoodBonus * extras;
  }
  return { perHour: l.perHour * mult, cap: l.store * mult };
}

/** What the next Outpost costs a seat that already holds or claims `held`
 *  hexes beyond its city. */
export const outpostGold = (held: number): number =>
  Math.round(WORLD_BUILD.outpost.gold * WORLD_BUILD.outpost.goldGrowth ** held);

const isHeld = (h: ServerHex | undefined, t: number): h is ServerHex => h !== undefined && h.outpostAt <= t;

export const hexesOf = (b: ServerBoard, seat: number): number => Object.values(b.hexes).filter((h) => h.owner === seat).length;

/** Whether `seat` may claim `index` now, and why not. */
export function claimRefusal(b: ServerBoard, seat: number, index: number, t: number): Refusal | null {
  if (!isBoardIndex(index)) return 'NoSuchHex';
  const bh = boardData(b).hexes[index];
  if (bh.role === 'portal' || bh.features.includes('Dungeon')) return 'NeverHeld';
  if (SEAT_INDICES.includes(index) || b.hexes[index] !== undefined) return 'Taken';
  return touches(b, seat, index, t) ? null : 'NotAdjacent';
}

/** Whether a hex lies beside `seat`'s city or its held, active ground. */
function touches(b: ServerBoard, seat: number, index: number, t: number): boolean {
  return boardNeighbors(index).some((n) =>
    n === SEAT_INDICES[seat] || (b.hexes[n]?.owner === seat && b.hexes[n].active && isHeld(b.hexes[n], t)));
}

/** Whether `seat` may build or raise `kind` on `index` now, and why not. */
export function buildRefusal(b: ServerBoard, seat: number, index: number, kind: WorldImprovement, t: number): Refusal | null {
  if (!isBoardIndex(index)) return 'NoSuchHex';
  const h = b.hexes[index];
  if (h === undefined || h.owner !== seat) return 'NotYours';
  if (!isHeld(h, t)) return 'NotStanding';
  if (h.work !== null) return 'Busy';
  if (!h.active) return 'Inactive';
  const def = WORLD_BUILD.improvements[kind];
  if (h.improvement !== null) {
    if (h.improvement.kind !== kind) return 'WrongGround';
    if (h.improvement.level >= def.levels.length) return 'MaxLevel';
    return null;
  }
  return fits(boardData(b).hexes[index], def) ? null : 'WrongGround';
}

// ------------------------------------------------------------- resolving

/** What a hex's stores hold at `t`: its anchor, plus its rate since. */
export function storesAt(b: ServerBoard, index: number, t: number): { material: number; knowledge: number } {
  const h = b.hexes[index];
  if (h === undefined) return { material: 0, knowledge: 0 };
  const dt = t - h.storeAt;
  if (dt <= 0 || !h.active || !isHeld(h, h.storeAt)) return { material: h.material, knowledge: h.knowledge };
  const bh = boardData(b).hexes[index];
  let material = h.material;
  if (h.improvement !== null) {
    const { perHour, cap } = improvementRate(bh, h.improvement.kind, h.improvement.level);
    material = Math.min(cap, h.material + (perHour * dt) / HOUR);
  }
  const knowledge = bh.features.includes('Landmark')
    ? Math.min(WORLD_BUILD.landmark.store, h.knowledge + (WORLD_BUILD.landmark.knowledgePerDay * dt) / DAY)
    : h.knowledge;
  return { material, knowledge };
}

/** Move one hex's anchor to `t`. */
function settleHex(b: ServerBoard, index: number, t: number): void {
  const h = b.hexes[index];
  if (h === undefined || t <= h.storeAt) return;
  const now = storesAt(b, index, t);
  h.material = now.material;
  h.knowledge = now.knowledge;
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
    consider(h.outpostAt);
    consider(h.work?.at ?? null);
  }
  for (const s of b.seats) consider(s?.bot ? s.nextMoveAt : null);
  for (const a of b.armies) consider(a.at);
  return next;
}

function applyDue(b: ServerBoard, t: number): void {
  // Levels finishing, in board order.
  const keys = Object.keys(b.hexes).map(Number).sort((x, y) => x - y);
  for (const k of keys) {
    const h = b.hexes[k];
    if (h.work !== null && h.work.at <= t) {
      h.improvement = { kind: h.work.kind, level: h.work.toLevel };
      h.work = null;
    }
  }
  recomputeChains(b, t);
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
  const at = t + WORLD_BUILD.outpost.buildSeconds * 1000;
  b.hexes[index] = {
    owner: seat, outpostAt: at, improvement: null, work: null, active: false,
    material: 0, knowledge: 0, storeAt: t, garrison: null,
  };
  return at;
}

function startWork(b: ServerBoard, index: number, kind: WorldImprovement, t: number): number {
  const h = b.hexes[index];
  const toLevel = (h.improvement?.level ?? 0) + 1;
  const at = t + WORLD_BUILD.improvements[kind].levels[toLevel - 1].buildSeconds * 1000;
  h.work = { kind, toLevel, at };
  return at;
}

export function claim(b: ServerBoard, seat: number, index: number, t: number): CommandResult {
  resolveTo(b, t);
  const why = claimRefusal(b, seat, index, t);
  if (why !== null) return { ok: false, why };
  const finishesAt = startClaim(b, seat, index, t);
  return { ok: true, finishesAt, snapshot: snapshotOf(b, seat, t) };
}

export function build(b: ServerBoard, seat: number, index: number, kind: WorldImprovement, t: number): CommandResult {
  resolveTo(b, t);
  const why = buildRefusal(b, seat, index, kind, t);
  if (why !== null) return { ok: false, why };
  const finishesAt = startWork(b, index, kind, t);
  return { ok: true, finishesAt, snapshot: snapshotOf(b, seat, t) };
}

export function collect(b: ServerBoard, seat: number, index: number, t: number): CollectResult {
  resolveTo(b, t);
  const h = b.hexes[index];
  if (h === undefined || h.owner !== seat) return { ok: false, why: 'NotYours' };
  settleHex(b, index, t);
  const whole = Math.floor(h.material);
  const knowledge = Math.floor(h.knowledge);
  h.material -= whole;
  h.knowledge -= knowledge;
  const produces = h.improvement === null ? '' : WORLD_BUILD.improvements[h.improvement.kind].produces;
  return {
    ok: true,
    material: produces === '' || whole === 0 ? null : { currency: produces, amount: whole },
    knowledge,
    snapshot: snapshotOf(b, seat, t),
  };
}

// ---------------------------------------------------------------- armies

const stepsOf = (a: ServerArmy): number => a.path.length - 1;

/** Owed to a seat: delivered with its next snapshot. */
function owe(b: ServerBoard, seat: number, effect: WorldEffect): void {
  (b.effects[seat] ??= []).push(effect);
}

const report = (b: ServerBoard, seat: number, t: number, text: string, good: boolean): void =>
  owe(b, seat, { kind: 'report', at: t, text, good });

const seatName = (b: ServerBoard, seat: number | null): string =>
  seat === null ? 'nobody' : b.seats[seat]?.name ?? 'a rival';

/** Walk home from wherever it stands, by the way it came. */
function turnHome(a: ServerArmy, t: number, walked = stepsOf(a) * a.msPerHex): void {
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
  if (a.purpose === 'garrison') {
    if (h !== undefined && h.owner === a.owner && isHeld(h, t) && h.improvement?.kind === 'Fortress' && h.garrison === null) {
      a.phase = 'garrison';
      a.at = null;
      h.garrison = a.id;
    } else turnHome(a, t);
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
    h.material = 0;
    h.knowledge = 0;
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
  if (purpose === 'garrison') {
    if (h === undefined || h.owner !== seat) return 'NotYours';
    if (!isHeld(h, t) || h.improvement?.kind !== 'Fortress') return 'NotAFortress';
    const heading = b.armies.some((a) => a.owner === seat && a.target === index && a.purpose === 'garrison' && a.phase !== 'home');
    return h.garrison !== null || heading ? 'Garrisoned' : null;
  }
  if (purpose === 'claim') return h !== undefined && h.owner === null ? null : 'NothingThere';
  if (h === undefined || h.owner === null) return 'NothingThere';
  return h.owner === seat ? 'OwnGround' : null;
}

/** Set an army out from `seat`'s city. The client built its board and took
 *  its troops off the roster; the server trusts what it was sent. */
export function sendArmy(
  b: ServerBoard, seat: number,
  req: { purpose: ArmyPurpose; target: number; heroes: HeroId[]; board: FightBoard; msPerHex: number },
  t: number,
): SendResult {
  resolveTo(b, t);
  const why = sendRefusal(b, seat, req.purpose, req.target, t);
  if (why !== null) return { ok: false, why };
  const a = launch(b, seat, req, t);
  return { ok: true, army: a.id, arrivesAt: a.at!, snapshot: snapshotOf(b, seat, t) };
}

/** Put an army on the road — inside the resolve loop as well as from it. */
function launch(
  b: ServerBoard, seat: number,
  req: { purpose: ArmyPurpose; target: number; heroes: HeroId[]; board: FightBoard; msPerHex: number },
  t: number,
): ServerArmy {
  const path = hexLine(hexAt(SEAT_INDICES[seat]), hexAt(req.target)).map(hexIndex);
  const a: ServerArmy = {
    id: `army_${b.nextId++}`, owner: seat, heroes: [...req.heroes], board: req.board, path,
    departedAt: t, msPerHex: Math.max(1, Math.round(req.msPerHex)), purpose: req.purpose,
    phase: 'out', target: req.target, at: t + (path.length - 1) * Math.max(1, Math.round(req.msPerHex)), fallen: [],
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
  if (a.phase === 'garrison') {
    if (b.hexes[a.target]?.garrison === a.id) b.hexes[a.target].garrison = null;
    turnHome(a, t);
  } else {
    turnHome(a, t, t - a.departedAt);
  }
  return { ok: true, finishesAt: a.at!, snapshot: snapshotOf(b, seat, t) };
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
 *  neighbour, claim ground while it is under its size, then build on what it
 *  holds, then raise what it built. It pays nothing. */
function botMove(b: ServerBoard, seat: number, t: number): void {
  const s = b.seats[seat]!;
  const roll = (what: string, max: number) => randInt(b.seed, max, 'bot', seat, s.moves, what);
  const data = boardData(b);
  const mine = Object.entries(b.hexes).map(([k, h]) => [Number(k), h] as const).filter(([, h]) => h.owner === seat);
  let done = false;
  // An empty Fortress is manned at once, from the city.
  const empty = mine.find(([, h]) => h.improvement?.kind === 'Fortress' && isHeld(h, t) && h.garrison === null);
  if (empty !== undefined) {
    const [i, h] = empty;
    const g: ServerArmy = {
      id: `army_${b.nextId++}`, owner: seat, heroes: [], board: botBoard(b, seat, s.moves, WORLD_BOTS.garrisonPower),
      path: hexLine(hexAt(SEAT_INDICES[seat]), hexAt(i)).map(hexIndex), departedAt: t, msPerHex: 1,
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
    if (prey.length > 0) {
      launch(b, seat, {
        purpose: 'attack', target: prey[roll('prey', prey.length)], heroes: [],
        board: botBoard(b, seat, s.moves, WORLD_BOTS.armyPower), msPerHex: WORLD.marchSecondsPerHex * 1000,
      }, t);
      done = true;
    }
  }
  if (!done && (s.claims ?? 0) < WORLD_BOTS.maxHexes) {
    const open: number[] = [];
    for (let i = 0; i < data.hexes.length; i++) if (claimRefusal(b, seat, i, t) === null) open.push(i);
    if (open.length > 0) {
      startClaim(b, seat, open[roll('claim', open.length)], t);
      s.claims = (s.claims ?? 0) + 1;
      done = true;
    }
  }
  if (!done) {
    // Something that makes a living where it fits; one Fortress, on ground
    // nothing else would stand on.
    const hasFort = mine.some(([, h]) => h.improvement?.kind === 'Fortress' || h.work?.kind === 'Fortress');
    const bare = mine.filter(([i, h]) => h.improvement === null && h.work === null && h.active && isHeld(h, t)
      && (!hasFort || fittingImprovements(data.hexes[i]).some((k) => k !== 'Fortress')));
    if (bare.length > 0) {
      const [i] = bare[roll('build', bare.length)];
      startWork(b, i, fittingImprovements(data.hexes[i]).find((k) => k !== 'Fortress') ?? 'Fortress', t);
      done = true;
    }
  }
  if (!done) {
    const raisable = mine.filter(([i, h]) => h.improvement !== null && h.work === null && h.active
      && buildRefusal(b, seat, i, h.improvement.kind, t) === null);
    if (raisable.length > 0) {
      const [i, h] = raisable[roll('raise', raisable.length)];
      startWork(b, i, h.improvement!.kind, t);
    }
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
    const rate = h.improvement === null ? { cap: 0 } : improvementRate(bh, h.improvement.kind, h.improvement.level);
    const now = storesAt(b, index, t);
    return {
      index, owner: h.owner, held: isHeld(h, t), outpostAt: h.outpostAt,
      improvement: h.improvement, work: h.work, active: h.active,
      stores: mineHex ? {
        material: now.material, materialCap: rate.cap,
        knowledge: now.knowledge, knowledgeCap: bh.features.includes('Landmark') ? WORLD_BUILD.landmark.store : 0,
      } : null,
      garrison: garrisonView(b, h),
    };
  }).sort((x, y) => x.index - y.index);
  const armies: ArmyView[] = b.armies.map((a) => ({
    id: a.id, owner: a.owner, purpose: a.purpose, phase: a.phase, path: a.path,
    departedAt: a.departedAt, msPerHex: a.msPerHex, target: a.target, at: a.at,
    power: boardPower(a.board), heroes: a.owner === seat ? [...a.heroes] : null,
  }));
  return {
    board: { id: b.id, seed: b.seed, seat },
    at: t,
    seats: b.seats.map((s, i) => ({ seat: i, name: s?.name ?? 'A free city', you: i === seat, bot: s?.bot ?? false })),
    hexes,
    armies,
    effects: [],
  };
}

function garrisonView(b: ServerBoard, h: ServerHex): HexView['garrison'] {
  if (h.garrison === null) return null;
  const g = b.armies.find((a) => a.id === h.garrison);
  return g === undefined ? null : { army: g.id, owner: g.owner, power: boardPower(g.board) };
}
