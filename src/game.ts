// Game orchestrator: owns the sim state, UI modes (placement / inspection),
// the tap-handler chain, and change notification.

import { recordEvent } from './sim/events';
import { DOOR_HINT, freshlyOpenDoors, isDoorOpen, markDoorSeen, showsCollect, type DoorId } from './sim/doors';
import { heroCanFight, heroHp, heroMaxHp, heroRestEndsAt } from './sim/heroHealth';
import {
  advance, builderGemCost, buyBuilder, canAfford, changeWorkers, collectBuilding, collectTap,
  buyKeys, enqueueBuild, finishWithGems, moveDistrict, researchTech, upgradeDistrict,
  wakeIdleWorkersAt,
  type AssignWorkerResult, type CollectTapResult, type UpgradeResult,
  repairAbandoned,
} from './sim/commands';
import {
  BANNER_ORDER,
  AD, ARTIFACTS, ARTIFACT_ORDER, BUILDABLE_DISTRICTS, COMBAT, CURRENCIES, DISTRICTS, HARVEST, HERO_ORDER, HEROES,
  LANDMARK_ART, LANDMARKS, MANA, PARTY, LAIRS, LAIR_ORDER, STORE,
  ERA_REWARDS, TECHNOLOGIES, UNITS, levelIndexed, type AdjacencyStat, BANNERS, type BannerId,
  CHEST_ORDER, COLLECTION, FACE_ORDER, PACKS, PACK_ORDER, faceOf,
  type FaceId, type PackTier, HELP } from './sim/data/definitions';
import { formatCount, formatDuration, formatExact, formatNumber, formatCountdown } from './ui/format';
import { relicPercent } from './ui/relicStats';
import type { IconName } from './ui/kit/icon';
import {
  buildDurationForCell, canMoveDistrict, canPlaceAnywhere, districtCount, districtLabel, hasPlacementRestriction,
  maxDistrictCount, nextBuildCost, placementBlock, upgradeCost, validPlacementCells,
  requiredPopulation,
} from './sim/districts';
import {
  explorationGate, fogState, isPayable, nextRevealTapCost, reachLevelFor, revealCostForCell, revealTap,
} from './sim/fog';
import {
  cellsWithinRadius, cellsWithinRadiusOfRect, footprintCells, townhallDistance, type MapData,
} from './sim/grid';
import { activeZones, type Modifier } from './sim/modifiers';
import { effectiveStock, harvestSourceAt, isExhausted, tapYieldAt } from './sim/harvest';
import { placementAdjacency } from './sim/adjacency';
import { harmonyBlock } from './sim/harmony';
import {
  committedTroops, finishLineWithGems, healCost, healSecondsAt, healWounded, infirmaries, lineFor,
  armyCap, trainUnit, woundedCap, woundedCount, woundedOf,
  itemTrainSeconds, trainingCompletesAt,
} from './sim/army';
import { artifactLevel, nextPassiveValue, ownedArtifacts, passiveValue } from './sim/artifacts';
import {
  albumHeld, albumIsComplete, albumRewards, buyCardBundle, buyFromVault, buyPack, buyWildcard,
  bundleGemValue, bundleOf, bundlesForSale, cardCount,
  heldWildcardFor, holdsCard, openPack, packCards, packGemCost, packOdds, packsForSale,
  placeWildcard, seasonDef, seasonHeld, seasonLeftMs, starsFor, vaultCost, vaultNext,
  buyFromVaultMany, canClaimAlbum, claimAlbum, grantPack,
  wildcardCovers, wildcardOffers, wildcardsHeld,
  PRIZE_BANNER, SEASON_CARDS, albumOfRelic, relicOfAlbum,
  type AlbumPayout, type CollectionPrize, type PackOpening, type VaultTier,
} from './sim/collection';
import {
  ALBUMS, ALBUM_ORDER, RARITIES, type AlbumId, type Rarity,
} from './sim/data/seasons';
import {
  activeRadius, buildingsIn, cast, castBlock, castState, chargesLeft,
  divinationSaving, reapCells, surveyCells, tapBudget, tapRunSeconds,
  validCastCells, type CastPhase,
} from './sim/casting';
import { claimLandmark, visibleLandmarks } from './sim/landmarks';
import {
  adOfferEligible, adOfferPending, adOfferReward, claimAdOffer, refreshAdOffer,
} from './sim/adOffers';
import { availableRoster } from './sim/army';
import { cancelWorkshopItem, finishItemWithGems, queueGood } from './sim/workshops';
import { partyPower, typeMultiplier } from './sim/combat';
import {
  attackLair, claimLair, heroLevel, lairBlock, lairClearReward, partyBoard, partyOf, previewLair, troopSlots,
  type LairBlock, type LairPreview,
} from './sim/expeditions';
import {
  RAIDABLE, cityRatePerSecond, lairCreature, lairIsCleared,
  lairView, openLairs, setUtcOffset, type LairView, type RaidableId,
} from './sim/lairs';
import {
  buyHeroSlot, claimFreePull, freePullAvailable, freePullReadyAt, freePullsLeft,
  heroSlotGemCost, heroSlots, levelUpHero,
  pull, pullMany, raiseHeroTier, STANDARD_BANNER, unlockHero, type PullResult,
} from './sim/heroes';
import {
  mana, manaCap, manaNetRegen, manaProduction, msToNextMana,
} from './sim/mana';
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
  effectiveAutoTapCooldownMs,
} from './sim/upgrades';
import {
  PROFILE_LABEL, budgetRemainingCents, buySku, canAffordSku, choosePayerProfile,
  monthResetsAt, monthlyBudgetCents, priceCents,
} from './sim/store';
import { addHeroXp, boonText, pullPrice } from './sim/heroes';
import type { PayerProfile, StoreSkuId } from './sim/state';
import {
  addToWallet, builderCount, buildQueueCapacity, busyBuilders, coordKey, districtAt, districtById, getWallet, sameCell, townhall,
  type ArtifactId, type Coord, type CurrencyId, type District, type DistrictId,
  type FeatureId, type TrainableId, type Mission, type MissionKind,
  type GameState, type HeroId, type PartySlotState, type LairId, type TechId, type UnitId,
  type QueueItem, type Wallet,
} from './sim/state';
import {
  anyCellPending, boardIsFull, boardMissions, buyPass, claimCell, claimMission,
  freeCell, levelProgress, ladderLength as passLadderLength,
  paidCell, passEndsAt, passLevel, passOwned, passXp, rollMissionsIfDue,
} from './sim/pass';
import {
  anySurveyPending, buySurvey, claimSurveyCell, freeSurveyCell, nextLevelCells, paidSurveyCell,
  surveyLength, surveyLevel, surveyOwned,
} from './sim/survey';
import { pickUpTreasure, treasureAt } from './sim/treasures';
import {
  isHardKind, missionComplete, missionProgress, nextWindowAt,
} from './sim/missions';
import type { BattleLog } from './sim/battle';
import { influenceCells, workableCells } from './sim/workers';
import { techValue } from './sim/techEffects';
import { playSfx, type SfxName } from './audio/sfx';
import type { HarvestSourceId } from './sim/state';
import { ABANDONED, KINGDOM_DEF, QUESTS, SCENES, SURVEY, UNLOCKS, type QuestDef } from './sim/data/definitions';
import { CAMERA_GLIDE_MS, Camera } from './render/camera';
import { HexCamera } from './render/world/hexCamera';
import { dispatchExplorer, finishExplorerWithGems, homeIndex, worldFogAt, type ExplorerHome } from './sim/world/explorers';
import { gemsToFinish } from './sim/rush';
import { hexWork, isUpgrade, scoutWords, worldBuildDone, worldBuildName, worldBuildSeconds } from './ui/world/worldActions';
import { fastestRoute, type Route } from './sim/world/travel';
import { hasBit } from './sim/world/fogBits';
import { hexAt, hexIndex } from './sim/world/hex';
import { localWorld, snapshotWorld, type WorldSource } from './sim/world/source';
import type { WorldServerApi } from './worldServer/local';
import type { ArmyPurpose, Refusal, WorldSnapshot } from './worldServer/types';
import { nicknameProblem } from './worldServer/nickname';
import { armyMarchSpeed, departArmy, freeArmySlots, receiveArmy } from './sim/world/armies';
import { movesWorldBoost, worldImprovementBoost } from './sim/world/boost';
import { boardNeighbors } from './sim/world/hex';
import { emptyBits } from './sim/world/fogBits';
import type { WorldUpgrade } from './sim/world/types';
import { PRECIOUS, type GoodId, type PreciousId, type WorldBuildWhat } from './sim/state';
import { districtOf } from './worldServer/core';
import { Floaters } from './render/floaters';
import { CollectBubbles } from './render/collectBubbles';
import { lairArtAt, lairBubbleAt, UNIT_CREATURE_AVATAR } from './render/lairMap';
import { Villagers } from './render/villagers';
import type { MarkerLayer } from './render/mapRenderer';
import { PALETTE } from './render/palette';
import { TapChain } from './render/tapChain';
import { TapFx } from './render/tapFx';
import { pay } from './sim/wallet';
import { addGood, getGood } from './sim/goods';
import { worldUpgradeGoods } from './sim/precious';
import { CAMP_CREATURE, campTribute } from './sim/world/camps';

export type Mode =
  | { kind: 'normal' }
  | { kind: 'placing'; definitionId: DistrictId; selected: Coord | null }
  /** Relocating a building that already exists. The same targeting model as
   *  placing — a ghost you move and confirm — with `origin` kept so Cancel
   *  can put it back and so the ghost knows which footprint is its own. */
  | { kind: 'moving'; districtUniqueId: string; definitionId: DistrictId;
      selected: Coord | null; origin: Coord }
  /** Casting reuses the placement machinery wholesale — select, highlight,
   *  tap to commit — rather than inventing a second targeting model. */
  | { kind: 'casting'; artifactId: ArtifactId; selected: Coord | null };

/** Every full-screen menu the nav (or the map) can open. Naming them means
 *  `tsc` — the only real gate this project has over the view layer — catches
 *  an overlay that nothing renders, instead of it silently drawing nothing. */
export type OverlayName =
  | 'build' | 'research' | 'settings' | 'purse' | 'welcome'
  | 'collection' | 'heroes' | 'lair' | 'mana' | 'builder'
  | 'store' | 'payerProfile' | 'iapConfirm'
  // The season pass, reached from the Sowing Season pill on the map
  // (Docs/features/20-season-pass.md §6).
  | 'pass'
  // The Survey, reached from its own pill (Docs/features/25-the-survey.md §6).
  | 'survey'
  // Buying a level is its own surface now, opened by the card's Upgrade
  // button (Docs/art/ui-menus-redesign.md §7.27).
  | 'upgrade'
  // Buying Knowledge, from the + on the Knowledge tab (07-research.md §3.2).
  | 'knowledge'
  // Choosing heroes for n slots, from whatever asked (`openHeroPicker`).
  | 'heroPicker'
  // A hex of the world board, and what can be done there — the dispatch
  // sheet (Docs/features/19-world-map.md §1.2).
  | 'world'
  // An army composed for the world board, on the lair attack's screen
  // (Docs/features/19-world-map.md §4).
  | 'army'
  // The Exchange: precious materials traded between the board's players
  // (Docs/features/19-world-map.md §7.5).
  | 'exchange'
  // A world dungeon's descent: its rooms, the race, the army camped there
  // (Docs/features/19-world-map.md §8.2).
  | 'delve'
  // The name the player goes out onto the world board under, asked the
  // first time out (Docs/features/19-world-map.md §1.3).
  | 'nickname';

/** Which door an overlay stands behind (Docs/features/22-progression.md §3).
 *  An overlay not named here is never padlocked. */
const OVERLAY_DOOR: Partial<Record<OverlayName, DoorId>> = {
  research: 'research', build: 'build', heroes: 'heroes', collection: 'relics',
  world: 'world', army: 'world', knowledge: 'knowledge', store: 'store', survey: 'survey', nickname: 'world',
};

/** How the hero picker orders the heroes it offers. */
export type HeroPickSort = 'level' | 'rarity';

/**
 * AN OPEN HERO PICKER (ui/heroPicker.ts): what it was asked for and what the
 * player has chosen so far. Any screen can open one — it hands over how many
 * slots it wants and what to do with the answer, and the picker hands the
 * screen back when it closes.
 */
