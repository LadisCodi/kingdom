// Game orchestrator: owns the sim state, UI modes (placement / inspection),
// the tap-handler chain, and change notification.

import { recordEvent } from './sim/events';
import { crestId, crestOf, type Crest } from './sim/crest';
import type { ItemStock } from './sim/rewards';
import {
  BAG_TABS, CHEST_COINS, bagTabOf, chestValue, heldItems, itemCount, markBagOpened, markItemSeen, runningBoosts, useItem,
  type BagTab,
} from './sim/bag';
import { DOOR_HINT, firstMorningOn, freshlyOpenDoors, isDoorOpen, markDoorSeen, showsCollect, type DoorId } from './sim/doors';
import { forgetRested, heroCanFight, heroHp, heroMaxHp, heroRestEndsAt, restedHeroes } from './sim/heroHealth';
import { newsOf, postNews, readNews, type News, type NewsGroup } from './sim/notices';
import {
  advance, builderGemCost, buyBuilder, canAfford, changeWorkers, collectBuilding, collectTap,
  buildPremiumShrine, buyKeys, enqueueBuild, finishWithGems, gemRushCost, moveDistrict, premiumShrinePrice, researchTech, shrineBuild, upgradeDistrict,
  type ShrineBuild,
  wakeIdleWorkersAt,
  type AssignWorkerResult, type CollectTapResult, type UpgradeResult,
  repairAbandoned,
} from './sim/commands';
import {
  BANNER_ORDER,
  AD, ARTIFACTS, ARTIFACT_ORDER, OFFER_ORDER, BUILDABLE_DISTRICTS, COMBAT, CURRENCIES, DISTRICTS, FEATURES, HARVEST, HERO_ORDER, HEROES,
  GOODS, ITEMS, ITEM_BUNDLE_ORDER, LANDMARK_ART, LANDMARKS, MANA, PARTY, LAIRS, LAIR_ORDER, STORE,
  ERA_REWARDS, TECHNOLOGIES, UNITS, levelIndexed, type AdjacencyStat, BANNERS, type BannerId,
  RELIC_RULES, WORLD_BUILD, relicKind, type BoostKind, type ItemDef, type RelicKind, HELP } from './sim/data/definitions';
import { formatCount, formatDuration, formatExact, formatNumber, formatCountdown } from './ui/format';
import { relicPercent } from './ui/relicStats';
import type { IconName } from './ui/kit/icon';
import {
  buildDurationForCell, canMoveDistrict, canPlaceAnywhere, districtCount, districtLabel, hasPlacementRestriction,
  maxDistrictCount, nextBuildCost, placementBlock, upgradeCost, validPlacementCells,
  requiredPopulation, type PlacementBlock,
} from './sim/districts';
import {
  explorationGate, fogState, isPayable, nextRevealTapCost, reachLevelFor, revealCostForCell, revealTap,
} from './sim/fog';
import {
  cellsWithinRadius, cellsWithinRadiusOfRect, footprintCells, townhallDistance, type MapData,
} from './sim/grid';
import { activeZones, areaCovers, type Modifier, type ModifierArea } from './sim/modifiers';
import {
  activateBlock, activateRelic, activationCost, auraOf, auraRadiusAt, auraTargets, buildingInAura, hostOf, hostRelic,
  reachesBuilding, worksOnGround,
  isAwake, relicWindowMs, shrines, unhostRelic,
} from './sim/hosts';
import { shrineBubbleAt } from './render/shrineBubbles';
import { effectiveStock, harvestSourceAt, isExhausted, isGrowing, tapYieldAt } from './sim/harvest';
import { placementAdjacency } from './sim/adjacency';
import { harmonyBlock } from './sim/harmony';
import {
  committedTroops, finishLineWithGems, healCost, healSecondsAt, healWounded, infirmaries, lineFor,
  armyCap, trainUnit, woundedCap, woundedCount, woundedOf,
  itemTrainSeconds, lineRushCost, trainCost, trainingCompletesAt, trainingProgress,
} from './sim/army';
import { artifactLevel, nextPassiveValue, passiveValue, syncArtifactModifiers } from './sim/artifacts';
import {
  canRestore, isMet, levelStardust, levelUpRelic, openFragmentPack, restoreRelic,
  dropFragments, openRelicDoor, slotCount, type FragmentDrop,
} from './sim/relics';
import {
  activeRadius, cast, castBlock, castState, chargesLeft,
  divinationSaving, surveyCells, validCastCells, type CastPhase,
} from './sim/casting';
import { claimLandmark, visibleLandmarks } from './sim/landmarks';
import {
  adOfferEligible, adOfferPending, adOfferReward, claimAdOffer, refreshAdOffer,
} from './sim/adOffers';
import { availableRoster, trainBatch, trainPlan, TRAIN_AMOUNTS, type TrainAmount, type TrainResult } from './sim/army';
import { cancelWorkshopItem, finishItemWithGems, itemRushCost, queueGood } from './sim/workshops';
import {
  autoPlan, fits, jobRemainingSeconds, spendSpeedups, speedupRefusal, speedupsFor, useAuto, useSpeedup,
  type SpeedJob,
} from './sim/speedups';
import { heroPower, partyPower, typeMultiplier } from './sim/combat';
import {
  attackLair, claimLair, heroLevel, lairBlock, lairClearReward, partyBoard, partyOf, previewLair, troopSlots,
  type LairBlock, type LairPreview,
} from './sim/expeditions';
import {
  RAIDABLE, cityRatePerSecond, lairCreature, lairFightIndex, lairFights, lairIsCleared,
  lairView, openLairs, setUtcOffset, type LairView, type RaidableId,
} from './sim/lairs';
import {
  buyHeroSlot, claimFreePull, freePullAvailable, freePullReadyAt, freePullsLeft,
  heroSlotGemCost, heroSlots, levelUpHero,
  ascendHero, buySkillRank, pull, pullMany, STANDARD_BANNER, unlockHero, type PullResult,
} from './sim/heroes';
import {
  canPayMana, mana, manaCap, manaNetRegen, manaProduction, msToNextMana, payMana,
} from './sim/mana';
import { campPay, fightMana, sendFights } from './sim/world/fights';
import {
  buyKnowledge, knowledgeCap, knowledgeGemPrice, knowledgeGoldPrice, knowledgeHeld,
  knowledgePerHour, msPerPoint, msToFullKnowledge, msToNextKnowledge, type KnowledgeTill,
} from './sim/knowledge';
import {
  boughtRefillsLeft, manaRefillGemCost, nextRefillRung, refillManaWithGems,
  watchedRefillsLeft,
} from './sim/manaRefill';
import { sightedAt } from './sim/sight';
import { landmarkDefAt, standingAbandonedAt, standingLairAt } from './sim/sites';
import { lairHolding, lairZoneCells } from './sim/lairZone';
import {
  availableWorkers, districtCapacity, maxPopulation, populationCost, residentsOf,
} from './sim/population';
import { activeQuest, claimQuest, isQuestComplete, questValue } from './sim/quests';
import {
  anyResearchActionable, researchActionableCount, eraShortfall, freshlyOpenBooks, isTechComplete,
  markBookSeen, pourKnowledge, techKnowledgeMissing, type ResearchRefusal, revealedCellCount,
} from './sim/research';
import {
} from './sim/upgrades';
import {
  PROFILE_LABEL, budgetRemainingCents, buyStoreSku, isItemBundle, canAffordSku, choosePayerProfile,
  monthResetsAt, monthlyBudgetCents, priceCents,
} from './sim/store';
import { ascensionFragmentCost, isMaxAscension } from './sim/heroLadder';
import { addHeroXp, boonText, heroEntry, heroUnlockCost, ownsHeroId, pullPrice } from './sim/heroes';
import {
  boughtToday, claimNextDay, dailyOffers, dailyResetsAt, nextDayReady, nextDayWaiting, offerOn, offerTrigger,
  offerComesBack, offerWindow, offersOn, refreshOffers, skuValuePercent,
} from './sim/offers';
import type { PayerProfile, PortalPrize, StoreSkuId } from './sim/state';
import {
  addToWallet, builderCount, buildQueueCapacity, busyBuilders, coordKey, districtAt, districtById, getWallet, queueProgress, sameCell, townhall,
  type ArtifactId, type Coord, type CurrencyId, type District, type DistrictId,
  type FeatureId, type TrainableId,
  type GameState, type HeroId, type ItemId, type PartySlotState, type LairId, type TechId, type UnitId,
  type QueueItem, type Wallet,
} from './sim/state';
import {
  anySurveyPending, buySurvey, claimSurveyCell, freeSurveyCell, nextLevelCells, paidSurveyCell,
  surveyLength, surveyLevel, surveyOwned,
} from './sim/survey';
import { pickUpTreasure, treasureAt } from './sim/treasures';
import { MOVABLE_FEATURES, pickUpBlock, transplant, transplantBlock, TRANSPLANTING } from './sim/plants';
import type { BattleLog } from './sim/battle';
import { influenceCells, workableCells } from './sim/workers';
import { techValue } from './sim/techEffects';
import { playSfx, type SfxName } from './audio/sfx';
import type { HarvestSourceId } from './sim/state';
import { worldRanking, type RankedSeat } from './sim/world/ranking';
import { ABANDONED, KINGDOM_DEF, QUESTS, SCENES, SURVEY, UNLOCKS, WORLD, type QuestDef } from './sim/data/definitions';
import { CAMERA_GLIDE_MS, Camera } from './render/camera';
import { HexCamera } from './render/world/hexCamera';
import {
  buyExplorer, cutExplorer, dispatchExplorer, explorerGemCost, explorerRushCost, explorerSlots, finishExplorerWithGems,
  fogStateOf, freeExplorers, homeIndex, readyAt, readyTrips, revealExplored, returnsAt, tripPhase, worldFog,
  type ExplorerFound, type TripFinished,
} from './sim/world/explorers';
import { gemsToFinish } from './sim/rush';
import { CAMP_TITLE } from './ui/world/hexNames';
import { explorersOutLine, hexWork, isUpgrade, scoutWords, worldBuildDone, worldBuildName, worldBuildSeconds } from './ui/world/worldActions';
import { fastestRoute, homeboundMs, type Route } from './sim/world/travel';
import { hasBit } from './sim/world/fogBits';
import { PORTAL_INDICES, hexAt, hexDistance, hexIndex } from './sim/world/hex';
import { localWorld, snapshotWorld, type WorldSource } from './sim/world/source';
import type { WorldServerApi } from './worldServer/local';
import type { Analytics, AnalyticsContext } from './analytics/analytics';
import type { ArmyPurpose, Refusal, WorldSnapshot } from './worldServer/types';
import { nicknameProblem } from './worldServer/nickname';
import { FriendsClient } from './friendsClient';
import { armyMarchSpeed, departArmy, freeArmySlots, receiveArmy } from './sim/world/armies';
import { movesWorldBoost, worldImprovementBoost } from './sim/world/boost';
import { boardNeighbors } from './sim/world/hex';
import { emptyBits } from './sim/world/fogBits';
import type { WorldUpgrade } from './sim/world/types';
import { type GoodId, type PreciousId, type WorldBuildWhat } from './sim/state';
import { districtOf } from './worldServer/core';
import { worldStoreReady } from './sim/world/stores';
import { Floaters } from './render/floaters';
import { CollectBubbles } from './render/collectBubbles';
import { lairArtAt, lairBubbleAt, UNIT_CREATURE_AVATAR } from './render/lairMap';
import { Villagers } from './render/villagers';
import type { MarkerLayer } from './render/mapRenderer';
import { PALETTE } from './render/palette';
import { TapChain } from './render/tapChain';
import { TapFx } from './render/tapFx';
import { GhostFx } from './render/ghostFx';
import { haptic } from './ui/haptics';
import { pay } from './sim/wallet';
import { addGood, getGood } from './sim/goods';
import { worldUpgradeGoods } from './sim/precious';
import { CAMP_CREATURE, campTribute } from './sim/world/camps';

/** Why a ghost may not stand where it is, as the placement window says it. */
const GHOST_BLOCK_WORDS: Record<PlacementBlock, string> = {
  HasFeature: 'Clear the ground first',
  NotRevealed: 'Reveal the ground first',
  Occupied: 'Something already stands here',
  OffMap: 'It does not fit on the map here',
  CountLimit: 'Every one allowed is built',
  NeedsResearch: 'Research it first',
  NeedsShoreline: 'It needs a shoreline',
  NeedsLand: 'It cannot stand on water',
  NeedsHarmony: 'Needs more Harmony',
  HasSite: 'Something already stands here',
  LairZone: 'A lair holds this ground',
};

export type Mode =
  | { kind: 'normal' }
  | { kind: 'placing'; definitionId: DistrictId; selected: Coord | null; premium?: true }
  /** Relocating a building that already exists. The same targeting model as
   *  placing — a ghost you move and confirm — with `origin` kept so Cancel
   *  can put it back and so the ghost knows which footprint is its own. */
  | { kind: 'moving'; districtUniqueId: string; definitionId: DistrictId;
      selected: Coord | null; origin: Coord }
  /** Moving a tree or a crop plot (Docs/features/27-plantables.md §4): the
   *  same ghost as a building's move, for a feature lifted from `origin`. */
  | { kind: 'transplanting'; feature: FeatureId; selected: Coord | null; origin: Coord }
  /** Casting reuses the placement machinery wholesale — select, highlight,
   *  tap to commit — rather than inventing a second targeting model. */
  | { kind: 'casting'; artifactId: ArtifactId; selected: Coord | null };

/** Every full-screen menu the nav (or the map) can open. Naming them means
 *  `tsc` — the only real gate this project has over the view layer — catches
 *  an overlay that nothing renders, instead of it silently drawing nothing. */
export type OverlayName =
  | 'build' | 'research' | 'settings' | 'purse' | 'welcome'
  | 'relic' | 'heroes' | 'lair' | 'mana' | 'builder'
  // The Bag (Docs/art/ui-inventory.md): items held until they are used.
  | 'bag'
  // The Speed-up picker, opened by a timer's Speed up (ui-inventory.md §3.7).
  | 'speedup'
  // Short of a coin the Bag holds chests of (ui-inventory.md §3.9).
  | 'shortfall'
  | 'store' | 'payerProfile' | 'iapConfirm'
  // The Survey, reached from its own pill (Docs/features/25-the-survey.md §6).
  | 'survey'
  // Buying a level is its own surface now, opened by the card's Upgrade
  // button (Docs/art/ui-menus-redesign.md §7.27).
  | 'upgrade'
  // Buying Knowledge, from the + on the Knowledge tab (07-research.md §3.2).
  | 'knowledge'
  // Choosing heroes for n slots, from whatever asked (`openHeroPicker`).
  | 'heroPicker'
  // Choosing the city relic a Shrine holds (`openRelicPicker`), over its card.
  | 'relicPicker'
  // "It is in another Shrine — move it here?", over the picker.
  | 'relicMoveConfirm'
  // A hex of the world board, and what can be done there — the dispatch
  // sheet (Docs/features/19-world-map.md §1.2).
  | 'world'
  // A district's empty building slot, and what can be built in it; a built
  // one, what it does and its next level (Docs/proposals/world-menus.md §3.3).
  | 'worldSlot' | 'worldBuilding'
  // An army composed for the world board, on the lair attack's screen
  // (Docs/features/19-world-map.md §4).
  | 'army'
  // A world dungeon's descent: its rooms, the race, the army camped there
  // (Docs/features/19-world-map.md §8.2).
  | 'delve'
  // The Dark Portal's descent: its floors, the ranking on them, the army
  // camped below (Docs/proposals/world-menus.md §3.10).
  | 'portal'
  // The name the player goes out onto the world board under, asked the
  // first time out (Docs/features/19-world-map.md §1.3).
  | 'nickname'
  // The friends list, from the header, and a friend's profile over it
  // (Docs/features/15-social.md §2.1).
  | 'friends' | 'friendProfile'
  // The world ranking, from its widget on the board (19-world-map.md §12).
  | 'ranking'
  // The shield editor, from the pencil on the player's own card (§2.2).
  | 'crestEditor'
  // Asking a kingdom by its name or code, from the requests list (§2.1).
  | 'friendSearch'
  // The wish board (§2.4): a wish made in two steps, and a fill's window.
  | 'wishNeed' | 'wishGive' | 'wishFilled'
  // A notice's card, from its bubble (Docs/features/26-notices.md §5).
  | 'notice';

/** Fragments that landed, as one line: "A piece of the Staff of Renewal". */
export function fragmentWords(drops: readonly FragmentDrop[]): string {
  if (drops.length === 1) {
    const d = drops[0];
    return `${d.slot === 5 ? 'The keystone' : 'A piece'} of the ${ARTIFACTS[d.relic].name} — it is in the Bag`;
  }
  return `${formatExact(drops.length)} relic fragments — they are in the Bag`;
}

/** An item as a sentence says it: "1h Wood chest", "Gold key". */
export function itemWords(id: ItemId): string {
  const def = ITEMS[id];
  const size = def.kind === 'flask' ? `${formatExact(def.value)}% `
    : def.kind === 'tome' ? `${formatExact(def.value)} `
      : def.seconds > 0 ? `${formatDuration(def.seconds)} ` : '';
  return `${size}${def.name}`;
}

/** A relic as its sheet and its card in the Bag draw it (ui/relicSheet.ts). */
export interface RelicView {
  id: ArtifactId; name: string; sprite: string; glyph: string; kind: RelicKind;
  level: number; restored: boolean; met: boolean;
  /** Fragments held per slot: five pieces, then the keystone. */
  slots: number[];
  /** Stardust the next level asks; it also takes one fragment of each slot. */
  levelStardust: number;
  /** Every slot holds a fragment — the set a level takes. */
  hasSet: boolean;
  canRestore: boolean;
  now: string; next: string;
  pending: string | null;
  cast: { phase: CastPhase; leftMs: number; charges: number };
  /** A restored city relic's Shrine, and the Shrines it could move to; null
   *  for a world relic or one not restored (sim/hosts.ts). */
  host: { at: string | null; shrines: ShrineOption[] } | null;
  /** The one word its card in the Bag says about it (M80). */
  status: RelicStatus;
  /** What it does now, in two words — `+20% tax`. */
  effect: string;
}

/** Where a relic stands, as its card says it: a city relic awake or asleep in
 *  its Shrine, or restored and in the Bag; a world relic in a Chapel or not;
 *  either still in fragments. */
export type RelicStatus = 'awake' | 'asleep' | 'bag' | 'chapel' | 'broken';

/** A Shrine a relic could be hosted in. */
export interface ShrineOption {
  shrineId: string;
  label: string;
  /** The relic it holds now, by name. */
  holds: string | null;
}

/** A city relic's activation in its Shrine (sim/hosts.ts). */
export interface RelicActivationView {
  hosted: boolean;
  /** Its window is open: its effect reaches the aura. */
  awake: boolean;
  /** What is left of the open window, derived from its end every frame. */
  leftMs: number;
  /** How long an activation lasts — the relic's level. */
  windowMs: number;
  cost: number;
  affordable: boolean;
  /** How far the aura reaches round the Shrine — the relic's level. */
  radius: number;
  block: string | null;
  /** Mana the pool gains an hour, and how long until it holds the price —
   *  null when it already does (M83). */
  regenPerHour: number;
  readyInMs: number | null;
  /** The smallest Mana flask in the Bag, for a player short of the price. */
  flask: { id: ItemId; count: number } | null;
}

/** A Shrine's card section: what it holds and what it could. */
export interface ShrineView {
  holds: ArtifactId | null;
  /** How far round its footprint the aura reaches — its relic's level. */
  radius: number;
  /** How long one activation of what it holds lasts — its relic's level. */
  windowMs: number;
  /** Every restored city relic it could host instead, and where each is now. */
  candidates: Array<{ id: ArtifactId; name: string; at: string | null }>;
}

/** The Bag as its screen draws it (ui/bagSheet.ts). */
export interface BagScreen {
  tab: BagTab;
  /** Every tab, whether it holds anything, and whether anything in it is new. */
  tabs: Array<{ tab: BagTab; any: boolean; fresh: boolean }>;
  /** The open tab's items, in the Bag's order. */
  items: Array<{ id: ItemId; def: ItemDef; count: number; fresh: boolean; worth: Wallet }>;
  /** The tile whose popover is open. */
  picked: ItemId | null;
}

/** The Speed-up picker as its screen draws it (ui/speedupSheet.ts). */
export interface SpeedupScreen {
  /** What is being sped up: "Sawmill · level 4". */
  title: string;
  icon: IconName;
  progress: number;
  /** Seconds left. */
  left: number;
  /** The speed-ups that fit, typed first, then General, smallest first. */
  rows: Array<{ id: ItemId; def: ItemDef; count: number }>;
  /** What Auto would spend; empty when there is nothing to spend. */
  auto: Array<{ id: ItemId; n: number }>;
  /** What finishing with Gems costs now. */
  gems: number;
}

/** Which door an overlay stands behind (Docs/features/22-progression.md §3).
 *  An overlay not named here is never padlocked. */
const OVERLAY_DOOR: Partial<Record<OverlayName, DoorId>> = {
  research: 'research', build: 'build', heroes: 'heroes', relic: 'relics', bag: 'bag',
  world: 'world', army: 'world', knowledge: 'knowledge', store: 'store', survey: 'survey', nickname: 'world',
  friends: 'friends', friendProfile: 'friends', crestEditor: 'friends', friendSearch: 'friends',
  wishNeed: 'friends', wishGive: 'friends', wishFilled: 'friends',
};

/** How the hero picker orders the heroes it offers. */
export type HeroPickSort = 'level' | 'rarity';

/**
 * AN OPEN HERO PICKER (ui/heroPicker.ts): what it was asked for and what the
 * player has chosen so far. Any screen can open one — it hands over how many
 * slots it wants and what to do with the answer, and the picker hands the
 * screen back when it closes.
 */
/** What a hero is doing now (`Game.heroStateOf`), as its card marks it. */
export type HeroState =
  | { kind: 'ready' }
  | { kind: 'resting'; restMs: number }
  | { kind: 'marching'; at: number | null }
  | { kind: 'camped'; where: 'dungeon' | 'portal' | 'camp' }
  | { kind: 'guarding' };

export interface HeroPick {
  title: string;
  /** One per slot asked for, in slot order; null = free. */
  slots: Array<HeroId | null>;
  /** The overlay to return to when the picker closes, either way. */
  returnTo: OverlayName | null;
  onSelect: (heroes: HeroId[]) => void;
  filter: UnitId | 'All';
  sort: HeroPickSort;
  /** Chosen for a fight: each card prints its hero's power. */
  fight: boolean;
}

/** Why a refill cannot be taken right now, or `Ready`. The Mana sheet turns
 *  each one into a sentence — nothing is greyed out without a reason. */
export type RefillBlock =
  | 'Ready' | 'PoolFull' | 'AboveHalf' | 'Cooling' | 'NoneLeftToday';

/** A transient attention hint: a UI element (by key) or a world cell gets an
 *  arrow until it's interacted with or HINT_MS passes. */
export type Hint =
  | { kind: 'ui'; key: string; until: number }
  | { kind: 'cell'; cell: Coord; until: number };

/** How long a hint points before it lets go (`tutorial` › `help.pointerSeconds`,
 *  Docs/features/23-tutorials.md §5). */
const HINT_MS = HELP.pointerSeconds * 1000;

/** A queued top-of-screen notification card (shown one at a time, 5s each). */
export interface Banner {
  title: string;
  icon: string;
  name: string;
  desc: string;
  /** A world sprite key, when the subject has real art to show off. */
  sprite?: string;
  /** Colours the banner by what happened: gold = new, leaf = built,
   *  sky = learned. Defaults to gold. */
  tone?: 'gold' | 'leaf' | 'sky';
  /** Chime override; the banner plays 'discovery' when absent. */
  sfx?: SfxName;
}

/**
 * One thing a call paid, as the reveal screen shows it.
 *
 * A `PullResult` is a record of a ROLL — hit or miss, which pity moved, what
 * it charged. That is the wrong shape to draw: ten of them are ten rows of
 * bookkeeping, and the player asked "what did I get". So a batch collapses
 * into prizes, which is the only thing the screen knows about.
 */
export type GachaPrize =
  | { kind: 'hero'; heroId: HeroId }
  | { kind: 'fragments'; heroId: HeroId; amount: number; progress?: FragmentProgress }
  | { kind: 'currency'; currency: CurrencyId; amount: number }
  // Into the Bag: a call's speed-up or chest.
  | { kind: 'item'; item: ItemId; amount: number }
  // A relic's fragment — its own piece of the relic (relicSheet `fragmentArt`).
  | { kind: 'relicFragment'; relic: ArtifactId; slot: number; amount: number };

/**
 * Where a call's fragments of one hero leave them: toward RECRUITING a hero
 * not yet owned, or toward the next ascension point of one who is. `from` and
 * `to` are the fragments held before and after the call (the bar fills
 * between them); `recruited` says the call filled the recruiting bar and the
 * hero joined (Docs/features/10-heroes.md §8.3).
 */
export interface FragmentProgress {
  toward: 'recruit' | 'ascension';
  from: number; to: number; goal: number; recruited: boolean;
}

/**
 * A sequence of prizes, dealt one at a time.
 *
 * It was built for the gacha and it is not the gacha's alone any more: a
 * cleared room hands it what the room paid (Docs/features/11a-ruins-ui.md
 * §2.5). Hence the optional half — a banner and a call count are what a PULL
 * has to say about itself, and a fight says something else.
 */
/** What a reveal is opened FROM (ui/gachaScreen.ts): the silver-bound chest
 *  of the common call, the gold one of the golden call, the relic chest of a
 *  fragment pack, the war chest of a fight's spoils. */
export type RevealChest = 'common' | 'golden' | 'relic' | 'spoils';

export interface GachaReveal {
  banner?: BannerId;
  chest: RevealChest;
  /** How many calls this was — the screen says "×10" rather than counting
   *  prizes, which condense and would undercount. */
  calls?: number;
  /** The line under the grid, when it is not a call count. */
  caption?: string;
  prizes: GachaPrize[];
}

/**
 * Collapse a batch into prizes.
 *
 * Two rules do all the work. **Same thing, one widget with a count**: ten
 * calls that each paid 25 Stardust are one 250, and four fragments of the
 * same hero are one stack of four — otherwise a ten-call is a wall of
 * identical tiles nobody reads. And **heroes last**, because they are what
 * the player called for: the sequence should arrive at them rather than open
 * with them and then spend nine tiles winding down. Before them: the
 * currencies, then the Bag's items, then the fragments.
 */
export function gachaPrizes(pulls: readonly PullResult[]): GachaPrize[] {
  const heroes: GachaPrize[] = [];
  const fragments = new Map<HeroId, number>();
  const currencies = new Map<CurrencyId, number>();
  const items = new Map<ItemId, number>();
  const addFragments = (id: HeroId, n: number): void => {
    fragments.set(id, (fragments.get(id) ?? 0) + n);
  };
  for (const p of pulls) {
    // A duplicate is not a hero prize — it already paid its fragments, and
    // showing it as a hero would promise a roster entry that is already there.
    if (p.heroId !== null && !p.duplicate) heroes.push({ kind: 'hero', heroId: p.heroId });
    if (p.fragmentsOf !== null && p.fragments > 0) addFragments(p.fragmentsOf, p.fragments);
    for (const l of p.loot) {
      if (l.kind === 'fragments') addFragments(l.heroId, l.amount);
      else if (l.kind === 'currency') currencies.set(l.currency, (currencies.get(l.currency) ?? 0) + l.amount);
      else items.set(l.item, (items.get(l.item) ?? 0) + l.amount);
    }
  }
  return [
    ...[...currencies].map(([currency, amount]): GachaPrize => ({ kind: 'currency', currency, amount })),
    ...[...items].map(([item, amount]): GachaPrize => ({ kind: 'item', item, amount })),
    ...[...fragments].map(([heroId, amount]): GachaPrize => ({
      kind: 'fragments', heroId, amount,
    })),
    ...heroes,
  ];
}

/**
 * A FIGHT BEING WATCHED (Docs/features/combat.md §13).
 *
 * The fight itself is over before this exists: the resolver ran, the rewards
 * were paid and the fallen were taken off the roster the instant the player
 * tapped. What is left is a replay, and a replay can be interrupted by
 * anything — a closed tab, a reload — without costing the player a thing.
 *
 * The phase walks one way and is driven by the clock the caller passes in, so
 * the whole machine is testable without a DOM: `playing` while the log has
 * events left, `result` for the two seconds the plaque needs, `rewards` while
 * the prize sequence deals, `done` when only the way out is left.
 */
export type BattleBackdrop = 'field' | 'dungeon' | 'boss' | 'portal';

export interface BattlePlayback {
  log: BattleLog;
  title: string;
  subtitle: string;
  prizes: GachaPrize[];
  /** What the ENEMY's troops look like, by type: a lair fields creatures,
   *  not the player's own soldiers. Absent, both sides wear the unit busts. */
  enemyFaces?: Partial<Record<UnitId, string>>;
  /** The ground it is fought on (battleScreen.ts): the field outside a lair,
   *  a dungeon room, a depth's boss hall, the Portal's depths. */
  backdrop: BattleBackdrop;
  /** Wall clock at the first tick. */
  startedAt: number;
  /** THE PLAYBACK'S CLOCK, which a speed change rebases: the fight's own
   *  milliseconds at `clockAt`, running `speed` times as fast after it. */
  clockAt: number;
  clockMs: number;
  speed: number;
  /** A stretch of wall clock the replay runs `factor` times slower through:
   *  the last blow's slow motion (`slowBattle`). */
  slow?: { from: number; until: number; factor: number };
  phase: 'playing' | 'result' | 'rewards' | 'done';
}

/** The fight's own milliseconds a playback has reached at `now`. */
// Never earlier than `clockMs`: a held clock (`holdBattle`) has its
// `clockAt` in the future, and the replay stands still until it arrives.
// A slow stretch takes back what it slowed, so the clock stays a pure
// function of `now` and nothing has to run when the stretch ends.
const playbackMs = (b: BattlePlayback, now: number): number => {
  const run = Math.max(0, now - b.clockAt);
  const slowed = b.slow === undefined ? 0
    : Math.max(0, Math.min(now, b.slow.until) - Math.max(b.slow.from, b.clockAt)) * (1 - b.slow.factor);
  return b.clockMs + (run - slowed) * b.speed;
};

/** How long the plaque waits after the last blow. */
export const BATTLE_RESULT_DELAY_MS = 2000;

export class Game {
  mode: Mode = { kind: 'normal' };
  inspectedDistrictId: string | null = null;
  /** A finger is on the ghost and carrying it: its move arrows hide, because
   *  the finger is already saying which way it goes. */
  ghostHeld = false;
  /** What the builder sheet was raised for — the build on the ghost, or an
   *  upgrade — so a builder freed while it is open offers that exact job. */
  builderAsk: { kind: 'build' } | { kind: 'upgrade'; districtUniqueId: string }
    | { kind: 'repair'; id: string }
    | { kind: 'world'; index: number; what: WorldBuildWhat; level: number; gold: number } = { kind: 'build' };
  /** Which card panel is open over the battle screen, if any. */
  /** The lair the battle sheet is being composed for
   *  (Docs/features/18-garrisons-and-raids.md §5). */
  lairId: LairId | null = null;
  /** What the player has picked so far, by unit type. Lives on the presenter
   *  rather than in the view because it survives the per-tick rebuild and is
   *  node-testable. */
  expeditionParty: PartySlotState[] = [];
  /** The heroes the player has put in the hero slots, in slot order — one
   *  per slot, at most `heroSlots(state)` of them. */
  partyHeroes: HeroId[] = [];
  /** The hero picker, while it is open (`openHeroPicker`). */
  heroPick: HeroPick | null = null;
  /** The relic picker, while it is open (`openRelicPicker`): the Shrine it
   *  chooses for, and the one slot as it stands — null is empty. */
  relicPick: { shrineId: string; slot: ArtifactId | null; chapel?: number } | null = null;
  /** The store SKU whose confirmation sheet is open. */
  pendingSku: StoreSkuId | null = null;
  /** Which building the upgrade popup is about. Null when it is closed — the
   *  overlay name alone would not say WHICH, and the card underneath can be
   *  a different building by the time it reopens. */
  upgradeDistrictId: string | null = null;
  /** Which sheet the confirmation was opened from, and returns to. */
  pendingSkuFrom: OverlayName | null = 'store';
  /** The store tab the player picked; null → the one it opens on. */
  private storeTabPick: StoreTab | null = null;
  /** Where a splash opened from a sheet goes back to when it is closed. */
  private splashReturn: OverlayName | null = null;
  private backFromSplash = false;
  /** How many times the store has been opened this session — not counting a
   *  return from its confirmation or a splash. The golden call's hero moves
   *  on with it (ui/storeHeroes.ts). */
  storeVisits = 0;
  /** When this session began: an offer splash shows from the session after
   *  its window opened (`offerSplash`). */
  sessionStartedAt = 0;
  /** The offer splashes this session has closed, as `buy:<sku>` / `claim:<sku>`. */
  private splashesClosed = new Set<string>();
  /** A splash opened on purpose — from the store or the pill. */
  private offerSplashForced: OfferSplashView | null = null;
  /** What was asked for while the payer-profile sheet had the screen. The
   *  profile sheet is modal in the strong sense (14-monetization.md §3), so
   *  whatever wanted to open — the welcome report, chiefly — waits here and
   *  opens the moment a profile is chosen. */
  afterProfileOverlay: OverlayName | null = null;
  /** When the fake ad started playing. A UI moment, not sim state — a reload
   *  mid-ad simply drops back to the offer, which is still standing. */
  adWatchStartedAt: number | null = null;
  /** WHAT the ad being watched pays for. The Mana refill was the only
   *  placement until the banners got their free call (2026-09-08), and the
   *  screen is the same screen — only the payout differs. */
  adWatchPurpose: 'mana' | BannerId = 'mana';
  /** The map SITE whose card is open — a landmark or a lair. Sites are not
   *  districts (they are authored content on a cell, not something the player
   *  built), so they get their own slot rather than being squeezed into
   *  inspectedDistrictId. */
  inspectedSite: Coord | null = null;
  private hint: Hint | null = null;
  openOverlay: OverlayName | null = null;
  /** What a call just paid, while the reveal screen is showing it. Not an
   *  overlay: `#overlay` is a stacking context under the nav, and a reward
   *  the player can tap around is not a reward — the same reason the
   *  rewarded video has a mount of its own. */
  gachaReveal: GachaReveal | null = null;
  /** The fight being replayed, or null when none is. Its own mount for the
   *  same reason the reveal has one — and the reveal plays OVER it, which is
   *  why it sits one layer below (Docs/features/11a-ruins-ui.md §2.5). */
  battle: BattlePlayback | null = null;
  /** The hero whose card is open on the roster screen, or null for the grid.
   *  On the presenter rather than in the view for the reason `lairId`
   *  is: it survives the per-tick rebuild, and it is node-testable. */
  openHeroId: HeroId | null = null;
  /** The roster's type filter and sort — the picker's two controls, kept
   *  here for the reason `openHeroId` is. */
  heroesFilter: UnitId | 'All' = 'All';
  heroesSort: HeroPickSort = 'level';
  /** The relic whose sheet is open, from the Bag's Relics tab, or null. */
  openRelicId: ArtifactId | null = null;
  readonly floaters = new Floaters();
  /** Lairs just claimed, and the `performance.now()` the claim landed at:
   *  the renderer plays their going-away from it, then forgets them. */
  readonly vanishingLairs = new Map<LairId, number>();
  /** The bounce a store's bubble gives when a haul lands in it. */
  readonly collectBubbles = new CollectBubbles();
  readonly villagers = new Villagers();
  readonly tapChain = new TapChain();
  readonly tapFx = new TapFx();
  /** The placement ghost's float, glide and landing (render/ghostFx.ts). */
  readonly ghostFx = new GhostFx();
  private questWasComplete = false;
  private boatsOut = new Set<string>();
  private changeListeners: Array<() => void> = [];
  private shakeListeners: Array<(c: CurrencyId[]) => void> = [];
  private rewardListeners: Array<(haul: Wallet, from?: { x: number; y: number }, tap?: boolean) => void> = [];
  private toastListeners: Array<(msg: string) => void> = [];
  /** Doors that opened since the stage last drained them — the padlock
   *  breaking, and the introduction that goes with it. Transient. */
  doorsJustOpened: DoorId[] = [];
  /** Unlock splashes waiting to be shown, by `UNLOCKS` id, the one on screen
   *  first (Docs/features/23-tutorials.md §4.6). Transient: the door or book
   *  is recorded seen the moment it opens, so a reload never replays one. */
  unlockQueue: string[] = [];

  /**
   * THE TUTORIAL'S GATE ON THE MAP (Docs/features/23-tutorials.md §6): the
   * stage sets it while a line holds a lock, and every tap, hold and ghost
   * drag asks it first. Absent = everything goes through.
   */
  tapGate: ((cell: Coord | null, how: 'tap' | 'ghost') => boolean) | null = null;
  /** The same gate on the world board: which hex a tap may reach. */
  hexGate: ((index: number | null) => boolean) | null = null;
  /** Inside an automatic claim — so the claim's own notify does not start another. */
  private autoClaiming = false;

  /** Is this door of the UI open (Docs/features/22-progression.md §3)? */
  doorOpen(door: DoorId): boolean {
    return isDoorOpen(this.state, door);
  }

  constructor(
    public state: GameState,
    public readonly map: MapData,
    public readonly camera: Camera,
  ) {
    this.registerTapHandlers();
    this.sessionStartedAt = this.now();
  }

  /** The game's clock is the world server's: the device's time moved by
   *  how far the server's runs ahead of it. One clock means a time the
   *  server sends — a build done, an army home — is read as it was meant. */
  now(): number {
    return Date.now() + (this.worldServer?.clockOffset() ?? 0);
  }

  // ------------------------------------------------------------ subscriptions

