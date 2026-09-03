// Game orchestrator: owns the sim state, UI modes (placement / inspection),
// the tap-handler chain, and change notification.

import {
  advance, builderGemCost, buyBuilder, canAfford, cancelQueueItem, changeWorkers, collectTap,
  enqueueBuild, finishWithGems, moveDistrict, townhallTap, upgradeDistrict,
  wakeIdleWorkersAt,
  type AssignWorkerResult, type CollectTapResult, type UpgradeResult,
} from './sim/commands';
import {
  AD, ARTIFACTS, BUILDABLE_DISTRICTS, CURRENCIES, DISTRICTS, HARVEST, HEROES,
  LANDMARK_ART, LANDMARKS, RUINS,
  TECHNOLOGIES, TRAINING, UNITS, levelIndexed,
} from './sim/data/definitions';
import {
  buildDurationForCell, canMoveDistrict, districtCount, hasPlacementRestriction,
  maxCountForTownhallLevel, nextBuildCost, placementBlock, validPlacementCells,
} from './sim/districts';
import {
  explorationGate, fogState, revealCostForCell, revealTap,
} from './sim/fog';
import { cellsWithinRadiusOfRect, townhallDistance, type MapData } from './sim/grid';
import { harvestSourceAt, isExhausted, tapYieldAt } from './sim/harvest';
import { placementAdjacency } from './sim/adjacency';
import {
  committedArmyPower, finishLineWithGems, lineFor, maxArmyPower, trainUnit,
  trainingCompletesAt, trainingTap, unitInTraining,
} from './sim/army';
import {
  artifactIsCommitted, attune, buyAttunementSlot, levelUpArtifact, raiseArtifactTier,
} from './sim/artifacts';
import { bloomPreview, cast, castBlock, divinationSaving, validCastCells } from './sim/casting';
import { claimLandmark, visibleLandmarks } from './sim/landmarks';
import {
  adOfferPending, adOfferReward, claimAdOffer, refreshAdOffer,
} from './sim/adOffers';
import { availableRoster } from './sim/army';
import { typeMultiplier } from './sim/combat';
import {
  buyPartySlot, delveById, discoveredRuins, extract, freeHeroes, launchBlock, launchDelve,
  previewExpedition, pushDeeper, supplyCost, unitSlots,
  type ExpeditionPreview, type LaunchBlock,
} from './sim/expeditions';
import { levelUpHero, pull, raiseHeroTier } from './sim/heroes';
import {
  mana, manaCap, manaNetRegen, manaProduction, refillManaWithGems,
} from './sim/mana';
import { landmarkDefAt, ruinDefAt } from './sim/sites';
import { hasMarket, salePayout, sellGoods } from './sim/market';
import {
  availableWorkers, districtCapacity, houseTap, maxPopulation, populationCost, residentsOf,
} from './sim/population';
import { activeQuest, claimQuest, isQuestComplete, questValue } from './sim/quests';
import {
  anyResearchActionable, buySlot, isTechComplete, startTech, techUnlocks,
} from './sim/research';
import {
  anyUpgradeActionable, buyUpgrade, effectiveAutoTapCooldownMs, effectiveWorkerYield,
} from './sim/upgrades';
import {
  builderCount, coordKey, districtAt, districtById, getWallet, sameCell, townhall,
  type ArtifactId, type Coord, type CurrencyId, type Delve, type District, type DistrictId,
  type FeatureId, type TrainableId,
  type GameState, type HeroId, type PartySlotState, type RuinId, type TechId, type UnitId,
  type UpgradeId, type Wallet,
} from './sim/state';
import {
  chestAvailable, chestReward, claimDailyChest, ladderLength, nextStep,
} from './sim/daily';
import { influenceCells, workableCells } from './sim/workers';
import { playSfx, type SfxName } from './audio/sfx';
import type { HarvestSourceId } from './sim/state';
import { KINGDOM_DEF, QUESTS, type QuestDef } from './sim/data/definitions';
import { Camera } from './render/camera';
import { Floaters } from './render/floaters';
import { Villagers } from './render/villagers';
import type { MarkerLayer } from './render/mapRenderer';
import { PALETTE } from './render/palette';
import { TapChain } from './render/tapChain';
import { TapFx } from './render/tapFx';

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
  | 'build' | 'market' | 'research' | 'settings' | 'purse' | 'welcome'
  | 'reliquary' | 'expedition' | 'checkpoint' | 'adOffer' | 'builder' | 'daily';

/** A transient attention hint: a UI element (by key) or a world cell gets an
 *  arrow until it's interacted with or HINT_MS passes. */
export type Hint =
  | { kind: 'ui'; key: string; until: number }
  | { kind: 'cell'; cell: Coord; until: number };

const HINT_MS = 8000;

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

export class Game {
  mode: Mode = { kind: 'normal' };
  inspectedDistrictId: string | null = null;
  /** The ruin the expedition sheet is being composed for. */
  expeditionRuin: RuinId | null = null;
  /** What the player has picked so far, by unit type. Lives on the presenter
   *  rather than in the view because it survives the per-tick rebuild and is
   *  node-testable. */
  expeditionParty: PartySlotState[] = [];
  expeditionHero: HeroId | null = null;
  expeditionOrder: number | null = null;
  /** The relic the player has chosen to send DOWN rather than wear. Null is
   *  the common case and always a valid party. */
  expeditionArtifact: ArtifactId | null = null;
  /** The delve whose checkpoint sheet is open. */
  openCheckpoint: string | null = null;
  /** When the fake ad started playing. A UI moment, not sim state — a reload
   *  mid-ad simply drops back to the offer, which is still standing. */
  adWatchStartedAt: number | null = null;
  /** The map SITE whose card is open — a landmark or a ruin. Sites are not
   *  districts (they are authored content on a cell, not something the player
   *  built), so they get their own slot rather than being squeezed into
   *  inspectedDistrictId. */
  inspectedSite: Coord | null = null;
  private hint: Hint | null = null;
  openOverlay: OverlayName | null = null;
  readonly floaters = new Floaters();
  readonly villagers = new Villagers();
  readonly tapChain = new TapChain();
  readonly tapFx = new TapFx();
  private bannerQueue: Banner[] = [];
  private questWasComplete = false;
  private boatsOut = new Set<string>();
  private changeListeners: Array<() => void> = [];
  private shakeListeners: Array<(c: CurrencyId[]) => void> = [];
  private toastListeners: Array<(msg: string) => void> = [];

  constructor(
    public state: GameState,
    public readonly map: MapData,
    public readonly camera: Camera,
  ) {
    this.registerTapHandlers();
  }

  now(): number {
    return Date.now();
  }

