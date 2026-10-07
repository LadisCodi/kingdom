// Lairs: the party and the fight (Docs/proposals/lairs.md §1, §5).
//
// A lair is one garrison, one fight, cleared once. Nothing here is ever in
// flight, so `advance()` has no boundary in this module at all.
//
// What is left is the PARTY — what it costs to send and what it is worth —
// and the one command that spends it: the lair attack.

import { roundPrice } from './roundPrice';
import { heroCanFight, heroHp, setHeroHp } from './heroHealth';
import { COMBAT, HEROES, PARTY, LAIRS, RELIC_RULES, UNITS, garrisonForTier } from './data/definitions';
import { dropFragments, openRelicDoor, type FragmentDrop } from './relics';
import { addHeroXp, heroSlots, skillRank } from './heroes';
import { slotSkill, spoilsOf } from './skills';
import { heroBody } from './heroLadder';
import {
  NO_DRILL, partyPower, partyStats,
  type EnemySquad, type Party, type PartySlot, type Drill,
} from './combat';
import {
  boardPower, buildBoard, poolsAfter, resolveBattle, survivorsOf,
  type Board, type BattleLog, type FighterSpec, type SquadSpec,
} from './battle';
import { applyLosses, availableRoster, woundedShareFor } from './army';
import { lairBoard, lairIsCleared, markLairCleared, markLairDefeated } from './lairs';
import { fightMana } from './world/fights';
import { firstClearLump, payKnowledge } from './knowledge';
import type { MapData } from './grid';
import { resolve } from './modifiers';
import { isTechComplete } from './research';
import { techMultiplier, techPctAimed, techTotals } from './techEffects';
import type { GameState, HeroId, ItemId, LairId, UnitId, Wallet } from './state';
import { grantItem } from './bag';
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
 * What ONE lair attack costs: the Mana every attack spends
 * (`combat.fightMana`, 08 §1), paid on entry and never refunded, win or lose
 * — so an attempt is a decision with a price rather than a free retry.
 */
export function lairSupplyCost(
  state: GameState, _lairId: LairId, _heroIds: readonly HeroId[],
): Wallet {
  const mana = fightMana(state);
  return mana > 0 ? { Mana: mana } : {};
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
    // The modifier stack's half is FLAT (a relic's +2 ATK); the tree's is a
    // PERCENT of the unit's own number, so a rank is worth the same share of
    // a Warrior and of a Cavalry and never goes stale.
    atk: { all: Math.round(resolve(state, 'unitAtk', 0)) },
    def: { all: Math.round(resolve(state, 'unitDef', 0)) },
    atkPct: pctByTag(state, 'unitAtk'),
    defPct: pctByTag(state, 'unitDef'),
    disadvantageOffset: Math.max(0, resolve(state, 'typeDisadvantage', 0)
      + (isTechComplete(state, 'Tactics') ? 0.10 : 0)), // reading the ground
    // A MULTIPLIER, floored at the identity: nothing in the game may make the
    // kingdom's own troops frailer than the sheet says.
    hpMult: Math.max(1, resolve(state, 'unitHp', techMultiplier(state, 'unitHp'))),
  };
}

/** The tree's percent on one stat, unaimed under `all` and aimed per tag —
 *  exact-match, so a Cavalry reading `all` plus its two tags counts each
 *  effect once (`techPctAimed`). */
const pctByTag = (state: GameState, stat: 'unitAtk' | 'unitDef'): Drill['atkPct'] => ({
  all: techTotals(state, stat).pct,
  Melee: techPctAimed(state, stat, { unitTag: 'Melee' }),
  Distance: techPctAimed(state, stat, { unitTag: 'Distance' }),
  Mounted: techPctAimed(state, stat, { unitTag: 'Mounted' }),
});

/**
 * A Party as combat sees it, with the kingdom's drill attached and every hero
 * resolved to the level it fights at. The one place a Party is assembled, so
 * no launch or preview can forget either.
 */
