// Game orchestrator: owns the sim state, UI modes (placement / inspection),
// the tap-handler chain, and change notification.

import {
  advance, canAfford, cancelQueueItem, changeWorkers, collectTap, effectiveAmount,
  enqueueBuild, finishWithGems, townhallTap, upgradeDistrict,
  wakeIdleWorkersAt,
  type AssignWorkerResult, type CollectTapResult, type UpgradeResult,
} from './sim/commands';
import {
  BUILDABLE_DISTRICTS, DISTRICTS, HARVEST, TECHNOLOGIES, TRAINING,
} from './sim/data/definitions';
import {
  buildDurationForCell, districtCount, hasPlacementRestriction,
  maxCountForTownhallLevel, nextBuildCost, validPlacementCells,
} from './sim/districts';
import { fogState, revealCostForCell, revealTap } from './sim/fog';
import { cellsWithinRadiusOfRect, townhallDistance, type MapData } from './sim/grid';
import { harvestSourceAt, isExhausted } from './sim/harvest';
import { armyPower, maxArmyPower, trainUnit } from './sim/army';
import { salePayout, sellGoods } from './sim/market';
import {
  availableWorkers, maxPopulation, populationCost, queuedTraining, queueTraining,
  residentsOf, trainingCompletesAt,
} from './sim/population';
import { buySlot, startTech } from './sim/research';
import { buyUpgrade, effectiveTapYield, effectiveWorkerYield } from './sim/upgrades';
import {
  coordKey, districtAt, districtById, getWallet, townhall,
  type Coord, type CurrencyId, type District, type DistrictId, type GameState,
  type TechId, type UnitId, type UpgradeId,
} from './sim/state';
import { influenceCells, workableCells } from './sim/workers';
import { Camera } from './render/camera';
import { Floaters } from './render/floaters';
import { Villagers } from './render/villagers';
import type { MarkerLayer } from './render/mapRenderer';
import { PALETTE } from './render/palette';
import { TapChain } from './render/tapChain';

export type Mode =
  | { kind: 'normal' }
  | { kind: 'placing'; definitionId: DistrictId; selected: Coord | null };

