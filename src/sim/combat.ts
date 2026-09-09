// Combat: a SCORING PASS, not a simulation (Docs/features/combat.md).
//
// One room is one fight and it resolves the instant the player enters it:
//
//   ATK × the type chart  vs  what the room fields  → cleared, or not
//
// and nothing carries out of it. No timer, no attrition, no journey — the
// decision the player makes is WHICH TROOPS, and it is made before they press
// the button (Docs/features/11-expeditions.md §5).
//
// The type chart therefore does its work at COMPOSITION time, which is where
// the decision belongs in a management game. A tactical resolution would move
// the decision inside a fight — a different genre, and one that eats the
// thirty-minute session budget. The middle option is the worst of the three:
// simulating combat in detail without showing it means the player sees only
// win or lose and learns nothing from all that machinery.
//
// EVERYTHING HERE IS DETERMINISTIC. Two identical parties in the same room
// always get the same answer, and the answer is knowable before committing:
// the room sheet shows the two numbers it compares.

import type { UnitTag } from './data/definitions';
import { ARMY, ARTIFACTS, HEROES, UNITS } from './data/definitions';
import type { ArtifactId, HeroId, UnitId } from './state';

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

/** The relic a hero carried down, at the level it went down AT. Combat stays
 *  pure — no `GameState` reaches this module — so the level is passed in the
 *  same way `heroLevel` is. */
export interface CarriedArtifact {
  id: ArtifactId;
  level: number;
}

/**
 * What the kingdom's research adds to the soldiers it sends — the Warfare
 * lines Shield Wall, Fletching, Barding, Warhorns and Manoeuvre, resolved OUT
 * HERE by expeditions.ts and carried in on the Party, exactly the way the
 * hero's level and the carried relic travel. Combat stays pure: no GameState
 * ever reaches this module, so a fight can be replayed from its inputs alone.
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
   *  hero (Docs/features/10-heroes.md §2.5). */
  heroes: readonly PartyHero[];
  slots: readonly PartySlot[];
  /** Carried into the delve, and therefore NOT attuned to the kingdom. */
  artifact?: CarriedArtifact | null;
  /** The kingdom's drill, resolved by the caller. Absent = none. */
  drill?: Drill;
}

/** A carried relic's contribution at its level. */
export function carriedStats(artifact: CarriedArtifact | null | undefined): PartyStats {
  if (!artifact) return { atk: 0, def: 0, hp: 0 };
  const c = ARTIFACTS[artifact.id].carried;
  const levels = artifact.level - 1;
  return {
    atk: c.atk + c.atkPerLevel * levels,
    def: c.def + c.defPerLevel * levels,
    hp: c.hp + c.hpPerLevel * levels,
  };
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
    atk += (u.atk + drillFor(drill.atk, u.tags)) * slot.count;
    def += (u.def + drillFor(drill.def, u.tags)) * slot.count;
    hp += u.hp * slot.count;
  }
  for (const hero of party.heroes) {
    const h = HEROES[hero.id];
    atk += h.atk + h.atkPerLevel * (hero.level - 1);
    def += h.def + h.defPerLevel * (hero.level - 1);
    hp += h.hp + h.hpPerLevel * (hero.level - 1);
    // The Warden's trait is party-wide DEF, which reads to the player as "we
    // all stay standing longer" — so it multiplies the assembled party rather
    // than the hero's own line. Two Wardens multiply twice, the way two
    // heroes of one type stack everywhere else.
    if (h.trait === 'PartyDefence') def *= 1 + h.traitValue;
  }
  // The relic rides on top of the party, INCLUDING past a party-wide trait —
  // the Warden shields the soldiers it commands, not the stone in its pack.
  const relic = carriedStats(party.artifact);
  atk += relic.atk;
  def += relic.def;
  hp += relic.hp;
  return { atk: Math.round(atk), def: Math.round(def), hp: Math.round(hp) };
}

/** ATK after the matchup — the number that actually clears a depth. A hero
 *  carries a unit type of its own, so the hero choice feeds the same chart. */
export function effectiveAttack(party: Party, threat: UnitId | 'Any'): number {
  const drill = party.drill ?? NO_DRILL;
  let atk = 0;
  for (const slot of party.slots) {
    const u = UNITS[slot.unitId];
    atk += (u.atk + drillFor(drill.atk, u.tags)) * slot.count
      * typeMultiplier(slot.unitId, threat, drill.disadvantageOffset);
  }
  // Every hero carries a type of its own, so a second hero is coverage of a
  // second matchup as well as a second body.
  for (const hero of party.heroes) {
    const h = HEROES[hero.id];
    atk += (h.atk + h.atkPerLevel * (hero.level - 1))
      * typeMultiplier(h.unitType, threat, drill.disadvantageOffset);
  }
  // A relic has no unit type, so its ATK is TYPE-NEUTRAL: it lands whole
  // whatever is down there. That is deliberate, and it is what a relic is FOR
  // — it is worth most in exactly the run where the matchup went against you,
  // which makes socketing one a real answer to uncertainty rather than a flat
  // power bump you would always take.
  atk += carriedStats(party.artifact).atk;
  return Math.round(atk);
}

