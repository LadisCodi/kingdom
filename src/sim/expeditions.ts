// Ruins: the party and the gate (Docs/proposals/lairs.md §1, §5).
//
// A ruin is its GATE: one garrison, one fight, cleared once. The depths of
// rooms that stood behind it are retired, so nothing here is ever in flight
// and `advance()` has no boundary in this module at all.
//
// What is left is the PARTY — what it costs to send and what it is worth —
// and the one command that spends it: the gate attempt.

import { COMBAT, HEROES, PARTY, RUINS, UNITS } from './data/definitions';
import { addHeroXp, heroSlots } from './heroes';
import {
  NO_DRILL, partyPower, partyStats,
  type EnemySquad, type Party, type PartySlot, type Drill,
} from './combat';
import {
  boardPower, buildBoard, resolveBattle, survivorsOf,
  type Board, type BattleLog, type FighterSpec, type SquadSpec,
} from './battle';
import { applyLosses, availableRoster, woundedShareFor } from './army';
import { gateBoard, gateIsCleared, gateSupplies, markGateCleared } from './gates';
import { fogState } from './fog';
import { firstClearLump, payKnowledge } from './knowledge';
import type { MapData } from './grid';
import { resolve } from './modifiers';
import { isTechComplete } from './research';
import { techFlat, techFlatAimed, techValue } from './techEffects';
import type { GameState, HeroId, RuinId, UnitId, Wallet } from './state';
import { canAfford, pay } from './wallet';

// ------------------------------------------------------------------- slots

/**
 * THE TROOP SLOTS, and there is nothing to buy.
 *
 * Every one of the board's slots is open from the first fight
 * (Docs/features/combat.md §3). What limits a party is the ARMY AT HOME and
 * the army cap — both of which are earned in the city — and the only slot in
 * the game that is bought is a HERO slot (Docs/features/10-heroes.md §3).
 */
export const troopSlots = (): number => PARTY.troopSlots;

// ---------------------------------------------------------------- supplies

/**
 * What ONE gate attempt costs: the tier's `garrisons` supplies, paid on entry
 * and never refunded, win or lose — so an attempt is a decision with a price
 * rather than a free retry, and the price is small enough that the decision
 * is about troops. The Quartermaster and the Rations line discount it.
 */
export function gateSupplyCost(
  state: GameState, ruinId: RuinId, heroIds: readonly HeroId[],
): Wallet {
  const base = gateSupplies(ruinId);
  // The best quartermaster in the party, not the sum of them: two of them
  // would otherwise stack to a free trip.
  const discount = heroIds.reduce((best, id) => (HEROES[id].trait === 'SupplyDiscount'
    ? Math.max(best, HEROES[id].traitValue) : best), 0);
  // Rations stacks with the Quartermaster's trait the way a rank and a relic
  // stack everywhere else: the trait is a discount, the line is a discount,
  // and the modifier stack rides on the product.
  const mult = Math.max(0, resolve(state, 'supplyCost',
    (1 - discount) * techValue(state, 'supplyCost', 1)));
  const out: Wallet = {};
  for (const [c, n] of Object.entries(base)) {
    out[c as keyof Wallet] = Math.max(1, Math.round(n * mult));
  }
  return out;
}

/**
 * The kingdom's drill: what the Warfare technologies add to every soldier
 * sent, in the shape combat.ts takes it. Resolved HERE, once per launch or
 * preview, so combat stays pure and a fight replays from its inputs. The `all`
 * terms go through the modifier stack; the per-tag ones are the tree's and
 * nothing else.
 *
 * The per-tag terms use `techFlatAimed`, which excludes the unaimed effects,
 * because `combat.ts` sums `all` plus every tag a unit carries — and Cavalry
 * carries two, so an aimed query that included the global term would pay
 * Warhorns twice on an Archer and three times on a Cavalry.
 *
 * `Tactics` stays a hardcoded ternary, unlike `Cartography` and `Communities`
 * which became data. As an effect it would fold into `techFlat` and turn
 * `(base + manoeuvre) + 0.10` into `base + (manoeuvre + 0.10)`, and float
 * addition is not associative: at `base = 0.33` those are different doubles at
 * one and two Manoeuvre ranks. `base` is 0 today, so it would be exact today —
 * which is the kind of exactness that stops being true the first time a
 * modifier reaches `typeDisadvantage`, and `modifiers.ts` declares it so one
 * can.
 */
