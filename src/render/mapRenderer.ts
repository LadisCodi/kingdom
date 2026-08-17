// Canvas 2D world renderer: terrain, fog, resource cells (with exhaustion),
// districts, worker units, bars, markers, floaters. Redraws every frame —
// 155 cells is trivial.

import {
  CROPS_EXHAUSTED_GLYPH, DISTRICTS, FEATURES, HARVEST, TOWNHALL_CYCLE,
} from '../sim/data/definitions';
import { fogState, revealCostForCell } from '../sim/fog';
import type { MapData } from '../sim/grid';
import { harvestSourceAt, recoversAt, tapFraction } from '../sim/harvest';
import { workerPosition } from '../sim/workers';
import {
  queueProgress, remainingSeconds, coordKey, sameCell,
  type Coord, type GameState,
} from '../sim/state';
import type { Camera } from './camera';
import type { Floaters } from './floaters';
import { PALETTE, TERRAIN_COLORS, TILE_SIZE } from './palette';

export interface MarkerLayer {
  selected: Coord | null;
  validCells: Array<{ cell: Coord; label: string }>; // placement or spell targets
  validColor: string;
  influenceCells: Coord[]; // area-of-influence outline
  claimedCells: Coord[]; // cells claimed by the inspected building's workers
  /** Workable cells inside the previewed building's range, with their yield. */
  yieldCells: Array<{ cell: Coord; label: string }>;
  previewCell: Coord | null;
  previewGlyph: string | null;
}