export class Game {
  mode: Mode = { kind: 'normal' };
  inspectedDistrictId: string | null = null;
  openOverlay: string | null = null; // 'build' | 'army' | 'research'
  readonly floaters = new Floaters();
  readonly villagers = new Villagers();
  readonly tapChain = new TapChain();
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
    for (const fn of this.changeListeners) fn();
  }
  shake(currencies: CurrencyId[]): void {
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
      this.floaters.add(townhall(this.state).location, `+${result.trainedPopulation} 👥`);
    }
    for (const item of result.completedItems) {
      this.toast(item.kind === 'build' ? 'Construction complete!' : 'Upgrade complete!');
    }
    for (const id of result.completedResearch) {
      this.toast(`Research complete: ${TECHNOLOGIES[id].name}!`);
    }
    this.notify();
  }

  // ----------------------------------------------------------------- tap chain

  private registerTapHandlers(): void {
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
        else if (result === 'Revealed') {
          wakeIdleWorkersAt(this.state, this.now()); // new cells may be claimable
          this.floaters.add(cell, 'Revealed!');
        } else if (result === 'Paid') {
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
        // Townhall: tapping adds cycle progress (and opens/keeps its card).
        if (district?.definitionId === 'Townhall' && district.state === 'Built') {
          const tap = townhallTap(this.state, this.now());
          if (tap === 'TrainingComplete') this.floaters.add(cell, '+1 👥');
          else if (tap === 'Boosted') this.floaters.add(cell, '⏩');
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

  /** One cooldown-gated collect on a resource cell, with feedback.
   *  'OnCooldown' is silent — hold-to-collect retries until the gate opens. */
  private collectAt(cell: Coord): CollectTapResult {
    const source = harvestSourceAt(this.state, cell);
    const result = collectTap(this.state, this.map, cell, this.now());
    if (result === 'Harvested' && source) {
      const spec = HARVEST[source];
      this.floaters.add(cell, `+${effectiveTapYield(this.state, spec)} ${icon(spec.currencyId)}`);
    } else if (result === 'Exhausted') {
      this.floaters.add(cell, '💤');
    }
    return result;
  }

  /** Held pointer: repeat COLLECT taps only (never reveal/inspect/place). */
  handleHold(sx: number, sy: number): void {
    if (this.mode.kind !== 'normal' || this.openOverlay !== null) return;
    const cell = this.camera.screenToCell(sx, sy);
    if (!this.map.terrain.has(coordKey(cell))) return;
    if (harvestSourceAt(this.state, cell) === null) return;
    if (!this.state.fog.revealed[coordKey(cell)]) return;
    if (isExhausted(this.state, cell, this.now())) return; // quiet — no 💤 spam
    if (this.collectAt(cell) === 'Harvested') this.notify();
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

  confirmBuild(): void {
    if (this.mode.kind !== 'placing' || !this.mode.selected) return;
    const { definitionId, selected } = this.mode;
    const cost = nextBuildCost(this.state, definitionId);
    const result = enqueueBuild(this.state, this.map, definitionId, selected);
    if (result === 'Started') {
      this.mode = { kind: 'normal' };
    } else if (result === 'NotEnoughResources') {
      this.shake(Object.keys(cost) as CurrencyId[]);
    } else {
      this.toast(result === 'QueueFull' ? 'Build queue is full' : result);
    }
    this.notify();
  }

  // -------------------------------------------------------------- UI commands

  doSell(c: CurrencyId, amount: number): void {
    const { result, gold } = sellGoods(this.state, c, amount);
    if (result === 'Sold') {
      const market = this.state.city.districts.find(
        (d) => d.definitionId === 'Market' && d.state === 'Built');
      if (market) this.floaters.add(market.location, `+${gold} ${icon('Gold')}`);
    }
    this.notify();
  }

  doQueueTraining(): void {
    const result = queueTraining(this.state, this.now());
    if (result === 'NotEnoughResources') this.shake(['Food']);
    else if (result === 'AtMax') this.toast('Population at max — build more Housing');
    this.notify();
  }

  doChangeWorkers(districtId: string, delta: 1 | -1): AssignWorkerResult {
    const result = changeWorkers(this.state, this.map, districtId, delta, this.now());
    if (result === 'NoMoreTiles') this.toast('No more cells available to work');
    if (result === 'NoFreeWorkers') this.toast('No free workers — buy population');
    this.notify();
    return result;
  }

  doUpgrade(districtId: string): UpgradeResult {
    const result = upgradeDistrict(this.state, districtId);
    if (result === 'NotEnoughResources') {
      const d = districtById(this.state, districtId)!;
      this.shake(Object.keys(DISTRICTS[d.definitionId].upgradeCost) as CurrencyId[]);
    } else if (result !== 'Started') {
      this.toast(result);
    }
    this.notify();
    return result;
  }

  doRush(itemId: string): void {
    const result = finishWithGems(this.state, this.map, itemId, this.now());
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
    if (result === 'NotEnoughResources') this.shake(['Gold']);
    this.notify();
  }

  doBuySlot(): void {
    const result = buySlot(this.state);
    if (result === 'NotEnoughGems') this.shake(['Gems']);
    this.notify();
  }

  doTrain(unitId: UnitId): void {
    const result = trainUnit(this.state, unitId);
    if (result === 'NotEnoughResources') this.shake(['Gold', 'Wood', 'Food']);
    if (result === 'ArmyAtCapacity') this.toast(`Army at capacity (${armyPower(this.state)}/${maxArmyPower(this.state)})`);
    this.notify();
  }

  setOverlay(name: string | null): void {
    this.openOverlay = name;
    if (name !== null) this.inspectedDistrictId = null;
    this.notify();
  }

  /** True when the navbar should show a single Close button instead of the tabs. */
  dismissible(): boolean {
    return (
      this.mode.kind !== 'normal' || this.openOverlay !== null || this.inspectedDistrictId !== null
    );
  }

  /** The one Close affordance: dismiss whatever menu, panel, or mode is on screen. */
  dismiss(): void {
    this.mode = { kind: 'normal' };
    this.openOverlay = null;
    this.inspectedDistrictId = null;
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

  /** Resource cells a worker building at `cell` (level 1) would capture. */
  capturedCells(definitionId: DistrictId, cell: Coord): Coord[] {
    const def = DISTRICTS[definitionId];
    if (!def.harvestSource || def.influenceRadiusPerLevel.length === 0) return [];
    return cellsWithinRadiusOfRect(this.map, cell, def.size, def.influenceRadiusPerLevel[0]).filter(
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
    return revealCostForCell(this.map, cell);
  }

  placementInfo(): {
    definitionId: DistrictId;
    cell: Coord | null;
    cost: ReturnType<typeof nextBuildCost>;
    duration: number;
    affordable: boolean;
    captured: number;
  } | null {
    if (this.mode.kind !== 'placing') return null;
    const { definitionId, selected } = this.mode;
    if (!selected) {
      return { definitionId, cell: null, cost: {}, duration: 0, affordable: false, captured: 0 };
    }
    const cost = nextBuildCost(this.state, definitionId);
    return {
      definitionId,
      cell: selected,
      cost,
      duration: buildDurationForCell(this.state, definitionId, selected, this.map),
      affordable: canAfford(this.state.city.wallet, cost),
      captured: this.capturedCells(definitionId, selected).length,
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
    const completesAt = trainingCompletesAt(this.state);
    const total = TRAINING.seconds * 1000;
    const queued = queuedTraining(this.state);
    return {
      active: completesAt !== null,
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

  handleTap(sx: number, sy: number): void {
    const cell = this.camera.screenToCell(sx, sy);
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

  walletValue(c: CurrencyId): number {
    if (c === 'Gems') return getWallet(this.state.player.wallet, c);
    if (c === 'Knowledge') return getWallet(this.state.kingdom.wallet, c);
    return getWallet(this.state.city.wallet, c);
  }

  /** Widget value: base amount plus everything that counts as it (Food shows
   *  Food + Berries + Meat×3). Same number every Food cost checks against. */
  effectiveWalletValue(c: CurrencyId): number {
    if (c === 'Gems') return getWallet(this.state.player.wallet, c);
    if (c === 'Knowledge') return getWallet(this.state.kingdom.wallet, c);
    return effectiveAmount(this.state.city.wallet, c);
  }
}

export function icon(c: CurrencyId): string {
  const icons: Record<CurrencyId, string> = {
    Gold: '🪙', Food: '🍎', Wood: '🪵', Berries: '🫐', Meat: '🍖',
    Knowledge: '📜', Gems: '💎',
  };
  return icons[c];
}
