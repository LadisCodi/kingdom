// The quest chain: one active quest (QUESTS order), guiding the opening and
// paying out resources. ABSOLUTE goals are predicates over current state —
// a player who already did the thing completes them the moment they
// activate, never dead-ending. RELATIVE goals count recordQuestEvent()
// calls while active (they hook the sim paths, so offline replay counts).

import { track } from './analytics';
import { ownedArtifacts } from './artifacts';
import {
  DISTRICTS, LANDMARKS, QUESTS, RELATIVE_QUEST_TYPES, type QuestDef,
} from './data/definitions';
import { collectThreshold, storageCapacity, storageSpace, storedOf, storeInto } from './storage';
import { recordResourceDiscovery } from './discovery';
import { clearedLairCount, foundLairCount } from './lairs';
import { dropFragments } from './relics';
import { knowledgeLump, payKnowledge } from './knowledge';
import { refund } from './wallet';
import { revealedCellCount } from './research';
import {
  addToWallet, getWallet,
  type CurrencyId, type DistrictId, type GameState,
} from './state';
import { districtCount } from './districts';
import type { ItemId } from './state';
import { grantItem } from './bag';
import { workableCountAt } from './workers';
import type { SimEvent } from './events';

export const activeQuest = (state: GameState): QuestDef | null =>
  QUESTS[state.quests.index] ?? null;

/**
 * Feed one sim event to the ACTIVE quest (no-op unless it's a matching
 * relative goal). Cheap enough to call from every tap and deposit.
 *
 * IT TAKES THE WHOLE `SimEvent` UNION, not a chain-shaped subset, and the
 * switch below ends in a `default` — so a kind no quest goal reads (a level, a
 * trainee) costs this nothing and can never move `state.quests.progress`. Call sites go through
 * `recordEvent` (sim/events.ts), which calls this first and then the
 * odometer; nothing outside that file calls this directly.
 */
export function recordQuestEvent(state: GameState, event: SimEvent): void {
  const quest = activeQuest(state);
  if (!quest) return;
  switch (quest.goalType) {
    case 'CollectResource':
      if (event.kind === 'collect' && event.currency === quest.goalTarget) {
        state.quests.progress += event.amount;
      }
      break;
    case 'CollectTaps':
      if (event.kind === 'tap') state.quests.progress += 1;
      break;
    // Counted at the reveal, because the reveal is the only moment that
    // knows the feature: a berry bush is finite, and a total read off the map
    // would un-complete the quest when the bush is eaten.
    case 'DiscoverFeature':
      if (event.kind === 'reveal' && event.feature === quest.goalTarget) {
        state.quests.progress += 1;
      }
      break;
    default: // absolute goal — events are irrelevant
  }
}

/** Current goal metric: evaluated from state for absolute goals, the event
 *  counter for relative ones. Complete when ≥ goalAmount. */
export function questValue(state: GameState, quest: QuestDef): number {
  if (RELATIVE_QUEST_TYPES.has(quest.goalType)) return state.quests.progress;
  switch (quest.goalType) {
    // Counted the moment the build STARTS: a build cannot be cancelled, so
    // the building is the player's from then, and waiting for the scaffold
    // only slows the chain down.
    // RepairDistrict asks for the ruin and counts as a build: a building of
    // its kind however it came, so one raised elsewhere never strands it
    // (Docs/features/01-map-and-fog.md §6.3).
    case 'BuildDistrict':
    case 'RepairDistrict':
      return districtCount(state, quest.goalTarget as DistrictId);
    case 'UpgradeDistrict':
      return state.city.districts.filter(
        (d) => d.definitionId === quest.goalTarget && d.state === 'Built' &&
          d.level >= (quest.goalLevel ?? 1)).length;
    case 'HoldResource':
      return getWallet(state.city.wallet, quest.goalTarget as CurrencyId);
    case 'ReachPopulation':
      return state.city.population;
    case 'CompleteTech':
      return state.research.completed.includes(quest.goalTarget as never) ? 1 : 0;
    case 'CompleteTechs':
      return state.research.completed.length;
    case 'AssignWorkers':
      return state.city.districts.reduce((sum, d) => sum + d.assignedWorkers, 0);
    // The most its crew could work, of every one of its kind standing: a
    // Farm moved beside the plots it was too far from.
    case 'WorkInReach':
      return state.city.districts.filter((d) => d.definitionId === quest.goalTarget)
        .reduce((best, d) => Math.max(best, workableCountAt(state, d, d.location)), 0);
    case 'TrainArmy':
      return state.army.length;
    case 'ClaimLandmarks':
      // A target is a landmark KIND — "claim the Watchtower" — and none is any.
      return LANDMARKS.filter((l) => state.landmarks.claimed[l.id] === true
        && (quest.goalTarget === null || l.kind === quest.goalTarget)).length;
    case 'FindLairs':
      return foundLairCount(state);
    case 'ClearLairs':
      return clearedLairCount(state);
    case 'OwnArtifacts':
      // A relic arrives by finishing its album, so this counts albums
      // finished for the first time (Docs/open-questions.md OQ-91).
      return ownedArtifacts(state).length;
    case 'OwnHeroes':
      return state.heroes.owned.length;
    // A TOTAL, not a count from the quest's start: a player who opened every
    // cell in reach before the quest arrived must not be stuck behind it.
    case 'DiscoverCells':
      return revealedCellCount(state);
    default:
      return 0;
  }
}

