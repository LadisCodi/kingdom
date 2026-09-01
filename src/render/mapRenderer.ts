// Canvas 2D world renderer: terrain, fog, resource cells (with exhaustion),
// districts, worker units, bars, markers, floaters. Redraws every frame —
// 155 cells is trivial.

import {
  CROPS_EXHAUSTED_GLYPH, DISTRICTS, FEATURES, HARVEST, TRAINING,
} from '../sim/data/definitions';
import { fogState, revealCostForCell } from '../sim/fog';
import type { MapData } from '../sim/grid';
import { harvestSourceAt, recoversAt, tapFraction } from '../sim/harvest';
import { workerPosition } from '../sim/workers';
import {
  queueProgress, remainingSeconds, coordKey, districtOccupies,
  type Coord, type GameState,
} from '../sim/state';
import type { Camera } from './camera';
import type { Floaters } from './floaters';
import type { TapFx } from './tapFx';
import type { Villagers } from './villagers';
import { PALETTE, TERRAIN_COLORS, TILE_SIZE } from './palette';
import { drawSprite } from './sprites';

export interface MarkerLayer {
  selected: Coord | null;
  selectedSize: { x: number; y: number } | null; // footprint the selection outline spans
  validCells: Array<{ cell: Coord; label: string }>; // valid placement cells
  validColor: string;
  influenceCells: Coord[]; // area-of-influence outline
  claimedCells: Coord[]; // cells claimed by the inspected building's workers
  /** Workable cells inside the previewed building's range, with their yield;
   *  'bad' tone renders the label red (negative adjacency). */
  yieldCells: Array<{ cell: Coord; label: string; tone?: 'good' | 'bad' }>;
  previewCell: Coord | null;
  previewGlyph: string | null;
  previewSprite: string | null;
  previewSize: { x: number; y: number } | null; // footprint of the previewed building
}

