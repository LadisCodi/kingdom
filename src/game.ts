// Game orchestrator: owns the sim state, UI modes (placement / spell
// targeting / inspection), the tap-handler chain, and change notification.

import {
  canAfford, cancelQueueItem, changeWorkers, collectFromDistrict, enqueueBuild,
  finishWithGems, tick, upgradeDistrict,
  type AssignWorkerResult, type UpgradeResult,
} from './sim/commands';
import { BUILDABLE_DISTRICTS, DISTRICTS, SPELLS } from './sim/data/definitions';
import {
  buildCostForCell, buildDurationForCell, districtCount, maxCountForTownhallLevel,
  validPlacementCells,
} from './sim/districts';
import { fogState, revealCostForCell, revealTap } from './sim/fog';
import { townhallDistance, type MapData } from './sim/grid';
import { armyPower, maxArmyPower, trainUnit } from './sim/army';
import { buyPopulation } from './sim/population';
import { recalculateCityProduction } from './sim/recalc';
import { canTarget, castSpell } from './sim/spells';
import {
  coordKey, districtAt, getWallet, townhall,
  type Coord, type CurrencyId, type DistrictId, type GameState, type SpellId, type UnitId,
} from './sim/state';
import { Camera } from './render/camera';
import { Floaters } from './render/floaters';
import type { MarkerLayer } from './render/mapRenderer';
import { PALETTE } from './render/palette';
import { TapChain } from './render/tapChain';
import { staffedWorkedCells } from './sim/workedUnits';

export type Mode =
  | { kind: 'normal' }
  | { kind: 'placing'; definitionId: DistrictId; selected: Coord | null }
  | { kind: 'targeting'; spellId: SpellId };

