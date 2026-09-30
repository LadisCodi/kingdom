// The heroes who arrive by STORY rather than by the banner
// (Docs/features/22-progression.md §6).
//
// A sweep, like `armLairs`: it runs at every boundary inside `advance()` and
// reads only standing facts about the kingdom, so a one-call replay and
// stepped ticking grant the same hero at the same boundary (invariant 1), and
// running it twice grants nothing twice — a hero is never lost, so "owned" is
// the whole of the record.

import { grantHero, ownsHeroId } from './heroes';
import type { GameState, HeroId } from './state';

/** Who arrives, and the fact that brings them. */
const ARRIVALS: ReadonlyArray<{ hero: HeroId; when: (state: GameState) => boolean }> = [
  // (The Warden is the kingdom's from the start — newGame — and steps
  // forward at the first lair; nothing shows her before it.)
  // Bess runs the Tavern, and comes with it.
  {
    hero: 'Cook',
    when: (state) => state.city.districts.some(
      (d) => d.definitionId === 'Tavern' && d.state === 'Built'),
  },
];

/** Grant every story hero whose moment has come. Returns who arrived. */
export function grantStoryHeroes(state: GameState): HeroId[] {
  const arrived: HeroId[] = [];
  for (const { hero, when } of ARRIVALS) {
    if (ownsHeroId(state, hero) || !when(state)) continue;
    grantHero(state, hero);
    arrived.push(hero);
  }
  return arrived;
}
