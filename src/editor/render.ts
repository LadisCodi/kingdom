// The editor's view of the map.
//
// Deliberately the game's own sprites and the game's own camera: the whole
// point of painting instead of typing letters into a spreadsheet is seeing
// what the player will see, so anything that renders differently here than in
// the game is a bug in this file. What is added on top — distances, ring
// bands, warnings — is strictly overlay, drawn above the world and toggled
// off by default so the base view stays honest.

import { Camera } from '../render/camera';
import { PALETTE, TERRAIN_COLORS, TILE_SIZE } from '../render/palette';
import { drawSprite } from '../render/sprites';
import { DISTRICTS, FEATURES, LANDMARK_ART, RUINS } from '../sim/data/definitions';
import { TOWNHALL_FOOTPRINT } from '../sim/data/mapRules';
import { coordKey, type Coord, type LandmarkKind, type RuinId } from '../sim/state';
import type { MapDoc } from './doc';

export interface Overlays {
  grid: boolean;
  distance: boolean;
  rings: boolean;
  warnings: boolean;
  sites: boolean;
}

export interface ViewState {
  /** The cell under the pointer, or null when the pointer is off-canvas. */
  hover: Coord | null;
  /** Cells the current gesture would touch (brush footprint or rect drag). */
  preview: ReadonlyArray<Coord>;
  /** The selected site, drawn with a ring and always labelled. */
  selected: { kind: 'landmark' | 'ruin'; id: string } | null;
}

const RING_HUES = [180, 150, 110, 80, 55, 35, 20, 5, 340, 315, 290];

const ringColor = (d: number, alpha: number): string =>
  `hsla(${RING_HUES[Math.min(d, RING_HUES.length - 1)]}, 70%, 50%, ${alpha})`;

export function drawEditor(
  canvas: HTMLCanvasElement,
  camera: Camera,
  doc: MapDoc,
  overlays: Overlays,
  view: ViewState,
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
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0b0e13';
  ctx.fillRect(0, 0, w, h);

  const size = TILE_SIZE * camera.zoom;
  const map = doc.map;
  const topLeft = camera.screenToCell(0, 0);
  const bottomRight = camera.screenToCell(w, h);

  // Void grid, so the empty space you can paint into reads as canvas rather
  // than as the end of the world.
  if (overlays.grid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = topLeft.x; x <= bottomRight.x + 1; x++) {
      const sx = Math.round(camera.cellToScreen({ x, y: 0 }).x) + 0.5;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
    }
    for (let y = topLeft.y; y <= bottomRight.y + 1; y++) {
      const sy = Math.round(camera.cellToScreen({ x: 0, y }).y) + 0.5;
      ctx.moveTo(0, sy); ctx.lineTo(w, sy);
    }
    ctx.stroke();
  }

  // --------------------------------------------------------------- world
  const warned = overlays.warnings ? warnedCells(doc) : null;

  for (let y = topLeft.y; y <= bottomRight.y; y++) {
    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      const cell = { x, y };
      const key = coordKey(cell);
      const terrain = map.terrain.get(key);
      if (terrain === undefined) continue;
      const { x: sx, y: sy } = camera.cellToScreen(cell);

      if (!drawSprite(ctx, `terrain_${terrain.toLowerCase()}`, sx, sy, size, size)) {
        ctx.fillStyle = TERRAIN_COLORS[terrain];
        ctx.fillRect(sx, sy, size, size);
      }

      if (overlays.rings) {
        ctx.fillStyle = ringColor(map.distanceFromTownhall.get(key) ?? 0, 0.4);
        ctx.fillRect(sx, sy, size, size);
      }

      const feature = map.initialFeatures.get(key);
      if (feature !== undefined) {
        if (!drawSprite(ctx, FEATURES[feature].sprite, sx, sy, size, size)) {
          glyph(ctx, FEATURES[feature].glyph, sx, sy, size);
        }
      }

      if (warned?.has(key)) {
        ctx.fillStyle = 'rgba(255, 70, 70, 0.35)';
        ctx.fillRect(sx, sy, size, size);
        hatch(ctx, sx, sy, size, 'rgba(255,120,120,0.8)');
      }

      if (overlays.grid) {
        ctx.strokeStyle = PALETTE.gridLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(sx) + 0.5, Math.round(sy) + 0.5, size, size);
      }
    }
  }

  // ------------------------------------------------------------ Townhall
  // Not editable and not optional, but the single most important thing to see
  // while painting: every fog price on the map is a distance from this.
  {
    const anchor = camera.cellToScreen({ x: 0, y: 0 });
    const span = DISTRICTS.Townhall.size;
    if (!drawSprite(ctx, 'townhall_l1', anchor.x, anchor.y, size * span.x, size * span.y)) {
      ctx.fillStyle = 'rgba(220,180,90,0.8)';
      ctx.fillRect(anchor.x, anchor.y, size * span.x, size * span.y);
    }
    ctx.strokeStyle = '#ffd970';
    ctx.lineWidth = 2;
    ctx.strokeRect(anchor.x, anchor.y, size * span.x, size * span.y);
  }

  // --------------------------------------------------------------- sites
  if (overlays.sites) {
    for (const l of doc.landmarks) {
      const art = LANDMARK_ART[l.kind as LandmarkKind];
      const picked = view.selected?.kind === 'landmark' && view.selected.id === l.id;
      drawSite(ctx, camera, l, size, art?.sprite ?? '', art?.glyph ?? '❔', l.id, picked,
        l.defended ? '#ff9d5a' : '#8fe08f');
    }
    for (const [id, r] of Object.entries(doc.ruins)) {
      const art = RUINS[id as RuinId];
      const picked = view.selected?.kind === 'ruin' && view.selected.id === id;
      drawSite(ctx, camera, r, size, art?.sprite ?? '', art?.glyph ?? '❔',
        `${id} · T${r.tier}`, picked, '#c79bff');
    }
  }

  // ------------------------------------------------------------ distance
  // Two numbers per cell only make sense when they can be read; below that
  // zoom the ring bands carry the same information as colour.
  if (overlays.distance && size >= 34) {
    ctx.textAlign = 'center';
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      for (let x = topLeft.x; x <= bottomRight.x; x++) {
        const key = coordKey({ x, y });
        if (!map.terrain.has(key)) continue;
        const d = map.distanceFromTownhall.get(key) ?? 0;
        const { x: sx, y: sy } = camera.cellToScreen({ x, y });
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(sx + 1, sy + size - 17, size - 2, 16);
        ctx.font = `${Math.max(9, Math.round(size * 0.16))}px ui-monospace, monospace`;
        ctx.fillStyle = d === 0 && !isTownhall(x, y) ? '#ff9a9a' : '#e7eef7';
        ctx.fillText(`${d} · ${doc.costAt({ x, y })}g`, sx + size / 2, sy + size - 5);
      }
    }
    ctx.textAlign = 'start';
  }

  // ------------------------------------------------------------- cursor
  for (const cell of view.preview) {
    const { x: sx, y: sy } = camera.cellToScreen(cell);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(sx) + 1, Math.round(sy) + 1, size - 2, size - 2);
  }
  if (view.hover) {
    const { x: sx, y: sy } = camera.cellToScreen(view.hover);
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(sx) + 1, Math.round(sy) + 1, size - 2, size - 2);
  }
}

