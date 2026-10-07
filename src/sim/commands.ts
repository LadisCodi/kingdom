// The sim's public command API and the unified advance: one event-ordered pass
// serves both the live once-per-second tick and offline replay.

import { newsMark, postBoundaryNews } from './notices';
import { track } from './analytics';
import { ABANDONED, BANNERS, DISTRICTS, KINGDOM_DEF, SHRINE_RULES, TECHNOLOGIES, type BannerId,
} from './data/definitions';
import {
  buildDurationForCell, buildGoodsCost, canMoveDistrict, districtCount, maxDistrictCount,
  nextBuildCost, nextOrdinal,
  placementBlock, requiredPopulation, requiredTechForLevel, requiredTownhallLevel,
  upgradeCost, upgradeDuration, upgradeGoodsCost,
} from './districts';
import { advanceTraining, lineFor, nextTrainingCompletion, type Delivered } from './army';
import { dropFragments } from './relics';
import { lairHolding } from './lairZone';
import { closeRelicWindows, nextRelicWindowEnd } from './hosts';
import { advanceRaids, armLairs, nextRaidBoundary, type RaidEvent } from './lairs';
import { fogState, revealAroundDistrict } from './fog';
import { pickUpTreasure } from './treasures';
import { recordEvent } from './events';
import { grantItem, itemCount, takeItem } from './bag';
import {
  advanceSchedule, nextScheduleBoundary, type ScheduleEvent,
} from './timeline';
import type { MapData } from './grid';
import {
  advanceRespawns, collectTap, tapCell, type CollectTapResult, type TapCellResult,
} from './harvest';
import { accrueMana } from './mana';
import { accrueKnowledge, landmarkClaimLump, payKnowledge, territoryKnowledge } from './knowledge';
import { advanceCityLife, repriceTaxAnchorAround } from './population';
import { advanceQueue } from './queue';
import { claimBandReward, completeTech, isTechComplete, type ResearchResult } from './research';
import { pruneExpiredModifiers, nextModifierExpiry, type Modifier } from './modifiers';
import { canAfford, pay } from './wallet';
import { canAffordGoods, payGoods } from './goods';
import { harmonyBlock } from './harmony';
import {
  advanceWorkshops, completeWorkshopItems, isWorkshop, nextWorkshopCompletion, reanchor,
  type GoodMade,
} from './workshops';
import {
  addWorker, advanceWorkers, assignableWorkerLimit, relocateCrew, removeWorker,
  wakeIdleWorkersAt, type DepositEvent, type StrikeEvent,
} from './workers';
import {
  addToWallet, builderCount, buildQueueCapacity, busyBuilders, cellsOfRect, completesAt, districtById,
  districtOccupies, getWallet,
  districtCells, newId, remainingSeconds, townhall,
  type ItemId, type ArtifactId, type Coord, type District, type DistrictId, type GameState,
  type QueueItem, type TechId, type UnitId, type Wallet, type WorldBuild,
} from './state';
import { collectStore } from './storage';
import { applyRentRush, nextRentRush, stampRentRush } from './quests';
import { gemsToFinish } from './rush';
import {
  finishWorldBuilds, nextExplorerReturn, nextWorldBuildDone, returnExplorers, type ExplorerHome,
} from './world/explorers';

// ------------------------------------------------------------------ building

export type GrantBuilderResult = 'Granted' | 'AtCeiling';

/**
 * Hire a builder, free: one more job the city can have in flight.
 *
 * The unpriced door. Quests, events and `?dev` grant builders; the PLAYER
 * buys one through `buyBuilder` below. Keeping the grant and the purchase
 * apart is what lets a future event hand out a temporary builder without
 * teaching the price curve anything.
 */
export function grantBuilder(state: GameState): GrantBuilderResult {
  if (state.kingdom.builders >= KINGDOM_DEF.maxBuilders) return 'AtCeiling';
  state.kingdom.builders += 1;
  return 'Granted';
}

/**
 * Gems for the NEXT builder, on the same escalating-slot curve the research,
 * party and attunement slots already use: `round(base x growth^purchased)`.
 *
 * `purchased` is derived — `builders - startBuilders` — rather than counted
 * in its own save field, because the two can never disagree that way. The
 * cost of that: a granted builder makes the next PURCHASED one dearer. That
 * is the right way round for a gift, and the alternative (a separate counter)
 * is a field that has to be migrated and kept honest forever.
 */
export const builderGemCost = (state: GameState): number =>
  Math.round(
    KINGDOM_DEF.builderGemCostBase
    * KINGDOM_DEF.builderGemCostGrowth ** Math.max(0, state.kingdom.builders - KINGDOM_DEF.startBuilders),
  );

export type BuyBuilderResult = 'Purchased' | 'AtMax' | 'NotEnoughGems';

