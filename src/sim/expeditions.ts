// Ruins: depths of rooms (Docs/features/11-expeditions.md §1, §5, §7).
//
// A ruin is a PATH, not a trip. Numbered depths of numbered rooms, one room is
// one fight, and the fight happens the instant the player enters it:
//
//     pay the supplies · resolve · cleared, or not
//
// Cleared, the room pays and the frontier moves on one. Not cleared, nothing
// is granted and nothing else is deducted, and the same room is waiting to be
// tried again. Rooms go in order and are never replayed, so a ruin is climbed
// once and the only question the player answers is WHICH TROOPS.
//
// THREE THINGS WENT WITH THE STAGED DELVE, and they are one simplification
// seen from three sides. There is no party underground, so nothing is ever in
// flight and `advance()` has no boundary here at all. There is no haul, so
// nothing is half-lost on a bad fight — a failed room costs its supplies and
// nothing else. And there is no standing order, because there is nothing to
// stand: the player enters one room, sees the answer, and decides again.
//
// What is left is the PARTY — what it costs to send and what it is worth —
// and the two commands that spend it: a room attempt, and the gate attempt
// that opens the ruin in the first place.

import {
  ARTIFACTS, COLLECTION, COMBAT, DELVE, HEROES, PARTY, RUINS, UNITS,
  depthCount, depthDef, depthsOf, roomPower,
} from './data/definitions';
import {
  addArtifactFragments, artifactEntry, artifactIsCarried, grantArtifact, isAttuned,
  ownsArtifact,
} from './artifacts';
import { addHeroXp, heroSlots } from './heroes';
import { recordResourceDiscovery } from './discovery';
import {
  carriedStats, partyPower, partyStats,
  type CarriedArtifact, type EnemySquad, type Party, type PartySlot, type Drill,
} from './combat';
import {
  boardPower, buildBoard, generateEnemy, resolveBattle, survivorsOf,
  type Board, type BattleLog, type FighterSpec, type SquadSpec,
} from './battle';
import { availableRoster, applyLosses } from './army';
import { gateBoard, gateIsCleared, gateSupplies, markGateCleared } from './gates';
import { fogState } from './fog';
import type { MapData } from './grid';
import { resolve } from './modifiers';
import { isTechComplete } from './research';
import { techFlat, techFlatAimed, techValue } from './techEffects';
import {
  addToWallet,
  type ArtifactId, type GameState, type HeroId, type RuinId, type RuinProgress,
  type UnitId, type Wallet,
} from './state';
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
 * What ONE room attempt costs, authored per depth
 * (Docs/features/11-expeditions.md §2). Paid on entry, never refunded, win or
 * lose — so a room is a decision with a price rather than a free retry, and
 * the price is small enough that the decision is about troops.
 */
export function supplyCost(
  state: GameState, ruinId: RuinId, depth: number, heroIds: readonly HeroId[],
): Wallet {
  const base = depthDef(ruinId, depth)?.supplies ?? {};
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
  };
}

/**
 * A Party as combat sees it, with the kingdom's drill attached and every hero
 * resolved to the level it fights at. The one place a Party is assembled, so
 * no launch or preview can forget either.
 */
export const partyOf = (
  state: GameState, slots: readonly PartySlot[], heroIds: readonly HeroId[] = [],
  artifact: CarriedArtifact | null = null,
): Party => ({
  heroes: heroIds.map((id) => ({ id, level: heroLevel(state, id) })),
  slots,
  artifact,
  drill: drillOf(state),
});

/**
 * OUR SIDE OF THE BOARD (Docs/features/combat.md §3, §9).
 *
 * Every hero in the party is a fighter with its level's numbers, and the one
 * carrying a relic wears it: the stone arms the arm that holds it rather than
 * being sprinkled over the soldiers, which is what "attune or arm" means when
 * there is a board to stand on.
 */
