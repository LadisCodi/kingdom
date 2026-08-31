// Research: pay a one-time cost, wait out the duration (real time, like the
// build queue — not paused by the offline cap), unlock what it gates.
// One research runs at a time; completion happens in the unified advance.

import { RESEARCH } from './data/definitions';
import { addToWallet, getWallet, type CurrencyId, type GameState, type ResearchId } from './state';

export const isResearched = (state: GameState, id: ResearchId): boolean =>
  state.research.completed.includes(id);

export type StartResearchResult =
  | 'Started' | 'AlreadyDone' | 'AlreadyResearching' | 'NotEnoughResources';

export function startResearch(state: GameState, id: ResearchId, now: number): StartResearchResult {
  if (isResearched(state, id)) return 'AlreadyDone';
  if (state.research.active !== null) return 'AlreadyResearching';
  const cost = RESEARCH[id].cost;
  for (const [c, amount] of Object.entries(cost)) {
    if (getWallet(state.city.wallet, c as CurrencyId) < amount) return 'NotEnoughResources';
  }
  for (const [c, amount] of Object.entries(cost)) {
    addToWallet(state.city.wallet, c as CurrencyId, -amount);
  }
  state.research.active = { id, startedAt: now };
  return 'Started';
}

export const researchCompletesAt = (state: GameState): number | null =>
  state.research.active === null
    ? null
    : state.research.active.startedAt + RESEARCH[state.research.active.id].durationSeconds * 1000;

/** Complete the active research if its time is up; returns the finished id. */
export function advanceResearch(state: GameState, toTime: number): ResearchId | null {
  const completesAt = researchCompletesAt(state);
  if (completesAt === null || completesAt > toTime) return null;
  const id = state.research.active!.id;
  state.research.completed.push(id);
  state.research.active = null;
  return id;
}