/** The player's own purchase. Same shape as `buySlot` / `buyPartySlot`. */
export function buyBuilder(state: GameState): BuyBuilderResult {
  if (state.kingdom.builders >= KINGDOM_DEF.maxBuilders) return 'AtMax';
  const cost = builderGemCost(state);
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  state.kingdom.builders += 1;
  return 'Purchased';
}

export type BuyKeysResult = 'Purchased' | 'NotEnoughGems';

/**
 * Buy gacha keys with Gems — the one place Gems reach the banners since a
 * pull stopped costing them directly (`heroes.ts#pullPrice`).
 *
 * Not a store SKU: a SKU is real money and grants Gems, and the importer
 * refuses a `Store` row that does not. This is the shape the second builder
 * already uses — a Gem-priced card the store shows without owning.
 */
export function buyKeys(state: GameState, banner: BannerId, count = 1): BuyKeysResult {
  const def = BANNERS[banner];
  const cost = def.keyGemCost * count;
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  grantItem(state, def.key, count);
  return 'Purchased';
}

/** `NoBuilderFree`, not `QueueFull`: nothing is queued and nothing waits —
 *  every builder is already on a job. It is the moment the Gem offer exists
 *  for (`Docs/features/06-construction.md`). */
export type EnqueueBuildResult =
  | 'Started' | 'NoBuilderFree' | 'NotEnoughResources' | 'NotEnoughGoods'
  | 'NeedsHarmony' | 'InvalidCell';

export function enqueueBuild(
  state: GameState,
  map: MapData,
  definitionId: DistrictId,
  cell: Coord,
): EnqueueBuildResult {
  if (busyBuilders(state) >= buildQueueCapacity(state)) return 'NoBuilderFree';
  // Harmony and the goods are told apart from the cell before it is, because
  // the answer to each is a different errand — build a decoration, queue at a
  // workshop, or pick another spot — and `InvalidCell` would name none of
  // them.
  if (harmonyBlock(state, DISTRICTS[definitionId], 1) !== null) return 'NeedsHarmony';
  if (placementBlock(state, map, definitionId, cell) !== null) return 'InvalidCell';
  return startBuild(state, map, definitionId, cell);
}

/**
 * Pay for a building and put it on the ground, under construction, with its
 * job in the queue — the half of a build that every way of starting one
 * shares. The caller has already said the ground and the building are legal.
 */
function startBuild(
  state: GameState, map: MapData, definitionId: DistrictId, cell: Coord,
  /** False when the price was paid another way — a premium Shrine's Gems. */
  charge = true,
): 'Started' | 'NotEnoughResources' | 'NotEnoughGoods' {
  const cost = charge ? nextBuildCost(state, definitionId) : {};
  // Three purses: the wallet, the stockpile, and the city's own beauty. The
  // goods are paid when the build is QUEUED and refunded in full on cancel —
  // the rule a workshop item already follows.
  const goods = charge ? buildGoodsCost(state, definitionId) : {};
  if (!canAfford(state.city.wallet, cost)) return 'NotEnoughResources';
  if (!canAffordGoods(state.city.goods, goods)) return 'NotEnoughGoods';
  pay(state.city.wallet, cost);
  payGoods(state.city.goods, goods);
  const district: District = {
    uniqueId: newId(state, `district_${definitionId}`),
    definitionId,
    // Stamped here and never changed: it prices every level of this building
    // for ever (Docs/features/05-city-and-districts.md §3.1).
    ordinal: nextOrdinal(state, definitionId),
    level: 1,
    assignedWorkers: 0,
    location: cell,
    state: 'UnderConstruction',
    visualVariant: 1,
  };
  const duration = buildDurationForCell(state, definitionId, cell, map);
  state.city.districts.push(district);
  // A treasure under the new footprint is picked up, not buried
  // (Docs/features/01-map-and-fog.md §6.2).
  for (const c of districtCells(district)) pickUpTreasure(state, map, c);
  state.city.queue.push({
    uniqueId: `BuildItem_${district.uniqueId}`,
    kind: 'build',
    districtUniqueId: district.uniqueId,
    durationSeconds: duration,
    startedAt: null,
  });
  return 'Started';
}

// ------------------------------------------------------------- repairing

/** The Gems the next premium Shrine costs, or null when all are built
 *  (Docs/proposals/relic-restoration.md §5.1, §9). */
export const premiumShrinePrice = (state: GameState): number | null =>
  SHRINE_RULES.premiumGems[state.relics.premiumShrines] ?? null;

export type PremiumShrineResult =
  | 'Started' | 'NoneLeft' | 'NotEnoughGems' | 'NoBuilderFree' | 'CountLimit' | 'InvalidCell';

/**
 * BUILD A SHRINE ANYWHERE, FOR GEMS: breadth, like a builder — one more
 * host, never a relic. The ruin in the fog is the Shrine play finds; these
 * are the rest, each dearer than the last, and the ladder ends.
 */
