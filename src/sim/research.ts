// Technologies: one-time researches that unlock content
// (Docs/features/07-research.md §1). A technology costs Knowledge and Gold and
// takes no time. Knowledge is POURED in, on as many visits as it takes, and
// stays there; once it is full, paying the Gold completes the technology on
// the spot. There are no slots and nothing is ever under study, so research
// has no boundary source. Tree edges via `requires`.

import { watchtowerClaimed } from './landmarks';
import {
  DISTRICTS, ERA_UNLOCK_CELLS, TECHNOLOGIES, TECH_ORDER, TOMES, UNITS,
} from './data/definitions';
import {
  addToWallet, getWallet,
  type DistrictId, type GameState, type TechId, type TomeId, type UnitId,
} from './state';

/** Something a technology puts in the player's hands. */
export type Unlock =
  | { kind: 'district'; id: DistrictId }
  | { kind: 'districtLevel'; id: DistrictId; level: number }
  | { kind: 'unit'; id: UnitId };

/**
 * What researching `id` gives you — derived from the definitions, so it can
 * never drift from what the gates actually check.
 *
 * Used twice, and the second use is the point: the completion banners have
 * always announced this AFTER the fact, while the research screen could not
 * tell the player what a technology was FOR before they committed to it.
 * Same list, now available up front.
 *
 * Order is load-bearing for the banners — districts (with their per-level
 * gates interleaved, as authored) then units, matching the sequence players
 * already see.
 *
 * A BONUS unlocks nothing here, and that is correct: what it gives is the
 * numbers it moves, which the card reads off its own `effects`.
 */
export function techUnlocks(id: TechId): Unlock[] {
  const unlocks: Unlock[] = [];
  for (const def of Object.values(DISTRICTS)) {
    if (def.requiredTech === id) unlocks.push({ kind: 'district', id: def.id });
    const gatedLevel = def.requiredTechPerLevel.indexOf(id);
    // The list is 0-indexed by level−1, and a gate at index n unlocks n+2.
    if (gatedLevel !== -1) {
      unlocks.push({ kind: 'districtLevel', id: def.id, level: gatedLevel + 2 });
    }
  }
  for (const unit of Object.values(UNITS)) {
    if (unit.requiredTech === id) unlocks.push({ kind: 'unit', id: unit.id });
  }
  return unlocks;
}

/**
 * What a technology costs: Knowledge AND Gold, out of two purses.
 *
 * Knowledge comes from `kingdom.wallet` and is POURED in (below). Gold comes
 * from `city.wallet` like everything else the city does, and is paid once, at
 * the end, so the tree keeps competing with clearing fog and raising a
 * building for one budget. What separates a minor from a major is how much,
 * and nothing else.
 */
export const techCost = (id: TechId): number => getWallet(TECHNOLOGIES[id].cost, 'Gold');
export const techKnowledgeCost = (id: TechId): number =>
  getWallet(TECHNOLOGIES[id].cost, 'Knowledge');

const gold = (state: GameState): number => getWallet(state.city.wallet, 'Gold');
const knowledge = (state: GameState): number => getWallet(state.kingdom.wallet, 'Knowledge');

/** Knowledge already poured into a technology. */
export const techPoured = (state: GameState, id: TechId): number =>
  state.research.poured[id] ?? 0;

/** Knowledge a technology still needs. */
export const techKnowledgeMissing = (state: GameState, id: TechId): number =>
  Math.max(0, techKnowledgeCost(id) - techPoured(state, id));

/** Is every point of its Knowledge in? */
export const isTechFilled = (state: GameState, id: TechId): boolean =>
  techKnowledgeMissing(state, id) === 0;

export const isTechComplete = (state: GameState, id: TechId): boolean =>
  state.research.completed.includes(id);

/** Holds some Knowledge but is not researched yet. */
export const isTechStarted = (state: GameState, id: TechId): boolean =>
  !isTechComplete(state, id) && techPoured(state, id) > 0;

/** All prerequisites researched? (The tree edge gate.) */
export const requirementsMet = (state: GameState, id: TechId): boolean =>
  TECHNOLOGIES[id].requires.every((req) => isTechComplete(state, req));

// --------------------------------------------------------------- era gates