  onChange(fn: () => void): void {
    this.changeListeners.push(fn);
  }
  onShake(fn: (c: CurrencyId[]) => void): void {
    this.shakeListeners.push(fn);
  }
  /** A claimed reward, already in the wallet — the UI flies it to the
   *  header and counts it in as it lands (ui/rewardFly.ts). `from` is where
   *  it bursts from, in the frame's own pixels, when the presenter knows (a
   *  tapped cell); otherwise the UI uses the tap that claimed it. `tap`
   *  marks what a Mana-paid tap gathered, which counts its fragments
   *  differently (`rewardFragments`). */
  onReward(fn: (haul: Wallet, from?: { x: number; y: number }, tap?: boolean) => void): void {
    this.rewardListeners.push(fn);
  }
  onToast(fn: (msg: string) => void): void {
    this.toastListeners.push(fn);
  }
  notify(): void {
    this.notifies += 1;
    // The ad offer's latch. Here rather than in `tick()` because Mana crosses
    // the 50% gate on a TAP, not on the second — and every command ends in a
    // notify, so this sees the spend that made the player eligible instead of
    // lagging it by up to a second. `tick()` calls notify() too, so the
    // "after advance()" ordering the architecture needs still holds.
    refreshAdOffer(this.state, this.now());
    // The store's offers, on the same latch and for the same reason: a
    // trigger met by a tap opens its window on that tap (sim/offers.ts).
    refreshOffers(this.state, this.now());
    // A fresh SITE is a news (Docs/features/26-notices.md §2.1), unless a
    // scene introduces it — the advisor says it. A RESOURCE is never one:
    // its coin lands on the plank under the player's own tap.
    for (const key of this.state.pendingDiscoveries.splice(0)) {
      const [kind, id] = key.split(':');
      if (kind !== 'site' || this.sceneIntroduces(id) || siteBanner(id) === null) continue;
      postNews(this.state, { group: 'sighted', key: `sighted:${id}`, at: this.now(), site: id });
    }
    // A DOOR THAT HAS JUST OPENED is remembered at once, so it never shuts
    // again, and announced to whoever draws padlocks and plays scenes.
    const doors = freshlyOpenDoors(this.state);
    for (const door of doors) {
      markDoorSeen(this.state, door);
      this.doorsJustOpened.push(door);
    }
    // …and so is a BOOK. Either may have a splash, shown in `UNLOCKS` order
    // so the Tavern's Heroes come before the book it brings.
    const books = freshlyOpenBooks(this.state);
    for (const book of books) markBookSeen(this.state, book);
    for (const [id, u] of Object.entries(UNLOCKS)) {
      const opened = u.kind === 'door' ? (doors as string[]).includes(u.target) : (books as string[]).includes(u.target);
      if (opened) this.unlockQueue.push(id);
    }
    // A quest that CLAIMS ITSELF does so the moment it is done: the player is
    // already reaching for its next step (Docs/features/12-quests.md §1).
    const done = this.questInfo();
    if (done?.complete === true && done.quest.autoClaim && !this.autoClaiming) {
      this.autoClaiming = true;
      try { this.doClaimQuest(); } finally { this.autoClaiming = false; }
      return;
    }
    // The moment the active quest's goal is met, ding — before any claim.
    const questDone = this.questInfo()?.complete ?? false;
    if (questDone && !this.questWasComplete) playSfx('questComplete');
    this.questWasComplete = questDone;
    for (const fn of this.changeListeners) fn();
  }

  shake(currencies: CurrencyId[]): void {
    playSfx('error'); // every shake is a denial — one audible "no"
    for (const fn of this.shakeListeners) fn(currencies);
  }
  /** A tap on the fog that took: the cell flashes white — every cell of a
   *  block, since one tap works them all (mapRenderer draws `fog:<cell>`). */
  private flashFog(cell: Coord): void {
    for (const c of footprintCells(this.map, cell)) this.tapFx.add(`fog:${coordKey(c)}`);
  }

  toast(msg: string): void {
    for (const fn of this.toastListeners) fn(msg);
  }
  private reward(haul: Wallet, from?: { x: number; y: number }, tap = false): void {
    for (const fn of this.rewardListeners) fn(haul, from, tap);
  }

  /**
   * How many fragments a reward flies to the header as: one for each minute
   * of the city's own production it is worth, so a big payout LOOKS big
   * against what the player already makes — at least three, at most twelve,
   * and five for a coin the city does not produce (Gems) or produces nothing
   * of yet.
   *
   * A TAP that gathered fewer than five is counted out one fragment a unit,
   * so a tap of 2 flies two; from five up it takes the rule above.
   */
  rewardFragments(c: CurrencyId, amount: number, tap = false): number {
    if (tap && amount < 5) return Math.max(1, Math.floor(amount));
    const perMinute = (RAIDABLE as readonly CurrencyId[]).includes(c)
      ? cityRatePerSecond(this.state, c as RaidableId) * 60
      : c === 'Mana' ? manaNetRegen(this.state) / 60 : 0;
    if (perMinute <= 0) return 5;
    return Math.min(12, Math.max(3, Math.round(amount / perMinute)));
  }

  // ------------------------------------------------------------------- ticking

  tick(): void {
    // The device's local time, handed to the sim — it has no clock of its
    // own, and a lair raids inside the player's local day
    // (Docs/proposals/lairs.md §4.1). A no-op unless the offset moved.
    // Advanced FIRST, so a raid due before the move lands where it was due.
    const result = advance(this.state, this.map, this.now());
    setUtcOffset(this.state, -new Date(this.now()).getTimezoneOffset(), this.now());
    // Before the drain, so a window the tick opens is reported on this tick.
    refreshOffers(this.state, this.now());
    this.drainAnalytics();
    // The Mana offer's tab, the moment it appears (14 §6).
    const offered = this.adOffer() !== null;
    if (offered && !this.adOfferShown) this.track('ad_offer_shown', { placement: 'mana' });
    this.adOfferShown = offered;
    // The world board is server state: read it every second while it is on
    // screen, and now and then otherwise (a held Sanctuary moves the Mana
    // ceiling wherever the player is).
    this.worldTicks += 1;
    if (this.worldServer !== null) {
      const every = this.scene === 'world' ? this.worldServer.readEverySeconds() : 30;
      if (this.worldTicks % every === 0) void this.refreshWorld();
    }
    this.friends.tick();
    this.maybeAskName();
    // A relic whose window closed — here or while away — asks to be woken.
    for (const r of result.relicsAsleep) {
      if (!this.asleepNotices.includes(r)) this.asleepNotices.push(r);
    }
    // An explorer whose work is done waits at its hex for the player's tap:
    // it calls out once, and stands in the notices until it is answered.
    const ready = readyTrips(this.state, this.now()).map((t) => t.id);
    if (ready.some((id) => !this.readyHeard.has(id))) playSfx('explorerHome');
    this.readyHeard = new Set(ready);
    // A garrison come down on the city: a far horn, whatever it took.
    if (result.raids.length > 0) playSfx('raidAlarm');
    // A strike hits the CELL and a haul lands at the BUILDING, which is the
    // whole reason the trip is worth watching: the hit is where the work
    // happened and the number is where it arrived.
    for (const s of result.strikes) this.strikeFeedback(s.cell, s.source);
    // A haul lands in the building's store, not the purse, so it pops no
    // number: the store's bubble is what says there is something to collect.
    for (const d of result.deposits) this.collectBubbles.bump(d.cell);
    // A hall's batch is done when its line runs dry: one sound for it, not
    // one per soldier.
    if (result.linesDone.length > 0) playSfx('unitTrained');
    if (result.trainedPopulation > 0) {
      playSfx('villagerTrained');
      this.floaters.add(townhall(this.state).location, `+${formatExact(result.trainedPopulation)}`, 'population');
    }
    // A quiet splash when a fishing boat sets out (one per tick, max).
    let splashed = false;
    for (const w of this.state.workers) {
      const b = districtById(this.state, w.buildingId);
      const isBoat = b !== undefined && DISTRICTS[b.definitionId].harvestSources.includes('Fish');
      const out = w.activity === 'MovingToCell';
      if (isBoat && out && !this.boatsOut.has(w.id) && !splashed) {
        playSfx('boatSplash');
        splashed = true;
      }
      if (out) this.boatsOut.add(w.id);
      else this.boatsOut.delete(w.id);
    }
    // A construction or an upgrade finished, a raid landed: each is a news
    // the sim filed (sim/notices.ts), and its bubble is the announcement.
    if (result.completedItems.length > 0 || result.worldBuildsDone.length > 0) playSfx('constructionComplete');
    this.notify();
  }

  // ----------------------------------------------------------------- tap chain

  private registerTapHandlers(): void {
    // 320 — casting. Above placement because the two modes are exclusive and
    // casting is the one the player entered most recently.
    this.tapChain.register({
      priority: 320,
      handle: (cell) => {
        if (this.mode.kind !== 'casting') return false;
        const valid = validCastCells(this.state, this.map, this.mode.artifactId);
        if (valid.some((c) => sameCell(c, cell))) {
          this.mode.selected = cell;
          this.notify();
        }
        return true; // cast mode swallows all map taps
      },
    });
    // 310 — moving an existing building. Above placement for the same reason
    // casting is above both: the modes are exclusive, and this is the one the
    // player entered most recently.
    this.tapChain.register({
      priority: 310,
      handle: (cell) => {
        if (this.mode.kind !== 'moving' && this.mode.kind !== 'transplanting') return false;
        // Any cell takes the ghost, legal or not: an illegal one turns it red.
        this.stepGhostTo(cell);
        return true; // move mode swallows all map taps
      },
    });
    // 300 — district placement.
    this.tapChain.register({
      priority: 300,
      handle: (cell) => {
        if (this.mode.kind !== 'placing') return false;
        // Any cell takes the ghost, legal or not: an illegal one turns it red.
        this.stepGhostTo(cell);
        return true; // placement mode swallows all map taps
      },
    });
    // 100 — landmarks and lairs. Above the fog handler, so a revealed site
    // opens its card instead of being treated as ordinary ground, and above
    // the harvest handler, so nothing tries to tap a shrine for wood.
    this.tapChain.register({
      priority: 100,
      handle: (cell) => {
        if (this.openOverlay !== null) return false;
        // A lair answers as soon as it is FOUND — its footprint may still be
        // under the fog, and the bubble over it is what the player taps
        // (Docs/proposals/lairs.md §6). A landmark waits to be revealed.
        const lair = standingLairAt(this.state, cell);
        // An abandoned building opens its card once its ground is revealed;
        // before that a tap on it is a tap on the fog.
        if (!lair && !landmarkDefAt(cell) && !standingAbandonedAt(this.state, cell)) return false;
        if (!lair && fogState(this.state, this.map, cell) !== 'Revealed') return false;
        this.inspectedSite = cell;
        this.inspectedDistrictId = null;
        this.noteFirstTap('site');
        playSfx('click');
        this.notify();
        return true;
      },
    });
    // 60 — a treasure on revealed ground (01-map-and-fog.md §6.2). Picked up
    // free, like a store, before the cell's own harvest answers: on a forest
    // the first tap takes the treasure and the next one swings the axe. On a
    // Discovered cell the chest is a reason to pay the fog, so the tap falls
    // through to the reveal.
    this.tapChain.register({
      priority: 60,
      handle: (cell) => {
        if (this.openOverlay !== null) return false;
        if (treasureAt(this.state, cell) === undefined) return false;
        const picked = pickUpTreasure(this.state, this.map, cell);
        if (picked.kind !== 'PickedUp') return false;
        this.noteFirstTap('treasure');
        this.tapFeedback(cell, 'pop');
        const entries = (Object.entries(picked.reward) as Array<[CurrencyId, number]>).filter(([, n]) => n > 0);
        for (const [c, n] of entries) this.floaters.add(cell, `+${formatCount(n)}`, c);
        const box = this.camera.cellToScreen(cell);
        const from = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
        queueMicrotask(() => this.reward(Object.fromEntries(entries), from, true));
        if (picked.item !== null) this.toast(`Found a ${itemWords(picked.item)} — it is in the Bag`);
        this.notify();
        return true;
      },
    });
    // 50 — fog reveal (blocked while a full overlay is open; the tile card doesn't count).
    this.tapChain.register({
      priority: 50,
      handle: (cell) => {
        if (this.openOverlay !== null) return false;
        const fog = fogState(this.state, this.map, cell);
        if (fog === 'Undiscovered') {
          // A silhouette past the fog (01-map-and-fog.md §4.1) answers with
          // the way to it; the plain dark swallows the tap.
          if (sightedAt(this.state, this.map, cell) !== undefined) {
            this.toast('Something stands in the dark — clear the fog towards it');
          }
          // Either way the hand shows where the fog can be cleared from.
          this.hintFrontierNear(cell);
          return true;
        }
        if (fog !== 'Discovered') return false;
        // Read BEFORE the tap: a tap charges a fifth of the cell's price now,
        // not one Gold, so the floater has to be told what it cost.
        const charged = nextRevealTapCost(this.state, this.map, cell);
        const result = revealTap(this.state, this.map, cell);
        if (result === 'Paid' || result === 'Revealed') { this.flashFog(cell); this.noteFirstTap('reveal'); }
        if (result === 'NotEnoughGold') this.shake(['Gold']);
        else if (result === 'NotReachable') {
          // Say the rule, not just "no". A player who has been told once that
          // the frontier moves outward stops trying to buy the far tile.
          playSfx('error');
          this.toast('Clear a path to it first — the fog lifts from the edges');
          this.hintFrontierNear(cell);
        } else if (result === 'OutOfReach') {
          // The capital is the reach: say which level opens this ring, so
          // the refusal points at the building rather than at the fog.
          playSfx('error');
          this.toast(`Raise the Townhall to level ${reachLevelFor(this.map, cell)} to explore this far`);
        } else if (result === 'TechLocked') {
          const gate = explorationGate(this.map, cell);
          if (gate) this.toast(`Research ${TECHNOLOGIES[gate].name} to explore this terrain`);
        } else if (result === 'Revealed') {
          wakeIdleWorkersAt(this.state, this.now()); // new cells may be claimable
          playSfx('revealDone');
          // No floater. Clearing a cell pays no currency any more — what it
          // buys is the ground itself, which the player can now see.
        } else if (result === 'Paid') {
          playSfx('revealPaid');
          this.floaters.add(cell, `\u2212${formatExact(charged)}`, 'Gold');
        }
        this.notify();
        return true;
      },
    });
    // 0 — the harvest tap / cell info.
    this.tapChain.register({
      priority: 0,
      handle: (cell) => {
        const district = districtAt(this.state, cell);
        // A building with something in its store: the tap COLLECTS, free, and
        // does nothing else. The next tap, with the store empty, opens it
        // (Docs/features/03-economy.md §3.2).
        if (district && district.state === 'Built' && showsCollect(this.state, district)) {
          this.collectStoreOf(district);
          this.notify();
          return true;
        }
        // An empty house opens its card.
        if (district && district.state === 'Built' &&
          districtCapacity(this.state, district) > 0) {
          this.inspectedDistrictId = district.uniqueId;
          this.notify();
          return true;
        }
        // A military building: tapping hurries the unit in training, exactly
        // as tapping the Townhall hurries a villager.
        //
        // `.length > 0`, NOT the array itself: `trains` became a list when
        // every building got its own training line, and an empty array is
        // truthy. Testing it as a boolean sent every non-trainer down this
        // branch — which swallowed the tap on a crop plot, because a plot is
        // a district that trains nothing and the harvest branch is below.
        // A training building answers a tap only by opening its card. There is
        // no tap that hurries a queue: a queue is a FIXED duration and a tap is
        // a scaling one, so a maxed thumb would finish a villager in one press
        // (Docs/features/04-harvest.md §3.2). Timers take Gems.
        if (district && district.state === 'Built'
          && DISTRICTS[district.definitionId].trains.length > 0) {
          this.inspectedDistrictId = district.uniqueId;
          this.notify();
          return true;
        }
        // Resource cells (Forest, built Crops): cooldown-gated collect tap.
        const source = harvestSourceAt(this.state, cell);
        if (source !== null && this.state.fog.revealed[coordKey(cell)]) {
          // A built crop plot is a district too. While it holds Food its tap
          // is the harvest and nothing else; once it is empty there is
          // nothing to reap, so the tap opens its card — the way to Move it.
          if (district && isExhausted(this.state, this.map, cell, this.now())) {
            this.inspectedDistrictId = district.uniqueId;
            this.notify();
            return true;
          }
          this.collectAt(cell);
          this.inspectedDistrictId = null;
          this.notify();
          return true;
        }
        this.inspectedSite = null;
        if (district) {
          this.inspectedDistrictId = district.uniqueId; // open/switch the card
        } else {
          this.inspectedDistrictId = null; // empty ground closes the card
        }
        this.notify();
        return true;
      },
    });
  }

  /** Is this session's first tap still to be noted (Docs/playtest.md §5)?
   *  Only a session that follows an absence is watched — `armReturnTap`. */
  private firstTapNoted = true;

  /**
   * A session that follows an absence of five minutes or more watches for its
   * first tap: what brought the player back. A reload, a crash, a tab put
   * down for a moment is the same sitting, and is not a return.
   */
  armReturnTap(awayMs: number): void {
    this.firstTapNoted = awayMs < 5 * 60_000;
  }

  /**
   * A PLAYTEST SIGNAL: what the first tap of a session was on — a store, the
   * fog, a treasure, a site, a menu — which is what brought the player back.
   * The last thirty sessions are kept.
   */
  private noteFirstTap(kind: string): void {
    if (this.firstTapNoted) return;
    this.firstTapNoted = true;
    const taps = this.state.signals.returnTaps;
    taps.push({ at: this.state.lastAdvance, kind });
    if (taps.length > 30) taps.splice(0, taps.length - 30);
    this.track('return_tap', { kind });
  }

  /** Empty a building's store into the purse, with the tap's own feedback:
   *  the punch on the building, a floater per currency, and the haul flying
   *  to the header. */
  private collectStoreOf(district: District): void {
    this.noteFirstTap('store');
    const moved = collectBuilding(this.state, district.uniqueId, this.now());
    const entries = (Object.entries(moved) as Array<[CurrencyId, number]>).filter(([, n]) => n > 0);
    if (entries.length === 0) return;
    this.tapFeedback(district.location,
      districtCapacity(this.state, district) > 0 ? 'tapHouse' : 'pop');
    for (const [c, n] of entries) this.floaters.add(district.location, `+${formatCount(n)}`, c);
    const box = this.camera.cellToScreen(district.location);
    const from = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    queueMicrotask(() => this.reward(Object.fromEntries(entries), from, true));
  }

  /** Punch + flash + a target-appropriate sound on a successful tap. */
  private tapFeedback(anchor: Coord, sfx: SfxName = 'pop'): void {
    this.tapFx.add(coordKey(anchor));
    playSfx(sfx);
  }

  /**
   * A WORKER's strike: the player's own gesture, performed by somebody else.
   *
   * The same hit on the same cell with the same foley — **no white flash**,
   * which stays the player's signature, and half the volume. That is the whole
   * point of the strike model: automation should look like your hands, slower
   * (`Docs/features/04-harvest.md` §4).
   *
   * Three rules keep thirty woodcutters from becoming a machine gun, and all
   * three are presentation only — dropping a sound or a punch can never change
   * what the sim did, which is what makes it safe to gate them on the camera:
   *
   * - **Only what is on screen.** A hit you cannot see makes no sound.
   * - **Silent zoomed out.** Past the threshold you are looking at a city, not
   *   at a tree, and every cell being audible at once is noise.
   * - **At most three voices**, with extra pitch jitter so two strikes landing
   *   together do not phase-lock into a drone.
   */
  private strikeFeedback(cell: Coord, source: HarvestSourceId): void {
    if (!this.camera.isCellVisible(cell)) return;
    this.tapFx.add(coordKey(cell), STRIKE_PUNCH);
    if (this.camera.zoom < STRIKE_AUDIBLE_ZOOM) return;
    playSfx(TAP_SOUNDS[source], {
      gain: 0.5, jitter: 0.05, group: 'strike', limit: 3,
    });
  }

  /**
   * What a TAP gathered flies from the tapped cell into the header, the way a
   * claimed reward does (ui/rewardFly.ts) — the player's own taps only;
   * crews and rent land as numbers on the map. The burst starts at the
   * cell's centre on screen, which a held press (its repeats are seconds
   * after the pointer went down) could not get from the pointer. Sent after
   * the header has redrawn, so the reward is held back from a total that
   * already includes it.
   */
  private tapReward(cell: Coord, currency: CurrencyId, amount: number): void {
    if (amount <= 0) return;
    const box = this.camera.cellToScreen(cell);
    const from = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    queueMicrotask(() => this.reward({ [currency]: amount }, from, true));
  }

  /** Out of energy, said once and in one place: every tap that spends Mana
   *  refuses the same way, so the player learns one refusal rather than four.
   *  Names the pool, because a silent no reads as a broken tap. */
  private outOfMana(cell: Coord): void {
    playSfx('error');
    this.shake(['Mana']);
    this.floaters.add(cell, 'empty', 'Mana');
  }

  /** One collect on a resource cell, with feedback. */
  private collectAt(cell: Coord): CollectTapResult {
    const source = harvestSourceAt(this.state, cell);
    const units = tapYieldAt(this.state, this.map, cell, this.now()); // before the tap — it may empty the cell
    const result = collectTap(this.state, this.map, cell, this.now());
    if (result === 'Harvested' && source !== null) {
      this.tapFeedback(districtAt(this.state, cell)?.location ?? cell, TAP_SOUNDS[source]);
      this.floaters.add(cell, `+${formatExact(units)}`, HARVEST[source].currencyId);
      this.tapReward(cell, HARVEST[source].currencyId, units);
    } else if (result === 'Exhausted') {
      playSfx('tapEmpty');
      this.floaters.add(cell, isGrowing(this.state, this.map, cell, this.now()) ? '🌱' : '💤');
    } else if (result === 'TechLocked' && source !== null) {
      // Say WHICH research, by name. "You can see it and you cannot have it
      // yet" is the whole point of the gate, and it only teaches anything if
      // the player is told what would open it.
      const gate = HARVEST[source].requiredTech;
      playSfx('error');
      if (gate) this.toast(`Research ${TECHNOLOGIES[gate].name} before you can work this`);
    } else if (result === 'LairHeld') {
      // Say WHO: the refusal is the lair's, and naming it is what sends the
      // player to clear it (Docs/proposals/lairs.md §6). Costs no Mana — the
      // tap is refused before anything is charged.
      const lairId = lairHolding(this.state, cell);
      playSfx('error');
      if (lairId) this.toast(`${holdsThisGround(lairCreature(lairId))}`);
    } else if (result === 'NoMana') {
      this.outOfMana(cell);
    }
    return result;
  }

  // ------------------------------------------------------------ placement mode

  /**
   * Where a ghost appears: the legal cell closest to the Townhall that the
   * player can actually SEE. The closest cell is often right behind the
   * Townhall, whose art stands over it — the ghost then appeared under the
   * roof. So the cells are walked nearest first and the first one whose
   * ground is not hidden behind a building is taken; only if every one is
   * hidden does the nearest win anyway.
   *
   * A building that sends workers out starts where it would WORK THE MOST —
   * a Farm beside the crop plots — and the nearest of those.
   */
  defaultPlacementCell(definitionId: DistrictId): Coord | null {
    const size = DISTRICTS[definitionId].size;
    const works = DISTRICTS[definitionId].harvestSources.length > 0;
    const cells = validPlacementCells(this.state, this.map, definitionId)
      .map((c) => ({
        c, d: townhallDistance(this.map, c), n: works ? this.capturedCells(definitionId, c).length : 0,
      }))
      .sort((a, b) => b.n - a.n || a.d - b.d);
    if (cells.length === 0) return null;
    return (cells.find(({ c }) => !this.hiddenBehindBuilding(c, size)) ?? cells[0]).c;
  }