export function buildPremiumShrine(state: GameState, map: MapData, cell: Coord): PremiumShrineResult {
  const price = premiumShrinePrice(state);
  if (price === null) return 'NoneLeft';
  if (busyBuilders(state) >= buildQueueCapacity(state)) return 'NoBuilderFree';
  if (districtCount(state, 'Shrine') >= maxDistrictCount(state, DISTRICTS.Shrine)) return 'CountLimit';
  if (placementBlock(state, map, 'Shrine', cell) !== null) return 'InvalidCell';
  if (getWallet(state.player.wallet, 'Gems') < price) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -price);
  state.relics.premiumShrines += 1;
  startBuild(state, map, 'Shrine', cell, false);
  track(state, 'premium_shrine', { n: state.relics.premiumShrines, gems: price });
  return 'Started';
}

export type RepairRefusal =
  | 'NotFound' | 'NotRevealed' | 'LairHeld' | 'NoBuilderFree' | 'CountLimit' | 'NeedsHarmony'
  | 'NotEnoughResources' | 'NotEnoughGoods' | 'MissingItem';

/** The item repairing this ruin also asks for — the Watchtower's lens — or
 *  null. */
export const repairItemOf = (id: string): ItemId | null => {
  const site = ABANDONED.find((a) => a.id === id);
  const item = site === undefined ? '' : DISTRICTS[site.districtId].repairItem;
  return item === '' ? null : item as ItemId;
};

/**
 * Why an abandoned building cannot be repaired right now, or null if it can
 * (Docs/features/01-map-and-fog.md §6.3).
 *
 * A repair IS a build at level 1, where it stands: the same builder, count
 * cap, Harmony and price — the level-1 cost at the next ordinal. Two rules of
 * a build do not apply, and that is the whole difference: no technology is
 * asked, and the ground is not the player's to choose.
 */
export function repairRefusal(state: GameState, map: MapData, id: string): RepairRefusal | null {
  const site = ABANDONED.find((a) => a.id === id);
  if (site === undefined || state.abandoned.repaired[id] === true) return 'NotFound';
  const def = DISTRICTS[site.districtId];
  const cells = cellsOfRect(site.location, def.size);
  if (cells.some((c) => fogState(state, map, c) !== 'Revealed')) return 'NotRevealed';
  // Not on ground a lair still holds — the Thorned Shrine waits on the Orcs.
  if (cells.some((c) => lairHolding(state, c) !== null)) return 'LairHeld';
  if (busyBuilders(state) >= buildQueueCapacity(state)) return 'NoBuilderFree';
  if (districtCount(state, site.districtId) >= maxDistrictCount(state, def)) return 'CountLimit';
  if (harmonyBlock(state, def, 1) !== null) return 'NeedsHarmony';
  if (!canAfford(state.city.wallet, nextBuildCost(state, site.districtId))) return 'NotEnoughResources';
  if (!canAffordGoods(state.city.goods, buildGoodsCost(state, site.districtId))) return 'NotEnoughGoods';
  const item = repairItemOf(id);
  if (item !== null && itemCount(state, item) < 1) return 'MissingItem';
  return null;
}

export type RepairResult = 'Started' | RepairRefusal;

/** Start repairing an abandoned building: from now on it is that building,
 *  under construction, stamped with its ordinal. */
export function repairAbandoned(state: GameState, map: MapData, id: string): RepairResult {
  const refusal = repairRefusal(state, map, id);
  if (refusal !== null) return refusal;
  const site = ABANDONED.find((a) => a.id === id)!;
  const started = startBuild(state, map, site.districtId, site.location);
  if (started === 'Started') {
    state.abandoned.repaired[id] = true;
    // The piece the ruin was missing goes into it.
    const item = repairItemOf(id);
    if (item !== null) takeItem(state, item, 1);
  }
  return started;
}

// ------------------------------------------------------------------- moving

export type MoveDistrictResult =
  | 'Moved' | 'NotFound' | 'Immovable' | 'InvalidCell' | 'SameCell';

/**
 * Pick a built building up and put it down somewhere else. **Free, instant,
 * and it never fails halfway.**
 *
 * Free because the alternative is a tax on tidying up, and this is a game
 * whose first promise is that nothing you own is ever taken from you. A move
 * costs the player nothing and gains them nothing directly — what it changes
 * is position, and position is already priced by everything that reads it:
 * housing adjacency, influence radius, worker walking distance.
 *
 * Which is why it goes through `repriceTaxAnchorAround`. Moving a house in or
 * out of a neighbour's range changes the city's gold rate at this instant,
 * and the tax anchor has to be settled at the instant the rate changed or the
 * player is paid the new rate for time already elapsed at the old one. That
 * is the same mechanism a completed build uses; a move is just another thing
 * that reprices the city.
 */
export function moveDistrict(
  state: GameState,
  map: MapData,
  districtUniqueId: string,
  cell: Coord,
  now: number,
): MoveDistrictResult {
  const district = districtById(state, districtUniqueId);
  if (!district) return 'NotFound';
  if (!canMoveDistrict(district)) return 'Immovable';
  if (district.location.x === cell.x && district.location.y === cell.y) return 'SameCell';
  if (placementBlock(state, map, district.definitionId, cell, district.uniqueId) !== null) {
    return 'InvalidCell';
  }
  relocateDistrict(state, map, district, cell, now);
  return 'Moved';
}

