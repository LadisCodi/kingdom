// Technologies: one-time researches that unlock content. Cost Gold from the
// CITY purse + time; limited by concurrent SLOTS (base from Settings, more bought with
// Gems at an escalating price); tree edges via `requires`. Completion runs
// in real time through the unified advance (like the build queue).

import {
  DISTRICTS, RESEARCH_SETTINGS, TECHNOLOGIES, TECH_ORDER, TOMES, UNITS,
  tomeCoverPage,
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
 * A MINOR RANK unlocks nothing here, and that is correct: what it gives is its
 * own numeric effect, which the info panel reads off `effectPerRank`.
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
 * What a technology costs: Gold AND Knowledge, out of two purses.
 *
 * Gold is paid from `city.wallet` like everything else the city does, so the
 * tree keeps competing with clearing fog and raising a building for one
 * budget — the decision the economy is built around. Knowledge is paid from
 * `kingdom.wallet`: it is the research CLOCK (tomes-and-research.md §1), a
 * currency that drips from the ground you hold and buys nothing else, so a
 * rich city cannot skip an era. Neither alone works at this size — Gold can
 * size a tree but cannot pace it.
 *
 * Era 1 costs no Knowledge: the clock has not started yet, and the opening
 * runs on Gold and time exactly as it did before the clock existed.
 *
 * Minor ranks cost both too. What separates a minor from a major is how much,
 * and nothing else — the tree says "small" with money and a clock, which is
 * what a tree is already made of (tech-tree.md §1 rule 3).
 */
export const techCost = (id: TechId): number => getWallet(TECHNOLOGIES[id].cost, 'Gold');
export const techKnowledgeCost = (id: TechId): number =>
  getWallet(TECHNOLOGIES[id].cost, 'Knowledge');

const gold = (state: GameState): number => getWallet(state.city.wallet, 'Gold');
const knowledge = (state: GameState): number => getWallet(state.kingdom.wallet, 'Knowledge');

/** Could the player pay for this technology this second — both purses? */
export const canAffordTech = (state: GameState, id: TechId): boolean =>
  gold(state) >= techCost(id) && knowledge(state) >= techKnowledgeCost(id);

/**
 * How long until the kingdom can afford a technology's Knowledge, in ms —
 * 0 when it already can, Infinity when nothing is dripping. A trickle
 * currency without a time-to-afford line is a currency the player cannot plan
 * against (tomes-and-research.md §8), and this is that line's source.
 */
export function knowledgeShortfallMs(state: GameState, id: TechId, ratePerHour: number): number {
  const short = techKnowledgeCost(id) - knowledge(state);
  if (short <= 0) return 0;
  if (ratePerHour <= 0) return Infinity;
  return (short / ratePerHour) * 3_600_000;
}

export const isTechComplete = (state: GameState, id: TechId): boolean =>
  state.research.completed.includes(id);

export const isTechActive = (state: GameState, id: TechId): boolean =>
  state.research.active.some((a) => a.id === id);

/** All prerequisites researched? (The tree edge gate.) */
export const requirementsMet = (state: GameState, id: TechId): boolean =>
  TECHNOLOGIES[id].requires.every((req) => isTechComplete(state, req));

/** Concurrent research slots: Settings base + gem-bought extras. */
export const techSlots = (state: GameState): number =>
  Math.min(RESEARCH_SETTINGS.techSlots + state.research.slotsPurchased, RESEARCH_SETTINGS.maxSlots);

export type StartTechResult =
  | 'Started' | 'AlreadyDone' | 'AlreadyActive' | 'MissingRequirement'
  | 'NoFreeSlot' | 'NotEnoughResources';

/**
 * Could the player start this tech this second? Every gate `startTech` checks,
 * asked without doing it.
 *
 * It exists so the dot on a node and the CTA on the nav tab cannot drift from
 * what the button actually does — the failure mode being a lit tab that leads
 * to a screen where nothing is pressable.
 */
/**
 * A tome's cover page: granted when the book opens, never bought.
 *
 * It is the one technology with no price and no clock, and without this it
 * would be startable for nothing — which lit the Research tab on a fresh
 * kingdom with an empty purse, pointing at two books the player had not
 * earned yet.
 */
export const isGranted = (id: TechId): boolean =>
  techCost(id) === 0 && TECHNOLOGIES[id].durationSeconds === 0;

export const canStartTech = (state: GameState, id: TechId): boolean =>
  !isGranted(id)
  && !isTechComplete(state, id)
  && !isTechActive(state, id)
  && requirementsMet(state, id)
  && state.research.active.length < techSlots(state)
  && canAffordTech(state, id);

/** Anything at all worth a trip to the Research screen. */
export const anyResearchActionable = (state: GameState): boolean =>
  TECH_ORDER.some((id) => canStartTech(state, id));

export function startTech(state: GameState, id: TechId, now: number): StartTechResult {
  // A cover page is granted by an event in the world, so asking to research
  // one is asking for something that has not happened yet.
  if (isGranted(id)) return 'MissingRequirement';
  if (isTechComplete(state, id)) return 'AlreadyDone';
  if (isTechActive(state, id)) return 'AlreadyActive';
  if (!requirementsMet(state, id)) return 'MissingRequirement';
  if (state.research.active.length >= techSlots(state)) return 'NoFreeSlot';
  if (!canAffordTech(state, id)) return 'NotEnoughResources';
  addToWallet(state.city.wallet, 'Gold', -techCost(id));
  addToWallet(state.kingdom.wallet, 'Knowledge', -techKnowledgeCost(id));
  state.research.active.push({ id, startedAt: now });
  return 'Started';
}

export const techCompletesAt = (state: GameState, id: TechId): number | null => {
  const active = state.research.active.find((a) => a.id === id);
  return active === undefined
    ? null
    : active.startedAt + TECHNOLOGIES[id].durationSeconds * 1000;
};

/** Complete every active technology whose time is up (in completion order). */
export function advanceResearch(state: GameState, toTime: number): TechId[] {
  const due = state.research.active
    .map((a) => ({ id: a.id, at: techCompletesAt(state, a.id)! }))
    .filter((a) => a.at <= toTime)
    .sort((a, b) => a.at - b.at);
  for (const { id } of due) {
    state.research.completed.push(id);
    state.research.active = state.research.active.filter((a) => a.id !== id);
  }
  return due.map((d) => d.id);
}

// ----------------------------------------------------------------- tomes

/**
 * A tome is OPEN once its cover page is researched — and a cover page is
 * granted by an event in the world, never bought.
 *
 * Civics is granted at the new-game seed because it is the game. Magic is
 * granted on the first paid reveal and Warfare on the first discovered ruin
 * (Docs/features/tomes-and-research.md §5). Nothing in the tree is reachable
 * before its cover page, so this is the one gate that decides whether a book
 * exists for the player at all.
 */
export const isTomeOpen = (state: GameState, tome: TomeId): boolean =>
  isTechComplete(state, tomeCoverPage(tome));

/** Open a tome, if it is not open already. Idempotent: it is called from
 *  events that fire many times (every reveal, every fog recalculation) and
 *  must cost nothing after the first. */
export function openTome(state: GameState, tome: TomeId): boolean {
  const cover = tomeCoverPage(tome);
  if (isTechComplete(state, cover)) return false;
  state.research.completed.push(cover);
  return true;
}

/** The tomes the player can currently read. */
export const openTomes = (state: GameState): TomeId[] =>
  (Object.keys(TOMES) as TomeId[]).filter((t) => isTomeOpen(state, t));

// ------------------------------------------------------------- gem slots

/** Gems for the NEXT slot — escalates with each purchase. */
export const slotGemCost = (state: GameState): number =>
  Math.round(
    RESEARCH_SETTINGS.slotGemCostBase *
    RESEARCH_SETTINGS.slotGemCostGrowth ** state.research.slotsPurchased,
  );

export type BuySlotResult = 'Purchased' | 'AtMax' | 'NotEnoughGems';

export function buySlot(state: GameState): BuySlotResult {
  if (techSlots(state) >= RESEARCH_SETTINGS.maxSlots) return 'AtMax';
  const cost = slotGemCost(state);
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  state.research.slotsPurchased += 1;
  return 'Purchased';
}