  /**
   * Is a footprint at `cell` mostly covered by a building's art standing in
   * front of it? Worked on the projected plane (zoom does not matter): a
   * plot's ground diamond has a box (sx + sy) half-tiles wide and half as
   * tall, and a building's art rises from the box's bottom to about 0.85 of
   * its width above it (the Townhall's is 0.75, a house's 0.88).
   */
  private hiddenBehindBuilding(cell: Coord, size: { x: number; y: number }): boolean {
    const HALF_W = 64;
    const HALF_H = 32;
    const ART_RISE = 0.85;
    const box = (c: Coord, s: { x: number; y: number }) => {
      const cx = (c.x + s.x / 2 - (c.y + s.y / 2)) * HALF_W;
      const cy = (c.x + s.x / 2 + (c.y + s.y / 2)) * HALF_H;
      const w = (s.x + s.y) * HALF_W;
      const h = (s.x + s.y) * HALF_H;
      return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2, w };
    };
    const ground = box(cell, size);
    const area = (ground.x1 - ground.x0) * (ground.y1 - ground.y0);
    const depth = cell.x + cell.y + size.x + size.y;
    return this.state.city.districts.some((d) => {
      const s = DISTRICTS[d.definitionId].size;
      // Only a building IN FRONT hides it: nearer the viewer, deeper on screen.
      if (d.location.x + d.location.y + s.x + s.y <= depth) return false;
      const b = box(d.location, s);
      const art = { x0: b.x0, x1: b.x1, y0: b.y1 - b.w * ART_RISE, y1: b.y1 };
      const ox = Math.min(ground.x1, art.x1) - Math.max(ground.x0, art.x0);
      const oy = Math.min(ground.y1, art.y1) - Math.max(ground.y0, art.y0);
      return ox > 0 && oy > 0 && (ox * oy) / area > 0.25;
    });
  }

  /** What a build card quotes: the wait at the cell its ghost would appear
   *  on, so the card and the placement bar say the same number. */
  buildCardDuration(definitionId: DistrictId): number {
    const cell = this.defaultPlacementCell(definitionId) ?? townhall(this.state)?.location;
    return cell ? buildDurationForCell(this.state, definitionId, cell, this.map) : 0;
  }

  startPlacement(definitionId: DistrictId): void {
    // Auto-select the legal cell closest to the Townhall; center the camera on it.
    const selected = this.defaultPlacementCell(definitionId);
    this.ghostHeld = false;
    this.mode = { kind: 'placing', definitionId, selected };
    // Past the ruin and the material Shrines, a Shrine is paid in Gems.
    if (DISTRICTS[definitionId].hostsRelic && shrineBuild(this.state).kind === 'gems') {
      this.mode = { ...this.mode, premium: true };
    }
    this.openOverlay = null;
    this.inspectedDistrictId = null;
    if (selected) {
      this.camera.centerOnCell(selected, DISTRICTS[definitionId].size, CAMERA_GLIDE_MS);
      playSfx('ghostLift', { gain: 0.7 });
    }
    this.notify();
  }

  // ----------------------------------------------------------------- moving

  /** Enter move mode for a built building. The ghost starts where the
   *  building already stands, so the first thing the player sees is the thing
   *  they picked up, not a jump to somewhere else. */
  startMove(districtUniqueId: string, glide = true): void {
    const district = districtById(this.state, districtUniqueId);
    if (!district) return;
    if (!canMoveDistrict(district)) {
      this.toast(district.state === 'Built'
        ? 'The Townhall is where everything is measured from — it stays put'
        : 'Wait until it is finished, or cancel the build');
      this.notify();
      return;
    }
    this.mode = {
      kind: 'moving',
      districtUniqueId,
      definitionId: district.definitionId,
      selected: district.location,
      origin: district.location,
    };
    this.openOverlay = null;
    this.inspectedDistrictId = null;
    // The ghost is out where the building stands: bring it into view, as
    // placement does for a new one — unless a finger is already on it.
    if (glide) this.camera.centerOnCell(district.location, DISTRICTS[district.definitionId].size, CAMERA_GLIDE_MS);
    playSfx('ghostLift');
    this.notify();
  }

  /**
   * A LONG PRESS on a building that may move picks it up: move mode starts
   * with the ghost already under the finger, so the same press carries it.
   * Only from the plain map — no mode, no menu, no tutorial lock.
   */
  holdAt(sx: number, sy: number): boolean {
    if (this.scene !== 'province' || this.mode.kind !== 'normal') return false;
    if (this.openOverlay !== null || this.tapGate !== null) return false;
    const cell = this.camera.screenToCell(sx, sy);
    const district = districtAt(this.state, cell);
    if (!district) return this.holdFeatureAt(cell);
    if (!canMoveDistrict(district)) return false;
    this.startMove(district.uniqueId, false);
    if ((this.mode as Mode).kind !== 'moving') return false;
    this.ghostGrip = { x: cell.x - district.location.x, y: cell.y - district.location.y };
    this.ghostHeld = true;
    this.ghostFx.grab();
    this.notify();
    return true;
  }

  /** Why the ghost may not stand where it is, or null when it may. */
  ghostBlock(): PlacementBlock | null {
    if (this.mode.kind === 'transplanting') {
      const { selected, origin } = this.mode;
      if (selected === null || (selected.x === origin.x && selected.y === origin.y)) return null;
      return transplantBlock(this.state, this.map, origin, selected);
    }
    if (this.mode.kind !== 'placing' && this.mode.kind !== 'moving') return null;
    if (this.mode.selected === null) return null;
    return placementBlock(this.state, this.map, this.mode.definitionId, this.mode.selected,
      this.mode.kind === 'moving' ? this.mode.districtUniqueId : undefined);
  }

  /** The ghost's refusal in words, for the placement window and the toast;
   *  null when it may stand where it is. */
  ghostBlockWords(): string | null {
    const block = this.ghostBlock();
    if (block === null) return null;
    if (this.mode.kind === 'transplanting') return GHOST_BLOCK_WORDS[block];
    if (this.mode.kind !== 'placing' && this.mode.kind !== 'moving') return null;
    return block === 'NeedsHarmony'
      ? this.refusalWords(block, this.mode.definitionId, 1)
      : GHOST_BLOCK_WORDS[block];
  }

  confirmMove(): void {
    if (this.mode.kind !== 'moving' || !this.mode.selected) return;
    const { districtUniqueId, selected, origin } = this.mode;
    const refusal = this.ghostBlockWords();
    if (refusal !== null) {
      this.refuseGhost(refusal);
      return;
    }
    // Putting it back where it started is a cancel, not an error — the player
    // dragged it around, changed their mind, and dropped it home.
    if (selected.x === origin.x && selected.y === origin.y) {
      this.setGhostDown(selected, this.mode.definitionId, true);
      this.mode = { kind: 'normal' };
      this.inspectedDistrictId = districtUniqueId;
      this.notify();
      return;
    }
    const definitionId = this.mode.definitionId;
    const result = moveDistrict(this.state, this.map, districtUniqueId, selected, this.now());
    if (result === 'Moved') {
      this.setGhostDown(selected, definitionId);
      this.mode = { kind: 'normal' };
      // Land back on the card the move was started from: the player is very
      // likely to want the thing they just repositioned.
      this.inspectedDistrictId = districtUniqueId;
    } else {
      this.toast(result === 'InvalidCell' ? 'It will not fit there' : result);
    }
    this.notify();
  }

  // ------------------------------------------------------------ transplanting

  /**
   * A long press on a tree or a crop plot picks it up, as one on a building
   * does (Docs/features/27-plantables.md §4). A tree before Transplanting is
   * refused with a toast naming it, since a press that did nothing on the
   * one thing that looks movable would read as a fault.
   */
  private holdFeatureAt(cell: Coord): boolean {
    const feature = this.state.features[coordKey(cell)];
    if (feature === undefined || !MOVABLE_FEATURES.has(feature)) return false;
    const block = pickUpBlock(this.state, cell);
    if (block === 'NeedsResearch') {
      playSfx('error');
      this.toast(`Research ${TECHNOLOGIES[TRANSPLANTING].name} before you can move trees`);
      this.notify();
      return false;
    }
    if (block !== null) return false;
    this.mode = { kind: 'transplanting', feature, selected: cell, origin: cell };
    this.inspectedDistrictId = null;
    this.ghostGrip = { x: 0, y: 0 };
    this.ghostHeld = true;
    this.ghostFx.grab();
    playSfx('ghostLift');
    haptic(10);
    this.notify();
    return true;
  }

  /** Can a long press here pick something up? What the hold ring asks
   *  before it shows (render/input.ts). */
  canHoldAt(sx: number, sy: number): boolean {
    if (this.scene !== 'province' || this.mode.kind !== 'normal') return false;
    if (this.openOverlay !== null || this.tapGate !== null) return false;
    const cell = this.camera.screenToCell(sx, sy);
    const district = districtAt(this.state, cell);
    if (district) return canMoveDistrict(district);
    const feature = this.state.features[coordKey(cell)];
    return feature !== undefined && MOVABLE_FEATURES.has(feature)
      && this.state.fog.revealed[coordKey(cell)] === true;
  }

  /** What a moved feature will be: its name, its art, and how long it
   *  grows wherever it lands. */
  transplantInfo(): {
    feature: FeatureId; name: string; sprite: string; glyph: string;
    growSeconds: number; unmoved: boolean; blocked: string | null;
  } | null {
    if (this.mode.kind !== 'transplanting') return null;
    const { feature, selected, origin } = this.mode;
    const def = FEATURES[feature];
    return {
      feature, name: def.name, sprite: def.sprite, glyph: def.glyph,
      growSeconds: HARVEST[def.source].growSeconds,
      unmoved: selected === null || (selected.x === origin.x && selected.y === origin.y),
      blocked: this.ghostBlockWords(),
    };
  }

  confirmTransplant(): void {
    if (this.mode.kind !== 'transplanting' || !this.mode.selected) return;
    const { selected, origin } = this.mode;
    const refusal = this.ghostBlockWords();
    if (refusal !== null) {
      this.refuseGhost(refusal);
      return;
    }
    // Put back where it started: a cancel, and its growth or its Wood kept.
    if (selected.x === origin.x && selected.y === origin.y) {
      this.ghostFx.land(coordKey(selected), selected, { x: 1, y: 1 });
      playSfx('ghostStep', { rate: 0.85 });
      this.mode = { kind: 'normal' };
      this.notify();
      return;
    }
    const result = transplant(this.state, this.map, origin, selected, this.now());
    if (result === 'Moved') {
      this.ghostFx.land(coordKey(selected), selected, { x: 1, y: 1 });
      playSfx('ghostPlant');
      haptic(20);
      this.mode = { kind: 'normal' };
    } else {
      this.toast(result in GHOST_BLOCK_WORDS ? GHOST_BLOCK_WORDS[result as PlacementBlock] : 'It cannot go there');
    }
    this.notify();
  }

  // --------------------------------------------------------------- casting

  /** Enter cast mode, or cast immediately when the ability needs no target. */
  startCast(artifactId: ArtifactId): void {
    const active = ARTIFACTS[artifactId].active;
    if (active === null) return;
    const block = castBlock(this.state, artifactId, this.now());
    if (block !== null) {
      if (block === 'NotEnoughMana') this.shake(['Mana']);
      else if (block === 'NotOwned') this.toast('Finish its album first');
      else if (block === 'Active') this.toast(`${active.name} is still running`);
      else if (block === 'OnCooldown') this.toast(`${ARTIFACTS[artifactId].name} needs to rest`);
      this.notify();
      return;
    }
    if (!active.targeted) {
      this.doCast(artifactId, null);
      return;
    }
    const valid = validCastCells(this.state, this.map, artifactId);
    if (valid.length === 0) {
      this.toast(`Nowhere to cast ${active.name} right now`);
      this.notify();
      return;
    }
    // Start on the legal cell nearest the Townhall, exactly as placement does.
    let selected: Coord | null = null;
    let best = Infinity;
    for (const c of valid) {
      const d = townhallDistance(this.map, c);
      if (d < best) {
        best = d;
        selected = c;
      }
    }
    this.mode = { kind: 'casting', artifactId, selected };
    this.openOverlay = null;
    // Cast mode closes the sheet without going through `setOverlay`, so the
    // open card has to be forgotten here as well — otherwise the next visit
    // to the Reliquary lands inside whatever was last cast.
    this.openRelicId = null;
    this.inspectedDistrictId = null;
    this.inspectedSite = null;
    if (selected) this.camera.centerOnCell(selected, undefined, CAMERA_GLIDE_MS);
    this.notify();
  }

  confirmCast(): void {
    if (this.mode.kind !== 'casting') return;
    this.doCast(this.mode.artifactId, this.mode.selected);
  }

  private doCast(artifactId: ArtifactId, picked: Coord | null): void {
    const report = cast(this.state, this.map, artifactId, picked, this.now());
    const target = picked;
    if (report.result !== 'Cast') {
      if (report.result === 'NotEnoughMana') this.shake(['Mana']);
      else if (report.result === 'NotHosted') this.toast('Hold it in a Chapel first');
      else this.toast('That cannot be cast there');
      this.notify();
      return;
    }
    playSfx('spellCast');
    this.mode = { kind: 'normal' };
    for (const c of report.affected) this.tapFx.add(coordKey(c));
    if (report.goldSaved > 0 && target) {
      this.floaters.add(target, `Saved ${formatExact(report.goldSaved)}`, 'Gold');
    }
    this.notify();
  }

  /**
   * ACTIVATE A CITY RELIC in its Shrine (sim/hosts.ts): Mana paid, and its
   * effect reaches the aura for the Shrine's window.
   */
  doActivateRelic(id: ArtifactId): void {
    const result = activateRelic(this.state, id, this.now());
    if (result !== 'Activated') {
      if (result === 'NotEnoughMana') this.shake(['Mana']);
      else if (result === 'NotHosted') this.toast('Host it in a Shrine first');
      else if (result === 'Active') this.toast(`${ARTIFACTS[id].name} is already awake`);
      this.notify();
      return;
    }
    playSfx('relicWake');
    this.asleepNotices = this.asleepNotices.filter((r) => r !== id);
    const host = hostOf(this.state, id);
    if (host !== null) {
      const aura = auraOf(this.state, host, id);
      for (const c of this.map.cells.filter((c) => areaCovers(aura, c))) {
        this.tapFx.add(coordKey(c));
      }
      // What it does and for how long, over the Shrine, and the Mana it
      // took (M85).
      const window = formatDuration(Math.round(relicWindowMs(this.state, id) / 1000));
      this.floaters.add(host.location, `${relicShortEffect(id, passiveValue(this.state, id))} \u00b7 ${window}`);
      this.floaters.add({ x: host.location.x, y: host.location.y - 1 }, `\u2212${formatExact(activationCost(this.state, id))}`, 'Mana');
      this.relicBursts.push({
        centre: host.location, size: DISTRICTS[host.definitionId].size, radius: aura.radius, at: performance.now(),
      });
    }
    // A faster crew starts its next leg faster: wake the idle ones now.
    wakeIdleWorkersAt(this.state, this.now());
    this.notify();
  }

  /** A city relic's activation as its card and its Shrine's card read it. */
  relicActivation(id: ArtifactId): RelicActivationView | null {
    const def = ARTIFACTS[id];
    if (def.activation === null) return null;
    const host = hostOf(this.state, id);
    const now = this.now();
    const awake = isAwake(this.state, id);
    const endsAt = this.state.artifacts.casts[id]?.endsAt ?? now;
    const cost = activationCost(this.state, id);
    return {
      hosted: host !== null,
      awake,
      leftMs: awake ? Math.max(0, endsAt - now) : 0,
      windowMs: relicWindowMs(this.state, id),
      cost,
      affordable: mana(this.state) >= cost,
      radius: auraRadiusAt(id, artifactLevel(this.state, id)),
      block: activateBlock(this.state, id),
      regenPerHour: manaProduction(this.state),
      readyInMs: (() => {
        const short = cost - mana(this.state);
        const rate = manaProduction(this.state);
        if (short <= 0) return null;
        return rate > 0 ? Math.ceil((short / rate) * 3_600_000) : Infinity;
      })(),
      flask: this.smallestFlask(),
    };
  }

  /** The smallest Mana flask the Bag holds, or null. */
  private smallestFlask(): { id: ItemId; count: number } | null {
    const held = (Object.keys(ITEMS) as ItemId[])
      .filter((i) => ITEMS[i].kind === 'flask' && itemCount(this.state, i) > 0)
      .sort((a, b) => ITEMS[a].value - ITEMS[b].value);
    return held.length === 0 ? null : { id: held[0]!, count: itemCount(this.state, held[0]!) };
  }

  /** Drink the smallest Mana flask, from a relic short of its price. */
  doUseFlaskFor(id: ArtifactId): void {
    const flask = this.relicActivation(id)?.flask ?? null;
    if (flask !== null) this.doUseItem(flask.id, 1);
  }

  /**
   * THE RELICS THAT FELL ASLEEP since the player last looked (M85): their
   * windows closed, live or while away, and nobody has woken them or opened
   * them since. The right-edge pill reads this; it is the presenter's, not
   * the save's, so a reload forgets it.
   */
  private asleepNotices: ArtifactId[] = [];

  /** The pill's subject: the first relic asleep, how many are, and what the
   *  first one costs to wake. Null while there is nothing to say. */
  asleepNotice(): { relic: ArtifactId; count: number; cost: number; affordable: boolean } | null {
    this.asleepNotices = this.asleepNotices.filter((r) => hostOf(this.state, r) !== null && !isAwake(this.state, r));
    const relic = this.asleepNotices[0];
    if (relic === undefined) return null;
    const cost = activationCost(this.state, relic);
    return { relic, count: this.asleepNotices.length, cost, affordable: mana(this.state) >= cost };
  }

  /** The pill's body: the one relic's sheet, or the Bag's Relics for many. */
  openAsleepNotice(): void {
    const n = this.asleepNotice();
    if (n === null) return;
    if (n.count === 1) this.openRelic(n.relic);
    else {
      this.asleepNotices = [];
      this.closeRelic();
    }
  }

  /** A woken relic's flourish on the map (M85), on the wall clock: a ring
   *  sweeping out over its aura for a second and a half. */
  private relicBursts: Array<{ centre: Coord; size: { x: number; y: number }; radius: number; at: number }> = [];

  /** Every Shrine holding a relic, for the map (M84). */
  private shrineRelics(): MarkerLayer['shrineRelics'] {
    const have = mana(this.state);
    return shrines(this.state).flatMap((d) => {
      const relic = d.hosts;
      if (relic === undefined || artifactLevel(this.state, relic) < 1) return [];
      const cost = activationCost(this.state, relic);
      const awake = isAwake(this.state, relic);
      const endsAt = this.state.artifacts.casts[relic]?.endsAt ?? 0;
      return [{
        relic, districtId: d.uniqueId, location: d.location, size: DISTRICTS[d.definitionId].size,
        sprite: ARTIFACTS[relic].sprite,
        awake, cost, affordable: have >= cost,
        left: awake ? Math.max(0, Math.min(1, (endsAt - this.now()) / Math.max(1, relicWindowMs(this.state, relic)))) : 0,
      }];
    });
  }

  /**
   * WHAT AN AWAKE AURA PAYS THE BUILDINGS IN IT (M84), one badge a roof — on
   * what the relic actually moves: the Crown's houses with residents, the
   * Hammer's buildings with a crew or that train. The Staff and the Sickle
   * move the GROUND, which the tint already says.
   */
  private auraBadges(): MarkerLayer['auraBadges'] {
    const out: MarkerLayer['auraBadges'] = [];
    for (const host of shrines(this.state)) {
      const relic = host.hosts;
      if (relic === undefined || !isAwake(this.state, relic)) continue;
      if (worksOnGround(relic)) continue;
      const reaches = (d: District) => reachesBuilding(this.state, relic, d);
      const text = `+${relicPercent(passiveValue(this.state, relic))}`;
      const aura = auraOf(this.state, host, relic);
      for (const d of this.state.city.districts) {
        if (d.state !== 'Built' || d === host || !reaches(d) || !buildingInAura(aura, d)) continue;
        out.push({ districtId: d.uniqueId, location: d.location, size: DISTRICTS[d.definitionId].size, text });
      }
    }
    return out;
  }

  /**
   * EVERY SPELL STANDING ON THE MAP, for the renderer (§11.6).
   *
   * ONE ENTRY PER CAST, not per modifier: the Winged Hammer places two —
   * the swing and the walk — and two wheels counting down the same window on
   * the same cell would read as two spells. They are grouped by the relic and
   * the instant it was cast, which is exactly what identifies a cast.
   */
  spellZones(): Array<{
    relic: ArtifactId; glyph: string; centre: Coord; cells: Coord[];
    /** The relic's art for the wheel's face; `wheel: false` draws none. */
    sprite?: string; wheel?: boolean;
    /** 1 at the cast, 0 as it closes — the wheel's sweep. */
    left: number;
    leftMs: number;
  }> {
    const now = this.now();
    const byCast = new Map<string, Modifier>();
    for (const m of activeZones(this.state)) {
      byCast.set(`${m.area!.relic}:${m.area!.since}`, m);
    }
    // An awake city relic's aura. NO WHEEL: the relic floats over its Shrine
    // and counts its own window down (`shrineRelics`), so a wheel bearing
    // the same art on the same spot would show it twice.
    const awake = shrines(this.state).flatMap((host) => {
      const relic = host.hosts;
      if (relic === undefined || !isAwake(this.state, relic)) return [];
      const c = this.state.artifacts.casts[relic]!;
      const span = Math.max(1, relicWindowMs(this.state, relic));
      const area = auraOf(this.state, host, relic);
      return [{
        relic,
        glyph: ARTIFACTS[relic].glyph,
        sprite: ARTIFACTS[relic].sprite,
        wheel: false,
        centre: host.location,
        cells: this.map.cells.filter((cell) => areaCovers(area, cell)),
        left: Math.max(0, Math.min(1, (c.endsAt - now) / span)),
        leftMs: Math.max(0, c.endsAt - now),
      }];
    });
    return [...awake, ...[...byCast.values()].map((m) => {
      const { centre, radius, relic, since } = m.area!;
      const area = m.area!;
      const ends = m.expiresAt ?? now;
      const span = Math.max(1, ends - since);
      return {
        relic,
        glyph: ARTIFACTS[relic].glyph,
        centre,
        // A Shrine's aura is its footprint and the ring round it.
        cells: area.size !== undefined
          ? this.map.cells.filter((c) => areaCovers(area, c))
          : [centre, ...cellsWithinRadius(this.map, centre, radius)],
        left: Math.max(0, Math.min(1, (ends - now) / span)),
        leftMs: Math.max(0, ends - now),
      };
    })];
  }

  /** The cast preview the panel and the renderer both read. */
  castInfo(): {
    artifactId: ArtifactId; cell: Coord | null; manaCost: number; affordable: boolean;
    saving: number;
  } | null {
    if (this.mode.kind !== 'casting') return null;
    const { artifactId, selected } = this.mode;
    const active = ARTIFACTS[artifactId].active!;
    return {
      artifactId,
      cell: selected,
      manaCost: active.manaCost,
      affordable: mana(this.state) >= active.manaCost,
      // The Gold a Survey would save — the whole zone's fog, not one cell's.
      saving: active.id === 'Survey' && selected
        ? surveyCells(this.state, this.map, selected, activeRadius(this.state, artifactId))
          .reduce((n, c) => n + divinationSaving(this.state, this.map, c), 0)
        : 0,
    };
  }

  // ---------------------------------------------------------------- relics

  /**
   * A RELIC'S SHEET (Docs/art/ui-relics.md §2): its six slots, what it does
   * now and next, and the one thing to press — Restore or Level up.
   */
  relicCard(id: ArtifactId): RelicView {
    const def = ARTIFACTS[id];
    const level = artifactLevel(this.state, id);
    const restored = level >= 1;
    const slots = Array.from({ length: 6 }, (_, s) => slotCount(this.state, id, s));
    return {
      id, name: def.name, sprite: def.sprite, glyph: def.glyph, kind: relicKind(id),
      level, restored, met: isMet(this.state, id), slots,
      levelStardust: levelStardust(Math.max(1, level)), hasSet: slots.every((n) => n > 0),
      canRestore: canRestore(this.state, id),
      now: relicEffectText(id, passiveValue(this.state, id)),
      next: relicEffectText(id, nextPassiveValue(this.state, id)),
      pending: def.pending,
      cast: this.castPhase(id),
      host: restored && relicKind(id) === 'world' ? {
        at: (() => {
          const c = this.myChapels().find((x) => x.relic === id);
          return c === undefined ? null : `the Chapel of a ${c.name}`;
        })(),
        shrines: this.myChapels().filter((c) => c.relic !== id).map((c) => ({
          shrineId: String(c.index),
          label: `Chapel · ${c.name}`,
          holds: c.relic === null ? null : ARTIFACTS[c.relic].name,
        })),
      } : restored && relicKind(id) === 'city' ? {
        at: this.hostLabel(id),
        shrines: shrines(this.state).filter((d) => d.hosts !== id).map((d) => ({
          shrineId: d.uniqueId,
          label: districtLabel(this.state, d),
          holds: d.hosts === undefined ? null : ARTIFACTS[d.hosts].name,
        })),
      } : null,
      effect: relicShortEffect(id, passiveValue(this.state, id)),
      status: !restored ? 'broken'
        : relicKind(id) === 'world' ? (this.state.world.chapels.includes(id) ? 'chapel' : 'bag')
          : isAwake(this.state, id) ? 'awake'
            : hostOf(this.state, id) !== null ? 'asleep' : 'bag',
    };
  }

  /** Which Shrine holds a relic, by name, or null. */
  private hostLabel(id: ArtifactId): string | null {
    const host = hostOf(this.state, id);
    return host === null ? null : districtLabel(this.state, host);
  }

  /** A Shrine's section of its card. */
  shrineView(district: District): ShrineView {
    return {
      holds: district.hosts ?? null,
      radius: auraRadiusAt(district.hosts ?? 'GildedLedger', district.hosts === undefined ? 1 : artifactLevel(this.state, district.hosts)),
      windowMs: district.hosts === undefined ? 0 : relicWindowMs(this.state, district.hosts),
      candidates: ARTIFACT_ORDER
        .filter((id) => relicKind(id) === 'city' && artifactLevel(this.state, id) >= 1 && id !== district.hosts)
        .map((id) => ({ id, name: ARTIFACTS[id].name, at: this.hostLabel(id) })),
    };
  }

  /** A relic's level, for a line that names it. */
  relicLevel(id: ArtifactId): number {
    return artifactLevel(this.state, id);
  }

  /** The player's restored world relics: what a Chapel could host. */
  worldRelicsRestored(): ArtifactId[] {
    return ARTIFACT_ORDER.filter((id) => relicKind(id) === 'world' && artifactLevel(this.state, id) >= 1);
  }

  /** The player's own hexes with a Chapel, and the relic in each. */
  private myChapels(): Array<{ index: number; name: string; relic: ArtifactId | null }> {
    const snap = this.worldView;
    if (snap === null) return [];
    return snap.hexes.filter((h) => h.owner === snap.board.seat && h.held && h.chapel === true).map((h) => ({
      index: h.index, name: WORLD_BUILD.districts[h.district].name, relic: h.relic?.id ?? null,
    }));
  }

  /** Host a world relic in the Chapel on a hex, at its level: the server
   *  holds it, and says so in the snapshot (relic-restoration.md §5.2). */
  async doHostWorldRelic(id: ArtifactId, index: number): Promise<void> {
    if (this.worldServer === null) return;
    const r = await this.worldServer.hostRelic(index, id, artifactLevel(this.state, id));
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    playSfx('buildPlaced');
    this.track('relic_hosted', { relic: id, world: true });
    this.applyWorldSnapshot(r.snapshot);
  }

  async doUnhostWorldRelic(id: ArtifactId): Promise<void> {
    if (this.worldServer === null) return;
    const r = await this.worldServer.unhostRelic(id);
    if (r.ok) {
      playSfx('click');
      this.applyWorldSnapshot(r.snapshot);
    } else this.notify();
  }

  /** Host a city relic in a Shrine (sim/hosts.ts), or a world relic in the
   *  Chapel on a hex (its `shrineId` is the hex's index). */
  doHostRelic(id: ArtifactId, shrineId: string): void {
    if (relicKind(id) === 'world') {
      void this.doHostWorldRelic(id, Number(shrineId));
      return;
    }
    if (hostRelic(this.state, id, shrineId, this.now()) === 'Hosted') {
      playSfx('buildPlaced');
    }
    this.notify();
  }

  /** Take a relic out of its Shrine, or its Chapel. */
  doUnhostRelic(id: ArtifactId): void {
    if (relicKind(id) === 'world') {
      void this.doUnhostWorldRelic(id);
      return;
    }
    if (unhostRelic(this.state, id, this.now())) playSfx('click');
    this.notify();
  }

  /** The Bag's Relics tab (M72): every relic met, city then world. */
  relicRows(): RelicView[] {
    return ARTIFACT_ORDER.filter((id) => isMet(this.state, id)).map((id) => this.relicCard(id))
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'city' ? -1 : 1));
  }

  doRestoreRelic(id: ArtifactId): void {
    if (restoreRelic(this.state, id) === 'Restored') {
      playSfx('questComplete');
      this.toast(`The ${ARTIFACTS[id].name} is restored`);
    }
    this.notify();
  }

  doLevelRelic(id: ArtifactId): void {
    const result = levelUpRelic(this.state, id);
    if (result === 'Levelled') {
      playSfx('questComplete');
      // A world relic in a Chapel acts at the level the server holds: send it.
      const chapel = relicKind(id) === 'world' ? this.myChapels().find((c) => c.relic === id) : undefined;
      if (chapel !== undefined) void this.doHostWorldRelic(id, chapel.index);
    } else this.shake(result === 'NotEnoughStardust' ? ['Stardust'] : []);
    this.notify();
  }

  /** The store's fragment pack: random fragments of the relics met. */
  fragmentPackOffer(): { gems: number; size: number; available: boolean } {
    return {
      gems: RELIC_RULES.fragmentPackGems, size: RELIC_RULES.fragmentPackSize,
      available: ARTIFACT_ORDER.some((id) => isMet(this.state, id)),
    };
  }

  doBuyFragmentPack(): void {
    const result = openFragmentPack(this.state);
    if (result.kind === 'Opened') {
      playSfx('gemSpend');
      // Dealt on the gacha's reveal, one piece at a time, same piece counted
      // once; they fly to the Bag as the reveal closes (ui/rewardFly.ts).
      const prizes: GachaPrize[] = [];
      for (const d of result.drops) {
        const same = prizes.find((p) => p.kind === 'relicFragment' && p.relic === d.relic && p.slot === d.slot);
        if (same !== undefined && same.kind === 'relicFragment') same.amount += 1;
        else prizes.push({ kind: 'relicFragment', relic: d.relic, slot: d.slot, amount: 1 });
      }
      // The keystones last, as heroes come last on a call: what the pack is for.
      prizes.sort((a, b) => Number(a.kind === 'relicFragment' && a.slot === 5) - Number(b.kind === 'relicFragment' && b.slot === 5));
      this.gachaReveal = { prizes, caption: 'Relic fragments', chest: 'relic' };
    } else if (result.kind === 'NotEnoughGems') this.shake(['Gems']);
    this.notify();
  }

  /** The relic sheet's way to more fragments: the store, at its pack. */
  openStoreForFragments(): void {
    this.openStore('supplies');
  }

  /** The store, on a tab — or on the one it opens on: Offers when there are
   *  any, else Heroes. */
  openStore(tab?: StoreTab): void {
    this.storeTabPick = tab ?? null;
    this.setOverlay('store');
  }

  setStoreTab(tab: StoreTab): void {
    this.storeTabPick = tab;
    this.notify();
  }

  /** The store's tabs, and the open one. Offers only while there is an offer
   *  or a daily offer to show. */
  storeTabs(): { tabs: StoreTab[]; open: StoreTab } {
    const offers = this.offerCards().length > 0 || this.dailyCards().cards.length > 0;
    const tabs: StoreTab[] = [...(offers ? ['offers' as const] : []), 'heroes', 'supplies', 'gems'];
    const pick = this.storeTabPick;
    return { tabs, open: pick !== null && tabs.includes(pick) ? pick : tabs[0] };
  }

  /** The three-state walk, as the card reads it. `leftMs` is derived from a
   *  timestamp every frame, so a throttled tab comes back correct rather than
   *  frozen mid-countdown. */
  castPhase(id: ArtifactId): { phase: CastPhase; leftMs: number; charges: number } {
    const now = this.now();
    const { phase, until } = castState(this.state, id, now);
    return {
      phase,
      leftMs: until === null ? 0 : Math.max(0, until - now),
      // An ability counted in EVENTS has no clock to show, so the card says
      // how many uses are left instead of how long is left.
      charges: chargesLeft(this.state, id),
    };
  }

  /** The sentence a Legendary's card prints under its trait, or null on the
   *  26 heroes that carry no boon (Docs/proposals/legendary-boons.md). */
  heroBoonText(id: HeroId): string | null {
    const { boon } = HEROES[id];
    return boon === null ? null : boonText(boon);
  }

  /** Open a relic's sheet, over the Bag it was opened from. */
  openRelic(id: ArtifactId): void {
    this.asleepNotices = this.asleepNotices.filter((r) => r !== id);
    this.openRelicId = id;
    this.setOverlay('relic');
  }

  /** Back to the Bag's Relics tab. */
  closeRelic(): void {
    this.openRelicId = null;
    this.bagTab = 'Relics';
    this.setOverlay('bag');
  }

  /**
   * The store's BUNDLE shelf (§6.1): star packs and wildcards for money.
   *
   * Empty in the last hours of a season — a bundle is two things the close
   * wipes, so the store withdraws it rather than sell an hour of it. The UI
   * renders no shelf at all rather than a row explaining why, because a
   * withdrawn product is not an offer.
   */
  /** The Bag's bundles, as the store's item shelf draws them: what each
   *  holds, and — for the speed-ups — what that time would cost in Gems at
   *  the rush price, the comparison the shelf exists to offer. */
  itemBundleOffers(): Array<{ id: StoreSkuId; name: string; priceCents: number; sprite: string; lines: string[]; gemValue: number }> {
    return ITEM_BUNDLE_ORDER.map((id) => {
      const sku = STORE[id];
      const seconds = (Object.entries(sku.items) as Array<[ItemId, number]>)
        .reduce((s, [item, n]) => s + (ITEMS[item].kind === 'speedup' ? ITEMS[item].seconds * n : 0), 0);
      return {
        id, name: sku.name, priceCents: priceCents(id), sprite: sku.sprite,
        lines: this.bundleLines(id), gemValue: seconds > 0 ? gemsToFinish(seconds) : 0,
      };
    });
  }

  /** What a product hands over besides its Gems, one line a thing — the
   *  shelf's body and the confirmation's grant. The things for good first. */
  bundleLines(id: StoreSkuId): string[] {
    const s = STORE[id];
    const forGood = (n: number, one: string, many: string): string[] =>
      n <= 0 ? [] : [`${n === 1 ? `A ${one}` : `${formatExact(n)} ${many}`}, for good`];
    return [
      ...(s.hero === null ? [] : [`${HEROES[s.hero].name}, ${HEROES[s.hero].rarity.toLowerCase()} hero`]),
      ...forGood(s.builders, 'builder', 'builders'),
      ...forGood(s.explorers, 'second explorer', 'explorers'),
      ...forGood(s.heroSlots, 'hero slot', 'hero slots'),
      ...(Object.entries(s.items) as Array<[ItemId, number]>)
        .map(([item, n]) => `${formatExact(n)}× ${itemWords(item)}`),
    ];
  }

  /** One offer as a card draws it: what it holds, what it is worth, how long
   *  it lasts and how many are left. */
  private offerCard(id: StoreSkuId, closesAt: number | null, left: number | null): OfferCard {
    const s = STORE[id];
    return {
      id, name: s.name, description: s.description, sprite: s.sprite, priceCents: priceCents(id),
      gems: s.gems, lines: this.bundleLines(id), valuePercent: skuValuePercent(this.state, id), closesAt, left,
    };
  }

  /** The offers on sale now, in shelf order (sim/offers.ts). */
  offerCards(): OfferCard[] {
    const now = this.now();
    return offersOn(this.state, now).map((id) => {
      const w = offerWindow(this.state, id)!;
      const { limit } = STORE[id];
      return this.offerCard(id, w.closes, limit > 0 ? limit - w.bought : null);
    });
  }

  /** Today's daily offers, each with what is left of it today; the draw
   *  changes at `resetsAt`. */
  dailyCards(): { cards: OfferCard[]; resetsAt: number } {
    const now = this.now();
    const resetsAt = dailyResetsAt(now);
    return {
      resetsAt,
      cards: dailyOffers(this.state, now).map((id) => {
        const { limit } = STORE[id];
        return this.offerCard(id, resetsAt, limit > 0 ? Math.max(0, limit - boughtToday(this.state, id, now)) : null);
      }),
    };
  }

  /** A product's tiles, as the offer splash draws them: what lands now
   *  and what lands the next day. */
  offerTiles(id: StoreSkuId): { now: OfferTile[]; nextDay: OfferTile[] } {
    const s = STORE[id];
    const items = (m: Partial<Record<ItemId, number>>): OfferTile[] =>
      (Object.entries(m) as Array<[ItemId, number]>).map(([item, n]) => ({
        kind: 'item', id: item, count: n, worth: chestValue(this.state, item),
      }));
    return {
      now: [
        ...(s.hero === null ? [] : [{ kind: 'hero' as const, id: s.hero, count: 1 }]),
        ...items(s.items),
        ...(s.gems > 0 ? [{ kind: 'coin' as const, id: 'Gems', count: s.gems }] : []),
      ],
      nextDay: [
        ...(s.hero !== null && s.nextDayFragments > 0 ? [{ kind: 'fragments' as const, id: s.hero, count: s.nextDayFragments }] : []),
        ...(s.nextDayGems > 0 ? [{ kind: 'coin' as const, id: 'Gems', count: s.nextDayGems }] : []),
        ...(s.nextDayHeroXp > 0 ? [{ kind: 'coin' as const, id: 'HeroXp', count: s.nextDayHeroXp }] : []),
        ...items(s.nextDayItems),
      ],
    };
  }

  /**
   * The offer splash on screen (Docs/features/14-monetization.md §2.6):
   * a next-day part ready to claim first; otherwise a `splash` offer on sale
   * whose window opened BEFORE this session began — it is the next session
   * that shows it — and that this session has not closed yet. It waits for
   * the map to be free: no sheet, no fight, no reveal, no video, no unlock.
   */
  offerSplash(): OfferSplashView | null {
    if (this.payerDue() || this.openOverlay !== null) return null;
    if (this.battle !== null || this.gachaReveal !== null || this.adWatch() !== null) return null;
    if (this.unlockOnScreen() !== null) return null;
    const now = this.now();
    const ready = nextDayReady(this.state, now).find((sku) => !this.splashesClosed.has(`claim:${sku}`));
    if (ready !== undefined) return { sku: ready, mode: 'claim', browse: false, auto: true };
    const sku = OFFER_ORDER.find((id) => STORE[id].splash && offerOn(this.state, id, now)
      && offerWindow(this.state, id)!.opened < this.sessionStartedAt && !this.splashesClosed.has(`buy:${id}`));
    return sku === undefined ? null : { sku, mode: 'buy', browse: false, auto: true };
  }

  /** The offer splash again, from the store or the offers widget: the same
   *  screen, whatever the session has closed. `browse` — opened from the
   *  widget — adds the row of every offer on the map along its top, to step
   *  from one to the next. */
  openOfferSplash(sku: StoreSkuId, browse = false): void {
    // From a sheet (the store), the splash goes back to it when closed.
    if (this.openOverlay !== null) this.splashReturn = this.openOverlay;
    const ready = nextDayReady(this.state, this.now()).includes(sku);
    this.splashesClosed.delete(`${ready ? 'claim' : 'buy'}:${sku}`);
    this.offerSplashForced = {
      sku, browse, auto: false,
      mode: ready ? 'claim' : nextDayWaiting(this.state, this.now()).some((d) => d.sku === sku) ? 'waiting' : 'buy',
    };
    this.setOverlay(null);
  }

  /** What the splash mount draws: the one forced open, else the session's. */
  offerSplashOnScreen(): OfferSplashView | null {
    if (this.offerSplashForced !== null) return this.offerSplashForced;
    return this.offerSplash();
  }

  closeOfferSplash(): void {
    const on = this.offerSplashOnScreen();
    if (on !== null) this.splashesClosed.add(`${on.mode === 'claim' ? 'claim' : 'buy'}:${on.sku}`);
    this.offerSplashForced = null;
    const back = this.splashReturn;
    this.splashReturn = null;
    if (back !== null) {
      this.backFromSplash = true;
      this.setOverlay(back);
      this.backFromSplash = false;
    }
    this.notify();
  }

  /** The splash's price: straight to the confirmation, which returns to the
   *  map. */
  buyFromSplash(sku: StoreSkuId): void {
    this.splashesClosed.add(`buy:${sku}`);
    this.offerSplashForced = null;
    const back = this.splashReturn;
    this.splashReturn = null;
    this.openIap(sku, back);
  }

  doClaimNextDay(sku: StoreSkuId): void {
    const s = STORE[sku];
    if (claimNextDay(this.state, sku, this.now()) !== 'Claimed') return;
    playSfx('questComplete');
    this.reward({ ...(s.nextDayGems > 0 ? { Gems: s.nextDayGems } : {}), ...(s.nextDayHeroXp > 0 ? { HeroXp: s.nextDayHeroXp } : {}) });
    if (s.hero !== null && s.nextDayFragments > 0) {
      this.toast(`${formatExact(s.nextDayFragments)} fragments of ${HEROES[s.hero].name}`);
    }
    this.offerSplashForced = null;
    this.notify();
  }

  /** What an offer's splash draws beside its rewards: its window and what
   *  is left of it, its value, its step in a chain ("I / III") and the slots
   *  it opens for good. */
  offerSale(sku: StoreSkuId): OfferSale {
    const s = STORE[sku];
    const w = offerWindow(this.state, sku);
    // The chain it belongs to: back along `after` to its first step, then
    // forward to its last.
    let first: StoreSkuId = sku;
    while (STORE[first].after !== null) first = STORE[first].after!;
    const chain: StoreSkuId[] = [first];
    for (let next = OFFER_ORDER.find((id) => STORE[id].after === first); next !== undefined;
      next = OFFER_ORDER.find((id) => STORE[id].after === chain[chain.length - 1])) chain.push(next);
    return {
      closesAt: w?.closes ?? null,
      left: s.limit > 0 ? Math.max(0, s.limit - (w?.bought ?? 0)) : null,
      once: s.limit === 1 && !offerComesBack(sku),
      valuePercent: skuValuePercent(this.state, sku),
      chain: chain.length > 1 ? { at: chain.indexOf(sku) + 1, of: chain.length } : null,
      gifts: [
        ...(s.builders > 0 ? [{ icon: 'builder' as const, title: s.builders === 1 ? 'A second builder' : `${formatExact(s.builders)} builders`, text: 'Build two things at once' }] : []),
        ...(s.explorers > 0 ? [{ icon: 'explorer' as const, title: 'A second explorer', text: 'Explore the world with one more at once' }] : []),
        ...(s.heroSlots > 0 ? [{ icon: 'heroSlot' as const, title: 'A hero slot', text: 'One more hero in every party' }] : []),
      ],
      nextDayAt: nextDayWaiting(this.state, this.now()).find((d) => d.sku === sku)?.claimableAt ?? null,
    };
  }

  /** The pill for a bought product's next-day part: ready, or when. A
   *  product with a widget on the map says it there instead. */
  nextDayPill(): { sku: StoreSkuId; ready: boolean; at: number } | null {
    const now = this.now();
    const ready = nextDayReady(this.state, now).find((sku) => !STORE[sku].widget);
    if (ready !== undefined) return { sku: ready, ready: true, at: now };
    const waiting = nextDayWaiting(this.state, now).find((d) => !STORE[d.sku].widget);
    return waiting === undefined ? null : { sku: waiting.sku, ready: false, at: waiting.claimableAt };
  }

  /** The offers floating on the map under the Survey (ui/offerWidget.ts):
   *  each `widget` offer on sale, or bought with its next-day part still to
   *  claim — counting down to it, or ready. */
  offerWidgets(): OfferWidget[] {
    const now = this.now();
    const rank = { ready: 0, sale: 1, waiting: 2 } as const;
    return OFFER_ORDER.filter((id) => STORE[id].widget).flatMap((sku): OfferWidget[] => {
      const s = STORE[sku];
      const base = { sku, name: s.name, sprite: s.sprite, hero: s.hero };
      if (nextDayReady(this.state, now).includes(sku)) return [{ ...base, state: 'ready' as const, at: now }];
      const waiting = nextDayWaiting(this.state, now).find((d) => d.sku === sku);
      if (waiting !== undefined) return [{ ...base, state: 'waiting' as const, at: waiting.claimableAt }];
      const w = offerWindow(this.state, sku);
      return offerOn(this.state, sku, now) ? [{ ...base, state: 'sale' as const, at: w?.closes ?? 0 }] : [];
    }).sort((a, b) => rank[a.state] - rank[b.state]);
  }

  /** The explorer the store sells for Gems: its price, how many are out at
   *  once and how many more can be bought. */
  explorerOffer(): { cost: number; slots: number; bought: number; forSale: number } {
    return {
      cost: explorerGemCost(this.state),
      slots: explorerSlots(this.state),
      bought: this.state.world.explorersBought,
      forSale: WORLD.explorersForSale,
    };
  }

  doBuyExplorer(): void {
    const result = buyExplorer(this.state);
    if (result === 'Bought') playSfx('gemSpend');
    else if (result === 'NotEnoughGems') this.shake(['Gems']);
    else this.toast('Every explorer for sale is yours');
    this.notify();
  }

  /** Buy a whole pool at today's rung. The Mana sheet's other button. */
  doRefillMana(): void {
    const result = refillManaWithGems(this.state, this.now());
    if (result === 'Refilled') {
      playSfx('gemSpend');
      this.floaters.add(townhall(this.state).location, `+${formatExact(manaCap(this.state))}`, 'Mana');
    }
    if (result === 'NotEnoughGems') this.shake(['Gems']);
    if (result === 'NoneLeft') this.toast('No more Gem refills today');
    this.notify();
  }

  /**
   * Everything the Mana sheet draws besides the pool: the two allowances, the
   * rung the next purchase stands on, and whether a video is on offer.
   *
   * Both counters are the SIM's — the sheet asks, it does not decide — so a
   * refill refused by the day is refused the same way whether the player
   * reached it from the tab or from the header gauge.
   */
  manaRefills(): {
    reward: number;
    full: boolean;
    video: RefillBlock;
    watchedLeft: number;
    watchedPerDay: number;
    gems: RefillBlock;
    gemCost: number | null;
    rung: number;
    boughtLeft: number;
    boughtPerDay: number;
  } {
    const now = this.now();
    const full = mana(this.state) >= manaCap(this.state);
    const watchedLeft = watchedRefillsLeft(this.state, now);
    const boughtLeft = boughtRefillsLeft(this.state, now);
    return {
      reward: manaCap(this.state),
      full,
      // The video's THREE conditions, told apart: the day's allowance, the
      // cooldown, and the shortage the offer answers. One "not available"
      // covering all three would leave the player guessing which one.
      video: watchedLeft <= 0 ? 'NoneLeftToday'
        : this.adOffer() !== null ? 'Ready'
          : full ? 'PoolFull'
            : !adOfferEligible(this.state) ? 'AboveHalf'
              : 'Cooling',
      watchedLeft,
      watchedPerDay: AD.manaRefillsPerDay,
      // Gems answer no shortage, so they have no cooldown and no half-pool
      // gate: the ladder and a pool with room in it are the whole of it.
      gems: boughtLeft <= 0 ? 'NoneLeftToday' : full ? 'PoolFull' : 'Ready',
      gemCost: manaRefillGemCost(this.state, now),
      rung: nextRefillRung(this.state, now),
      boughtLeft,
      boughtPerDay: MANA.gemRefillCosts.length,
    };
  }

  /** Everything the header's Mana gauge shows: a pool and ONE net rate.
   *  Never three numbers — the breakdown belongs in the reliquary, on tap. */
  manaInfo(): {
    value: number; cap: number; net: number; production: number; over: boolean;
    nextIn: string | null;
  } {
    const value = mana(this.state);
    const cap = manaCap(this.state);
    const nextMs = msToNextMana(this.state, this.now());
    return {
      value,
      cap,
      net: manaNetRegen(this.state),
      production: manaProduction(this.state),
      /** "+1 in 4m 12s" while the pool is filling; null when it is not. */
      nextIn: nextMs === null ? null : `+1 in ${formatDuration(Math.ceil(nextMs / 1000))}`,
      /** An ad reward can push the pool past its ceiling; the UI shows that
       *  differently from merely being full. */
      over: value > cap,
    };
  }

  /**
   * Everything the Knowledge tab under the plank shows: what is held, the cap,
   * and the two lines its caption takes turns with — the next point and the
   * whole bar. Both null when the bar is full.
   */
  knowledgeInfo(): {
    value: number; cap: number; full: boolean; over: boolean; perHour: number;
    nextIn: string | null; fullIn: string | null;
    /** How far the next point has dripped in, 0…1 — the cell it rises in. */
    nextFraction: number;
  } {
    const now = this.now();
    const value = knowledgeHeld(this.state);
    const cap = knowledgeCap();
    const nextMs = msToNextKnowledge(this.state, now);
    const fullMs = msToFullKnowledge(this.state, now);
    return {
      value,
      cap,
      full: value >= cap,
      over: value > cap,
      perHour: knowledgePerHour(),
      nextIn: nextMs === null ? null : `+1 in ${formatCountdown(Math.ceil(nextMs / 1000))}`,
      nextFraction: nextMs === null ? 0 : Math.min(1, Math.max(0, 1 - nextMs / msPerPoint())),
      fullIn: fullMs === null || fullMs === 0 ? null
        : `Full in ${formatCountdown(Math.ceil(fullMs / 1000))}`,
    };
  }

  /** What `count` points of Knowledge cost at each till, right now. */
  knowledgeQuote(count: number): { gold: number; gems: number } {
    return { gold: knowledgeGoldPrice(this.state, count), gems: knowledgeGemPrice(count) };
  }

  /** Whether the open menu spends Knowledge, so its tab under the plank stays
   *  down rather than stepping aside with every other menu. */
  keepsKnowledgeTab(): boolean {
    return this.openOverlay === 'research' || this.openOverlay === 'knowledge';
  }

  /** The Knowledge sheet: the bar, and buying points with Gold or Gems. */
  openKnowledge(): void {
    this.setOverlay('knowledge');
  }

  doBuyKnowledge(count: number, till: KnowledgeTill): void {
    const result = buyKnowledge(this.state, count, till);
    if (result === 'Bought') {
      playSfx(till === 'Gems' ? 'gemSpend' : 'upgradeBought');
      this.floatKnowledge(count);
    } else if (result === 'NotEnoughGold') this.shake(['Gold']);
    else if (result === 'NotEnoughGems') this.shake(['Gems']);
    this.notify();
  }

  /** A number rising off the Knowledge tab. Nothing on the map is its source,
   *  so it floats from the Townhall like Mana's. */
  private floatKnowledge(amount: number): void {
    this.floaters.add(townhall(this.state).location, amount > 0 ? `+${formatExact(amount)}` : formatExact(amount), 'Knowledge');
  }

  // ---------------------------------------------------------------- the Survey

  /** THE SURVEY'S SHEET, flattened (Docs/features/25-the-survey.md §6): the
   *  province's count, the next level's, and the two-column ladder. Every
   *  cell carries its own `claimable` and `claimed`. */
  surveyScreen(): {
    level: number;
    length: number;
    revealed: number;
    total: number;
    nextAt: number | null;
    owned: boolean;
    priceUsd: number;
    ladder: Array<{
      level: number;
      cells: number;
      reached: boolean;
      free: { reward: Wallet; items: ItemStock; fragments: number; claimed: boolean; claimable: boolean };
      paid: { reward: Wallet; items: ItemStock; fragments: number; claimed: boolean; claimable: boolean; locked: boolean };
    }>;
  } {
    const level = surveyLevel(this.state);
    const owned = surveyOwned(this.state);
    const { claimedFree, claimedPaid } = this.state.kingdom.survey;
    return {
      level,
      length: surveyLength(),
      revealed: revealedCellCount(this.state),
      total: this.map.terrain.size,
      nextAt: nextLevelCells(this.state),
      owned,
      priceUsd: STORE.Survey.priceUsd,
      ladder: SURVEY.cells.map((cells, i) => {
        const n = i + 1;
        const free = freeSurveyCell(this.state, n);
        const paid = paidSurveyCell(n);
        return {
          level: n,
          cells,
          reached: n <= level,
          free: {
            reward: free.wallet, items: free.items, fragments: free.fragments,
            claimed: claimedFree.includes(n),
            claimable: n <= level && !claimedFree.includes(n),
          },
          paid: {
            reward: paid.wallet, items: paid.items, fragments: paid.fragments,
            claimed: owned && claimedPaid.includes(n),
            claimable: owned && n <= level && !claimedPaid.includes(n),
            locked: !owned,
          },
        };
      }),
    };
  }

  /** The Survey's pill: absent until its door opens, glowing while a cell
   *  waits. */
  surveyPillState(): { level: number; length: number; revealed: number; nextAt: number | null; glowing: boolean } | null {
    if (!this.doorOpen('survey')) return null;
    return {
      level: surveyLevel(this.state),
      length: surveyLength(),
      revealed: revealedCellCount(this.state),
      nextAt: nextLevelCells(this.state),
      glowing: anySurveyPending(this.state),
    };
  }

  doClaimSurveyCell(level: number, track: 'free' | 'paid'): void {
    const cell = track === 'free' ? freeSurveyCell(this.state, level) : paidSurveyCell(level);
    if (claimSurveyCell(this.state, level, track) !== 'Claimed') return;
    playSfx('questComplete');
    this.notify();
    this.reward(cell.wallet);
  }

  doBuySurvey(): void {
    this.openIap('Survey', 'survey');
  }

  // ------------------------------------------------------------- ad offers

  /** The standing offer, or null. Drives the widget and the popup. */
  adOffer(): { reward: number } | null {
    return adOfferPending(this.state) ? { reward: adOfferReward(this.state) } : null;
  }

  /**
   * The Mana sheet — the pool, what fills it, and the two ways to refill it.
   *
   * Always openable, from the header gauge as well as from the offer tab:
   * the Gem ladder is not an ad, so a player who has spent the day's videos
   * (or never watches one) still has somewhere to read the arithmetic and
   * somewhere to buy a pool. Closing it leaves any standing offer standing —
   * only claiming consumes one.
   */
  openMana(): void {
    this.setOverlay('mana');
  }

  startAdWatch(): void {
    if (this.adOffer() === null) return;
    this.adWatchPurpose = 'mana';
    this.adWatchStartedAt = this.now();
    this.setOverlay(null); // the ad is its own surface, above everything
    this.notify();
  }

  /** Seconds still to watch, and whether the reward is claimable. Derived from
   *  a timestamp rather than a counted-down integer, so a throttled tab
   *  resolves correctly the moment it comes back. */
  adWatch(): { secondsLeft: number; ready: boolean } | null {
    if (this.adWatchStartedAt === null) return null;
    const elapsed = this.now() - this.adWatchStartedAt;
    const left = Math.max(0, Math.ceil((AD.watchSeconds * 1000 - elapsed) / 1000));
    return { secondsLeft: left, ready: left === 0 };
  }

  /** Watch an ad for a banner's free call. The allowance is the sim's — this
   *  only refuses early so the screen is never opened on a pull that would
   *  then be turned down. */
  startFreePullWatch(banner: BannerId): void {
    if (!freePullAvailable(this.state, banner, this.now())) return;
    this.adWatchPurpose = banner;
    this.adWatchStartedAt = this.now();
    this.setOverlay(null); // the ad is its own surface, above everything
    this.notify();
  }

  /** What a banner's free call is waiting on, for its button. */
  freePull(banner: BannerId): { left: number; readyAt: number; ready: boolean } {
    return {
      left: freePullsLeft(this.state, banner, this.now()),
      readyAt: freePullReadyAt(this.state, banner),
      ready: freePullAvailable(this.state, banner, this.now()),
    };
  }

  doClaimAdReward(): void {
    const watch = this.adWatch();
    if (watch === null || !watch.ready) return;
    this.track('ad_watched', { placement: this.adWatchPurpose });
    if (this.adWatchPurpose !== 'mana') {
      const banner = this.adWatchPurpose;
      const claimed = claimFreePull(this.state, banner, this.now());
      if (claimed.result === 'Pulled') {
        playSfx('gemSpend');
        this.openReveal(banner, [claimed.pull]);
      }
      this.adWatchStartedAt = null;
      this.setOverlay(null);
      return;
    }
    const reward = adOfferReward(this.state);
    if (claimAdOffer(this.state, this.now()) === 'Claimed') {
      playSfx('questComplete');
      this.floaters.add(townhall(this.state).location, `+${formatExact(reward)}`, 'Mana');
    }
    this.adWatchStartedAt = null;
    this.setOverlay(null);
  }

  /** Place a Shrine anywhere, for Gems (relic-restoration.md §5.1). */
  /** How the next Shrine is built from the Build menu (`shrineBuild`). */
  shrineBuild(): ShrineBuild {
    return shrineBuild(this.state);
  }

  /** How many Shrines stand, of how many the realm allows. */
  shrineCount(): { standing: number; max: number } {
    return { standing: districtCount(this.state, 'Shrine'), max: maxDistrictCount(this.state, DISTRICTS.Shrine) };
  }

  confirmBuild(): void {
    if (this.mode.kind !== 'placing' || !this.mode.selected) return;
    const { definitionId, selected } = this.mode;
    const refusal = this.ghostBlockWords();
    if (refusal !== null) {
      this.refuseGhost(refusal);
      return;
    }
    if (this.mode.premium) {
      const result = buildPremiumShrine(this.state, this.map, selected);
      if (result === 'Started') {
        this.setGhostDown(selected, definitionId);
        this.mode = { kind: 'normal' };
      } else if (result === 'NotEnoughGems') this.shake(['Gems']);
      else if (result === 'NoBuilderFree') this.offerBuilder();
      else this.toast(result === 'NoneLeft' || result === 'CountLimit' ? 'Every Shrine is built' : result === 'NotForGems' ? 'Not for Gems yet' : 'Not here');
      this.notify();
      return;
    }
    const cost = nextBuildCost(this.state, definitionId);
    const result = enqueueBuild(this.state, this.map, definitionId, selected);
    if (result === 'Started') {
      this.setGhostDown(selected, definitionId);
      this.mode = { kind: 'normal' };
      // Confirmed from a free builder's row: the sheet was only in the way.
      if (this.openOverlay === 'builder') this.openOverlay = null;
    } else if (result === 'NotEnoughResources') {
      if (!this.offerShortfall(`Build the ${DISTRICTS[definitionId].name}`, cost, () => this.confirmBuild())) {
        this.shake(Object.keys(cost) as CurrencyId[]);
      }
    } else if (result === 'NoBuilderFree') {
      this.builderAsk = { kind: 'build' };
      this.offerBuilder();
    } else {
      this.toast(this.refusalWords(result, definitionId, 1));
    }
    this.notify();
  }

  /**
   * Repair the abandoned building on this cell (Docs/features/01-map-and-fog.md
   * §6.3). It is refused the way a build is, and the same walls raise the same
   * answers: the builder offer, the purse that shakes, the words.
   */
  // ------------------------------------------------------------- the Bag

  /** The Bag's open tab (Docs/art/ui-inventory.md §3.2). */
  bagTab: BagTab = 'Resources';
  /** The tile whose popover is open, and how many the slider has chosen. */
  bagPicked: ItemId | null = null;
  bagQty = 1;

  /** The Bag, as its screen draws it: every held item of the open tab, in
   *  file order, with what one is worth now. */
  bagScreen(): BagScreen {
    const held = heldItems(this.state);
    return {
      tab: this.bagTab,
      tabs: BAG_TABS.map((tab) => ({
        tab,
        any: tab === 'Relics' ? ARTIFACT_ORDER.some((id) => isMet(this.state, id)) : held.some((id) => bagTabOf(id) === tab),
        fresh: held.some((id) => bagTabOf(id) === tab && this.state.bag.fresh[id] === true),
      })),
      items: held.filter((id) => bagTabOf(id) === this.bagTab).map((id) => ({
        id,
        def: ITEMS[id],
        count: itemCount(this.state, id),
        fresh: this.state.bag.fresh[id] === true,
        worth: chestValue(this.state, id),
      })),
      picked: this.bagPicked,
    };
  }

  /** The nav orb on the Bag: what came in since it was last opened. */
  bagBadge(): number {
    return this.state.bag.badge;
  }

  openBagTab(tab: BagTab): void {
    if (tab === this.bagTab) return;
    this.bagTab = tab;
    this.bagPicked = null;
    this.notify();
  }

  /** A tap on a tile: open its popover, or close it if it is the open one. */
  pickBagItem(id: ItemId): void {
    this.bagPicked = this.bagPicked === id ? null : id;
    this.bagQty = 1;
    markItemSeen(this.state, id);
    this.notify();
  }

  /** The coin a choice chest's popover has picked. */
  bagChoice: CurrencyId = 'Gold';

  /** What one choice chest gives of each coin, now. */
  choiceWorth(id: ItemId): Wallet {
    const out: Wallet = {};
    for (const c of CHEST_COINS) Object.assign(out, chestValue(this.state, id, c));
    return out;
  }

  pickBagChoice(coin: CurrencyId): void {
    this.bagChoice = coin;
    this.notify();
  }

  /** The boosts running, for the Boosts tab's ribbons. */
  bagBoosts(): Array<{ kind: BoostKind; value: number; endsAt: number }> {
    return runningBoosts(this.state);
  }

  doUseItem(id: ItemId, n: number): void {
    const choice = ITEMS[id].kind === 'choice' ? this.bagChoice : undefined;
    const worth = chestValue(this.state, id, choice);
    const manaBefore = getWallet(this.state.city.wallet, 'Mana');
    const knowledgeBefore = getWallet(this.state.kingdom.wallet, 'Knowledge');
    if (useItem(this.state, id, n, this.now(), choice) !== 'Used') return;
    const haul: Wallet = {};
    for (const [c, v] of Object.entries(worth) as Array<[CurrencyId, number]>) haul[c] = v * n;
    const mana = getWallet(this.state.city.wallet, 'Mana') - manaBefore;
    const knowledge = getWallet(this.state.kingdom.wallet, 'Knowledge') - knowledgeBefore;
    if (mana > 0) haul.Mana = mana;
    if (knowledge > 0) haul.Knowledge = knowledge;
    if (Object.keys(haul).length > 0) this.reward(haul);
    else playSfx('click');
    if (itemCount(this.state, id) === 0) this.bagPicked = null;
    this.bagQty = 1;
    this.afterShortfallUse();
    this.notify();
  }

  // ------------------------------------------------- short of something

  /**
   * A REFUSAL FOR A COIN THE BAG CAN COVER (Docs/art/ui-inventory.md §3.9):
   * what the action needs, and the action itself, retried the moment the
   * chests used in the sheet meet it. Raised only when the Bag holds a chest
   * of a coin that is short; otherwise the purse shakes as it always has.
   */
  shortfallAsk: { title: string; cost: Wallet; retry: () => void } | null = null;
  private shortfallReturn: OverlayName | null = null;

  /** The chests that pay this coin: its own chests, then the choice chests. */
  chestsFor(coin: CurrencyId): ItemId[] {
    return heldItems(this.state).filter((id) => {
      const def = ITEMS[id];
      return (def.kind === 'chest' && def.coin === coin) || def.kind === 'choice';
    }).sort((a, b) => (ITEMS[a].kind === 'choice' ? 1 : 0) - (ITEMS[b].kind === 'choice' ? 1 : 0)
      || ITEMS[a].seconds - ITEMS[b].seconds);
  }

  /** Raise the shortfall sheet for `cost`, if the Bag can help with it. */
  private offerShortfall(title: string, cost: Wallet, retry: () => void): boolean {
    const short = Object.keys(this.shortfall(cost)) as CurrencyId[];
    // With no chest of a short coin, the sheet still has somewhere to send
    // the player once the store sells the Bag's bundles — not before.
    const anyChest = short.some((c) => this.chestsFor(c).length > 0);
    const storeHelps = this.doorOpen('bag') && this.doorOpen('store') && ITEM_BUNDLE_ORDER.length > 0
      && short.some((c) => (['Gold', 'Food', 'Wood', 'Stone'] as CurrencyId[]).includes(c));
    if (!anyChest && !storeHelps) return false;
    if (this.openOverlay !== 'shortfall') this.shortfallReturn = this.openOverlay === 'upgrade' ? null : this.openOverlay;
    this.setOverlay('shortfall');
    this.shortfallAsk = { title, cost, retry };
    return true;
  }

  /** The sheet as it draws: the first coin still short, what is needed and
   *  held of it, and the chests that pay it. */
  shortfallScreen(): { title: string; coin: CurrencyId; need: number; have: number; chests: Array<{ id: ItemId; def: ItemDef; count: number; worth: Wallet }> } | null {
    const ask = this.shortfallAsk;
    if (ask === null) return null;
    const short = Object.keys(this.shortfall(ask.cost)) as CurrencyId[];
    const coin = short.find((c) => this.chestsFor(c).length > 0) ?? short[0];
    if (coin === undefined) return null;
    return {
      title: ask.title, coin, need: ask.cost[coin] ?? 0, have: this.walletValue(coin),
      chests: this.chestsFor(coin).map((id) => ({
        id, def: ITEMS[id], count: itemCount(this.state, id), worth: chestValue(this.state, id, coin),
      })),
    };
  }

  /** A chest used from the shortfall sheet: one of its coin. */
  doShortfallChest(id: ItemId): void {
    const view = this.shortfallScreen();
    if (view === null) return;
    if (ITEMS[id].kind === 'choice') this.bagChoice = view.coin;
    this.doUseItem(id, 1);
  }

  /** After a Use: a shortfall met closes the sheet and does what was asked. */
  private afterShortfallUse(): void {
    const ask = this.shortfallAsk;
    if (ask === null || this.openOverlay !== 'shortfall') return;
    if (Object.keys(this.shortfall(ask.cost)).length > 0) return;
    this.closeShortfall();
    ask.retry();
  }

  closeShortfall(): void {
    const back = this.shortfallReturn;
    this.shortfallAsk = null;
    this.shortfallReturn = null;
    this.setOverlay(back);
  }

  // ---------------------------------------------------- the Speed-up picker

  /** The timer the picker is open on, and the overlay it goes back to. */
  speedJob: SpeedJob | null = null;
  private speedReturn: OverlayName | null = null;

  /** Does the Bag hold anything that fits this timer — is Speed up worth
   *  offering over a bare Finish? */
  hasSpeedups(job: SpeedJob): boolean {
    return speedupsFor(this.state, job).length > 0;
  }

  openSpeedup(job: SpeedJob): void {
    if (jobRemainingSeconds(this.state, job, this.now()) === null) return;
    if (this.openOverlay !== 'speedup') this.speedReturn = this.openOverlay;
    this.setOverlay('speedup');
    this.speedJob = job;
    this.notify();
  }

  closeSpeedup(): void {
    const back = this.speedReturn;
    this.speedReturn = null;
    this.speedJob = null;
    this.setOverlay(back);
  }

  /** The first running timer a speed-up of this kind fits — where the Bag's
   *  Speed up a timer goes (ui-inventory.md §3.5). */
  firstJobFor(id: ItemId): SpeedJob | null {
    const now = this.now();
    const jobs: SpeedJob[] = [
      ...this.state.city.queue.filter((q) => q.startedAt !== null)
        .map((q): SpeedJob => ({ kind: 'queue', itemId: q.uniqueId })),
      ...[...new Set(this.state.city.trainingQueue.map((i) => i.buildingId))]
        .map((b): SpeedJob => ({ kind: 'training', buildingId: b })),
      ...this.state.city.districts.map((d): SpeedJob => ({ kind: 'workshop', districtId: d.uniqueId })),
      ...this.state.world.builds.map((b): SpeedJob => ({ kind: 'hex', index: b.index })),
      ...this.state.world.explorers.map((t): SpeedJob => ({ kind: 'explorer', tripId: t.id })),
    ];
    return jobs.find((j) => fits(id, j) && jobRemainingSeconds(this.state, j, now) !== null) ?? null;
  }

  private jobFacts(job: SpeedJob): { title: string; icon: IconName; progress: number; gems: number } | null {
    const now = this.now();
    if (job.kind === 'explorer') {
      const trip = this.state.world.explorers.find((t) => t.id === job.tripId);
      if (!trip) return null;
      const phase = tripPhase(trip, now);
      // Out and at work, then the road home: each wait its own bar.
      const [from, to] = phase === 'home'
        ? [trip.revealedAt!, returnsAt(trip)] : [trip.departedAt, readyAt(trip)];
      const total = to - from;
      return {
        title: `Explorer · ${phase === 'out' ? 'on the way' : phase === 'working' ? 'exploring' : phase === 'ready' ? 'waiting for you' : 'coming home'}`,
        icon: 'compass', progress: total > 0 ? Math.min(1, (now - from) / total) : 1,
        gems: explorerRushCost(trip, now),
      };
    }
    if (job.kind === 'army') {
      const a = this.worldView?.armies.find((x) => x.id === job.armyId);
      if (a === undefined || a.at === null) return null;
      const from = a.phase === 'home' ? a.at - homeboundMs(a.stepMs) : a.departedAt;
      const total = a.at - from;
      return {
        title: `Army · ${a.phase === 'home' ? 'coming home' : 'on the way'}`, icon: 'army',
        progress: total > 0 ? Math.min(1, (now - from) / total) : 1,
        gems: gemsToFinish((a.at - now) / 1000),
      };
    }
    if (job.kind === 'hex') {
      const h = this.worldServer === null ? null : this.worldSource().hexOf(job.index);
      const work = h === null ? null : hexWork(h);
      if (work === null) return null;
      const total = work.endsAt - work.startedAt;
      return {
        title: work.what, icon: 'build',
        progress: total > 0 ? Math.min(1, (now - work.startedAt) / total) : 1,
        gems: gemsToFinish((work.endsAt - now) / 1000),
      };
    }
    if (job.kind === 'queue') {
      const item = this.state.city.queue.find((q) => q.uniqueId === job.itemId);
      const d = item && districtById(this.state, item.districtUniqueId);
      if (!item || !d) return null;
      const name = DISTRICTS[d.definitionId].name;
      return {
        title: item.kind === 'upgrade' ? `${name} · level ${formatExact(item.targetLevel ?? d.level + 1)}` : name,
        icon: d.definitionId, progress: queueProgress(item, now), gems: gemRushCost(item, now),
      };
    }
    if (job.kind === 'training') {
      const d = districtById(this.state, job.buildingId);
      const head = lineFor(this.state, job.buildingId)[0];
      if (!d || !head) return null;
      const n = lineFor(this.state, job.buildingId).reduce((s, i) => s + (i.count ?? 1), 0);
      return {
        title: `${DISTRICTS[d.definitionId].name} · ${formatExact(n)} training`,
        icon: d.definitionId, progress: trainingProgress(this.state, job.buildingId, now),
        gems: lineRushCost(this.state, job.buildingId, now),
      };
    }
    const d = districtById(this.state, job.districtId);
    const line = d && this.state.city.workshops[d.uniqueId];
    const gems = d ? itemRushCost(this.state, d, now) : null;
    if (!d || !line || line.items.length === 0 || gems === null) return null;
    const item = line.items[0];
    const need = item.needMs ?? 1;
    return {
      title: `${GOODS[item.good].name} · ${DISTRICTS[d.definitionId].name}`,
      icon: d.definitionId, progress: need > 0 ? Math.min(1, item.workMs / need) : 1, gems,
    };
  }

  speedupScreen(): SpeedupScreen | null {
    const job = this.speedJob;
    if (job === null) return null;
    // An army's arrival is the server's: read it again from the last snapshot.
    if (job.kind === 'army') {
      const a = this.worldView?.armies.find((x) => x.id === job.armyId);
      job.at = a !== undefined && a.at !== null && (a.phase === 'out' || a.phase === 'home') ? a.at : 0;
    }
    const now = this.now();
    const left = jobRemainingSeconds(this.state, job, now);
    const facts = this.jobFacts(job);
    if (left === null || facts === null) return null;
    return {
      ...facts,
      left,
      rows: speedupsFor(this.state, job).map((id) => ({ id, def: ITEMS[id], count: itemCount(this.state, id) })),
      auto: autoPlan(this.state, job, now),
    };
  }

  /** After a Use: a timer that is done closes the picker, where the player
   *  can see the job finish. */
  private afterSpeedup(): void {
    if (this.speedJob !== null && jobRemainingSeconds(this.state, this.speedJob, this.now()) === null) {
      this.closeSpeedup();
    }
    this.notify();
  }

  /**
   * Take `seconds` off a job that is not the city's own: an explorer, which
   * reveals its hex if its work is done by it, or a world build, which the server moves
   * (`hurry`) before anything is spent. True when the time was taken.
   */
  private async speedAway(job: SpeedJob, seconds: number): Promise<boolean> {
    const now = this.now();
    if (job.kind === 'explorer') {
      const { finished } = cutExplorer(this.state, job.tripId, seconds * 1000, now);
      if (finished !== null) this.tripFinished(finished);
      return true;
    }
    if (job.kind === 'army') {
      if (this.worldServer === null) return false;
      const r = await this.worldServer.hurryArmy(job.armyId, seconds);
      if (!r.ok) {
        this.toast(this.worldRefusal(r.why));
        return false;
      }
      job.at = r.finishesAt;
      this.applyWorldSnapshot(r.snapshot);
      return true;
    }
    if (job.kind !== 'hex' || this.worldServer === null) return false;
    const r = await this.worldServer.hurry(job.index, seconds);
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      return false;
    }
    const build = this.state.world.builds.find((b) => b.index === job.index);
    if (build !== undefined && r.finishesAt <= this.now()) {
      this.state.world.builds = this.state.world.builds.filter((b) => b !== build);
      this.toast(worldBuildDone(build.what, build.level));
    } else if (build !== undefined) build.finishesAt = r.finishesAt;
    this.applyWorldSnapshot(r.snapshot);
    return true;
  }

  async doSpeedup(id: ItemId, n = 1): Promise<void> {
    const job = this.speedJob;
    if (job === null) return;
    if (job.kind === 'hex' || job.kind === 'explorer' || job.kind === 'army') {
      if (speedupRefusal(this.state, job, id, n, this.now()) !== null) return;
      if (await this.speedAway(job, ITEMS[id].seconds * n)) {
        spendSpeedups(this.state, job, id, n);
        playSfx('speedup');
      }
    } else if (useSpeedup(this.state, this.map, job, id, n, this.now()) === 'Used') playSfx('speedup');
    this.afterSpeedup();
  }

  async doAutoSpeedup(): Promise<void> {
    const job = this.speedJob;
    if (job === null) return;
    if (job.kind === 'hex' || job.kind === 'explorer' || job.kind === 'army') {
      // One move by the whole plan, then the items it took.
      const plan = autoPlan(this.state, job, this.now());
      const seconds = plan.reduce((s, p) => s + ITEMS[p.id].seconds * p.n, 0);
      if (seconds > 0 && await this.speedAway(job, seconds)) {
        for (const p of plan) spendSpeedups(this.state, job, p.id, p.n);
        playSfx('speedup');
      }
    } else if (useAuto(this.state, this.map, job, this.now()) === 'Used') playSfx('speedup');
    this.afterSpeedup();
  }

  /** Finish with Gems — the picker's last row, the same rush as before. */
  doFinishSpeedJob(): void {
    const job = this.speedJob;
    if (job === null) return;
    if (job.kind === 'queue') this.doRush(job.itemId);
    else if (job.kind === 'training') {
      const d = districtById(this.state, job.buildingId);
      if (d) this.doFinishTraining(d);
    } else if (job.kind === 'workshop') this.doRushWorkshopItem(job.districtId);
    else if (job.kind === 'explorer') this.doFinishExplorer(job.tripId);
    else if (job.kind === 'army') void this.doFinishArmyMarch(job.armyId).then(() => this.afterSpeedup());
    else void this.doFinishHexWork(job.index).then(() => this.afterSpeedup());
    this.afterSpeedup();
  }

  doRepairAbandoned(cell: Coord): void {
    const site = standingAbandonedAt(this.state, cell);
    if (!site) return;
    const cost = nextBuildCost(this.state, site.districtId);
    const result = repairAbandoned(this.state, this.map, site.id);
    if (result === 'Started') {
      playSfx('buildPlaced');
      this.inspectedSite = null;
      if (this.openOverlay === 'builder') this.openOverlay = null;
    } else if (result === 'NotEnoughResources') {
      this.shake(Object.keys(cost) as CurrencyId[]);
    } else if (result === 'NoBuilderFree') {
      this.builderAsk = { kind: 'repair', id: site.id };
      this.offerBuilder();
    } else if (result === 'CountLimit') {
      this.toast(`The Townhall can hold no more ${DISTRICTS[site.districtId].name} — raise it first`);
    } else if (result === 'NotRevealed') {
      this.toast('Clear the fog off it first');
    } else if (result === 'LairHeld') {
      this.toast('A lair holds its ground — clear it first');
    } else if (result === 'MissingItem') {
      const item = DISTRICTS[site.districtId].repairItem as ItemId;
      this.toast(`It needs ${ITEMS[item]?.name ?? 'a missing piece'} — find it first`);
    } else {
      this.toast(this.refusalWords(result, site.districtId, 1));
    }
    this.notify();
  }

  /**
   * A refusal in plain words, and — where there is one — the errand that
   * answers it. Three of them are a different trip each: the map, a workshop
   * queue, a decoration. A bare enum name told the player none of that.
   */
  private refusalWords(
    result: string, definitionId: DistrictId, targetLevel: number, district?: District,
  ): string {
    if (result === 'NotEnoughGoods') {
      return 'Not enough refined goods — queue some at a workshop';
    }
    if (result === 'NeedsHarmony') {
      const short = harmonyBlock(this.state, DISTRICTS[definitionId], targetLevel, district);
      return `Needs ${formatExact(short?.shortBy ?? 0)} more Harmony — build a decoration`;
    }
    if (result === 'NotForMaterials') {
      return shrineBuild(this.state).kind === 'ruinFirst' ? 'Repair the old shrine first' : 'Every Shrine is built';
    }
    if (result === 'NeedsPopulation') {
      const need = requiredPopulation(definitionId, targetLevel);
      return `Needs ${formatExact(need)} villagers — you have ${formatExact(this.state.city.population)}. Train more at the Townhall`;
    }
    return result;
  }

  /** What a key costs, and what the player holds — the store card's whole
   *  content. One card per banner, because the two keys are two prices. */
  keyOffer(banner: BannerId): { cost: number; held: number; key: ItemId } {
    const def = BANNERS[banner];
    return { cost: def.keyGemCost, held: itemCount(this.state, def.key), key: def.key };
  }

  /** How many of an item the Bag holds — a key, chiefly. */
  itemHeld(id: ItemId): number {
    return itemCount(this.state, id);
  }

  doBuyKeys(banner: BannerId, count = 1): void {
    if (buyKeys(this.state, banner, count) === 'Purchased') {
      playSfx('gemSpend');
    } else {
      this.shake(['Gems']);
    }
    this.notify();
  }

  /**
   * Every builder is busy. Offer one more for Gems.
   *
   * The popup is raised from the REFUSAL rather than from a store tab,
   * because that is the only moment the player has already decided they want
   * the thing — `Docs/features/06-construction.md`. It opens at the ceiling too: the
   * sheet then explains why there is nothing to buy, which is a better answer
   * than a toast the player has to read in the corner of their eye.
   *
   * Placement mode is deliberately LEFT OPEN behind it. Dismissing the offer
   * puts the player back on the ghost they had positioned, so declining costs
   * them nothing they had already done.
   */
  offerBuilder(): void {
    playSfx('error');
    offerTrigger(this.state, 'buildersBusy', this.now());
    this.setOverlay('builder');
  }

  builderOffer(): { builders: number; ceiling: number; cost: number; affordable: boolean } {
    const cost = builderGemCost(this.state);
    return {
      builders: builderCount(this.state),
      ceiling: KINGDOM_DEF.maxBuilders,
      cost,
      affordable: this.walletValue('Gems') >= cost,
    };
  }

  /** Every job the crew is on, in the order they were given — one row of
   *  the builder sheet each. */
  builderJobs(): Array<{ item: QueueItem; district: District; name: string; task: string }> {
    return this.state.city.queue.flatMap((item) => {
      const district = districtById(this.state, item.districtUniqueId);
      if (!district) return [];
      const task = item.kind === 'upgrade'
        ? `Upgrading to Lv ${item.targetLevel ?? district.level + 1}`
        : 'Building';
      return [{ item, district, name: districtLabel(this.state, district), task }];
    });
  }

  /** The builders out on the world board, one row of the builder sheet
   *  each. A world build is the server's timer: it cannot be rushed, so it
   *  carries no Finish. Its start is its finish less its authored time. */
  builderWorldJobs(): Array<{ index: number; name: string; task: string; startedAt: number; durationMs: number }> {
    return this.state.world.builds.map((b) => {
      const seconds = worldBuildSeconds(b.what, b.level);
      return {
        index: b.index,
        name: worldBuildName(b.what),
        task: b.what === 'Repair' ? 'Repairing on the world map'
          : isUpgrade(b.what) && b.level > 1 ? `Upgrading to Lv ${formatCount(b.level)} on the world map`
            : isUpgrade(b.what) ? 'Building on the world map' : 'Claiming on the world map',
        startedAt: b.finishesAt - seconds * 1000,
        durationMs: seconds * 1000,
      };
    });
  }

  /**
   * The job the builder sheet was raised for, as a free builder's row offers
   * it: what it is, what it costs, and the press that starts it. Null when
   * that job is gone — the ghost was put away, the building is at its top.
   */
  builderAskJob(): { verb: string; what: string; cost: Wallet; start: () => void } | null {
    const ask = this.builderAsk;
    if (ask.kind === 'build') {
      if (this.mode.kind !== 'placing' || !this.mode.selected) return null;
      const def = DISTRICTS[this.mode.definitionId];
      return {
        verb: 'Build', what: `Ready to build the ${def.name}`,
        cost: nextBuildCost(this.state, def.id), start: () => this.confirmBuild(),
      };
    }
    if (ask.kind === 'repair') {
      const site = ABANDONED.find((a) => a.id === ask.id);
      if (!site || this.state.abandoned.repaired[site.id] === true) return null;
      const def = DISTRICTS[site.districtId];
      return {
        verb: 'Repair', what: `Ready to repair ${site.name.toLowerCase().startsWith('the ') ? site.name.charAt(0).toLowerCase() + site.name.slice(1) : site.name}`,
        cost: nextBuildCost(this.state, def.id), start: () => this.doRepairAbandoned(site.location),
      };
    }
    if (ask.kind === 'world') {
      const { index, what, level, gold } = ask;
      const name = `the ${worldBuildName(what)}`;
      if (what === 'Repair') {
        return { verb: 'Repair', what: 'Ready to repair the burnt district', cost: { Gold: gold }, start: () => void this.doRepairHex(index, gold) };
      }
      return {
        verb: !isUpgrade(what) ? 'Claim' : level > 1 ? 'Upgrade' : 'Build',
        what: !isUpgrade(what) ? `Ready to claim with ${name}`
          : level > 1 ? `Ready to upgrade ${name}` : `Ready to build ${name}`,
        cost: { Gold: gold },
        start: () => void (isUpgrade(what) ? this.doUpgradeHex(index, what, level, gold) : this.doClaimHex(index, gold)),
      };
    }
    const d = districtById(this.state, ask.districtUniqueId);
    if (!d || d.level >= DISTRICTS[d.definitionId].maxLevel) return null;
    return {
      verb: 'Upgrade', what: `Ready to upgrade the ${DISTRICTS[d.definitionId].name}`,
      cost: upgradeCost(d.definitionId, d.ordinal, d.level),
      start: () => { this.doUpgrade(d.uniqueId); },
    };
  }

  doBuyBuilder(opts: { closeSheet?: boolean } = {}): void {
    const result = buyBuilder(this.state);
    if (result === 'Purchased') {
      playSfx('gemSpend');
      // The refused-build offer closes on purchase — the player was placing
      // something. The store stays open: they came to shop.
      if (opts.closeSheet !== false) this.setOverlay(null);
    } else if (result === 'NotEnoughGems') {
      this.shake(['Gems']);
    }
    this.notify();
  }

  // ----------------------------------------------------------- the store

  /** The simulated payer, for the store's budget line and the confirmation
   *  sheet. Null until a profile is chosen. Cents, never dollars. */
  payerInfo(): {
    profile: PayerProfile; label: string; budgetCents: number; remainingCents: number;
    resetsIn: string;
  } | null {
    const payer = this.state.player.payer;
    if (payer === null) return null;
    const now = this.now();
    return {
      profile: payer.profile,
      label: PROFILE_LABEL[payer.profile],
      budgetCents: monthlyBudgetCents(payer.profile),
      remainingCents: budgetRemainingCents(this.state, now) ?? 0,
      resetsIn: describeWait(monthResetsAt(now) - now),
    };
  }

  canAffordSku(id: StoreSkuId): boolean {
    return canAffordSku(this.state, id, this.now());
  }

  /** What the next call on a banner costs: one key of its own kind, or
   *  nothing at all for the free first call on the basic one. */
  pullPrice(banner: BannerId = STANDARD_BANNER): { key: ItemId; amount: number } {
    return pullPrice(this.state, banner);
  }

  /** The payer profile is owed: none chosen, and the First Morning is over.
   *  The morning is played before anything is asked (14-monetization.md §3). */
  payerDue(): boolean {
    return this.state.player.payer === null && !firstMorningOn(this.state);
  }

  /** Choosing a profile is the one command that runs with no profile chosen.
   *  It hands the screen to whatever was waiting behind the sheet. */
  doChoosePayerProfile(profile: PayerProfile): void {
    if (choosePayerProfile(this.state, profile, this.now()) !== 'Chosen') return;
    playSfx('click');
    const next = this.afterProfileOverlay;
    this.afterProfileOverlay = null;
    this.openOverlay = next;
    this.notify();
  }

  /**
   * Open the upgrade popup for a building.
   *
   * The card stays MOUNTED underneath: the popup is a sheet over it, and
   * closing returns to the card the player was already reading rather than to
   * the map. That is why `closeUpgrade` clears the overlay rather than
   * dismissing — `dismiss()` would take the card with it.
   */
  openUpgrade(districtUniqueId: string): void {
    this.upgradeDistrictId = districtUniqueId;
    this.setOverlay('upgrade');
  }

  closeUpgrade(): void {
    this.upgradeDistrictId = null;
    // A refusal the Bag can cover has replaced the popup with its own sheet.
    if (this.openOverlay === 'upgrade') this.setOverlay(null);
  }

  /** The building the popup is about, or null if it went away under it. */
  upgradeDistrict(): District | null {
    if (this.upgradeDistrictId === null) return null;
    return this.state.city.districts
      .find((d) => d.uniqueId === this.upgradeDistrictId) ?? null;
  }

  /** A price was tapped: open the confirmation, which is where the price meets
   *  the budget. Nothing is granted from the store card itself.
   *
   *  `from` is where "Not now" and a completed purchase go back to — the store
   *  for a Gem pack, the Survey for its paid column. A confirmation that always
   *  returned to the store would take a player who tapped a price on the Survey
   *  somewhere they never asked to go. */
  openIap(id: StoreSkuId, from: OverlayName | null = 'store'): void {
    this.pendingSku = id;
    this.pendingSkuFrom = from;
    this.setOverlay('iapConfirm');
    this.track('confirm_opened', { sku: id, price_cents: priceCents(id), from });
  }

  /** Where the confirmation came from, and where it returns. */
  iapReturn(): OverlayName | null {
    return this.pendingSkuFrom;
  }

  confirmIap(): void {
    const id = this.pendingSku;
    if (id === null) return;
    // The SKUs that grant no Gems do not go through `buySku` directly. Each
    // still spends the budget through it, inside its own command: the Survey
    // is an unlock plus a back-pay, a bundle is items.
    const heldBefore = new Set(this.state.heroes.owned);
    const fragmentsBefore = { ...this.state.heroes.fragments };
    const result = id === 'Survey'
      ? buySurvey(this.state, this.now())
      : buyStoreSku(this.state, id, this.now());
    if (result === 'Purchased') this.track('purchased', this.skuProps(id));
    if (result === 'NotOnSale') {
      // The window closed under the confirmation: nothing was charged.
      this.toast('That offer has ended');
      this.pendingSku = null;
      this.setOverlay('store');
      return;
    }
    if (result === 'NoBudget') this.track('refused_no_credit', this.skuProps(id));
    if (result === 'Purchased' || result === 'AlreadyOwned') {
      playSfx('gemSpend');
      const back = this.pendingSkuFrom;
      this.pendingSku = null;
      // Only what the player cannot see from where they land is said.
      if (isItemBundle(id)) this.toast(`${STORE[id].name} — it is in the Bag`);
      // An offer bought out, or a Gem pack, goes back to the store; anything
      // bought from a sheet that is not the store goes back there.
      this.setOverlay(back);
      if (id === 'Survey') this.toast('The Royal Survey is yours — every level you have reached is open');
      if (result === 'Purchased' && STORE[id].gems > 0) this.reward({ Gems: STORE[id].gems });
      if (result === 'Purchased') {
        // A hero bought — in the pack, or as the first purchase's reward —
        // arrives on the reveal, the way a call delivers one.
        const heroes = [STORE[id].hero].filter((h): h is HeroId => h !== null);
        const pulls: PullResult[] = heroes.map((h) => ({
          result: 'Pulled', heroId: h, rarity: HEROES[h].rarity, duplicate: heldBefore.has(h),
          fragments: (this.state.heroes.fragments[h] ?? 0) - (fragmentsBefore[h] ?? 0), fragmentsOf: h,
          loot: [], guaranteed: true, guaranteedLegendary: HEROES[h].rarity === 'Legendary',
        }));
        if (pulls.length > 0) this.openReveal('advanced', pulls);
      }
    } else {
      // A refusal is data (store.ts) and a denial (the shake). The sheet
      // stays put so the player can read the numbers that said no.
      this.shake(['Gems']);
      this.notify();
    }
  }

  // -------------------------------------------------------------- UI commands

  doQueueTraining(): void {
    const result = trainUnit(this.state, 'Villager', this.now());
    if (result === 'NotEnoughResources') {
      const cost = trainCost(this.state, 'Villager') as Wallet;
      if (!this.offerShortfall('Train a villager', cost, () => this.doQueueTraining())) this.shake(['Food']);
    }
    else if (result === 'AtMax') this.toast(this.atMaxWords());
    this.notify();
  }

  doChangeWorkers(districtId: string, delta: 1 | -1): AssignWorkerResult {
    const result = changeWorkers(this.state, this.map, districtId, delta, this.now());
    if (result === 'AtCapacity') this.toast('Worker capacity reached — upgrade the building');
    if (result === 'NoFreeWorkers') this.toast('No free workers — buy population');
    this.notify();
    return result;
  }

  doUpgrade(districtId: string): UpgradeResult {
    const result = upgradeDistrict(this.state, districtId);
    if (result === 'NotEnoughResources') {
      const d = districtById(this.state, districtId)!;
      const cost = upgradeCost(d.definitionId, d.ordinal, d.level);
      if (!this.offerShortfall(`${DISTRICTS[d.definitionId].name} to level ${formatExact(d.level + 1)}`, cost,
        () => { this.doUpgrade(districtId); })) {
        this.shake(Object.keys(cost) as CurrencyId[]);
      }
    } else if (result === 'NoBuilderFree') {
      // An upgrade occupies a builder exactly as a build does, so it hits the
      // same wall and deserves the same offer rather than a bare refusal.
      this.builderAsk = { kind: 'upgrade', districtUniqueId: districtId };
      this.offerBuilder();
    } else if (result === 'Started') {
      if (this.openOverlay === 'builder') this.openOverlay = null;
    } else {
      const d = districtById(this.state, districtId);
      this.toast(d === undefined
        ? result
        : this.refusalWords(result, d.definitionId, d.level + 1, d));
    }
    this.notify();
    return result;
  }

  /** A new hero gets the pennant; anything else gets a line. Shared by the
   *  paid call and the one an ad pays for, because a hero found for free is
   *  still a hero found. */
  /**
   * Hand a batch to the reveal screen.
   *
   * This used to be a top banner for a hero and a toast for fragments, which
   * had the ten-call announcing itself in a single line of summary — a call
   * is the one moment in the game the player paid for a surprise, and a
   * one-line receipt is the opposite of one. The screen owns it now
   * (Docs/features/10-heroes.md §8.3); nothing is queued, so there is no
   * second announcement to collide with it.
   */
  private openReveal(banner: BannerId, pulls: readonly PullResult[]): void {
    const prizes = gachaPrizes(pulls);
    if (prizes.length === 0) return;
    // ENOUGH FRAGMENTS RECRUIT. A call that brings a stranger's fragments to
    // the recruiting price recruits them on the spot — the reveal is where
    // the player watches the bar fill, so it is where the hero joins.
    for (const p of prizes) {
      if (p.kind !== 'fragments') continue;
      const held = this.state.heroes.fragments[p.heroId] ?? 0;
      if (!ownsHeroId(this.state, p.heroId)) {
        const recruited = unlockHero(this.state, p.heroId) === 'Unlocked';
        p.progress = { toward: 'recruit', from: held - p.amount, to: held, goal: heroUnlockCost(), recruited };
      } else {
        const entry = heroEntry(this.state, p.heroId);
        if (!isMaxAscension(entry)) {
          p.progress = { toward: 'ascension', from: held - p.amount, to: held, goal: ascensionFragmentCost(entry.ascension), recruited: false };
        }
      }
    }
    // A recruit is what the call was for: it comes after the other
    // fragments, just before the heroes.
    const rank = (p: GachaPrize): number => (p.kind === 'hero' ? 2 : p.kind === 'fragments' && p.progress?.recruited ? 1 : 0);
    prizes.sort((a, b) => rank(a) - rank(b));
    this.gachaReveal = { banner, calls: pulls.length, prizes, chest: banner === 'advanced' ? 'golden' : 'common' };
  }

  /**
   * Everything the roster screen reads, as one string.
   *
   * The screen draws thirty-two `<img>` portraits and the overlay is rebuilt
   * on every notify() — once a second from the tick — so without this the
   * images are recreated every second and blink as each new element decodes.
   * Nothing on that screen is time-dependent: it only moves when the player
   * moves it (`src/ui/kit/host.ts`).
   *
   * **Deliberately coarse.** `state.heroes` goes in whole rather than field
   * by field, so a screen that grows a new line tomorrow is covered without
   * anybody remembering to come back here. A signature that misses an input
   * does not flicker — it goes stale, which is the worse bug.
   */
  /**
   * The signature of an overlay that has nothing ticking on it, or null for
   * one that does and must keep rebuilding (a countdown, a regenerating
   * pool). Coarse on purpose — a whole slice stringified — per the contract
   * in ui/kit/host.ts: a missed input goes stale, which is the worse bug.
   * `settings` is not here: it reads module state the presenter does not
   * own (ui/settingsMenu.ts carries its own).
   */
  overlaySignature(name: OverlayName): string | null {
    switch (name) {
      // The store moves with its tab, what is on sale, the purses and the
      // calls — never with its countdowns, which tick in place
      // (ui/storeSheet.ts), so its pictures and the heroes' carousel stay.
      case 'store': {
        return JSON.stringify([
          this.storeTabs(), this.offerCards().map((c) => [c.id, c.left]),
          this.dailyCards().cards.map((c) => [c.id, c.left]),
          this.state.player.wallet, this.state.bag.held, this.state.heroes,
          this.state.kingdom.builders, this.state.world.explorersBought,
          BANNER_ORDER.map((b) => [this.freePull(b).left, this.freePull(b).ready, this.pullPrice(b).amount]),
          this.doorOpen('banner'), this.doorOpen('bag'), this.fragmentPackOffer(), this.storeVisits,
          this.builderOffer(), BANNER_ORDER.map((b) => this.keyOffer(b)),
        ]);
      }
      case 'heroes': return this.heroesSignature();
      // The picker moves with the choice and with a resting hero's minute.
      case 'heroPicker': return JSON.stringify([
        this.heroPick && { ...this.heroPick, onSelect: undefined },
        this.state.heroes,
        this.state.heroes.owned.map((h) => {
          const { hp, restMs } = this.heroHealthOf(h);
          return [hp, Math.ceil(restMs / 60_000)];
        }),
      ]);
      // The attack screen moves when the party, the purse, the army or a
      // hero's health does — and a resting hero's Zs are an animation a
      // rebuild every second would restart before it ever finished.
      case 'lair': return JSON.stringify([
        this.lairId, this.partyHeroes, this.expeditionParty, this.state.city.wallet,
        this.state.army.length, this.state.city.wounded, this.state.heroes, this.state.lairs,
        this.state.heroes.owned.map((h) => {
          const { hp, restMs } = this.heroHealthOf(h);
          return [hp, Math.ceil(restMs / 60_000)];
        }),
      ]);
      // The offline report is fixed for the session; the sheet only closes.
      case 'welcome': return 'welcome';
      // A list of profiles and a button each. Nothing on it moves.
      case 'payerProfile': return 'payer';
      // Rebuilt only when the answer changes: the field keeps what is typed.
      case 'nickname': return JSON.stringify([this.nicknameRefused, this.joiningWorld]);
      // The friends screens move with the server's answer and what the
      // player opened — never with what is typed, so a field keeps it — and
      // once a minute, for "last seen".
      case 'friends': case 'friendProfile': {
        const f = this.friends;
        const { at: _at, ...snap } = f.snap ?? { at: 0 };
        return JSON.stringify([
          snap, f.tab, f.openCode, f.confirmingRemove, [...f.busy], f.naming,
          f.nicknameRefused, this.state.kingdom.profile.crest, Math.floor(this.now() / 60_000),
        ]);
      }
      // The search popup: never with what is typed — the field marks itself
      // as the player types (ui/friends/friendSearch.ts).
      case 'friendSearch': return JSON.stringify([this.friends.searchStage, this.friends.searchRefused, this.friends.sentTo]);
      case 'crestEditor': return JSON.stringify([this.friends.crestDraft, this.state.kingdom.profile]);
      // A wish being made reads the player's goods as well as the picks.
      case 'wishNeed': case 'wishGive':
        return JSON.stringify([this.friends.wishNeed, this.friends.wishGive, this.state.relics.held, this.state.city.goods]);
      case 'wishFilled': return JSON.stringify(this.friends.justFilled);
      case 'iapConfirm':
        return JSON.stringify([this.pendingSku, this.payerInfo()]);
      // Not signed: the Collection counts the season down and the rest draw
      // prices against a purse that moves every tick.
      default: return null;
    }
  }

  heroesSignature(): string {
    return [
      this.openHeroId ?? '-',
      this.heroesFilter,
      this.heroesSort,
      JSON.stringify(this.state.heroes),
      // Both purses the screen spends from: XP buys a level, Stardust tolls
      // an ascension.
      this.walletValue('HeroXp'),
      this.walletValue('Stardust'),
      // Who is on the board right now — the one line the roster reads from
      // outside itself.
      this.partyHeroes.join(','),
      // A resting hero's countdown, by the minute — the one thing on the
      // grid that moves with the clock, and only while someone rests.
      this.state.heroes.owned
        .map((h) => Math.ceil(this.heroHealthOf(h).restMs / 60_000)).join(','),
    ].join('|');
  }

  /** The unlock splash to show now, or null: never over a fight, a reveal
   *  or a video, and never over the profile sheet. A scene waits for it
   *  (ui/stage/stage.ts). */
  unlockOnScreen(): string | null {
    if (this.unlockQueue.length === 0) return null;
    if (this.payerDue()) return null;
    if (this.battle !== null || this.gachaReveal !== null || this.adWatch() !== null) return null;
    return this.unlockQueue[0];
  }

  /** The player has read the splash on screen. */
  dismissUnlock(): void {
    this.unlockQueue.shift();
    this.notify();
  }

  /** The player has read it — and whatever was waiting behind it is dealt
   *  now that the screen is free (§11.5). */
  dismissGachaReveal(): void {
    this.gachaReveal = null;
    this.notify();
  }

  /** Ten calls at once. The banner card shows the ten results; the presenter
   *  only announces the heroes among them, because ten toasts is not a
   *  reward, it is a queue. */
  doPullMany(banner: BannerId = STANDARD_BANNER, count = 10): void {
    const batch = pullMany(this.state, banner, count);
    if (batch.result === 'NotEnoughKeys') {
      this.shake([]);
      this.notify();
      return;
    }
    if (batch.result === 'Pulled') {
      playSfx('gemSpend');
      this.openReveal(banner, batch.pulls);
    }
    this.notify();
  }

  doRush(itemId: string): void {
    const result = finishWithGems(this.state, this.map, itemId, this.now());
    if (result === 'Success') playSfx('gemSpend');
    if (result === 'NotEnoughGems') this.shake(['Gems']);
    this.notify();
  }

  /** Whether a scene introduces this site the moment it is found — then the
   *  advisor announces it and a banner would say it twice. A veteran plays no
   *  scenes, so is told by the banner. */
  private sceneIntroduces(siteId: string): boolean {
    if (this.state.tutorial.veteran) return false;
    return SCENES.some((s) =>
      ((s.trigger === 'lairFound' || s.trigger === 'landmarkSeen') && s.triggerTarget === siteId)
      // An abandoned building a scene points at is the advisor's to name:
      // its banner would land on top of whatever she is saying when the fog
      // first shows it (the Millers' house, beside the first chest).
      || s.lines.some((l) => l.point === `abandoned:${siteId}`));
  }

  /** Every bed is taken. A House already going up is the answer the player
   *  has given; telling them to build one would send them to do it twice. */
  private atMaxWords(): string {
    const rising = this.state.city.districts.some((d) => d.state !== 'Built'
      && DISTRICTS[d.definitionId].populationCapacityPerLevel.length > 0);
    return rising ? 'The new House is still going up — wait for it to finish'
      : 'Population at max — build more Housing';
  }

  private researchRefusalToast(refusal: ResearchRefusal, id: TechId): void {
    if (refusal === 'MissingRequirement') this.toast('Requires another technology first');
    else if (refusal === 'EraLocked') {
      const def = TECHNOLOGIES[id];
      this.toast(`Reveal ${eraShortfall(this.state, def.tome, def.era)} more cells to read on`);
    }
  }

  /** Pour from the bar into a technology: all it can, or at most `max`. */
  doPourTech(id: TechId, max = Infinity): void {
    const { result, poured } = pourKnowledge(this.state, id, max);
    if (result === 'Poured') {
      playSfx('research');
      this.floatKnowledge(-poured);
    } else if (result === 'NothingHeld') this.shake(['Knowledge']);
    else if (result !== 'AlreadyFull' && result !== 'AlreadyDone') this.researchRefusalToast(result, id);
    this.notify();
  }

  /** Pay the Gold and complete a technology whose Knowledge is in. */
  doResearchTech(id: TechId): void {
    const paid = this.state.research.rewarded.length;
    const result = researchTech(this.state, this.map, id, this.now());
    if (result === 'Researched' && this.worldServer !== null && movesWorldBoost(TECHNOLOGIES[id].effects)) {
      void this.worldServer.setBoost(worldImprovementBoost(this.state));
    }
    if (result === 'Researched') {
      playSfx('researchComplete');
      // The last card of a chapter pays its relic fragments.
      if (this.state.research.rewarded.length > paid) {
        const { tome, era } = TECHNOLOGIES[id];
        const n = ERA_REWARDS[tome][era];
        if (n) this.toast(`Chapter ${formatExact(era)} complete — ${formatExact(n)} relic fragment${n === 1 ? '' : 's'}`);
      }
    } else if (result === 'NotEnoughGold') this.shake(['Gold']);
    else if (result === 'NotEnoughGoods') this.toast('Not enough refined goods for that');
    else if (result === 'NotFilled') this.shake(['Knowledge']);
    else if (result !== 'AlreadyDone') this.researchRefusalToast(result, id);
    this.notify();
  }

  /**
   * The sheet's three pours (Docs/features/07-research.md §5): how many points
   * the "as much as it can" button pours — the least of what the bar holds
   * and what is missing — and what the Gems button charges to buy every point
   * still missing.
   */
  techPours(id: TechId): { missing: number; most: number; gems: number } {
    const missing = techKnowledgeMissing(this.state, id);
    return {
      missing,
      most: Math.min(missing, knowledgeHeld(this.state)),
      gems: knowledgeGemPrice(missing),
    };
  }

  /** Buy every point a technology still misses, with Gems, and pour them. */
  doBuyMissingWithGems(id: TechId): void {
    const { missing } = this.techPours(id);
    if (missing <= 0) return;
    const bought = buyKnowledge(this.state, missing, 'Gems');
    if (bought === 'NotEnoughGems') { this.shake(['Gems']); this.notify(); return; }
    playSfx('gemSpend');
    this.doPourTech(id, missing);
  }

  /** Renderers ask: is this UI key currently hinted? */
  uiHint(): string | null {
    if (this.hint?.kind !== 'ui' || this.hint.until < this.now()) return null;
    return this.hint.key;
  }

  /** The world cell currently hinted (arrow on the map), if any. */
  hintCell(): Coord | null {
    if (this.hint?.kind !== 'cell' || this.hint.until < this.now()) return null;
    return this.hint.cell;
  }

  setUiHint(key: string): void {
    this.hint = { kind: 'ui', key, until: this.now() + HINT_MS };
  }

  setCellHint(cell: Coord): void {
    this.hint = { kind: 'cell', cell, until: this.now() + HINT_MS };
  }

  clearHint(): void {
    if (this.hint === null) return;
    this.hint = null;
    this.notify();
  }

  /** The quest 🔍: navigate to where the ACTIVE quest can be progressed —
   *  open the right menu, or close menus and center/inspect on the map. */
  focusQuest(): void {
    const quest = activeQuest(this.state);
    if (!quest) return;
    const overlay = (name: OverlayName) => this.setOverlay(name);
    const centerCell = (cell: Coord | null) => {
      if (!cell) return;
      this.setOverlay(null);
      this.inspectedDistrictId = null;
      this.camera.centerOnCell(cell, undefined, CAMERA_GLIDE_MS);
      this.setCellHint(cell); // arrow on the map until tapped (or timeout)
      this.notify();
    };
    const inspect = (district: District | undefined, fallback: OverlayName = 'build') => {
      if (!district) {
        overlay(fallback);
        return;
      }
      this.setOverlay(null);
      this.inspectedDistrictId = district.uniqueId;
      this.camera.centerOnCell(district.location, DISTRICTS[district.definitionId].size, CAMERA_GLIDE_MS);
      this.notify();
    };
    const built = (pred: (d: District) => boolean) =>
      this.state.city.districts.find((d) => d.state === 'Built' && pred(d));
    // Pointing anywhere but a buyable cell answers the tap with a refusal.
    const buyable = (c: Coord): boolean => this.isBuyable(c);
    switch (quest.goalType) {
      // NOTE: hints are set BEFORE navigating — overlay()/inspect() notify,
      // and the render they trigger must already see the hint.
      case 'RepairDistrict':
      case 'BuildDistrict': {
        // One of its kind still standing as a ruin is the way to build it
        // (Docs/features/01-map-and-fog.md §6.3) — and before the Build door
        // opens, the only way.
        const ruin = ABANDONED.find((a) => a.districtId === quest.goalTarget
          && standingAbandonedAt(this.state, a.location) !== undefined);
        if (ruin) {
          centerCell(ruin.location);
          break;
        }
        this.setUiHint(`build:${quest.goalTarget}`);
        overlay('build');
        break;
      }
      case 'UpgradeDistrict': {
        const target = built((d) => d.definitionId === quest.goalTarget);
        this.setUiHint(target ? 'card:upgrade' : `build:${quest.goalTarget}`);
        inspect(target);
        break;
      }
      case 'ReachPopulation':
        this.setUiHint('card:train');
        inspect(townhall(this.state));
        break;
      case 'CompleteTech':
        this.setUiHint(`tech:${quest.goalTarget}`);
        overlay('research');
        break;
      case 'CompleteTechs':
        overlay('research');
        break;
      case 'OwnHeroes':
        // The banner is the first thing on the store, and the hint lights
        // its Call button.
        this.setUiHint('banner');
        overlay('store');
        break;
      case 'AssignWorkers': {
        const target = built((d) => DISTRICTS[d.definitionId].maxWorkersPerLevel.length > 0);
        if (target) this.setUiHint('card:workers');
        inspect(target);
        break;
      }
      case 'TrainArmy': {
        // The Army screen is gone: units are trained at the building that
        // trains them, exactly as villagers are trained at the Townhall. So
        // "go train an army" means "go to the Barracks" — or, if there isn't
        // one yet, "go build it".
        // A MILITARY trainer: `trains` is an array now, so `!== null` was
        // always true and this pointed at whatever was built first — usually
        // the Townhall, which trains villagers and not an army.
        const barracks = built(
          (d) => DISTRICTS[d.definitionId].trains.some((t) => t !== 'Villager'));
        if (barracks) {
          this.setUiHint('card:train');
          inspect(barracks);
        } else {
          this.setUiHint('build:Barracks');
          overlay('build');
        }
        break;
      }
      case 'DiscoverCells':
        centerCell(this.nearestCell(buyable));
        break;
      case 'DiscoverFeature': {
        // Point at a DARK cell that has the thing on it. This is the whole
        // reason the goal type exists: "clear five cells" can be satisfied in
        // any direction, so it teaches the verb and nothing else, while "clear
        // two with forest on them" is a heading — and the arrow has to give
        // the player that heading or the quest is a riddle.
        //
        // Features draw through the fog, so a Discovered cell already shows
        // what is on it; this tells the player nothing they cannot see.
        const wanted = quest.goalTarget as FeatureId;
        const target = this.nearestCell((c) =>
          fogState(this.state, this.map, c) === 'Discovered'
          && this.state.features[coordKey(c)] === wanted);
        // Nothing of that kind in sight yet — fall back to the frontier,
        // because the answer is still "go and explore".
        centerCell(target
          ?? this.nearestCell(buyable));
        break;
      }
      case 'ClaimLandmarks': {
        // The nearest landmark that is visible and unclaimed; failing that,
        // the nearest frontier cell — because the answer is "explore".
        // A goal naming a KIND (the Watchtower) points at that kind only.
        const kind = quest.goalTarget;
        const claimable = visibleLandmarks(this.state, this.map)
          .filter((l) => this.state.landmarks.claimed[l.id] !== true
            && (kind === null || l.kind === kind))
          .sort((a, b) =>
            townhallDistance(this.map, a.location) - townhallDistance(this.map, b.location))[0];
        if (claimable) {
          this.setOverlay(null);
          this.inspectedSite = claimable.location;
          this.camera.centerOnCell(claimable.location, undefined, CAMERA_GLIDE_MS);
          this.notify();
        } else {
          centerCell(this.nearestCell(buyable));
        }
        break;
      }
      case 'FindLairs': {
        // Toward the nearest lair not yet found: the dark cell closest to its
        // ground. "Clear 55 cells" can be met facing away from every lair,
        // which is why this goal exists, so the arrow has to give the heading.
        const zones = LAIR_ORDER
          .filter((id) => this.state.lairs[id] === undefined)
          .map((id) => lairZoneCells(id).filter((c) => this.map.terrain.has(coordKey(c))))
          .filter((zone) => zone.length > 0)
          .sort((a, b) =>
            Math.min(...a.map((c) => townhallDistance(this.map, c)))
            - Math.min(...b.map((c) => townhallDistance(this.map, c))));
        const zone = zones[0];
        let target: Coord | null = null;
        if (zone) {
          let bestD = Infinity;
          for (const c of this.map.cells) {
            if (fogState(this.state, this.map, c) !== 'Discovered') continue;
            const d = Math.min(...zone.map((z) =>
              Math.max(Math.abs(z.x - c.x), Math.abs(z.y - c.y))));
            if (d < bestD) { bestD = d; target = c; }
          }
        }
        centerCell(target ?? this.nearestCell(buyable));
        break;
      }
      case 'ClearLairs': {
        // The lair whose counter is nearest, which is the one the quest
        // means; failing that, the frontier — the answer is "go and find
        // one".
        const open = this.openLairViews()[0];
        if (open) this.showLair(open.lairId);
        else centerCell(this.nearestCell(buyable));
        break;
      }
      case 'OwnArtifacts':
        this.setUiHint('bag');
        this.bagTab = 'Relics';
        overlay('bag');
        break;
      case 'CollectTaps':
        centerCell(this.nearestCell((c) =>
          this.state.fog.revealed[coordKey(c)] === true && harvestSourceAt(this.state, c) !== null));
        break;
      case 'HoldResource':
      case 'CollectResource': {
        if (quest.goalTarget === 'Gold') {
          const house = built((d) => districtCapacity(this.state, d) > 0 &&
            residentsOf(this.state, d) > 0);
          inspect(house ?? townhall(this.state));
          if (house) this.setCellHint(house.location);
          break;
        }
        const cell = this.nearestCell((c) => {
          // DISCOVERED is enough. The berry bush and the wild game sit outside
          // the opening reveal now, so a hint that only pointed at cleared
          // ground would say nothing at exactly the moment the quest says
          // "tap the bush". Features draw through the fog, so this points at
          // something the player can already see.
          if (fogState(this.state, this.map, c) === 'Undiscovered') return false;
          const source = harvestSourceAt(this.state, c);
          if (source === null) return false;
          // Berries, game and shoals all pay Food, so a Food target points at
          // any of them — the harvest table already resolves that.
          return HARVEST[source].currencyId === quest.goalTarget;
        });
        if (cell) centerCell(cell);
        else centerCell(townhall(this.state).location);
        break;
      }
    }
  }

  /** A cell the player can buy THIS tap: dark, on the cleared ground's edge,
   *  inside the Townhall's reach and behind no technology. */
  private isBuyable(c: Coord): boolean {
    return fogState(this.state, this.map, c) === 'Discovered'
      && isPayable(this.state, this.map, c) && explorationGate(this.map, c) === null;
  }

  /** A refused fog tap shows where the fog CAN be cleared: the buyable cell
   *  nearest the one tapped, with the quest hint's hand. */
  private hintFrontierNear(cell: Coord): void {
    let best: Coord | null = null;
    let bestD = Infinity;
    for (const c of this.map.cells) {
      if (!this.isBuyable(c)) continue;
      const d = Math.max(Math.abs(c.x - cell.x), Math.abs(c.y - cell.y));
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best !== null) this.setCellHint(best);
  }

  /** Nearest cell (by townhall distance) satisfying the predicate. */
  private nearestCell(pred: (cell: Coord) => boolean): Coord | null {
    let best: Coord | null = null;
    let bestD = Infinity;
    for (const c of this.map.cells) {
      if (!pred(c)) continue;
      const d = townhallDistance(this.map, c);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  doClaimQuest(): void {
    const quest = activeQuest(this.state);
    const result = claimQuest(this.state);
    let haul: Wallet | null = null;
    if (result === 'Claimed' && quest) {
      // The LAST claim gets the victory sting instead of the usual chime.
      const finished = activeQuest(this.state) === null;
      playSfx(finished ? 'chainFinished' : 'quest');
      // What it paid flies from the scroll into the header — once the header
      // has redrawn, so a coin this claim puts on the plank has a slot.
      haul = { ...quest.reward };
      if (quest.rewardMana > 0) haul.Mana = (haul.Mana ?? 0) + quest.rewardMana;
      if (quest.rewardGems > 0) haul.Gems = (haul.Gems ?? 0) + quest.rewardGems;
      // Finishing the chain used to just make the tracker vanish, which reads
      // as a bug rather than an ending. Say something.
      if (finished) postNews(this.state, { group: 'chainDone', key: 'chainDone', at: this.now() });
    }
    this.notify();
    if (haul !== null) this.reward(haul);
  }

  /** Active-quest snapshot for the pill; null when the chain is finished. */
  questInfo(): {
    quest: QuestDef; value: number; complete: boolean; index: number; total: number;
  } | null {
    const quest = activeQuest(this.state);
    if (!quest) return null;
    return {
      quest,
      value: Math.min(questValue(this.state, quest), quest.goalAmount),
      complete: isQuestComplete(this.state, quest),
      index: this.state.quests.index,
      total: QUESTS.length,
    };
  }

  /** Claim the landmark whose card is open. */
  doClaimLandmark(cell: Coord): void {
    const def = landmarkDefAt(cell);
    if (!def) return;
    const before = manaProduction(this.state);
    const result = claimLandmark(this.state, this.map, cell);
    if (result === 'Claimed') {
      playSfx('upgradeBought');
      this.floaters.add(cell, `+${formatExact(manaProduction(this.state) - before)}/h`, 'Mana');
    } else if (result === 'NotEnoughGold') {
      this.shake(['Gold']);
    } else if (result === 'LairHeld') {
      // The ground is a camp's: say whose, so the refusal points at the fight.
      const lair = lairHolding(this.state, cell);
      playSfx('error');
      if (lair) this.toast(holdsThisGround(lairCreature(lair)));
    }
    this.notify();
  }

  // ----------------------------------------------------------- the party

  /** The party a sheet opens with: the best-answering types on hand, clamped
   *  to the army cap. Proposing a party the player cannot field is worse than
   *  proposing a small one — the sheet would open pre-filled AND pre-blocked,
   *  which reads as the game refusing its own suggestion. */
  private prefillParty(affinity: UnitId | 'Any'): void {
    this.fillTroops(affinity);
  }


  // ------------------------------------------------------------- the lair

  /** Lairs the player has found and not yet cleared, nearest raid first. */
  openLairViews(): LairView[] {
    return openLairs(this.state)
      .map((id) => lairView(this.state, id)!)
      .sort((a, b) => (a.nextRaidAt ?? Infinity) - (b.nextRaidAt ?? Infinity));
  }

  lairFor(lairId: LairId): LairView | null {
    return lairView(this.state, lairId);
  }

  /** What clearing it pays on top of the hoard — for the lair's card. */
  lairReward(lairId: LairId): { heroXp: number; knowledge: number } {
    return lairClearReward(this.state, lairId);
  }

  lairIsCleared(lairId: LairId): boolean {
    return lairIsCleared(this.state, lairId);
  }

  /** Fly to a lair and open its card — what the quest chain does when it
   *  points at one. */
  showLair(lairId: LairId): void {
    if (this.scene === 'world') this.leaveWorld();
    this.setOverlay(null);
    this.inspectedSite = LAIRS[lairId].location;
    this.inspectedDistrictId = null;
    this.camera.centerOnCell(LAIRS[lairId].location, undefined, CAMERA_GLIDE_MS);
    this.notify();
  }

  /** Open the battle sheet on a lair. A hero alone and soldiers alone are
   *  both legal boards here. */
  openLair(lairId: LairId): void {
    this.lairId = lairId;
    // A lair resolves on entry, so nobody is busy: the roster is the party.
    this.partyHeroes = this.state.heroes.owned
      .filter((h) => heroCanFight(this.state, h, this.now()))
      .slice(0, heroSlots(this.state));
    this.prefillParty(LAIRS[lairId].guard.threat);
    this.setOverlay('lair');
  }

  lairPreview(): LairPreview | null {
    if (this.lairId === null) return null;
    return previewLair(this.state, this.lairId, this.partyHeroes, this.expeditionParty, this.now());
  }

  /** Why the attempt cannot be made, in words. A power SHORTFALL is not here:
   *  it warns on the sheet and lets the player go anyway. */
  lairBlockText(): string | null {
    if (this.lairId === null) return 'No lair chosen';
    const block = lairBlock(
      this.state, this.map, this.lairId, this.partyHeroes, this.expeditionParty, this.now());
    return block === null ? null : LAIR_BLOCK_TEXT[block];
  }

  doAttackLair(): void {
    if (this.lairId === null) return;
    const lairId = this.lairId;
    // Which fight of the path this is, for the playback's line — read before
    // the fight moves the path on.
    const fight = lairFightIndex(this.state, lairId) + 1;
    const report = attackLair(
      this.state, this.map, lairId, this.partyHeroes, this.expeditionParty, this.now());
    if (report.result === 'Cleared' || report.result === 'Won') {
      // A fight on the path, or the last of it: when the playback closes the
      // player is back on the lair's card — its path a step on, or Claim in
      // Attack's place (Docs/features/18-garrisons-and-raids.md §5).
      this.setOverlay(null);
      this.lairId = null;
      this.inspectedSite = LAIRS[lairId].location;
      this.inspectedDistrictId = null;
    } else if (report.result === 'NotEnoughSupplies') {
      this.shake(Object.keys(report.supplies) as CurrencyId[]);
      this.reconcileParty();
      this.notify();
      return;
    } else if (report.log === null) {
      this.toast(LAIR_BLOCK_TEXT[report.result as LairBlock]);
      this.reconcileParty();
      this.notify();
      return;
    }
    this.reconcileParty();
    // A fight short of the last pays its share of Hero XP on the field; the
    // last pays nothing until the reward is claimed from the lair's card.
    this.openBattle(report.log!, {
      title: LAIRS[lairId].name,
      subtitle: `${lairView(this.state, lairId)?.creature ?? 'A warband'} · Fight ${formatExact(fight)} of ${formatExact(lairFights(lairId))}`,
      prizes: report.heroXp > 0 ? [{ kind: 'currency', currency: 'HeroXp', amount: report.heroXp }] : [],
      enemyFaces: UNIT_CREATURE_AVATAR,
      backdrop: 'field',
    });
    this.notify();
  }

  /**
   * THE CLAIM, from a beaten lair's card: the reward is paid and flies to the
   * header from the lair, the card closes, and the lair is struck from the
   * map — `vanishingLairs` is what the renderer plays its going-away from,
   * and the ground is the city's the moment the claim lands.
   */
  doClaimLair(lairId: LairId): void {
    const report = claimLair(this.state, lairId);
    if (report.result !== 'Claimed') return;
    const haul: Wallet = { ...report.hoard };
    if (report.heroXp > 0) haul.HeroXp = report.heroXp;
    if (report.knowledge > 0) haul.Knowledge = report.knowledge;
    const def = LAIRS[lairId];
    const box = this.camera.plotBox(def.location, { x: def.size, y: def.size });
    const from = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    this.inspectedSite = null;
    this.vanishingLairs.set(lairId, performance.now());
    playSfx('questComplete');
    const items = Object.keys(report.items) as ItemId[];
    if (items.length > 0) this.toast(`In the Bag: ${items.map((id) => `${formatExact(report.items[id] ?? 1)}× ${itemWords(id)}`).join(', ')}`);
    this.notify();
    queueMicrotask(() => this.reward(haul, from));
  }

  // ------------------------------------------------- the party, slot by slot
  //
  // THE BATTLE SCREEN'S MODEL. A slot is tapped, a panel of cards opens, and
  // a card fills the first free slot with as much as it legally can. Nothing
  // here is a stepper: the player picks a TYPE and the game works out the
  // count, which is the whole difference between composing a party and doing
  // arithmetic (Docs/features/11a-lairs-ui.md §2.6).

  /**
   * Put the board back in step with the roster.
   *
   * A fight kills soldiers, so the squads standing in the slots can outrun
   * what is left at home. Clamping here rather than refusing at the button is
   * the honest reading: the player did not change their mind, the army did.
   */
  private reconcileParty(): void {
    const roster = availableRoster(this.state);
    this.expeditionParty = this.expeditionParty
      .map((slot) => ({ ...slot, count: Math.min(slot.count, roster[slot.unitId]) }))
      .filter((slot) => slot.count > 0);
  }

  /**
   * Troop slots on the board — all of them, always.
   *
   * There is no locked troop slot and nothing to buy: what limits a party is
   * the army at home and the army cap, both of which are earned in the city.
   * The pair of readers stays because the HERO row has two different numbers
   * and the screen draws both rows the same way.
   */
  troopSlotsOpen(): number {
    return troopSlots();
  }

  troopSlotCeiling(): number {
    return troopSlots();
  }

  heroSlotsOpen(): number {
    return heroSlots(this.state);
  }

  heroSlotCeiling(): number {
    return PARTY.heroSlots;
  }

  /**
   * How many of this type would go into a slot right now: a whole squad, or
   * everything of them that is still at home — whichever runs out first
   * (Docs/features/combat.md §4). A partial squad is legal, so the roster is
   * a floor on nothing: eleven Archers send eleven.
   */
  troopsAvailableFor(unitId: UnitId): number {
    return Math.max(0, Math.min(UNITS[unitId].squadSize, this.troopsLeftAtHome(unitId)));
  }

  /** Of this type, how many are still at home — the roster minus what the
   *  party has already committed. */
  troopsLeftAtHome(unitId: UnitId): number {
    const roster = availableRoster(this.state);
    return Math.max(0, roster[unitId] - this.expeditionParty
      .filter((slot) => slot.unitId === unitId)
      .reduce((sum, slot) => sum + slot.count, 0));
  }

  /**
   * ONE TAP ON A TROOP TILE: one more squad of that type on the board — as
   * big as `squadSize`, or everything of it left at home — into the next free
   * troop slot (Docs/proposals/lairs.md §6). Tapped again, another squad
   * beside the first. Six slots, of any type: where a squad STANDS in the
   * fight is its unit's business (combat.md §8), never the player's, and the
   * deploy screen does not show it.
   */
  assignTroop(unitId: UnitId): void {
    const refusal = this.troopRefusal(unitId);
    if (refusal !== null) {
      this.toast(refusal);
      return;
    }
    this.expeditionParty.push({ unitId, count: this.troopsAvailableFor(unitId) });
    playSfx('click');
    this.notify();
  }

  /** Why a tile would send nothing right now, in the words the toast uses —
   *  or null when a tap would place a squad. */
  troopRefusal(unitId: UnitId): string | null {
    if (this.troopsAvailableFor(unitId) <= 0) return `No ${UNITS[unitId].name}s left to send`;
    if (this.expeditionParty.length >= this.troopSlotsOpen()) return 'Every troop slot is full';
    return null;
  }

  /**
   * QUICK DEPLOY: the strongest legal party, answering the lair's creature
   * first — every hero slot with the highest-level heroes, then squad after
   * squad of the best-answering type that still has soldiers at home, until
   * the six slots or the army run out.
   */
  quickDeploy(): void {
    if (this.lairId === null) return;
    this.partyHeroes = this.state.heroes.owned
      .filter((h) => heroCanFight(this.state, h, this.now()))
      .sort((a, b) => heroLevel(this.state, b) - heroLevel(this.state, a))
      .slice(0, heroSlots(this.state));
    this.fillTroops(LAIRS[this.lairId].guard.threat);
    playSfx('click');
    this.notify();
  }

  /** Squad after squad, best answer first, inside every rule a tap obeys. */
  private fillTroops(affinity: UnitId | 'Any'): void {
    this.expeditionParty = [];
    const order = (Object.keys(availableRoster(this.state)) as UnitId[])
      .sort((a, b) => scoreAgainst(b, affinity) - scoreAgainst(a, affinity));
    for (;;) {
      const next = order.find((u) => this.troopRefusal(u) === null);
      if (next === undefined) return;
      this.expeditionParty.push({ unitId: next, count: this.troopsAvailableFor(next) });
    }
  }

  clearTroopSlot(index: number): void {
    if (index < 0 || index >= this.expeditionParty.length) return;
    this.expeditionParty.splice(index, 1);
    playSfx('click');
    this.notify();
  }

  /** Put a hero in the first free hero slot. */
  assignHero(heroId: HeroId): void {
    if (this.partyHeroes.includes(heroId)) return;
    if (!heroCanFight(this.state, heroId, this.now())) {
      this.toast(`${HEROES[heroId].name} is exhausted — they rest until their HP is full`);
      return;
    }
    if (this.partyHeroes.length >= this.heroSlotsOpen()) {
      this.toast('Every hero slot is full — clear one first');
      return;
    }
    this.partyHeroes.push(heroId);
    playSfx('click');
    this.notify();
  }

  // ----------------------------------------------------------- relic picker

  /**
   * OPEN THE RELIC PICKER for a Shrine, over its card — the hero picker's
   * flow (`openHeroPicker`): the restored city relics as cards, the Shrine's
   * one slot fixed under them, and Select. A tap on a relic seats it, a tap
   * on the filled slot empties it, and closing without Select changes
   * nothing.
   */
  openRelicPicker(shrineId: string): void {
    const shrine = shrines(this.state).find((d) => d.uniqueId === shrineId);
    if (shrine === undefined) return;
    this.relicPick = { shrineId, slot: shrine.hosts ?? null };
    playSfx('click');
    this.setOverlay('relicPicker');
  }

  /** The relics the picker offers: every restored city relic, in order. */
  relicPickList(): RelicView[] {
    if (this.relicPick?.chapel !== undefined) return this.worldRelicsRestored().map((id) => this.relicCard(id));
    return ARTIFACT_ORDER
      .filter((id) => relicKind(id) === 'city' && artifactLevel(this.state, id) >= 1)
      .map((id) => this.relicCard(id));
  }

  /** Is this relic already in a Shrine — this one or another? Its card in
   *  the picker wears the Shrine mark. */
  relicPickHosted(id: ArtifactId): boolean {
    if (relicKind(id) === 'world') return this.myChapels().some((c) => c.relic === id);
    return hostOf(this.state, id) !== null;
  }

  /** The relic the move confirmation asks about, while it is open. */
  relicMoveSubject(): ArtifactId | null {
    return this.openOverlay === 'relicMoveConfirm' ? this.relicPick?.slot ?? null : null;
  }

  /** A TAP ON A RELIC: into the slot, or out of it if it is the one there. */
  relicPickToggle(id: ArtifactId): void {
    if (this.relicPick === null) return;
    this.relicPick.slot = this.relicPick.slot === id ? null : id;
    playSfx('click');
    this.notify();
  }

  /** A tap on the filled slot empties it. */
  relicPickClear(): void {
    if (this.relicPick === null || this.relicPick.slot === null) return;
    this.relicPick.slot = null;
    playSfx('click');
    this.notify();
  }

  /** SELECT: the Shrine holds what the slot holds — hosted, swapped or taken
   *  out — and its card comes back. A relic already in ANOTHER Shrine asks
   *  first (`relicMoveConfirm`): moving it ends its window there. */
  relicPickConfirm(): void {
    const pick = this.relicPick;
    if (pick === null) return;
    // A world relic leaves its old Chapel on its own: the server moves it.
    if (pick.chapel !== undefined) {
      this.applyRelicPick();
      return;
    }
    const from = pick.slot === null ? null : hostOf(this.state, pick.slot);
    if (from !== null && from.uniqueId !== pick.shrineId) {
      playSfx('click');
      this.setOverlay('relicMoveConfirm');
      return;
    }
    this.applyRelicPick();
  }

  /** The confirmation's Move: the relic leaves its Shrine for this one. */
  relicMoveAccept(): void {
    this.applyRelicPick();
  }

  /** The confirmation's Cancel: back to the picker, the choice as it was. */
  relicMoveCancel(): void {
    this.setOverlay(this.relicPick === null ? null : 'relicPicker');
  }

  private applyRelicPick(): void {
    const pick = this.relicPick;
    if (pick === null) return;
    this.relicPick = null;
    if (pick.chapel !== undefined) {
      const held = this.worldSource().hexOf(pick.chapel)?.relic?.id ?? null;
      this.openWorldBuilding(pick.chapel, 'Chapel');
      if (pick.slot !== null && pick.slot !== held) void this.doHostWorldRelic(pick.slot, pick.chapel);
      else if (pick.slot === null && held !== null) void this.doUnhostWorldRelic(held);
      return;
    }
    this.setOverlay(null);
    const shrine = shrines(this.state).find((d) => d.uniqueId === pick.shrineId);
    this.inspectedDistrictId = pick.shrineId;
    if (shrine !== undefined && shrine.hosts !== (pick.slot ?? undefined)) {
      if (pick.slot !== null) this.doHostRelic(pick.slot, pick.shrineId);
      else if (shrine.hosts !== undefined) this.doUnhostRelic(shrine.hosts);
    }
    this.notify();
  }

  /** The window's close: nothing changes, and the Shrine's card comes back. */
  relicPickCancel(): void {
    const pick = this.relicPick;
    this.relicPick = null;
    if (pick?.chapel !== undefined) {
      this.openWorldBuilding(pick.chapel, 'Chapel');
      return;
    }
    this.setOverlay(null);
    if (pick !== null) this.inspectedDistrictId = pick.shrineId;
    this.notify();
  }

  // ------------------------------------------------------------ hero picker

  /**
   * OPEN THE HERO PICKER over whatever is open: `slots` slots, pre-filled
   * with `selected`, and `onSelect` called with the heroes chosen when the
   * player presses Select. Closing it any other way changes nothing. Either
   * way the screen that opened it comes back.
   */
  openHeroPicker(opts: {
    slots: number; selected?: readonly HeroId[]; title?: string; fight?: boolean;
    onSelect: (heroes: HeroId[]) => void;
  }): void {
    const slots: Array<HeroId | null> = Array.from({ length: Math.max(1, opts.slots) },
      (_, i) => opts.selected?.[i] ?? null);
    this.heroPick = {
      title: opts.title ?? 'Choose heroes',
      slots,
      returnTo: this.openOverlay,
      onSelect: opts.onSelect,
      filter: 'All',
      sort: 'level',
      fight: opts.fight === true,
    };
    playSfx('click');
    this.setOverlay('heroPicker');
  }

  /** The heroes the kingdom owns, filtered by type and ordered best first —
   *  the one ordering the picker and the roster share. */
  private ownedHeroesBy(filter: UnitId | 'All', sort: HeroPickSort): HeroId[] {
    const rank = { Common: 0, Rare: 1, Legendary: 2 } as const;
    return this.state.heroes.owned
      .filter((h) => filter === 'All' || HEROES[h].unitType === filter)
      .sort((a, b) => (sort === 'rarity'
        ? rank[HEROES[b].rarity] - rank[HEROES[a].rarity] || heroLevel(this.state, b) - heroLevel(this.state, a)
        : heroLevel(this.state, b) - heroLevel(this.state, a) || rank[HEROES[b].rarity] - rank[HEROES[a].rarity]));
  }

  /** The heroes the picker offers — every one the kingdom owns, filtered by
   *  type and ordered, best first. */
  heroPickList(): HeroId[] {
    const pick = this.heroPick;
    if (pick === null) return [];
    return this.ownedHeroesBy(pick.filter, pick.sort);
  }

  /** THE ROSTER'S ORDER: the owned heroes as the picker orders them, then the
   *  ones not found yet, in roster order — both under the same type filter. */
  heroesList(): HeroId[] {
    const owned = this.ownedHeroesBy(this.heroesFilter, this.heroesSort);
    const missing = HERO_ORDER.filter((h) => !this.state.heroes.owned.includes(h)
      && (this.heroesFilter === 'All' || HEROES[h].unitType === this.heroesFilter));
    return [...owned, ...missing];
  }

  heroesSetFilter(filter: UnitId | 'All'): void {
    this.heroesFilter = filter;
    playSfx('click');
    this.notify();
  }

  heroesCycleSort(): void {
    this.heroesSort = this.heroesSort === 'level' ? 'rarity' : 'level';
    playSfx('click');
    this.notify();
  }

  /** A TAP ON A HERO IN THE LIST: out of its slot if it is in one; else into
   *  the first free slot — or an error sound, when there is none or it is
   *  exhausted. */
  heroPickToggle(heroId: HeroId): void {
    const pick = this.heroPick;
    if (pick === null) return;
    const at = pick.slots.indexOf(heroId);
    if (at >= 0) {
      pick.slots[at] = null;
      playSfx('click');
    } else if (!heroCanFight(this.state, heroId, this.now())) {
      playSfx('error');
      this.toast(`${HEROES[heroId].name} is exhausted — they rest until their HP is full`);
    } else {
      const free = pick.slots.indexOf(null);
      if (free < 0) {
        playSfx('error');
      } else {
        pick.slots[free] = heroId;
        playSfx('click');
      }
    }
    this.notify();
  }

  /** A tap on a filled slot empties it. */
  heroPickClearSlot(index: number): void {
    const pick = this.heroPick;
    if (pick === null || pick.slots[index] == null) return;
    pick.slots[index] = null;
    playSfx('click');
    this.notify();
  }

  heroPickFilter(filter: UnitId | 'All'): void {
    if (this.heroPick === null) return;
    this.heroPick.filter = filter;
    playSfx('click');
    this.notify();
  }

  heroPickCycleSort(): void {
    if (this.heroPick === null) return;
    this.heroPick.sort = this.heroPick.sort === 'level' ? 'rarity' : 'level';
    playSfx('click');
    this.notify();
  }

  /** SELECT: the chosen heroes, in slot order, go back to whoever asked. */
  heroPickConfirm(): void {
    const pick = this.heroPick;
    if (pick === null) return;
    this.heroPick = null;
    this.setOverlay(pick.returnTo);
    pick.onSelect(pick.slots.filter((h): h is HeroId => h !== null));
    this.notify();
  }

  /** The window's close: nothing changes, and the screen behind comes back. */
  heroPickCancel(): void {
    const pick = this.heroPick;
    this.heroPick = null;
    this.setOverlay(pick?.returnTo ?? null);
  }

  /** The party's hero slots open the picker, and its answer is the party. */
  pickPartyHeroes(): void {
    this.openHeroPicker({
      slots: this.heroSlotsOpen(),
      selected: this.partyHeroes,
      fight: true,
      onSelect: (heroes) => { this.partyHeroes = heroes; },
    });
  }

  heroLevelOf(heroId: HeroId): number {
    return heroLevel(this.state, heroId);
  }

  /** What a hero is doing: free, resting from a fight, or away with an army
   *  — marching (out or home, `at` when that leg ends), camped in a dungeon,
   *  the Portal or at a camp it is ready to attack, or standing guard in a
   *  Fortress. */
  heroStateOf(heroId: HeroId): HeroState {
    const army = this.state.world.armies.find((a) => a.heroes.includes(heroId));
    if (army !== undefined) {
      const view = this.worldView?.armies.find((a) => a.id === army.id);
      const phase = view?.phase ?? this.worldSource().armies().find((a) => a.id === army.id)?.phase ?? 'out';
      if (phase === 'camp') return { kind: 'camped', where: army.purpose === 'clear' ? 'camp' : army.purpose === 'portal' ? 'portal' : 'dungeon' };
      if (phase === 'garrison') return { kind: 'guarding' };
      return { kind: 'marching', at: view?.at ?? null };
    }
    const health = this.heroHealthOf(heroId);
    return health.exhausted ? { kind: 'resting', restMs: health.restMs } : { kind: 'ready' };
  }

  /** What a hero adds to an army's power (sim/combat.ts `heroPower`). */
  heroPowerOf(heroId: HeroId): number {
    return heroPower(HEROES[heroId], heroLevel(this.state, heroId), this.state.heroes.ascension[heroId] ?? 0);
  }

  /** A hero's HP as it stands — the wound the last fight left, mending
   *  (sim/heroHealth.ts). */
  heroHealthOf(heroId: HeroId): { hp: number; max: number; exhausted: boolean; restMs: number } {
    const t = this.now();
    const ends = heroRestEndsAt(this.state, heroId, t);
    return {
      hp: heroHp(this.state, heroId, t),
      max: heroMaxHp(this.state, heroId),
      exhausted: !heroCanFight(this.state, heroId, t),
      restMs: ends === null ? 0 : ends - t,
    };
  }

  /** ONE TAP ON A HERO TILE: in if it is out, out if it is in. */
  toggleHero(heroId: HeroId): void {
    const at = this.partyHeroes.indexOf(heroId);
    if (at >= 0) this.clearHeroSlot(at);
    else this.assignHero(heroId);
  }

  clearHeroSlot(index: number): void {
    if (index < 0 || index >= this.partyHeroes.length) return;
    this.partyHeroes.splice(index, 1);
    playSfx('click');
    this.notify();
  }

  /** The troop roster the picker rail draws, minus nothing: a type with none
   *  left still shows, saying so, because an absent card reads as a bug. */
  availableTroops(): Record<UnitId, number> {
    return availableRoster(this.state);
  }

  heroSlotOffer(): { cost: number; slots: number; ceiling: number } {
    return {
      cost: heroSlotGemCost(this.state),
      slots: this.heroSlotsOpen(),
      ceiling: this.heroSlotCeiling(),
    };
  }

  doBuyHeroSlot(): void {
    const result = buyHeroSlot(this.state);
    if (result === 'Purchased') playSfx('gemSpend');
    else if (result === 'NotEnoughGems') this.shake(['Gems']);
    else this.toast('Three heroes is the whole board');
    this.notify();
  }

  // -------------------------------------------------------------- the fight

  /** Start replaying a fight that has already happened. */
  private openBattle(
    log: BattleLog,
    about: {
      title: string; subtitle: string; prizes: GachaPrize[];
      enemyFaces?: Partial<Record<UnitId, string>>;
      backdrop: BattleBackdrop;
    },
  ): void {
    this.battle = {
      log,
      title: about.title,
      subtitle: about.subtitle,
      prizes: about.prizes,
      enemyFaces: about.enemyFaces,
      backdrop: about.backdrop,
      startedAt: this.now(),
      clockAt: this.now(),
      clockMs: 0,
      speed: this.battleSpeed,
      phase: 'playing',
    };
  }

  /** How fast the playback runs, kept for the next fight: a player who
   *  watches at ×2 wants the next at ×2 too. A screen preference, not state. */
  battleSpeed = 1;

  /** Play the fight at `speed` from here, or jump to its end. */
  setBattleSpeed(speed: number): void {
    const b = this.battle;
    this.battleSpeed = speed;
    if (b === null) return;
    const now = this.now();
    b.clockMs = playbackMs(b, now);
    b.clockAt = now;
    b.speed = speed;
    this.notify();
  }

  skipBattle(): void {
    const b = this.battle;
    if (b === null || b.phase !== 'playing') return;
    const now = this.now();
    b.clockMs = b.log.ticks * COMBAT.tickMs;
    b.clockAt = now;
    b.slow = undefined;
    this.advanceBattle(now);
  }

  /** Which tick of the fight the screen should be drawing at `now`. Past the
   *  end it stays at the end, so a slow frame cannot skip the last blow. */
  battleTick(now: number): number {
    return Math.floor(this.battleMs(now) / COMBAT.tickMs);
  }

  /** The same clock in milliseconds of the fight, for what moves between
   *  two ticks — a flying arrow, a lunge. Stops at the end like the tick. */
  battleMs(now: number): number {
    const b = this.battle;
    if (b === null) return 0;
    return Math.min(b.log.ticks * COMBAT.tickMs, playbackMs(b, now));
  }

  /** Freeze the replay for `ms` of real time: the weight of a heavy blow.
   *  The screen's, not the fight's — the log does not move, only when it is
   *  shown. */
  holdBattle(ms: number): void {
    const b = this.battle;
    if (b === null || b.phase !== 'playing') return;
    const now = this.now();
    b.clockMs = playbackMs(b, now);
    b.clockAt = now + ms;
  }

  /** Run the replay `factor` times slower for the next `ms` of real time:
   *  the last blow, in slow motion. Screen-only, like the hold. */
  slowBattle(factor: number, ms: number): void {
    const b = this.battle;
    if (b === null || b.phase !== 'playing') return;
    const now = this.now();
    b.clockMs = playbackMs(b, now);
    b.clockAt = Math.max(now, b.clockAt);
    b.slow = { from: b.clockAt, until: b.clockAt + ms, factor };
  }

  /**
   * Walk the playback forward. Called from the screen's own timer, because
   * the game's one-second tick is far too coarse for a fight — but every
   * decision it makes is here rather than in the DOM.
   */
  advanceBattle(now: number): void {
    const b = this.battle;
    if (b === null) return;
    const elapsed = playbackMs(b, now);
    const fight = b.log.ticks * COMBAT.tickMs;
    let moved = false;
    // A LOOP, not a step: a frame the browser skipped, or a test that jumps
    // the clock, must land on the phase the clock says rather than one
    // behind it.
    for (;;) {
      if (b.phase === 'playing' && elapsed >= fight) {
        // Its sound is the plaque's (battleScreen.ts), which lands a beat later.
        b.phase = 'result';
        moved = true;
        continue;
      }
      if (b.phase === 'result' && elapsed >= fight + BATTLE_RESULT_DELAY_MS) {
        // The prizes deal on the reveal screen, over the board — the one
        // place in the game that already knows how to hand things over one
        // at a time.
        b.phase = b.prizes.length > 0 ? 'rewards' : 'done';
        if (b.phase === 'rewards') this.gachaReveal = { prizes: b.prizes, caption: 'Spoils', chest: 'spoils' };
        moved = true;
        continue;
      }
      // The reveal owns the screen until the player dismisses it; when it
      // does, the way out appears underneath.
      if (b.phase === 'rewards' && this.gachaReveal === null) {
        b.phase = 'done';
        moved = true;
        continue;
      }
      break;
    }
    if (moved) this.notify();
  }

  dismissBattle(): void {
    this.battle = null;
    this.notify();
  }

  // --------------------------------------------------------------- heroes

  doPull(banner: BannerId = STANDARD_BANNER): void {
    const result = pull(this.state, banner);
    if (result.result === 'NotEnoughKeys') {
      this.shake([]);
    } else if (result.result === 'Pulled') {
      playSfx('gemSpend');
      this.openReveal(banner, [result]);
    }
    this.notify();
  }

  /** Ten fragments buy a hero the banner has not offered
   *  (Docs/features/10-heroes.md §4). */
  doUnlockHero(id: HeroId): void {
    const result = unlockHero(this.state, id);
    if (result === 'Unlocked') playSfx('chainFinished');
    else if (result === 'NotEnoughFragments') this.toast('Not enough fragments yet');
    this.notify();
  }

  doLevelHero(id: HeroId): void {
    const result = levelUpHero(this.state, id);
    if (result === 'Levelled') playSfx('upgradeBought');
    else if (result === 'NotEnoughXp') this.shake(['HeroXp']);
    else if (result === 'AscensionCapped') this.toast('Their ascension holds them back');
    this.notify();
  }

  doBuySkillRank(id: HeroId): void {
    const result = buySkillRank(this.state, id);
    if (result === 'Ranked') playSfx('upgradeBought');
    else if (result === 'NotEnoughStardust') this.shake(['Stardust']);
    else if (result === 'NotEnoughMaterial') this.toast('Not enough precious material yet');
    else if (result === 'LevelTooLow') this.toast('Reach the level first');
    this.notify();
  }

  doAscendHero(id: HeroId): void {
    const result = ascendHero(this.state, id);
    if (result === 'Ascended') playSfx('upgradeBought');
    else if (result === 'NotEnoughFragments') this.toast('Not enough Fragments yet');
    else if (result === 'NotEnoughStardust') this.shake(['Stardust']);
    this.notify();
  }

  /** Army headroom, for the card's blocked reason. */
  armyRoom(): { used: number; cap: number } {
    return { used: committedTroops(this.state), cap: armyCap(this.state) };
  }

  doFinishTraining(district: District): void {
    const result = finishLineWithGems(this.state, district.uniqueId, this.now());
    if (result === 'Success') playSfx('gemSpend');
    else if (result === 'NotEnoughGems') this.shake(['Gems']);
    this.notify();
  }

  /** Put a ward's worth of wounded back in the ranks. One order, one wait,
   *  in the hall the player pressed it on. */
  doHealWounded(unitId: UnitId, count: number, at?: District): void {
    const result = healWounded(this.state, unitId, count, this.now(), at);
    if (result === 'Queued') {
      playSfx('unitTrained');
    } else if (result === 'NotEnoughResources') {
      this.shake(Object.keys(healCost(this.state, unitId, count)) as CurrencyId[]);
    } else if (result === 'ArmyAtCapacity') {
      this.toast('No room in the ranks — upgrade a military hall');
    } else if (result === 'NoBuilding') {
      this.toast('No hall here can look after them');
    }
    this.notify();
  }

  /** The infirmary, for the card that draws it: who is waiting, and how full
   *  the ward is. */
  woundedInfo(): { byUnit: Array<{ unitId: UnitId; count: number }>; used: number; cap: number } {
    const byUnit = (Object.keys(UNITS) as UnitId[])
      .map((unitId) => ({ unitId, count: woundedOf(this.state, unitId) }))
      .filter((w) => w.count > 0);
    return { byUnit, used: woundedCount(this.state), cap: woundedCap(this.state) };
  }

  healPrice(unitId: UnitId, count: number): Record<string, number> {
    return healCost(this.state, unitId, count);
  }

  healWait(unitId: UnitId, count: number): number {
    const infirmary = infirmaries(this.state)[0];
    return healSecondsAt(this.state, infirmary?.uniqueId, unitId, count);
  }

  /** How many one press of Train orders (the card's x1 · x10 · x100 · All).
   *  A presenter's choice, kept for the session: every card shares it. */
  trainAmount: TrainAmount = 1;

  /** The amount selector's tap: the next amount, round. */
  cycleTrainAmount(): void {
    this.trainAmount = TRAIN_AMOUNTS[(TRAIN_AMOUNTS.indexOf(this.trainAmount) + 1) % TRAIN_AMOUNTS.length];
    this.notify();
  }

  /** Train at the card's amount: one order of that many, all or none. Silent
   *  — the button clicks; the batch sounds when it is done (`tick`). */
  doTrain(unitId: TrainableId, at?: District): TrainResult {
    const plan = trainPlan(this.state, unitId, this.trainAmount);
    const result = trainBatch(this.state, unitId, plan.count, this.now(), at);
    if (result === 'NotEnoughResources') {
      const cost = plan.cost as Wallet;
      const name = unitId === 'Villager'
        ? (plan.count === 1 ? 'a villager' : `${formatExact(plan.count)} villagers`)
        : (plan.count === 1 ? `a ${UNITS[unitId].name}` : `${formatExact(plan.count)} ${UNITS[unitId].name}s`);
      if (!this.offerShortfall(`Train ${name}`, cost, () => this.doTrain(unitId, at))) {
        this.shake(Object.keys(cost) as CurrencyId[]);
      }
    }
    if (result === 'AtMax') this.toast(this.atMaxWords());
    if (result === 'NoBuilding' && unitId !== 'Villager') {
      this.toast(
        `Build the ${trainerName(unitId)} first — it is where ${UNITS[unitId].name}s are trained`);
    }
    if (result === 'ArmyAtCapacity') {
      this.toast(`Army at capacity (${formatExact(committedTroops(this.state))}/${formatExact(armyCap(this.state))}) — build or upgrade a military building`);
    }
    this.notify();
    return result;
  }

  /** Queue one of this workshop's good. The crew does the rest. */
  doQueueGood(districtUniqueId: string): void {
    const result = queueGood(this.state, districtUniqueId, this.now());
    if (result === 'Queued') playSfx('click');
    if (result === 'NotEnoughResources') this.shake(['Gold', 'Wood', 'Stone']);
    if (result === 'NotEnoughMana') this.shake(['Mana']);
    if (result === 'NotEnoughGoods') this.toast('Not enough refined goods for that');
    if (result === 'QueueFull') this.toast('The queue is full — upgrade the workshop for a longer one');
    this.notify();
  }

  doCancelWorkshopItem(districtUniqueId: string, index: number): void {
    cancelWorkshopItem(this.state, districtUniqueId, index, this.now());
    this.notify();
  }

  doRushWorkshopItem(districtUniqueId: string): void {
    const result = finishItemWithGems(this.state, districtUniqueId, this.now());
    if (result === 'NotEnoughGems') this.shake(['Gems']);
    this.notify();
  }

  setOverlay(name: OverlayName | null): void {
    // No payer profile, no game past the First Morning: the profile sheet has
    // the screen until one is chosen (14-monetization.md §3). Whatever was
    // asked for waits.
    if (this.payerDue() && name !== 'payerProfile') {
      if (name !== null) this.afterProfileOverlay = name;
      name = 'payerProfile';
    }
    // A padlocked door says what opens it and opens nothing
    // (Docs/features/22-progression.md §3).
    const door = name === null ? undefined : OVERLAY_DOOR[name];
    if (name !== null && name !== 'welcome' && name !== 'payerProfile') this.noteFirstTap(`menu:${name}`);
    if (name === 'survey') {
      recordEvent(this.state, { kind: 'signal', key: 'surveyOpened' });
      this.track('survey_opened');
    }
    // Back from its own confirmation, or from a splash opened from it, is
    // not a new visit.
    if (name === 'store' && this.openOverlay !== 'store' && this.openOverlay !== 'iapConfirm' && !this.backFromSplash) {
      this.track('store_opened', { from: this.openOverlay ?? this.scene });
      this.storeVisits += 1;
    }
    if (name !== 'iapConfirm') this.iapDismissed();
    if (door !== undefined && !isDoorOpen(this.state, door)) {
      this.toast(DOOR_HINT[door]);
      this.notify();
      return;
    }
    this.openOverlay = name;
    // The picker and the shortfall are sheets over the card they were opened
    // from: the card stays.
    if (name !== null && name !== 'speedup' && name !== 'shortfall' && name !== 'relicPicker' && name !== 'relicMoveConfirm') {
      this.inspectedDistrictId = null;
      this.inspectedSite = null;
    }
    if (name !== 'speedup') this.speedJob = null;
    if (name !== 'shortfall') this.shortfallAsk = null;
    // Building happens on the province: the Build menu takes the player home.
    if (name === 'build' && this.scene === 'world') this.scene = 'province';
    // The picker and the shortfall go back to the sheet they came from, so the
    // hex that sheet is about stays chosen under them.
    if (name !== 'world' && name !== 'army' && name !== 'speedup' && name !== 'shortfall'
      && name !== 'worldSlot' && name !== 'worldBuilding' && name !== 'relicPicker') this.selectedHex = null;
    if (name !== 'worldBuilding' && name !== 'relicPicker') this.worldBuilding = null;
    // Leaving the roster forgets which hero was open, so coming back lands on
    // the grid rather than inside whoever was last read.
    if (name !== 'heroes') this.openHeroId = null;
    // Anything else taking the screen closes a picker without an answer.
    if (name !== 'heroPicker') this.heroPick = null;
    // Opening the Bag is seeing what came in: the nav's orb clears.
    if (name === 'bag') markBagOpened(this.state);
    if (name !== 'bag') this.bagPicked = null;
    if (name !== 'relic') this.openRelicId = null;
    this.notify();
  }

  /** True when a sheet, panel or placement mode is covering the main screen.
   *  The quest tracker hides while anything is on top of the map. */
  hasOpenSheet(): boolean {
    return (
      this.mode.kind !== 'normal' || this.openOverlay !== null ||
      this.inspectedDistrictId !== null || this.inspectedSite !== null
    );
  }

  /** The one Close affordance: dismiss whatever menu, panel, or mode is on screen. */
  dismiss(): void {
    this.mode = { kind: 'normal' };
    this.selectedHex = null;
    this.iapDismissed();
    // The profile sheet cannot be dismissed — there is nothing behind it yet.
    this.openOverlay = this.payerDue() ? 'payerProfile' : null;
    this.inspectedDistrictId = null;
    this.inspectedSite = null;
    this.pendingSku = null;
    this.heroPick = null;
    this.notify();
  }

  // ------------------------------------------------------------------- queries

  /** Per-second Build CTA: some uncapped district is affordable AND has a legal cell. */
  buildCtaLit(): boolean {
    return BUILDABLE_DISTRICTS.some((id) => this.canBuildNow(id));
  }

  /** How many buildings could be placed right now — the Build tab's count. */
  buildCtaCount(): number {
    return BUILDABLE_DISTRICTS.filter((id) => this.canBuildNow(id)).length;
  }

  /** Under its cap, affordable this second, and somewhere legal to put it —
   *  the map scan last, as the dearest of the three. */
  canBuildNow(id: DistrictId): boolean {
    const def = DISTRICTS[id];
    if (districtCount(this.state, id) >= maxDistrictCount(this.state, def)) return false;
    if (def.hostsRelic) {
      const offer = shrineBuild(this.state);
      if (offer.kind === 'gems') return this.walletValue('Gems') >= offer.gems && canPlaceAnywhere(this.state, this.map, id);
      if (offer.kind !== 'materials') return false;
    }
    if (!canAfford(this.state.city.wallet, nextBuildCost(this.state, id))) return false;
    return canPlaceAnywhere(this.state, this.map, id);
  }

  /** Per-second Research CTA: some technology can be started. The same shape
   *  as `buildCtaLit` — the tab only lights when the screen behind it has
   *  something the player can actually press.
   *
   *  It used to be two questions, because an upgrade was a different kind of
   *  purchase. Every node is a technology now, so it is one. */
  researchCtaLit(): boolean {
    return anyResearchActionable(this.state);
  }

  /** How many technologies can be started — the Research tab's count. */
  researchCtaCount(): number {
    return researchActionableCount(this.state);
  }

  /** Resource cells a worker building at `cell` (level 1) would capture. */
  /** What a building at `cell` would work. `level` matters for a MOVE: an
   *  upgraded Sawmill keeps its bigger radius when it is picked up, and
   *  previewing it at level 1 would understate the spot it is being moved to. */
  /** How far a producer of this kind reaches at `level`, the tree's
   *  `influenceRadius` included — what sim/workers.ts#influenceRadius would
   *  say for a building standing there. */
  reachAt(definitionId: DistrictId, level: number): number {
    const def = DISTRICTS[definitionId];
    if (def.influenceRadiusPerLevel.length === 0) return 0;
    return Math.floor(techValue(this.state, 'influenceRadius', levelIndexed(def.influenceRadiusPerLevel, level),
      { district: definitionId }));
  }

  capturedCells(definitionId: DistrictId, cell: Coord, level = 1): Coord[] {
    const def = DISTRICTS[definitionId];
    if (def.harvestSources.length === 0 || def.influenceRadiusPerLevel.length === 0) return [];
    const radius = this.reachAt(definitionId, level);
    return cellsWithinRadiusOfRect(this.map, cell, def.size, radius).filter(
      (c) => {
        if (this.state.fog.revealed[coordKey(c)] !== true) return false;
        const here = harvestSourceAt(this.state, c);
        return here !== null && def.harvestSources.includes(here);
      },
    );
  }

  /** The map plot the tutorial is pointing at, set by the stage every frame
   *  a line points at one (ui/stage/stage.ts) and drawn on the ground. */
  tutorialFocus: { cell: Coord; span: { x: number; y: number } } | null = null;

  /** Bumped by every notify(): what the map's markers are cached against. */
  private notifies = 0;
  private markerCache: { key: string; layer: MarkerLayer } | null = null;

  /**
   * What the map draws over the ground — asked once a FRAME. Everything in it
   * but the hint and the spell wheels moves only with the state (which always
   * ends in a notify), the mode and the selection, so that part is built once
   * per change and kept; placing a building recomputed its range, adjacency,
   * captured cells and ghost steps sixty times a second.
   */
  markers(): MarkerLayer {
    const key = `${this.notifies}|${JSON.stringify(this.mode)}|${this.ghostHeld}|${this.inspectedDistrictId}`;
    if (this.markerCache?.key !== key) this.markerCache = { key, layer: this.buildMarkers() };
    // The two that run on the clock: the hint's expiry, the wheels' sweep.
    const clock = performance.now();
    this.relicBursts = this.relicBursts.filter((b) => clock - b.at < RELIC_BURST_MS);
    return {
      ...this.markerCache.layer,
      spellZones: this.spellZones(), tutorialFocus: this.tutorialFocus,
      relicBursts: this.relicBursts.map((b) => ({ ...b, t: (clock - b.at) / RELIC_BURST_MS })),
    };
  }

  private buildMarkers(): MarkerLayer {
    const layer: MarkerLayer = {
      selected: null,
      validCells: [],
      validColor: PALETTE.validTarget,
      influenceCells: [],
      yieldCells: [],
      previewCell: null,
      previewGlyph: null,
      previewSprite: null,
      previewSize: null,
      previewSteps: this.ghostSteps(),
      previewBlocked: this.ghostBlock() !== null,
      previewHeld: this.ghostHeld,
      previewId: this.mode.kind === 'placing' ? `build:${this.mode.definitionId}`
        : this.mode.kind === 'moving' ? `move:${this.mode.districtUniqueId}`
          : this.mode.kind === 'transplanting' ? `transplant:${coordKey(this.mode.origin)}` : '',
      previewScaleIn: this.mode.kind === 'placing',
      selectedSize: null,
      liftedDistrictId: this.mode.kind === 'moving' ? this.mode.districtUniqueId : null,
      inspectedDistrictId: this.inspectedDistrictId,
      spellZones: [],
      tutorialFocus: null,
      shrineRelics: this.shrineRelics(),
      auraBadges: this.auraBadges(),
      relicBursts: [],
    };
    if (this.mode.kind === 'transplanting') {
      // A tree or a crop plot on the move: its own drawing — the one its
      // origin shows, grown — on a feature's canvas, and its old cell faint.
      const def = FEATURES[this.mode.feature];
      layer.previewCell = this.mode.selected;
      layer.previewGlyph = def.glyph;
      layer.previewSprite = def.sprite;
      layer.previewFeature = true;
      layer.previewSize = { x: 1, y: 1 };
      layer.liftedFeatureKey = coordKey(this.mode.origin);
    }
    if (this.mode.kind === 'placing') {
      const def = DISTRICTS[this.mode.definitionId];
      // Outline valid spots only for restricted buildings (Housing/Farm/
      // FarmLands); an unrestricted one would just outline most of the map.
      // The RANGE and per-cell yields are shown for the selected placement.
      if (hasPlacementRestriction(this.mode.definitionId)) {
        layer.validCells = validPlacementCells(this.state, this.map, this.mode.definitionId).map(
          (cell) => ({ cell, label: '' }),
        );
      }
      // No footprint outline: the ghost's own rim and its move arrows say
      // which building is out and where it stands.
      layer.previewCell = this.mode.selected;
      layer.previewGlyph = def.glyph;
      layer.previewSprite = def.sprite;
      layer.previewSize = def.size;
      // Adjacency preview: a label over every neighbor the new building
      // would modify, and over the ghost itself (what it would receive).
      if (this.mode.selected) {
        const adj = placementAdjacency(this.state, this.mode.definitionId, this.mode.selected);
        for (const g of adj.given) {
          layer.yieldCells.push({
            cell: g.district.location,
            ...adjacencyReadout(g.stat, g.magnitude),
          });
        }
        for (const r of adj.received) {
          layer.yieldCells.push({ cell: this.mode.selected, ...adjacencyReadout(r.stat, r.total) });
        }
      }
      // A crop plot IS the resource, so what it would hold goes on the ghost.
      if (this.mode.selected) {
        const provided = providedYieldLabel(this.state, this.map, this.mode.definitionId, this.mode.selected);
        if (provided) layer.yieldCells.push({ cell: this.mode.selected, ...provided });
      }
      if (this.mode.selected && def.influenceRadiusPerLevel.length > 0) {
        layer.influenceCells = withFootprint(cellsWithinRadiusOfRect(
          this.map, this.mode.selected, def.size, this.reachAt(this.mode.definitionId, 1),
        ), this.mode.selected, def.size);
        if (def.harvestSources.length > 0) {
          layer.yieldCells = this.capturedCells(this.mode.definitionId, this.mode.selected).map(
            // What each captured cell HOLDS, so a Sawmill's radius shows which
            // trees are worth more before the shed is paid for.
            (cell) => ({ cell, ...cellYieldLabel(this.state, this.map, cell) }),
          );
        }
      }
    } else if (this.mode.kind === 'moving') {
      // The same vocabulary as placement, and deliberately so — a move is the
      // same decision as a placement, made once the building already exists.
      // The one difference is what counts as legal: the footprint it is
      // standing on is its own, so it stays available to it.
      const def = DISTRICTS[this.mode.definitionId];
      if (hasPlacementRestriction(this.mode.definitionId)) {
        layer.validCells = validPlacementCells(
          this.state, this.map, this.mode.definitionId, this.mode.districtUniqueId,
        ).map((cell) => ({ cell, label: '' }));
      }
      // No footprint outline: the ghost's own rim and its move arrows say
      // which building is out and where it stands.
      layer.previewCell = this.mode.selected;
      layer.previewGlyph = def.glyph;
      layer.previewSprite = def.sprite;
      layer.previewSize = def.size;
      if (this.mode.selected) {
        const adj = placementAdjacency(this.state, this.mode.definitionId, this.mode.selected,
          this.mode.districtUniqueId);
        for (const g of adj.given) {
          layer.yieldCells.push({
            cell: g.district.location,
            ...adjacencyReadout(g.stat, g.magnitude),
          });
        }
        for (const r of adj.received) {
          layer.yieldCells.push({ cell: this.mode.selected, ...adjacencyReadout(r.stat, r.total) });
        }
        const provided = providedYieldLabel(this.state, this.map, this.mode.definitionId, this.mode.selected);
        if (provided) layer.yieldCells.push({ cell: this.mode.selected, ...provided });
        // A SHRINE WITH A RELIC carries its aura with it: the gold ring where
        // it would land, and a badge on everything the relic would work on
        // there — the reading a Shrine is placed by.
        const aura = this.movingAura();
        if (aura !== null) {
          layer.influenceCells = this.map.cells.filter((c) => areaCovers(aura.area, c));
          layer.influenceIsAura = true;
          const label = `+${relicPercent(passiveValue(this.state, aura.relic))}`;
          for (const cell of aura.here) layer.yieldCells.push({ cell, label, tone: 'good' });
        }
        if (def.influenceRadiusPerLevel.length > 0) {
          const district = districtById(this.state, this.mode.districtUniqueId);
          layer.influenceCells = withFootprint(cellsWithinRadiusOfRect(
            this.map, this.mode.selected, def.size,
            this.reachAt(this.mode.definitionId, district?.level ?? 1),
          ), this.mode.selected, def.size);
          if (def.harvestSources.length > 0) {
            layer.yieldCells = this.capturedCells(
              this.mode.definitionId, this.mode.selected, district?.level ?? 1,
            ).map((cell) => ({ cell, ...cellYieldLabel(this.state, this.map, cell) }));
          }
        }
      }
    } else if (this.mode.kind === 'casting') {
      // The same highlight vocabulary as placement — valid cells outlined,
      // the chosen one selected — because it is the same decision shape.
      const active = ARTIFACTS[this.mode.artifactId].active!;
      layer.validCells = validCastCells(this.state, this.map, this.mode.artifactId)
        .map((cell) => ({ cell, label: '' }));
      layer.validColor = PALETTE.castTarget;
      layer.selected = this.mode.selected;
      layer.selectedSize = { x: 1, y: 1 };
      if (this.mode.selected) {
        // A SURVEY LIGHTS THE FOG IT WOULD LIFT, each cell labelled with what
        // it would have cost — the decision is Gold against Mana, and the
        // grid is where that question gets answered.
        if (active.id === 'Survey') {
          layer.yieldCells = surveyCells(
            this.state, this.map, this.mode.selected,
            activeRadius(this.state, this.mode.artifactId),
          ).map((cell) => ({
            cell,
            label: formatCount(divinationSaving(this.state, this.map, cell)),
            icon: 'Gold' as const,
            tone: 'good' as const,
          }));
        }
      }
    } else if (this.inspectedDistrictId) {
      const district = districtById(this.state, this.inspectedDistrictId);
      // No selection outline: the building pulses white while its card is
      // open (MarkerLayer.inspectedDistrictId), and its area is the ink.
      if (district) {
        if (district.state === 'Built' && DISTRICTS[district.definitionId].hostsRelic) {
          // A Shrine's area is its aura, in gold (sim/hosts.ts).
          // Gold while it sleeps or stands empty — where it WOULD reach; an
          // awake one is already drawn in violet, with its wheel (M82).
          const awake = district.hosts !== undefined && isAwake(this.state, district.hosts);
          const aura = auraOf(this.state, district, district.hosts ?? 'GildedLedger');
          layer.influenceCells = awake ? [] : this.map.cells.filter((c) => areaCovers(aura, c));
          layer.influenceIsAura = true;
        } else if (district.state === 'Built') {
          layer.influenceCells = withFootprint(influenceCells(this.state, this.map, district),
            district.location, DISTRICTS[district.definitionId].size);
        }
      }
    }
    return layer;
  }

  revealCostAt(cell: Coord): number {
    return revealCostForCell(this.state, this.map, cell);
  }

  /**
   * What the bottom bar shows while a ghost is out — for a new building and
   * for one being relocated alike.
   *
   * One shape for both because it is one decision: "is this a good spot".
   * `kind` is what the bar switches on, and a move differs in exactly three
   * ways — no price, no wait, and it previews the influence the building
   * ALREADY has rather than a level-1 footprint.
   */
  /** The relic a Shrine on the move holds, its aura where the ghost stands,
   *  and what that aura would reach there and where it stands now; null for
   *  anything else on the move. */
  private movingAura(): { relic: ArtifactId; area: ModifierArea; here: Coord[]; now: number } | null {
    if (this.mode.kind !== 'moving' || this.mode.selected === null) return null;
    const district = districtById(this.state, this.mode.districtUniqueId);
    const relic = district?.hosts;
    if (district === undefined || relic === undefined) return null;
    const home = auraOf(this.state, district, relic);
    const area = { ...home, centre: this.mode.selected };
    return {
      relic,
      area,
      here: auraTargets(this.state, this.map, relic, area, district.uniqueId),
      now: auraTargets(this.state, this.map, relic, home, district.uniqueId).length,
    };
  }

  placementInfo(): {
    kind: 'build' | 'move';
    definitionId: DistrictId;
    cell: Coord | null;
    cost: ReturnType<typeof nextBuildCost>;
    duration: number;
    affordable: boolean;
    captured: number;
    /** Move only: the ghost is still sitting where it started. */
    unmoved: boolean;
    /** Why the ghost may not stand where it is; null when it may. */
    blocked: string | null;
    /** Move only, a Shrine holding a relic: what its aura would reach here
     *  and reaches where it stands. */
    aura?: { ground: boolean; here: number; now: number };
  } | null {
    if (this.mode.kind === 'moving') {
      const { definitionId, selected, origin, districtUniqueId } = this.mode;
      const level = districtById(this.state, districtUniqueId)?.level ?? 1;
      return {
        kind: 'move',
        definitionId,
        cell: selected,
        cost: {},
        duration: 0,
        affordable: true,
        captured: selected ? this.capturedCells(definitionId, selected, level).length : 0,
        unmoved: selected !== null && selected.x === origin.x && selected.y === origin.y,
        blocked: this.ghostBlockWords(),
        ...(() => {
          const aura = this.movingAura();
          return aura === null ? {} : {
            aura: { ground: worksOnGround(aura.relic), here: aura.here.length, now: aura.now },
          };
        })(),
      };
    }
    if (this.mode.kind !== 'placing') return null;
    const { definitionId, selected } = this.mode;
    if (!selected) {
      return {
        kind: 'build', definitionId, cell: null, cost: {},
        duration: 0, affordable: false, captured: 0, unmoved: false, blocked: null,
      };
    }
    // A premium Shrine is paid in Gems, the city's price not at all.
    const gems = this.mode.premium ? premiumShrinePrice(this.state) ?? 0 : 0;
    const cost = this.mode.premium ? { Gems: gems } : nextBuildCost(this.state, definitionId);
    return {
      kind: 'build',
      definitionId,
      cell: selected,
      cost,
      duration: buildDurationForCell(this.state, definitionId, selected, this.map),
      affordable: this.mode.premium ? getWallet(this.state.player.wallet, 'Gems') >= gems : canAfford(this.state.city.wallet, cost),
      captured: this.capturedCells(definitionId, selected).length,
      unmoved: false,
      blocked: this.ghostBlockWords(),
    };
  }

  freeWorkers(): number {
    return availableWorkers(this.state);
  }

  workableCellsOf(district: District): Coord[] {
    return workableCells(this.state, this.map, district);
  }

  /** Villager-training snapshot for the Townhall card & map bar. */
  trainingInfo(): {
    active: boolean; progress: number; remainingSeconds: number; queued: number;
    cost: number; atMax: boolean;
  } {
    const now = this.now();
    const hall = townhall(this.state);
    const line = hall ? lineFor(this.state, hall.uniqueId) : [];
    const head = line[0];
    const completesAt = head ? trainingCompletesAt(head) : null;
    const total = head ? itemTrainSeconds(head) * 1000 : 0;
    const queued = line.length;
    return {
      active: completesAt !== null && Number.isFinite(completesAt),
      progress: completesAt === null ? 0 : Math.min(1, Math.max(0, 1 - (completesAt - now) / total)),
      remainingSeconds: completesAt === null ? 0 : Math.max(0, (completesAt - now) / 1000),
      queued,
      cost: populationCost(this.state.city.population + queued),
      atMax: this.state.city.population + queued >= maxPopulation(this.state),
    };
  }

  residentsIn(district: District): number {
    return residentsOf(this.state, district);
  }

  // --------------------------------------------------------- dragging a ghost

  /** The footprint the ghost currently occupies, or null when there is no
   *  ghost on the map. Placing and moving are the same shape here. */
  private ghostFootprint(): { cell: Coord; size: { x: number; y: number } } | null {
    if (this.mode.kind === 'placing' && this.mode.selected) {
      return { cell: this.mode.selected, size: DISTRICTS[this.mode.definitionId].size };
    }
    if (this.mode.kind === 'moving' && this.mode.selected) {
      return { cell: this.mode.selected, size: DISTRICTS[this.mode.definitionId].size };
    }
    if (this.mode.kind === 'transplanting' && this.mode.selected) {
      return { cell: this.mode.selected, size: { x: 1, y: 1 } };
    }
    return null;
  }

  /**
   * Does a drag starting here GRAB the ghost rather than pan the camera?
   *
   * Only when the press lands inside the ghost's own footprint. Anywhere else
   * on the map still pans, which is what keeps the two gestures from fighting:
   * the player can always reach the rest of the world while a ghost is out,
   * and the ghost is a thing you put your finger on rather than a mode that
   * captures every drag.
   */
  grabGhost(sx: number, sy: number): boolean {
    const ghost = this.ghostFootprint();
    if (ghost === null) return false;
    if (this.tapGate !== null && !this.tapGate(null, 'ghost')) return false;
    const cell = this.camera.screenToCell(sx, sy);
    const inside = cell.x >= ghost.cell.x && cell.x < ghost.cell.x + ghost.size.x
      && cell.y >= ghost.cell.y && cell.y < ghost.cell.y + ghost.size.y;
    if (inside) this.ghostGrip = { x: cell.x - ghost.cell.x, y: cell.y - ghost.cell.y };
    return inside;
  }

  /** Which cell of its footprint the finger holds the ghost by, so a drag
   *  carries it from there rather than snapping its anchor under the finger. */
  private ghostGrip: Coord = { x: 0, y: 0 };

  /**
   * Drag the ghost under the pointer.
   *
   * The anchor follows the finger by CELL, not by pixel offset, onto any
   * cell of the map: an illegal one is taken too, and the ghost turns red
   * there, so the finger is never fighting a ghost that will not follow.
   */
  dragGhostTo(sx: number, sy: number): void {
    if (this.mode.kind !== 'placing' && this.mode.kind !== 'moving' && this.mode.kind !== 'transplanting') return;
    const finger = this.camera.screenToCell(sx, sy);
    const cell = { x: finger.x - this.ghostGrip.x, y: finger.y - this.ghostGrip.y };
    const current = this.mode.selected;
    if (current && current.x === cell.x && current.y === cell.y) return;
    if (!this.map.terrain.has(coordKey(cell))) return;
    this.stepGhostTo(cell);
  }

  /** The ghost takes a cell — a click for each, a duller one where it may
   *  not stand. */
  private stepGhostTo(cell: Coord): void {
    if (this.mode.kind !== 'placing' && this.mode.kind !== 'moving' && this.mode.kind !== 'transplanting') return;
    const was = this.mode.selected;
    this.mode.selected = cell;
    if (was === null || was.x !== cell.x || was.y !== cell.y) {
      playSfx('ghostStep', { rate: this.ghostBlock() === null ? 1 : 0.78, group: 'ghostStep', limit: 2 });
    }
    this.notify();
  }

  /** The ghost is set down at `cell` and stands there now: it drops onto
   *  its plot with a thud and a puff of dust. Put back where it started, it
   *  only settles. */
  private setGhostDown(cell: Coord, definitionId: DistrictId, home = false): void {
    this.ghostFx.land(coordKey(cell), cell, DISTRICTS[definitionId].size);
    if (home) {
      playSfx('ghostStep', { rate: 0.85 });
      return;
    }
    playSfx('ghostPlant');
    haptic(20);
  }

  /** A confirm on a spot the ghost may not take: it shakes its head. */
  private refuseGhost(words: string): void {
    this.ghostFx.shake();
    playSfx('error');
    haptic([12, 40, 12]);
    this.toast(words);
    this.notify();
  }

  /** The finger is on the ghost (true) or has let go (false). */
  holdGhost(held: boolean): void {
    if (this.ghostHeld === held) return;
    this.ghostHeld = held;
    // Picked up: a pop and a stretch, and it rises under the finger.
    if (held) {
      this.ghostFx.grab();
      playSfx('ghostLift');
      haptic(10);
    }
    this.notify();
  }

  /**
   * Which ways the ghost can step: one grid axis each, wherever the map
   * goes on — legal or not, as a drag; the ghost's colour says which.
   */
  ghostSteps(): Coord[] {
    if (this.ghostHeld) return [];
    if (this.mode.kind !== 'placing' && this.mode.kind !== 'moving' && this.mode.kind !== 'transplanting') return [];
    const at = this.mode.selected;
    if (!at) return [];
    return [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter((d) =>
      this.map.terrain.has(coordKey({ x: at.x + d.x, y: at.y + d.y })));
  }

  /**
   * The placement window's close. A build goes back to the Build menu it
   * came from — on the tab it was picked from — so the player can compare;
   * a move goes back to the card it was started from.
   */
  closePlacement(): void {
    const mode = this.mode;
    this.mode = { kind: 'normal' };
    this.ghostHeld = false;
    if (mode.kind === 'placing') this.openOverlay = 'build';
    else if (mode.kind === 'moving') {
      this.inspectedDistrictId = mode.districtUniqueId;
      // Back where it stood: it settles onto its old plot.
      this.setGhostDown(mode.origin, mode.definitionId, true);
    } else if (mode.kind === 'transplanting') {
      this.ghostFx.land(coordKey(mode.origin), mode.origin, { x: 1, y: 1 });
      playSfx('ghostStep', { rate: 0.85 });
    }
    this.notify();
  }

  // ------------------------------------------------------- the world board

  /** Which board is on screen. Not saved: a reload opens on the province. */
  scene: 'province' | 'world' = 'province';
  /** The world hex the dispatch sheet is about. */
  selectedHex: number | null = null;
  /** The building of the selected hex whose popup is open. */
  worldBuilding: WorldUpgrade | null = null;
  /** The world's camera, handed over by main once the canvas exists. */
  worldCamera: HexCamera | null = null;

  private worldTicks = 0;
  /** The world server, handed over by main — the local stand-in for now
   *  (worldServer/local.ts). */
  worldServer: WorldServerApi | null = null;
  /** What the server last said about the board. */
  worldView: WorldSnapshot | null = null;

  /** The friends list (friendsClient.ts): its server is set by main. */
  friends: FriendsClient = new FriendsClient(this, null);

  /** The world ranking (19 §12): the kingdoms of the player's world by the
   *  hexes each holds, as the server last told it; null off a board. */
  worldRanking(): RankedSeat[] | null {
    return this.worldView === null ? null : worldRanking(this.worldView);
  }

  /** The name the world board knows the player by, once they sit on one. */
  worldNickname(): string | null {
    return this.worldView?.seats.find((s) => s.you)?.name ?? null;
  }

  /** The dev tool's "play as": the seat world commands are made for, or
   *  null for the player's own. A rival's commands cost the player nothing. */
  actingSeat: number | null = null;
  /** Who the player is to the servers: the signed-in user's id, handed over
   *  by main; a test plays as the stand-in's old fixed id. */
  playerId = 'local-player';

  // ------------------------------------------------------------ analytics
  // Docs/plans/analytics.md. Main hands over the sender when the cloud is
  // up; without it every event is dropped where it is made.
  analytics: Analytics | null = null;
  private adOfferShown = false;

  /** Record an event now, on the game's clock. */
  track(name: string, props: Record<string, unknown> = {}): void {
    this.analytics?.track(name, props, this.now());
  }

  /** Send on what the sim put in its outbox, at the sim's own times. */
  drainAnalytics(): void {
    for (const e of this.state.pendingAnalytics.splice(0)) this.analytics?.track(e.name, e.props, e.at, e.offline);
  }

  /** Where the player is, for every event (Docs/plans/analytics.md §2). */
  analyticsContext(): AnalyticsContext {
    return {
      th: townhall(this.state).level,
      quest: this.state.quests.index,
      playedMin: Math.floor(this.state.signals.playMs / 60_000),
      scene: this.openOverlay ?? this.scene,
    };
  }

  /** A SKU's price and what the month's budget had left, for the funnel. */
  private skuProps(id: StoreSkuId): Record<string, unknown> {
    return { sku: id, price_cents: priceCents(id), credit_cents: budgetRemainingCents(this.state, this.now()) };
  }

  /** A confirmation closed without a purchase. */
  private iapDismissed(): void {
    if (this.openOverlay === 'iapConfirm' && this.pendingSku !== null) this.track('dismissed', { sku: this.pendingSku });
  }
  /** Saves the game now — main's save, handed over. A world effect is
   *  acknowledged to the server only once the state it changed is saved, so
   *  a crash between the two delivers it again rather than losing it. */
  persist: (() => void) | null = null;

  /** Where the board comes from: the server's snapshot once there is one,
   *  the locally generated board before (sim/world/source.ts). */
  worldSource(): WorldSource {
    // Read every frame of the board: made again only when what it is made
    // from changes — a new snapshot, or the save's board and name.
    const ref = this.state.world.board;
    const key = this.worldView ?? `${ref.id}|${ref.seed}|${ref.seat}|${this.state.city.name}`;
    if (this.sourceMemo === null || this.sourceMemo.key !== key) {
      this.sourceMemo = {
        key, source: this.worldView !== null ? snapshotWorld(this.worldView) : localWorld(ref, this.state.city.name),
      };
    }
    return this.sourceMemo.source;
  }
  private sourceMemo: { key: unknown; source: WorldSource } | null = null;

  /** The seat world commands are made for. */
  worldSeat(): number {
    return this.actingSeat ?? this.state.world.board.seat;
  }

  /** Whether the player sits on a world board: null until the server has
   *  said (19 §1.3). A player is on no board until they first go out. */
  worldSeated: boolean | null = null;

  /** Find out where the player sits — never taking a seat. */
  async connectWorld(): Promise<void> {
    if (this.worldServer === null || this.worldReading) return;
    this.worldReading = true;
    try {
      const r = await this.worldServer.connect(this.playerId);
      if (r.kind === 'unseated') this.worldSeated = false;
      if (r.kind === 'seated') await this.seatedOn(r.snapshot);
    } finally {
      this.worldReading = false;
    }
  }

  /** On a board: the server's view, the research it should know of, and
   *  any army the save has out that this server never heard of. */
  private async seatedOn(snap: WorldSnapshot): Promise<void> {
    this.worldSeated = true;
    this.applyWorldSnapshot(snap);
    this.recallUnknownArmies(snap);
    await this.worldServer?.setBoost(worldImprovementBoost(this.state));
  }

  /** A read or a join on its way: the next waits its turn rather than
   *  piling up behind a slow server. */
  private worldReading = false;

  /** Ask the server for the board as it stands now — connecting first if
   *  it could not before. Nothing to read for a player on no board. */
  async refreshWorld(): Promise<void> {
    if (this.worldServer === null || this.worldReading || this.worldSeated === false) return;
    if (this.worldView === null) return this.connectWorld();
    this.worldReading = true;
    try {
      const snap = await this.worldServer.snapshot();
      if (snap !== null) this.applyWorldSnapshot(snap);
    } finally {
      this.worldReading = false;
    }
  }

  /** The crest last sent to the world board, so a board that has not
   *  caught up yet is not told twice. `undefined`: nothing sent. */
  private crestSentToWorld: string | null | undefined = undefined;
  /** The Townhall level last sent to the world board, likewise. */
  private townhallSentToWorld: number | undefined = undefined;

  /** The crest the player's kingdom wears (sim/crest.ts). */
  myCrest(): Crest {
    const p = this.state.kingdom.profile;
    return crestOf(p.nickname ?? '', p.crest);
  }

  /** The shield editor's Save: the save first, then both servers. */
  setMyCrest(crest: Crest): void {
    const id = crestId(crest);
    if (this.state.kingdom.profile.crest === id) return;
    this.state.kingdom.profile.crest = id;
    this.track('crest_changed', { tincture: crest.tincture, charge: crest.charge });
    this.crestSentToWorld = id;
    if (this.worldSeated === true) void this.worldServer?.setCrest(id);
    void this.friends.hello();
    this.notify();
  }

  /** The name is asked for once a session, the moment the world opens —
   *  after its splash and its scene, never over a sheet (§2.1). */
  private askedName = false;
  private maybeAskName(): void {
    if (this.askedName || this.worldServer === null || this.state.kingdom.profile.nickname !== null) return;
    if (!this.doorOpen('world') || this.openOverlay !== null || this.unlockQueue.length > 0) return;
    if (this.scene !== 'province' || this.battle !== null || this.gachaReveal !== null) return;
    if (SCENES.some((s) => s.id === 'world') && this.state.tutorial.seen['scene:world'] !== true) return;
    this.askedName = true;
    void this.connectWorld().then(() => {
      if (this.worldSeated === false && this.openOverlay === null) this.setOverlay('nickname');
    });
  }

  /** The nickname sheet's state: what was typed, why the server refused it,
   *  and whether a join is on its way. */
  nicknameDraft = '';
  nicknameRefused: string | null = null;
  joiningWorld = false;

  /** Take a seat on the world board under the nickname chosen, and go out. */
  async doJoinWorld(nickname: string): Promise<void> {
    if (this.worldServer === null || this.joiningWorld) return;
    this.nicknameDraft = nickname;
    const problem = nicknameProblem(nickname);
    if (problem !== null) {
      this.nicknameRefused = problem;
      this.notify();
      return;
    }
    this.joiningWorld = true;
    this.nicknameRefused = null;
    this.notify();
    const r = await this.worldServer.join(nickname);
    this.joiningWorld = false;
    if (!r.ok) {
      this.nicknameRefused = r.why === 'NicknameTaken' ? 'Another kingdom has that name' : this.worldRefusal(r.why);
      this.notify();
      return;
    }
    await this.seatedOn(r.snapshot);
    this.track('world_joined', { board: r.snapshot.board.id, players: r.snapshot.seats.filter((s) => !s.bot).length });
    if (this.openOverlay === 'nickname') this.openOverlay = null;
    this.goOutToWorld();
  }

  /** An army this save has out that the server it joined never heard of —
   *  sent on another server, the stand-in before the real one — comes home
   *  whole: the server holds the army, and it holds none of these. Only on a
   *  join, when no army can be on its way out. */
  private recallUnknownArmies(snap: WorldSnapshot): void {
    const known = new Set(snap.armies.filter((a) => a.owner === snap.board.seat).map((a) => a.id));
    for (const out of [...this.state.world.armies]) {
      if (known.has(out.id)) continue;
      receiveArmy(this.state, { armyId: out.id, at: snap.at, troops: out.troops, fallen: [], heroes: [] });
    }
  }

  /** Take what the server says. A different board or seat makes the fog
   *  meaningless, so it starts again; the Sanctuaries held set the Mana
   *  ceiling. */
  private applyWorldSnapshot(snap: WorldSnapshot): void {
    // Who the board knows the player as: the save keeps the name (it opens
    // the friends list), and the board is told the crest until it agrees.
    const you = snap.seats.find((s) => s.you);
    const profile = this.state.kingdom.profile;
    if (you !== undefined && profile.nickname === null) profile.nickname = you.name;
    if (you !== undefined && (you.crest ?? null) !== profile.crest && this.crestSentToWorld !== profile.crest) {
      this.crestSentToWorld = profile.crest;
      void this.worldServer?.setCrest(profile.crest);
    }
    // And its Townhall, which the ranking shows: told again whenever the
    // board's number is behind the city's.
    const level = townhall(this.state).level;
    if (you !== undefined && (you.townhall ?? null) !== level && this.townhallSentToWorld !== level) {
      this.townhallSentToWorld = level;
      void this.worldServer?.setTownhall(level);
    }
    const mine = this.state.world.board;
    if (snap.board.id !== mine.id || snap.board.seed !== mine.seed || snap.board.seat !== mine.seat) {
      this.state.world.board = { ...snap.board };
      this.state.world.revealed = emptyBits();
      this.state.world.explorers = [];
      this.state.world.effectSeq = 0;
    }
    // What the server owed: armies home and the reports of what they did.
    // Each is sent until acknowledged, so only those past the last one
    // applied are new.
    const fresh = snap.effects.filter((e) => (e.seq ?? 0) > this.state.world.effectSeq);
    for (const e of fresh) {
      if (e.kind === 'armyHome') {
        receiveArmy(this.state, e);
        const count = (list: Array<{ count: number }>): number => list.reduce((n, x) => n + x.count, 0);
        postNews(this.state, {
          group: 'armyHome', key: `armyHome:${e.armyId}`, at: e.at, troops: count(e.troops), fallen: count(e.fallen),
        });
      }
      else if (e.kind === 'loot') {
        // A dungeon room's pay (11-expeditions.md §7): Gold to the city,
        // Knowledge and Stardust to the kingdom, Hero XP as Hero XP.
        addToWallet(this.state.city.wallet, 'Gold', e.gold);
        addToWallet(this.state.kingdom.wallet, 'Knowledge', e.knowledge);
        addToWallet(this.state.kingdom.wallet, 'Stardust', e.stardust);
        addHeroXp(this.state, e.heroXp);
        if (e.gems) addToWallet(this.state.player.wallet, 'Gems', e.gems);
        // A camp's Wood, Food and Stone, in hours of the city's own
        // production, priced now (19 §5.4).
        const made = campPay(this.state, e.hours ?? 0);
        for (const [c, n] of Object.entries(made) as Array<[CurrencyId, number]>) addToWallet(this.state.city.wallet, c, n);
        // A world relic's door, then its fragments: a boss's one, a Portal
        // floor's what its pack was worth (Docs/plans/relics-and-bag.md §5).
        const won = e.from ?? (e.pack ? 'portal' : 'room');
        const found = [
          ...openRelicDoor(this.state, won),
          ...dropFragments(this.state, 'world', e.pack ? RELIC_RULES.perPackTier[e.pack] ?? 1 : won === 'boss' ? 1 : 0, ['loot', e.seq ?? e.at]),
        ];
        if (found.length > 0) this.toast(fragmentWords(found));
        // A camp's lump of precious material, to the city's goods (19 §7.4).
        if (e.precious) {
          addGood(this.state.city.goods, e.precious.id, e.precious.amount);
          this.toast(`+${formatCount(e.precious.amount)} ${e.precious.id}`);
        }
        this.reward({ Gold: e.gold, ...made, Knowledge: e.knowledge, Stardust: e.stardust, HeroXp: e.heroXp, ...(e.gems ? { Gems: e.gems } : {}) });
      } else if (e.kind === 'portalClosed') {
        // A Portal opening closed with the player in its ranking: a place
        // that pays waits to be claimed, any other is news (26 §2).
        if (e.gems > 0) {
          if (!this.state.world.portalPrizes.some((p) => p.event === e.event)) {
            this.state.world.portalPrizes.push({ event: e.event, place: e.place, of: e.of, floor: e.floor, gems: e.gems });
          }
        } else {
          postNews(this.state, {
            group: 'portal', key: `portal:closed:${e.event}`, at: e.at, open: false, place: e.place, of: e.of, floor: e.floor,
          });
        }
      } else if (e.kind === 'goods') {
        // Precious material from the Exchange: an offer taken, or one back.
        addGood(this.state.city.goods, e.lot.id, e.lot.amount);
        postNews(this.state, { group: 'world', key: `world:${e.seq ?? e.at}`, at: e.at, text: e.text, good: true });
      } else {
        postNews(this.state, {
          group: 'world', key: `world:${e.seq ?? e.at}`, at: e.at, text: e.text, good: e.good,
          ...(e.hex === undefined ? {} : { hex: e.hex }),
        });
      }
    }
    if (fresh.some((e) => e.kind === 'armyHome')) playSfx('armyHome');
    if (fresh.length > 0) {
      this.state.world.effectSeq = Math.max(...fresh.map((e) => e.seq ?? 0));
      this.persist?.();
    }
    // The Portal opening: every player on the board is told, once an
    // opening (19 §10.3).
    if (snap.portal.open && snap.portal.opensAt > this.state.world.portalAnnounced) {
      this.state.world.portalAnnounced = snap.portal.opensAt;
      postNews(this.state, {
        group: 'portal', key: `portal:open:${snap.portal.opensAt}`, at: snap.portal.opensAt, open: true,
        closesAt: snap.portal.closesAt,
      });
      this.persist?.();
    }
    if (this.actingSeat === null) this.worldServer?.acknowledge(this.state.world.effectSeq);
    this.worldView = snap;
    this.reportSeenCamps(snap);
    const board = snapshotWorld(snap).board();
    this.state.world.sanctuaries = snap.hexes.filter((h) => h.owner === snap.board.seat && h.held && h.active
      && board.hexes[h.index].features.includes('Sanctuary')).length;
    // THE WORLD RELICS A CHAPEL HOLDS, as the server says: only they act. A
    // relic whose ground was lost is simply not here any more — home, at its
    // level (relic-restoration.md §5.3).
    if (this.actingSeat === null) {
      const chapels = snap.hexes
        .filter((h) => h.owner === snap.board.seat && h.relic !== null && h.relic !== undefined)
        .map((h) => h.relic!.id).sort();
      if (chapels.join() !== [...this.state.world.chapels].sort().join()) {
        this.state.world.chapels = chapels;
        syncArtifactModifiers(this.state);
      }
    }
    this.notify();
  }

  /** A lurking camp raids only once the player has seen it, and only the
   *  player's fog knows that: tell the server of any it has not been told
   *  of (19 §5.5). Once at a time. */
  private seenPending = false;
  private reportSeenCamps(snap: WorldSnapshot): void {
    if (this.worldServer === null || this.actingSeat !== null || this.seenPending) return;
    const told = new Set(snap.seenCamps ?? []);
    const fog = worldFog(this.state);
    const fresh = snapshotWorld(snap).board().hexes
      .filter((h) => h.camp?.lurking === true && !told.has(h.index) && hasBit(fog, h.index))
      .map((h) => h.index);
    if (fresh.length === 0) return;
    this.seenPending = true;
    void this.worldServer.reportSeen(fresh).then((r) => {
      this.seenPending = false;
      if (r.ok) this.applyWorldSnapshot(r.snapshot);
    });
  }

  /** The line a refused world command shows. */
  private worldRefusal(why: Refusal): string {
    const LINES: Record<Refusal, string> = {
      NoSuchHex: 'There is no such place', NotAdjacent: 'Claim the ground beside it first',
      Taken: 'Someone holds it already', NeverHeld: 'Nobody can hold this place',
      NotYours: 'This is not your ground', NotStanding: 'The district is still being built',
      Busy: 'A builder is already at work there', WrongGround: 'That cannot stand here',
      MaxLevel: 'It is as high as it goes', Inactive: 'Cut off from your city — reconnect it first',
      NoBoard: 'The roads to the world are closed',
      NoArmy: 'That army is not yours to call', NotAFortress: 'Only a standing Fortress takes a garrison',
      Garrisoned: 'That Fortress is manned already', NothingThere: 'There is nothing there to take',
      OwnGround: 'That ground is yours already',
      Shut: 'The Portal is shut',
      NoRoute: 'No way there through explored ground',
      NothingBuilding: 'Nothing is being built there',
      Guarded: 'A camp holds it — beat it, or pay it off, first',
      Marching: 'Your army is on the road — hurry it instead',
      NotARival: 'Only a rival can be played', Offline: 'The world cannot be reached — try again',
      BadNickname: 'That name cannot be used', NicknameTaken: 'Another kingdom has that name',
      NoChapel: 'Build a Chapel there first', TooManyChapels: 'Hold more ground to build another Chapel',
      NoSlot: 'Every slot of this district is taken',
      NotAWorldRelic: 'Only a restored world relic can be hosted there',
    };
    return LINES[why];
  }

  /** The Gold for a world build, or the line that says why not. */
  private worldBuilderRefusal(gold: number): string | null {
    if (getWallet(this.state.city.wallet, 'Gold') < gold) return 'Not enough Gold';
    return null;
  }

  /** Repair a district a camp burnt: a builder, and a share of a claim's
   *  Gold (19 §5.5). */
  async doRepairHex(index: number, gold: number): Promise<void> {
    await this.worldCommand(index, 'Repair', 1, gold, (asSeat) => this.worldServer!.repair(index, asSeat));
  }

  /** Claim a hex: build its district, with a builder and its Gold. */
  async doClaimHex(index: number, gold: number): Promise<void> {
    const district = districtOf(this.worldSource().board().hexes[index]) ?? 'Rural';
    await this.worldCommand(index, district, 1, gold, (asSeat) => this.worldServer!.claim(index, asSeat));
  }

  /** Finish the builder's work on one of the player's hexes now, with Gems:
   *  the server makes it stand, and the builder comes home. */
  async doFinishHexWork(index: number): Promise<void> {
    if (this.worldServer === null) return;
    const h = this.worldSource().hexOf(index);
    const work = h === null ? null : hexWork(h);
    if (work === null) return;
    const gems = gemsToFinish((work.endsAt - this.now()) / 1000);
    if (getWallet(this.state.player.wallet, 'Gems') < gems) {
      this.shake(['Gems']);
      this.notify();
      return;
    }
    const r = await this.worldServer.finish(index);
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    this.state.player.wallet.Gems = getWallet(this.state.player.wallet, 'Gems') - gems;
    const done = this.state.world.builds.find((b) => b.index === index);
    this.state.world.builds = this.state.world.builds.filter((b) => b !== done);
    playSfx('gemSpend');
    if (done !== undefined) this.toast(worldBuildDone(done.what, done.level));
    this.applyWorldSnapshot(r.snapshot);
  }

  /** Bring an army to where it is going now, with Gems for the time left. */
  async doFinishArmyMarch(armyId: string): Promise<void> {
    if (this.worldServer === null) return;
    const a = this.worldView?.armies.find((x) => x.id === armyId);
    if (a === undefined || a.at === null) return;
    const left = Math.max(0, (a.at - this.now()) / 1000);
    const gems = gemsToFinish(left);
    if (getWallet(this.state.player.wallet, 'Gems') < gems) {
      this.shake(['Gems']);
      this.notify();
      return;
    }
    const r = await this.worldServer.hurryArmy(armyId, left + 1);
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    this.state.player.wallet.Gems = getWallet(this.state.player.wallet, 'Gems') - gems;
    playSfx('gemSpend');
    this.applyWorldSnapshot(r.snapshot);
  }

  /** Build an upgrade into a district, or raise it a level. */
  async doUpgradeHex(index: number, what: WorldUpgrade, level: number, gold: number): Promise<void> {
    await this.worldCommand(index, what, level, gold, (asSeat) => this.worldServer!.upgrade(index, what, asSeat));
  }

  private async worldCommand(
    index: number, what: WorldBuildWhat, level: number, gold: number,
    send: (asSeat?: number) => ReturnType<WorldServerApi['claim']>,
  ): Promise<void> {
    if (this.worldServer === null) return;
    // Playing a rival's part: the server does the rest, and nothing is paid.
    if (this.actingSeat !== null) {
      const r = await send(this.actingSeat);
      if (!r.ok) this.toast(this.worldRefusal(r.why));
      await this.refreshWorld();
      return;
    }
    // Every builder busy raises the builder sheet, as a refused city build
    // does: its free row offers this very job once a builder comes home.
    if (busyBuilders(this.state) >= buildQueueCapacity(this.state)) {
      this.builderAsk = { kind: 'world', index, what, level, gold };
      this.offerBuilder();
      this.notify();
      return;
    }
    const refused = this.worldBuilderRefusal(gold);
    // A Fortress level may ask for precious materials too (19 §7.6).
    const goods = isUpgrade(what) ? worldUpgradeGoods(this.state, what, level) : {};
    const short = Object.entries(goods).find(([g, n]) => getGood(this.state.city.goods, g as GoodId) < (n as number));
    if (refused !== null || short !== undefined) {
      this.toast(refused ?? `Not enough ${short![0]}`);
      this.notify();
      return;
    }
    const r = await send();
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    this.state.city.wallet.Gold = getWallet(this.state.city.wallet, 'Gold') - gold;
    for (const [g, n] of Object.entries(goods)) addGood(this.state.city.goods, g as GoodId, -(n as number));
    this.state.world.builds.push({ index, what, level, finishesAt: r.finishesAt });
    playSfx('buildPlaced');
    // Started from a free builder's row: the sheet was only in the way.
    if (this.openOverlay === 'builder') this.openOverlay = null;
    this.applyWorldSnapshot(r.snapshot);
  }

  // ------------------------------------------------------ armies on the board

  /** Where the army being composed is going, and to do what. */
  armyTarget: number | null = null;
  armyPurpose: ArmyPurpose = 'attack';
  /** The menu the army screen was opened from: a sent army goes back to it,
   *  to be watched on its way. */
  private armyReturnTo: OverlayName | null = null;

  /** Compose an army for a hex, on the attack screen. */
  openArmy(target: number, purpose: ArmyPurpose): void {
    this.armyReturnTo = this.openOverlay === 'army' ? this.armyReturnTo : this.openOverlay;
    this.armyTarget = target;
    this.armyPurpose = purpose;
    this.selectedHex = target;
    this.partyHeroes = this.state.heroes.owned
      .filter((h) => heroCanFight(this.state, h, this.now()))
      .slice(0, heroSlots(this.state));
    this.prefillParty('Any');
    this.setOverlay('army');
  }

  /** What the army would meet there, as far as the player can see: the
   *  garrisons covering the hex, and what they are worth. */
  armyPreview(): { power: number; attack: number; garrisons: number } {
    const target = this.armyTarget;
    const party = partyOf(this.state, this.expeditionParty.filter((s) => s.count > 0), this.partyHeroes, this.now());
    const attack = partyPower(party);
    if (target !== null && this.armyPurpose === 'clear') {
      return { power: this.worldSource().board().hexes[target]?.camp?.power ?? 0, attack, garrisons: 0 };
    }
    if (target === null || this.armyPurpose !== 'attack') return { power: 0, attack, garrisons: 0 };
    const source = this.worldSource();
    const holder = source.hexOf(target)?.owner ?? null;
    let power = 0;
    let garrisons = 0;
    for (const i of [target, ...boardNeighbors(target)]) {
      const g = source.hexOf(i)?.garrison;
      if (g && g.owner === holder) { power += g.power; garrisons += 1; }
    }
    return { power, attack, garrisons };
  }

  /** The quickest way an army can take to a hex: through Revealed ground
   *  only, at an army's pace (sim/world/travel.ts). Null when there is none. */
  armyRoute(target: number): Route | null {
    const fog = worldFog(this.state);
    const speed = armyMarchSpeed(this.state);
    return fastestRoute(this.worldSource().board().hexes, this.homeHex(), target, 'army', (i) => hasBit(fog, i), () => speed);
  }

  /** Why the army cannot set out, in words, or null. */
  armyBlockText(): string | null {
    if (this.armyTarget === null) return 'No destination chosen';
    if (this.armyRoute(this.armyTarget) === null) return 'No way there through explored ground';
    if (freeArmySlots(this.state) === 0) return 'Every army is out — the War Camp sends more';
    if (this.partyHeroes.length === 0) return 'An army needs a hero to lead it';
    if (this.partyHeroes.some((h) => !heroCanFight(this.state, h, this.now()))) return 'A hero in it cannot march';
    if (this.armyPurpose !== 'claim' && !this.expeditionParty.some((s) => s.count > 0)) return 'An army needs soldiers';
    if (sendFights(this.armyPurpose)) return this.fightManaBlock();
    return null;
  }

  /** What a fight on the board costs in Mana now (08 §1). */
  fightMana(): number {
    return fightMana(this.state);
  }

  /** Why the city cannot pay for a fight on the board, or null. */
  fightManaBlock(): string | null {
    const cost = fightMana(this.state);
    return canPayMana(this.state, cost) ? null : `Not enough Mana — a fight costs ${formatExact(cost)}`;
  }

  /** Set the army out. Its troops leave the roster and its heroes are busy
   *  until the server says it is home. */
  async doSendArmy(): Promise<void> {
    const target = this.armyTarget;
    if (this.worldServer === null || target === null || this.armyBlockText() !== null) return;
    const slots = this.expeditionParty.filter((s) => s.count > 0).map((s) => ({ ...s }));
    const heroes = [...this.partyHeroes];
    const board = partyBoard(partyOf(this.state, slots, heroes, this.now()));
    const route = this.armyRoute(target)!;
    // A fight is paid once the server has said yes (19 §4).
    const cost = sendFights(this.armyPurpose) ? fightMana(this.state) : 0;
    const r = await this.worldServer.sendArmy({
      purpose: this.armyPurpose, target, heroes, board, path: route.path, speed: armyMarchSpeed(this.state),
    });
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    payMana(this.state, cost);
    departArmy(this.state, {
      id: r.army, heroes, troops: slots.map((s) => ({ unitId: s.unitId, count: s.count })),
      target, purpose: this.armyPurpose,
    });
    this.armyTarget = null;
    // Back to the menu it was sent from — the camp, the dungeon, the Portal —
    // which now shows the army on its way. None: the board.
    const back = this.armyReturnTo;
    this.armyReturnTo = null;
    if (back === null) this.dismiss();
    else { this.selectedHex = target; this.setOverlay(back); }
    playSfx('armyMarch');
    this.toast(`Your army marches — there in ${formatCountdown(Math.max(0, r.arrivesAt - this.now()) / 1000)}`);
    this.applyWorldSnapshot(r.snapshot);
  }

  /** Fight the next room of the dungeon an army camps at, and watch it. */
  /** Fight the camp an army waits at, and watch it (19 §5.4). */
  async doFightCamp(armyId: string): Promise<void> {
    if (this.worldServer === null) return;
    if (this.refuseFight()) return;
    const cost = fightMana(this.state);
    const r = await this.worldServer.fightCamp(armyId);
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    payMana(this.state, cost);
    this.applyWorldSnapshot(r.snapshot);
    this.openBattle(r.log, {
      title: CAMP_TITLE[r.creature],
      subtitle: r.won ? 'Beaten — the loot comes home with the army' : 'Beaten back',
      prizes: [],
      enemyFaces: UNIT_CREATURE_AVATAR,
      backdrop: 'field',
    });
    this.notify();
  }

  async doDelveRoom(armyId: string): Promise<void> {
    if (this.worldServer === null) return;
    if (this.refuseFight()) return;
    const cost = fightMana(this.state);
    const r = await this.worldServer.delveRoom(armyId);
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    payMana(this.state, cost);
    // What the room paid, for the spoils the delve screen shows after the
    // fight (19 §8.2) — the newest loot owed, read before the snapshot's
    // effects are spent.
    const loot = r.snapshot.effects.filter((e) => e.kind === 'loot').at(-1);
    this.delveSpoils = {
      won: r.won, depth: r.depth, room: r.room, boss: r.boss, lost: r.lost,
      loot: loot?.kind === 'loot' ? { gold: loot.gold, heroXp: loot.heroXp, stardust: loot.stardust, knowledge: loot.knowledge, precious: loot.precious } : null,
    };
    this.delveDepth = null;
    this.applyWorldSnapshot(r.snapshot);
    this.openBattle(r.log, {
      title: `Depth ${formatCount(r.depth + 1)} · Room ${formatCount(r.room)}`,
      subtitle: r.boss ? 'The depth’s boss' : 'A dungeon room',
      prizes: [],
      // A dungeon's squads are creatures, as the delve screen draws them.
      enemyFaces: UNIT_CREATURE_AVATAR,
      backdrop: r.boss ? 'boss' : 'dungeon',
    });
    this.notify();
  }

  /** Short of the Mana a fight costs: say so, and fight nothing. */
  private refuseFight(): boolean {
    const block = this.fightManaBlock();
    if (block === null) return false;
    this.toast(block);
    this.notify();
    return true;
  }

  /** Go down the Portal's next floor, and watch the fight. */
  async doDescendPortal(armyId: string): Promise<void> {
    if (this.worldServer === null) return;
    if (this.refuseFight()) return;
    const cost = fightMana(this.state);
    const r = await this.worldServer.descendPortal(armyId);
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    payMana(this.state, cost);
    this.applyWorldSnapshot(r.snapshot);
    this.openBattle(r.log, {
      title: `The Dark Portal · floor ${formatCount(r.room)}`,
      subtitle: 'The depths below',
      prizes: [],
      enemyFaces: UNIT_CREATURE_AVATAR,
      backdrop: 'portal',
    });
    this.notify();
  }

  /** Call an army home. */
  async doRecallArmy(armyId: string): Promise<void> {
    if (this.worldServer === null) return;
    const r = await this.worldServer.recall(armyId, this.actingSeat ?? undefined);
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    playSfx('armyRecall');
    this.applyWorldSnapshot(r.snapshot);
  }

  /** What revealing an explorer's hex says: what it uncovered, and what its
   *  target paid, flown into the header. */
  private explorerFound(found: ExplorerFound): void {
    playSfx('revealDone');
    const paid = found.paid === null ? '' : ` — and ${scoutWords(found.paid)}`;
    this.toast(found.revealed > 0
      ? `${formatCount(found.revealed)} new hexes on the map${paid}`
      : `Nothing new out there${paid}`);
    if (found.paid !== null && Object.keys(found.paid.wallet).length > 0) this.reward(found.paid.wallet);
  }

  /** A trip's wait bought off: the hex it explored, revealed — or the
   *  explorer home. */
  private tripFinished(finished: TripFinished): void {
    if (finished.found !== null) this.explorerFound(finished.found);
  }

  /** The trips the player has already been told are waiting at their hex. */
  private readyHeard = new Set<string>();

  /** The dungeon the delve screen is about, the depth it shows (null: the
   *  player's current one), and what the last room fought there paid. */
  delveHex: number | null = null;
  /** The Portal whose descent is open. */
  portalHex: number | null = null;

  /** The Dark Portal's descent, from its card. */
  openPortalDescent(index: number): void {
    this.portalHex = index;
    playSfx('click');
    this.setOverlay('portal');
  }
  delveDepth: number | null = null;
  delveSpoils: {
    won: boolean; depth: number; room: number; boss: boolean; lost: number;
    loot: { gold: number; heroXp: number; stardust: number; knowledge: number; precious?: { id: PreciousId; amount: number } } | null;
  } | null = null;

  /** Open a dungeon's descent at the player's current depth. */
  openDelve(index: number): void {
    this.delveHex = index;
    this.delveDepth = null;
    this.delveSpoils = null;
    this.setOverlay('delve');
  }

  /** Close the spoils, back to the descent. */
  dismissSpoils(): void {
    this.delveSpoils = null;
    this.notify();
  }

  /** Pay a camp off with its tribute: the camp is beaten for the player,
   *  and pays nothing (19 §5.4). */
  async doTributeCamp(index: number): Promise<void> {
    if (this.worldServer === null) return;
    const camp = this.worldSource().board().hexes[index]?.camp;
    if (!camp) return;
    const cost = campTribute(camp.power);
    if (!canAfford(this.state.city.wallet, cost)) {
      this.shake(Object.keys(cost) as CurrencyId[]);
      this.notify();
      return;
    }
    const r = await this.worldServer.tribute(index, this.actingSeat ?? undefined);
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    pay(this.state.city.wallet, cost);
    playSfx('tribute');
    this.toast(`The camp of ${CAMP_CREATURE[camp.creature]} takes the tribute and leaves`);
    this.applyWorldSnapshot(r.snapshot);
  }

  /** Collect a held hex's stores into the purse. */
  async doCollectHex(index: number): Promise<void> {
    if (this.worldServer === null) return;
    const r = await this.worldServer.collect(index, this.actingSeat ?? undefined);
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    if (this.actingSeat === null) {
      if (r.paid !== null) {
        // Knowledge is the kingdom's; every other coin the city's purse.
        addToWallet(r.paid.currency === 'Knowledge' ? this.state.kingdom.wallet : this.state.city.wallet, r.paid.currency, r.paid.amount);
        this.reward({ [r.paid.currency]: r.paid.amount } as Wallet);
      }
      // A rich district's precious store, to the city's goods (19 §7.4).
      if (r.precious !== null) {
        addGood(this.state.city.goods, r.precious.id, r.precious.amount);
        this.toast(`+${formatCount(r.precious.amount)} ${r.precious.id}`);
      }
    }
    this.applyWorldSnapshot(r.snapshot);
  }

  /** Go out to the world board — behind the Watchtower's door. */
  enterWorld(): void {
    if (!isDoorOpen(this.state, 'world')) {
      this.toast(DOOR_HINT.world);
      this.notify();
      return;
    }
    // The first time out, the player takes a seat, under a name of their
    // choosing (19 §1.3); until then they are on no board. With no server
    // at all there is no seat to take: the board is the one made here.
    if (this.worldServer !== null && this.worldSeated !== true) {
      void this.connectWorld().then(() => {
        if (this.worldSeated === true) this.goOutToWorld();
        // A kingdom with a name — taken on a board the world has since
        // replaced, or on the friends list — sits down under it again.
        else if (this.worldSeated === false && this.state.kingdom.profile.nickname !== null) {
          void this.doJoinWorld(this.state.kingdom.profile.nickname);
        } else if (this.worldSeated === false && this.friends.snap?.me) void this.doJoinWorld(this.friends.snap.me.nickname);
        else if (this.worldSeated === false) this.setOverlay('nickname');
        else this.toast(this.worldRefusal('Offline'));
        this.notify();
      });
      return;
    }
    this.goOutToWorld();
  }

  private goOutToWorld(): void {
    this.dismiss();
    this.scene = 'world';
    // Out onto the board at the player's own city, up close — or at the hex
    // a notice's Go asked for, with its card open.
    const arrival = this.worldArrival;
    this.worldArrival = null;
    this.worldCamera?.focusHex(hexAt(arrival ?? homeIndex(this.state)));
    if (arrival !== null && this.worldArrivalCard) {
      this.selectedHex = arrival;
      this.openOverlay = 'world';
    }
    this.worldArrivalCard = true;
    void this.refreshWorld();
    this.notify();
  }

  /** The hex the next trip out lands on, instead of home — and whether its
   *  card opens there. */
  private worldArrival: number | null = null;
  private worldArrivalCard = true;

  // ------------------------------------------------------------- notices

  /** The card open over the notices, as it was when its bubble was tapped
   *  (Docs/features/26-notices.md §5): a news is read the moment it opens,
   *  so its card keeps what it said. */
  noticeCard: { id: string; news: News[]; heroes: HeroId[] } | null = null;

  /** Open a bubble's card. A news group is read as it opens; so is the
   *  rested heroes' mark. */
  openNotice(id: string): void {
    const t = this.now();
    const group = id.startsWith('news:') ? id.slice('news:'.length) as NewsGroup : null;
    const news = group === null ? [] : newsOf(this.state, group);
    const heroes = id === 'state:heroRested' ? restedHeroes(this.state, t) : [];
    this.noticeCard = { id, news, heroes };
    if (group !== null) readNews(this.state, group);
    if (heroes.length > 0) forgetRested(this.state, t);
    this.track('notice_opened', { id, count: Math.max(news.length, heroes.length, 1) });
    playSfx('click');
    this.setOverlay('notice');
  }

  /** A news bubble left unread on screen long enough goes (26 §3): its group
   *  is read, as opening it would, without the card. */
  dismissNews(id: string): void {
    if (!id.startsWith('news:')) return;
    readNews(this.state, id.slice('news:'.length) as NewsGroup);
    this.notify();
  }

  /** The Portal ranking Gems won and not yet claimed, oldest first. */
  portalPrizes(): readonly PortalPrize[] {
    return this.state.world.portalPrizes;
  }

  /** CLAIM a Portal opening's ranking Gems (19 §10.4). */
  claimPortalPrize(event: number): void {
    const prize = this.state.world.portalPrizes.find((p) => p.event === event);
    if (prize === undefined) return;
    this.state.world.portalPrizes = this.state.world.portalPrizes.filter((p) => p !== prize);
    addToWallet(this.state.player.wallet, 'Gems', prize.gems);
    this.track('portal_prize_claimed', { place: prize.place, gems: prize.gems });
    this.reward({ Gems: prize.gems });
    this.persist?.();
    this.notify();
  }

  /** The Portal nearest the player's city: where a Portal notice's Go
   *  leads (19 §10 — every board has its own). */
  nearestPortal(): number {
    const home = hexAt(homeIndex(this.state));
    return [...PORTAL_INDICES].sort((a, b) => hexDistance(hexAt(a), home) - hexDistance(hexAt(b), home))[0];
  }

  /** Heroes a fight exhausted who are whole again (sim/heroHealth.ts). */
  restedHeroes(): HeroId[] {
    return restedHeroes(this.state, this.now());
  }

  /** GO: glide to a building in the province and open its card — home from
   *  the board first if out on it. */
  focusDistrict(uniqueId: string): void {
    const d = districtById(this.state, uniqueId);
    if (d === undefined) return;
    if (this.scene === 'world') this.leaveWorld();
    this.setOverlay(null);
    this.inspectedSite = null;
    this.inspectedDistrictId = d.uniqueId;
    this.camera.centerOnCell(d.location, DISTRICTS[d.definitionId].size, CAMERA_GLIDE_MS);
    this.notify();
  }

  /** GO: glide to a site in the province — a landmark, a lair, a ruin. */
  focusSite(cell: Coord): void {
    if (this.scene === 'world') this.leaveWorld();
    this.setOverlay(null);
    this.inspectedDistrictId = null;
    this.inspectedSite = cell;
    this.camera.centerOnCell(cell, undefined, CAMERA_GLIDE_MS);
    this.notify();
  }

  /** GO: a hex of the world board with its card open — out onto the board
   *  first if at home. */
  goToHex(index: number): void {
    if (this.scene !== 'world') {
      this.worldArrival = index;
      this.enterWorld();
      return;
    }
    this.dismiss();
    this.worldCamera?.focusHex(hexAt(index));
    this.selectedHex = index;
    this.setOverlay('world');
  }

  /** Back to the province. */
  leaveWorld(): void {
    if (this.openOverlay === 'world') this.openOverlay = null;
    this.selectedHex = null;
    this.scene = 'province';
    this.notify();
  }

  /** A tap on the world board: a hex opens its sheet; off the board closes
   *  it. The hexagon is the tap target, never the icons on it (19 §1.2). */
  handleWorldTap(sx: number, sy: number): void {
    if (this.worldCamera === null) return;
    const index = hexIndex(this.worldCamera.screenToHex(sx, sy));
    if (this.hexGate !== null && !this.hexGate(index < 0 ? null : index)) return;
    if (index < 0) {
      this.dismiss();
      return;
    }
    // An explorer waiting there: the tap is the reveal.
    if (this.actingSeat === null && this.doRevealHex(index)) return;
    // A ready store of the player's own is collected, as a city building's
    // is: the hex opens its card only when there is nothing to take.
    const held = this.actingSeat === null ? this.worldSource().hexOf(index) : null;
    if (held !== null && held.owner === this.worldSeat() && worldStoreReady(held)) {
      void this.doCollectHex(index);
      return;
    }
    this.selectedHex = index;
    this.setOverlay('world');
  }

  /** A district's empty slot: the buildings that could go in it. */
  openWorldSlot(index: number): void {
    this.selectedHex = index;
    playSfx('click');
    this.setOverlay('worldSlot');
  }

  /** A district's building: what it does, and its next level. */
  openWorldBuilding(index: number, building: WorldUpgrade): void {
    this.selectedHex = index;
    playSfx('click');
    this.setOverlay('worldBuilding');
    this.worldBuilding = building;
    this.notify();
  }

  /** Back from a slot or a building to the hex's card. */
  backToHex(): void {
    if (this.selectedHex === null) {
      this.dismiss();
      return;
    }
    this.setOverlay('world');
  }

  /** Build in a district's empty slot, and go back to its card. */
  doBuildInSlot(index: number, building: WorldUpgrade, gold: number): void {
    this.backToHex();
    void this.doUpgradeHex(index, building, 1, gold);
  }

  /** The relic picker over a Chapel: its one slot, the world relics. */
  openChapelPicker(index: number): void {
    const h = this.worldSource().hexOf(index);
    if (h === null || !h.chapel) return;
    this.relicPick = { shrineId: String(index), slot: h.relic?.id ?? null, chapel: index };
    this.selectedHex = index;
    playSfx('click');
    this.setOverlay('relicPicker');
  }

  /** Bring a hex into view. */
  showHex(index: number): void {
    this.worldCamera?.centerOnHex(hexAt(index));
    this.notify();
  }

  /** Finish what an explorer is doing, with Gems: its work, its hex
   *  revealed at once — or its road home. */
  doFinishExplorer(tripId: string): void {
    const result = finishExplorerWithGems(this.state, tripId, this.now());
    if (result.kind === 'Finished') {
      playSfx('gemSpend');
      this.tripFinished(result.finished);
    } else if (result.kind === 'NotEnoughGems') {
      this.shake(['Gems']);
    }
    this.notify();
  }

  /**
   * THE TAP THAT REVEALS: an explorer waits at this hex, its work done — the
   * hex and the ones round it are uncovered now, and what it found is paid
   * now (19 §3.1). False when nobody waits there.
   */
  doRevealHex(index: number): boolean {
    const result = revealExplored(this.state, index, this.now());
    if (result.kind !== 'Revealed') return false;
    this.dismiss();
    this.explorerFound(result.found);
    this.notify();
    return true;
  }

  /** Out to a hex an explorer waits at, its card shut: the tap on the hex is
   *  the player's to make. From a notice. */
  lookAtHex(index: number): void {
    if (this.scene !== 'world') {
      this.worldArrival = index;
      this.worldArrivalCard = false;
      this.enterWorld();
      return;
    }
    this.dismiss();
    this.worldCamera?.focusHex(hexAt(index));
    this.notify();
  }

  /** The explorers waiting at their hex for the player, the longest first. */
  explorersReady(): Array<{ id: string; target: number }> {
    return readyTrips(this.state, this.now()).map((t) => ({ id: t.id, target: t.target }));
  }

  /** Send an explorer to the hex the sheet is about. */
  doSendExplorer(): void {
    const target = this.selectedHex;
    if (target === null) return;
    const result = dispatchExplorer(this.state, target, this.now());
    if (result.kind === 'Sent') {
      playSfx('explorerDepart');
      this.dismiss();
      return;
    }
    if (result.kind === 'NoExplorerFree') {
      this.toast(explorersOutLine(this.state, result.nextFreeAt, this.now()));
    } else if (result.kind === 'NoRoute') {
      this.toast('No way there through explored ground');
    } else if (result.kind === 'Explored') {
      this.toast('Already explored');
    } else if (result.kind === 'BeingExplored') {
      this.toast('An explorer is already on the way');
    } else if (result.kind === 'NotEnoughGold') {
      this.toast(`Not enough Gold — exploring there costs ${formatExact(result.gold)}`);
    }
    this.notify();
  }

  /** The player's own city on the board. */
  homeHex(): number {
    return homeIndex(this.state);
  }

  /** The cell of the building whose collect bubble covers (sx, sy), if any. */
  private collectBubbleCell(sx: number, sy: number): Coord | null {
    const id = this.collectBubbles.at(sx, sy, performance.now());
    return id === null ? null : districtById(this.state, id)?.location ?? null;
  }

  /** Is `cell` the plot the tutorial's hand, or a quest hint, points at? */
  private isPointedAt(cell: Coord): boolean {
    const f = this.tutorialFocus;
    if (f !== null && cell.x >= f.cell.x && cell.x < f.cell.x + f.span.x
      && cell.y >= f.cell.y && cell.y < f.cell.y + f.span.y) return true;
    const h = this.hintCell();
    return h !== null && h.x === cell.x && h.y === cell.y;
  }

  handleTap(sx: number, sy: number): void {
    // A lair's warning bubble floats over other cells: a tap on it is a tap
    // on the lair (Docs/proposals/lairs.md §6).
    // A store's collect bubble floats over other cells too: a tap on it is a
    // tap on its building, which collects it. Checked front to back, in the
    // order they are drawn — the lair's bubble, the collect bubble, then the
    // lair's picture above its own ground — its pixels, not its box, so the
    // cells round its edges still answer as themselves.
    // A tap on the plot the tutorial or a hint points at is a tap on that
    // plot, whatever bubble floats over it: following the hand must do what
    // the hand says.
    const ground = this.camera.screenToCell(sx, sy);
    const normal = this.mode.kind === 'normal' && !this.isPointedAt(ground);
    // A sleeping Shrine's Mana bubble floats over other cells too: a tap on
    // it is a tap on its Shrine, which opens the Shrine's card. A tap on a
    // building never costs Mana — the price is paid by Activate, in the card.
    const sleeper = normal ? shrineBubbleAt(sx, sy) : null;
    const shrineCell = sleeper === null ? null : hostOf(this.state, sleeper)?.location ?? null;
    const lairBubble = normal && shrineCell === null ? lairBubbleAt(sx, sy) : null;
    const storeCell = normal && shrineCell === null && lairBubble === null ? this.collectBubbleCell(sx, sy) : null;
    const lair = lairBubble ?? (normal && shrineCell === null && storeCell === null ? lairArtAt(sx, sy) : null);
    const cell = shrineCell ?? (lair !== null ? LAIRS[lair].location
      : storeCell ?? ground);
    const hinted = this.hintCell();
    if (hinted && cell.x === hinted.x && cell.y === hinted.y) this.clearHint();
    if (!this.map.terrain.has(coordKey(cell))) {
      // Tapping the void: close card / keep mode (placement & targeting still swallow).
      if (this.mode.kind === 'normal') {
        this.inspectedDistrictId = null;
        this.notify();
      }
      return;
    }
    if (this.tapGate !== null && !this.tapGate(cell, 'tap')) return;
    this.tapChain.dispatch(cell);
  }

  /** The one accessor that knows about the three purses. It reads the scope
   *  off `CURRENCIES` rather than naming currencies here, so a currency that
   *  changes purse — as Knowledge and Stardust did on 2026-09-03 — cannot
   *  desync the presenter from the sim. */
  walletValue(c: CurrencyId): number {
    switch (CURRENCIES[c].scope) {
      case 'player': return getWallet(this.state.player.wallet, c);
      case 'kingdom': return getWallet(this.state.kingdom.wallet, c);
      default: return getWallet(this.state.city.wallet, c);
    }
  }

  // ------------------------------------------------------------------ the HUD

  /** The tech that first makes a currency obtainable — the requiredTech of
   *  whichever district harvests it. Derived rather than listed, so renaming
   *  a tech or moving a resource behind a different one can't desync it. */
  private techForCurrency(c: CurrencyId): TechId | null {
    for (const def of Object.values(DISTRICTS)) {
      if (def.harvestSources.some((s) => HARVEST[s].currencyId === c)) {
        return def.requiredTech;
      }
    }
    return null;
  }

  /**
   * Coins the HUD shows, in order. Gems are not here — they are premium and
   * the header sets them apart.
   *
   * Gold, Food and Wood gate the early game and are always up. Stone would
   * otherwise be a permanent zero for the first hour, so it appears once its
   * tech is researched OR the player holds any.
   *
   * The tech clause is what makes it STICKY: keyed on the balance alone, a
   * counter would vanish the moment the player spent back to zero.
   *
   * Stardust and Knowledge are NOT here. Each is spent in exactly one screen
   * — Stardust in the Reliquary next to the levels it buys, Knowledge in the
   * Research screen next to the tomes — so each reads there, like Fragments
   * and for the same reason. A coin on the plank is a coin you spend from
   * anywhere; neither of those is one.
   */
  /** The calls whose keys the plank shows in place of the coins — while the
   *  store's Heroes tab is open — or null. */
  hudKeys(): BannerId[] | null {
    return this.openOverlay === 'store' && this.storeTabs().open === 'heroes' ? [...BANNER_ORDER] : null;
  }

  visibleCurrencies(): CurrencyId[] {
    // THE PLANK CARRIES WHAT THE OPEN SCREEN SPENDS.
    //
    // The roster spends neither Gold nor timber, and it spends two coins that
    // are on no plank anywhere: Hero XP buys a level, Stardust tolls an
    // ascension. A price with no purse in sight is the bug this fixes, and
    // the refusal shake now has a coin to land on.
    //
    // A SWAP rather than an addition. The plank is the tightest row in the
    // game — four coins, Mana and Gems inside 402px — so six coins would
    // clip two of them away, and the city's four are exactly the ones that
    // buy nothing here. Same move the plaque under it already makes
    // (`hudSlot`): show the reading the player can act on, not all of them.
    if (this.openOverlay === 'heroes') return ['HeroXp', 'Stardust'];
    // The store's calls spend keys, which `hudKeys` puts on the plank: the
    // city's coins buy nothing there.
    if (this.hudKeys() !== null) return [];
    // The tree spends Gold AND the clock, so unlike the roster this one keeps
    // a city coin: a technology's price has two halves and a plank showing
    // one of them is worse than a plank showing neither. Food and timber buy
    // no research, so they stand down.
    // Knowledge is not on the plank: its tab hangs under it and stays down
    // while a menu that spends it is open (`keepsKnowledgeTab`).
    if (this.openOverlay === 'research') return ['Gold'];
    const always: CurrencyId[] = ['Gold', 'Food', 'Wood'];
    const contextual: CurrencyId[] = ['Stone'];
    return [
      ...always,
      ...contextual.filter((c) => {
        const tech = this.techForCurrency(c);
        return (tech !== null && isTechComplete(this.state, tech))
          || this.walletValue(c) > 0;
      }),
    ];
  }

  /**
   * The city plaque: ONE reading, whichever the player can currently act on.
   *
   * Three permanent counters is the spreadsheet problem the redesign opens
   * with — builders only matter while something is being queued, and free
   * workers only while something is being staffed. Showing the live one
   * turns three pieces of trivia into one piece of advice.
   */
  /** Housed villagers and the homes to hold them — a plank read-out now, so
   *  it is its own accessor rather than a case of the contextual slot. */
  population(): { value: number; max: number } {
    return { value: this.state.city.population, max: maxPopulation(this.state) };
  }

  hudSlot(): {
    kind: 'population' | 'workers' | 'builders' | 'army' | 'explorers'; value: number; max: number;
  } {
    // Looking at ground in the mist → the explorers free to send there.
    if (this.scene === 'world' && this.openOverlay === 'world' && this.selectedHex !== null
      && this.selectedHex !== this.homeHex() && fogStateOf(this.state, this.selectedHex) !== 'Revealed') {
      const max = explorerSlots(this.state);
      return { kind: 'explorers', value: freeExplorers(this.state), max };
    }
    // Queueing something → builders.
    if (this.openOverlay === 'build' || this.mode.kind === 'placing') {
      const max = builderCount(this.state);
      return { kind: 'builders', value: max - Math.min(busyBuilders(this.state), max), max };
    }
    const inspected = this.inspectedDistrictId === null
      ? undefined
      : districtById(this.state, this.inspectedDistrictId);
    // Looking at a hall that turns out SOLDIERS → the army cap. It is the
    // number that explains a refused Train, and it is about the city rather
    // than the building, which is exactly what the plaque is for: it used to
    // sit inside the card, where a city-wide ceiling read as a property of
    // whichever hall you happened to have open.
    if (inspected && DISTRICTS[inspected.definitionId].trains.some((t) => t !== 'Villager')) {
      const army = this.armyRoom();
      return { kind: 'army', value: army.used, max: army.cap };
    }
    // Staffing something → the villagers still free to assign. The card's
    // own stepper says how many work HERE; this says how many more can.
    if (inspected && DISTRICTS[inspected.definitionId].maxWorkersPerLevel.length > 0) {
      const working = this.state.city.districts.reduce((n, d) => n + d.assignedWorkers, 0);
      return { kind: 'workers', value: this.freeWorkers(), max: working + this.freeWorkers() };
    }
    return {
      kind: 'population',
      value: this.state.city.population,
      max: maxPopulation(this.state),
    };
  }

  /** Jump to a technology in the tree — for a blocker that names one. */
  focusTech(id: TechId): void {
    this.setUiHint(`tech:${id}`); // set BEFORE the overlay renders
    this.setOverlay('research');
  }

  /** Tapping the population plaque goes to where villagers come from. */
  focusTownhall(): void {
    const hall = townhall(this.state);
    this.setOverlay(null);
    this.inspectedDistrictId = hall.uniqueId;
    this.camera.centerOnCell(hall.location, undefined, CAMERA_GLIDE_MS);
    this.notify();
  }

  /** What the player is missing for a cost; empty when it is affordable.
   *  Lets a blocked action say "Short 12 Wood" instead of just going grey. */
  shortfall(cost: Wallet): Wallet {
    const short: Wallet = {};
    for (const [c, n] of Object.entries(cost) as Array<[CurrencyId, number]>) {
      const have = this.walletValue(c);
      if (have < n) short[c] = n - have;
    }
    return short;
  }
}

/** What a collect tap on each harvest source sounds like. */
/** What one worker delivery from THIS cell is worth, as the placement preview
 *  writes it. Per cell rather than per building, because a Quarry's radius can
 *  hold iron and gold at once and they do not pay the same coin.
 *
 *  It reports what is IN the cell — its whole depot — rather than what one
 *  delivery fetches, and the reason is that only one of the two carries any
 *  information at placement time. A delivery is the same on every cell in
 *  range; a depot is the ground times what the ground does to it, so **the
 *  label changes as the ghost crosses a biome**, which is the decision the
 *  player is actually making (`Docs/features/04-harvest.md` §2.2). */
/** For a district that BECOMES a resource cell — a crop plot — what it would
 *  hold on the ground it is standing on. The plot is the resource, so there is
 *  no radius to preview and nothing on the cell to read yet: the number has to
 *  come from the definition plus the terrain under the ghost. It is the whole
 *  reason to show it, since dragging a plot from grass to sand takes it from
 *  13 Food to 5 and there is otherwise nothing on screen that says so. */
function providedYieldLabel(
  state: GameState, map: MapData, definitionId: DistrictId, cell: Coord,
): YieldLabel | null {
  const plants = DISTRICTS[definitionId].plants;
  if (plants === null) return null;
  const spec = HARVEST[FEATURES[plants].source];
  const held = effectiveStock(state, map, cell, spec);
  const tone = held > spec.stock ? 'good' : held < spec.stock ? 'bad' : undefined;
  return { label: formatCount(held), icon: spec.currencyId, tone };
}

function cellYieldLabel(state: GameState, map: MapData, cell: Coord): YieldLabel {
  const source = harvestSourceAt(state, cell);
  if (source === null) return { label: '' };
  const spec = HARVEST[source];
  const held = effectiveStock(state, map, cell, spec);
  // Toned against the authored stock, so richer and poorer ground read at a
  // glance rather than needing the player to remember the baseline.
  const tone = held > spec.stock ? 'good' : held < spec.stock ? 'bad' : undefined;
  return { label: formatCount(held), icon: spec.currencyId, tone };
}

/** How hard a worker's strike punches the cell, against the player's 1. Enough
 *  to read as the same gesture, not enough to compete with it. */
const STRIKE_PUNCH = 0.55;

/** Below this zoom a strike is silent: at that scale you are reading the city,
 *  and every worked cell chiming at once is noise rather than feedback. */
const STRIKE_AUDIBLE_ZOOM = 0.8;

const TAP_SOUNDS: Record<HarvestSourceId, SfxName> = {
  Forest: 'tapTree',
  Berries: 'tapBerries',
  Crops: 'tapBerries', // same gathering foley until a distinct take lands
  Meat: 'tapAnimals',
  Stone: 'tapStone',
  MountainIron: 'tapIron',
  MountainGold: 'tapIron',
  Fish: 'tapFish',
};

/**
 * The card for a landmark or lair coming into view for the first time.
 *
 * Sighted, not reached: the fog only has to have thinned enough to make it
 * out. That is the moment it becomes a destination, and a destination the
 * player has not been told about is just a sprite they may never walk to.
 *
 * Returns null for an id no longer in the workbook, so a save that remembers
 * a site somebody has since deleted degrades to silence rather than a crash.
 */
export function siteBanner(id: string): Banner | null {
  const landmark = LANDMARKS.find((l) => l.id === id);
  if (landmark) {
    const art = LANDMARK_ART[landmark.kind];
    return {
      title: 'A place of power!',
      icon: art.glyph,
      name: art.name,
      // What it is FOR, in one line — the site card carries the detail.
      desc: 'Clear a path to it and claim it.',
      sprite: art.sprite,
      tone: 'sky',
    };
  }
  const lair = Object.values(LAIRS).find((r) => r.id === id);
  if (lair) {
    return {
      title: 'Lair sighted!',
      icon: lair.glyph,
      name: lair.name,
      desc: lair.description,
      sprite: lair.sprite,
      tone: 'gold',
    };
  }
  // An abandoned building is named the moment it is discovered: the shape in
  // the clouds was the mystery, and this is the find (01-map-and-fog.md §6.3).
  const ruin = ABANDONED.find((a) => a.id === id);
  if (ruin) {
    const def = DISTRICTS[ruin.districtId];
    return {
      title: 'An abandoned building!',
      icon: def.glyph,
      name: ruin.name,
      desc: 'Clear the fog off it, then repair it.',
      sprite: `${def.sprite}_ruin`,
      tone: 'gold',
    };
  }
  return null;
}

/** A map label: the amount as text, the icon as an ATLAS NAME. Never an emoji
 *  in a string — the pill draws the icon from the same atlas the HUD uses
 *  (`Docs/features/05-city-and-districts.md` §4). */
export interface YieldLabel {
  label: string;
  icon?: CurrencyId;
  tone?: 'good' | 'bad';
}

/** "+2" / "−1" — a signed gold/min adjacency modifier, without its icon. */
export function formatSigned(goldPerMinute: number): string {
  const n = Math.abs(Number.isInteger(goldPerMinute)
    ? goldPerMinute : Number(goldPerMinute.toFixed(1)));
  return `${goldPerMinute > 0 ? '+' : '\u2212'}${n}`;
}

/** "+2 🪙" / "−1 🪙" — for the DOM, which sets its own icon beside the text. */
/** A building's range as the map DRAWS it: its rings AND the ground it
 *  stands on. The sim's rings start at 1 — the footprint is not worked —
 *  and drawn without it the area has a hole, outlined round the building. */
function withFootprint(cells: Coord[], anchor: Coord, size: { x: number; y: number }): Coord[] {
  const out = [...cells];
  for (let dy = 0; dy < size.y; dy++) {
    for (let dx = 0; dx < size.x; dx++) out.push({ x: anchor.x + dx, y: anchor.y + dy });
  }
  return out;
}

export const formatAdjacency = (goldPerMinute: number): string =>
  `${formatSigned(goldPerMinute)} 🪙`;

/**
 * How one adjacency effect reads: its text, the icon beside it, and whether
 * it is good news.
 *
 * The tone is NOT the sign. `workTime` and `trainTime` are durations, so a
 * negative magnitude is the happy one — a rule that says −10% is a tenth
 * faster, and painting that red would be exactly backwards.
 */
export const adjacencyReadout = (
  stat: AdjacencyStat, total: number,
): { label: string; icon: IconName; tone: 'good' | 'bad' } => {
  if (stat === 'goldPerMinute') {
    return { label: formatSigned(total), icon: 'Gold', tone: total < 0 ? 'bad' : 'good' };
  }
  const pct = `${formatSigned(Math.round(total * 100))}%`;
  return { label: pct, icon: 'hourglass', tone: total > 0 ? 'bad' : 'good' };
};

/**
 * A currency's emoji, as a STRING.
 *
 * The last legitimate callers are DOM banners that have not moved to `iconEl`
 * yet. **Nothing on the canvas may use this** — the map draws its icons from
 * the UI atlas through `drawIcon`, because an emoji renders from the system
 * face and sits visibly outside the art (`CLAUDE.md`: no emoji fallbacks).
 */
export function icon(c: CurrencyId): string {
  const icons: Record<CurrencyId, string> = {
    Gold: '🪙', Food: '🍎', Wood: '🪵', Stone: '🪨', Mana: '🔮',
    Knowledge: '📜', Stardust: '🌟', HeroXp: '📘', Gems: '💎',
  };
  return icons[c];
}


/** The building that trains a unit type, by name — for the blocker text. */
function trainerName(unitId: UnitId): string {
  const def = Object.values(DISTRICTS).find((d) => d.trains.includes(unitId));
  return def?.name ?? 'right building';
}


/**
 * One relic's effect, said in the player's words at a given value.
 *
 * A speed reads as "30% faster" (the modifier is a multiplier BELOW 1, so the
 * saving is 1 − value); a yield reads as "+25%" or "+2". One place, because
 * the card prints the same sentence twice — now, and at the next level.
 */
function relicEffectText(id: ArtifactId, value: number): string {
  // A relic's stats all share one op — the pair the Sickle and the Hammer carry
  // move together by construction — so the first one says how to read it.
  const { stat, op } = ARTIFACTS[id].passive.stats[0]!;
  if (op !== 'mul') return `${RELIC_SUBJECT[id]} +${formatNumber(value, 1)}`;
  // The tiles under this sentence print the same number, so both read it from
  // one place rather than each rounding it their own way.
  const pct = relicPercent(value);
  // A SPEED is a multiplier the call site DIVIDES by, so it reads as "faster"
  // rather than as "more": `recover +280%` is true and says nothing.
  return stat.endsWith('Speed')
    ? `${RELIC_SUBJECT[id]} ${pct} faster`
    : `${RELIC_SUBJECT[id]} +${pct}`;
}

/** How long a woken relic's ring takes to sweep its aura (M85). */
const RELIC_BURST_MS = 1500;

/** A relic's effect in two words, for the floater a wake raises: `+30% tax`. */
function relicShortEffect(id: ArtifactId, value: number): string {
  const { op } = ARTIFACTS[id].passive.stats[0]!;
  const what = RELIC_SHORT[id];
  return op === 'mul' ? `+${relicPercent(value)} ${what}` : `+${formatNumber(value, 1)} ${what}`;
}

const RELIC_SHORT: Record<ArtifactId, string> = {
  DowsingRod: 'resources',
  VerdantSeal: 'per swing',
  ForemansSigil: 'work speed',
  GildedLedger: 'tax',
  WanderersCompass: 'Stardust',
  DelversLantern: 'room haul',
  MusterHorn: 'army',
  BailiffsTally: 'district yield',
};

/** What each relic's number is ABOUT, in three or four words. */
const RELIC_SUBJECT: Record<ArtifactId, string> = {
  DowsingRod: 'Forests, fields and rocks hold',
  VerdantSeal: 'Every swing and tap takes',
  ForemansSigil: 'Your crews work and halls train',
  GildedLedger: 'Your villagers pay',
  WanderersCompass: 'Rooms pay Stardust',
  DelversLantern: 'A room pays gold and stone',
  MusterHorn: 'Your halls field',
  BailiffsTally: 'Every district you hold pays',
};

/** Why a lair attack is refused. A power shortfall is NOT one of these: it
 *  warns on the sheet and the player may go anyway. */
const LAIR_BLOCK_TEXT: Record<LairBlock, string> = {
  LairNotFound: 'Clear a path to the lair first',
  AlreadyCleared: 'That lair is already cleared',
  AlreadyDefeated: 'They are beaten — claim what they left behind',
  EmptyParty: 'Pick who goes in',
  NoSoldiers: 'A lair wants soldiers — a hero cannot go in alone',
  NoHero: 'Pick a hero to lead them',
  TooManyHeroes: 'More heroes than you have slots for',
  TooManySlots: 'Too many kinds of unit — buy another party slot',
  NotEnoughUnits: 'You do not have that many at home',
  NotEnoughSupplies: 'Not enough Mana to attack',
  HeroDown: 'A hero in the party is exhausted — they rest until their HP is full',
};

/** How well a unit type answers a lair's threat — used only to pre-fill a
 *  sensible party, never to decide anything. */
const scoreAgainst = (unitId: UnitId, affinity: UnitId | 'Any'): number =>
  typeMultiplier(unitId, affinity) * UNITS[unitId].dmg;

/** "in 3 days" / "in 5 hours" / "in 12 minutes" — coarse on purpose; the
 *  budget refills on the first of the month, not on a stopwatch. */
function describeWait(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/** "Orcs hold this ground", "A drake holds this ground": the creature's own
 *  noun decides the verb. */
const holdsThisGround = (creature: string): string =>
  `${creature} ${creature.startsWith('A ') ? 'holds' : 'hold'} this ground`;

/** An offer as the store draws it (`Game.offerCards`, `Game.dailyCards`). */
export interface OfferCard {
  id: StoreSkuId;
  name: string;
  description: string;
  sprite: string;
  priceCents: number;
  gems: number;
  lines: string[];
  /** What it holds over what its price buys as Gems, in percent. */
  valuePercent: number;
  /** When its window closes, or null if it waits until bought out. */
  closesAt: number | null;
  /** How many this window still sells, or null for no limit. */
  left: number | null;
}

/** One tile of an offer splash: a hero, its fragments, an item or a coin. */
export interface OfferTile {
  kind: 'hero' | 'fragments' | 'item' | 'coin';
  id: string;
  count: number;
  /** An item: what one is worth now (a chest's coin), for its tooltip. */
  worth?: Wallet;
}

/** An offer floating on the map (`Game.offerWidgets`). */
export interface OfferWidget {
  sku: StoreSkuId;
  name: string;
  sprite: string;
  hero: HeroId | null;
  /** On sale; bought and counting down to its next-day part; or that part ready. */
  state: 'sale' | 'waiting' | 'ready';
  /** When the window closes (0: never) or the next-day part is due. */
  at: number;
}

/** An offer's sale, as its splash draws it (`Game.offerSale`). */
export interface OfferSale {
  /** When its window closes, or null if it waits until bought out. */
  closesAt: number | null;
  /** How many this window still sells, or null for no limit. */
  left: number | null;
  /** Sold once, ever — not once a window. */
  once: boolean;
  valuePercent: number;
  /** Its step in a chain of offers, "I / III". */
  chain: { at: number; of: number } | null;
  /** The slots it opens for good, its GIFT panel. */
  gifts: Array<{ icon: 'builder' | 'explorer' | 'heroSlot'; title: string; text: string }>;
  /** Bought, and its next-day part not due yet: when it is. */
  nextDayAt: number | null;
}

/** The offer splash on screen: which offer, in which mood, and whether it
 *  was opened from the offers widget (the row of offers along its top). */
export interface OfferSplashView {
  sku: StoreSkuId;
  mode: 'buy' | 'claim' | 'waiting';
  browse: boolean;
  /** Opened by the game at the start of a session, not by the player: only
   *  this one sounds. */
  auto: boolean;
}

/** The store's tabs (ui/storeSheet.ts). */
export type StoreTab = 'offers' | 'heroes' | 'supplies' | 'gems';