export function partyBoard(party: Party): Board {
  const drill = party.drill ?? { atk: {}, def: {}, disadvantageOffset: 0 };
  const relic = carriedStats(party.artifact);
  const fighters: FighterSpec[] = party.heroes.map((h, i) => {
    const def = HEROES[h.id];
    const step = h.level - 1;
    return {
      id: h.id,
      name: def.name,
      type: def.unitType,
      // The relic rides on the FIRST hero — the one who carried it down.
      dmg: def.dmg + def.dmgPerLevel * step + (i === 0 ? relic.atk : 0),
      def: def.def + def.defPerLevel * step + (i === 0 ? relic.def : 0),
      hp: def.hp + def.hpPerLevel * step + (i === 0 ? relic.hp : 0),
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
  };
  return buildBoard(party.slots.filter((s) => s.count > 0) as SquadSpec[], fighters, bonus);
}

/** The drill's flat, for one unit's tags: the unaimed term plus every tag it
 *  carries (a Cavalry reads both `Mounted` and its own). */
const drillFlat = (
  table: Partial<Record<string, number>>, tags: readonly string[],
): number => (table.all ?? 0) + tags.reduce((sum, t) => sum + (table[t] ?? 0), 0);

/** WHAT A ROOM FIELDS. Seeded by the room's address, so the preview and the
 *  attempt are the same query (§11). */
export function roomBoard(state: GameState, ruinId: RuinId, depth: number, room: number): Board {
  const def = depthDef(ruinId, depth) ?? null;
  const isBoss = def !== null && room >= def.rooms;
  const pool = (def?.villainPool ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  const plan = generateEnemy({
    seed: state.seed,
    parts: [ruinId, depth, room],
    budget: roomPower(ruinId, depth, room),
    affinity: RUINS[ruinId].affinity,
    villainPool: pool as never[],
    boss: isBoss && def?.bossVillain ? (def.bossVillain as never) : null,
  });
  return buildBoard(plan.squads, plan.fighters);
}

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

// NOBODY IS EVER BUSY. A room resolves on entry, so no hero is underground
// between two fights and the same hero leads every room the player enters
// (Docs/features/10-heroes.md §2.5). The rule the staged delve needed — one
// hero, one party, until it came back — went with the journey.
export const freeHeroes = (state: GameState): HeroId[] => [...state.heroes.owned];

// -------------------------------------------------------------- the gate

/**
 * The gate is the ruin's FRONTIER ROOM while it stands: it sits above Depth 1
 * and is entered the same way, with `Clear the gate` in place of *Descend*
 * (Docs/features/18-garrisons-and-raids.md §5).
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
  // NO 'HeroBusy'. A gate resolves on ENTRY, so a hero is never busy for it —
  // the same hero leads every room the player enters
  // (Docs/features/10-heroes.md §2.5). Only a DELVE parks a party
  // underground, and only `launchBlock` asks.
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
  if (!canAfford(state.city.wallet, gateSupplies(ruinId))) return 'NotEnoughSupplies';
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
 * Win: the gate is cleared, its counter stops, its hoard is paid in full and
 * Depth 1 becomes the frontier. Lose: the supplies are gone and the gate
 * stands — no casualties, no cooldown, no second timer.
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
  const supplies = gateSupplies(ruinId);
  const block = gateBlock(state, map, ruinId, heroIds, slots);
  if (block !== null) {
    return {
      result: block, attack: 0, power, log: null, hoard: {}, supplies,
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
  const { losses, wounded } = applyLosses(state, lossesFrom(log, ours));
  if (log.winner !== 'ours') {
    return { result: 'Repelled', attack, power, log, hoard: {}, supplies, losses, wounded };
  }
  const hoard = markGateCleared(state, ruinId);
  // The fight taught the party something whether or not the garrison was
  // holding anything, and a tier-5 gate teaches more than the Barrow's.
  addHeroXp(state, RUINS[ruinId].tier);
  return { result: 'Cleared', attack, power, log, hoard, supplies, losses, wounded };
}

/** What the room sheet shows before the player commits: the threat is always
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
    supplies: gateSupplies(ruinId),
    enough: attack >= power,
  };
}

// -------------------------------------------------------------- the rooms

/** Where the player is in a ruin: the depth, and the rooms cleared in it. */
export const progressIn = (state: GameState, ruinId: RuinId): RuinProgress =>
  state.ruins[ruinId] ?? { depth: 1, cleared: 0 };

/** The room the player would enter next — the FRONTIER. Its `room` is
 *  1-based, and `done` is a ruin with nothing left in it. */
export function frontier(state: GameState, ruinId: RuinId): {
  depth: number; room: number; done: boolean;
} {
  const at = progressIn(state, ruinId);
  const def = depthDef(ruinId, at.depth);
  if (def === undefined) return { depth: depthCount(ruinId), room: 0, done: true };
  return { depth: at.depth, room: at.cleared + 1, done: false };
}

/** Rooms cleared in the whole ruin, and how many it holds. Progress is one
 *  number to a player, however many depths it is spread over. */
export function roomsCleared(state: GameState, ruinId: RuinId): number {
  const at = progressIn(state, ruinId);
  return depthsOf(ruinId)
    .filter((d) => d.depth < at.depth)
    .reduce((sum, d) => sum + d.rooms, 0) + at.cleared;
}

/** True when every room of every depth has fallen. */
export const ruinIsFinished = (state: GameState, ruinId: RuinId): boolean =>
  frontier(state, ruinId).done;

/** The last room of a depth is its BOSS (§1). */
export const isBossRoom = (ruinId: RuinId, depth: number, room: number): boolean =>
  room === (depthDef(ruinId, depth)?.rooms ?? 0);

/**
 * What a cleared room pays (§7.1).
 *
 * `reward_base(D) × k × tier × 1.06^(r − 1)`: a room pays more the deeper it
 * is and the further into its depth it is, so the ladder never flattens. The
 * boss pays a bigger multiple of the same line — the authored chest is
 * §7.2's, and it needs villains and named loot that do not exist yet.
 */
export function roomReward(
  state: GameState, ruinId: RuinId, depth: number, room: number,
): { wallet: Wallet; heroXp: number; fragments: number } {
  const def = depthDef(ruinId, depth);
  const tier = RUINS[ruinId].tier;
  if (def === undefined) return { wallet: {}, heroXp: 0, fragments: 0 };
  const scale = def.rewardBase * tier * 1.06 ** (room - 1) * (isBossRoom(ruinId, depth, room) ? 4 : 1);
  return {
    wallet: {
      Gold: Math.round(20 * scale),
      Stone: Math.round(3 * scale),
      // Prospecting and any timed boon ride on the Stardust line, the way
      // they always did: it is the collection's own faucet.
      Stardust: Math.round(resolve(state, 'stardustYield',
        techValue(state, 'stardustYield', 2 * scale))),
    },
    heroXp: Math.round(10 * scale),
    // Fragments are the collection's own drip, and only a boss carries them.
    fragments: isBossRoom(ruinId, depth, room) ? tier : 0,
  };
}

/** The squads a room fields, for the sheet that draws them before the fight.
 *  The board is the authority; this is the picture of it. */
export const roomFormation = (
  state: GameState, ruinId: RuinId, depth: number, room: number,
): EnemySquad[] => boardSquads(roomBoard(state, ruinId, depth, room));

export type RoomBlock =
  | 'RuinNotFound' | 'GateStanding' | 'Finished' | 'NoHero' | 'TooManyHeroes'
  | 'TooManySlots' | 'NotEnoughUnits' | 'NotEnoughSupplies'
  | 'ArtifactNotOwned' | 'ArtifactAttuned';

export function roomBlock(
  state: GameState,
  map: MapData,
  ruinId: RuinId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
  artifactId: ArtifactId | null = null,
): RoomBlock | null {
  if (fogState(state, map, RUINS[ruinId].location) !== 'Revealed') return 'RuinNotFound';
  // Nothing in the ruin can be entered until the gate is cleared: the
  // garrison is standing in the doorway (18-garrisons-and-raids.md §1).
  if (!gateIsCleared(state, ruinId)) return 'GateStanding';
  if (ruinIsFinished(state, ruinId)) return 'Finished';
  if (heroIds.length === 0 || heroIds.some((id) => !ownsHero(state, id))) return 'NoHero';
  if (heroIds.length > heroSlots(state)) return 'TooManyHeroes';
  const committed = slots.filter((s) => s.count > 0);
  if (committed.length > troopSlots()) return 'TooManySlots';
  const available = availableRoster(state);
  for (const s of committed) {
    if (s.count > available[s.unitId]) return 'NotEnoughUnits';
  }
  if (artifactId !== null) {
    if (!ownsArtifact(state, artifactId)) return 'ArtifactNotOwned';
    // Attune OR arm. Refusing here rather than silently un-attuning is the
    // point: the player gives up a passive they are living off to arm a hero,
    // so the sim must never make that choice on their behalf.
    if (isAttuned(state, artifactId)) return 'ArtifactAttuned';
  }
  const { depth } = frontier(state, ruinId);
  if (!canAfford(state.city.wallet, supplyCost(state, ruinId, depth, heroIds))) {
    return 'NotEnoughSupplies';
  }
  return null;
}

export interface RoomReport {
  result: 'Cleared' | 'Repelled' | RoomBlock;
  depth: number;
  room: number;
  attack: number;
  power: number;
  supplies: Wallet;
  /** THE FIGHT, tick by tick — what the battle screen replays. Null when the
   *  attempt was refused before anyone drew a weapon. */
  log: BattleLog | null;
  /** What the room paid. Empty on a repulse: a failed room grants nothing
   *  beyond what the fight itself cost (§5). */
  wallet: Wallet;
  /** Who did not come back. The enemy fights: a room costs soldiers whether
   *  it falls or not (combat.md §4). */
  losses: Array<{ unitId: UnitId; count: number }>;
  /** The share of them that reached the infirmary and can be healed back. */
  wounded: Array<{ unitId: UnitId; count: number }>;
  heroXp: number;
  fragments: number;
  /** Set when this room was the last of its depth. */
  depthCompleted: boolean;
  /** Set when the ruin's last room fell, and the relic came home with it. */
  artifact: ArtifactId | null;
}

/**
 * ENTER THE FRONTIER ROOM. The whole of an expedition, in one call.
 *
 * The fight resolves here and now — there is no journey to wait out, and
 * nothing is left in flight when this returns. Cleared: the room pays, the
 * frontier advances, and a depth that runs out opens the next one. Repelled:
 * the same room is still there.
 *
 * **Either way the fallen are gone.** Supplies and soldiers are what an
 * attempt costs; nothing the player already banked is ever taken.
 */
export function enterRoom(
  state: GameState,
  map: MapData,
  ruinId: RuinId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
  artifactId: ArtifactId | null = null,
): RoomReport {
  const at = frontier(state, ruinId);
  const empty: RoomReport = {
    result: 'Cleared', depth: at.depth, room: at.room, attack: 0,
    power: roomPower(ruinId, at.depth, at.room), log: null, supplies: {},
    losses: [], wounded: [],
    wallet: {}, heroXp: 0, fragments: 0, depthCompleted: false, artifact: null,
  };
  const block = roomBlock(state, map, ruinId, heroIds, slots, artifactId);
  if (block !== null) return { ...empty, result: block };

  const supplies = supplyCost(state, ruinId, at.depth, heroIds);
  pay(state.city.wallet, supplies);

  const committed = slots.filter((s) => s.count > 0).map((s) => ({ ...s }));
  const artifact: CarriedArtifact | null = artifactId === null
    ? null : { id: artifactId, level: artifactEntry(state, artifactId).level };
  const party = partyOf(state, committed, heroIds, artifact);
  const ours = partyBoard(party);
  const theirs = roomBoard(state, ruinId, at.depth, at.room);
  const power = boardPower(theirs);
  const attack = partyPower(party);
  const log = resolveBattle(ours, theirs);
  // What lives in the room swings back, win or lose — the same rule the gate
  // follows: some of the fallen reach the infirmary, the rest are gone for
  // good (combat.md §4).
  const { losses, wounded } = applyLosses(state, lossesFrom(log, ours));
  if (log.winner !== 'ours') {
    return { ...empty, result: 'Repelled', attack, power, log, supplies, losses, wounded };
  }

  // Cleared. The room pays into the wallets it belongs in, immediately: there
  // is no haul to carry home, so nothing can be lost on the way.
  const reward = roomReward(state, ruinId, at.depth, at.room);
  for (const [c, n] of Object.entries(reward.wallet)) {
    if (n <= 0) continue;
    if (c === 'Stardust') {
      addToWallet(state.kingdom.wallet, 'Stardust', n);
      recordResourceDiscovery(state, 'Stardust');
    } else addToWallet(state.city.wallet, c as keyof Wallet, n);
  }
  addHeroXp(state, reward.heroXp);
  if (reward.fragments > 0) addArtifactFragments(state, RUINS[ruinId].artifact, reward.fragments);

  const def = depthDef(ruinId, at.depth)!;
  const depthCompleted = at.room >= def.rooms;
  state.ruins[ruinId] = depthCompleted
    // The next depth opens the moment this one runs out. The Adventurers'
    // Guild is what gates it in the design (§3) and it is unbuilt, so
    // finishing is the only key there is today.
    ? { depth: at.depth + 1, cleared: 0 }
    : { depth: at.depth, cleared: at.room };
  state.deepestDepth = Math.max(state.deepestDepth, at.depth);

  let artifactWon: ArtifactId | null = null;
  if (ruinIsFinished(state, ruinId) && state.ruinsCleared[ruinId] !== true) {
    // The bottom: the relic is guaranteed on the first full clear. No
    // randomness on the thing that gates a system.
    state.ruinsCleared[ruinId] = true;
    artifactWon = RUINS[ruinId].artifact;
    grantArtifact(state, artifactWon, COLLECTION.fragmentsPerTierBase);
    // The recurring Gem faucet the design needs: one per ruin, once. Taking
    // a ruin to its bottom is the conquest, and it pays in the two currencies
    // the long game runs on.
    addToWallet(state.player.wallet, 'Gems', DELVE.firstClearGems);
    addToWallet(state.kingdom.wallet, 'Stardust', DELVE.firstClearStardust);
    addToWallet(state.kingdom.wallet, 'Knowledge', DELVE.firstClearKnowledge);
    recordResourceDiscovery(state, 'Knowledge');
  }

  return {
    result: 'Cleared',
    depth: at.depth,
    room: at.room,
    attack,
    power,
    log,
    supplies,
    losses,
    wounded,
    wallet: reward.wallet,
    heroXp: reward.heroXp,
    fragments: reward.fragments,
    depthCompleted,
    artifact: artifactWon,
  };
}

// -------------------------------------------------------------- the read-out

/** Everything the room sheet has to say BEFORE the player commits. */
export interface RoomPreview {
  ruinId: RuinId;
  depth: number;
  room: number;
  /** Rooms cleared in the whole ruin, and how many there are. */
  cleared: number;
  rooms: number;
  done: boolean;
  isBoss: boolean;
  /** What is standing in the room, and what it is worth. */
  enemy: EnemySquad[];
  power: number;
  /** The ruin's bias. A room's own draw is not shown: the gamble is
   *  information, and the Guild's scouting is what buys it (§3). */
  threat: UnitId | 'Any';
  attack: number;
  stats: { atk: number; def: number; hp: number };
  supplies: Wallet;
  reward: { wallet: Wallet; heroXp: number; fragments: number };
  /** True when the party out-powers the room ON PAPER. A shortfall warns and
   *  never blocks — and paper is all it is: the resolver decides the fight,
   *  and it counts things a sum cannot (Docs/features/combat.md §12). */
  enough: boolean;
}

export function previewRoom(
  state: GameState,
  ruinId: RuinId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
  artifactId: ArtifactId | null = null,
): RoomPreview {
  const at = frontier(state, ruinId);
  const committed = slots.filter((s) => s.count > 0);
  const artifact: CarriedArtifact | null = artifactId === null
    ? null : { id: artifactId, level: artifactEntry(state, artifactId).level };
  const party = partyOf(state, committed, heroIds, artifact);
  const affinity = RUINS[ruinId].affinity;
  const theirs = roomBoard(state, ruinId, at.depth, at.room);
  const power = boardPower(theirs);
  const attack = partyPower(party);
  return {
    ruinId,
    depth: at.depth,
    room: at.room,
    cleared: roomsCleared(state, ruinId),
    rooms: depthsOf(ruinId).reduce((sum, d) => sum + d.rooms, 0),
    done: at.done,
    isBoss: !at.done && isBossRoom(ruinId, at.depth, at.room),
    enemy: boardSquads(theirs),
    power,
    threat: affinity,
    attack,
    stats: partyStats(party),
    supplies: supplyCost(state, ruinId, at.depth, heroIds),
    reward: roomReward(state, ruinId, at.depth, at.room),
    enough: attack >= power,
  };
}

/** Ruins the player has actually found. */
export const discoveredRuins = (state: GameState, map: MapData): RuinId[] =>
  (Object.keys(RUINS) as RuinId[]).filter(
    (id) => fogState(state, map, RUINS[id].location) === 'Revealed',
  );

/** Relic art for a ruin's prize, for the room sheet. */
export const ruinPrize = (ruinId: RuinId): ArtifactId => ARTIFACTS[RUINS[ruinId].artifact].id;

/** A relic already carried by nobody: with no party underground, the only
 *  thing that keeps a relic out of a pack is the kingdom wearing it. */
export const artifactIsAway = (state: GameState, id: ArtifactId): boolean =>
  artifactIsCarried(state, id);
