// The editor's view of the map.
//
// Deliberately the game's own sprites, the game's own isometric camera and
// the game's own drawing rules: the ground is the terrain's square of
// material laid on its diamond with the same per-cell variant and the same
// fringes where two terrains meet (src/render/terrain.ts), and everything
// that stands — features, landmarks, lairs, the Townhall — is drawn with its
// feet on its plot's bottom corner and painted back to front, exactly as
// src/render/mapRenderer.ts does. The whole point of painting instead of
// typing letters into a spreadsheet is seeing what the player will see, so
// anything that renders differently here than in the game is a bug in this
// file.
//
// What is added on top — the grid, distances, ring bands, warnings, site
// outlines — is strictly overlay, drawn as diamonds over the world and
// toggleable, so the base view stays honest. The one thing deliberately not
// reproduced is the fog: the editor shows the province revealed, since a
// cell you cannot see is a cell you cannot paint.

import type { Camera, PlotBox } from '../render/camera';
import {
  diamondPath, drawGround, drawStanding, FEATURE_PLOTS, featurePlots, fillDiamond, strokeDiamond,
} from '../render/iso';
import { PALETTE, TERRAIN_COLORS } from '../render/palette';
import { drawTerrainFringes, terrainKey, variantKey } from '../render/terrain';
import { DISTRICTS, FEATURES, LANDMARK_ART, LAIRS } from '../sim/data/definitions';
import { TOWNHALL_FOOTPRINT } from '../sim/data/mapRules';
import { footprintAt } from '../sim/grid';
import { coordKey, type Coord, type LandmarkKind, type LairId } from '../sim/state';
import type { MapDoc, SiteKind } from './doc';

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
  selected: { kind: SiteKind; id: string } | null;
}

const RING_HUES = [180, 150, 110, 80, 55, 35, 20, 5, 340, 315, 290];

const ringColor = (d: number, alpha: number): string =>
  `hsla(${RING_HUES[Math.min(d, RING_HUES.length - 1)]}, 70%, 50%, ${alpha})`;

/** Void: where there is no cell at all. Darker than the game's undiscovered
 *  fog on purpose — fog is ground you have not paid for, void is no ground. */
const VOID = '#0b0e13';

/** One thing that stands on the ground, queued for the back-to-front pass. */
interface Standing {
  depth: number;
  tie: number;
  draw: () => void;
}