export interface HeroPick {
  title: string;
  /** One per slot asked for, in slot order; null = free. */
  slots: Array<HeroId | null>;
  /** The overlay to return to when the picker closes, either way. */
  returnTo: OverlayName | null;
  onSelect: (heroes: HeroId[]) => void;
  filter: UnitId | 'All';
  sort: HeroPickSort;
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
  | { kind: 'fragments'; heroId: HeroId; amount: number }
  // A card pack, which a room pays and a call never does.
  | { kind: 'pack'; tier: PackTier }
  /**
   * One card turning over in a pack's reveal (Docs/features/09-relics.md
   * §11.5).
   *
   * `copies` is HOW MANY THIS PACK GAVE, never how many the player now holds.
   * The two are different numbers and the tile is a record of an OPENING: a
   * fourth copy of a card you already had three of is one card, and saying
   * "×4" over it claims the pack handed over four.
   *
   * `isNew` is likewise about the pack: true when the player held NONE of this
   * card before it was opened. It is independent of `copies` — a pack can hand
   * over two of something you had never seen, which is New AND ×2.
   */
  | { kind: 'card'; album: AlbumId; slot: number; isNew: boolean; copies: number }
  | { kind: 'currency'; currency: CurrencyId; amount: number };

/**
 * A sequence of prizes, dealt one at a time.
 *
 * It was built for the gacha and it is not the gacha's alone any more: a
 * cleared room hands it what the room paid (Docs/features/11a-ruins-ui.md
 * §2.5). Hence the optional half — a banner and a call count are what a PULL
 * has to say about itself, and a fight says something else.
 */
export interface GachaReveal {
  banner?: BannerId;
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
 * calls that each paid 50 Stardust are one 500, and four fragments of the
 * same hero are one stack of four — otherwise a ten-call is a wall of
 * identical tiles nobody reads. And **heroes last**, because they are what
 * the player called for: the sequence should arrive at them rather than open
 * with them and then spend nine tiles winding down.
 */
export function gachaPrizes(pulls: readonly PullResult[]): GachaPrize[] {
  const heroes: GachaPrize[] = [];
  const fragments = new Map<HeroId, number>();
  let stardust = 0;
  for (const p of pulls) {
    // A duplicate is not a hero prize — it already paid its fragments, and
    // showing it as a hero would promise a roster entry that is already there.
    if (p.heroId !== null && !p.duplicate) heroes.push({ kind: 'hero', heroId: p.heroId });
    if (p.fragmentsOf !== null && p.fragments > 0) {
      fragments.set(p.fragmentsOf, (fragments.get(p.fragmentsOf) ?? 0) + p.fragments);
    }
    stardust += p.stardust;
  }
  return [
    ...(stardust > 0
      ? [{ kind: 'currency', currency: 'Stardust', amount: stardust } as GachaPrize]
      : []),
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
export interface BattlePlayback {
  log: BattleLog;
  title: string;
  subtitle: string;
  prizes: GachaPrize[];
  /** What the ENEMY's troops look like, by type: a lair fields creatures,
   *  not the player's own soldiers. Absent, both sides wear the unit busts. */
  enemyFaces?: Partial<Record<UnitId, string>>;
  /** Wall clock at the first tick — everything else is derived from it. */
  startedAt: number;
  phase: 'playing' | 'result' | 'rewards' | 'done';
}

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
  /** The store SKU whose confirmation sheet is open. */
  pendingSku: StoreSkuId | null = null;
  /** Which building the upgrade popup is about. Null when it is closed — the
   *  overlay name alone would not say WHICH, and the card underneath can be
   *  a different building by the time it reopens. */
  upgradeDistrictId: string | null = null;
  /** Which sheet the confirmation was opened from, and returns to. */
  pendingSkuFrom: OverlayName = 'store';
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
  /** The relic whose card is open on the Reliquary screen, or null for the
   *  grid. Same shape and same reason as `openHeroId`: the two screens are
   *  one pattern — a collection, and one piece of it opened. */
  /** The relic whose card is open over the Collection, or null (§11.4). */
  openRelicId: ArtifactId | null = null;
  /** The album page open behind it, or null for the album grid itself. */
  openAlbumId: AlbumId | null = null;
  /** The wildcard the next card tap would spend, or null. Select-then-place,
   *  the same idiom placement and cast modes use. */
  armedWildcard: Rarity | null = null;
  /**
   * Albums whose ninth card has just landed, waiting for their sheet.
   *
   * A completed album interrupts nothing (§11.5): the cards finish turning,
   * and the payout sheet follows the reveal. Transient by design — an album
   * is already paid and already in `completed`, so a sheet missed at quit
   * simply does not replay.
   */
  pendingPayouts: AlbumPayout[] = [];
  /** The vault's shelf is open over the Collection. */
  vaultOpen = false;
  /** The collection prize, waiting for the screen the pack reveal is using
   *  (§5). Transient like the payouts beside it. */
  private pendingPrize: CollectionPrize | null = null;
  /**
   * PACKS THAT HAVE ARRIVED AND NOT YET TURNED OVER.
   *
   * A pack the player WATCHED land — a pass cell, a bundle, an album — opens
   * itself. It used to go into the collection's queue and sit there until
   * somebody walked to the Collection and pressed a button, which made the
   * reward of a ladder a chore two screens away.
   *
   * A COUNT, not a list of packs, because `openPack` takes the head of the
   * queue and nothing else can: what is owed is an OPENING, and the queue
   * decides which pouch it turns over.
   */
  private pendingPackOpenings = 0;
  /**
   * How many packs were in the queue the last time the screen looked.
   *
   * WATCHING THE COUNT IS WHAT MAKES THIS GENERAL. Every path that grants a
   * pack — the pass's two columns, the card bundles, a closed album, the dev
   * bar, and whatever is added next — goes through `grantPack`, and every
   * player command ends in `notify()`. So the difference between two notifies
   * IS the set of packs the player just earned, and no grant site has to
   * remember to announce itself.
   *
   * It also draws the offline line for free: it is seeded from the state the
   * game LOADS with, so packs that arrived while nobody was looking are not
   * owed an opening and wait in the Collection as they always did.
   */
  private packsSeen = -1;
  readonly floaters = new Floaters();
  /** Lairs just claimed, and the `performance.now()` the claim landed at:
   *  the renderer plays their going-away from it, then forgets them. */
  readonly vanishingLairs = new Map<LairId, number>();
  /** The bounce a store's bubble gives when a haul lands in it. */
  readonly collectBubbles = new CollectBubbles();
  readonly villagers = new Villagers();
  readonly tapChain = new TapChain();
  readonly tapFx = new TapFx();
  private bannerQueue: Banner[] = [];
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
  tapGate: ((cell: Coord | null, how: 'tap' | 'hold' | 'ghost') => boolean) | null = null;
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
    // Seeded from what the game LOADED with, so a pack earned while nobody
    // was looking is not owed an opening.
    this.packsSeen = state.collection.packs.length;
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
    // The eight-hour window, for `adOffers.ts`'s reason verbatim: the board is
    // an opportunity offered to a player, not economy, so it is filled from
    // the LIVE tick and `advance()` never proposes a boundary for it. A stamp
    // rather than a cursor, so a long absence issues one window's worth.
    rollMissionsIfDue(this.state, this.now());
    // A PACK THE PLAYER JUST EARNED OPENS ITSELF. The difference between two
    // notifies is exactly what they earned since the last one, whatever
    // granted it; `dealPayouts` then turns one over as soon as the screen is
    // free, so three claimed cells are three reveals in a row rather than
    // three pouches filed away somewhere else.
    const packs = this.state.collection.packs.length;
    if (this.packsSeen >= 0 && packs > this.packsSeen) {
      this.pendingPackOpenings += packs - this.packsSeen;
    }
    this.packsSeen = packs;
    this.dealPayouts();
    // Move fresh sim discoveries into the banner queue BEFORE listeners run,
    // so the banner component sees them on this very render. A RESOURCE is
    // never announced: its coin lands on the plank under the player's own
    // tap. A SITE is, unless a scene introduces it — the advisor says it.
    for (const key of this.state.pendingDiscoveries.splice(0)) {
      const [kind, id] = key.split(':');
      if (kind !== 'site' || this.sceneIntroduces(id)) continue;
      const banner = siteBanner(id);
      if (banner) this.queueBanner(banner);
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

  queueBanner(banner: Banner): void {
    this.bannerQueue.push(banner);
  }

  /** The next queued banner, if any (consumed by the banner component). */
  takeBanner(): Banner | null {
    return this.bannerQueue.shift() ?? null;
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
    // The world board is server state: read it every second while it is on
    // screen, and now and then otherwise (a held Sanctuary moves the Mana
    // ceiling wherever the player is).
    this.worldTicks += 1;
    if (this.worldServer !== null) {
      const every = this.scene === 'world' ? this.worldServer.readEverySeconds() : 30;
      if (this.worldTicks % every === 0) void this.refreshWorld();
    }
    for (const done of result.worldBuildsDone) {
      this.toast(worldBuildDone(done.what, done.level));
    }
    // An explorer home says what it found; the board already shows where.
    // The target's promise, if it kept one, is paid and named (19 §3.2).
    for (const home of result.explorersHome) this.explorerHomeToast(home);
    // A strike hits the CELL and a haul lands at the BUILDING, which is the
    // whole reason the trip is worth watching: the hit is where the work
    // happened and the number is where it arrived.
    for (const s of result.strikes) this.strikeFeedback(s.cell, s.source);
    // A haul lands in the building's store, not the purse, so it pops no
    // number: the store's bubble is what says there is something to collect.
    for (const d of result.deposits) this.collectBubbles.bump(d.cell);
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
    for (const item of result.completedItems) {
      const district = districtById(this.state, item.districtUniqueId);
      if (!district) continue;
      const def = DISTRICTS[district.definitionId];
      this.queueBanner(item.kind === 'build'
        ? {
          title: 'Construction complete!', icon: def.glyph, name: def.name,
          desc: def.description, sprite: `${def.sprite}_l1`, tone: 'leaf',
          sfx: 'constructionComplete'
        }
        : {
          title: 'Upgrade complete!', icon: def.glyph, name: def.name,
          desc: `Now level ${district.level}`, tone: 'leaf',
          sprite: `${def.sprite}_l${district.level}`, sfx: 'constructionComplete'
        });
    }
    // A raid landing while the player is HERE gets a line: a store that
    // quietly empties under their eyes is the one thing this feature must
    // never do silently. What an absence cost is on each lair's card, as the
    // hoard it carries (Docs/proposals/lairs.md §6), so a catch-up that
    // resolves a night of raids says so ONCE rather than in a stack of toasts.
    const raided = result.raids.filter((r) => Object.keys(r.took).length > 0);
    if (raided.length === 1) {
      const raid = raided[0];
      const took = Object.entries(raid.took).map(([c, n]) => `${formatExact(n)} ${c}`).join(', ');
      this.toast(`${lairCreature(raid.lairId)} raided the city — ${took}`);
    } else if (raided.length > 1) {
      this.toast(`${raided.length} raids on the city while you were away`);
    }
    // THE SEASON ROLLED OVER while the player was here or away. It is the one
    // event that takes something from them — the album is empty and the stars
    // are gone — so it is a banner rather than a toast, and it names what the
    // cards melted into (Docs/features/09-relics.md §3).
    if (result.seasonClosed !== null) {
      const closed = result.seasonClosed;
      const opened = seasonDef(closed.to);
      this.queueBanner({
        title: 'A new season!',
        icon: '\u{1F5D3}',
        name: opened.name,
        desc: closed.cards > 0
          ? `${formatExact(closed.cards)} cards melted down for ${formatExact(closed.gold)} gold. `
            + 'A fresh album, and your relics keep every level.'
          : 'A fresh album, and your relics keep every level.',
        tone: 'gold',
      });
    }
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
        if (this.mode.kind !== 'moving') return false;
        if (this.canDropAt(cell)) {
          this.mode.selected = cell;
          this.notify();
        }
        return true; // move mode swallows all map taps
      },
    });
    // 300 — district placement.
    this.tapChain.register({
      priority: 300,
      handle: (cell) => {
        if (this.mode.kind !== 'placing') return false;
        const valid = validPlacementCells(this.state, this.map, this.mode.definitionId);
        if (valid.some((c) => c.x === cell.x && c.y === cell.y)) {
          this.mode.selected = cell;
          this.notify();
        }
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

  /** One collect on a resource cell, with feedback. `autoRepeat` marks the
   *  ticks a held pointer generates — those are cooldown-gated, deliberate
   *  taps are not. 'OnCooldown' is silent: the hold retries until it opens. */
  private collectAt(cell: Coord, autoRepeat = false): CollectTapResult {
    const source = harvestSourceAt(this.state, cell);
    const units = tapYieldAt(this.state, this.map, cell, this.now()); // before the tap — it may empty the cell
    const result = collectTap(this.state, this.map, cell, this.now(), autoRepeat);
    if (result === 'Harvested' && source !== null) {
      this.tapFeedback(districtAt(this.state, cell)?.location ?? cell, TAP_SOUNDS[source]);
      this.floaters.add(cell, `+${formatExact(units)}`, HARVEST[source].currencyId);
      this.tapReward(cell, HARVEST[source].currencyId, units);
    } else if (result === 'Exhausted') {
      playSfx('tapEmpty');
      this.floaters.add(cell, '💤');
    } else if (result === 'TechLocked' && !autoRepeat && source !== null) {
      // Say WHICH research, by name. "You can see it and you cannot have it
      // yet" is the whole point of the gate, and it only teaches anything if
      // the player is told what would open it.
      const gate = HARVEST[source].requiredTech;
      playSfx('error');
      if (gate) this.toast(`Research ${TECHNOLOGIES[gate].name} before you can work this`);
    } else if (result === 'LairHeld' && !autoRepeat) {
      // Say WHO: the refusal is the lair's, and naming it is what sends the
      // player to clear it (Docs/proposals/lairs.md §6). Costs no Mana — the
      // tap is refused before anything is charged.
      const lairId = lairHolding(this.state, cell);
      playSfx('error');
      if (lairId) this.toast(`${holdsThisGround(lairCreature(lairId))}`);
    } else if (result === 'NoMana' && !autoRepeat) {
      // A held pointer stays silent — it would otherwise shake the header
      // once a frame for as long as the finger is down.
      this.outOfMana(cell);
    }
    return result;
  }

  /** Held pointer: repeat COLLECT and REVEAL taps (never inspect or place).
   *  The input layer repeats this while the press lasts; the auto-tap cooldown
   *  decides how many actually land, so holding is the slow, lazy option and
   *  tapping fast stays the skilful one.
   *
   *  Reveal is here because paying for fog is one Gold per tap on a doubling
   *  ring curve: a single distance-9 iron vein is 320 individual taps, and the
   *  whole map is 194,142. That is the difference between the game's
   *  differentiator being filmable and being punishing.
   *
   *  Returns true when this repeat DID something — the input layer then
   *  swallows the tap on release, so one press never acts twice. */
  handleHold(sx: number, sy: number): boolean {
    if (this.mode.kind !== 'normal' || this.openOverlay !== null) return false;
    const cell = this.camera.screenToCell(sx, sy);
    if (this.tapGate !== null && !this.tapGate(cell, 'hold')) return false;
    if (!this.map.terrain.has(coordKey(cell))) return false;
    // Holding a building collects its store once; an empty one holds still.
    const district = districtAt(this.state, cell);
    if (district && district.state === 'Built' && showsCollect(this.state, district)) {
      this.collectStoreOf(district);
      this.notify();
      return true;
    }
    if (district && district.state === 'Built' &&
        districtCapacity(this.state, district) > 0) return false;
    if (fogState(this.state, this.map, cell) === 'Discovered') return this.revealHold(cell);
    if (harvestSourceAt(this.state, cell) === null) return false;
    if (!this.state.fog.revealed[coordKey(cell)]) return false;
    if (isExhausted(this.state, this.map, cell, this.now())) return false; // quiet — no 💤 spam
    if (this.collectAt(cell, true) !== 'Harvested') return false;
    this.notify();
    return true;
  }

  /** One repeat of a held reveal. Paced by the SAME auto-tap cooldown as
   *  collecting, so QuickHands speeds clearing fog up too and holding never
   *  outruns a determined tapper. */
  private revealHold(cell: Coord): boolean {
    const now = this.now();
    if (now - this.state.lastCollectTapAt < effectiveAutoTapCooldownMs(this.state)) return false;
    const charged = nextRevealTapCost(this.state, this.map, cell);
    const result = revealTap(this.state, this.map, cell);
    if (result !== 'Paid' && result !== 'Revealed') return false;
    this.flashFog(cell);
    this.state.lastCollectTapAt = now;
    if (result === 'Revealed') {
      wakeIdleWorkersAt(this.state, now);
      playSfx('revealDone');
      this.floaters.add(cell, 'Revealed!');
    } else {
      playSfx('revealPaid');
      this.floaters.add(cell, `\u2212${formatExact(charged)}`, 'Gold');
    }
    this.notify();
    return true;
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
    this.openOverlay = null;
    this.inspectedDistrictId = null;
    if (selected) this.camera.centerOnCell(selected, DISTRICTS[definitionId].size, CAMERA_GLIDE_MS);
    this.notify();
  }

  // ----------------------------------------------------------------- moving

  /** Enter move mode for a built building. The ghost starts where the
   *  building already stands, so the first thing the player sees is the thing
   *  they picked up, not a jump to somewhere else. */
  startMove(districtUniqueId: string): void {
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
    // placement does for a new one.
    this.camera.centerOnCell(district.location, DISTRICTS[district.definitionId].size, CAMERA_GLIDE_MS);
    this.notify();
  }

  /** Is this a legal address for the building currently being moved? */
  canDropAt(cell: Coord): boolean {
    if (this.mode.kind !== 'moving') return false;
    return placementBlock(
      this.state, this.map, this.mode.definitionId, cell, this.mode.districtUniqueId,
    ) === null;
  }

  confirmMove(): void {
    if (this.mode.kind !== 'moving' || !this.mode.selected) return;
    const { districtUniqueId, selected, origin } = this.mode;
    // Putting it back where it started is a cancel, not an error — the player
    // dragged it around, changed their mind, and dropped it home.
    if (selected.x === origin.x && selected.y === origin.y) {
      this.mode = { kind: 'normal' };
      this.inspectedDistrictId = districtUniqueId;
      this.notify();
      return;
    }
    const result = moveDistrict(this.state, this.map, districtUniqueId, selected, this.now());
    if (result === 'Moved') {
      playSfx('buildPlaced');
      this.mode = { kind: 'normal' };
      // Land back on the card the move was started from: the player is very
      // likely to want the thing they just repositioned.
      this.inspectedDistrictId = districtUniqueId;
    } else {
      this.toast(result === 'InvalidCell' ? 'It will not fit there' : result);
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

  private doCast(artifactId: ArtifactId, target: Coord | null): void {
    const report = cast(this.state, this.map, artifactId, target, this.now());
    if (report.result !== 'Cast') {
      if (report.result === 'NotEnoughMana') this.shake(['Mana']);
      else this.toast('That cannot be cast there');
      this.notify();
      return;
    }
    playSfx('research');
    this.mode = { kind: 'normal' };
    for (const c of report.affected) this.tapFx.add(coordKey(c));
    if (report.goldSaved > 0 && target) {
      this.floaters.add(target, `Saved ${formatExact(report.goldSaved)}`, 'Gold');
    }
    if (report.activeId === 'Reap' && target) {
      this.floaters.add(target, `${report.taps} taps, free`);
    }
    if (report.activeId === 'Haste' && target) {
      this.floaters.add(target, `${report.affected.length} crews hurried`);
    }
    if (report.activeId === 'Tithe' && target) {
      this.floaters.add(target, `+${formatExact(Math.round(report.goldSaved))}`, 'Gold');
    }
    if (report.affected.length > 0) wakeIdleWorkersAt(this.state, this.now());
    this.notify();
  }

  /**
   * EVERY SPELL STANDING ON THE MAP, for the renderer (§11.6).
   *
   * ONE ENTRY PER CAST, not per modifier: the Foreman's Sigil places two —
   * the swing and the walk — and two wheels counting down the same window on
   * the same cell would read as two spells. They are grouped by the relic and
   * the instant it was cast, which is exactly what identifies a cast.
   */
  spellZones(): Array<{
    relic: ArtifactId; glyph: string; centre: Coord; cells: Coord[];
    /** 1 at the cast, 0 as it closes — the wheel's sweep. */
    left: number;
    leftMs: number;
  }> {
    const now = this.now();
    const byCast = new Map<string, Modifier>();
    for (const m of activeZones(this.state)) {
      byCast.set(`${m.area!.relic}:${m.area!.since}`, m);
    }
    return [...byCast.values()].map((m) => {
      const { centre, radius, relic, since } = m.area!;
      const ends = m.expiresAt ?? now;
      const span = Math.max(1, ends - since);
      return {
        relic,
        glyph: ARTIFACTS[relic].glyph,
        centre,
        cells: [centre, ...cellsWithinRadius(this.map, centre, radius)],
        left: Math.max(0, Math.min(1, (ends - now) / span)),
        leftMs: Math.max(0, ends - now),
      };
    });
  }

  /** The buildings a zone would cover — every one for Haste, the inhabited
   *  houses for Tithe, which is what each actually reaches. */
  private zoneTargets(id: ArtifactId, active: 'Haste' | 'Tithe', centre: Coord): Coord[] {
    // A PREVIEW is not a cast, so the relic and the instant are only there to
    // satisfy the shape: nothing reads them off an area that never lands.
    const area = { centre, radius: activeRadius(this.state, id), relic: id, since: 0 };
    return buildingsIn(this.state, area)
      .filter((d) => d.state === 'Built'
        && (active === 'Haste' || residentsOf(this.state, d) > 0))
      .map((d) => d.location);
  }

  /** The cast preview the panel and the renderer both read. */
  castInfo(): {
    artifactId: ArtifactId; cell: Coord | null; manaCost: number; affordable: boolean;
    saving: number;
    /** An auto-tap ability's preview: how many nodes the zone covers, how many
     *  taps the cast buys and how long the run takes to watch. */
    reap: { nodes: number; taps: number; seconds: number } | null;
    /** Buildings a non-tapping zone would cover. */
    zone: number | null;
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
      reap: (active.id === 'Reap' || active.id === 'Tithe') && selected
        ? {
          nodes: active.id === 'Reap'
            ? reapCells(this.state, this.map, selected,
              activeRadius(this.state, artifactId)).length
            : this.zoneTargets(artifactId, 'Tithe', selected).length,
          taps: tapBudget(this.state, artifactId),
          seconds: tapRunSeconds(this.state, artifactId),
        }
        : null,
      // A zone that is not an auto-tap still owes the same answer: how much of
      // the kingdom the cast would actually touch.
      zone: active.id === 'Haste' && selected
        ? this.zoneTargets(artifactId, 'Haste', selected).length
        : null,
    };
  }

  // ---------------------------------------------------------------- relics

  /** What the pill and the Collection header both read (§11.1, §11.2). */
  seasonInfo(): {
    name: string; frame: string; held: number; total: number;
    leftMs: number; packs: number; stars: number; prizeWon: boolean; lap: number;
  } {
    const { collection } = this.state;
    const def = seasonDef(collection.season);
    return {
      name: def.name,
      frame: def.frame,
      held: seasonHeld(this.state),
      total: SEASON_CARDS,
      leftMs: seasonLeftMs(this.state, this.now()),
      packs: collection.packs.length,
      stars: collection.stars,
      // THE PRIZE, not the eight pages: `completed` empties at the end of
      // every lap, so it can only answer "how far into THIS lap", while the
      // prize is won once a season and stays won.
      prizeWon: collection.prizePaid,
      lap: collection.cycle,
    };
  }

  /**
   * The pill hides behind any sheet and never shows before the first card.
   *
   * IT GLOWS FOR A PASS CELL as well as for an unopened pack, because the pill
   * is the pass's door now: a reward sitting on the ladder with nothing on
   * screen to say so is the same missed thing an unopened pack would be.
   */
  seasonPillState(): { showing: boolean; glowing: boolean } | null {
    const info = this.seasonInfo();
    if (info.held === 0 && info.packs === 0) return null;
    return {
      showing: !this.hasOpenSheet(),
      glowing: info.packs > 0 || this.passPending(),
    };
  }

  /**
   * ONE ROW PER RELIC — the medallions of §11.2.
   *
   * The list is the RELIC ROSTER, in its own fixed order, not the album
   * ladder: which album a relic draws rotates a season, so ordering the grid
   * by difficulty would move every relic under the player once a month. A
   * player learns where their relic sits once.
   */
  relicRows(): Array<{
    id: ArtifactId; name: string; sprite: string; glyph: string; level: number;
    album: AlbumId; albumName: string; held: number; total: number;
    complete: boolean; claimable: boolean;
  }> {
    return ARTIFACT_ORDER.map((id) => {
      const album = albumOfRelic(id, this.state.collection.season);
      return {
        id,
        name: ARTIFACTS[id].name,
        sprite: ARTIFACTS[id].sprite,
        glyph: ARTIFACTS[id].glyph,
        level: artifactLevel(this.state, id),
        album,
        albumName: ALBUMS[album].name,
        held: albumHeld(this.state, album),
        total: ALBUMS[album].cards.length,
        complete: albumIsComplete(this.state, album),
        // The one thing on this screen worth a badge: a page ready to close.
        claimable: canClaimAlbum(this.state, album),
      };
    });
  }

  /** The nine slots of one album, for the 3×3 grid (§11.3). */
  /**
   * THE ALBUM HALF of a relic's page (§11.3) — the nine slots, what closing
   * them pays and whether it can be closed right now.
   *
   * Keyed by the ALBUM rather than the relic, because a card tap names one and
   * the wildcard offers aim at one; which relic it raises is the page's other
   * half.
   */
  albumPage(id: AlbumId): {
    id: AlbumId; name: string; index: number; of: number; complete: boolean;
    claimable: boolean; held: number; total: number;
    relic: ArtifactId; relicName: string; relicLevel: number; sprite: string; glyph: string;
    rewards: { hours: number; silverKeys: number; goldKeys: number; gems: number };
    cards: Array<{
      slot: number; name: string; rarity: number; gold: boolean;
      count: number; stars: number;
    }>;
  } {
    const def = ALBUMS[id];
    const relicId = relicOfAlbum(id, this.state.collection.season);
    const relic = ARTIFACTS[relicId];
    return {
      id,
      name: def.name,
      index: ALBUM_ORDER.indexOf(id) + 1,
      of: ALBUM_ORDER.length,
      complete: albumIsComplete(this.state, id),
      claimable: canClaimAlbum(this.state, id),
      held: albumHeld(this.state, id),
      total: def.cards.length,
      relic: relicId,
      relicName: relic.name,
      relicLevel: artifactLevel(this.state, relicId),
      sprite: relic.sprite,
      glyph: relic.glyph,
      rewards: albumRewards(id, this.state.collection.cycle),
      cards: def.cards.map((card, slot) => ({
        slot,
        name: card.name,
        rarity: card.rarity,
        gold: card.gold === true,
        count: cardCount(this.state, { album: id, slot }),
        stars: starsFor({ album: id, slot }),
      })),
    };
  }

  /** The relic's card (§11.4): its level, what it does now and next, and the
   *  album that raises it. No actions — there is nothing to do to a relic. */
  relicCard(id: ArtifactId): {
    id: ArtifactId; name: string; sprite: string; glyph: string; level: number;
    owned: boolean; now: string; next: string; album: AlbumId; albumName: string;
    held: number; total: number;
    /** Why the number below it does nothing yet, or null. The card prints the
     *  effect in muted ink rather than promising what the build cannot pay. */
    pending: string | null;
    /** Where the ability is in its ACTIVE → COOLDOWN → READY walk, and how
     *  long is left of the phase it is in (§2.1). */
    cast: { phase: CastPhase; leftMs: number; charges: number };
  } {
    const def = ARTIFACTS[id];
    const album = albumOfRelic(id, this.state.collection.season);
    return {
      id,
      name: def.name,
      sprite: def.sprite,
      glyph: def.glyph,
      level: artifactLevel(this.state, id),
      owned: artifactLevel(this.state, id) >= 1,
      now: relicEffectText(id, passiveValue(this.state, id)),
      next: relicEffectText(id, nextPassiveValue(this.state, id)),
      album,
      albumName: ALBUMS[album].name,
      held: albumHeld(this.state, album),
      total: ALBUMS[album].cards.length,
      pending: def.pending,
      cast: this.castPhase(id),
    };
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

  relicStrip(): ArtifactId[] {
    return ownedArtifacts(this.state);
  }

  /**
   * OPEN THE NEXT PACK BY HAND — the button in the Collection.
   *
   * It survives the auto-open because a BACKLOG still exists: packs that
   * landed while the player was away are not owed an opening, and neither is
   * one granted by the dev bar. This is how those are turned over.
   */
  doOpenPack(): void {
    if (this.gachaReveal !== null) return; // a reveal is already on screen
    if (!this.turnOverPack()) return;
    this.notify();
  }

  /**
   * CLOSE AN ALBUM — the button at the bottom of a relic's page (§11.3).
   *
   * The player's move, not the ninth card's: the page fills and waits, so
   * nobody spends nine cards and rolls the lap in the middle of a reveal they
   * were watching for something else.
   */
  doClaimAlbum(album: AlbumId): void {
    const payout = claimAlbum(this.state, album);
    if (payout === null) return;
    playSfx('chainFinished');
    this.takePayouts([payout]);
    this.notify();
  }

  /** Whether that button is live: the nine are in hand and this lap has not
   *  closed the album yet. */
  canClaimAlbum(album: AlbumId): boolean {
    return canClaimAlbum(this.state, album);
  }

  /**
   * Bank what a closed album owes and deal whatever the screen is free to
   * deal.
   */
  private takePayouts(payouts: readonly AlbumPayout[]): void {
    for (const payout of payouts) {
      this.pendingPayouts.push(payout);
      if (payout.prize !== null) this.pendingPrize = payout.prize;
    }
    this.dealPayouts();
  }

  /**
   * WHAT FOLLOWS A REVEAL (§11.5). A completed album interrupts nothing, so
   * this deals only into a free screen and is called again every time one is
   * dismissed.
   *
   * The order is the order of what things are worth. THE PRIZE TAKES THE
   * SCREEN first — it is the most exciting screen the game has and the right
   * place for the forty-fifth card to lead — and the albums' own banners
   * follow it, so the run of five ends on the hero rather than on a pennant.
   */
  private dealPayouts(): void {
    if (this.gachaReveal !== null) return;
    if (this.pendingPrize !== null) {
      const prize = this.pendingPrize;
      this.pendingPrize = null;
      this.gachaReveal = {
        banner: PRIZE_BANNER, calls: 1, caption: 'The collection prize',
        prizes: prizePrizes(prize),
      };
      return;
    }
    // Then the packs, one at a time. AFTER the prize, because the prize is the
    // most exciting screen the game has and the forty-fifth card should lead;
    // BEFORE the album banners, because a pennant is the quietest thing here
    // and the run should not end on a pouch.
    if (this.pendingPackOpenings > 0) {
      this.pendingPackOpenings -= 1;
      if (this.turnOverPack()) return;
      // The queue was empty after all — a wildcard or a season close took the
      // pack between the grant and the deal. Nothing is owed.
      this.pendingPackOpenings = 0;
    }
    for (const payout of this.pendingPayouts.splice(0)) {
      const relic = ARTIFACTS[payout.relic];
      this.queueBanner({
        title: payout.found ? 'A relic is yours!' : 'Album complete!',
        icon: relic.glyph,
        sprite: relic.sprite,
        name: ALBUMS[payout.album].name,
        desc: payout.found
          ? `${relic.name}, at level 1.`
          : `${relic.name} rises to level ${payout.level}.`,
        tone: 'gold',
      });
    }
  }

  /**
   * TURN ONE PACK OVER, and put its cards in the reveal.
   *
   * The ONE opener: the button in the Collection and a pack that just landed
   * both come through here, so a pouch can never be spent by a path that
   * forgets the sound or the screen. False when the queue is empty.
   */
  private turnOverPack(): boolean {
    const opening = openPack(this.state, this.now());
    if (opening === null) return false;
    playSfx('chainFinished');
    this.gachaReveal = { caption: `${opening.pack.tier} pack`, prizes: packPrizes(opening) };
    // The queue just got shorter by one, and this is not a pack the player
    // earned — without this the next notify would read the drop and then the
    // NEXT grant would be counted against a stale number.
    this.packsSeen = this.state.collection.packs.length;
    return true;
  }

  /** What the reveal will deal, asked before it is opened — the album screen
   *  shows a pack's tier and count without spending it. */
  peekPack(): { tier: PackTier; cards: number } | null {
    const pack = this.state.collection.packs[0];
    if (pack === undefined) return null;
    return { tier: pack.tier, cards: packCards(this.state.seed, pack).length };
  }

  /** The Gems the five albums together pay — the prize band's other chip. */
  prizeGems(): number {
    return COLLECTION.prizeGems;
  }

  /**
   * Open a relic — the ONE level below the list, and the only one
   * (§11.2 → §11.3). A relic and its album used to be two screens, which made
   * the thing the nine cards are FOR a screen behind the nine cards; they are
   * one page now, so `openRelicId` is the whole of the navigation.
   */
  openRelic(id: ArtifactId): void {
    this.openRelicId = id;
    this.notify();
  }

  /** Reached from an aimed wildcard offer, which names an ALBUM. */
  openAlbum(id: AlbumId): void {
    this.openRelic(relicOfAlbum(id, this.state.collection.season));
  }

  closeRelic(): void {
    this.armedWildcard = null;
    if (this.openRelicId === null) {
      this.dismiss();
      return;
    }
    this.openRelicId = null;
    this.notify();
  }

  /** The arrows in the page's bottom corners. Eight is a short walk, and it
   *  wraps: a player checking what they are close to should not hit a wall at
   *  either end. */
  stepRelic(by: number): void {
    if (this.openRelicId === null) return;
    const i = ARTIFACT_ORDER.indexOf(this.openRelicId);
    const n = ARTIFACT_ORDER.length;
    this.openRelicId = ARTIFACT_ORDER[(((i + by) % n) + n) % n]!;
    this.notify();
  }

  /**
   * A card tapped on an album page.
   *
   * A DUPLICATE is a choice the player has to be offered — send it, or leave
   * it to the vault — and sending needs the social layer (**OQ-89**), so
   * until that lands the only thing a duplicate can do is say what it is
   * worth. A MISSING card says what packs it falls from.
   */
  tapCard(album: AlbumId, slot: number): void {
    const card = ALBUMS[album].cards[slot]!;
    const count = cardCount(this.state, { album, slot });
    // A WILDCARD IS ARMED: this tap is the placement, and the grid has
    // already said which slots would take it.
    if (this.armedWildcard !== null) {
      const rarity = this.armedWildcard;
      const result = placeWildcard(this.state, { album, slot }, rarity);
      if (result.placed) {
        playSfx('upgradeBought');
        if (wildcardsHeld(this.state, rarity) <= 0) this.armedWildcard = null;
      } else if (result.reason === 'GoldSlot') {
        this.toast('No wildcard covers a gold card — it is earned or sent');
      } else if (result.reason === 'AlreadyHeld') {
        this.toast('You already hold that one');
      } else {
        this.toast(`A ${rarity}★ wildcard does not reach that card`);
      }
      this.notify();
      return;
    }
    if (count === 0) {
      const held = heldWildcardFor(this.state, { album, slot });
      if (held !== null) {
        // The doc's own line: a missing card says what packs it falls from,
        // AND the wildcard if one covers it (§11.3).
        this.toast(`${card.name} — your ${held}★ wildcard fills it`);
        this.armWildcard(held);
      } else {
        this.toast(card.gold === true
          ? `${card.name} — gold, so Star packs only`
          : `${card.name} — ${PACK_ORDER.filter((tier) => PACKS[tier].weights[card.rarity - 1] > 0)
            .join(', ')} packs`);
      }
    } else if (count > 1) {
      this.toast(`${count - 1} spare — ${starsFor({ album, slot })} stars each in the vault`);
    } else {
      this.toast(`${card.name} — ${'★'.repeat(card.rarity)}`);
    }
    this.notify();
  }

  /** The vault knob opens the shelf rather than buying: with three chests and
   *  a ten-batch there is a choice to make, and a one-press knob cannot say
   *  what it is about to spend. */
  openVault(): void {
    this.vaultOpen = true;
    this.notify();
  }

  closeVault(): void {
    this.vaultOpen = false;
    this.notify();
  }

  /**
   * TEN AT ONCE. A player finishing a season cashes the vault scores of times
   * for a card or two each, and the problem is the screens rather than the
   * chests — the ten-call made this argument first (§6.4 of `10-heroes.md`):
   * buying in bulk buys TIME, not a better price.
   */
  doBuyFromVaultMany(tier: VaultTier, count = 10): void {
    const many = buyFromVaultMany(this.state, tier, count);
    if (many.result === 'Opened') {
      playSfx('upgradeBought');
      this.toast(`${many.bought} × ${tier} — open them in the Collection`);
    } else {
      this.toast(`${formatExact(vaultCost(tier) * count)} stars for ten — not yet`);
    }
    this.notify();
  }

  /** Every chest, what it costs and whether the purse reaches it — the vault
   *  sheet's whole data. */
  vaultShelf(): Array<{ tier: VaultTier; cost: number; cards: number;
    promise: string; affordable: boolean; tenAffordable: boolean; }> {
    const stars = this.state.collection.stars;
    return CHEST_ORDER.map((tier) => ({
      tier,
      cost: vaultCost(tier),
      cards: PACKS[tier].cards,
      promise: packPromise(tier),
      affordable: stars >= vaultCost(tier),
      tenAffordable: stars >= vaultCost(tier) * 10,
    }));
  }

  /**
   * The store's Cards shelf (§6): one row per tier the store sells, with its
   * PUBLISHED ODDS on it.
   *
   * The odds are on the shelf rather than behind an info knob because §6 says
   * "at published odds" and a store is the one place that promise has to be
   * kept where the money is.
   */
  packOffers(): Array<{
    tier: PackTier; name: string; best: boolean; cost: number; cards: number;
    sprite: string; promise: string; odds: string;
  }> {
    return packsForSale().map((tier) => {
      const def = PACKS[tier];
      const forSale = packsForSale();
      return {
        tier,
        name: packName(tier),
        best: tier === forSale[forSale.length - 1],
        cost: packGemCost(tier),
        cards: def.cards,
        sprite: `pack_${tier.toLowerCase()}`,
        promise: packPromise(tier),
        odds: packOdds(tier)
          .map((o) => `${faceLabel(o.face)} ${o.percent.toFixed(o.percent < 1 ? 2 : 0)}%`)
          .join(' · '),
      };
    });
  }

  /**
   * The store's BUNDLE shelf (§6.1): star packs and wildcards for money.
   *
   * Empty in the last hours of a season — a bundle is two things the close
   * wipes, so the store withdraws it rather than sell an hour of it. The UI
   * renders no shelf at all rather than a row explaining why, because a
   * withdrawn product is not an offer.
   */
  cardBundleOffers(): Array<{
    id: StoreSkuId; name: string; priceCents: number; sprite: string;
    packs: number; tier: PackTier; wildcards: number; rarity: Rarity;
    gemValue: number; lines: string[];
  }> {
    return bundlesForSale(this.state, this.now()).map((id) => {
      const sku = STORE[id];
      const bundle = bundleOf(id)!;
      return {
        id,
        name: sku.name,
        priceCents: priceCents(id),
        sprite: sku.sprite,
        packs: bundle.packs,
        tier: bundle.tier,
        wildcards: bundle.wildcards,
        rarity: bundle.wildcardRarity,
        gemValue: bundleGemValue(bundle),
        lines: this.bundleLines(id),
      };
    });
  }

  /** What a bundle hands over, one line a thing — the shelf's body and the
   *  confirmation's grant. A star pack's promise is named rather than implied:
   *  the gold edition is what the player is buying. */
  bundleLines(id: StoreSkuId): string[] {
    const bundle = bundleOf(id);
    if (bundle === null) return [];
    const out: string[] = [];
    if (bundle.packs > 0) {
      out.push(`${bundle.packs} ${bundle.tier.toLowerCase()} packs — ${packPromise(bundle.tier)}`);
    }
    if (bundle.wildcards > 0) {
      out.push(bundle.wildcards === 1
        ? `One ${bundle.wildcardRarity}★ wildcard — any slot it covers, your pick`
        : `${bundle.wildcards} ${bundle.wildcardRarity}★ wildcards — any slots they cover, your pick`);
    }
    return out;
  }

  /**
   * The store's AIMED offers (§9): one per album the player has nearly
   * finished. An offer with no rarity — an album down to gold slots alone —
   * is dropped here rather than shown greyed out: there is nothing to sell,
   * and a dead row on a shelf is worse than no row.
   */
  wildcardOffers(): Array<{
    album: AlbumId; name: string; short: number; rarity: Rarity; cost: number;
    sprite: string; relic: ArtifactId;
  }> {
    return wildcardOffers(this.state)
      .filter((o): o is typeof o & { rarity: Rarity } => o.rarity !== null)
      .map((o) => ({
        album: o.album,
        name: ALBUMS[o.album].name,
        short: o.short,
        rarity: o.rarity,
        cost: o.cost,
        sprite: `album_${o.album.toLowerCase()}`,
        relic: relicOfAlbum(o.album, this.state.collection.season),
      }));
  }

  doBuyWildcard(rarity: Rarity, album?: AlbumId): void {
    const result = buyWildcard(this.state, rarity);
    if (result === 'Purchased') {
      playSfx('gemSpend');
      // Bought from an aimed offer, the album it was aimed at opens with the
      // wildcard already in hand: the purchase and the placement are one
      // intention, and making the player go and find the album again would
      // be a second errand.
      if (album !== undefined) {
        this.openRelicId = relicOfAlbum(album, this.state.collection.season);
        this.armedWildcard = rarity;
        this.setOverlay('collection');
      } else {
        this.toast(`A ${rarity}★ wildcard — place it on any card it covers`);
      }
    } else if (result === 'NotEnoughGems') {
      this.shake(['Gems']);
    }
    this.notify();
  }

  /** What the player holds, cheapest first — the album page's strip. */
  wildcardsHeld(): Array<{ rarity: Rarity; count: number }> {
    return RARITIES
      .map((rarity) => ({ rarity, count: wildcardsHeld(this.state, rarity) }))
      .filter((w) => w.count > 0);
  }

  /**
   * ARM a wildcard, then tap the slot: the game's own select-then-place
   * idiom, which placement mode and cast mode both use.
   *
   * A confirmation sheet would be the alternative and it is worse here — a
   * consumable spent by one tap needs the MODE to be visible, not a dialog
   * after the fact, and the armed grid shows exactly which slots it can fill.
   */
  armWildcard(rarity: Rarity | null): void {
    this.armedWildcard = rarity === null || wildcardsHeld(this.state, rarity) <= 0
      ? null
      : rarity;
    this.notify();
  }

  /** Whether an armed wildcard could land on this slot — what the grid lights. */
  wildcardFits(album: AlbumId, slot: number): boolean {
    if (this.armedWildcard === null) return false;
    const ref = { album, slot };
    return !holdsCard(this.state, ref) && wildcardCovers(this.armedWildcard, ref);
  }

  doBuyPack(tier: PackTier): void {
    const result = buyPack(this.state, tier);
    if (result === 'Purchased') {
      playSfx('gemSpend');
      const waiting = this.state.collection.packs.length;
      this.toast(waiting === 1
        ? `A ${tier} pack — open it in the Collection`
        : `A ${tier} pack · ${waiting} waiting in the Collection`);
    } else if (result === 'NotEnoughGems') {
      this.shake(['Gems']);
    }
    this.notify();
  }

  doBuyFromVault(tier: VaultTier): void {
    const result = buyFromVault(this.state, tier);
    if (result === 'Opened') playSfx('upgradeBought');
    else this.toast(`${formatExact(vaultCost(tier))} stars for a ${tier} pack — not yet`);
    this.notify();
  }

  vaultInfo(): { stars: number; next: VaultTier; cost: number; affordable: boolean } {
    const next = vaultNext(this.state);
    const cost = vaultCost(next);
    return { stars: this.state.collection.stars, next, cost, affordable: this.state.collection.stars >= cost };
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

  // ------------------------------------------------------------- ad offers

  /** The standing offer, or null. Drives the widget and the popup. */
  // ------------------------------------------------------- the season pass

  /**
   * THE WHOLE PASS SCREEN, flattened — the plank, the XP bar, the board and
   * the two-column ladder (Docs/features/20-season-pass.md §6).
   *
   * Every cell carries its OWN `claimable` and `claimed`, because every cell
   * is its own button and nothing else on the sheet decides what can be
   * taken.
   */
  passScreen(): {
    level: number;
    length: number;
    xpInto: number;
    xpNeed: number;
    owned: boolean;
    priceUsd: number;
    endsIn: string;
    nextTasksIn: string;
    boardFull: boolean;
    missions: Array<{
      id: string; kind: MissionKind; icon: IconName; goal: string;
      done: number; target: number; complete: boolean;
      /** What finishing it pays, resolved to what the player would receive
       *  RIGHT NOW — Mana is a fraction of the pool, so the number moves with
       *  the Sanctum and cannot be stored. */
      reward: { currency: CurrencyId; amount: number } | { pack: PackTier };
      hard: boolean;
    }>;
    ladder: Array<{
      level: number;
      reached: boolean;
      free: { reward: Wallet; pack: PackTier | null; claimed: boolean; claimable: boolean };
      paid: {
        reward: Wallet; pack: PackTier | null;
        claimed: boolean; claimable: boolean; locked: boolean;
      };
    }>;
  } {
    const now = this.now();
    const level = passLevel(this.state, now);
    const owned = passOwned(this.state, now);
    const { into, need } = levelProgress(passXp(this.state, now));
    const length = passLadderLength();
    const claimedFree = this.state.kingdom.pass.claimedFree;
    const claimedPaid = this.state.kingdom.pass.claimedPaid;
    return {
      level,
      length,
      xpInto: into,
      xpNeed: need,
      owned,
      priceUsd: STORE.SeasonPass.priceUsd,
      endsIn: formatDuration((passEndsAt(now) - now) / 1000),
      nextTasksIn: formatDuration((nextWindowAt(now) - now) / 1000),
      boardFull: boardIsFull(this.state, now),
      missions: boardMissions(this.state, now).map((m) => ({
        id: m.uniqueId,
        kind: m.kind,
        icon: MISSION_ICON[m.kind],
        goal: missionGoal(m),
        done: missionProgress(this.state, m),
        target: m.target,
        complete: missionComplete(this.state, m),
        reward: m.reward.kind === 'Pack'
          ? { pack: m.reward.tier }
          : m.reward.kind === 'Gems'
            ? { currency: 'Gems' as CurrencyId, amount: m.reward.amount }
            : {
              currency: 'Mana' as CurrencyId,
              amount: Math.round(manaCap(this.state) * m.reward.fraction),
            },
        hard: isHardKind(m.kind),
      })),
      ladder: Array.from({ length }, (_, i) => {
        const n = i + 1;
        const free = freeCell(n);
        const paid = paidCell(n);
        return {
          level: n,
          reached: n <= level,
          free: {
            reward: free.wallet,
            pack: free.pack,
            claimed: claimedFree.includes(n),
            claimable: n <= level && !claimedFree.includes(n),
          },
          paid: {
            reward: paid.wallet,
            pack: paid.pack,
            claimed: owned && claimedPaid.includes(n),
            claimable: owned && n <= level && !claimedPaid.includes(n),
            locked: !owned,
          },
        };
      }),
    };
  }

  /** The pass is worth opening: a cell waiting, or the pass still on the
   *  table. The pill decides the glow from this, never the sheet. */
  passPending(): boolean {
    return anyCellPending(this.state, this.now());
  }

  doClaimPassCell(level: number, track: 'free' | 'paid'): void {
    const result = claimCell(this.state, level, track, this.now());
    if (result !== 'Claimed') return;
    playSfx('questComplete');
    this.notify();
  }

  doBuyPass(): void {
    this.openIap('SeasonPass', 'pass');
  }

  // ---------------------------------------------------------------- the Survey

  /** THE SURVEY'S SHEET, flattened (Docs/features/25-the-survey.md §6): the
   *  province's count, the next level's, and the two-column ladder. Every
   *  cell carries its own `claimable` and `claimed`, the pass's rule. */
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
      free: { reward: Wallet; pack: PackTier | null; claimed: boolean; claimable: boolean };
      paid: { reward: Wallet; pack: PackTier | null; claimed: boolean; claimable: boolean; locked: boolean };
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
            reward: free.wallet, pack: free.pack,
            claimed: claimedFree.includes(n),
            claimable: n <= level && !claimedFree.includes(n),
          },
          paid: {
            reward: paid.wallet, pack: paid.pack,
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

  doClaimMission(id: string): void {
    if (claimMission(this.state, id, this.now()) !== 'Claimed') return;
    playSfx('questComplete');
    this.notify();
  }

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

  confirmBuild(): void {
    if (this.mode.kind !== 'placing' || !this.mode.selected) return;
    const { definitionId, selected } = this.mode;
    const cost = nextBuildCost(this.state, definitionId);
    const result = enqueueBuild(this.state, this.map, definitionId, selected);
    if (result === 'Started') {
      playSfx('buildPlaced');
      this.mode = { kind: 'normal' };
      // Confirmed from a free builder's row: the sheet was only in the way.
      if (this.openOverlay === 'builder') this.openOverlay = null;
    } else if (result === 'NotEnoughResources') {
      this.shake(Object.keys(cost) as CurrencyId[]);
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
    if (result === 'NeedsPopulation') {
      const need = requiredPopulation(definitionId, targetLevel);
      return `Needs ${formatExact(need)} villagers — you have ${formatExact(this.state.city.population)}. Train more at the Townhall`;
    }
    return result;
  }

  /** What a key costs, and what the player holds — the store card's whole
   *  content. One card per banner, because the two keys are two prices. */
  keyOffer(banner: BannerId): { cost: number; held: number; key: CurrencyId } {
    const def = BANNERS[banner];
    return { cost: def.keyGemCost, held: this.walletValue(def.key), key: def.key };
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
  builderWorldJobs(): Array<{ name: string; task: string; startedAt: number; durationMs: number }> {
    return this.state.world.builds.map((b) => {
      const seconds = worldBuildSeconds(b.what, b.level);
      return {
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
  pullPrice(banner: BannerId = STANDARD_BANNER): { currency: CurrencyId; amount: number } {
    return pullPrice(this.state, banner);
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
    this.setOverlay(null);
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
   *  for a Gem pack, the pass for its paid column. A confirmation that always
   *  returned to the store would take a player who tapped a price on the pass
   *  somewhere they never asked to go. */
  openIap(id: StoreSkuId, from: OverlayName = 'store'): void {
    this.pendingSku = id;
    this.pendingSkuFrom = from;
    this.setOverlay('iapConfirm');
  }

  /** Where the confirmation came from, and where it returns. */
  iapReturn(): OverlayName {
    return this.pendingSkuFrom;
  }

  confirmIap(): void {
    const id = this.pendingSku;
    if (id === null) return;
    // Two kinds of SKU do not grant Gems and so do not go through `buySku`
    // directly. Both still spend the budget through it, inside their own
    // command: the pass is an unlock plus a back-pay (sim/pass.ts), and a card
    // bundle is a hand of packs and wildcards (sim/collection.ts).
    const result = id === 'SeasonPass'
      ? buyPass(this.state, this.now())
      : id === 'Survey'
        ? buySurvey(this.state, this.now())
      : bundleOf(id) !== null
        ? buyCardBundle(this.state, id, this.now())
        : buySku(this.state, id, this.now());
    if (result === 'Purchased' || result === 'AlreadyOwned') {
      playSfx('gemSpend');
      const back = this.pendingSkuFrom;
      this.pendingSku = null;
      // Only what the player cannot see from where they land is said. A
      // bundle is opened in the Collection, like every pack that falls: the
      // store hands over the things, it does not turn them over.
      if (id === 'SeasonPass') this.toast('The season pass is yours — every level you have reached is open');
      else if (bundleOf(id) !== null) this.toast(`${STORE[id].name} — open it in the Collection`);
      this.setOverlay(back);
      if (id === 'Survey') this.toast('The Royal Survey is yours — every level you have reached is open');
      if (result === 'Purchased' && id !== 'SeasonPass' && id !== 'Survey' && bundleOf(id) === null) {
        this.reward({ Gems: STORE[id].gems });
      }
    } else if (result === 'SeasonClosing') {
      // The season turned over while the confirmation was open. Nothing was
      // charged; say why rather than shake a purse that is not the problem.
      this.pendingSku = null;
      this.toast('The season is closing — the bundles are off the shelf');
      this.setOverlay(this.pendingSkuFrom);
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
    if (result === 'NotEnoughResources') this.shake(['Food']);
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
      this.shake(Object.keys(upgradeCost(d.definitionId, d.ordinal, d.level)) as CurrencyId[]);
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
    this.gachaReveal = { banner, calls: pulls.length, prizes };
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
      case 'iapConfirm':
        return JSON.stringify([this.pendingSku, this.payerInfo()]);
      case 'store':
        return JSON.stringify([
          this.builderOffer(),
          BANNER_ORDER.map((b) => this.keyOffer(b)),
          this.walletValue('Gems'),
        ]);
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
   *  or a video, and never before the player has a profile. A scene waits
   *  for it (ui/stage/stage.ts). */
  unlockOnScreen(): string | null {
    if (this.unlockQueue.length === 0) return null;
    if (this.state.player.payer === null) return null;
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
    this.dealPayouts();
    this.notify();
  }

  /** Ten calls at once. The banner card shows the ten results; the presenter
   *  only announces the heroes among them, because ten toasts is not a
   *  reward, it is a queue. */
  doPullMany(banner: BannerId = STANDARD_BANNER, count = 10): void {
    const batch = pullMany(this.state, banner, count);
    if (batch.result === 'NotEnoughKeys') {
      this.shake([BANNERS[banner].key]);
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
      // The last card of a chapter pays its pack; the pile opens it like any other.
      if (this.state.research.rewarded.length > paid) {
        const { tome, era } = TECHNOLOGIES[id];
        const tier = ERA_REWARDS[tome][era];
        if (tier) this.toast(`Chapter ${formatExact(era)} complete — ${packName(tier).toLowerCase()}`);
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
    // A cell the player can buy THIS tap: dark, on the cleared ground's edge,
    // inside the Townhall's reach and behind no technology. Pointing anywhere
    // else answers the tap with a refusal.
    const buyable = (c: Coord): boolean => fogState(this.state, this.map, c) === 'Discovered'
      && isPayable(this.state, this.map, c) && explorationGate(this.map, c) === null;
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
        this.setUiHint('collection');
        overlay('collection');
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
      if (finished) {
        this.queueBanner({
          title: 'The chain is done',
          icon: '👑',
          name: 'Your kingdom stands on its own',
          desc: 'No more guidance — build whatever you like from here.',
          sfx: 'chainFinished',
        });
      }
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
    this.setOverlay(null);
    this.inspectedSite = LAIRS[lairId].location;
    this.inspectedDistrictId = null;
    this.camera.centerOnCell(LAIRS[lairId].location, undefined, CAMERA_GLIDE_MS);
    this.notify();
  }

  /** Open the battle sheet on a lair. A hero ALONE is a legal board here, so
   *  this never opens pre-blocked for want of an army. */
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
    if (this.lairId === null || this.partyHeroes.length === 0) return;
    const lairId = this.lairId;
    const report = attackLair(
      this.state, this.map, lairId, this.partyHeroes, this.expeditionParty, this.now());
    if (report.result === 'Cleared') {
      // Beaten, not yet paid: when the playback closes the player is back on
      // the lair's card, where Claim has taken Attack's place
      // (Docs/proposals/lairs.md §5).
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
    // No prizes on the field: a won fight pays nothing until the reward is
    // claimed from the lair's card.
    this.openBattle(report.log!, {
      title: LAIRS[lairId].name,
      subtitle: lairView(this.state, lairId)?.creature ?? 'A warband',
      prizes: [],
      enemyFaces: UNIT_CREATURE_AVATAR,
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

  // ------------------------------------------------------------ hero picker

  /**
   * OPEN THE HERO PICKER over whatever is open: `slots` slots, pre-filled
   * with `selected`, and `onSelect` called with the heroes chosen when the
   * player presses Select. Closing it any other way changes nothing. Either
   * way the screen that opened it comes back.
   */
  openHeroPicker(opts: {
    slots: number; selected?: readonly HeroId[]; title?: string;
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
      onSelect: (heroes) => { this.partyHeroes = heroes; },
    });
  }

  heroLevelOf(heroId: HeroId): number {
    return heroLevel(this.state, heroId);
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
    },
  ): void {
    this.battle = {
      log,
      title: about.title,
      subtitle: about.subtitle,
      prizes: about.prizes,
      enemyFaces: about.enemyFaces,
      startedAt: this.now(),
      phase: 'playing',
    };
  }

  /** Which tick of the fight the screen should be drawing at `now`. Past the
   *  end it stays at the end, so a slow frame cannot skip the last blow. */
  battleTick(now: number): number {
    const b = this.battle;
    if (b === null) return 0;
    return Math.min(b.log.ticks, Math.floor((now - b.startedAt) / COMBAT.tickMs));
  }

  /**
   * Walk the playback forward. Called from the screen's own timer, because
   * the game's one-second tick is far too coarse for a fight — but every
   * decision it makes is here rather than in the DOM.
   */
  advanceBattle(now: number): void {
    const b = this.battle;
    if (b === null) return;
    const elapsed = now - b.startedAt;
    const fight = b.log.ticks * COMBAT.tickMs;
    let moved = false;
    // A LOOP, not a step: a frame the browser skipped, or a test that jumps
    // the clock, must land on the phase the clock says rather than one
    // behind it.
    for (;;) {
      if (b.phase === 'playing' && elapsed >= fight) {
        b.phase = 'result';
        playSfx(b.log.winner === 'ours' ? 'questComplete' : 'error');
        moved = true;
        continue;
      }
      if (b.phase === 'result' && elapsed >= fight + BATTLE_RESULT_DELAY_MS) {
        // The prizes deal on the reveal screen, over the board — the one
        // place in the game that already knows how to hand things over one
        // at a time.
        b.phase = b.prizes.length > 0 ? 'rewards' : 'done';
        if (b.phase === 'rewards') this.gachaReveal = { prizes: b.prizes, caption: 'Spoils' };
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
      this.shake([BANNERS[banner].key]);
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
    else if (result === 'TierCapped') this.toast('Their ascension holds them back');
    this.notify();
  }

  doRaiseHeroTier(id: HeroId): void {
    const result = raiseHeroTier(this.state, id);
    if (result === 'Raised') playSfx('upgradeBought');
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

  doTrain(unitId: TrainableId, at?: District): void {
    const result = trainUnit(this.state, unitId, this.now(), at);
    if (result === 'Queued') playSfx('unitTrained');
    if (result === 'NotEnoughResources') this.shake(['Gold', 'Wood', 'Food']);
    if (result === 'AtMax') this.toast(this.atMaxWords());
    if (result === 'NoBuilding' && unitId !== 'Villager') {
      this.toast(
        `Build the ${trainerName(unitId)} first — it is where ${UNITS[unitId].name}s are trained`);
    }
    if (result === 'ArmyAtCapacity') {
      this.toast(`Army at capacity (${formatExact(committedTroops(this.state))}/${formatExact(armyCap(this.state))}) — build or upgrade a military building`);
    }
    this.notify();
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
    // No payer profile, no game: the profile sheet has the screen until one
    // is chosen (14-monetization.md §3). Whatever was asked for waits.
    if (this.state.player.payer === null && name !== 'payerProfile') {
      if (name !== null) this.afterProfileOverlay = name;
      name = 'payerProfile';
    }
    // A padlocked door says what opens it and opens nothing
    // (Docs/features/22-progression.md §3).
    const door = name === null ? undefined : OVERLAY_DOOR[name];
    if (name !== null && name !== 'welcome' && name !== 'payerProfile') this.noteFirstTap(`menu:${name}`);
    if (name === 'survey') recordEvent(this.state, { kind: 'signal', key: 'surveyOpened' });
    if (door !== undefined && !isDoorOpen(this.state, door)) {
      this.toast(DOOR_HINT[door]);
      this.notify();
      return;
    }
    this.openOverlay = name;
    if (name !== null) {
      this.inspectedDistrictId = null;
      this.inspectedSite = null;
    }
    // Building happens on the province: the Build menu takes the player home.
    if (name === 'build' && this.scene === 'world') this.scene = 'province';
    if (name !== 'world' && name !== 'army') this.selectedHex = null;
    // Leaving the roster forgets which hero was open, so coming back lands on
    // the grid rather than inside whoever was last read.
    if (name !== 'heroes') this.openHeroId = null;
    // Anything else taking the screen closes a picker without an answer.
    if (name !== 'heroPicker') this.heroPick = null;
    if (name !== 'collection') this.vaultOpen = false;
    if (name !== 'collection') {
      this.openRelicId = null;
      this.armedWildcard = null;
    }
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
    // The profile sheet cannot be dismissed — there is nothing behind it yet.
    this.openOverlay = this.state.player.payer === null ? 'payerProfile' : null;
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
    return {
      ...this.markerCache.layer,
      hintCell: this.hintCell(), spellZones: this.spellZones(), tutorialFocus: this.tutorialFocus,
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
      selectedSize: null,
      liftedDistrictId: this.mode.kind === 'moving' ? this.mode.districtUniqueId : null,
      inspectedDistrictId: this.inspectedDistrictId,
      hintCell: null,
      spellZones: [],
      tutorialFocus: null,
    };
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
        if (active.id === 'Reap') {
          layer.influenceCells = reapCells(
            this.state, this.map, this.mode.selected,
            activeRadius(this.state, this.mode.artifactId));
        }
        // A ZONE ON BUILDINGS lights the BUILDINGS, not the ground: what the
        // cast will touch is the answer the preview owes, and a lit square of
        // empty grass would promise something it cannot pay.
        if (active.id === 'Haste' || active.id === 'Tithe') {
          layer.influenceCells = this.zoneTargets(
            this.mode.artifactId, active.id, this.mode.selected);
        }
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
        // The nodes a Divining would wake, which is what it is FOR.
        if (active.id === 'Divining') {
          layer.influenceCells = reapCells(
            this.state, this.map, this.mode.selected,
            activeRadius(this.state, this.mode.artifactId));
        }
      }
    } else if (this.inspectedDistrictId) {
      const district = districtById(this.state, this.inspectedDistrictId);
      // No selection outline: the building pulses white while its card is
      // open (MarkerLayer.inspectedDistrictId), and its area is the ink.
      if (district) {
        if (district.state === 'Built') {
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
      };
    }
    if (this.mode.kind !== 'placing') return null;
    const { definitionId, selected } = this.mode;
    if (!selected) {
      return {
        kind: 'build', definitionId, cell: null, cost: {},
        duration: 0, affordable: false, captured: 0, unmoved: false,
      };
    }
    const cost = nextBuildCost(this.state, definitionId);
    return {
      kind: 'build',
      definitionId,
      cell: selected,
      cost,
      duration: buildDurationForCell(this.state, definitionId, selected, this.map),
      affordable: canAfford(this.state.city.wallet, cost),
      captured: this.capturedCells(definitionId, selected).length,
      unmoved: false,
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
    return cell.x >= ghost.cell.x && cell.x < ghost.cell.x + ghost.size.x
      && cell.y >= ghost.cell.y && cell.y < ghost.cell.y + ghost.size.y;
  }

  /**
   * Drag the ghost under the pointer.
   *
   * The anchor follows the finger by CELL, not by pixel offset, and an
   * illegal cell is simply not taken — the ghost stays on the last legal one
   * it passed through rather than following the finger somewhere it cannot be
   * dropped and then snapping back. Dragging across a lake leaves it on the
   * shore, which is the honest preview of where a release would put it.
   */
  dragGhostTo(sx: number, sy: number): void {
    if (this.mode.kind !== 'placing' && this.mode.kind !== 'moving') return;
    const cell = this.camera.screenToCell(sx, sy);
    const current = this.mode.selected;
    if (current && current.x === cell.x && current.y === cell.y) return;
    if (!this.map.terrain.has(coordKey(cell))) return;
    const legal = this.mode.kind === 'moving'
      ? this.canDropAt(cell)
      : placementBlock(this.state, this.map, this.mode.definitionId, cell) === null;
    if (!legal) return;
    this.mode.selected = cell;
    this.notify();
  }

  /** The finger is on the ghost (true) or has let go (false). */
  holdGhost(held: boolean): void {
    if (this.ghostHeld === held) return;
    this.ghostHeld = held;
    this.notify();
  }

  /**
   * Which ways the ghost can step: one grid axis each, and only where the
   * next cell that way is legal — so the arrows say where it can go, and
   * their absence where it cannot.
   */
  ghostSteps(): Coord[] {
    if (this.ghostHeld) return [];
    if (this.mode.kind !== 'placing' && this.mode.kind !== 'moving') return [];
    const at = this.mode.selected;
    if (!at) return [];
    const { definitionId } = this.mode;
    const movingId = this.mode.kind === 'moving' ? this.mode.districtUniqueId : undefined;
    return [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter((d) => {
      const cell = { x: at.x + d.x, y: at.y + d.y };
      return this.map.terrain.has(coordKey(cell))
        && placementBlock(this.state, this.map, definitionId, cell, movingId) === null;
    });
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
    else if (mode.kind === 'moving') this.inspectedDistrictId = mode.districtUniqueId;
    this.notify();
  }

  // ------------------------------------------------------- the world board

  /** Which board is on screen. Not saved: a reload opens on the province. */
  scene: 'province' | 'world' = 'province';
  /** The world hex the dispatch sheet is about. */
  selectedHex: number | null = null;
  /** The world's camera, handed over by main once the canvas exists. */
  worldCamera: HexCamera | null = null;

  private worldTicks = 0;
  /** The world server, handed over by main — the local stand-in for now
   *  (worldServer/local.ts). */
  worldServer: WorldServerApi | null = null;
  /** What the server last said about the board. */
  worldView: WorldSnapshot | null = null;
  /** The dev tool's "play as": the seat world commands are made for, or
   *  null for the player's own. A rival's commands cost the player nothing. */
  actingSeat: number | null = null;
  /** Who the player is to the servers: the signed-in user's id, handed over
   *  by main; a test plays as the stand-in's old fixed id. */
  playerId = 'local-player';
  /** Saves the game now — main's save, handed over. A world effect is
   *  acknowledged to the server only once the state it changed is saved, so
   *  a crash between the two delivers it again rather than losing it. */
  persist: (() => void) | null = null;

  /** Where the board comes from: the server's snapshot once there is one,
   *  the locally generated board before (sim/world/source.ts). */
  worldSource(): WorldSource {
    return this.worldView !== null ? snapshotWorld(this.worldView) : localWorld(this.state.world.board);
  }

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
      if (e.kind === 'armyHome') receiveArmy(this.state, e);
      else if (e.kind === 'loot') {
        // A dungeon room's pay (11-expeditions.md §7): Gold to the city,
        // Knowledge and Stardust to the kingdom, Hero XP as Hero XP.
        addToWallet(this.state.city.wallet, 'Gold', e.gold);
        addToWallet(this.state.kingdom.wallet, 'Knowledge', e.knowledge);
        addToWallet(this.state.kingdom.wallet, 'Stardust', e.stardust);
        addHeroXp(this.state, e.heroXp);
        if (e.gems) addToWallet(this.state.player.wallet, 'Gems', e.gems);
        if (e.pack) grantPack(this.state, e.pack, 'portal');
        // A camp's lump of precious material, to the city's goods (19 §7.4).
        if (e.precious) {
          addGood(this.state.city.goods, e.precious.id, e.precious.amount);
          this.toast(`+${formatCount(e.precious.amount)} ${e.precious.id}`);
        }
        this.reward({ Gold: e.gold, Knowledge: e.knowledge, Stardust: e.stardust, HeroXp: e.heroXp, ...(e.gems ? { Gems: e.gems } : {}) });
      } else if (e.kind === 'goods') {
        // Precious material from the Exchange: an offer taken, or one back.
        addGood(this.state.city.goods, e.lot.id, e.lot.amount);
        this.toast(e.text);
      } else this.toast(e.text);
    }
    if (fresh.length > 0) {
      this.state.world.effectSeq = Math.max(...fresh.map((e) => e.seq ?? 0));
      this.persist?.();
    }
    if (this.actingSeat === null) this.worldServer?.acknowledge(this.state.world.effectSeq);
    this.worldView = snap;
    this.reportSeenCamps(snap);
    const board = snapshotWorld(snap).board();
    this.state.world.sanctuaries = snap.hexes.filter((h) => h.owner === snap.board.seat && h.held && h.active
      && board.hexes[h.index].features.includes('Sanctuary')).length;
    this.notify();
  }

  /** A lurking camp raids only once the player has seen it, and only the
   *  player's fog knows that: tell the server of any it has not been told
   *  of (19 §5.5). Once at a time. */
  private seenPending = false;
  private reportSeenCamps(snap: WorldSnapshot): void {
    if (this.worldServer === null || this.actingSeat !== null || this.seenPending) return;
    const told = new Set(snap.seenCamps ?? []);
    const fog = worldFogAt(this.state, this.now());
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
      Shut: 'The Portal is shut', NoAttempts: 'No clears left in the Portal today',
      NoRoute: 'No way there through explored ground',
      NothingBuilding: 'Nothing is being built there',
      Guarded: 'A camp holds it — beat it, or pay it off, first',
      NoSuchOffer: 'That offer is gone', OwnOffer: 'That offer is yours',
      TooManyOffers: 'You have as many offers up as you may', BadOffer: 'That is not an offer anyone can take',
      NotARival: 'Only a rival can be played', Offline: 'The world cannot be reached — try again',
      BadNickname: 'That name cannot be used', NicknameTaken: 'Another kingdom has that name',
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
    playSfx('click');
    // Started from a free builder's row: the sheet was only in the way.
    if (this.openOverlay === 'builder') this.openOverlay = null;
    this.applyWorldSnapshot(r.snapshot);
  }

  // ------------------------------------------------------ armies on the board

  /** Where the army being composed is going, and to do what. */
  armyTarget: number | null = null;
  armyPurpose: ArmyPurpose = 'attack';

  /** Compose an army for a hex, on the attack screen. */
  openArmy(target: number, purpose: ArmyPurpose): void {
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
    const fog = worldFogAt(this.state, this.now());
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
    return null;
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
    const r = await this.worldServer.sendArmy({
      purpose: this.armyPurpose, target, heroes, board, path: route.path, speed: armyMarchSpeed(this.state),
    });
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    departArmy(this.state, {
      id: r.army, heroes, troops: slots.map((s) => ({ unitId: s.unitId, count: s.count })),
      target, purpose: this.armyPurpose,
    });
    this.armyTarget = null;
    this.dismiss();
    this.toast(`Your army marches — there in ${formatCountdown(Math.max(0, r.arrivesAt - this.now()) / 1000)}`);
    this.applyWorldSnapshot(r.snapshot);
  }

  /** Fight the next room of the dungeon an army camps at, and watch it. */
  async doDelveRoom(armyId: string): Promise<void> {
    if (this.worldServer === null) return;
    const r = await this.worldServer.delveRoom(armyId);
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
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
    });
    this.notify();
  }

  /** Go down the Portal's next floor, and watch the fight. */
  async doDescendPortal(armyId: string): Promise<void> {
    if (this.worldServer === null) return;
    const r = await this.worldServer.descendPortal(armyId);
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    this.applyWorldSnapshot(r.snapshot);
    this.openBattle(r.log, { title: `The Dark Portal · floor ${formatCount(r.room)}`, subtitle: 'The depths below', prizes: [] });
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
    this.applyWorldSnapshot(r.snapshot);
  }

  /** What an explorer home says: what it revealed, and what its target paid. */
  private explorerHomeToast(home: ExplorerHome): void {
    const found = home.paid === null ? '' : `, and ${scoutWords(home.paid)}`;
    this.toast(home.revealed > 0
      ? `Your explorer is home — ${formatCount(home.revealed)} new hexes on the map${found}`
      : `Your explorer is home — nothing new out there${found}`);
    if (home.paid !== null && Object.keys(home.paid.wallet).length > 0) this.reward(home.paid.wallet);
  }

  /** The dungeon the delve screen is about, the depth it shows (null: the
   *  player's current one), and what the last room fought there paid. */
  delveHex: number | null = null;
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

  /** What the player is about to offer on the Exchange. */
  exchangeDraft: { give: PreciousId; giveN: number; want: PreciousId; wantN: number } = {
    give: 'Starmetal', giveN: 10, want: 'Heartwood', wantN: 10,
  };

  /** Open the Exchange, the player's own material offered first. */
  openExchange(): void {
    const own = this.worldSource().board().materials[this.worldSeat()];
    if (own !== undefined && this.exchangeDraft.give !== own) {
      this.exchangeDraft = { ...this.exchangeDraft, give: own, want: PRECIOUS.find((p) => p !== own)! };
    }
    this.setOverlay('exchange');
  }

  /** Put the draft up: what it gives leaves the city's goods now. */
  async doPostOffer(): Promise<void> {
    if (this.worldServer === null) return;
    const d = this.exchangeDraft;
    if (getGood(this.state.city.goods, d.give) < d.giveN) {
      this.toast(`Not enough ${d.give}`);
      this.notify();
      return;
    }
    addGood(this.state.city.goods, d.give, -d.giveN);
    const r = await this.worldServer.postOffer({ id: d.give, amount: d.giveN }, { id: d.want, amount: d.wantN });
    if (!r.ok) {
      addGood(this.state.city.goods, d.give, d.giveN);
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    playSfx('click');
    this.toast('Your offer is up on the Exchange');
    this.applyWorldSnapshot(r.snapshot);
  }

  /** Take an offer: pay what it wants, receive what it gives. */
  async doTakeOffer(offerId: string): Promise<void> {
    if (this.worldServer === null) return;
    const o = this.worldView?.offers?.find((x) => x.id === offerId);
    if (o === undefined) return;
    if (getGood(this.state.city.goods, o.want.id) < o.want.amount) {
      this.toast(`Not enough ${o.want.id}`);
      this.notify();
      return;
    }
    addGood(this.state.city.goods, o.want.id, -o.want.amount);
    const r = await this.worldServer.takeOffer(offerId);
    if (!r.ok) {
      addGood(this.state.city.goods, o.want.id, o.want.amount);
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    if (r.received !== null) {
      addGood(this.state.city.goods, r.received.id, r.received.amount);
      this.toast(`+${formatCount(r.received.amount)} ${r.received.id}`);
    }
    playSfx('click');
    this.applyWorldSnapshot(r.snapshot);
  }

  /** Take one's own offer down: what it held comes back. */
  async doWithdrawOffer(offerId: string): Promise<void> {
    if (this.worldServer === null) return;
    const r = await this.worldServer.withdrawOffer(offerId);
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    if (r.received !== null) addGood(this.state.city.goods, r.received.id, r.received.amount);
    this.applyWorldSnapshot(r.snapshot);
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
    const r = await this.worldServer.tribute(index);
    if (!r.ok) {
      this.toast(this.worldRefusal(r.why));
      this.notify();
      return;
    }
    pay(this.state.city.wallet, cost);
    playSfx('click');
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
    // Out onto the board at the player's own city, up close.
    this.worldCamera?.focusHex(hexAt(homeIndex(this.state)));
    void this.refreshWorld();
    this.notify();
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
    if (index < 0) {
      this.dismiss();
      return;
    }
    this.selectedHex = index;
    this.setOverlay('world');
  }

  /** Bring a hex into view. */
  showHex(index: number): void {
    this.worldCamera?.centerOnHex(hexAt(index));
    this.notify();
  }

  /** Bring an explorer home now, with Gems: its hexes are revealed at once. */
  doFinishExplorer(tripId: string): void {
    const result = finishExplorerWithGems(this.state, tripId, this.now());
    if (result.kind === 'Finished') {
      playSfx('gemSpend');
      this.explorerHomeToast(result.home);
    } else if (result.kind === 'NotEnoughGems') {
      this.shake(['Gems']);
    }
    this.notify();
  }

  /** Send an explorer to the hex the sheet is about. */
  doSendExplorer(): void {
    const target = this.selectedHex;
    if (target === null) return;
    const result = dispatchExplorer(this.state, target, this.now());
    if (result.kind === 'Sent') {
      playSfx('click');
      this.dismiss();
      return;
    }
    if (result.kind === 'NoExplorerFree') {
      this.toast(`Every explorer is out — one is back in ${formatCountdown((result.nextFreeAt - this.now()) / 1000)}`);
    } else if (result.kind === 'NoCartography') {
      this.toast('Research Cartography in the Atlas to send an explorer');
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

  handleTap(sx: number, sy: number): void {
    // A lair's warning bubble floats over other cells: a tap on it is a tap
    // on the lair (Docs/proposals/lairs.md §6).
    // So is a tap on the lair's picture above its own ground — its pixels,
    // not its box, so the cells round its edges still answer as themselves.
    const bubbled = this.mode.kind === 'normal'
      ? lairBubbleAt(sx, sy) ?? lairArtAt(sx, sy) : null;
    const cell = bubbled !== null ? LAIRS[bubbled].location : this.camera.screenToCell(sx, sy);
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
    kind: 'population' | 'workers' | 'builders' | 'army'; value: number; max: number;
  } {
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
  const provides = DISTRICTS[definitionId].providesHarvestSource;
  if (provides === null) return null;
  const spec = HARVEST[provides];
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
function siteBanner(id: string): Banner | null {
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
    SilverKey: '🔑', GoldKey: '🗝️',
  };
  return icons[c];
}


/** The building that trains a unit type, by name — for the blocker text. */
function trainerName(unitId: UnitId): string {
  const def = Object.values(DISTRICTS).find((d) => d.trains.includes(unitId));
  return def?.name ?? 'right building';
}


/**
 * THE ICON A MISSION KIND WEARS.
 *
 * Every one of them is already in the UI atlas — `tests/icons.test.ts` refuses
 * an emoji fallback, so a kind with no honest cell would fail the build rather
 * than quietly draw a glyph.
 */
const MISSION_ICON: Record<MissionKind, IconName> = {
  Population: 'population',
  UpgradeDistricts: 'arrowUp',
  RaiseTownhall: 'Townhall',
  CollectResource: 'workers',
  DiscoverCells: 'compass',
  BuildDistricts: 'build',
  TrainTroops: 'army',
  LevelHeroes: 'star',
  OpenPacks: 'pack',
};

/**
 * WHAT A MISSION SAYS IT WANTS, in one line.
 *
 * Generated from the mission rather than authored per roll, so a target that
 * scaled with the city cannot disagree with the sentence that names it.
 */
function missionGoal(m: Mission): string {
  const n = formatCount(m.target);
  switch (m.kind) {
    case 'Population': return `Grow the town by ${n}`;
    case 'UpgradeDistricts': return `Upgrade buildings ${n} times`;
    case 'RaiseTownhall': return 'Raise the Townhall a level';
    case 'CollectResource': return `Collect ${n} ${(m.subject ?? 'Gold').toLowerCase()}`;
    case 'DiscoverCells': return `Discover ${n} cells`;
    case 'BuildDistricts': return `Build ${n} buildings`;
    case 'TrainTroops': return `Train ${n} soldiers`;
    case 'LevelHeroes': return `Level heroes ${n} times`;
    default: return `Open ${n} card packs`;
  }
}

/**
 * THE COLLECTION PRIZE, as the reveal deals it (Docs/features/09-relics.md §5).
 *
 * Heroes last, the rule `gachaPrizes` already keeps: the Gems and the Stardust
 * are the wind-up and the season's hero is what the forty-fifth card was for.
 * A hero the player already holds is the Fragments tile instead — showing them
 * as a hero would promise a roster entry that is already there.
 */
function prizePrizes(prize: CollectionPrize): GachaPrize[] {
  const out: GachaPrize[] = [];
  if (prize.gems > 0) out.push({ kind: 'currency', currency: 'Gems', amount: prize.gems });
  if (prize.stardust > 0) {
    out.push({ kind: 'currency', currency: 'Stardust', amount: prize.stardust });
  }
  out.push(prize.duplicate
    ? { kind: 'fragments', heroId: prize.hero, amount: prize.fragments }
    : { kind: 'hero', heroId: prize.hero });
  return out;
}

/** A face as a shelf prints it: `4★` or `4★ gold`. */
const faceLabel = (face: FaceId): string => {
  const { rarity, gold } = faceOf(face);
  return `${rarity}★${gold ? ' gold' : ''}`;
};

/**
 * WHAT A PACK PROMISES, in one line, generated from its guarantees.
 *
 * A pack's identity IS its guarantee, so the sentence is derived rather than
 * authored: a row retuned on the sheet cannot leave a promise behind that the
 * odds no longer keep.
 */
function packPromise(tier: PackTier): string {
  const def = PACKS[tier];
  const cards = `${def.cards} card${def.cards === 1 ? '' : 's'}`;
  const given = FACE_ORDER
    .filter((f) => (def.guarantees[f] ?? 0) > 0)
    .map((f) => `${def.guarantees[f]}× ${faceLabel(f)}`);
  if (given.length > 0) return `${cards}, ${given.join(' and ')} guaranteed`;
  // A pack with no guarantee promises its POOL instead: the Golden one is a
  // single card and every face it can deal is a gold edition, which is a
  // stronger promise than any guarantee it could carry.
  const pool = FACE_ORDER.filter((_, i) => (def.weights[i] ?? 0) > 0);
  if (pool.length === 0) return cards;
  return `${cards}, always ${pool.map(faceLabel).join(' or ')}`;
}

/** What a sobre is CALLED: the dearest face it promises, or the dearest it can
 *  deal when it promises nothing. A pack's identity is what it is FOR. */
function packName(tier: PackTier): string {
  const def = PACKS[tier];
  const promised = [...FACE_ORDER].reverse().find((f) => (def.guarantees[f] ?? 0) > 0);
  const best = promised
    ?? [...FACE_ORDER].reverse().find((f) => (def.weights[FACE_ORDER.indexOf(f)] ?? 0) > 0);
  return `A ${best === undefined ? '' : faceLabel(best)} pack`;
}

/** The cards a pack dealt, worst first: the reveal's own order. */
/**
 * A PACK'S CARDS AS TILES — one tile per CARD, not per copy.
 *
 * The opening records every copy in the order it was dealt, which is what the
 * sim needs; a screen that mapped it one-for-one drew the same card twice
 * whenever a pack handed over a pair, each tile claiming a different running
 * total. Grouping is the screen's business and this is where it belongs.
 *
 * `isNew` survives the grouping if ANY copy carried it: only the first copy of
 * a card the player did not have is marked, so the pair that introduced a card
 * must still read as new.
 */
function packPrizes(opening: PackOpening): GachaPrize[] {
  const tiles = new Map<string, Extract<GachaPrize, { kind: 'card' }>>();
  for (const c of opening.cards) {
    const key = `${c.ref.album}:${c.ref.slot}`;
    const seen = tiles.get(key);
    if (seen === undefined) {
      tiles.set(key, {
        kind: 'card', album: c.ref.album, slot: c.ref.slot, isNew: c.isNew, copies: 1,
      });
    } else {
      seen.copies += 1;
      seen.isNew = seen.isNew || c.isNew;
    }
  }
  return [...tiles.values()];
}

/**
 * One relic's effect, said in the player's words at a given value.
 *
 * A speed reads as "30% faster" (the modifier is a multiplier BELOW 1, so the
 * saving is 1 − value); a yield reads as "+25%" or "+2". One place, because
 * the card prints the same sentence twice — now, and at the next level.
 */
function relicEffectText(id: ArtifactId, value: number): string {
  // A relic's stats all share one op — the pair the Seal and the Sigil carry
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

/** What each relic's number is ABOUT, in three or four words. */
const RELIC_SUBJECT: Record<ArtifactId, string> = {
  DowsingRod: 'Forests, crops and stone recover',
  VerdantSeal: 'A node holds, and a swing takes',
  ForemansSigil: 'Your crews swing and walk',
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
  NoHero: 'Pick a hero to lead them',
  TooManyHeroes: 'More heroes than you have slots for',
  TooManySlots: 'Too many kinds of unit — buy another party slot',
  NotEnoughUnits: 'You do not have that many at home',
  NotEnoughSupplies: 'Not enough supplies to march',
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