export class Game {
  mode: Mode = { kind: 'normal' };
  inspectedDistrictId: string | null = null;
  openOverlay: string | null = null; // 'build' | 'spellbook' | 'army' | 'research'
  readonly floaters = new Floaters();
  readonly tapChain = new TapChain();
  private changeListeners: Array<() => void> = [];
  private shakeListeners: Array<(c: CurrencyId[]) => void> = [];
  private toastListeners: Array<(msg: string) => void> = [];
  readonly rng = Math.random;

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
    const result = tick(this.state, this.map, this.now(), this.rng);
    for (const [districtId, report] of result.production) {
      const district = this.state.city.districts.find((d) => d.uniqueId === districtId);
      if (district) {
        for (const [c, n] of Object.entries(report)) this.floaters.add(district.location, `+${n} ${icon(c as CurrencyId)}`);
      }
    }
    for (const item of result.completedItems) {
      this.toast(item.kind === 'build' ? 'Construction complete!' : 'Upgrade complete!');
    }
    for (const cell of result.regrownCells) this.floaters.add(cell, 'Grow trees 🌲');
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
    // 200 — spell targeting.
    this.tapChain.register({
      priority: 200,
      handle: (cell) => {
        if (this.mode.kind !== 'targeting') return false;
        const spellId = this.mode.spellId;
        if (canTarget(this.state, spellId, cell)) {
          const result = castSpell(this.state, this.map, spellId, cell, this.now(), this.rng);
          if (result === 'Cast') {
            this.floaters.add(cell, SPELLS[spellId].glyph);
            if (SPELLS[spellId].levels[0].durationSeconds === 0 && this.mode.kind === 'targeting') {
              // Instant spells (Tap) stay in targeting mode — they're stackable.
            } else {
              this.mode = { kind: 'normal' };
            }
          } else if (result === 'NotEnoughMana') {
            this.shake(['Mana']);
          } else {
            this.toast(result);
          }
          this.notify();
        }
        return true; // swallow taps outside valid cells
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
        if (result === 'NotEnoughSilver') this.shake(['Silver']);
        else if (result === 'Revealed') {
          recalculateCityProduction(this.state, this.map, this.now(), this.rng);
          this.floaters.add(cell, 'Revealed!');
        } else if (result === 'Paid') {
          this.floaters.add(cell, `-1 🪙`);
        }
        this.notify();
        return true;
      },
    });
    // 0 — cell info / vault collection.
    this.tapChain.register({
      priority: 0,
      handle: (cell) => {
        const district = districtAt(this.state, cell);
        if (district) {
          const collected = collectFromDistrict(this.state, district.uniqueId);
          for (const c of Object.keys(collected)) {
            this.floaters.add(cell, `+1 ${icon(c as CurrencyId)}`);
          }
          this.inspectedDistrictId = district.uniqueId; // open/switch the card
        } else {
          this.inspectedDistrictId = null; // empty ground closes the card
        }
        this.notify();
        return true;
      },
    });
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
    const cost = buildCostForCell(this.state, definitionId, selected, this.map);
    const result = enqueueBuild(this.state, this.map, definitionId, selected, this.now(), this.rng);
    if (result === 'Started') {
      this.mode = { kind: 'normal' };
    } else if (result === 'NotEnoughResources') {
      this.shake(Object.keys(cost) as CurrencyId[]);
    } else {
      this.toast(result === 'QueueFull' ? 'Build queue is full' : result);
    }
    this.notify();
  }

  cancelPlacement(): void {
    this.mode = { kind: 'normal' };
    this.notify();
  }

  // ------------------------------------------------------------ targeting mode

  startTargeting(spellId: SpellId): void {
    this.mode = { kind: 'targeting', spellId };
    this.openOverlay = null;
    this.inspectedDistrictId = null;
    this.notify();
  }

  cancelTargeting(): void {
    this.mode = { kind: 'normal' };
    this.notify();
  }

  // -------------------------------------------------------------- UI commands

  doBuyPopulation(): void {
    const result = buyPopulation(this.state);
    if (result === 'Success') {
      recalculateCityProduction(this.state, this.map, this.now(), this.rng);
    } else if (result === 'NotEnoughResources') {
      this.shake(['Food']);
    } else {
      this.toast('Population at max — build more Housing');
    }
    this.notify();
  }

  doChangeWorkers(districtId: string, delta: 1 | -1): AssignWorkerResult {
    const result = changeWorkers(this.state, this.map, districtId, delta, this.now(), this.rng);
    if (result === 'NoMoreTiles') this.toast('No more tiles available to work');
    if (result === 'NoFreeWorkers') this.toast('No free workers — buy population');
    this.notify();
    return result;
  }

  doUpgrade(districtId: string): UpgradeResult {
    const result = upgradeDistrict(this.state, districtId);
    if (result === 'NotEnoughResources') {
      const d = this.state.city.districts.find((x) => x.uniqueId === districtId)!;
      this.shake(Object.keys(DISTRICTS[d.definitionId].upgradeCost) as CurrencyId[]);
    } else if (result !== 'Started') {
      this.toast(result);
    }
    this.notify();
    return result;
  }

  doRush(itemId: string): void {
    const result = finishWithGems(this.state, this.map, itemId, this.now(), this.rng);
    if (result === 'NotEnoughGems') this.shake(['Gems']);
    this.notify();
  }

  doCancelItem(itemId: string): void {
    cancelQueueItem(this.state, this.map, itemId);
    this.inspectedDistrictId = null;
    this.notify();
  }

  doTrain(unitId: UnitId): void {
    const result = trainUnit(this.state, unitId);
    if (result === 'NotEnoughResources') this.shake(['Silver', 'Wood', 'Food']);
    if (result === 'ArmyAtCapacity') this.toast(`Army at capacity (${armyPower(this.state)}/${maxArmyPower(this.state)})`);
    this.notify();
  }

  setOverlay(name: string | null): void {
    this.openOverlay = name;
    if (name !== null) this.inspectedDistrictId = null;
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
      const cost = buildCostForCell(this.state, id, cells[0], this.map);
      return canAfford(this.state.city.wallet, cost);
    });
  }

  markers(): MarkerLayer {
    const layer: MarkerLayer = {
      selected: null,
      validCells: [],
      validColor: PALETTE.validTarget,
      workedCells: [],
      previewCell: null,
      previewGlyph: null,
    };
    if (this.mode.kind === 'placing') {
      const def = DISTRICTS[this.mode.definitionId];
      const yieldLabel = Object.entries(def.baseGeneration)
        .map(([c, n]) => `+${n}${icon(c as CurrencyId)}`)
        .join(' ');
      layer.validCells = validPlacementCells(this.state, this.map, this.mode.definitionId).map(
        (cell) => ({ cell, label: yieldLabel }),
      );
      layer.selected = this.mode.selected;
      layer.previewCell = this.mode.selected;
      layer.previewGlyph = def.glyph;
    } else if (this.mode.kind === 'targeting') {
      const spellId = this.mode.spellId;
      layer.validColor = PALETTE.spellTarget;
      layer.validCells = this.map.cells
        .filter((c) => canTarget(this.state, spellId, c))
        .map((cell) => ({ cell, label: SPELLS[spellId].glyph }));
    } else if (this.inspectedDistrictId) {
      const district = this.state.city.districts.find(
        (d) => d.uniqueId === this.inspectedDistrictId,
      );
      if (district) {
        layer.selected = district.location;
        layer.workedCells = staffedWorkedCells(this.state, this.map, district);
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
    cost: ReturnType<typeof buildCostForCell>;
    duration: number;
    affordable: boolean;
  } | null {
    if (this.mode.kind !== 'placing') return null;
    const { definitionId, selected } = this.mode;
    if (!selected) return { definitionId, cell: null, cost: {}, duration: 0, affordable: false };
    const cost = buildCostForCell(this.state, definitionId, selected, this.map);
    return {
      definitionId,
      cell: selected,
      cost,
      duration: buildDurationForCell(this.state, definitionId, selected, this.map),
      affordable: canAfford(this.state.city.wallet, cost),
    };
  }

  freeWorkers(): number {
    let assigned = 0;
    for (const d of this.state.city.districts) assigned += d.assignedWorkers;
    return this.state.city.population - assigned;
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
    if (c === 'Mana' || c === 'Gold' || c === 'Knowledge') return getWallet(this.state.kingdom.wallet, c);
    return getWallet(this.state.city.wallet, c);
  }
}

export function icon(c: CurrencyId): string {
  const icons: Record<CurrencyId, string> = {
    Food: '🍎', Silver: '🪙', Wood: '🪵', Gold: '🏅', Mana: '💧', Knowledge: '📜', Gems: '💎',
  };
  return icons[c];
}
