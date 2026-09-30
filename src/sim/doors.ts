// THE DOORS OF THE UI (Docs/features/22-progression.md §3): which menu, tab
// or pill a kingdom has walked through yet, and what opens the ones it has
// not.
//
// Pure functions of the state, so the rule is testable and the screens only
// draw it. A door never shuts again: the first time its condition holds, the
// stage records it (`tutorial.seen['door:<id>']`) and it stays open even if
// the condition later fails — a season wiping the cards must not padlock
// Relics. A veteran kingdom (a save from before the doors) has every door
// open. The BOOKS are the sim's own doors, decided in `research.ts`.

import { QUESTS } from './data/definitions';
import { watchtowerClaimed } from './landmarks';
import type { GameState } from './state';

/** Every door the UI draws padlocked until it opens. */
export type DoorId =
  | 'research' | 'build' | 'heroes' | 'relics' | 'store' | 'world'
  | 'knowledge' | 'daily' | 'banner';

/** Has the chain reached this quest — is it active, or past? */
const questReached = (state: GameState, id: string): boolean => {
  const at = QUESTS.findIndex((q) => q.id === id);
  return at >= 0 && state.quests.index >= at;
};

/** …and has it been CLAIMED (the chain is past it)? */
const questClaimed = (state: GameState, id: string): boolean => {
  const at = QUESTS.findIndex((q) => q.id === id);
  return at >= 0 && state.quests.index > at;
};

const tavernStands = (state: GameState): boolean => state.city.districts.some(
  (d) => d.definitionId === 'Tavern' && d.state === 'Built');

/** What opens each door, as a fact about the kingdom. */
const OPENS: Record<DoorId, (state: GameState) => boolean> = {
  research: (state) => questReached(state, 'Woodcraft') || state.research.completed.length > 0,
  knowledge: (state) => questReached(state, 'Woodcraft') || state.research.completed.length > 0,
  build: (state) => questReached(state, 'ARoof')
    || state.city.districts.some((d) => d.definitionId !== 'Townhall'),
  heroes: tavernStands,
  banner: tavernStands,
  relics: (state) => state.collection.packs.length > 0
    || Object.values(state.collection.cards ?? {}).some((page) => (page ?? []).some((n) => n > 0))
    || state.collection.completed.length > 0,
  store: () => true,
  world: watchtowerClaimed,
  daily: (state) => questClaimed(state, 'TaxDay'),
};

/** What a padlocked door says when tapped: the one thing that opens it. */
export const DOOR_HINT: Record<DoorId, string> = {
  research: 'Finish your first task to open the books.',
  knowledge: 'Knowledge comes with the books.',
  build: 'Gather some Wood first.',
  heroes: 'Build a Tavern to call heroes.',
  banner: 'Build a Tavern to call heroes.',
  relics: 'Clear a lair to find your first cards.',
  store: '',
  world: 'Claim the Watchtower to see beyond the province.',
  daily: 'Finish the morning’s work first.',
};

/** The door's key in `tutorial.seen`. */
export const doorKey = (door: DoorId): string => `door:${door}`;

/** Is this door open — for good, once it has been? */
export const isDoorOpen = (state: GameState, door: DoorId): boolean =>
  state.tutorial.veteran
  || state.tutorial.seen[doorKey(door)] === true
  || OPENS[door](state);

/**
 * Doors whose condition has just come true and that nobody has seen open
 * yet — what the stage breaks a padlock on and introduces. Recording them is
 * the caller's (`markDoorSeen`), so a door is announced once.
 */
export const freshlyOpenDoors = (state: GameState): DoorId[] => {
  if (state.tutorial.veteran) return [];
  return (Object.keys(OPENS) as DoorId[]).filter((door) =>
    state.tutorial.seen[doorKey(door)] !== true && OPENS[door](state));
};

/** Remember that a door is open, so it never shuts. */
export function markDoorSeen(state: GameState, door: DoorId): void {
  state.tutorial.seen[doorKey(door)] = true;
}