export function drillOf(state: GameState): Drill {
  return {
    atk: {
      all: Math.round(resolve(state, 'unitAtk', techFlat(state, 'unitAtk'))),
      Distance: techFlatAimed(state, 'unitAtk', { unitTag: 'Distance' }),
    },
    def: {
      all: Math.round(resolve(state, 'unitDef', 0)),
      Melee: techFlatAimed(state, 'unitDef', { unitTag: 'Melee' }),
      Mounted: techFlatAimed(state, 'unitDef', { unitTag: 'Mounted' }),
    },
    disadvantageOffset: Math.max(0, resolve(state, 'typeDisadvantage', 0)
      + techFlat(state, 'typeDisadvantage')
      + (isTechComplete(state, 'Tactics') ? 0.10 : 0)), // reading the ground
    // A MULTIPLIER, floored at the identity: nothing in the game may make the
    // kingdom's own troops frailer than the sheet says.
    hpMult: Math.max(1, resolve(state, 'unitHp', 1)),
  };
}

/**
 * A Party as combat sees it, with the kingdom's drill attached and every hero
 * resolved to the level it fights at. The one place a Party is assembled, so
 * no launch or preview can forget either.
 */
export const partyOf = (
  state: GameState, slots: readonly PartySlot[], heroIds: readonly HeroId[] = [],
): Party => ({
  heroes: heroIds.map((id) => ({ id, level: heroLevel(state, id) })),
  slots,
  drill: drillOf(state),
});

/**
 * OUR SIDE OF THE BOARD (Docs/features/combat.md §3, §9).
 *
 * Every hero in the party is a fighter with its level's numbers.
 */
export function partyBoard(party: Party): Board {
  const drill = party.drill ?? NO_DRILL;
  const fighters: FighterSpec[] = party.heroes.map((h) => {
    const def = HEROES[h.id];
    const step = h.level - 1;
    return {
      id: h.id,
      name: def.name,
      type: def.unitType,
      dmg: def.dmg + def.dmgPerLevel * step,
      def: def.def + def.defPerLevel * step,
      hp: def.hp + def.hpPerLevel * step,
      cooldown: def.cooldown,
      power: Math.round((def.dmg + def.dmgPerLevel * step) * COMBAT.heroPowerPerDmg),
      troopDmgMult: def.troopDmgMult,
      troopHpMult: def.troopHpMult,
      troopDefBonus: def.troopDefBonus,
    };
  });
  const bonus = {
    dmg: (unitId: UnitId) => drillFlat(drill.atk, UNITS[unitId].tags),
    def: (unitId: UnitId) => drillFlat(drill.def, UNITS[unitId].tags),
    hpMult: () => drill.hpMult,
  };
  return buildBoard(party.slots.filter((s) => s.count > 0) as SquadSpec[], fighters, bonus);
}

/** The drill's flat, for one unit's tags: the unaimed term plus every tag it
 *  carries (a Cavalry reads both `Mounted` and its own). */
const drillFlat = (
  table: Partial<Record<string, number>>, tags: readonly string[],
): number => (table.all ?? 0) + tags.reduce((sum, t) => sum + (table[t] ?? 0), 0);

/** The squads a board is showing, for the screens that draw one. */
export const boardSquads = (board: Board): EnemySquad[] => board.slots
  .filter((s) => s.kind === 'troop' && s.unitId !== null)
  .map((s) => ({ unitId: s.unitId as UnitId, count: s.count }));

