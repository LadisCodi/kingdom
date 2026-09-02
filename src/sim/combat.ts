// Combat: a SCORING PASS, not a simulation (Docs/features/expeditions.md §4).
//
// There is no battle screen and there never will be. Resolving a depth is one
// deterministic pass over the party:
//
//   ATK × the type chart  vs  the threat   → did you clear it?
//   the threat            vs  DEF          → damage, absorbed by party HP
//
// and HP does not regenerate between depths. That is the attrition, and it is
// what makes the risk curve EMERGENT rather than authored: the deeper you go
// the more worn the party, so danger rises visibly on a depleting bar instead
// of following a probability curve someone invented. It is also what earns DEF
// and HP their place — a pure power score would not need them.
//
// The type chart therefore does its work at COMPOSITION time, which is where
// the decision belongs in a management game. A tactical resolution would move
// the decision inside a fight — a different genre, and one that eats the
// thirty-minute session budget. The middle option is the worst of the three:
// simulating combat in detail without showing it means the player sees only
// win or lose and learns nothing from all that machinery.
//
// EVERYTHING HERE IS DETERMINISTIC. "A well-prepared run never fails" is not a
// slogan, it is a property: `guaranteedDepth` below computes exactly how far a
// party is safe, and the expedition sheet shows it before launch. The gamble
// is INFORMATION, not dice — you do not know the next depth's threat type
// until you commit to it.

import { ARMY, HEROES, RUINS, UNITS } from './data/definitions';
import type { HeroId, RuinId, UnitId } from './state';

/** X beats Y. Lancer → Cavalry → Archer → Warrior → Lancer. */
export const BEATS: Record<UnitId, UnitId> = {
  Lancer: 'Cavalry', // spears stop horses
  Cavalry: 'Archer', // horses run down bowmen
  Archer: 'Warrior', // arrows beat heavy infantry at range
  Warrior: 'Lancer', // shields close the gap on spears
};

/** What `attacker` scores against a depth whose threat is `threat`.
 *  'Any' is neutral — the Star Observatory answers to nothing in particular. */