/** A site's label, hung over its art once everything is drawn. */
interface SiteLabel {
  plot: PlotBox;
  tall: number;
  text: string;
  selected: boolean;
  tint: string;
}

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
  // Smoothing on, as in the game: the art is authored at twice the size it
  // is drawn at, and nearest neighbour on a downscale is aliasing.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, w, h);

  const map = doc.map;
  const unit = camera.unit;
  // Margin of two: a tree's canvas is two plots wide, and a hall's art rises
  // well above its plot, so a cell just off-screen still draws into it.
  const vis = camera.visibleCells(2);
  const box = (cell: Coord) => camera.cellToScreen(cell);
  const base = (b: PlotBox) => ({ x: b.x + b.w / 2, y: b.y + b.h });

  // Void grid, so the empty space you can paint into reads as canvas rather
  // than as the end of the world. Batched into one path.
  if (overlays.grid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = vis.y0; y <= vis.y1; y++) {
      for (let x = vis.x0; x <= vis.x1; x++) {
        if (!map.terrain.has(coordKey({ x, y }))) diamondPath(ctx, box({ x, y }));
      }
    }
    ctx.stroke();
  }

  // ----------------------------------------------------------- the floor
  for (let y = vis.y0; y <= vis.y1; y++) {
    for (let x = vis.x0; x <= vis.x1; x++) {
      const cell = { x, y };
      const key = coordKey(cell);
      const terrain = map.terrain.get(key);
      if (terrain === undefined) continue;
      const b = box(cell);
      if (!drawGround(ctx, terrainKey(terrain, cell), b)) {
        ctx.fillStyle = TERRAIN_COLORS[terrain];
        fillDiamond(ctx, b);
      }
      drawTerrainFringes(ctx, map, cell, terrain, b);
      if (overlays.rings) {
        ctx.fillStyle = ringColor(map.distanceFromTownhall.get(key) ?? 0, 0.4);
        fillDiamond(ctx, b);
      }
    }
  }

  // The grid is a DIAMOND per cell, one batched path, over the floor and
  // under everything that stands — the game's own scaffolding line.
  if (overlays.grid) {
    ctx.strokeStyle = PALETTE.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = vis.y0; y <= vis.y1; y++) {
      for (let x = vis.x0; x <= vis.x1; x++) {
        if (map.terrain.has(coordKey({ x, y }))) diamondPath(ctx, box({ x, y }), 0.5);
      }
    }
    ctx.stroke();
  }

  // ------------------------------------------------- what stands on it
  //
  // The painter's algorithm, with the game's depth: the centre of a thing's
  // footprint, x + y through the middle of it, larger sums nearer.
  const standing: Standing[] = [];
  const later = (cell: Coord, span: number, draw: () => void) => {
    standing.push({ depth: cell.x + cell.y + span, tie: cell.x + span, draw });
  };
  /** The first of `keys` that has art, standing on `plot`; the glyph in the
   *  same place while none has landed. Returns how tall it drew. */
  const stand = (plot: PlotBox, keys: string[], fallback: string, plots: number): number => {
    const foot = base(plot);
    for (const k of keys) {
      const tall = drawStanding(ctx, k, foot.x, foot.y, plot.w, plots);
      if (tall > 0) return tall;
    }
    glyph(ctx, fallback, plot.x, foot.y - plot.w, plot.w);
    return plot.w;
  };

  const townhall = new Set(TOWNHALL_FOOTPRINT.map(coordKey));
  for (let y = vis.y0; y <= vis.y1; y++) {
    for (let x = vis.x0; x <= vis.x1; x++) {
      const cell = { x, y };
      const key = coordKey(cell);
      const feature = map.initialFeatures.get(key);
      if (feature === undefined || townhall.has(key)) continue;
      // A feature that spans cells is ONE THING, drawn once from its anchor
      // over its whole block, asking for the drawing made for that size.
      const { anchor, size } = footprintAt(map, cell);
      if (anchor.x !== x || anchor.y !== y) continue;
      const def = FEATURES[feature];
      const plot = camera.plotBox(anchor, { x: size, y: size });
      const keys = size === 1
        ? [variantKey(def.sprite, cell)]
        : [`${def.sprite}_${size}x${size}`, variantKey(def.sprite, cell)];
      later(anchor, size, () => { stand(plot, keys, def.glyph, featurePlots(def.sprite)); });
    }
  }

  // The Townhall: not editable and not optional, but the single most
  // important thing to see while painting — every fog price on the map is a
  // distance from it. Drawn as the game opens on it, at level 1.
  {
    const def = DISTRICTS.Townhall;
    const plot = camera.plotBox({ x: 0, y: 0 }, def.size);
    later({ x: 0, y: 0 }, (def.size.x + def.size.y) / 2, () => {
      stand(plot, [`${def.sprite}_l1`, def.sprite], def.glyph, 1);
    });
  }

  const labels: SiteLabel[] = [];
  const site = (
    at: { x: number; y: number; size?: number }, sprite: string, fallback: string,
    text: string, selected: boolean, tint: string, plots = FEATURE_PLOTS,
  ) => {
    const n = at.size ?? 1;
    const plot = camera.plotBox(at, { x: n, y: n });
    later(at, n, () => {
      const tall = sprite ? stand(plot, [sprite], fallback, plots) : stand(plot, [], fallback, 1);
      labels.push({ plot, tall, text, selected, tint });
    });
  };
  if (overlays.sites) {
    for (const l of doc.landmarks) {
      const art = LANDMARK_ART[l.kind as LandmarkKind];
      const picked = view.selected?.kind === 'landmark' && view.selected.id === l.id;
      site(l, art?.sprite ?? '', art?.glyph ?? '❔', l.id, picked, '#8fe08f');
    }
    for (const [id, r] of Object.entries(doc.lairs)) {
      const art = LAIRS[id as LairId];
      const picked = view.selected?.kind === 'lair' && view.selected.id === id;
      site(r, art?.sprite ?? '', art?.glyph ?? '❔', `${id} · T${r.tier}`, picked, '#c79bff');
    }
    // An abandoned building, as its ruin: building art, one plot across
    // (Docs/features/01-map-and-fog.md §6.3).
    for (const a of doc.abandoned) {
      const def = DISTRICTS[a.district as keyof typeof DISTRICTS];
      const picked = view.selected?.kind === 'abandoned' && view.selected.id === a.id;
      const size = def ? Math.max(def.size.x, def.size.y) : 1;
      site({ ...a, size }, def ? `${def.sprite}_ruin` : '', def?.glyph ?? '❔', `${a.id} · ruin`, picked, '#e8c27a', 1);
    }
  }

  standing.sort((a, b) => a.depth - b.depth || a.tie - b.tie);
  for (const item of standing) item.draw();

  // ------------------------------------------------------------ overlays
  //
  // Everything from here on is the TOOL talking, drawn over the world.

  // Problems: over the art, not under it — a shrine standing in the sea is
  // exactly the case where the art would hide the cell that is wrong.
  if (overlays.warnings) {
    for (const key of warnedCells(doc)) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      const b = box({ x, y });
      ctx.fillStyle = 'rgba(255, 70, 70, 0.35)';
      fillDiamond(ctx, b);
      hatch(ctx, b, 'rgba(255,120,120,0.8)');
    }
  }

  // Townhall footprint, outlined on its ground.
  ctx.strokeStyle = '#ffd970';
  ctx.lineWidth = 2;
  strokeDiamond(ctx, camera.plotBox({ x: 0, y: 0 }, DISTRICTS.Townhall.size), 1);

  // Sites: their footprint outlined on the ground, and a label over the art.
  for (const l of labels) {
    ctx.strokeStyle = l.selected ? '#ffffff' : l.tint;
    ctx.lineWidth = l.selected ? 3 : 2;
    strokeDiamond(ctx, l.plot, 1.5);
  }
  for (const l of labels) {
    if (!l.selected && unit < 46) continue; // labels would just be noise
    const foot = base(l.plot);
    ctx.font = `${Math.max(9, Math.round(unit * 0.17))}px ui-sans-serif, system-ui, sans-serif`;
    const width = ctx.measureText(l.text).width + 8;
    const top = foot.y - l.tall - 4;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(foot.x - width / 2, top - 15, width, 15);
    ctx.fillStyle = l.selected ? '#ffffff' : l.tint;
    ctx.textAlign = 'center';
    ctx.fillText(l.text, foot.x, top - 4);
    ctx.textAlign = 'start';
  }

  // ------------------------------------------------------------ distance
  // Two numbers per cell only make sense when they can be read; below that
  // zoom the ring bands carry the same information as colour.
  if (overlays.distance && camera.tileW >= 80) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(9, Math.round(unit * 0.16))}px ui-monospace, monospace`;
    for (let y = vis.y0; y <= vis.y1; y++) {
      for (let x = vis.x0; x <= vis.x1; x++) {
        const key = coordKey({ x, y });
        if (!map.terrain.has(key)) continue;
        const d = map.distanceFromTownhall.get(key) ?? 0;
        const b = box({ x, y });
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const text = `${d} · ${doc.costAt({ x, y })}g`;
        const tw = ctx.measureText(text).width + 6;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(cx - tw / 2, cy - 8, tw, 16);
        ctx.fillStyle = d === 0 && !townhall.has(key) ? '#ff9a9a' : '#e7eef7';
        ctx.fillText(text, cx, cy + 1);
      }
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  // ------------------------------------------------------------- cursor
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  for (const cell of view.preview) strokeDiamond(ctx, box(cell), 1.5);
  if (view.hover) {
    ctx.strokeStyle = '#ffe27a';
    strokeDiamond(ctx, box(view.hover), 1.5);
  }
}

const glyph = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) => {
  ctx.font = `${Math.round(size * 0.45)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size / 2, y + size * 0.75);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
};

/** Diagonal hatching clipped to a cell's diamond. */
function hatch(ctx: CanvasRenderingContext2D, b: PlotBox, color: string): void {
  ctx.save();
  ctx.beginPath();
  diamondPath(ctx, b);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = -b.h; i < b.w; i += 8) {
    ctx.moveTo(b.x + i, b.y);
    ctx.lineTo(b.x + i + b.h, b.y + b.h);
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
