// The tick resolver (Docs/features/combat.md §7, §8, §9, §10, §13).
//
// A fight is a deterministic auto-battler with no input in it, and this file
// is the whole of it: two boards go in, an ORDERED LIST OF EVENTS comes out.
// Nothing here reads state, a clock or a random number — the seed is spent
// upstream, generating who is standing there (`enemyBoard`), and by the time
// resolution starts the answer is already fixed.
//
// THE EVENT STREAM IS THE INTERFACE. The screen replays the list and never
// recomputes an outcome from it (§13): it knows a squad lost eleven troops
// because the resolver said so, not because it subtracted anything. That is
// what lets the same screen play a room fought here today and a PvP fight
// resolved on a server later — a replay is `(both boards, the list)`, and
// nothing about the renderer knows which produced it.
//
// EVERYTHING IS INTEGER. The only division is the type fraction, floored
// (§7), so the same boards produce the same list bit-for-bit on any engine —
// which is what makes the golden test in `tests/battle.test.ts` a real guard
// rather than a snapshot that drifts.

import { BEATS } from './combat';
import { COMBAT, UNITS, VILLAINS, type VillainId } from './data/definitions';
import { randInt, type RngPart } from './rng';
import type { UnitId } from './state';

export type Side = 'ours' | 'theirs';
export type Row = 'front' | 'back';

/** How a slot chooses what to hit (§8). Derived from the unit's tags, never
 *  authored twice: a Distance unit shoots, a Mounted one flanks. */
export type Targeting = 'melee' | 'ranged' | 'flanker';

export const targetingFor = (unitId: UnitId): Targeting => (
  UNITS[unitId].tags.includes('Distance') ? 'ranged'
    : UNITS[unitId].tags.includes('Mounted') ? 'flanker' : 'melee');

/**
 * One slot on the board, resolved.
 *
 * Everything the resolver needs is already in it — the passives are applied
 * when the board is built (§9.2), so no rule inside the tick loop has to ask
 * who else is standing on the same side.
 */
export interface BoardSlot {
  /** Stable within its side, and what every event refers to. */
  id: number;
  kind: 'troop' | 'hero';
  row: Row;
  /** What it fights as on the type chart. A hero carries one too (§7). */
  type: UnitId;
  /** For the screen: which portrait to draw. */
  unitId: UnitId | null;
  fighterId: string | null;
  name: string;
  /** Troops in the squad; 1 for a hero. */
  count: number;
  frontage: number;
  dmg: number;
  def: number;
  hpUnit: number;
  hpPool: number;
  cooldown: number;
  /** What one of it is worth in the power estimate — the bar at the top of
   *  the battle screen is the sum of this over what is still standing. */
  power: number;
}

export interface Board {
  slots: BoardSlot[];
}

export interface SlotRef {
  side: Side;
  id: number;
}

export type BattleEvent =
  | { kind: 'start'; ours: BoardSlot[]; theirs: BoardSlot[] }
  | {
    kind: 'attack';
    tick: number;
    from: SlotRef;
    to: SlotRef;
    /** Troops that reached the enemy this swing — `min(alive, frontage)`. */
    hits: number;
    dealt: number;
  }
  | { kind: 'troops_lost'; tick: number; at: SlotRef; alive: number; hpPool: number }
  | { kind: 'slot_wiped'; tick: number; at: SlotRef }
  | { kind: 'end'; tick: number; winner: Side; reason: 'wiped' | 'timeout' };

export interface BattleLog {
  events: BattleEvent[];
  winner: Side;
  reason: 'wiped' | 'timeout';
  /** How long the fight ran. At `COMBAT.tickMs` a tick, this is also exactly
   *  how long the screen will spend replaying it. */
  ticks: number;
}

// ------------------------------------------------------------ building a board

/** What a hero or a villain brings — the one shape the resolver reads for
 *  both, because a villain IS an enemy hero (§9). */
export interface FighterSpec {
  id: string;
  name: string;
  type: UnitId;
  dmg: number;
  def: number;
  hp: number;
  cooldown: number;
  power: number;
  troopDmgMult: number;
  troopHpMult: number;
  troopDefBonus: number;
}

export interface SquadSpec {
  unitId: UnitId;
  count: number;
}

/** Flat bonuses the kingdom's research hands its own troops. Resolved
 *  upstream (`expeditions.ts#drillOf`) so this file stays free of state. */
export interface TroopBonus {
  dmg: (unitId: UnitId) => number;
  def: (unitId: UnitId) => number;
}

const NO_BONUS: TroopBonus = { dmg: () => 0, def: () => 0 };

/** Squads go where their targeting puts them (§11 step 5): the ones that have
 *  to reach the enemy stand in front, the ones that shoot stand behind. */
const rowFor = (unitId: UnitId): Row => (targetingFor(unitId) === 'ranged' ? 'back' : 'front');