/** What our slots lost, read off the log: `count − alive`, per slot (§4). */
export function lossesFrom(log: BattleLog, board: Board): Array<{ unitId: UnitId; count: number }> {
  const left = survivorsOf(log, 'ours');
  const out: Array<{ unitId: UnitId; count: number }> = [];
  for (const slot of board.slots) {
    if (slot.kind !== 'troop' || slot.unitId === null) continue;
    const fell = slot.count - (left.get(slot.id) ?? slot.count);
    if (fell > 0) out.push({ unitId: slot.unitId, count: fell });
  }
  return out;
}

// ------------------------------------------------------------------- heroes

export const heroLevel = (state: GameState, id: HeroId): number => state.heroes.levels[id] ?? 1;

export const ownsHero = (state: GameState, id: HeroId): boolean => state.heroes.owned.includes(id);

// NOBODY IS EVER BUSY. A fight resolves on entry, so no hero is ever away
// and the same hero leads every attempt (Docs/features/10-heroes.md §2.6).
export const freeHeroes = (state: GameState): HeroId[] => [...state.heroes.owned];

// -------------------------------------------------------------- the gate

/**
 * The gate is the whole ruin: one fight, nothing behind it
 * (Docs/proposals/lairs.md §5).
 *
 * It lives here rather than in `gates.ts` because clearing one is a PARTY
 * command — a hero, a matchup and supplies — and this module already owns all
 * three. `gates.ts` owns the clock and the hoard, and knows nothing about how
 * a garrison is beaten.
 *
 * Two things make it the right first fight. The threat is in VIEW — no
 * scouting, no hidden type — and the party may be a hero ALONE, so the very
 * first battle needs no army at all. A shortfall warns rather than blocks, and
 * a retry is identical to a first attempt: nothing is lost but the supplies.
 */
export type GateBlock =
  | 'RuinNotFound' | 'AlreadyCleared' | 'NoHero' | 'TooManyHeroes' | 'TooManySlots'
  | 'NotEnoughUnits' | 'NotEnoughSupplies';

export function gateBlock(
  state: GameState,
  map: MapData,
  ruinId: RuinId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
): GateBlock | null {
  if (fogState(state, map, RUINS[ruinId].location) !== 'Revealed') return 'RuinNotFound';
  if (gateIsCleared(state, ruinId)) return 'AlreadyCleared';
  if (heroIds.length === 0 || heroIds.some((id) => !ownsHero(state, id))) return 'NoHero';
  if (heroIds.length > heroSlots(state)) return 'TooManyHeroes';
  // NO 'HeroBusy'. A gate resolves on ENTRY, so a hero is never busy for it
  // (Docs/features/10-heroes.md §2.6).
  // A hero alone is a legal board, so there is no EmptyParty here either.
  const committed = slots.filter((s) => s.count > 0);
  if (committed.length > troopSlots()) return 'TooManySlots';
  const available = availableRoster(state);
  for (const s of committed) {
    if (s.count > available[s.unitId]) return 'NotEnoughUnits';
  }
  // No cap check: the army cap bounds what the city OWNS
  // (Docs/features/combat.md §14), and a party is drawn from what it owns —
  // so `NotEnoughUnits` above is the only ceiling a composition can hit.
  if (!canAfford(state.city.wallet, gateSupplyCost(state, ruinId, heroIds))) return 'NotEnoughSupplies';
  return null;
}

export interface GateReport {
  result: 'Cleared' | 'Repelled' | GateBlock;
  /** The party's power estimate, and what it was up against. Neither decided
   *  anything — `log` did (Docs/features/combat.md §12). */
  attack: number;
  power: number;
  /** THE FIGHT, tick by tick. What the battle screen replays; null when the
   *  attempt was refused before anyone drew a weapon. */
  log: BattleLog | null;
  /** Everything the garrison had taken, banked on the way out. */
  hoard: Wallet;
  /** The first-clear Knowledge lump this win paid — 0 on a repulse, and on
   *  any clear after the first (there is none today: a cleared gate refuses). */
  knowledge: number;
  supplies: Wallet;
  /** Who did not come back. A garrison fights: it costs soldiers whether it
   *  falls or not (§5). */
  losses: Array<{ unitId: UnitId; count: number }>;
  /** The share of them that reached the infirmary and can be healed back. */
  wounded: Array<{ unitId: UnitId; count: number }>;
}