export const isQuestComplete = (state: GameState, quest: QuestDef): boolean =>
  questValue(state, quest) >= quest.goalAmount;

export type ClaimResult = 'Claimed' | 'NotComplete' | 'NoQuest';

/** Pay the reward into the city wallet (Gems into the player's, Knowledge
 *  into the kingdom's) and activate the next quest. */
export function claimQuest(state: GameState): ClaimResult {
  const quest = activeQuest(state);
  if (!quest) return 'NoQuest';
  if (!isQuestComplete(state, quest)) return 'NotComplete';
  refund(state.city.wallet, quest.reward);
  for (const currency of Object.keys(quest.reward)) {
    recordResourceDiscovery(state, currency as CurrencyId);
  }
  // Mana, into the city purse. It is the one reward that buys TAPS rather
  // than things, and the opening is short of taps rather than of Gold: the
  // beats that pay it are the ones the player reaches with an empty pool
  // (Docs/features/12-quests.md §2.1). It may overfill — an overcharged pool
  // is a supported state and reads as one on the gauge.
  if (quest.rewardMana > 0) {
    addToWallet(state.city.wallet, 'Mana', quest.rewardMana);
    recordResourceDiscovery(state, 'Mana');
  }
  if (quest.rewardGems > 0) {
    addToWallet(state.player.wallet, 'Gems', quest.rewardGems);
    recordResourceDiscovery(state, 'Gems');
  }
  // Into the KINGDOM purse — Stardust outlives the city that earned it, which
  // is what the collection arc needs when regions become the treadmill.
  if (quest.rewardStardust > 0) {
    addToWallet(state.kingdom.wallet, 'Stardust', quest.rewardStardust);
    recordResourceDiscovery(state, 'Stardust');
  }
  // Knowledge too, as a lump. The chain seeds enough for every technology it
  // asks for — tests/quests.test.ts walks it and holds that promise.
  if (quest.rewardKnowledge > 0) payKnowledge(state, knowledgeLump(state, quest.rewardKnowledge));
  // Relic fragments, of relics already met, rolled on the quest.
  if ((quest.rewardFragments ?? 0) > 0) dropFragments(state, 'any', quest.rewardFragments, ['quest', quest.id]);
  // Items into the Bag (Docs/plans/relics-and-bag.md, step 4).
  for (const [id, n] of Object.entries(quest.rewardItems ?? {}) as Array<[ItemId, number]>) grantItem(state, id, n);
  track(state, 'quest_done', { index: state.quests.index, id: quest.id });
  state.quests.index += 1;
  state.quests.progress = 0;
  return 'Claimed';
}

/**
 * THE TUTORIAL'S RENT RUSH — a pacing hack for the opening, not a mechanic.
 *
 * A quest with `tutorialRentSeconds` asks for Gold the first house would take
 * half a minute of rent to make. So when it becomes active, a moment that many
 * seconds later is stamped; at it, the first house's store is topped up with
 * what the goal still asks (and at least enough for its purse to show). The
 * real rent goes on beside it.
 *
 * It is a TIMER like any other: stamped at a boundary, considered in
 * `nextBoundary`, resolved in `applyDueAt` — so a replay agrees with live play.
 */
export function stampRentRush(state: GameState, t: number): void {
  const quest = activeQuest(state);
  if (quest === null || quest.tutorialRentSeconds === null || quest.tutorialRentSeconds === undefined) return;
  if (state.quests.rush?.index === state.quests.index) return;
  state.quests.rush = { index: state.quests.index, at: t + quest.tutorialRentSeconds * 1000 };
}

/** When the rush tops the house up, or null. */
export const nextRentRush = (state: GameState): number | null => state.quests.rush?.at ?? null;

export function applyRentRush(state: GameState, t: number): void {
  const rush = state.quests.rush;
  if (rush === undefined || rush.at === null || t < rush.at) return;
  rush.at = null;
  const quest = activeQuest(state);
  if (rush.index !== state.quests.index || quest === null || quest.goalTarget !== 'Gold') return;
  const need = quest.goalAmount - state.quests.progress;
  const house = state.city.districts.find((d) => d.state === 'Built'
    && DISTRICTS[d.definitionId].populationCapacityPerLevel.length > 0 && storageCapacity(state, d) > 0);
  if (house === undefined || need <= 0) return;
  const want = Math.max(need, collectThreshold(state, house)) - storedOf(house, 'Gold');
  const add = Math.min(storageSpace(state, house), want);
  if (add > 0) storeInto(house, 'Gold', add);
}