/**
 * Assemble one side.
 *
 * **The passives are baked in here**, once, before the first tick: every
 * squad whose type matches a fighter on its own side takes that fighter's
 * multipliers, they stack additively on the excess (`1 + Σ(mult − 1)`), the
 * flats sum, and none of it is undone when the fighter dies (§9.2).
 */
export function buildBoard(
  squads: readonly SquadSpec[],
  fighters: readonly FighterSpec[],
  bonus: TroopBonus = NO_BONUS,
): Board {
  const dmgMult = new Map<UnitId, number>();
  const hpMult = new Map<UnitId, number>();
  const defFlat = new Map<UnitId, number>();
  for (const f of fighters) {
    dmgMult.set(f.type, (dmgMult.get(f.type) ?? 1) + (f.troopDmgMult - 1));
    hpMult.set(f.type, (hpMult.get(f.type) ?? 1) + (f.troopHpMult - 1));
    defFlat.set(f.type, (defFlat.get(f.type) ?? 0) + f.troopDefBonus);
  }

  const slots: BoardSlot[] = [];
  for (const squad of squads) {
    if (squad.count <= 0) continue;
    const u = UNITS[squad.unitId];
    const hpUnit = Math.max(1, Math.round(u.hp * (hpMult.get(squad.unitId) ?? 1)));
    slots.push({
      id: slots.length,
      kind: 'troop',
      row: rowFor(squad.unitId),
      type: squad.unitId,
      unitId: squad.unitId,
      fighterId: null,
      name: u.name,
      count: squad.count,
      frontage: u.frontage,
      dmg: Math.max(1, Math.round(
        (u.dmg + bonus.dmg(squad.unitId)) * (dmgMult.get(squad.unitId) ?? 1))),
      def: u.def + bonus.def(squad.unitId) + (defFlat.get(squad.unitId) ?? 0),
      hpUnit,
      hpPool: squad.count * hpUnit,
      cooldown: u.cooldown,
      power: u.power,
    });
  }
  // Heroes are LAST and in their own kind, so a slot id is stable whatever
  // the party looks like: the troops keep 0…n and the heroes follow.
  for (const f of fighters) {
    slots.push({
      id: slots.length,
      kind: 'hero',
      // A hero stands where its type would stand — the chart it fights on is
      // the same one (§7), so a mounted hero flanks like the cavalry does.
      row: rowFor(f.type),
      type: f.type,
      unitId: null,
      fighterId: f.id,
      name: f.name,
      count: 1,
      frontage: 1,
      dmg: f.dmg,
      def: f.def,
      hpUnit: f.hp,
      hpPool: f.hp,
      cooldown: f.cooldown,
      power: f.power,
    });
  }
  return { slots };
}

// ------------------------------------------------------------------ the fight

const alive = (s: BoardSlot): number => Math.ceil(s.hpPool / s.hpUnit);

const living = (board: Board): BoardSlot[] => board.slots.filter((s) => s.hpPool > 0);

/**
 * The type fraction, as the integer pair it is authored as (§7).
 *
 * Returned rather than applied so the caller can floor ONCE, on the whole
 * swing — flooring per troop would quietly delete a third of an archer line.
 */
function fraction(attacker: UnitId, target: UnitId): { num: number; den: number } {
  if (BEATS[attacker] === target) {
    return { num: COMBAT.typeAdvantageNum, den: COMBAT.typeAdvantageDen };
  }
  if (BEATS[target] === attacker) {
    return { num: COMBAT.typeDisadvantageNum, den: COMBAT.typeDisadvantageDen };
  }
  return { num: 1, den: 1 };
}

/**
 * Who this slot swings at, resolved fresh on every attack (§8).
 *
 * Ties break by the lowest slot id, which is what makes the whole fight
 * reproducible: there is never a moment where two targets are equally good
 * and the answer depends on how a list happened to be ordered.
 */
function pickTarget(attacker: BoardSlot, enemy: Board): BoardSlot | null {
  const candidates = living(enemy);
  if (candidates.length === 0) return null;
  const inRow = (row: Row): BoardSlot[] => candidates.filter((s) => s.row === row);
  const lowestId = (list: BoardSlot[]): BoardSlot => list
    .reduce((best, s) => (s.id < best.id ? s : best));

  switch (targetingFor(attacker.type)) {
    case 'ranged': {
      // The weakest thing on the board, wherever it is standing: an archer
      // line finishes what the front rank started.
      return candidates.reduce((best, s) => (
        s.hpPool < best.hpPool || (s.hpPool === best.hpPool && s.id < best.id) ? s : best));
    }
    case 'flanker': {
      const back = inRow('back');
      return lowestId(back.length > 0 ? back : candidates);
    }
    default: {
      const front = inRow('front');
      return lowestId(front.length > 0 ? front : candidates);
    }
  }
}