/** Put `district` at `cell` and let everything that reads position follow —
 *  the tax anchor, the crew, the fog ring, idle workers. The caller has
 *  already decided the cell is legal. */
function relocateDistrict(
  state: GameState, map: MapData, district: District, cell: Coord, now: number,
): boolean {
  const from = district.location;
  // A Shrine carries its relic's aura with it, window and all: the aura is
  // read from where the Shrine stands, and the reprice below covers both ends.
  repriceTaxAnchorAround(state, now, () => {
    district.location = cell;
  });
  // An unfinished building has no crew and no ring: its fog is pushed back
  // when the build COMPLETES, and revealing it early would hand the player
  // ground the fog has not been paid for.
  if (district.state === 'Built') {
    relocateCrew(state, map, district, from, now);
    // The new address pushes back the fog exactly as finishing a build does —
    // otherwise a building could be moved to the frontier and sit there
    // staring at ground it has already paid to see.
    revealAroundDistrict(state, map, district);
  }
  // Its old neighbours may have cells free now, and its new ones may not.
  wakeIdleWorkersAt(state, now);
  return true;
}

/**
 * Put every building back on ground it may stand on.
 *
 * A footprint is DATA (`size` in buildings.json), so it can grow under a
 * city that is already built: a Barracks placed on one cell becomes 2×2, and
 * its three new cells may hold a neighbour, a tree or water. Run on load, it
 * moves each building whose footprint is no longer legal where it stands to
 * the nearest legal cell, the way a player's move does — crew, fog and the
 * tax anchor follow it. The biggest go first, so
 * a grown building steps off its neighbour before that neighbour is judged.
 * A building with nowhere legal left is left where it is. Idempotent: on a
 * city that fits, it moves nothing.
 */
export function settleFootprints(state: GameState, map: MapData, now: number): string[] {
  const moved: string[] = [];
  const area = (id: string) => DISTRICTS[id as keyof typeof DISTRICTS].size.x
    * DISTRICTS[id as keyof typeof DISTRICTS].size.y;
  const order = [...state.city.districts]
    .filter(canMoveDistrict)
    .sort((a, b) => area(b.definitionId) - area(a.definitionId));
  // `placementBlock` asks who stands on a cell and takes the first answer, so
  // on a cell two footprints share it can answer with the building being
  // judged and call it free. Overlap is checked against EVERY other one.
  const fitsAt = (d: typeof order[number], at: Coord): boolean =>
    placementBlock(state, map, d.definitionId, at, d.uniqueId) === null
    && !cellsOfRect(at, DISTRICTS[d.definitionId].size).some((c) => state.city.districts.some(
      (o) => o.uniqueId !== d.uniqueId && districtOccupies(o, c)));
  for (const d of order) {
    if (fitsAt(d, d.location)) continue;
    const from = d.location;
    let best: Coord | null = null;
    let bestD = Infinity;
    for (const c of map.cells) {
      const dist = (c.x - from.x) ** 2 + (c.y - from.y) ** 2;
      if (dist >= bestD || !fitsAt(d, c)) continue;
      bestD = dist;
      best = c;
    }
    // Set, not `moveDistrict`: that one checks the destination with the same
    // first-answer lookup. The move's consequences follow it by hand.
    if (best !== null && relocateDistrict(state, map, d, best, now)) moved.push(d.uniqueId);
  }
  return moved;
}

export type UpgradeResult =
  | 'Started' | 'AtMaxLevel' | 'AlreadyUpgrading' | 'RequirementsNotMet' | 'NeedsPopulation'
  | 'NoBuilderFree' | 'NotEnoughResources' | 'NotEnoughGoods' | 'NeedsHarmony';

/**
 * Why this building cannot be upgraded right now, or null when it can — every
 * gate, cost and wait `upgradeDistrict` checks, without touching the state.
 * The one definition of "ready to upgrade", so a screen that says so (the
 * district card's call to action) and the command that does it cannot
 * disagree.
 */
/**
 * Research a technology whose Knowledge is in: pay the Gold and complete it,
 * now (Docs/features/07-research.md §1).
 *
 * The pure `completeTech` plus the two things a completion does to the rest
 * of the game, which is why it is a command and takes the map:
 *
 *  * **A technology that widens sight** re-applies every standing building's
 *    fog radii, not only the next one built. Keyed on the STAT rather than on
 *    Farsight by name, so a second technology that moves `discoverRadius`
 *    needs no line of its own.
 *  * **A technology that raises a lump pays it back** for every landmark and
 *    lair already held (sim/knowledge.ts `territoryKnowledge`).
 *  * **The last card of a band pays the band's card pack**, once
 *    (`research.ts#claimBandReward`). Research takes no time, so this is the
 *    moment, and no boundary is needed.
 *
 * Bracketed by the tax repricing, because a technology can move the tax rate
 * (Communities) and the anchor must not bank the old rate's time at the new.
 */