  // ------------------------------------------------------------ subscriptions

  onChange(fn: () => void): void {
    this.changeListeners.push(fn);
  }
  onShake(fn: (c: CurrencyId[]) => void): void {
    this.shakeListeners.push(fn);
  }
  onToast(fn: (msg: string) => void): void {
    this.toastListeners.push(fn);
  }
  notify(): void {
    // The ad offer's latch. Here rather than in `tick()` because Mana crosses
    // the 50% gate on a TAP, not on the second — and every command ends in a
    // notify, so this sees the spend that made the player eligible instead of
    // lagging it by up to a second. `tick()` calls notify() too, so the
    // "after advance()" ordering the architecture needs still holds.
    refreshAdOffer(this.state, this.now());
    // Move fresh sim discoveries into the banner queue BEFORE listeners run,
    // so the banner component sees them on this very render.
    for (const key of this.state.pendingDiscoveries.splice(0)) {
      const [kind, id] = key.split(':');
      if (kind === 'resource') this.queueBanner(resourceBanner(id as CurrencyId));
      if (kind === 'site') {
        const banner = siteBanner(id);
        if (banner) this.queueBanner(banner);
      }
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
  toast(msg: string): void {
    for (const fn of this.toastListeners) fn(msg);
  }

  // ------------------------------------------------------------------- ticking

  tick(): void {
    const result = advance(this.state, this.map, this.now());
    for (const d of result.deposits) {
      this.floaters.add(d.cell, `+${d.amount} ${icon(d.currencyId)}`);
    }
    if (result.goldEarned > 0) {
      this.floaters.add(townhall(this.state).location, `+${result.goldEarned} ${icon('Gold')}`);
    }
    if (result.trainedPopulation > 0) {
      playSfx('villagerTrained');
      this.floaters.add(townhall(this.state).location, `+${result.trainedPopulation} 👥`);
    }
    // A quiet splash when a fishing boat sets out (one per tick, max).
    let splashed = false;
    for (const w of this.state.workers) {
      const b = districtById(this.state, w.buildingId);
      const isBoat = b !== undefined && DISTRICTS[b.definitionId].harvestSource === 'Fish';
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
    for (const id of result.completedResearch) {
      const tech = TECHNOLOGIES[id];
      this.queueBanner({
        title: 'Research complete!', icon: tech.glyph, name: tech.name,
        desc: tech.description, tone: 'sky', sfx: 'researchComplete',
      });
      // Everything this tech just unlocked gets its own card, queued behind.
      // Upgrades are deliberately not announced — they appear as the fan of
      // circles under the tech, which is the reward being made visible.
      for (const unlock of techUnlocks(id)) {
        if (unlock.kind === 'district') {
          const def = DISTRICTS[unlock.id];
          this.queueBanner({
            title: 'New building unlocked!', icon: def.glyph, name: def.name,
            desc: def.description, sprite: `${def.sprite}_l1`,
          });
        } else if (unlock.kind === 'districtLevel') {
          const def = DISTRICTS[unlock.id];
          this.queueBanner({
            title: 'Upgrade unlocked!', icon: def.glyph, name: def.name,
            desc: `${def.name} can now reach level ${unlock.level}.`,
          });
        } else if (unlock.kind === 'unit') {
          const unit = UNITS[unlock.id];
          this.queueBanner({
            title: 'New unit unlocked!', icon: unit.glyph, name: unit.name, desc: unit.description,
          });
        }
      }
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
    // 100 — landmarks and ruins. Above the fog handler, so a revealed site
    // opens its card instead of being treated as ordinary ground, and above
    // the harvest handler, so nothing tries to tap a shrine for wood.
    this.tapChain.register({
      priority: 100,
      handle: (cell) => {
        if (this.openOverlay !== null) return false;
        if (!landmarkDefAt(cell) && !ruinDefAt(cell)) return false;
        if (fogState(this.state, this.map, cell) !== 'Revealed') return false;
        this.inspectedSite = cell;
        this.inspectedDistrictId = null;
        playSfx('click');
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
        if (fog === 'Undiscovered') return true; // swallowed
        if (fog !== 'Discovered') return false;
        const result = revealTap(this.state, this.map, cell);
        if (result === 'NotEnoughGold') this.shake(['Gold']);
        else if (result === 'NotReachable') {
          // Say the rule, not just "no". A player who has been told once that
          // the frontier moves outward stops trying to buy the far tile.
          playSfx('error');
          this.toast('Clear a path to it first — the fog lifts from the edges');
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
          this.floaters.add(cell, `-1 ${icon('Gold')}`);
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
        // Market: tapping the built Market opens its trade screen.
        if (district?.definitionId === 'Market' && district.state === 'Built') {
          this.setOverlay('market');
          return true;
        }
        // Housing: tapping fast-forwards tax collection (and opens the card).
        if (district && district.state === 'Built' &&
          districtCapacity(this.state, district) > 0) {
          const { result, gold } = houseTap(this.state, district, this.now());
          if (result === 'Collected') {
            this.tapFeedback(district.location, 'tapHouse');
            this.floaters.add(cell, gold > 0 ? `+${gold} ${icon('Gold')}` : '⏩');
          } else if (result === 'NoMana') {
            this.outOfMana(cell);
          }
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
        if (district && district.state === 'Built'
          && DISTRICTS[district.definitionId].trains.length > 0) {
          // Read the trainee BEFORE the tap: a tap that completes the unit
          // clears the line, and the floater has to name what came out.
          const trainee = unitInTraining(this.state, district.uniqueId)?.trainee;
          const tap = trainingTap(this.state, district, this.now());
          if (tap !== 'NoTraining' && tap !== 'NoMana') this.tapFeedback(district.location);
          if (tap === 'Complete') {
            playSfx('unitTrained');
            this.floaters.add(cell, `+1 ${trainee ?? ''}`.trim());
          } else if (tap === 'Boosted') {
            this.floaters.add(cell, '⏩');
          } else if (tap === 'NoMana') {
            this.outOfMana(cell);
          }
          this.inspectedDistrictId = district.uniqueId;
          this.notify();
          return true;
        }
        // Townhall: tapping adds cycle progress (and opens/keeps its card).
        if (district?.definitionId === 'Townhall' && district.state === 'Built') {
          const tap = townhallTap(this.state, this.now());
          if (tap !== 'NoTraining' && tap !== 'NoMana') this.tapFeedback(district.location);
          if (tap === 'TrainingComplete') playSfx('villagerTrained');
          if (tap === 'TrainingComplete') this.floaters.add(cell, '+1 👥');
          else if (tap === 'Boosted') this.floaters.add(cell, '⏩');
          else if (tap === 'NoMana') this.outOfMana(cell);
          this.inspectedDistrictId = district.uniqueId;
          this.notify();
          return true;
        }
        // Resource cells (Forest, built Crops): cooldown-gated collect tap.
        const source = harvestSourceAt(this.state, cell);
        if (source !== null && this.state.fog.revealed[coordKey(cell)]) {
          this.collectAt(cell);
          // A crop plot is also a district — inspecting it stays useful.
          this.inspectedDistrictId = district?.uniqueId ?? null;
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

  /** Punch + flash + a target-appropriate sound on a successful tap. */
  private tapFeedback(anchor: Coord, sfx: SfxName = 'pop'): void {
    this.tapFx.add(coordKey(anchor));
    playSfx(sfx);
  }

  /** Out of energy, said once and in one place: every tap that spends Mana
   *  refuses the same way, so the player learns one refusal rather than four.
   *  Names the pool, because a silent no reads as a broken tap. */
  private outOfMana(cell: Coord): void {
    playSfx('error');
    this.shake(['Mana']);
    this.floaters.add(cell, `${icon('Mana')} empty`);
  }

  /** One collect on a resource cell, with feedback. `autoRepeat` marks the
   *  ticks a held pointer generates — those are cooldown-gated, deliberate
   *  taps are not. 'OnCooldown' is silent: the hold retries until it opens. */
  private collectAt(cell: Coord, autoRepeat = false): CollectTapResult {
    const source = harvestSourceAt(this.state, cell);
    const units = tapYieldAt(this.state, cell); // before the tap — it may consume the cell
    const result = collectTap(this.state, this.map, cell, this.now(), autoRepeat);
    if (result === 'Harvested' && source !== null) {
      this.tapFeedback(districtAt(this.state, cell)?.location ?? cell, TAP_SOUNDS[source]);
      this.floaters.add(cell, `+${units} ${icon(HARVEST[source].currencyId)}`);
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
    if (!this.map.terrain.has(coordKey(cell))) return false;
    // Holding a house keeps collecting, paced by the same auto-tap cooldown a
    // held tree uses, and stopping when the Mana runs out.
    const district = districtAt(this.state, cell);
    if (district && district.state === 'Built' &&
        districtCapacity(this.state, district) > 0) {
      const { result, gold } = houseTap(this.state, district, this.now(), true);
      if (result === 'NoMana') {
        playSfx('error');
        this.shake(['Mana']);
        return false;
      }
      if (result !== 'Collected') return false;
      this.tapFeedback(district.location, 'tapHouse');
      this.floaters.add(cell, gold > 0 ? `+${gold} ${icon('Gold')}` : '⏩');
      this.notify();
      return true;
    }
    if (fogState(this.state, this.map, cell) === 'Discovered') return this.revealHold(cell);
    if (harvestSourceAt(this.state, cell) === null) return false;
    if (!this.state.fog.revealed[coordKey(cell)]) return false;
    if (isExhausted(this.state, cell, this.now())) return false; // quiet — no 💤 spam
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
    const result = revealTap(this.state, this.map, cell);
    if (result !== 'Paid' && result !== 'Revealed') return false;
    this.state.lastCollectTapAt = now;
    if (result === 'Revealed') {
      wakeIdleWorkersAt(this.state, now);
      playSfx('revealDone');
      this.floaters.add(cell, 'Revealed!');
    } else {
      playSfx('revealPaid');
      this.floaters.add(cell, `-1 ${icon('Gold')}`);
    }
    this.notify();
    return true;
  }

  // ------------------------------------------------------------ placement mode

  startPlacement(definitionId: DistrictId): void {
    const valid = validPlacementCells(this.state, this.map, definitionId);
    // Auto-select the legal cell closest to the Townhall; center the camera on it.
    let selected: Coord | null = null;
    let best = Infinity;
    for (const c of valid) {
      const d = townhallDistance(this.map, c);
      if (d < best) {
        best = d;
        selected = c;
      }
    }
    this.mode = { kind: 'placing', definitionId, selected };
    this.openOverlay = null;
    this.inspectedDistrictId = null;
    if (selected) this.camera.centerOnCell(selected);
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
    const block = castBlock(this.state, artifactId);
    if (block !== null) {
      if (block === 'NotEnoughMana') this.shake(['Mana']);
      else if (block === 'NotAttuned') this.toast('Attune it first — a relic must be worn to be cast');
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
    this.inspectedDistrictId = null;
    this.inspectedSite = null;
    if (selected) this.camera.centerOnCell(selected);
    this.notify();
  }

  confirmCast(): void {
    if (this.mode.kind !== 'casting') return;
    this.doCast(this.mode.artifactId, this.mode.selected);
  }

  private doCast(artifactId: ArtifactId, target: Coord | null): void {
    const def = ARTIFACTS[artifactId];
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
      this.floaters.add(target, `Saved ${report.goldSaved} ${icon('Gold')}`);
    }
    if (report.activeId === 'Bloom' && target) {
      this.floaters.add(target, `${report.affected.length} cells renewed`);
    }
    if (report.activeId === 'Haste') {
      this.toast(`${def.active!.name} — workers carry double for the next hour`);
    }
    if (report.affected.length > 0) wakeIdleWorkersAt(this.state, this.now());
    this.notify();
  }

  /** The cast preview the panel and the renderer both read. */
  castInfo(): {
    artifactId: ArtifactId; cell: Coord | null; manaCost: number; affordable: boolean;
    saving: number; blooms: number;
  } | null {
    if (this.mode.kind !== 'casting') return null;
    const { artifactId, selected } = this.mode;
    const active = ARTIFACTS[artifactId].active!;
    return {
      artifactId,
      cell: selected,
      manaCost: active.manaCost,
      affordable: mana(this.state) >= active.manaCost,
      saving: active.id === 'Divination' && selected
        ? divinationSaving(this.state, this.map, selected) : 0,
      blooms: active.id === 'Bloom' && selected
        ? bloomPreview(this.state, this.map, selected, active.radius).length : 0,
    };
  }

  // ---------------------------------------------------------------- relics

  doAttune(slot: number, artifactId: ArtifactId | null): void {
    const result = attune(this.state, slot, artifactId, this.now());
    if (result === 'Attuned' || result === 'Unattuned') playSfx('upgradeBought');
    else if (result === 'SlotLocked') this.toast('That socket is still settling');
    else if (result === 'AlreadyAttuned') this.toast('It is already worn in another socket');
    this.notify();
  }

  doLevelArtifact(id: ArtifactId): void {
    const result = levelUpArtifact(this.state, id);
    if (result === 'Levelled') playSfx('upgradeBought');
    else if (result === 'NotEnoughKnowledge') this.shake(['Knowledge']);
    else if (result === 'TierCapped') this.toast('Raise its tier with Fragments first');
    this.notify();
  }

  doRaiseArtifactTier(id: ArtifactId): void {
    const result = raiseArtifactTier(this.state, id);
    if (result === 'Raised') playSfx('upgradeBought');
    else if (result === 'NotEnoughFragments') this.toast('Not enough Fragments yet');
    this.notify();
  }

  doBuyAttunementSlot(): void {
    const result = buyAttunementSlot(this.state);
    if (result === 'Purchased') playSfx('gemSpend');
    if (result === 'NotEnoughGems') this.shake(['Gems']);
    this.notify();
  }

  doRefillMana(): void {
    const result = refillManaWithGems(this.state);
    if (result === 'Refilled') playSfx('gemSpend');
    if (result === 'NotEnoughGems') this.shake(['Gems']);
    this.notify();
  }

  /** Everything the header's Mana gauge shows: a pool and ONE net rate.
   *  Never three numbers — the breakdown belongs in the reliquary, on tap. */
  manaInfo(): { value: number; cap: number; net: number; production: number; over: boolean } {
    const value = mana(this.state);
    const cap = manaCap(this.state);
    return {
      value,
      cap,
      net: manaNetRegen(this.state),
      production: manaProduction(this.state),
      /** An ad reward can push the pool past its ceiling; the UI shows that
       *  differently from merely being full. */
      over: value > cap,
    };
  }

  // ------------------------------------------------------------- ad offers

  /** The standing offer, or null. Drives the widget and the popup. */
  // ------------------------------------------------------------ daily chest

  /**
   * Today's chest, or null when it has already been taken.
   *
   * `ladder` is the whole cycle rather than just this step, because the sheet
   * draws it: a ladder you can see is what makes step 5 feel like somewhere
   * you got to rather than a number in a corner.
   */
  dailyChest(): {
    step: number;
    length: number;
    reward: Wallet;
    ladder: Array<{ step: number; reward: Wallet; claimed: boolean; isToday: boolean }>;
  } | null {
    if (!chestAvailable(this.state, this.now())) return null;
    const step = nextStep(this.state);
    const length = ladderLength();
    return {
      step,
      length,
      reward: chestReward(this.state, step),
      ladder: Array.from({ length }, (_, i) => ({
        step: i + 1,
        reward: chestReward(this.state, i + 1),
        // Everything before today's step in THIS cycle is already taken.
        claimed: i + 1 < step,
        isToday: i + 1 === step,
      })),
    };
  }

  doClaimDailyChest(): void {
    const chest = this.dailyChest();
    if (chest === null) return;
    if (claimDailyChest(this.state, this.now()) !== 'Claimed') return;
    playSfx('quest');
    this.setOverlay(null);
    // The reward is the point, so it is said out loud rather than left to be
    // spotted in the header.
    const parts = (Object.entries(chest.reward) as Array<[CurrencyId, number]>)
      .map(([c, n]) => `+${n} ${c}`);
    this.toast(parts.join(' · '));
    this.notify();
  }

  adOffer(): { reward: number } | null {
    return adOfferPending(this.state) ? { reward: adOfferReward(this.state) } : null;
  }

  openAdOffer(): void {
    if (this.adOffer() === null) return;
    this.setOverlay('adOffer');
  }

  /** "No thanks" and the X do the same thing: close the popup and leave the
   *  offer standing. Only claiming consumes it. */
  declineAdOffer(): void {
    this.setOverlay(null);
  }

  startAdWatch(): void {
    if (this.adOffer() === null) return;
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

  doClaimAdReward(): void {
    const watch = this.adWatch();
    if (watch === null || !watch.ready) return;
    const reward = adOfferReward(this.state);
    if (claimAdOffer(this.state, this.now()) === 'Claimed') {
      playSfx('questComplete');
      this.floaters.add(townhall(this.state).location, `+${reward} ${icon('Mana')}`);
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
    } else if (result === 'NotEnoughResources') {
      this.shake(Object.keys(cost) as CurrencyId[]);
    } else if (result === 'NoBuilderFree') {
      this.offerBuilder();
    } else {
      this.toast(result);
    }
    this.notify();
  }

  /**
   * Every builder is busy. Offer one more for Gems.
   *
   * The popup is raised from the REFUSAL rather than from a store tab,
   * because that is the only moment the player has already decided they want
   * the thing — `Docs/features/builders.md`. It opens at the ceiling too: the
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

  doBuyBuilder(): void {
    const result = buyBuilder(this.state);
    if (result === 'Purchased') {
      playSfx('gemSpend');
      this.setOverlay(null);
      this.toast('A builder joins your kingdom');
    } else if (result === 'NotEnoughGems') {
      this.shake(['Gems']);
    }
    this.notify();
  }

  // -------------------------------------------------------------- UI commands

  doSell(c: CurrencyId, amount: number): void {
    const { result, gold } = sellGoods(this.state, c, amount);
    if (result === 'Sold') {
      playSfx('coinSale');
      const market = this.state.city.districts.find(
        (d) => d.definitionId === 'Market' && d.state === 'Built');
      if (market) this.floaters.add(market.location, `+${gold} ${icon('Gold')}`);
    }
    this.notify();
  }

  doQueueTraining(): void {
    const result = trainUnit(this.state, 'Villager', this.now());
    if (result === 'NotEnoughResources') this.shake(['Food']);
    else if (result === 'AtMax') this.toast('Population at max — build more Housing');
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
      this.shake(Object.keys(DISTRICTS[d.definitionId].upgradeCost) as CurrencyId[]);
    } else if (result === 'NoBuilderFree') {
      // An upgrade occupies a builder exactly as a build does, so it hits the
      // same wall and deserves the same offer rather than a bare refusal.
      this.offerBuilder();
    } else if (result !== 'Started') {
      this.toast(result);
    }
    this.notify();
    return result;
  }

  doRush(itemId: string): void {
    const result = finishWithGems(this.state, this.map, itemId, this.now());
    if (result === 'Success') playSfx('gemSpend');
    if (result === 'NotEnoughGems') this.shake(['Gems']);
    this.notify();
  }

  doCancelItem(itemId: string): void {
    cancelQueueItem(this.state, itemId);
    this.inspectedDistrictId = null;
    this.notify();
  }

  doStartTech(id: TechId): void {
    const result = startTech(this.state, id, this.now());
    if (result === 'Started') playSfx('research');
    if (result === 'NotEnoughResources') {
      this.shake(Object.keys(TECHNOLOGIES[id].cost) as CurrencyId[]);
    } else if (result === 'NoFreeSlot') {
      this.toast('All research slots are busy');
    } else if (result === 'MissingRequirement') {
      this.toast('Requires another technology first');
    }
    this.notify();
  }

  doBuyUpgrade(id: UpgradeId): void {
    const result = buyUpgrade(this.state, id);
    if (result === 'Purchased') playSfx('upgradeBought');
    if (result === 'NotEnoughResources') this.shake(['Gold']);
    this.notify();
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
      this.camera.centerOnCell(cell);
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
      this.camera.centerOnCell(district.location);
      this.notify();
    };
    const built = (pred: (d: District) => boolean) =>
      this.state.city.districts.find((d) => d.state === 'Built' && pred(d));
    switch (quest.goalType) {
      // NOTE: hints are set BEFORE navigating — overlay()/inspect() notify,
      // and the render they trigger must already see the hint.
      case 'BuildDistrict':
        this.setUiHint(`build:${quest.goalTarget}`);
        overlay('build');
        break;
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
      case 'BuyUpgrade':
        this.setUiHint(`upgrade:${quest.goalTarget}`);
        overlay('research');
        break;
      case 'OwnHeroes':
        // The banner lives on the Reliquary's heroes tab; the sheet opens
        // there on its own when the roster is what was asked for.
        this.setUiHint('banner');
        overlay('reliquary');
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
      case 'SellGoods':
        if (hasMarket(this.state)) {
          this.setUiHint('market');
          overlay('market');
        } else {
          this.setUiHint('build:Market');
          overlay('build');
        }
        break;
      case 'DiscoverCells':
        centerCell(this.nearestCell((c) => fogState(this.state, this.map, c) === 'Discovered'));
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
          ?? this.nearestCell((c) => fogState(this.state, this.map, c) === 'Discovered'));
        break;
      }
      case 'ClaimLandmarks': {
        // The nearest landmark that is visible and unclaimed; failing that,
        // the nearest frontier cell — because the answer is "explore".
        const claimable = visibleLandmarks(this.state, this.map)
          .filter((l) => this.state.landmarks.claimed[l.id] !== true)
          .sort((a, b) =>
            townhallDistance(this.map, a.location) - townhallDistance(this.map, b.location))[0];
        if (claimable) {
          this.setOverlay(null);
          this.inspectedSite = claimable.location;
          this.camera.centerOnCell(claimable.location);
          this.notify();
        } else {
          centerCell(this.nearestCell((c) => fogState(this.state, this.map, c) === 'Discovered'));
        }
        break;
      }
      case 'ReachDepth':
      case 'ClearRuins': {
        // A party already underground is the answer; otherwise the nearest
        // ruin they could be sent into.
        const waiting = this.waitingDelves()[0];
        if (waiting) {
          this.openCheckpointFor(waiting.id);
          break;
        }
        const found = discoveredRuins(this.state, this.map)
          .sort((a, b) =>
            townhallDistance(this.map, RUINS[a].location)
            - townhallDistance(this.map, RUINS[b].location))[0];
        if (found) {
          this.setOverlay(null);
          this.inspectedSite = RUINS[found].location;
          this.camera.centerOnCell(RUINS[found].location);
          this.notify();
        } else {
          centerCell(this.nearestCell((c) => fogState(this.state, this.map, c) === 'Discovered'));
        }
        break;
      }
      case 'OwnArtifacts':
        this.setUiHint('reliquary');
        overlay('reliquary');
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
    if (result === 'Claimed' && quest) {
      // The LAST claim gets the victory sting instead of the usual chime.
      const finished = activeQuest(this.state) === null;
      playSfx(finished ? 'chainFinished' : 'quest');
      const parts = Object.entries(quest.reward)
        .map(([c, n]) => `+${n} ${icon(c as CurrencyId)}`);
      this.floaters.add(townhall(this.state).location, parts.join(' '));
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
      this.floaters.add(cell, `+${manaProduction(this.state) - before} ${icon('Mana')}/h`);
      this.queueBanner({
        title: 'Landmark claimed!',
        icon: LANDMARK_ART[def.kind].glyph,
        name: LANDMARK_ART[def.kind].name,
        desc: 'A deeper Mana pool, for good — and the fog lifts all around it.',
        sprite: LANDMARK_ART[def.kind].sprite,
        tone: 'sky',
      });
    } else if (result === 'NotEnoughGold') {
      this.shake(['Gold']);
    } else if (result === 'Defended') {
      this.toast('An enemy warband holds this place — clear it first');
    }
    this.notify();
  }

  // ----------------------------------------------------------- expeditions

  /** Why this ruin cannot be delved right now, in plain words; null = it can. */
  expeditionBlock(ruinId: RuinId): string | null {
    const running = this.state.delves.find((d) => d.ruinId === ruinId && d.phase !== 'done');
    if (running) return 'Your party is already down there';
    if (freeHeroes(this.state).length === 0) {
      return this.state.heroes.owned.length === 0
        ? 'You have no hero to lead a party'
        : 'Every hero is already underground';
    }
    if (maxArmyPower(this.state) === 0) return 'Build a Barracks — you have no army to send';
    if (this.state.army.length === 0) return 'Train some units first';
    return null;
  }

  /** Open the launch sheet, pre-filled with the best guess: the free hero and
   *  every unit the player owns, up to their slots. A player should never have
   *  to assemble a party from nothing to see what a ruin would take. */
  openExpedition(ruinId: RuinId): void {
    this.expeditionRuin = ruinId;
    this.expeditionHero = freeHeroes(this.state)[0] ?? null;
    this.expeditionOrder = null;
    // Never pre-filled, unlike the party. Arming a hero means giving up a
    // passive the player is living off, and the sheet must not make that
    // choice on their behalf — an empty socket is the only honest default.
    this.expeditionArtifact = null;
    const roster = availableRoster(this.state);
    const affinity = RUINS[ruinId].affinity;
    // Best-answering type first, then whatever else is on hand — a sensible
    // default the player can immediately override, not a recommendation.
    const order = (Object.keys(roster) as UnitId[])
      .filter((u) => roster[u] > 0)
      .sort((a, b) => scoreAgainst(b, affinity) - scoreAgainst(a, affinity));
    // Clamped to the army cap. Proposing a party the player cannot field is
    // worse than proposing a small one: the sheet would open pre-filled AND
    // pre-blocked, which reads as the game refusing its own suggestion.
    let budget = maxArmyPower(this.state);
    this.expeditionParty = [];
    for (const unitId of order.slice(0, unitSlots(this.state))) {
      const affordable = Math.min(roster[unitId], Math.floor(budget / UNITS[unitId].power));
      if (affordable <= 0) continue;
      budget -= affordable * UNITS[unitId].power;
      this.expeditionParty.push({ unitId, count: affordable });
    }
    this.setOverlay('expedition');
  }

  setExpeditionHero(heroId: HeroId): void {
    this.expeditionHero = heroId;
    this.notify();
  }

  setExpeditionCount(unitId: UnitId, count: number): void {
    const roster = availableRoster(this.state);
    const capped = Math.max(0, Math.min(count, roster[unitId] ?? 0));
    const existing = this.expeditionParty.find((s) => s.unitId === unitId);
    if (existing) existing.count = capped;
    else if (capped > 0) this.expeditionParty.push({ unitId, count: capped });
    this.expeditionParty = this.expeditionParty.filter((s) => s.count > 0);
    this.notify();
  }

  /** Tapping the socketed relic again takes it back out — the choice has to be
   *  reversible right up until the party leaves. */
  setExpeditionArtifact(artifactId: ArtifactId | null): void {
    this.expeditionArtifact = this.expeditionArtifact === artifactId ? null : artifactId;
    this.notify();
  }

  setStandingOrder(depth: number | null): void {
    this.expeditionOrder = depth;
    this.notify();
  }

  /**
   * The relic this party would actually leave with. A relic that has since
   * been attuned, or sent down with someone else, is NOT one of them.
   *
   * The block message still names the raw choice, so the player is told why —
   * but the numbers must only ever describe a party the game would really
   * send. A sheet that shows the stats of a party it is simultaneously
   * refusing reads as the game arguing with itself.
   */
  private sendableArtifact(): ArtifactId | null {
    const id = this.expeditionArtifact;
    if (id === null || artifactIsCommitted(this.state, id)) return null;
    return id;
  }

  /** The launch read-out: what this party is, and how deep it is SAFE. */
  expeditionPreview(): ExpeditionPreview | null {
    if (this.expeditionRuin === null) return null;
    return previewExpedition(
      this.state, this.expeditionRuin, this.expeditionHero, this.expeditionParty,
      this.sendableArtifact());
  }

  /** The same party WITHOUT the relic, so the sheet can show what socketing it
   *  actually bought. A defensive relic may not move the safe depth at all —
   *  it buys survival past the floor rather than a deeper floor — so the
   *  stat deltas have to be shown too, or it reads as doing nothing. */
  expeditionPreviewUnarmed(): ExpeditionPreview | null {
    if (this.expeditionRuin === null || this.sendableArtifact() === null) return null;
    return previewExpedition(
      this.state, this.expeditionRuin, this.expeditionHero, this.expeditionParty);
  }

  expeditionLaunchBlock(): string | null {
    if (this.expeditionRuin === null) return 'No ruin chosen';
    const block = launchBlock(
      this.state, this.map, this.expeditionRuin, this.expeditionHero, this.expeditionParty,
      this.expeditionArtifact);
    if (block === null) return null;
    // The supplies are printed in the button and turn clay when they cannot be
    // paid (§6.4), so saying it again in words beside it is nagging. The
    // button still refuses — the red is what disables it.
    if (block === 'NotEnoughSupplies') return null;
    return LAUNCH_BLOCK_TEXT[block];
  }

  doLaunchExpedition(): void {
    if (this.expeditionRuin === null || this.expeditionHero === null) return;
    const result = launchDelve(
      this.state, this.map, this.expeditionRuin, this.expeditionHero,
      this.expeditionParty, this.now(), this.expeditionOrder, this.expeditionArtifact,
    );
    if (result === 'Launched') {
      playSfx('unitTrained');
      this.toast('Your party sets off');
      this.expeditionRuin = null;
      this.setOverlay(null);
    } else if (result === 'NotEnoughSupplies') {
      this.shake(Object.keys(supplyCost(this.expeditionRuin, this.expeditionHero)) as CurrencyId[]);
    } else {
      this.toast(LAUNCH_BLOCK_TEXT[result]);
    }
    this.notify();
  }

  // ----------------------------------------------------------- checkpoints

  /** Parties waiting for an answer — the return hook the design asks for. */
  waitingDelves(): Delve[] {
    return this.state.delves.filter((d) => d.phase === 'checkpoint' || d.phase === 'done');
  }

  openCheckpointFor(delveId: string): void {
    this.openCheckpoint = delveId;
    this.setOverlay('checkpoint');
  }

  checkpointDelve(): Delve | undefined {
    return this.openCheckpoint === null
      ? undefined : delveById(this.state, this.openCheckpoint);
  }

  doPushDeeper(): void {
    if (this.openCheckpoint === null) return;
    const result = pushDeeper(this.state, this.openCheckpoint, this.now());
    if (result === 'Descending') {
      playSfx('click');
      this.setOverlay(null);
      this.openCheckpoint = null;
    }
    this.notify();
  }

  doExtract(): void {
    if (this.openCheckpoint === null) return;
    const report = extract(this.state, this.openCheckpoint);
    if (report.result === 'Extracted') {
      playSfx('quest');
      if (report.artifact !== null) {
        const relic = ARTIFACTS[report.artifact];
        this.queueBanner({
          title: 'A relic comes home!',
          icon: relic.glyph,
          name: relic.name,
          desc: relic.passiveText,
          sprite: relic.sprite,
          tone: 'gold',
          sfx: 'chainFinished',
        });
      }
      this.toast(`Banked from depth ${report.depth}`);
    }
    this.openCheckpoint = null;
    this.setOverlay(null);
    this.notify();
  }

  doBuyPartySlot(): void {
    const result = buyPartySlot(this.state);
    if (result === 'Purchased') playSfx('gemSpend');
    if (result === 'NotEnoughGems') this.shake(['Gems']);
    this.notify();
  }

  // --------------------------------------------------------------- heroes

  doPull(): void {
    const before = this.state.heroes.owned.length;
    const result = pull(this.state);
    if (result.result === 'NotEnoughGems') {
      this.shake(['Gems']);
    } else if (result.result === 'Pulled') {
      playSfx('gemSpend');
      if (result.heroId !== null && this.state.heroes.owned.length > before) {
        const hero = HEROES[result.heroId];
        this.queueBanner({
          title: 'A new hero answers!',
          icon: hero.glyph,
          name: hero.name,
          desc: hero.traitText,
          sprite: hero.sprite,
          tone: 'gold',
          sfx: 'chainFinished',
        });
      } else if (result.fragmentsOf !== null) {
        this.toast(`+${result.fragments} ${HEROES[result.fragmentsOf].name} fragments`);
      }
    }
    this.notify();
  }

  doLevelHero(id: HeroId): void {
    const result = levelUpHero(this.state, id);
    if (result === 'Levelled') playSfx('upgradeBought');
    else if (result === 'NotEnoughKnowledge') this.shake(['Knowledge']);
    else if (result === 'TierCapped') this.toast('Raise its tier with Fragments first');
    this.notify();
  }

  doRaiseHeroTier(id: HeroId): void {
    const result = raiseHeroTier(this.state, id);
    if (result === 'Raised') playSfx('upgradeBought');
    else if (result === 'NotEnoughFragments') this.toast('Not enough Fragments yet');
    this.notify();
  }

  doBuySlot(): void {
    const result = buySlot(this.state);
    if (result === 'Purchased') playSfx('gemSpend');
    if (result === 'NotEnoughGems') this.shake(['Gems']);
    this.notify();
  }

  /** Army headroom, for the card's blocked reason. */
  armyRoom(): { used: number; cap: number } {
    return { used: committedArmyPower(this.state), cap: maxArmyPower(this.state) };
  }

  doFinishTraining(district: District): void {
    const result = finishLineWithGems(this.state, district.uniqueId, this.now());
    if (result === 'Success') playSfx('gemSpend');
    else if (result === 'NotEnoughGems') this.shake(['Gems']);
    this.notify();
  }

  doTrain(unitId: TrainableId, at?: District): void {
    const result = trainUnit(this.state, unitId, this.now(), at);
    if (result === 'Queued') playSfx('unitTrained');
    if (result === 'NotEnoughResources') this.shake(['Gold', 'Wood', 'Food']);
    if (result === 'AtMax') this.toast('Population at max — build more Housing');
    if (result === 'NoBuilding' && unitId !== 'Villager') {
      this.toast(
        `Build the ${trainerName(unitId)} first — it is where ${UNITS[unitId].name}s are trained`);
    }
    if (result === 'ArmyAtCapacity') {
      this.toast(`Army at capacity (${committedArmyPower(this.state)}/${maxArmyPower(this.state)}) — build or upgrade a military building`);
    }
    this.notify();
  }

  setOverlay(name: OverlayName | null): void {
    this.openOverlay = name;
    if (name !== null) {
      this.inspectedDistrictId = null;
      this.inspectedSite = null;
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
    this.openOverlay = null;
    this.inspectedDistrictId = null;
    this.inspectedSite = null;
    this.openCheckpoint = null;
    this.notify();
  }

  // ------------------------------------------------------------------- queries

  /** Per-second Build CTA: some uncapped district is affordable AND has a legal cell. */
  buildCtaLit(): boolean {
    return BUILDABLE_DISTRICTS.some((id) => {
      const def = DISTRICTS[id];
      const capped =
        districtCount(this.state, id) >= maxCountForTownhallLevel(def, townhall(this.state).level);
      if (capped) return false;
      const cells = validPlacementCells(this.state, this.map, id);
      if (cells.length === 0) return false;
      return canAfford(this.state.city.wallet, nextBuildCost(this.state, id));
    });
  }

  /** Per-second Research CTA: some tech can be started, or some upgrade
   *  bought. The same shape as `buildCtaLit` — the tab only lights when the
   *  screen behind it has something the player can actually press. */
  researchCtaLit(): boolean {
    return anyResearchActionable(this.state) || anyUpgradeActionable(this.state);
  }

  /** Resource cells a worker building at `cell` (level 1) would capture. */
  /** What a building at `cell` would work. `level` matters for a MOVE: an
   *  upgraded Sawmill keeps its bigger radius when it is picked up, and
   *  previewing it at level 1 would understate the spot it is being moved to. */
  capturedCells(definitionId: DistrictId, cell: Coord, level = 1): Coord[] {
    const def = DISTRICTS[definitionId];
    if (!def.harvestSource || def.influenceRadiusPerLevel.length === 0) return [];
    const radius = levelIndexed(def.influenceRadiusPerLevel, level);
    return cellsWithinRadiusOfRect(this.map, cell, def.size, radius).filter(
      (c) =>
        this.state.fog.revealed[coordKey(c)] === true &&
        harvestSourceAt(this.state, c) === def.harvestSource,
    );
  }

  markers(): MarkerLayer {
    const layer: MarkerLayer = {
      selected: null,
      validCells: [],
      validColor: PALETTE.validTarget,
      influenceCells: [],
      claimedCells: [],
      yieldCells: [],
      previewCell: null,
      previewGlyph: null,
      previewSprite: null,
      previewSize: null,
      selectedSize: null,
      liftedDistrictId: this.mode.kind === 'moving' ? this.mode.districtUniqueId : null,
      hintCell: this.hintCell(),
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
      layer.selected = this.mode.selected;
      layer.selectedSize = def.size;
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
            label: formatAdjacency(g.goldPerMinute),
            tone: g.goldPerMinute < 0 ? 'bad' : 'good',
          });
        }
        if (adj.received !== 0) {
          layer.yieldCells.push({
            cell: this.mode.selected,
            label: formatAdjacency(adj.received),
            tone: adj.received < 0 ? 'bad' : 'good',
          });
        }
      }
      if (this.mode.selected && def.influenceRadiusPerLevel.length > 0) {
        layer.influenceCells = cellsWithinRadiusOfRect(
          this.map, this.mode.selected, def.size, def.influenceRadiusPerLevel[0],
        );
        if (def.harvestSource) {
          const spec = HARVEST[def.harvestSource];
          layer.yieldCells = this.capturedCells(this.mode.definitionId, this.mode.selected).map(
            // The placement preview shows what WORKERS will fetch per delivery.
            (cell) => ({
              cell,
              label: `+${effectiveWorkerYield(this.state, spec)} ${icon(spec.currencyId)}`,
            }),
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
      layer.selected = this.mode.selected;
      layer.selectedSize = def.size;
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
            label: formatAdjacency(g.goldPerMinute),
            tone: g.goldPerMinute < 0 ? 'bad' : 'good',
          });
        }
        if (adj.received !== 0) {
          layer.yieldCells.push({
            cell: this.mode.selected,
            label: formatAdjacency(adj.received),
            tone: adj.received < 0 ? 'bad' : 'good',
          });
        }
        if (def.influenceRadiusPerLevel.length > 0) {
          const district = districtById(this.state, this.mode.districtUniqueId);
          layer.influenceCells = cellsWithinRadiusOfRect(
            this.map, this.mode.selected, def.size,
            levelIndexed(def.influenceRadiusPerLevel, district?.level ?? 1),
          );
          if (def.harvestSource) {
            const spec = HARVEST[def.harvestSource];
            layer.yieldCells = this.capturedCells(
              this.mode.definitionId, this.mode.selected, district?.level ?? 1,
            ).map((cell) => ({
              cell,
              label: `+${effectiveWorkerYield(this.state, spec)} ${icon(spec.currencyId)}`,
            }));
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
        if (active.id === 'Bloom') {
          layer.influenceCells = bloomPreview(
            this.state, this.map, this.mode.selected, active.radius);
        }
        if (active.id === 'Divination') {
          layer.yieldCells = [{
            cell: this.mode.selected,
            label: `${divinationSaving(this.state, this.map, this.mode.selected)} ${icon('Gold')}`,
            tone: 'good',
          }];
        }
      }
    } else if (this.inspectedDistrictId) {
      const district = districtById(this.state, this.inspectedDistrictId);
      if (district) {
        layer.selected = district.location;
        layer.selectedSize = DISTRICTS[district.definitionId].size;
        if (district.state === 'Built') {
          layer.influenceCells = influenceCells(this.map, district);
          layer.claimedCells = this.state.workers
            .filter((w) => w.buildingId === district.uniqueId && w.claimedCell !== null)
            .map((w) => w.claimedCell!);
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
    const total = TRAINING.seconds * 1000;
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

  marketPayout(c: CurrencyId, amount: number): number {
    return salePayout(this.state, c, amount);
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

  handleTap(sx: number, sy: number): void {
    const cell = this.camera.screenToCell(sx, sy);
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
    this.tapChain.dispatch(cell);
  }

  /** The one accessor that knows about the three purses: Gems are the
   *  player's, Knowledge is the kingdom's, everything else is the city's. */
  walletValue(c: CurrencyId): number {
    if (c === 'Gems') return getWallet(this.state.player.wallet, c);
    if (c === 'Knowledge') return getWallet(this.state.kingdom.wallet, c);
    return getWallet(this.state.city.wallet, c);
  }

  // ------------------------------------------------------------------ the HUD

  /** The tech that first makes a currency obtainable — the requiredTech of
   *  whichever district harvests it. Derived rather than listed, so renaming
   *  a tech or moving a resource behind a different one can't desync it. */
  private techForCurrency(c: CurrencyId): TechId | null {
    for (const def of Object.values(DISTRICTS)) {
      if (def.harvestSource && HARVEST[def.harvestSource].currencyId === c) {
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
   * Knowledge is NOT here. It buys heroes and relics and nothing else, so it
   * lives in the Reliquary next to what it pays for — like Fragments, and for
   * the same reason. A coin on the plank is a coin you spend from anywhere.
   */
  visibleCurrencies(): CurrencyId[] {
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

  hudSlot(): { kind: 'population' | 'workers' | 'builders'; value: number; max: number } {
    // Queueing something → builders.
    if (this.openOverlay === 'build' || this.mode.kind === 'placing') {
      const max = builderCount(this.state);
      return { kind: 'builders', value: max - Math.min(this.state.city.queue.length, max), max };
    }
    // Staffing something → workers assigned vs. the whole workforce.
    const inspected = this.inspectedDistrictId === null
      ? undefined
      : districtById(this.state, this.inspectedDistrictId);
    if (inspected && DISTRICTS[inspected.definitionId].maxWorkersPerLevel.length > 0) {
      const working = this.state.city.districts.reduce((n, d) => n + d.assignedWorkers, 0);
      return { kind: 'workers', value: working, max: working + this.freeWorkers() };
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
    this.camera.centerOnCell(hall.location);
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
const TAP_SOUNDS: Record<HarvestSourceId, SfxName> = {
  Forest: 'tapTree',
  Berries: 'tapBerries',
  Crops: 'tapBerries', // same gathering foley until a distinct take lands
  Meat: 'tapAnimals',
  Stone: 'tapStone',
  Iron: 'tapIron',
  Fish: 'tapFish',
};

/** The discovery card for a first-collected resource. */
function resourceBanner(currency: CurrencyId): Banner {
  const def = CURRENCIES[currency];
  const desc = currency === 'Gold'
    ? 'Pays for everything'
    : def.goldValue !== null
      ? `Sells for ${def.goldValue} ${icon('Gold')}`
      : '';
  return { title: 'New resource discovered!', icon: icon(currency), name: currency, desc };
}

/**
 * The card for a landmark or ruin coming into view for the first time.
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
      desc: landmark.defended
        ? 'Something holds it. Clear a path, then clear the guard.'
        : 'Clear a path to it and claim it.',
      sprite: art.sprite,
      tone: 'sky',
    };
  }
  const ruin = Object.values(RUINS).find((r) => r.id === id);
  if (ruin) {
    return {
      title: 'Ruins sighted!',
      icon: ruin.glyph,
      name: ruin.name,
      desc: ruin.description,
      sprite: ruin.sprite,
      tone: 'gold',
    };
  }
  return null;
}

/** "+2 🪙" / "−1 🪙" — the gold/min adjacency modifier, compact. */
export function formatAdjacency(goldPerMinute: number): string {
  const n = Math.abs(Number.isInteger(goldPerMinute)
    ? goldPerMinute : Number(goldPerMinute.toFixed(1)));
  return `${goldPerMinute > 0 ? '+' : '\u2212'}${n} 🪙`;
}

export function icon(c: CurrencyId): string {
  const icons: Record<CurrencyId, string> = {
    Gold: '🪙', Food: '🍎', Wood: '🪵', Stone: '🪨', Mana: '🔮',
    Knowledge: '📜', Gems: '💎',
  };
  return icons[c];
}


/** The building that trains a unit type, by name — for the blocker text. */
function trainerName(unitId: UnitId): string {
  const def = Object.values(DISTRICTS).find((d) => d.trains.includes(unitId));
  return def?.name ?? 'right building';
}


/** Why a launch is blocked, in words the player can act on. */
const LAUNCH_BLOCK_TEXT: Record<LaunchBlock, string> = {
  RuinNotFound: 'You have not found this ruin yet',
  NoHero: 'Pick a hero to lead them',
  HeroBusy: 'That hero is already underground',
  EmptyParty: 'Send at least one unit with them',
  TooManySlots: 'Too many kinds of unit — buy another party slot',
  NotEnoughUnits: 'You do not have that many at home',
  OverArmyCap: 'More than your army can field',
  NotEnoughSupplies: 'Not enough supplies for the trip',
  ArtifactNotOwned: 'You do not have that relic',
  // Naming the passive being given up is the whole point of the message: the
  // choice is the feature, so the refusal has to read as one.
  ArtifactAttuned: 'That relic is attuned — unsocket it from the Reliquary first',
  ArtifactCarried: 'That relic is already with another party',
};

/** How well a unit type answers a ruin's affinity — used only to pre-fill a
 *  sensible party, never to decide anything. */
const scoreAgainst = (unitId: UnitId, affinity: UnitId | 'Any'): number =>
  typeMultiplier(unitId, affinity) * UNITS[unitId].atk;