/**
 * ONE FIGHT, start to finish (§10).
 *
 * `ours` is the attacker — in PvE the player always is, and it matters twice:
 * the attacker's slots swing first within a tick, and a fight that runs out
 * of clock is won by the DEFENDER. There are no draws.
 */
export function resolveBattle(ours: Board, theirs: Board): BattleLog {
  // Copies, so a caller can hand the same board to two resolutions and get
  // the same answer twice — which the golden test relies on.
  const sides: Record<Side, Board> = {
    ours: { slots: ours.slots.map((s) => ({ ...s })) },
    theirs: { slots: theirs.slots.map((s) => ({ ...s })) },
  };
  const events: BattleEvent[] = [
    { kind: 'start', ours: sides.ours.slots.map((s) => ({ ...s })), theirs: sides.theirs.slots.map((s) => ({ ...s })) },
  ];
  const ready: Record<Side, number[]> = {
    ours: sides.ours.slots.map((s) => s.cooldown),
    theirs: sides.theirs.slots.map((s) => s.cooldown),
  };

  const finish = (tick: number, winner: Side, reason: 'wiped' | 'timeout'): BattleLog => {
    events.push({ kind: 'end', tick, winner, reason });
    return { events, winner, reason, ticks: tick };
  };

  // A side with nothing standing has already lost, before a blow is struck —
  // an empty party is a legal thing to send and must not hang the loop.
  if (living(sides.ours).length === 0) return finish(0, 'theirs', 'wiped');
  if (living(sides.theirs).length === 0) return finish(0, 'ours', 'wiped');

  for (let tick = 1; tick <= COMBAT.timeoutTicks; tick++) {
    for (const side of ['ours', 'theirs'] as Side[]) {
      const foe: Side = side === 'ours' ? 'theirs' : 'ours';
      for (const slot of sides[side].slots) {
        if (slot.hpPool <= 0) continue;
        ready[side][slot.id] -= 1;
        if (ready[side][slot.id]! > 0) continue;
        ready[side][slot.id] = slot.cooldown;

        const target = pickTarget(slot, sides[foe]);
        if (target === null) break;

        const hits = Math.min(alive(slot), slot.frontage);
        const raw = hits * Math.max(1, slot.dmg - target.def);
        const { num, den } = fraction(slot.type, target.type);
        const dealt = Math.floor((raw * num) / den);

        const before = alive(target);
        target.hpPool = Math.max(0, target.hpPool - dealt);
        const after = alive(target);
        const at: SlotRef = { side: foe, id: target.id };
        events.push({ kind: 'attack', tick, from: { side, id: slot.id }, to: at, hits, dealt });
        if (after !== before) {
          events.push({ kind: 'troops_lost', tick, at, alive: after, hpPool: target.hpPool });
        }
        if (target.hpPool <= 0) {
          events.push({ kind: 'slot_wiped', tick, at });
          if (living(sides[foe]).length === 0) return finish(tick, side, 'wiped');
        }
      }
    }
  }
  // Out of clock. The defender holds the ground they were standing on.
  return finish(COMBAT.timeoutTicks, 'theirs', 'timeout');
}

// ---------------------------------------------------------------- reading it

/** What is left of each of our slots when the dust settles — the losses a
 *  caller charges to the roster are `count − alive` (§4). */
export function survivorsOf(log: BattleLog, side: Side): Map<number, number> {
  const start = log.events[0];
  if (start?.kind !== 'start') return new Map();
  const out = new Map<number, number>();
  for (const s of side === 'ours' ? start.ours : start.theirs) {
    out.set(s.id, s.count);
  }
  for (const e of log.events) {
    if (e.kind === 'troops_lost' && e.at.side === side) out.set(e.at.id, e.alive);
    if (e.kind === 'slot_wiped' && e.at.side === side) out.set(e.at.id, 0);
  }
  return out;
}

/** The two numbers on the bar at the top of the screen, as they stood before
 *  the first blow. The screen keeps them current by subtracting what each
 *  `troops_lost` took. */
export const boardPower = (board: Board): number => board.slots
  .reduce((sum, s) => sum + s.power * s.count, 0);

// ------------------------------------------------------------- who is in there

/** A generated enemy, ready for `buildBoard`. */
export interface EnemyPlan {
  squads: SquadSpec[];
  fighters: FighterSpec[];
}

/** A villain, as the resolver reads it. The same shape a hero resolves to —
 *  which is the point of §9: one code path, two sources. */
export const villainFighter = (id: VillainId): FighterSpec => {
  const v = VILLAINS[id];
  return {
    id,
    name: v.name,
    type: v.unitType,
    dmg: v.dmg,
    def: v.def,
    hp: v.hp,
    cooldown: v.cooldown,
    power: v.power,
    troopDmgMult: v.troopDmgMult,
    troopHpMult: v.troopHpMult,
    troopDefBonus: v.troopDefBonus,
  };
};

