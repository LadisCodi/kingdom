// Technologies: one-time researches that unlock content. Cost resources +
// time; limited by concurrent SLOTS (base from Settings, more bought with
// Gems at an escalating price); tree edges via `requires`. Completion runs
// in real time through the unified advance (like the build queue).

import { RESEARCH_SETTINGS, TECHNOLOGIES } from './data/definitions';
import { addToWallet, getWallet, type GameState, type TechId } from './state';
import { canAfford, pay } from './wallet';

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

export function startTech(state: GameState, id: TechId, now: number): StartTechResult {
  if (isTechComplete(state, id)) return 'AlreadyDone';
  if (isTechActive(state, id)) return 'AlreadyActive';
  if (!requirementsMet(state, id)) return 'MissingRequirement';
  if (state.research.active.length >= techSlots(state)) return 'NoFreeSlot';
  const cost = TECHNOLOGIES[id].cost;
  if (!canAfford(state.city.wallet, cost)) return 'NotEnoughResources';
  pay(state.city.wallet, cost);
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
