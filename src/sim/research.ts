// Technologies: one-time researches that unlock content
// (Docs/features/07-research.md §1). A technology costs Knowledge and Gold and
// takes no time. Knowledge is POURED in, on as many visits as it takes, and
// stays there; once it is full, paying the Gold completes the technology on
// the spot. There are no slots and nothing is ever under study, so research
// has no boundary source. Tree edges via `requires`.

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
 * the second thing. It is the same count the `DiscoverCells` quest goal
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
  | 'AlreadyDone' | 'MissingRequirement' | 'EraLocked';

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
  if (!requirementsMet(state, id)) return 'MissingRequirement';
  if (!techEraUnlocked(state, id)) return 'EraLocked';
  return null;
}

export type PourResult = ResearchRefusal | 'Poured' | 'AlreadyFull' | 'NothingHeld';

/**
 * Pour what the bar holds into a technology, up to what it still needs.
 * Returns what was poured with the verdict.
 */
export function pourKnowledge(state: GameState, id: TechId): { result: PourResult; poured: number } {
  const refusal = researchRefusal(state, id);
  if (refusal !== null) return { result: refusal, poured: 0 };
  const missing = techKnowledgeMissing(state, id);
  if (missing === 0) return { result: 'AlreadyFull', poured: 0 };
  const amount = Math.min(missing, knowledge(state));
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

// ------------------------------------------------------------- tree fog

/**
 * How much of a technology the page shows
 * ([`Docs/features/07-research.md`](../../Docs/features/07-research.md) §5.2).
 *
 * A fact about the TREE rather than about pixels, which is why it lives here
 * and not in the screen that draws it: the screen turns `silhouette` into a
 * dashed `?` and `hidden` into nothing, and that is all it decides.
 */
export type TechVisibility = 'normal' | 'silhouette' | 'hidden';

/**
 * **normal** — researched, partly poured, or pourable right now.
 * **silhouette** — every prerequisite is NORMAL, so what comes next appears as
 * soon as the card before it can be read. Waiting until the player had
 * committed to the step before meant a tree nobody could plan a route through:
 * the next `?` only ever appeared once you had already paid.
 * **hidden** — everything else.
 *
 * ONE step deep. A silhouette does not reveal its own children, so the far end
 * of a book stays a promise and the frontier stays a legible edge rather than
 * the whole page at half opacity.
 */
export function techVisibility(state: GameState, id: TechId): TechVisibility {
  // Not recursive, deliberately: `revealed` IS the `normal` test, and asking
  // it of the requirements is the one step.
  const revealed = (t: TechId): boolean =>
    isTechComplete(state, t) || isTechStarted(state, t) || requirementsMet(state, t);
  if (revealed(id)) return 'normal';
  if (TECHNOLOGIES[id].requires.every(revealed)) return 'silhouette';
  return 'hidden';
}

// ----------------------------------------------------------------- tomes

/**
 * A tome is OPEN once its cover page is researched — and a cover page is
 * granted by an event in the world, never bought.
 *
 * Civics is granted at the new-game seed because it is the game. Magic is
 * granted on the first paid reveal and Warfare on the first discovered ruin
 * (Docs/features/07-research.md §2). Nothing in the tree is reachable
 * before its cover page, so this is the one gate that decides whether a book
 * exists for the player at all.
 */
/**
 * Every book is open, always.
 *
 * Opening one used to be a TECHNOLOGY — a free, instant cover page granted by
 * an event in the world (the first paid reveal for Magic, the first ruin in
 * sight for Warfare) and by `newGame` for Civics. The card existed only to be
 * the marker, so the three of them were free clicks that did nothing, and the
 * era bars already pace a book by what the player has revealed. So the marker
 * is gone and the shelf shows three tabs from the first minute.
 *
 * Kept as a function rather than deleted at the call sites: a book that is
 * shut is a real thing to want back (a fourth tome bought with Gems, a
 * seasonal book), and this is the one place it would go.
 */
export const isTomeOpen = (_state: GameState, _tome: TomeId): boolean => true;

export const openTomes = (state: GameState): TomeId[] =>
  (Object.keys(TOMES) as TomeId[]).filter((t) => isTomeOpen(state, t));