/**
 * How much of the region the player has actually uncovered.
 *
 * Paid reveals only — the cells a building merely *discovered* are ones the
 * player has seen, not ones they have opened, and the era bar is priced in
 * the second thing. It is the same TOTAL the `DiscoverCells` quest goal
 * follows, so the two never disagree about what exploring means.
 */
export const revealedCellCount = (state: GameState): number =>
  Object.keys(state.fog.revealed).length;

/**
 * Is a band of a book open?
 *
 * Era 1 opens with the book. Every band after it is a gate in the WORLD, not
 * a research (Docs/features/07-research.md §2.1): the page continues once
 * enough of the region has been opened up, so the tree paces on exploring
 * rather than on a keystone the player can buy while standing still. The
 * keystones are still there — they are ordinary technologies that each raise
 * a real dial — they just no longer hold the door.
 */
export const eraUnlocked = (state: GameState, tome: TomeId, era: number): boolean =>
  era <= 1 || revealedCellCount(state) >= ERA_UNLOCK_CELLS[tome][era];

/** Cells still to reveal before a band opens; 0 once it is open. */
export const eraShortfall = (state: GameState, tome: TomeId, era: number): number =>
  Math.max(0, (era <= 1 ? 0 : ERA_UNLOCK_CELLS[tome][era]) - revealedCellCount(state));

/** Is the band this technology sits in open? */
export const techEraUnlocked = (state: GameState, id: TechId): boolean =>
  eraUnlocked(state, TECHNOLOGIES[id].tome, TECHNOLOGIES[id].era);

export type ResearchRefusal =
  | 'AlreadyDone' | 'MissingRequirement' | 'EraLocked' | 'TomeClosed';

/**
 * Why a technology cannot be worked on at all, or null when it can.
 *
 * One answer for both verbs, pouring and researching, so the sheet says the
 * reason once for the whole row of buttons. A technology the tree editor left
 * off the page is not in the game.
 */
export function researchRefusal(state: GameState, id: TechId): ResearchRefusal | null {
  if (!TECHNOLOGIES[id].placed) return 'MissingRequirement';
  if (isTechComplete(state, id)) return 'AlreadyDone';
  if (!isTomeOpen(state, TECHNOLOGIES[id].tome as TomeId)) return 'TomeClosed';
  if (!requirementsMet(state, id)) return 'MissingRequirement';
  if (!techEraUnlocked(state, id)) return 'EraLocked';
  return null;
}

export type PourResult = ResearchRefusal | 'Poured' | 'AlreadyFull' | 'NothingHeld';

/**
 * Pour Knowledge from the bar into a technology: as much as the bar holds, up
 * to what it still needs, and at most `max` (the sheet's +1). Returns what was
 * poured with the verdict.
 */
export function pourKnowledge(
  state: GameState, id: TechId,
  /** At most this many points; absent, as many as the bar and the need allow. */
  max = Infinity,
): { result: PourResult; poured: number } {
  const refusal = researchRefusal(state, id);
  if (refusal !== null) return { result: refusal, poured: 0 };
  const missing = techKnowledgeMissing(state, id);
  if (missing === 0) return { result: 'AlreadyFull', poured: 0 };
  const amount = Math.min(missing, knowledge(state), Math.max(0, Math.floor(max)));
  if (amount <= 0) return { result: 'NothingHeld', poured: 0 };
  addToWallet(state.kingdom.wallet, 'Knowledge', -amount);
  state.research.poured[id] = techPoured(state, id) + amount;
  return { result: 'Poured', poured: amount };
}

export type ResearchResult = ResearchRefusal | 'Researched' | 'NotFilled' | 'NotEnoughGold';

/** Could the Gold be paid and the technology completed this second? */
export const canResearchTech = (state: GameState, id: TechId): boolean =>
  researchRefusal(state, id) === null && isTechFilled(state, id) && gold(state) >= techCost(id);

/**
 * Pay the Gold and complete the technology. Its Knowledge must be in.
 *
 * The pure half: `commands.ts#researchTech` wraps it with what a completion
 * does to the map and the purse (the Farsight sweep, a lump raise paid back).
 */
export function completeTech(state: GameState, id: TechId): ResearchResult {
  const refusal = researchRefusal(state, id);
  if (refusal !== null) return refusal;
  if (!isTechFilled(state, id)) return 'NotFilled';
  if (gold(state) < techCost(id)) return 'NotEnoughGold';
  addToWallet(state.city.wallet, 'Gold', -techCost(id));
  delete state.research.poured[id];
  state.research.completed.push(id);
  return 'Researched';
}

