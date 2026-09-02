// Technologies: one-time researches that unlock content. Cost resources +
// time; limited by concurrent SLOTS (base from Settings, more bought with
// Gems at an escalating price); tree edges via `requires`. Completion runs
// in real time through the unified advance (like the build queue).

import {
  DISTRICTS, RESEARCH_SETTINGS, TECHNOLOGIES, TECH_ORDER, UNITS, UPGRADES,
} from './data/definitions';
import {
  addToWallet, getWallet,
  type DistrictId, type GameState, type TechId, type UnitId, type UpgradeId,
} from './state';
import { canAfford, pay } from './wallet';

/** Something a technology puts in the player's hands. */
export type Unlock =
  | { kind: 'district'; id: DistrictId }
  | { kind: 'districtLevel'; id: DistrictId; level: number }
  | { kind: 'unit'; id: UnitId }
  | { kind: 'upgrade'; id: UpgradeId };

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
 * already see. Upgrades come last because the banners don't announce them.
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
  for (const upgrade of Object.values(UPGRADES)) {
    if (upgrade.requiredTech === id) unlocks.push({ kind: 'upgrade', id: upgrade.id });
  }
  return unlocks;
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
export const canStartTech = (state: GameState, id: TechId): boolean =>
  !isTechComplete(state, id)
  && !isTechActive(state, id)
  && requirementsMet(state, id)
  && state.research.active.length < techSlots(state)
  && canAfford(state.city.wallet, TECHNOLOGIES[id].cost);

/** Anything at all worth a trip to the Research screen. */
export const anyResearchActionable = (state: GameState): boolean =>
  TECH_ORDER.some((id) => canStartTech(state, id));

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