export function researchTech(
  state: GameState, map: MapData, id: TechId, now: number,
): ResearchResult {
  let result: ResearchResult = 'NotFilled';
  repriceTaxAnchorAround(state, now, () => {
    const before = territoryKnowledge(state);
    result = completeTech(state, id);
    if (result !== 'Researched') return;
    payKnowledge(state, territoryKnowledge(state) - before);
    const band = claimBandReward(state, id);
    if (band !== null) dropFragments(state, 'any', band.fragments, ['band', band.tome, band.era]);
    if (TECHNOLOGIES[id].effects.some((e) => e.stat === 'discoverRadius')) {
      for (const d of state.city.districts) {
        if (d.state === 'Built') revealAroundDistrict(state, map, d);
      }
    }
  });
  return result;
}

export function upgradeRefusal(
  state: GameState, districtUniqueId: string,
): Exclude<UpgradeResult, 'Started'> | null {
  const district = districtById(state, districtUniqueId);
  if (!district) return 'RequirementsNotMet';
  const def = DISTRICTS[district.definitionId];
  if (district.level >= def.maxLevel) return 'AtMaxLevel';
  if (state.city.queue.some((q) => q.kind === 'upgrade' && q.districtUniqueId === districtUniqueId)) {
    return 'AlreadyUpgrading';
  }
  if (townhall(state).level < requiredTownhallLevel(district.definitionId, district.level + 1)) {
    return 'RequirementsNotMet';
  }
  const gateTech = requiredTechForLevel(district.definitionId, district.level + 1);
  if (gateTech !== null && !isTechComplete(state, gateTech)) return 'RequirementsNotMet';
  // A town grows when its people do: the Townhall's levels ask for villagers
  // on top of the technology, and the answer is an errand of its own — Food,
  // and the training line (05-city-and-districts.md §1).
  if (state.city.population < requiredPopulation(district.definitionId, district.level + 1)) {
    return 'NeedsPopulation';
  }
  if (busyBuilders(state) >= buildQueueCapacity(state)) return 'NoBuilderFree';
  const cost = upgradeCost(district.definitionId, district.ordinal, district.level);
  // Two purses, two refusals. Goods are told apart from raw resources because
  // the answer to each is a different errand: one is a trip to the map, the
  // other a queue at a workshop.
  const goods = upgradeGoodsCost(state, district.definitionId, district.level + 1);
  if (!canAfford(state.city.wallet, cost)) return 'NotEnoughResources';
  if (!canAffordGoods(state.city.goods, goods)) return 'NotEnoughGoods';
  // The third errand: the decorations. Asked once, here, and never read
  // again — the level this buys keeps its demand for good, but nothing ever
  // takes it back (Docs/features/21-harmony.md).
  if (harmonyBlock(state, def, district.level + 1, district) !== null) return 'NeedsHarmony';
  return null;
}

export function upgradeDistrict(state: GameState, districtUniqueId: string): UpgradeResult {
  const refusal = upgradeRefusal(state, districtUniqueId);
  if (refusal !== null) return refusal;
  const district = districtById(state, districtUniqueId)!;
  const cost = upgradeCost(district.definitionId, district.ordinal, district.level);
  const goods = upgradeGoodsCost(state, district.definitionId, district.level + 1);
  pay(state.city.wallet, cost);
  payGoods(state.city.goods, goods);
  state.city.queue.push({
    uniqueId: `UpgradeItem_${district.uniqueId}_${district.level + 1}`,
    kind: 'upgrade',
    districtUniqueId: district.uniqueId,
    targetLevel: district.level + 1,
    durationSeconds: upgradeDuration(state, district.definitionId, district.level),
    startedAt: null,
  });
  return 'Started';
}

// A queued BUILD cannot be cancelled: it is paid for when it starts, and a
// building put in the wrong place is MOVED rather than undone
// (Docs/features/06-construction.md §1). That is also what keeps an ordinal
// unique without a counter of its own — nothing ever leaves the list.

// --------------------------------------------------------------- completions

export { wakeIdleWorkersAt };

function completeQueueItem(state: GameState, map: MapData, item: QueueItem, t: number): void {
  const district = districtById(state, item.districtUniqueId);
  if (!district) return;
  if (item.kind === 'build') {
    district.state = 'Built';
    revealAroundDistrict(state, map, district); // the new building pushes back the fog
    recordEvent(state, { kind: 'districtBuilt', district: district.definitionId });
    // The Watchtower stands: what claiming a landmark pays, it pays — a lump
    // of Knowledge (its Mana is `manaCap`'s, its eight rings its own fog
    // radius, the world's door `watchtowerClaimed`).
    if (district.definitionId === 'Watchtower') payKnowledge(state, landmarkClaimLump(state));
  } else {
    district.level = item.targetLevel ?? district.level + 1;
    // A level may reveal further (the Townhall's does): its ring lands now.
    revealAroundDistrict(state, map, district);
    recordEvent(state, {
      kind: 'districtLevel', district: district.definitionId, level: district.level,
    });
    if (district.definitionId === 'Townhall') track(state, 'townhall_level', { level: district.level });
  }
  wakeIdleWorkersAt(state, t); // new workable cells / bigger radius from t on
}