export function typeMultiplier(attacker: UnitId, threat: UnitId | 'Any'): number {
  if (threat === 'Any') return 1;
  if (BEATS[attacker] === threat) return ARMY.typeAdvantage;
  if (BEATS[threat] === attacker) return ARMY.typeDisadvantage;
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

export interface Party {
  heroId: HeroId | null;
  slots: readonly PartySlot[];
}

export interface PartyStats {
  atk: number;
  def: number;
  hp: number;
}

/** Raw totals, before any matchup. */
export function partyStats(party: Party, heroLevel = 1): PartyStats {
  let atk = 0;
  let def = 0;
  let hp = 0;
  for (const slot of party.slots) {
    const u = UNITS[slot.unitId];
    atk += u.atk * slot.count;
    def += u.def * slot.count;
    hp += u.hp * slot.count;
  }
  if (party.heroId !== null) {
    const h = HEROES[party.heroId];
    atk += h.atk + h.atkPerLevel * (heroLevel - 1);
    def += h.def + h.defPerLevel * (heroLevel - 1);
    hp += h.hp + h.hpPerLevel * (heroLevel - 1);
  }
  return { atk: Math.round(atk), def: Math.round(def), hp: Math.round(hp) };
}

/** ATK after the matchup — the number that actually clears a depth. A hero
 *  carries a unit type of its own, so the hero choice feeds the same chart. */
export function effectiveAttack(party: Party, threat: UnitId | 'Any', heroLevel = 1): number {
  let atk = 0;
  for (const slot of party.slots) {
    atk += UNITS[slot.unitId].atk * slot.count * typeMultiplier(slot.unitId, threat);
  }
  if (party.heroId !== null) {
    const h = HEROES[party.heroId];
    atk += (h.atk + h.atkPerLevel * (heroLevel - 1)) * typeMultiplier(h.unitType, threat);
  }
  return Math.round(atk);
}

// ------------------------------------------------------------------ threats

/**
 * How strong depth `depth` is. The bottom depth is exactly the ruin's authored
 * difficulty and the first is a fraction of it, so "Tier III is clearable with
 * the right composition and not with the wrong one" is arithmetic rather than
 * a hope.
 */
export function threatStrength(ruinId: RuinId, depth: number): number {
  const ruin = RUINS[ruinId];
  const span = Math.max(1, ruin.maxDepth - 1);
  const t = Math.min(1, Math.max(0, (depth - 1) / span));
  const floor = ARMY.threatFloorFraction;
  return Math.max(1, Math.round(ruin.difficulty * (floor + (1 - floor) * t)));
}

/** How long depth `depth` takes. Time grows with depth INSIDE a run, not only
 *  across tiers — that is what makes "one more depth" a real escalation, and
 *  it naturally caps how far anyone pushes in one sitting. */
export function depthDurationMs(ruinId: RuinId, depth: number): number {
  const ruin = RUINS[ruinId];
  return Math.round(ruin.baseDepthSeconds * ruin.depthGrowth ** (depth - 1)) * 1000;
}

/** Seconds to clear every depth of a ruin, for the site card. */
export function fullClearSeconds(ruinId: RuinId): number {
  let total = 0;
  for (let d = 1; d <= RUINS[ruinId].maxDepth; d++) total += depthDurationMs(ruinId, d) / 1000;
  return total;
}

// --------------------------------------------------------------- resolution

export interface DepthOutcome {
  cleared: boolean;
  /** HP the depth took off the party, whether or not it was cleared. */
  damage: number;
  /** The party's ATK after the matchup, and what it had to beat. */
  attack: number;
  strength: number;
}

/**
 * Resolve one depth. Pure, total, and the ONLY place combat maths lives.
 *
 * Damage is what the threat gets past DEF; it always lands at least 1, so a
 * party can never be immortal at any depth — the deep push has to end
 * somewhere, and it should end because the bar ran out rather than because a
 * rule said so.
 */
export function resolveDepth(
  party: Party,
  ruinId: RuinId,
  depth: number,
  threat: UnitId | 'Any',
  heroLevel = 1,
): DepthOutcome {
  const strength = threatStrength(ruinId, depth);
  const attack = effectiveAttack(party, threat, heroLevel);
  const { def } = partyStats(party, heroLevel);
  const damage = Math.max(
    1,
    Math.round(strength * ARMY.damagePerStrength - def * ARMY.damageAbsorbedPerDefence),
  );
  return { cleared: attack >= strength, damage, attack, strength };
}

/**
 * The deepest depth this party is SAFE to reach — assuming the worst matchup
 * at every step, because the player does not know what is down there.
 *
 * This is the number the expedition sheet shows before launch, and it is what
 * makes "your economy decides how deep you go safely; everything past that is
 * a gamble you opt into" a promise rather than a slogan.
 */
export function guaranteedDepth(party: Party, ruinId: RuinId, heroLevel = 1): number {
  const ruin = RUINS[ruinId];
  let hp = partyStats(party, heroLevel).hp;
  if (hp <= 0) return 0;
  let safe = 0;
  for (let depth = 1; depth <= ruin.maxDepth; depth++) {
    // The worst case: whatever type this party answers WORST.
    const worst = worstThreatFor(party, ruin.affinity);
    const outcome = resolveDepth(party, ruinId, depth, worst, heroLevel);
    if (!outcome.cleared) break;
    hp -= outcome.damage;
    if (hp <= 0) break;
    safe = depth;
  }
  return safe;
}

/**
 * The threat type this party scores worst against.
 *
 * EVERY type is on the table, whatever the ruin's affinity. A ruin's affinity
 * dominates its depths without owning all of them — `rollThreat` weights the
 * draw toward it but can produce any of the four — so a "guaranteed" depth
 * computed against the affinity alone would be a guarantee the sim does not
 * actually make. Getting this wrong is the difference between "safe to depth
 * 9" and a party that dies at 6, which is precisely the promise the whole
 * design rests on.
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

/** How this party reads against a ruin's affinity, for the launch screen:
 *  1.5 is a strong answer, 0.75 is the wrong tool. */
export function matchupAgainst(party: Party, affinity: UnitId | 'Any'): number {
  if (affinity === 'Any') return 1;
  const plain = partyStats(party).atk;
  return plain === 0 ? 1 : effectiveAttack(party, affinity) / plain;
}
