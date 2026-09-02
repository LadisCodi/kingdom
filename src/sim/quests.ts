// The quest chain: one active quest (QUESTS order), guiding the opening and
// paying out resources. ABSOLUTE goals are predicates over current state —
// a player who already did the thing completes them the moment they
// activate, never dead-ending. RELATIVE goals count recordQuestEvent()
// calls while active (they hook the sim paths, so offline replay counts).

import {
  QUESTS, RELATIVE_QUEST_TYPES, type QuestDef,
} from './data/definitions';
import { recordResourceDiscovery } from './discovery';
import { refund } from './wallet';
import {
  addToWallet, getWallet,
  type CurrencyId, type FeatureId, type GameState, type UpgradeId,
} from './state';
import { upgradeLevel } from './upgrades';

export const activeQuest = (state: GameState): QuestDef | null =>
  QUESTS[state.quests.index] ?? null;

export type QuestEvent =
  | { kind: 'collect'; currency: CurrencyId; amount: number }
  | { kind: 'tap' }
  /** `feature` is whatever was standing on the cell, or null for bare ground.
   *  Carried on the event rather than looked up afterwards because the reveal
   *  is the only moment that knows it: a finite feature can be tapped away
   *  minutes later, and the quest should still have counted. */
  | { kind: 'reveal'; feature: FeatureId | null }
  | { kind: 'sell'; units: number };

/** Feed one sim event to the ACTIVE quest (no-op unless it's a matching
 *  relative goal). Cheap enough to call from every tap/deposit/sale. */
export function recordQuestEvent(state: GameState, event: QuestEvent): void {
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
    case 'DiscoverCells':
      if (event.kind === 'reveal') state.quests.progress += 1;
      break;
    case 'DiscoverFeature':
      if (event.kind === 'reveal' && event.feature === quest.goalTarget) {
        state.quests.progress += 1;
      }
      break;
    case 'SellGoods':
      if (event.kind === 'sell') state.quests.progress += event.units;
      break;
    default: // absolute goal — events are irrelevant
  }
}

/** Current goal metric: evaluated from state for absolute goals, the event
 *  counter for relative ones. Complete when ≥ goalAmount. */
export function questValue(state: GameState, quest: QuestDef): number {
  if (RELATIVE_QUEST_TYPES.has(quest.goalType)) return state.quests.progress;
  switch (quest.goalType) {
    case 'BuildDistrict':
      return state.city.districts.filter(
        (d) => d.definitionId === quest.goalTarget && d.state === 'Built').length;
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
    case 'TrainArmy':
      return state.army.length;
    case 'ClaimLandmarks':
      return Object.keys(state.landmarks.claimed).length;
    case 'ReachDepth':
      return state.deepestDepth;
    case 'ClearRuins':
      return Object.keys(state.ruinsCleared).length;
    case 'OwnArtifacts':
      return state.artifacts.owned.length;
    case 'OwnHeroes':
      return state.heroes.owned.length;
    case 'BuyUpgrade':
      return upgradeLevel(state, quest.goalTarget as UpgradeId);
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
  if (quest.rewardGems > 0) {
    addToWallet(state.player.wallet, 'Gems', quest.rewardGems);
    recordResourceDiscovery(state, 'Gems');
  }
  // Into the KINGDOM purse — Knowledge outlives the city that earned it, and
  // it is what the research tree is bought with.
  if (quest.rewardKnowledge > 0) {
    addToWallet(state.kingdom.wallet, 'Knowledge', quest.rewardKnowledge);
    recordResourceDiscovery(state, 'Knowledge');
  }
  state.quests.index += 1;
  state.quests.progress = 0;
  return 'Claimed';
}