export type RushResult = 'Success' | 'NotFound' | 'NotEnoughGems';

/** The Gems that finish a build now (sim/rush.ts). */
export const gemRushCost = (item: QueueItem, now: number): number => gemsToFinish(remainingSeconds(item, now));

export function finishWithGems(
  state: GameState,
  map: MapData,
  itemId: string,
  now: number,
): RushResult {
  const item = state.city.queue.find((q) => q.uniqueId === itemId);
  if (!item) return 'NotFound';
  const cost = gemRushCost(item, now);
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  // Remove from the queue FIRST so the advance can't double-complete it.
  state.city.queue.splice(state.city.queue.indexOf(item), 1);
  completeQueueItem(state, map, item, now);
  return 'Success';
}

/**
 * TAKE `ms` OFF THE BUILD OR UPGRADE RUNNING AS `itemId`, at `now` — a
 * speed-up (sim/speedups.ts). Only a running item: one waiting for a builder
 * has no clock to move. If that brings its end to `now` or before, it
 * completes NOW — never at the earlier instant the cut implies — and the item
 * that takes its builder starts now too, so a speed-up never gives time away.
 * Returns the milliseconds it used; the rest of a speed-up bigger than the
 * wait is lost.
 */
export function cutQueueItem(state: GameState, map: MapData, itemId: string, ms: number, now: number): number {
  const item = state.city.queue.find((q) => q.uniqueId === itemId);
  if (!item || item.startedAt === null || !(ms > 0)) return 0;
  const left = Math.max(0, completesAt(item) - now);
  if (ms < left) {
    item.cutMs = (item.cutMs ?? 0) + ms;
    return ms;
  }
  state.city.queue.splice(state.city.queue.indexOf(item), 1);
  // A house built or raised pays a new rent from now.
  repriceTaxAnchorAround(state, now, () => completeQueueItem(state, map, item, now));
  const slots = Math.max(1, buildQueueCapacity(state));
  const promoted = state.city.queue[slots - 1];
  if (promoted !== undefined && promoted.startedAt === null) promoted.startedAt = now;
  return left;
}

// ------------------------------------------------------------------- workers

export type AssignWorkerResult = 'Assigned' | 'Unassigned' | 'NoFreeWorkers' | 'AtCapacity' | 'NotAWorkerDistrict' | 'NoWorkers';

export function changeWorkers(
  state: GameState,
  map: MapData,
  districtUniqueId: string,
  delta: 1 | -1,
  now: number,
): AssignWorkerResult {
  const district = districtById(state, districtUniqueId);
  if (!district || DISTRICTS[district.definitionId].maxWorkersPerLevel.length === 0) {
    return 'NotAWorkerDistrict';
  }
  // A workshop's rate is its crew, so the work done so far has to be banked
  // BEFORE the crew changes — otherwise the last hour would be recomputed at
  // the new rate, forwards or backwards.
  if (isWorkshop(district)) reanchor(state, district, now);
  if (delta === 1) {
    const assigned = state.city.districts.reduce((s, d) => s + d.assignedWorkers, 0);
    if (state.city.population - assigned < 1) return 'NoFreeWorkers';
    if (district.assignedWorkers >= assignableWorkerLimit(state, district)) return 'AtCapacity';
    addWorker(state, map, district, now);
    return 'Assigned';
  }
  if (district.assignedWorkers === 0) return 'NoWorkers';
  removeWorker(state, district);
  wakeIdleWorkersAt(state, now); // a freed claim may unblock an Idle worker
  return 'Unassigned';
}

// ------------------------------------------------------------ collecting

/**
 * Tap a building with something in its store: everything in it moves to the
 * wallet, free (Docs/features/03-economy.md §3.2). Mana is what a tap on the
 * GROUND costs; a building's store is the player's own work waiting for
 * them. Returns what moved — empty when there was nothing, which is the
 * caller's cue to open the building instead.
 *
 * Emptying a full store sets its crew going again from `now`.
 */
export function collectBuilding(state: GameState, districtUniqueId: string, now: number): Wallet {
  const district = districtById(state, districtUniqueId);
  if (!district || district.state !== 'Built') return {};
  const moved = collectStore(state, district, now);
  if (Object.keys(moved).length > 0) wakeIdleWorkersAt(state, now);
  return moved;
}

// The Townhall no longer answers a tap. A training queue is a FIXED duration
// and a tap is a scaling one, so a maxed thumb would finish a 20-second
// villager in a single press — `Docs/features/04-harvest.md` §3.2. Timers are
// hurried with Gems; Mana buys work, and a queue is not work.