export const partyOf = (
  state: GameState, slots: readonly PartySlot[], heroIds: readonly HeroId[] = [],
  t: number = state.lastAdvance,
): Party => ({
  // Each hero walks in with what the last fight left it (sim/heroHealth.ts).
  heroes: heroIds.map((id) => ({
    id, level: heroLevel(state, id), ascension: state.heroes.ascension[id] ?? 0, hp: heroHp(state, id, t),
    skillRank: skillRank(state, id),
  })),
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
    const body = heroBody(def, h.level, h.ascension);
    return {
      id: h.id,
      name: def.name,
      type: def.unitType,
      atk: body.atk,
      dmg: body.dmg,
      def: body.def,
      hp: body.hp,
      hpNow: h.hp,
      cooldown: def.cooldown,
      power: Math.round(body.dmg * COMBAT.heroPowerPerDmg),
      troopDmgMult: def.troopDmgMult,
      troopHpMult: def.troopHpMult,
      troopDefBonus: def.troopDefBonus,
      skill: slotSkill(def.skill, h.skillRank ?? 1),
    };
  });
  const bonus = {
    dmg: (unitId: UnitId) => drillFlat(drill.atk, UNITS[unitId].tags)
      + UNITS[unitId].dmg * drillFlat(drill.atkPct ?? {}, UNITS[unitId].tags),
    def: (unitId: UnitId) => drillFlat(drill.def, UNITS[unitId].tags)
      + UNITS[unitId].def * drillFlat(drill.defPct ?? {}, UNITS[unitId].tags),
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

// -------------------------------------------------------------- the lair

/**
 * A lair is one fight, nothing behind it
 * (Docs/proposals/lairs.md §5).
 *
 * It lives here rather than in `lairs.ts` because clearing one is a PARTY
 * command — a hero, a matchup and supplies — and this module already owns all
 * three. `lairs.ts` owns the clock and the hoard, and knows nothing about how
 * a garrison is beaten.
 *
 * Two things make it the right first fight. The threat is in VIEW — no
 * scouting, no hidden type — and the party may be soldiers alone, so the very
 * first battle needs no hero. A shortfall warns rather than blocks, and
 * a retry is identical to a first attempt: nothing is lost but the supplies.
 */
export type LairBlock =
  | 'LairNotFound' | 'AlreadyCleared' | 'AlreadyDefeated' | 'EmptyParty' | 'NoSoldiers' | 'NoHero' | 'TooManyHeroes'
  | 'TooManySlots'
  | 'NotEnoughUnits' | 'NotEnoughSupplies' | 'HeroDown';

export function lairBlock(
  state: GameState,
  // Unread since a lair is found by its clock rather than by the fog over
  // its cell; kept so the fight's two entry points keep one signature.
  _map: MapData,
  lairId: LairId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
  t: number = state.lastAdvance,
): LairBlock | null {
  // Found, not revealed: a lair can be attacked the moment it has a clock,
  // whatever the fog over its own footprint (Docs/proposals/lairs.md §2.1).
  if (state.lairs[lairId] === undefined) return 'LairNotFound';
  if (lairIsCleared(state, lairId)) return 'AlreadyCleared';
  // Beaten, and waiting for its reward to be claimed: there is nobody left
  // to fight (Docs/proposals/lairs.md §5).
  if (state.lairs[lairId]?.defeated === true) return 'AlreadyDefeated';
  if (heroIds.some((id) => !ownsHero(state, id))) return 'NoHero';
  if (heroIds.length > heroSlots(state)) return 'TooManyHeroes';
  // A hero the last fight left with nothing has to get some of it back first.
  if (heroIds.some((id) => !heroCanFight(state, id, t))) return 'HeroDown';
  // NO 'HeroBusy'. A lair resolves on ENTRY, so a hero is never busy for it
  // (Docs/features/10-heroes.md §2.6).
  // A LAIR WANTS SOLDIERS (18-garrisons-and-raids.md): soldiers alone, or
  // soldiers with heroes — never a hero alone, who would hold a garrison off
  // on its defence and win the slow way.
  const committed = slots.filter((s) => s.count > 0);
  if (heroIds.length === 0 && committed.length === 0) return 'EmptyParty';
  if (committed.length === 0) return 'NoSoldiers';
  if (committed.length > troopSlots()) return 'TooManySlots';
  const available = availableRoster(state);
  for (const s of committed) {
    if (s.count > available[s.unitId]) return 'NotEnoughUnits';
  }
  // No cap check: the army cap bounds what the city OWNS
  // (Docs/features/combat.md §14), and a party is drawn from what it owns —
  // so `NotEnoughUnits` above is the only ceiling a composition can hit.
  if (!canAfford(state.city.wallet, lairSupplyCost(state, lairId, heroIds))) return 'NotEnoughSupplies';
  return null;
}

export interface LairReport {
  result: 'Cleared' | 'Repelled' | LairBlock;
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
   *  any clear after the first (there is none today: a cleared lair refuses). */
  knowledge: number;
  supplies: Wallet;
  /** Who did not come back. A garrison fights: it costs soldiers whether it
   *  falls or not (§5). */
  losses: Array<{ unitId: UnitId; count: number }>;
  /** The share of them that reached the infirmary and can be healed back. */
  wounded: Array<{ unitId: UnitId; count: number }>;
  /** What each hero came home with, and its full HP: the wound it carries
   *  into the next fight (sim/heroHealth.ts). */
  heroes: Array<{ id: HeroId; hp: number; max: number }>;
}

/**
 * One attempt on a lair, resolved on entry with the player attacking.
 *
 * Win: the garrison is beaten — its clock stops and it raids no more — but
 * NOTHING is paid yet: the lair stays on the map, holding its ground, until
 * the player claims its reward from its card (`claimLair`,
 * Docs/proposals/lairs.md §5). Lose: the supplies are gone and the lair
 * stands — no cooldown, no second timer. Casualties either way.
 */
export function attackLair(
  state: GameState,
  map: MapData,
  lairId: LairId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
  t: number = state.lastAdvance,
): LairReport {
  const theirs = lairBoard(state, lairId);
  const power = boardPower(theirs);
  const supplies = lairSupplyCost(state, lairId, heroIds);
  const block = lairBlock(state, map, lairId, heroIds, slots, t);
  if (block !== null) {
    return {
      result: block, attack: 0, power, log: null, hoard: {}, knowledge: 0, supplies,
      losses: [], wounded: [], heroes: [],
    };
  }
  pay(state.city.wallet, supplies);
  const committed = slots.filter((s) => s.count > 0).map((s) => ({ ...s }));
  const party = partyOf(state, committed, heroIds, t);
  const ours = partyBoard(party);
  const attack = partyPower(party);
  const log = resolveBattle(ours, theirs);
  // Win or lose, every hero keeps what the fight did to it.
  const heroes = heroesAfter(log, ours);
  for (const h of heroes) setHeroHp(state, h.id, h.hp, t);
  // The garrison swings back either way, and who fell is read straight off
  // the fight: some are carried home to the infirmary, the rest are gone.
  const { losses, wounded } = applyLosses(
    state, lossesFrom(log, ours), woundedShareFor(state, heroIds));
  if (log.winner !== 'ours') {
    return {
      result: 'Repelled', attack, power, log, hoard: {}, knowledge: 0, supplies, losses, wounded, heroes,
    };
  }
  markLairDefeated(state, lairId);
  // THE SPOILS (sim/skills.ts): Plunder swells the hoard now, Lore and
  // Seasoned ride on the claim.
  const spoils = spoilsOf(ours.slots);
  const lair = state.lairs[lairId]!;
  if (spoils.plunder > 0) {
    for (const [c, n] of Object.entries(lair.hoard) as Array<[keyof Wallet, number]>) {
      lair.hoard[c] = Math.round(n * (1 + spoils.plunder));
    }
  }
  if (spoils.lore > 0 || spoils.seasoned > 0) lair.spoils = { lore: spoils.lore, seasoned: spoils.seasoned };
  // What the claim will pay, for the report — nothing has moved yet.
  const hoard: Wallet = { ...lair.hoard };
  const { knowledge } = lairClearReward(state, lairId);
  return { result: 'Cleared', attack, power, log, hoard, knowledge, supplies, losses, wounded, heroes };
}

/** What each hero on our board has left when the fight ends: what it walked
 *  in with, less every blow that landed on it, back up with every heal. */
function heroesAfter(log: BattleLog, board: Board): Array<{ id: HeroId; hp: number; max: number }> {
  const pools = poolsAfter(log, 'ours');
  return board.slots
    .filter((s) => s.kind === 'hero' && s.fighterId !== null)
    .map((s) => ({
      id: s.fighterId as HeroId,
      hp: pools.get(s.id) ?? s.hpPool,
      max: s.hpUnit,
    }));
}

export type ClaimResult = 'Claimed' | 'NotDefeated' | 'AlreadyClaimed';

export interface ClaimReport {
  result: ClaimResult;
  hoard: Wallet;
  heroXp: number;
  knowledge: number;
  /** What it put in the Bag. */
  items: Partial<Record<ItemId, number>>;
  /** Relic fragments: the lair's door first, then its tier's drop. */
  fragments: FragmentDrop[];
}

/**
 * CLAIM a beaten lair's reward: the hoard it carried, Hero XP by tier and
 * the first-clear Knowledge lump — and with it the lair is gone and its
 * ground is the city's (Docs/proposals/lairs.md §5). Once per lair: a
 * claimed lair refuses, and so does one whose garrison still stands.
 */
export function claimLair(state: GameState, lairId: LairId): ClaimReport {
  const lair = state.lairs[lairId];
  const none = { hoard: {}, heroXp: 0, knowledge: 0, items: {}, fragments: [] };
  if (lair?.cleared === true) return { result: 'AlreadyClaimed', ...none };
  if (lair?.defeated !== true) return { result: 'NotDefeated', ...none };
  const { heroXp, knowledge } = lairClearReward(state, lairId);
  const hoard = markLairCleared(state, lairId);
  addHeroXp(state, heroXp);
  payKnowledge(state, knowledge);
  const items = { ...garrisonForTier(LAIRS[lairId].tier).rewardItems };
  for (const [id, n] of Object.entries(items) as Array<[ItemId, number]>) grantItem(state, id, n);
  // A lair is a city relic's door: its prize hands over that relic's first
  // fragment, then the tier's share of the relics met (relic-restoration.md §2).
  const tier = LAIRS[lairId].tier;
  const fragments = [
    ...openRelicDoor(state, lairId),
    ...dropFragments(state, 'city', RELIC_RULES.perLairTier[tier - 1] ?? 0, ['lair', lairId]),
  ];
  return { result: 'Claimed', hoard, heroXp, knowledge, items, fragments };
}

/**
 * What beating a lair pays on top of its hoard (Docs/proposals/lairs.md §5),
 * for the card that shows it before the fight and the fight that pays it.
 *
 * Hero XP by tier (`garrisons.heroXp`): the fight taught the party something
 * whether or not the garrison was holding anything, and a tier-5 lair teaches
 * far more than the orcs' — a lair is a one-off, and the early ones are what
 * carry a first party up its first levels. And the first-clear Knowledge lump — once per lair for the life of
 * the kingdom, since `lairBlock` refuses a cleared one; Conquest, Vigils and
 * Sanctified Ruins ride on it (sim/knowledge.ts).
 */
export const lairClearReward = (
  state: GameState, lairId: LairId,
): { heroXp: number; knowledge: number } => {
  const spoils = state.lairs[lairId]?.spoils;
  return {
    heroXp: roundPrice(garrisonForTier(LAIRS[lairId].tier).heroXp * (1 + (spoils?.seasoned ?? 0))),
    knowledge: Math.round(firstClearLump(state) * (1 + (spoils?.lore ?? 0))),
  };
};

/** What the lair sheet shows before the player commits: the threat is always
 *  visible on a lair, so this hides nothing. */
export interface LairPreview {
  lairId: LairId;
  threat: UnitId | 'Any';
  /** The squads in the doorway, and what they are worth. */
  enemy: EnemySquad[];
  power: number;
  attack: number;
  stats: { atk: number; def: number; hp: number };
  supplies: Wallet;
  /** The first-clear Knowledge lump a win would pay, at today's prices. */
  knowledge: number;
  /** Soldiers who would fall — the price the screen states before it is
   *  paid (Docs/features/18-garrisons-and-raids.md §5). The resolver has no
   *  randomness, so this is the fight's own answer, not a guess; the
   *  infirmary's share of it comes back at a hall. 0 with nobody sent. */
  fallen: number;
  /** True when the party already beats the lair ON PAPER. A shortfall warns,
   *  it never blocks — and the paper is an estimate now, so a party that
   *  reads short can still win the fight and one that reads long can lose it
   *  (Docs/features/combat.md §12). */
  enough: boolean;
}

export function previewLair(
  state: GameState,
  lairId: LairId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
  t: number = state.lastAdvance,
): LairPreview {
  const guard = LAIRS[lairId].guard;
  const committed = slots.filter((s) => s.count > 0);
  const party = partyOf(state, committed, heroIds, t);
  const theirs = lairBoard(state, lairId);
  const attack = partyPower(party);
  const power = boardPower(theirs);
  // The same fight `attackLair` would run, on the same boards. Cheap — a
  // board is nine slots and a fight a few hundred ticks — and it is what lets
  // the screen say what the attack costs before the button is pressed.
  let fallen = 0;
  if (heroIds.length > 0 || committed.length > 0) {
    const ours = partyBoard(party);
    fallen = lossesFrom(resolveBattle(ours, theirs), ours).reduce((n, l) => n + l.count, 0);
  }
  return {
    lairId,
    threat: guard.threat,
    enemy: boardSquads(theirs),
    power,
    attack,
    stats: partyStats(party),
    supplies: lairSupplyCost(state, lairId, heroIds),
    knowledge: firstClearLump(state),
    fallen,
    enough: attack >= power,
  };
}