/**
 * Is there something to DO on this technology right now — research it, or
 * pour enough to fill it? The dot on a card and the Research tab's count read
 * this, so neither can light for a press that would do nothing useful.
 */
export const canStartTech = (state: GameState, id: TechId): boolean =>
  researchRefusal(state, id) === null
  && (isTechFilled(state, id)
    ? gold(state) >= techCost(id)
    : knowledge(state) >= techKnowledgeMissing(state, id));

/** Anything at all worth a trip to the Research screen. */
export const anyResearchActionable = (state: GameState): boolean =>
  TECH_ORDER.some((id) => canStartTech(state, id));

/** How many technologies can be acted on right now — the Research tab's count. */
export const researchActionableCount = (state: GameState): number =>
  TECH_ORDER.filter((id) => canStartTech(state, id)).length;

// ------------------------------------------------------------- the states

/**
 * Where a technology stands (Docs/plans/research-book.md §1). There is no
 * tree fog: every technology is on its page from the first minute, and this
 * is what varies.
 *
 * **locked** — a requirement is not researched, or its band is shut: drawn in
 * greyscale, its sheet shows only what it is and what it needs.
 * **progress** — it can be worked on: Knowledge poured into it, full or not.
 * **done** — researched.
 */
export type TechState = 'locked' | 'progress' | 'done';

export function techState(state: GameState, id: TechId): TechState {
  if (isTechComplete(state, id)) return 'done';
  return researchRefusal(state, id) === null ? 'progress' : 'locked';
}

// ----------------------------------------------------------------- tomes

/**
 * WHAT OPENS EACH BOOK (Docs/features/22-progression.md §4) — a fact about the
 * world, never a research, and one the kingdom can only gain, so a book once
 * open is open for ever.
 *
 * This is the one place a book's door is decided: the tree file says what is
 * IN a book; what makes it open is code, the way what makes a found book
 * *found* always was (CLAUDE.md, "Data or code?").
 *
 * `veteran` opens every door for a save made before the doors existed
 * (`state.tutorial.veteran`, sim/save.ts).
 */
export const TOME_OPENS: Record<TomeId, (state: GameState) => boolean> = {
  Civics: () => true,
  // The first lair DISCOVERED: the army is what answers it.
  Warfare: (state) => Object.keys(state.lairs).length > 0,
  // The first landmark CLAIMED: the old stones are where magic is felt.
  Magic: (state) => Object.values(state.landmarks.claimed).some((c) => c === true),
  // Found: a Tavern standing.
  Sagas: (state) => state.city.districts.some(
    (d) => d.definitionId === 'Tavern' && d.state === 'Built'),
  // Found: the Watchtower claimed.
  Atlas: (state) => watchtowerClaimed(state),
};

export const isTomeOpen = (state: GameState, tome: TomeId): boolean =>
  state.tutorial?.veteran === true || (TOME_OPENS[tome]?.(state) ?? false);

/** A found book is not on the shelf until it is found; a general one is, with
 *  a padlock (Docs/features/22-progression.md §3). */
export const isFoundTome = (tome: TomeId): boolean => tome === 'Sagas' || tome === 'Atlas';

export const openTomes = (state: GameState): TomeId[] =>
  (Object.keys(TOMES) as TomeId[]).filter((t) => isTomeOpen(state, t));

/** A book's key in `tutorial.seen`: it has been announced open. */
export const bookKey = (tome: TomeId): string => `book:${tome}`;

/**
 * Books that have opened and that nobody has announced yet — the twin of
 * `freshlyOpenDoors` (sim/doors.ts). Recording them is the caller's
 * (`markBookSeen`), so a book is announced once. A veteran kingdom has every
 * book open and none to announce.
 */
export const freshlyOpenBooks = (state: GameState): TomeId[] => {
  if (state.tutorial.veteran) return [];
  return (Object.keys(TOMES) as TomeId[]).filter((tome) =>
    state.tutorial.seen[bookKey(tome)] !== true && TOME_OPENS[tome](state));
};

/** Remember that a book has been announced open. */
export function markBookSeen(state: GameState, tome: TomeId): void {
  state.tutorial.seen[bookKey(tome)] = true;
}
