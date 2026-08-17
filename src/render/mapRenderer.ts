// Canvas 2D world renderer: terrain, fog, features, districts, bars, markers,
// floaters. Redraws every frame — 155 cells is trivial.

import { DISTRICTS, FEATURES } from '../sim/data/definitions';
import { vaultFillFraction } from '../sim/economy';
import { fogState, revealCostForCell } from '../sim/fog';
import type { MapData } from '../sim/grid';
import { queueProgress, remainingSeconds, coordKey, type Coord, type GameState } from '../sim/state';
import type { Camera } from './camera';
import type { Floaters } from './floaters';
import { PALETTE, TERRAIN_COLORS, TILE_SIZE } from './palette';

export interface MarkerLayer {
  selected: Coord | null;
  validCells: Array<{ cell: Coord; label: string }>; // placement or spell targets
  validColor: string;
  workedCells: Coord[];
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

  // Pass 1: terrain + fog + features + districts.
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
      const district = state.city.districts.find(
        (d) => d.location.x === cx && d.location.y === cy,
      );

      if (feature && !district) {
        drawGlyph(ctx, FEATURES[feature.featureId].glyph, x, y, size, size * 0.5);
      }

      if (district && fog === 'Revealed') {
        const def = DISTRICTS[district.definitionId];
        drawGlyph(ctx, def.glyph, x, y, size, size * 0.52);
        if (district.state === 'UnderConstruction') {
          ctx.fillStyle = PALETTE.constructionHatch;
          ctx.fillRect(x, y, size, size);
          drawGlyph(ctx, '🚧', x, y - size * 0.22, size, size * 0.3);
        } else {
          // Level pips.
          if (district.level > 1) {
            ctx.fillStyle = PALETTE.label;
            ctx.font = `${Math.max(9, size * 0.16)}px system-ui`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText(`L${district.level}`, x + size - 3, y + 3);
          }
          // Vault bar.
          const fill = vaultFillFraction(district.generators);
          if (fill > 0) {
            drawBar(ctx, x + size * 0.12, y + size - 7, size * 0.76, 4, fill,
              fill >= 1 ? PALETTE.vaultFull : PALETTE.vaultFill);
          }
          // Needs-workers warning.
          const usesWorkers = def.maxWorkersPerLevel.length > 0;
          if (usesWorkers && district.assignedWorkers === 0) {
            drawGlyph(ctx, '⚠️', x + size * 0.28, y - size * 0.26, size, size * 0.26);
          }
        }
      }

      if (fog === 'Discovered') {
        ctx.fillStyle = PALETTE.fogDiscovered;
        ctx.fillRect(x, y, size, size);
        // Reveal cost / partial progress.
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
  for (const cell of markers.workedCells) {
    const { x, y } = cellRect(cell);
    ctx.strokeStyle = PALETTE.workedTile;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 3, y + 3, size - 6, size - 6);
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

  // Pass 4: floaters.
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
  ctx.font = `${fontSize}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, x + size / 2, y + size / 2 + fontSize * 0.06);
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