// ------------------------------------------------------------------- advance
//
// THE BOUNDARY LOOP. `advance` splits its window at every moment discrete work
// falls due, and runs the continuous sims only BETWEEN those moments. Three
// properties hold, and every future boundary source must preserve them:
//
//  1. Termination is structural. `consider` only accepts `at > after`, and
//     `applyDueAt(cursor)` drains every source AT the cursor before
//     `nextBoundary` is asked — so the cursor strictly increases. The step cap
//     is a seatbelt, not the mechanism.
//  2. Boundaries are absolute-time, not tick-relative. That is *why* stepped
//     ticking and one-call offline replay converge exactly rather than
//     approximately: a tech completing at C splits the window at C in both.
//  3. A boundary landing exactly on `toTime` is still applied, because
//     `applyDueAt` sits at the top of the loop body (tests/research.test.ts
//     relies on this).
//
// Deliberately preserved: there is no trailing `applyDueAt(toTime)`. The old
// code never called `advanceQueue` at `toTime` either, and adding one would
// change when a newly enqueued item is stamped.
//
// Deliberately NOT a boundary: feature respawns. Over a long replay a finite
// feature can cycle dozens of times, and each boundary costs a full
// `advanceWorkers` sweep — O(workers × workableCells) with a fresh allocation
// per worker. Thousands of boundaries would turn a ~10-iteration replay into a
// multi-second one, to fix an inaccuracy both paths share identically.

export interface AdvanceResult {
  /** Axe-lands-on-cell events: the renderer hits the CELL with them. */
  strikes: StrikeEvent[];
  /** Haul-lands-at-building events: the building's store grew. The gap
   *  between a strike and its deposit is the walk. */
  deposits: DepositEvent[];
  completedItems: QueueItem[];
  goldEarned: number; // rent that landed in the houses' stores in this window
  trainedPopulation: number; // villagers who finished training
  /** Modifiers whose window closed inside this advance — the "it ran out
   *  while you were away" half of the offline report. */
  expiredModifiers: Modifier[];
  /** City relics whose activation window closed inside this advance. */
  relicsAsleep: ArtifactId[];
  manaEarned: number;
  knowledgeEarned: number;
  /** Units that finished training in this window. */
  trainedUnits: UnitId[];
  /** Military buildings whose training line ran dry in this window: the
   *  last soldier out, and when. What the 'trained' news is about — a hall
   *  standing idle, not every soldier it hands over. */
  linesDone: LineDone[];
  /** Goods a workshop crew finished in this window. */
  goodsMade: GoodMade[];
  /** Windows that opened or closed — including ones that did BOTH while the
   *  player was away, which is the payoff for absolute-time boundaries. */
  scheduleEvents: ScheduleEvent[];
  /** Garrisons that came down off the hill while the player was away. */
  raids: RaidEvent[];
  /** Explorers that came home from the world board, and what they revealed. */
  explorersHome: ExplorerHome[];
  /** World builds whose builder came home: the district or upgrade stands. */
  worldBuildsDone: WorldBuild[];
}

/** A military building's training line that ran dry (`AdvanceResult.linesDone`). */
export interface LineDone { buildingId: string; unit: UnitId; at: number }

const emptyResult = (): AdvanceResult => ({
  strikes: [], deposits: [], completedItems: [], goldEarned: 0,
  trainedPopulation: 0, expiredModifiers: [], relicsAsleep: [], manaEarned: 0, knowledgeEarned: 0,
  trainedUnits: [], linesDone: [], scheduleEvents: [], goodsMade: [], raids: [],
  explorersHome: [],
  worldBuildsDone: [],
});