function drawSite(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  at: { x: number; y: number },
  size: number,
  sprite: string,
  fallback: string,
  label: string,
  selected: boolean,
  tint: string,
): void {
  const { x: sx, y: sy } = camera.cellToScreen(at);
  if (!drawSprite(ctx, sprite, sx, sy, size, size)) glyph(ctx, fallback, sx, sy, size);

  ctx.strokeStyle = selected ? '#ffffff' : tint;
  ctx.lineWidth = selected ? 3 : 2;
  ctx.strokeRect(Math.round(sx) + 1, Math.round(sy) + 1, size - 2, size - 2);

  if (!selected && size < 46) return; // labels would just be noise
  const font = `${Math.max(9, Math.round(size * 0.17))}px ui-sans-serif, system-ui, sans-serif`;
  ctx.font = font;
  const width = ctx.measureText(label).width + 8;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(sx + size / 2 - width / 2, sy - 17, width, 15);
  ctx.fillStyle = selected ? '#ffffff' : tint;
  ctx.textAlign = 'center';
  ctx.fillText(label, sx + size / 2, sy - 6);
  ctx.textAlign = 'start';
}

const glyph = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) => {
  ctx.font = `${Math.round(size * 0.6)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size / 2, y + size / 2);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
};

function hatch(
  ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = -size; i < size; i += 8) {
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + size, y + size);
  }
  ctx.stroke();
  ctx.restore();
}

const isTownhall = (x: number, y: number): boolean =>
  TOWNHALL_FOOTPRINT.some((c) => c.x === x && c.y === y);

/** Every cell an issue points at, so a warning is somewhere you can SEE
 *  rather than a line of text about coordinates. */
function warnedCells(doc: MapDoc): Set<string> {
  const out = new Set<string>();
  const { errors, warnings } = doc.validation;
  for (const issue of [...errors, ...warnings]) {
    if (issue.cell) out.add(coordKey(issue.cell));
  }
  // The stranded-land warning names one example cell; colour them all in.
  const map = doc.map;
  for (const [key, terrain] of map.terrain) {
    if (terrain === 'Water') continue;
    const d = map.distanceFromTownhall.get(key) ?? 0;
    if (d === 0 && !isTownhall(...(key.split(',').map(Number) as [number, number]))) out.add(key);
  }
  return out;
}
