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
import { ownGoldPerMinute } from './population';
import { readyToCollect } from './storage';
import { townhall, type District, type GameState } from './state';

/** Every door the UI draws padlocked until it opens. */
export type DoorId =
  | 'research' | 'build' | 'heroes' | 'relics' | 'store' | 'world'
  | 'knowledge' | 'banner';

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
  // The market waits for a capital worth trading with.
  store: (state) => townhall(state).level >= 2,
  world: watchtowerClaimed,
};

/** What a padlocked door says when tapped: the one thing that opens it —
 *  and not what is behind it, which the padlock keeps a surprise. */
export const DOOR_HINT: Record<DoorId, string> = {
  research: 'Finish your first task to open this.',
  knowledge: 'Finish your first task to open this.',
  build: 'Gather some Wood to open this.',
  heroes: 'Build a Tavern to open this.',
  banner: 'Build a Tavern to open this.',
  relics: 'Clear a lair to open this.',
  store: 'Raise the Townhall to level 2 to open this.',
  world: 'Claim the Watchtower to open this.',
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

/** The First Morning is still being played: a new kingdom before `TaxDay`
 *  is claimed (Docs/features/23-tutorials.md §3). */
export const firstMorningOn = (state: GameState): boolean =>
  !state.tutorial.veteran && !questClaimed(state, 'TaxDay');

/**
 * Does this building show it is ready to collect — its bubble, and a tap that
 * collects rather than opens it? Its store's own rule (`readyToCollect`),
 * except that **the Townhall's own Gold stays quiet through the First
 * Morning**: one thing on screen asks for the player's attention at a time,
 * and a tap on the Townhall there is the beat that opens it. Its Gold still
 * piles up, and shows the moment the morning ends.
 */
export const showsCollect = (state: GameState, district: District): boolean =>
  readyToCollect(state, district) && !(ownGoldPerMinute(district) > 0 && firstMorningOn(state));