export function drawMap(
  canvas: HTMLCanvasElement,
  camera: Camera,
  state: GameState,
  map: MapData,
  markers: MarkerLayer,
  floaters: Floaters,
  villagers: Villagers,
  tapFx: TapFx,
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
  ctx.imageSmoothingEnabled = false; // crisp pixel-art scaling
  ctx.fillStyle = PALETTE.fogUndiscovered;
  ctx.fillRect(0, 0, w, h);

  const size = TILE_SIZE * camera.zoom;
  const pad = 1;
  const topLeft = camera.screenToCell(0, 0);
  const bottomRight = camera.screenToCell(w, h);

  const cellRect = (cell: Coord) => camera.cellToScreen(cell);

  // The per-cell resource-state overlay (exhaustion dim + recovery/tap bar).
  const drawResourceState = (cell: Coord, x: number, y: number) => {
    const source = harvestSourceAt(state, cell);
    if (source === null) return;
    const recovery = recoversAt(state, cell, now);
    const spec = HARVEST[source];
    if (recovery !== null) {
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
  };
  // Tap punch: draw a sprite squashed/stretched about its bottom center
  // (things smoosh into the ground), brightened while the flash lasts.
  const punched = (anchorKey: string, x: number, y: number, w: number, h: number,
    draw: () => void) => {
    const p = tapFx.sample(anchorKey);
    if (!p) {
      draw();
      return;
    }
    ctx.save();
    const cx = x + w / 2;
    const cy = y + h;
    ctx.translate(cx, cy);
    ctx.scale(p.sx, p.sy);
    ctx.translate(-cx, -cy);
    if (p.flash > 0.02) ctx.filter = `brightness(${1 + 2.5 * p.flash})`;
    draw();
    ctx.restore();
  };

  // Pass 1: terrain + fog + features + resource cells. Districts come in a
  // separate pass — a multi-cell sprite drawn here would be overpainted by
  // the terrain fill of the following footprint cells.
  for (let cy = topLeft.y - pad; cy <= bottomRight.y + pad; cy++) {
    for (let cx = topLeft.x - pad; cx <= bottomRight.x + pad; cx++) {
      const cell = { x: cx, y: cy };
      const key = coordKey(cell);
      const terrain = map.terrain.get(key);
      if (!terrain) continue;
      const fog = fogState(state, map, cell);
      if (fog === 'Undiscovered') continue; // opaque background already drawn
      const { x, y } = cellRect(cell);

      // Terrain texture (terrain_<id>.png), flat color while art is missing.
      if (!drawSprite(ctx, `terrain_${terrain.toLowerCase()}`, x, y, size, size)) {
        ctx.fillStyle = TERRAIN_COLORS[terrain];
        ctx.fillRect(x, y, size, size);
      }
      ctx.strokeStyle = PALETTE.gridLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

      const feature = state.features[key];
      const district = state.city.districts.find((d) => districtOccupies(d, cell));
      if (district) continue; // drawn (with its overlays) in the district pass

      // Features (Forest): normal or exhausted sprite, emoji fallback.
      if (feature) {
        const def = FEATURES[feature];
        const exhausted = recoversAt(state, cell, now) !== null;
        punched(key, x, y, size, size, () => {
          if (!drawSprite(ctx, exhausted ? `${def.sprite}_exhausted` : def.sprite, x, y, size, size)) {
            drawGlyph(ctx, exhausted ? def.exhaustedGlyph : def.glyph, x, y, size, size * 0.5);
          }
        });
      }

      if (fog === 'Revealed') drawResourceState(cell, x, y);

      if (fog === 'Discovered') {
        ctx.fillStyle = PALETTE.fogDiscovered;
        ctx.fillRect(x, y, size, size);
        // Reveal progress only — the total cost is deliberately not shown.
        const paid = state.fog.progress[key] ?? 0;
        if (paid > 0) {
          const total = revealCostForCell(map, cell);
          drawBar(ctx, x + size * 0.15, y + size * 0.62, size * 0.7, 5, paid / total, PALETTE.progressFill);
        }
      }
    }
  }

  // Pass 1.5: districts, each drawn once spanning its full footprint.
  for (const district of state.city.districts) {
    if (fogState(state, map, district.location) !== 'Revealed') continue;
    const { x, y } = cellRect(district.location);
    const def = DISTRICTS[district.definitionId];
    const fw = size * def.size.x;
    const fh = size * def.size.y;
    if (x + fw < 0 || y + fh < 0 || x > w || y > h) continue; // offscreen
    const exhausted = recoversAt(state, district.location, now) !== null;
    // Exhausted crop plot gets its own base sprite when available;
    // otherwise the normal sprite (or glyph) plus the withered overlay.
    const exhaustedPlot = district.definitionId === 'FarmLands' &&
      exhausted && district.state !== 'UnderConstruction';
    let drewExhaustedPlot = false;
    punched(coordKey(district.location), x, y, fw, fh, () => {
      drewExhaustedPlot =
        exhaustedPlot && drawSprite(ctx, `${def.sprite}_exhausted`, x, y, fw, fh);
      // Leveled art (`sprite_l2`…) when present, base sprite otherwise.
      if (
        !drewExhaustedPlot &&
        !drawSprite(ctx, `${def.sprite}_l${district.level}`, x, y, fw, fh) &&
        !drawSprite(ctx, def.sprite, x, y, fw, fh)
      ) {
        drawGlyph(ctx, def.glyph, x, y, fw, size * 0.52 * Math.min(def.size.x, def.size.y), fh);
      }
    });
    if (district.state === 'UnderConstruction') {
      ctx.fillStyle = PALETTE.constructionHatch;
      ctx.fillRect(x, y, fw, fh);
      drawGlyph(ctx, '🚧', x, y - fh * 0.22, fw, size * 0.3, fh);
    } else {
      if (district.level > 1) {
        ctx.fillStyle = PALETTE.label;
        ctx.font = `${Math.max(9, size * 0.16)}px system-ui`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(`L${district.level}`, x + fw - 3, y + 3);
      }
      // Exhausted crop plot: withered overlay (unless its sprite covers it).
      if (exhaustedPlot && !drewExhaustedPlot) {
        drawGlyph(ctx, CROPS_EXHAUSTED_GLYPH, x, y - size * 0.18, fw, size * 0.3, fh);
      }
      // A district that is itself a resource cell (FarmLands → Crops,
      // lived-in Housing → Taxes): wear/recovery bar.
      if (def.providesHarvestSource !== null) drawResourceState(district.location, x, y);
      // Townhall: villager-training progress bar.
      if (district.definitionId === 'Townhall' && state.city.training !== null) {
        const totalMs = TRAINING.seconds * 1000;
        const progress = Math.min(1, Math.max(0, (now - state.city.training.startedAt) / totalMs));
        drawBar(ctx, x + fw * 0.12, y + fh - 7, fw * 0.76, 4, progress, PALETTE.progressFill);
      }
      // Needs-workers warning.
      if (def.maxWorkersPerLevel.length > 0 && district.assignedWorkers === 0) {
        drawGlyph(ctx, '⚠️', x + fw * 0.28, y - fh * 0.26, fw, size * 0.26, fh);
      }
    }
  }

  // Pass 2: queue progress bars over districts.
  for (const item of state.city.queue) {
    const district = state.city.districts.find((d) => d.uniqueId === item.districtUniqueId);
    if (!district) continue;
    const { x, y } = cellRect(district.location);
    const fw = size * DISTRICTS[district.definitionId].size.x;
    const progress = queueProgress(item, now);
    const remaining = Math.ceil(remainingSeconds(item, now));
    drawBar(ctx, x + fw * 0.1, y + size * 0.1, fw * 0.8, 6, progress, PALETTE.progressFill);
    ctx.fillStyle = PALETTE.label;
    ctx.font = `${Math.max(9, size * 0.15)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(item.startedAt === null ? 'queued' : `${remaining}s`, x + fw / 2, y + size * 0.1 + 8);
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
  // Cells that WILL be worked: green "positive" yield label on a dark pill
  // (the white working-area square is already drawn above).
  for (const { cell, label, tone } of markers.yieldCells) {
    const { x, y } = cellRect(cell);
    const fontSize = Math.max(10, size * 0.18);
    ctx.font = `bold ${fontSize}px system-ui`;
    const textWidth = ctx.measureText(label).width;
    const padX = fontSize * 0.5;
    const pillW = textWidth + padX * 2;
    const pillH = fontSize * 1.4;
    const pillX = x + size / 2 - pillW / 2;
    const pillY = y + size - 5 - pillH;
    ctx.fillStyle = PALETTE.labelPill;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = tone === 'bad' ? PALETTE.yieldNegative : PALETTE.yieldPositive;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + size / 2, pillY + pillH / 2 + fontSize * 0.05);
  }
  if (markers.previewCell && markers.previewGlyph) {
    const { x, y } = cellRect(markers.previewCell);
    const pw = size * (markers.previewSize?.x ?? 1);
    const ph = size * (markers.previewSize?.y ?? 1);
    ctx.globalAlpha = 0.6;
    // New builds preview at level 1; fall back to the un-leveled sprite.
    if (
      !(markers.previewSprite &&
        (drawSprite(ctx, `${markers.previewSprite}_l1`, x, y, pw, ph) ||
          drawSprite(ctx, markers.previewSprite, x, y, pw, ph)))
    ) {
      drawGlyph(ctx, markers.previewGlyph, x, y, pw, size * 0.52, ph);
    }
    ctx.globalAlpha = 1;
  }
  if (markers.selected) {
    const { x, y } = cellRect(markers.selected);
    const sw = size * (markers.selectedSize?.x ?? 1);
    const sh = size * (markers.selectedSize?.y ?? 1);
    ctx.strokeStyle = PALETTE.selected;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, sw - 3, sh - 3);
  }

  // Pass 3.9: ambient villagers — unassigned population strolling around
  // the Townhall and Housing. Under the workers, so busy people read on top.
  for (const pos of villagers.positions(state, map, now)) {
    const { x, y } = cellRect(pos);
    const sx = x + size * 0.18;
    const sy = y + size * 0.18;
    if (!drawSprite(ctx, 'worker', sx, sy, size * 0.6, size * 0.6)) {
      drawGlyph(ctx, '🧍', sx, sy, size * 0.6, size * 0.34);
    }
  }

  // Pass 4: worker units (sprite with carrying variant, emoji fallback).
  for (const worker of state.workers) {
    const pos = workerPosition(state, worker, now);
    if (!pos) continue;
    const { x, y } = cellRect(pos);
    const sx = x + size * 0.18;
    const sy = y + size * 0.18;
    if (worker.carrying && drawSprite(ctx, 'worker_carrying', sx, sy, size * 0.6, size * 0.6)) {
      continue;
    }
    if (!drawSprite(ctx, 'worker', sx, sy, size * 0.6, size * 0.6)) {
      drawGlyph(ctx, '🧑‍🌾', sx, sy, size * 0.6, size * 0.34);
    }
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
  height = size, // multi-cell footprints center over a non-square box
): void {
  // Emoji ink rarely matches the font's line box, so center on the measured
  // bounding box instead of relying on textBaseline: 'middle'.
  ctx.font = `${fontSize}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(glyph);
  const cx = x + size / 2 + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
  const cy = y + height / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
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