export function drawMap(
  canvas: HTMLCanvasElement,
  camera: Camera,
  state: GameState,
  map: MapData,
  markers: MarkerLayer,
  floaters: Floaters,
  now: number,
): void {
  const dpr = camera.dpr;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PALETTE.fogUndiscovered;
  ctx.fillRect(0, 0, w, h);

  const size = TILE_SIZE * camera.zoom;
  const pad = 1;
  const topLeft = camera.screenToCell(0, 0);
  const bottomRight = camera.screenToCell(w, h);

  const cellRect = (cell: Coord) => camera.cellToScreen(cell);

  // Pass 1: terrain + fog + resource cells + districts.
  for (let cy = topLeft.y - pad; cy <= bottomRight.y + pad; cy++) {
    for (let cx = topLeft.x - pad; cx <= bottomRight.x + pad; cx++) {
      const cell = { x: cx, y: cy };
      const key = coordKey(cell);
      const terrain = map.terrain.get(key);
      if (!terrain) continue;
      const fog = fogState(state, map, cell);
      if (fog === 'Undiscovered') continue; // opaque background already drawn
      const { x, y } = cellRect(cell);

      ctx.fillStyle = TERRAIN_COLORS[terrain];
      ctx.fillRect(x, y, size, size);
      ctx.strokeStyle = PALETTE.gridLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

      const feature = state.features[key];
      const district = state.city.districts.find((d) => sameCell(d.location, cell));
      const source = harvestSourceAt(state, cell);
      const recovery = source !== null ? recoversAt(state, cell, now) : null;
      const exhausted = recovery !== null;

      // Features (Forest): normal or exhausted glyph.
      if (feature && !district) {
        const def = FEATURES[feature];
        drawGlyph(ctx, exhausted ? def.exhaustedGlyph : def.glyph, x, y, size, size * 0.5);
      }

      if (district && fog === 'Revealed') {
        const def = DISTRICTS[district.definitionId];
        drawGlyph(ctx, def.glyph, x, y, size, size * 0.52);
        if (district.state === 'UnderConstruction') {
          ctx.fillStyle = PALETTE.constructionHatch;
          ctx.fillRect(x, y, size, size);
          drawGlyph(ctx, '🚧', x, y - size * 0.22, size, size * 0.3);
        } else {
          if (district.level > 1) {
            ctx.fillStyle = PALETTE.label;
            ctx.font = `${Math.max(9, size * 0.16)}px system-ui`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText(`L${district.level}`, x + size - 3, y + 3);
          }
          // Exhausted crop plot: withered overlay.
          if (district.definitionId === 'FarmLands' && exhausted) {
            drawGlyph(ctx, CROPS_EXHAUSTED_GLYPH, x, y - size * 0.18, size, size * 0.3);
          }
          // Townhall: tax-cycle progress bar.
          if (district.definitionId === 'Townhall' && district.cycleStartedAt !== undefined) {
            const cycleMs = TOWNHALL_CYCLE.cycleSeconds * 1000;
            const progress = Math.min(1, Math.max(0, (now - district.cycleStartedAt) / cycleMs));
            drawBar(ctx, x + size * 0.12, y + size - 7, size * 0.76, 4, progress, PALETTE.progressFill);
          }
          // Needs-workers warning.
          if (def.maxWorkersPerLevel.length > 0 && district.assignedWorkers === 0) {
            drawGlyph(ctx, '⚠️', x + size * 0.28, y - size * 0.26, size, size * 0.26);
          }
        }
      }

      // Resource-cell state: exhaustion dim + recovery countdown, or tap wear.
      if (source !== null && fog === 'Revealed') {
        const spec = HARVEST[source];
        if (exhausted) {
          ctx.fillStyle = PALETTE.exhaustedOverlay;
          ctx.fillRect(x, y, size, size);
          const remaining = (recovery - now) / (spec.recoverySeconds * 1000);
          drawBar(ctx, x + size * 0.15, y + size - 7, size * 0.7, 4, 1 - Math.min(1, remaining), PALETTE.recoveryFill);
        } else {
          const fraction = tapFraction(state, cell, spec, now);
          if (fraction < 1) {
            drawBar(ctx, x + size * 0.15, y + size - 7, size * 0.7, 4, fraction, PALETTE.vaultFill);
          }
        }
      }

      // Active Rain on this cell.
      if (state.activeSpells.some((s) => sameCell(s.cell, cell) && s.expiresAt > now)) {
        drawGlyph(ctx, '🌧️', x + size * 0.3, y - size * 0.28, size, size * 0.28);
      }

      if (fog === 'Discovered') {
        ctx.fillStyle = PALETTE.fogDiscovered;
        ctx.fillRect(x, y, size, size);
        const total = revealCostForCell(map, cell);
        const paid = state.fog.progress[key] ?? 0;
        if (paid > 0) {
          drawBar(ctx, x + size * 0.15, y + size * 0.62, size * 0.7, 5, paid / total, PALETTE.progressFill);
        }
        ctx.fillStyle = PALETTE.label;
        ctx.font = `${Math.max(10, size * 0.2)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🪙${total}`, x + size / 2, y + size * 0.42);
      }
    }
  }

  // Pass 2: queue progress bars over districts.
  for (const item of state.city.queue) {
    const district = state.city.districts.find((d) => d.uniqueId === item.districtUniqueId);
    if (!district) continue;
    const { x, y } = cellRect(district.location);
    const progress = queueProgress(item, now);
    const remaining = Math.ceil(remainingSeconds(item, now));
    drawBar(ctx, x + size * 0.1, y + size * 0.1, size * 0.8, 6, progress, PALETTE.progressFill);
    ctx.fillStyle = PALETTE.label;
    ctx.font = `${Math.max(9, size * 0.15)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(item.startedAt === null ? 'queued' : `${remaining}s`, x + size / 2, y + size * 0.1 + 8);
  }

  // Pass 3: markers.
  // Working-area cells: a white square at 75% of the tile size.
  for (const cell of markers.influenceCells) {
    const { x, y } = cellRect(cell);
    const inset = size * 0.125;
    ctx.strokeStyle = PALETTE.influenceSquare;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + inset, y + inset, size * 0.75, size * 0.75);
  }
  for (const { cell, label } of markers.validCells) {
    if (fogState(state, map, cell) === 'Undiscovered') continue;
    const { x, y } = cellRect(cell);
    ctx.strokeStyle = markers.validColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    if (label) {
      ctx.fillStyle = markers.validColor;
      ctx.font = `${Math.max(9, size * 0.16)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, x + size / 2, y + size - 4);
    }
  }
  for (const cell of markers.claimedCells) {
    const { x, y } = cellRect(cell);
    ctx.strokeStyle = PALETTE.workedTile;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 3, y + 3, size - 6, size - 6);
  }
  // Cells that WILL be worked: green "positive" yield label (the white
  // working-area square is already drawn above).
  for (const { cell, label } of markers.yieldCells) {
    const { x, y } = cellRect(cell);
    ctx.fillStyle = PALETTE.yieldPositive;
    ctx.font = `bold ${Math.max(10, size * 0.18)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, x + size / 2, y + size - 5);
  }
  if (markers.previewCell && markers.previewGlyph) {
    const { x, y } = cellRect(markers.previewCell);
    ctx.globalAlpha = 0.6;
    drawGlyph(ctx, markers.previewGlyph, x, y, size, size * 0.52);
    ctx.globalAlpha = 1;
  }
  if (markers.selected) {
    const { x, y } = cellRect(markers.selected);
    ctx.strokeStyle = PALETTE.selected;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
  }

  // Pass 4: worker units.
  for (const worker of state.workers) {
    const pos = workerPosition(state, worker, now);
    if (!pos) continue;
    const { x, y } = cellRect(pos);
    drawGlyph(ctx, '🧑‍🌾', x + size * 0.18, y + size * 0.18, size * 0.6, size * 0.34);
    if (worker.carrying) {
      drawGlyph(ctx, '🎒', x + size * 0.42, y - size * 0.02, size * 0.5, size * 0.2);
    }
  }

  // Pass 5: floaters.
  for (const f of floaters.alive()) {
    const { x, y } = cellRect(f.cell);
    ctx.globalAlpha = 1 - f.t;
    ctx.fillStyle = f.color ?? PALETTE.floaterText;
    ctx.font = `bold ${Math.max(11, size * 0.22)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, x + size / 2, y + size * 0.3 - f.t * size * 0.5);
    ctx.globalAlpha = 1;
  }
}

function drawGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  x: number,
  y: number,
  size: number,
  fontSize: number,
): void {
  // Emoji ink rarely matches the font's line box, so center on the measured
  // bounding box instead of relying on textBaseline: 'middle'.
  ctx.font = `${fontSize}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(glyph);
  const cx = x + size / 2 + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
  const cy = y + size / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  ctx.fillText(glyph, cx, cy);
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fraction: number,
  color: string,
): void {
  ctx.fillStyle = PALETTE.progressBg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.min(1, Math.max(0, fraction)), h);
}