/**
 * WHAT A ROOM FIELDS, from its power budget (§11).
 *
 * Seeded by the room's own address, so the same room is the same fight every
 * time it is looked at — the preview and the attempt are one query, and a
 * player who backs out and returns meets what they backed away from.
 *
 * The budget is spent, not decorated: every squad and every villain here
 * costs its `power`, so `formationPower` of the result is what the room's
 * `power_req` promised.
 */
export function generateEnemy(opts: {
  seed: number;
  /** What identifies the ROOM, never the moment it was asked (rng.ts). */
  parts: readonly RngPart[];
  budget: number;
  affinity: UnitId | 'Any';
  villainPool?: readonly VillainId[];
  /** A boss's villain is authored and always present — never rolled. */
  boss?: VillainId | null;
}): EnemyPlan {
  const { seed, parts, affinity } = opts;
  const pool = opts.villainPool ?? [];
  let budget = Math.max(1, Math.round(opts.budget));
  const fighters: FighterSpec[] = [];

  // The villains first, because what is left is what the squads may cost.
  //
  // Up to a hero slot's worth of them, the same three the player fields (§3),
  // and they are what makes a deep room deep: SQUADS SATURATE. Six slots of
  // `squad_size` is all a board can hold, so past a certain budget another
  // thousand points buys nothing at all — unless it buys somebody with a
  // name, who hits for a squad's worth and buffs the ones beside them.
  const boss = opts.boss ?? null;
  if (boss !== null) {
    fighters.push(villainFighter(boss));
    budget = Math.max(1, budget - VILLAINS[boss].power);
  }
  if (pool.length > 0 && budget >= COMBAT.genVillainThreshold) {
    let purse = Math.round(budget * COMBAT.genVillainShare);
    for (let i = fighters.length; i < COMBAT.genVillainSlots; i++) {
      const picked = pool[randInt(seed, pool.length, ...parts, 'villain', i)]!;
      const cost = VILLAINS[picked].power;
      if (cost > purse) break;
      fighters.push(villainFighter(picked));
      purse -= cost;
      budget = Math.max(1, budget - cost);
    }
  }

  // How many squads stand behind it: a thin room is two, a deep one fills the
  // board. The roll gives the variety, the budget gives the floor — a room
  // worth two thousand cannot say what it is worth in three squads, because a
  // squad holds `squad_size` and no more.
  const span = COMBAT.genSlotsMax - COMBAT.genSlotsMin;
  const roll = randInt(seed, span + 1, ...parts, 'slots');
  const needed = Math.ceil(budget / (UNITS.Warrior.squadSize * UNITS.Warrior.power));
  const wanted = Math.min(
    COMBAT.genSlotsMax,
    Math.max(COMBAT.genSlotsMin, Math.max(roll + COMBAT.genSlotsMin, needed)),
  );

  // The ruin's own bias takes the lion's share and is spent FIRST, so a room
  // that runs out of slots runs out of them holding its own creature. The
  // rest is split evenly: a party that hard-counters the affinity should
  // still meet something awkward.
  const types = Object.keys(BEATS) as UnitId[];
  const order = affinity === 'Any' ? types : [affinity, ...types.filter((t) => t !== affinity)];
  const share = new Map<UnitId, number>();
  if (affinity === 'Any') {
    for (const t of types) share.set(t, budget / types.length);
  } else {
    const lion = Math.round(budget * 0.6);
    share.set(affinity, lion);
    for (const t of order.slice(1)) share.set(t, (budget - lion) / (order.length - 1));
  }

  const squads: SquadSpec[] = [];
  let left = budget;
  const add = (unitId: UnitId, troops: number): void => {
    let want = troops;
    while (want > 0 && squads.length < wanted) {
      const count = Math.min(UNITS[unitId].squadSize, want);
      squads.push({ unitId, count });
      want -= count;
      left -= count * UNITS[unitId].power;
    }
  };
  for (const t of order) {
    add(t, Math.floor(Math.min(share.get(t) ?? 0, Math.max(0, left)) / UNITS[t].power));
  }
  // Whatever the shares left on the table goes to the affinity, while there
  // is a slot to put it in. Budget a board cannot hold is budget a room
  // cannot field — which is the ceiling the authored ladder lives under.
  const filler = affinity === 'Any' ? order[0]! : affinity;
  while (squads.length < wanted && left >= UNITS[filler].power) {
    add(filler, Math.floor(left / UNITS[filler].power));
  }
  // A room always fields something, even at a budget of one.
  if (squads.length === 0) squads.push({ unitId: filler, count: 1 });
  return { squads, fighters };
}
