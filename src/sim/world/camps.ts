// Monster camps, as the player reads them (Docs/features/19-world-map.md
// §5.4): what paying one off costs, and how hard it looks against what the
// player could field. Who has beaten which camp is the world server's.

import { roundPrice } from '../roundPrice';
import { COMBAT, HEROES, UNITS, WORLD_CAMPS } from '../data/definitions';
import { heroSlots } from '../heroes';
import { heroBody } from '../heroLadder';
import type { GameState, LairId, Wallet } from '../state';
import type { BoardHex } from './board';
import type { FogState } from './explorers';
import type { WorldSource } from './source';

/**
 * A camp's tribute: always dearer than the fight (19 §5.4). The fight's
 * price is the troops a winning army is reckoned to lose to it —
 * `tributeLossShare` of its power, in the plainest soldier's training cost —
 * and the tribute is `tributePremium` times that.
 */
export function campTribute(power: number): Wallet {
  const lost = (power * WORLD_CAMPS.tributeLossShare) / UNITS.Warrior.power;
  const out: Wallet = {};
  for (const [c, n] of Object.entries(UNITS.Warrior.recruitCost)) {
    out[c as keyof Wallet] = Math.max(1, roundPrice(Math.ceil((n as number) * lost * WORLD_CAMPS.tributePremium)));
  }
  return out;
}

/** Whether the player sees a camp on this hex: on ground they have
 *  explored, or in the mist unless it lurks there; never once they have
 *  beaten it, nor on ground somebody holds or is claiming (19 §5.4). */
export function campShown(source: WorldSource, bh: BoardHex, fog: FogState): boolean {
  if (bh.camp === null || fog === 'Unknown') return false;
  if (fog === 'Sensed' && bh.camp.lurking) return false;
  return source.hexOf(bh.index) === null && !source.campBeaten(bh.index);
}

/** The strongest party the player could send: every soldier at home, and
 *  as many of their best heroes as the board has hero slots. */
export function strongestParty(state: GameState): number {
  let power = 0;
  for (const u of state.army) power += UNITS[u.definitionId].power;
  const heroes = state.heroes.owned
    .map((id) => heroBody(HEROES[id], state.heroes.levels[id] ?? 1, state.heroes.ascension[id] ?? 0).dmg
      * COMBAT.heroPowerPerDmg)
    .sort((a, b) => b - a)
    .slice(0, heroSlots(state));
  for (const p of heroes) power += p;
  return Math.round(power);
}

export type CampDifficulty = 'Very easy' | 'Easy' | 'Fair' | 'Hard' | 'Deadly';

/** How hard a camp looks against the party the player could send. */
export function campDifficulty(campPower: number, partyPower: number): CampDifficulty {
  if (partyPower <= 0) return 'Deadly';
  const r = campPower / partyPower;
  if (r < 0.5) return 'Very easy';
  if (r < 0.8) return 'Easy';
  if (r < 1.1) return 'Fair';
  if (r < 1.6) return 'Hard';
  return 'Deadly';
}

/** The colour a difficulty is written in, from easy green to deadly red. */
export const DIFFICULTY_COLOR: Record<CampDifficulty, string> = {
  'Very easy': '#3d8b2f', Easy: '#6a9a24', Fair: '#c98a1a', Hard: '#c4502a', Deadly: '#a8231d',
};

/** What a camp's creatures are called: "A camp of Orcs". */
export const CAMP_CREATURE: Record<LairId, string> = {
  Orcs: 'Orcs', Harpies: 'Harpies', Goblins: 'Goblins', WolfRiders: 'Wolf-riders', Drake: 'a Drake',
};