/** Discrete work due AT `t`: everything that changes another subsystem's inputs. */
function applyDueAt(
  state: GameState,
  map: MapData,
  t: number,
  builders: number,
  out: AdvanceResult,
): void {
  // Bracketed so the tax anchor is repriced across the WHOLE batch: one call
  // site covers a Housing completing, Communities landing and a taxRate
  // modifier expiring, instead of only the training completion that used to
  // remember to do it.
  const mark = newsMark(out);
  repriceTaxAnchorAround(state, t, () => {
    for (const item of advanceQueue(state.city.queue, t, builders)) {
      completeQueueItem(state, map, item, Math.min(completesAt(item), t));
      out.completedItems.push(item);
    }
    out.expiredModifiers.push(...pruneExpiredModifiers(state, t));
    // A relic's window closing changes what its aura pays, rent included.
    out.relicsAsleep.push(...closeRelicWindows(state, t));
    // One line, two kinds of trainee: villagers land on the population, units
    // in the army, and the caller is told about each separately.
    const last = new Map<string, Delivered>();
    for (const d of advanceTraining(state, t)) {
      if (d.trainee === 'Villager') out.trainedPopulation += 1;
      else {
        out.trainedUnits.push(d.trainee);
        last.set(d.buildingId, d);
      }
    }
    // A line that delivered and has nothing left has gone idle — at the
    // moment its last soldier came out, which a one-call replay and a
    // stepped one agree on.
    for (const [buildingId, d] of last) {
      if (lineFor(state, buildingId).length === 0) {
        out.linesDone.push({ buildingId, unit: d.trainee as UnitId, at: d.at });
      }
    }
    // NOTHING FOR THE LAIRS. A room resolves the instant the player enters
    // it (Docs/features/11-expeditions.md §5), so no party is ever in flight
    // and this loop has no expedition work to do at all.
    // A lair is a TIMER too: the counter a discovery started runs and pays out
    // in full while the player is away. Arming comes first, so a lair found
    // between two boundaries — or by a save that predates lairs entirely —
    // starts its warning HERE, stamped with this boundary's t, and cannot be
    // raided in the same instant it was noticed.
    armLairs(state, t);
    const raids = advanceRaids(state, t);
    out.raids.push(...raids);
    // A raid empties stores, and a crew waiting by a full one can go out again.
    if (raids.length > 0) wakeIdleWorkersAt(state, t);
    out.scheduleEvents.push(...advanceSchedule(state, t));
    // A finished good lands in the stockpile here rather than in
    // `runContinuous`, because it changes another subsystem's inputs: the
    // next building level may become affordable on it.
    out.goodsMade.push(...completeWorkshopItems(state, t));
    // An explorer home is a TIMER: its march resolves at its absolute time,
    // and its whole reveal folds into the fog here (sim/world/explorers.ts).
    out.explorersHome.push(...returnExplorers(state, t));
    // A builder out on the world board comes home when its build stands.
    out.worldBuildsDone.push(...finishWorldBuilds(state, t));
    // The tutorial's rent rush: stamped when its quest becomes active, and
    // the house topped up when it falls due (sim/quests.ts).
    stampRentRush(state, t);
    applyRentRush(state, t);
  });
  // What this boundary did that the player may not have seen
  // (Docs/features/26-notices.md §2.1).
  postBoundaryNews(state, t, out, mark);
}

/** The continuous sims, run only BETWEEN boundaries. */
function runContinuous(state: GameState, map: MapData, t: number, out: AdvanceResult): void {
  advanceRespawns(state, map, t);
  const crew = advanceWorkers(state, map, t);
  out.strikes.push(...crew.strikes);
  out.deposits.push(...crew.deposits);
  // A workshop's ceiling is its queue: it runs until the queue is done.
  advanceWorkshops(state, t);
  out.goldEarned += advanceCityLife(state, t).gold;
  // Rent lands in the houses and hauls in the producers, each up to its
  // store; Mana up to its pool. Those capacities are the only ceilings on
  // an absence — there is no offline cap.
  out.manaEarned += accrueMana(state, t);
  out.knowledgeEarned += accrueKnowledge(state, t);
}

/** The earliest moment STRICTLY after `after` at which discrete work falls
 *  due. Adding a source is one `consider()` line. */
function nextBoundary(state: GameState, after: number, builders: number): number {
  let t = Infinity;
  const consider = (at: number | null): void => {
    if (at !== null && at > after && at < t) t = at;
  };
  for (const item of state.city.queue.slice(0, builders)) {
    if (item.startedAt !== null) consider(completesAt(item));
  }
  consider(nextModifierExpiry(state, after));
  consider(nextRelicWindowEnd(state, after));
  consider(nextTrainingCompletion(state, after));
  consider(nextRaidBoundary(state, after));
  consider(nextScheduleBoundary(state, after));
  consider(nextWorkshopCompletion(state, after));
  consider(nextExplorerReturn(state, after));
  consider(nextWorldBuildDone(state, after));
  consider(nextRentRush(state));
  return t;
}

/** Seatbelt only — see property 1 in the header. A window with this many
 *  genuine boundaries is a content bug, and stopping early beats hanging. */
const MAX_BOUNDARY_STEPS = 10_000;

/**
 * Advance the whole sim from state.lastAdvance to `toTime`. Used verbatim by
 * the live once-per-second tick and by offline replay — see the header above
 * for why those two agree exactly rather than approximately.
 */
export function advance(state: GameState, map: MapData, toTime: number): AdvanceResult {
  const result = emptyResult();
  let cursor = Math.min(state.lastAdvance, toTime);
  const builders = builderCount(state);
  for (let steps = 0; steps < MAX_BOUNDARY_STEPS; steps++) {
    applyDueAt(state, map, cursor, builders, result);
    const next = nextBoundary(state, cursor, builders);
    if (next > toTime) break;
    runContinuous(state, map, next, result);
    cursor = next;
  }
  runContinuous(state, map, toTime, result);
  state.lastAdvance = toTime;
  return result;
}

export { canAfford, collectTap, tapCell, assignableWorkerLimit };
export type { CollectTapResult, TapCellResult };