// -------------------------------------------------------- enemy formations

/** One enemy stack, the same shape as a party slot. */
export interface EnemySquad {
  unitId: UnitId;
  count: number;
}

/**
 * What a power budget is standing there AS (Docs/features/combat.md §11).
 *
 * A named threat is one kind of creature in as many squads as the budget
 * fills; `Any` splits it evenly across the four, which is what makes a mixed
 * warband have no type answer. Whole troops, and never fewer than one: a
 * share too small for a single body still puts one there.
 *
 * THE FORMATION IS WHAT THE PARTY FIGHTS, not a picture of it — every caller
 * scores against `formationPower` of what it showed. A display derived from
 * one number while the fight used another is the fault this module's header
 * warns about: a promise on the sheet the descent does not keep.
 */
export function enemyFormation(power: number, threat: UnitId | 'Any'): EnemySquad[] {
  const types: UnitId[] = threat === 'Any' ? (Object.keys(BEATS) as UnitId[]) : [threat];
  const share = power / types.length;
  const squads: EnemySquad[] = [];
  for (const unitId of types) {
    const def = UNITS[unitId];
    let left = Math.max(1, Math.round(share / def.power));
    // A squad holds `squad_size` and no more, so a big budget spills into a
    // second squad of the same type rather than an impossible stack.
    while (left > 0) {
      const count = Math.min(def.squadSize, left);
      squads.push({ unitId, count });
      left -= count;
    }
  }
  return squads;
}

/** What a formation is worth — and therefore what a party has to beat. */
export const formationPower = (squads: readonly EnemySquad[]): number =>
  squads.reduce((sum, s) => sum + UNITS[s.unitId].power * s.count, 0);

// ------------------------------------------------------------------ rooms

/**
 * Resolve one ROOM. Pure, total, and the only place a fight's outcome is
 * decided until the tick resolver lands (Docs/features/combat.md).
 *
 * A room is one fight and it happens the INSTANT the player enters it: there
 * is no journey, no timer and no attrition carried anywhere. The party's
 * attack after the type chart against what the room fields, and that is the
 * whole of it (Docs/features/11-expeditions.md §5, §6).
 */
export interface RoomOutcome {
  cleared: boolean;
  /** The party's attack after the matchup, and what it had to beat. */
  attack: number;
  power: number;
}

export function resolveRoom(
  party: Party,
  power: number,
  threat: UnitId | 'Any',
): RoomOutcome {
  const attack = effectiveAttack(party, threat);
  return { cleared: attack >= power, attack, power };
}

/**
 * The threat type this party scores worst against.
 *
 * EVERY type is on the table, whatever the ruin's affinity: a room's threat
 * is drawn with a bias toward it and can be any of the four, so a promise
 * computed against the affinity alone would be one the sim does not make.
 */
export function worstThreatFor(party: Party, affinity: UnitId | 'Any'): UnitId | 'Any' {
  void affinity;
  const candidates: Array<UnitId | 'Any'> = Object.keys(BEATS) as UnitId[];
  let worst: UnitId | 'Any' = candidates[0];
  let lowest = Infinity;
  for (const c of candidates) {
    const score = effectiveAttack(party, c);
    if (score < lowest) {
      lowest = score;
      worst = c;
    }
  }
  return worst;
}

/**
 * How this party reads against a ruin's affinity, for the launch screen:
 * 1.5 is a strong answer, 0.75 is the wrong tool.
 *
 * The carried relic is deliberately EXCLUDED. This number answers "did I bring
 * the right troops", and a relic's ATK is type-neutral — so counting it would
 * pull the ratio toward 1 and socketing a relic would make a good matchup read
 * WORSE while the party got stronger. The relic's contribution is already
 * shown, honestly, in the safe depth and the stat deltas.
 */
export function matchupAgainst(party: Party, affinity: UnitId | 'Any'): number {
  if (affinity === 'Any') return 1;
  const troops: Party = { heroes: party.heroes, slots: party.slots };
  const plain = partyStats(troops).atk;
  return plain === 0 ? 1 : effectiveAttack(troops, affinity) / plain;
}