/**
 * One attempt on a gate, resolved on entry with the player attacking.
 *
 * Win: the gate is cleared, its counter stops, its hoard is paid in full, and
 * the ruin's first-clear Knowledge lump lands — clearing the gate IS clearing
 * the ruin. Lose: the supplies are gone and the gate stands — no cooldown, no
 * second timer. Casualties either way.
 */
export function attemptGate(
  state: GameState,
  map: MapData,
  ruinId: RuinId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
): GateReport {
  const theirs = gateBoard(state, ruinId);
  const power = boardPower(theirs);
  const supplies = gateSupplyCost(state, ruinId, heroIds);
  const block = gateBlock(state, map, ruinId, heroIds, slots);
  if (block !== null) {
    return {
      result: block, attack: 0, power, log: null, hoard: {}, knowledge: 0, supplies,
      losses: [], wounded: [],
    };
  }
  pay(state.city.wallet, supplies);
  const committed = slots.filter((s) => s.count > 0).map((s) => ({ ...s }));
  const party = partyOf(state, committed, heroIds);
  const ours = partyBoard(party);
  const attack = partyPower(party);
  const log = resolveBattle(ours, theirs);
  // The garrison swings back either way, and who fell is read straight off
  // the fight: some are carried home to the infirmary, the rest are gone.
  const { losses, wounded } = applyLosses(
    state, lossesFrom(log, ours), woundedShareFor(state, heroIds));
  if (log.winner !== 'ours') {
    return {
      result: 'Repelled', attack, power, log, hoard: {}, knowledge: 0, supplies, losses, wounded,
    };
  }
  const hoard = markGateCleared(state, ruinId);
  // The fight taught the party something whether or not the garrison was
  // holding anything, and a tier-5 gate teaches more than the Barrow's.
  addHeroXp(state, RUINS[ruinId].tier);
  // THE FIRST CLEAR, once per ruin. `gateBlock` refuses a cleared gate, so
  // this line runs once per ruin for the life of the kingdom; Conquest,
  // Vigils and Sanctified Ruins ride on the lump (sim/knowledge.ts).
  const knowledge = firstClearLump(state);
  payKnowledge(state, knowledge);
  return { result: 'Cleared', attack, power, log, hoard, knowledge, supplies, losses, wounded };
}

/** What the gate sheet shows before the player commits: the threat is always
 *  visible on a gate, so this hides nothing. */
export interface GatePreview {
  ruinId: RuinId;
  threat: UnitId | 'Any';
  /** The squads in the doorway, and what they are worth. */
  enemy: EnemySquad[];
  power: number;
  attack: number;
  stats: { atk: number; def: number; hp: number };
  supplies: Wallet;
  /** The first-clear Knowledge lump a win would pay, at today's prices. */
  knowledge: number;
  /** True when the party already beats the gate ON PAPER. A shortfall warns,
   *  it never blocks — and the paper is an estimate now, so a party that
   *  reads short can still win the fight and one that reads long can lose it
   *  (Docs/features/combat.md §12). */
  enough: boolean;
}

export function previewGate(
  state: GameState,
  ruinId: RuinId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
): GatePreview {
  const guard = RUINS[ruinId].guard;
  const committed = slots.filter((s) => s.count > 0);
  const party = partyOf(state, committed, heroIds);
  const theirs = gateBoard(state, ruinId);
  const attack = partyPower(party);
  const power = boardPower(theirs);
  return {
    ruinId,
    threat: guard.threat,
    enemy: boardSquads(theirs),
    power,
    attack,
    stats: partyStats(party),
    supplies: gateSupplyCost(state, ruinId, heroIds),
    knowledge: firstClearLump(state),
    enough: attack >= power,
  };
}
