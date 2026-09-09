// What a party IS, before it fights (Docs/features/combat.md §4, §12).
//
// The fight itself moved out. `battle.ts` is the resolver — ticks, rows,
// frontage, targeting, an event stream — and this file is what it is handed:
// the shape of a party, the type chart both sides read, and the POWER
// ESTIMATE the screens print before anyone commits.
//
// The estimate and the outcome are deliberately two different numbers. A sum
// of `power_per_troop` is what a player can be shown and can compare; who
// actually wins depends on which rank stands in front, how many troops can
// reach at once, and what dies first — and a sheet that promised to know that
// in advance would be promising to make the fight pointless. The doc says it
// in one line: "This is an estimate; the resolver decides the outcome."
//
// The type chart still does its work at COMPOSITION time, which is where the
// decision belongs in a management game: the player picks WHICH TROOPS, and
// the resolver plays out what that choice was worth.

import type { UnitTag } from './data/definitions';
import { ARMY, COMBAT, HEROES, UNITS } from './data/definitions';
import type { HeroId, UnitId } from './state';

/** X beats Y. Lancer → Cavalry → Archer → Warrior → Lancer. */
export const BEATS: Record<UnitId, UnitId> = {
  Lancer: 'Cavalry', // spears stop horses
  Cavalry: 'Archer', // horses run down bowmen
  Archer: 'Warrior', // arrows beat heavy infantry at range
  Warrior: 'Lancer', // shields close the gap on spears
};

/** What `attacker` scores against a depth whose threat is `threat`.
 *  'Any' is neutral — the Star Observatory answers to nothing in particular. */
export function typeMultiplier(
  attacker: UnitId, threat: UnitId | 'Any', disadvantageOffset = 0,
): number {
  if (threat === 'Any') return 1;
  if (BEATS[attacker] === threat) return ARMY.typeAdvantage;
  // Manoeuvre softens the penalty, never past neutral: a bad matchup stays a
  // bad matchup, it just stops being a wasted trip.
  if (BEATS[threat] === attacker) return Math.min(1, ARMY.typeDisadvantage + disadvantageOffset);
  return 1;
}

/** One committed stack: a party SLOT holds a unit TYPE and every unit of it
 *  the player chose to send. Slots therefore limit COMPOSITION BREADTH, which
 *  is what makes the type chart interesting and what "coverage" means when a
 *  second hero arrives. */
export interface PartySlot {
  unitId: UnitId;
  count: number;
}

/**
 * What the kingdom's research adds to the soldiers it sends — the Warfare
 * lines Shield Wall, Fletching, Barding, Warhorns and Manoeuvre, resolved OUT
 * HERE by expeditions.ts and carried in on the Party, exactly the way the
 * hero's level travels. Combat stays pure: no GameState ever reaches this
 * module, so a fight can be replayed from its inputs alone.
 */
export interface Drill {
  /** Flat ATK per unit, by tag; `all` applies to every unit. */
  atk: Partial<Record<UnitTag, number>> & { all?: number };
  /** Flat DEF per unit, by tag; `all` applies to every unit. */
  def: Partial<Record<UnitTag, number>> & { all?: number };
  /** Added to the type-disadvantage multiplier (0.75 + 0.06 at Manoeuvre III). */
  disadvantageOffset: number;
}

export const NO_DRILL: Drill = { atk: {}, def: {}, disadvantageOffset: 0 };

/** The flat bonus a unit of these tags gets from a Drill's atk or def table. */
const drillFor = (table: Drill['atk'], tags: readonly UnitTag[]): number =>
  (table.all ?? 0) + tags.reduce((n, t) => n + (table[t] ?? 0), 0);

/**
 * A hero on the board, at the level it fights at.
 *
 * The LEVEL travels with the hero rather than being a parameter, because a
 * party fields several and they are rarely the same level. It also keeps
 * combat pure: a fight replays from its inputs, and the level is an input.
 */
export interface PartyHero {
  id: HeroId;
  level: number;
}

export interface Party {
  /** One per HERO SLOT, and at least one always — there is no fight without a
   *  hero (Docs/features/10-heroes.md §2.6). */
  heroes: readonly PartyHero[];
  slots: readonly PartySlot[];
  /** The kingdom's drill, resolved by the caller. Absent = none. */
  drill?: Drill;
}

export interface PartyStats {
  atk: number;
  def: number;
  hp: number;
}

/**
 * Raw totals, before any matchup.
 *
 * EVERY party-wide bonus belongs here and nowhere else. A trait applied after
 * the fact decorates the number the launch screen shows without changing the
 * number the sim fights with: a promise on the sheet the fight does not keep.
 * One function, one set of stats, every caller equal.
 */
export function partyStats(party: Party): PartyStats {
  let atk = 0;
  let def = 0;
  let hp = 0;
  const drill = party.drill ?? NO_DRILL;
  for (const slot of party.slots) {
    const u = UNITS[slot.unitId];
    atk += (u.dmg + drillFor(drill.atk, u.tags)) * slot.count;
    def += (u.def + drillFor(drill.def, u.tags)) * slot.count;
    hp += u.hp * slot.count;
  }
  for (const hero of party.heroes) {
    const h = HEROES[hero.id];
    atk += h.dmg + h.dmgPerLevel * (hero.level - 1);
    def += h.def + h.defPerLevel * (hero.level - 1);
    hp += h.hp + h.hpPerLevel * (hero.level - 1);
    // The Warden's trait is party-wide DEF, which reads to the player as "we
    // all stay standing longer" — so it multiplies the assembled party rather
    // than the hero's own line. Two Wardens multiply twice, the way two
    // heroes of one type stack everywhere else.
    if (h.trait === 'PartyDefence') def *= 1 + h.traitValue;
  }
  return { atk: Math.round(atk), def: Math.round(def), hp: Math.round(hp) };
}

/**
 * THE ESTIMATE (Docs/features/combat.md §12) — the number the launch screen
 * prints beside the room's own, and the bar at the top of the battle screen.
 *
 * It is a sum, and it is honest about being one: `power_per_troop` is a
 * scale, not a swing. What decides a fight is the resolver (`battle.ts`),
 * which cares about frontage, rows, cooldowns and the order things die in —
 * none of which a sum can express. So this is deliberately NOT `dmg`: a
 * Cavalry hits for 22 and is worth 7, and a party that reads stronger here
 * can still lose to a board that answers it.
 */
export function partyPower(party: Party): number {
  let power = 0;
  for (const slot of party.slots) power += UNITS[slot.unitId].power * slot.count;
  for (const hero of party.heroes) {
    const h = HEROES[hero.id];
    power += (h.dmg + h.dmgPerLevel * (hero.level - 1)) * COMBAT.heroPowerPerDmg;
  }
  return Math.round(power);
}

// -------------------------------------------------------- enemy formations

/** One enemy stack, the same shape as a party slot. */
export interface EnemySquad {
  unitId: UnitId;
  count: number;
}

/** What a formation is worth — and therefore what a party has to beat. */
export const formationPower = (squads: readonly EnemySquad[]): number =>
  squads.reduce((sum, s) => sum + UNITS[s.unitId].power * s.count, 0);
