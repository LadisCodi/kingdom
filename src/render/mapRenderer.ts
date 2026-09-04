// Canvas 2D world renderer: terrain, fog, resource cells (with exhaustion),
// districts, worker units, bars, markers, floaters. Redraws every frame —
// 155 cells is trivial.

import {
  CROPS_EXHAUSTED_GLYPH, DISTRICTS, FEATURES, HARVEST, LANDMARK_ART,
} from '../sim/data/definitions';
import { landmarkDefAt, ruinDefAt } from '../sim/sites';
import { trainingProgress, unitInTraining } from '../sim/army';
import { fogState, isReachable, revealCostForCell } from '../sim/fog';
import type { MapData } from '../sim/grid';
import { harvestSourceAt, recoversAt, stockFraction } from '../sim/harvest';
import { maxPopulation } from '../sim/population';
import { workerPosition } from '../sim/workers';
import {
  queueProgress, remainingSeconds, coordKey, districtById, districtOccupies,
  type Coord, type GameState, type HarvestSourceId,
} from '../sim/state';
import type { Camera } from './camera';
import type { Floaters } from './floaters';
import type { TapFx } from './tapFx';
import type { Villagers } from './villagers';
import { PALETTE, TERRAIN_COLORS, TILE_SIZE } from './palette';
import { drawIcon, drawSprite } from './sprites';
import { drawCharacter, unitScale } from './characters';
import { animFor, castFor, villagerFor, type UnitPose } from './cast';
import { ICON_EMOJI, type IconName } from '../ui/kit/icon';

export interface MarkerLayer {
  selected: Coord | null;
  selectedSize: { x: number; y: number } | null; // footprint the selection outline spans
  validCells: Array<{ cell: Coord; label: string }>; // valid placement cells
  validColor: string;
  influenceCells: Coord[]; // area-of-influence outline
  claimedCells: Coord[]; // cells claimed by the inspected building's workers
  /** Workable cells inside the previewed building's range, with their yield;
   *  'bad' tone renders the label red (negative adjacency). */
  yieldCells: Array<{
    cell: Coord; label: string; icon?: string; tone?: 'good' | 'bad';
  }>;
  previewCell: Coord | null;
  previewGlyph: string | null;
  previewSprite: string | null;
  previewSize: { x: number; y: number } | null; // footprint of the previewed building
  /** The district currently being MOVED. It is drawn faint at its old address
   *  while its ghost is out — otherwise the player sees two of the same
   *  building and no way to tell which one is real. */
  liftedDistrictId: string | null;
  /** Quest-hint cell: pulsing outline + bouncing arrow until interacted. */
  hintCell: Coord | null;
}

// Canvas text uses the same display face as the HUD, read from the CSS token
// so tokens.css stays the one source of truth. Cached: this is called from
// the render loop.
let labelFontStack: string | null = null;
function labelFace(): string {
  if (labelFontStack === null) {
    labelFontStack = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-body').trim() || 'system-ui, sans-serif';
  }
  return labelFontStack;
}

/**
 * Map labels are NUMBERS and short counts, so they are set in the body face,
 * not the title one — the same split the CSS makes.
 *
 * **And the body face is a PIXEL face**, which is the whole reason this
 * function exists. `m6x11plus` is drawn on an 18-per-em grid, so a design
 * pixel covers `(css size x dpr) / 18` device pixels and anything that is not
 * a whole number gets antialiased into grey — the one thing a pixel face is
 * chosen not to do. At the target dpr of 3 the legal sizes are the multiples
 * of **6**, which is exactly the rule `tests/fonts.test.ts` enforces across
 * the stylesheets.
 *
 * That test reads CSS and cannot see a canvas, so these sizes had been off the
 * grid since the faces changed: the comment here still described PT Sans, an
 * OUTLINE face with no grid to land on, and concluded that "every whole pixel
 * is now available". True of PT Sans, false since — and invisible in exactly
 * the way that test's own header warns about, because every individual number
 * looks reasonable.
 */
const BODY_GRID_PX = 6;
const snapPx = (px: number, floor: number): number =>
  Math.max(floor, Math.round(px / BODY_GRID_PX) * BODY_GRID_PX);

/** Canvas font string in the body face, at a whole-pixel size. */
const labelFont = (px: number, floor: number, bold = false): string =>
  `${bold ? 'bold ' : ''}${snapPx(px, floor)}px ${labelFace()}`;

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

  // The per-cell resource-state overlay (recovery/tap bar). An exhausted
  // feature already swaps to its own sprite; no extra dim on top of it.
  const drawResourceState = (cell: Coord, x: number, y: number) => {
    const source = harvestSourceAt(state, cell);
    if (source === null) return;
    const recovery = recoversAt(state, map, cell, now);
    const spec = HARVEST[source];
    if (recovery !== null) {
      const remaining = (recovery - now) / (spec.recoverySeconds * 1000);
      drawBar(ctx, x + size * 0.15, y + size - 7, size * 0.7, 4, 1 - Math.min(1, remaining), PALETTE.recoveryFill);
    } else {
      const fraction = stockFraction(state, map, cell, spec, now);
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

  /** A small corner tag on a site: what it still wants from the player. */
  const drawSiteBadge = (x: number, y: number, text: string): void => {
    const r = Math.max(6, size * 0.13);
    ctx.beginPath();
    ctx.arc(x + size - r - 2, y + r + 2, r, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.siteBadge;
    ctx.fill();
    ctx.strokeStyle = PALETTE.siteBadgeEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = PALETTE.siteBadgeInk;
    ctx.font = labelFont(r * 1.2, 12, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + size - r - 2, y + r + 3);
  };

  /**
   * The one pill on the map: **icon, then amount**, in that order everywhere.
   *
   * The icon comes from the UI atlas rather than being written into the string
   * as an emoji — a `🪵` renders from the system face and sits visibly outside
   * the art next to the world's own sprites, which is the quiet fallback
   * `CLAUDE.md` refuses. It falls back to the glyph only when the atlas has no
   * cell or has not loaded yet, exactly as `drawSprite` does.
   *
   * Shared by the population count and the placement yield labels, so a count
   * over a building and a yield over a cell read as the same kind of thing.
   */
  const drawPill = (
    cx: number,
    bottomY: number,
    text: string,
    opts: { icon?: string; ink?: string; fontScale?: number } = {},
  ): void => {
    const fontSize = snapPx(size * (opts.fontScale ?? 0.17), 12);
    ctx.font = labelFont(fontSize, 12, true);
    const padX = fontSize * 0.5;
    const iconSize = opts.icon ? Math.round(fontSize * 1.15) : 0;
    const gap = opts.icon ? fontSize * 0.25 : 0;
    const textW = ctx.measureText(text).width;
    const pillW = iconSize + gap + textW + padX * 2;
    const pillH = Math.max(fontSize * 1.45, iconSize + 4);
    const pillX = cx - pillW / 2;
    const pillY = bottomY - pillH;
    ctx.fillStyle = PALETTE.labelPill;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.labelPillEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    const midY = pillY + pillH / 2;
    let cursor = pillX + padX;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (opts.icon) {
      if (!drawIcon(ctx, opts.icon, cursor, midY - iconSize / 2, iconSize)) {
        ctx.fillStyle = PALETTE.label;
        ctx.fillText(ICON_EMOJI[opts.icon as IconName] ?? '', cursor, midY);
      }
      cursor += iconSize + gap;
    }
    ctx.fillStyle = opts.ink ?? PALETTE.label;
    ctx.fillText(text, cursor, midY + fontSize * 0.05);
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
        const exhausted = recoversAt(state, map, cell, now) !== null;
        punched(key, x, y, size, size, () => {
          if (!drawSprite(ctx, exhausted ? `${def.sprite}_exhausted` : def.sprite, x, y, size, size)) {
            drawGlyph(ctx, exhausted ? def.exhaustedGlyph : def.glyph, x, y, size, size * 0.5);
          }
        });
      }

      // Landmarks and ruins: authored sites, drawn where a feature would be.
      // They are what the fog is FOR, so they get the same weight as a forest
      // and a badge saying whether they still want something from you.
      //
      // Drawn through the fog, exactly like a feature. A site you cannot see
      // until you have already paid to stand on it is not a destination —
      // it is a surprise, and the whole economy is built on the player
      // choosing which direction to spend Gold in. The Discovered scrim below
      // still dims them, so "there, and not yet yours" reads at a glance.
      const landmark = landmarkDefAt(cell);
      if (landmark) {
        const art = LANDMARK_ART[landmark.kind];
        const claimed = state.landmarks.claimed[landmark.id] === true;
        punched(key, x, y, size, size, () => {
          if (!drawSprite(ctx, art.sprite, x, y, size, size)) {
            drawGlyph(ctx, art.glyph, x, y, size, size * 0.5);
          }
        });
        // A star means "claimable"; a bang means "something is holding it".
        if (!claimed) drawSiteBadge(x, y, landmark.defended ? '!' : '\u2726');
      }
      const ruin = ruinDefAt(cell);
      if (ruin) {
        punched(key, x, y, size, size, () => {
          if (!drawSprite(ctx, ruin.sprite, x, y, size, size)) {
            drawGlyph(ctx, ruin.glyph, x, y, size, size * 0.5);
          }
        });
        // The tier alone: a bare digit reads at any zoom, and "T1" in a
        // pixel display face is one stroke away from an arrow.
        drawSiteBadge(x, y, String(ruin.tier));
      }

      if (fog === 'Revealed') drawResourceState(cell, x, y);

      if (fog === 'Discovered') {
        ctx.fillStyle = PALETTE.fogDiscovered;
        ctx.fillRect(x, y, size, size);
        // A cell you can see but cannot reach yet sits under a second layer,
        // so the payable frontier reads as a border rather than as every
        // pale tile on screen. The rule is spatial, so it should be visible
        // spatially — a toast on a refused tap is the fallback, not the
        // teacher.
        if (!isReachable(state, map, cell)) {
          ctx.fillStyle = PALETTE.fogDiscovered;
          ctx.fillRect(x, y, size, size);
        }
        // Reveal progress only — the total cost is deliberately not shown.
        const paid = state.fog.progress[key] ?? 0;
        if (paid > 0) {
          const total = revealCostForCell(state, map, cell);
          drawBar(ctx, x + size * 0.15, y + size * 0.62, size * 0.7, 5, paid / total, PALETTE.progressFill);
        }
      }
    }
  }

  // Pass 1.5: districts, each drawn once spanning its full footprint.
  for (const district of state.city.districts) {
    if (fogState(state, map, district.location) !== 'Revealed') continue;
    // Lifted: this building is being moved and its ghost is out. Draw the
    // original as a faint outline of itself so the address it is leaving
    // stays legible without competing with the ghost.
    const lifted = district.uniqueId === markers.liftedDistrictId;
    const { x, y } = cellRect(district.location);
    const def = DISTRICTS[district.definitionId];
    const fw = size * def.size.x;
    const fh = size * def.size.y;
    if (x + fw < 0 || y + fh < 0 || x > w || y > h) continue; // offscreen
    // Set AFTER the offscreen bail. Setting it before meant that moving a
    // building the camera had left behind leaked 0.28 into the rest of the
    // frame — every marker, label, worker and floater drawn faint for as long
    // as the ghost was out.
    if (lifted) ctx.globalAlpha = 0.28;
    const exhausted = recoversAt(state, map, district.location, now) !== null;
    // Exhausted crop plot gets its own base sprite when available;
    // otherwise the normal sprite (or glyph) plus the withered overlay.
    const exhaustedPlot = district.definitionId === 'FarmLands' &&
      exhausted && district.state !== 'UnderConstruction';
    // Docks art faces water-right; mirror it when the wet half is on the left
    // (the anchor cell is the Water one). Sprites only — glyphs never flip.
    const mirrored = district.definitionId === 'Docks' &&
      map.terrain.get(coordKey(district.location)) === 'Water';
    const flip = (draw: () => boolean): boolean => {
      if (!mirrored) return draw();
      ctx.save();
      ctx.translate(x + fw / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(x + fw / 2), 0);
      const drew = draw();
      ctx.restore();
      return drew;
    };
    let drewExhaustedPlot = false;
    punched(coordKey(district.location), x, y, fw, fh, () => {
      drewExhaustedPlot =
        exhaustedPlot && flip(() => drawSprite(ctx, `${def.sprite}_exhausted`, x, y, fw, fh));
      // Leveled art (`sprite_l2`…) when present, base sprite otherwise.
      if (
        !drewExhaustedPlot &&
        !flip(() => drawSprite(ctx, `${def.sprite}_l${district.level}`, x, y, fw, fh)) &&
        !flip(() => drawSprite(ctx, def.sprite, x, y, fw, fh))
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
        ctx.font = labelFont(size * 0.16, 12);
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
      // Townhall: villager-training progress bar, and the population count.
      //
      // Population is drawn HERE rather than in the header because the
      // Townhall is where villagers come from: the number and the button that
      // changes it are the same object, so wanting more people and knowing
      // how many you have are one glance instead of two. It also buys the
      // header back the width the widget was costing on a phone.
      if (district.definitionId === 'Townhall') {
        drawPill(x + fw / 2, y - 2, `${state.city.population}/${maxPopulation(state)}`,
          { icon: 'population' });
        const inLine = unitInTraining(state, district.uniqueId);
        if (inLine) {
          drawBar(ctx, x + fw * 0.12, y + fh - 7, fw * 0.76, 4,
            trainingProgress(state, district.uniqueId, now), PALETTE.progressFill);
        }
      }
      // Needs-workers warning.
      if (def.maxWorkersPerLevel.length > 0 && district.assignedWorkers === 0) {
        drawGlyph(ctx, '⚠️', x + fw * 0.28, y - fh * 0.26, fw, size * 0.26, fh);
      }
    }
    if (lifted) ctx.globalAlpha = 1;
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
    ctx.font = labelFont(size * 0.15, 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(item.startedAt === null ? 'queued' : `${remaining}s`, x + fw / 2, y + size * 0.1 + 8);
  }

  // Pass 3: markers.
  // Working area: one translucent white region with a crisp outline — border
  // segments are drawn only on edges that face a cell outside the area.
  if (markers.influenceCells.length > 0) {
    const inArea = new Set(markers.influenceCells.map(coordKey));
    ctx.fillStyle = PALETTE.influenceFill;
    for (const cell of markers.influenceCells) {
      const { x, y } = cellRect(cell);
      ctx.fillRect(x, y, size, size);
    }
    ctx.strokeStyle = PALETTE.influenceBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const cell of markers.influenceCells) {
      const { x, y } = cellRect(cell);
      if (!inArea.has(coordKey({ x: cell.x, y: cell.y - 1 }))) {
        ctx.moveTo(x, y); ctx.lineTo(x + size, y);
      }
      if (!inArea.has(coordKey({ x: cell.x, y: cell.y + 1 }))) {
        ctx.moveTo(x, y + size); ctx.lineTo(x + size, y + size);
      }
      if (!inArea.has(coordKey({ x: cell.x - 1, y: cell.y }))) {
        ctx.moveTo(x, y); ctx.lineTo(x, y + size);
      }
      if (!inArea.has(coordKey({ x: cell.x + 1, y: cell.y }))) {
        ctx.moveTo(x + size, y); ctx.lineTo(x + size, y + size);
      }
    }
    ctx.stroke();
  }
  for (const { cell, label } of markers.validCells) {
    if (fogState(state, map, cell) === 'Undiscovered') continue;
    const { x, y } = cellRect(cell);
    ctx.strokeStyle = markers.validColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    if (label) {
      ctx.fillStyle = markers.validColor;
      ctx.font = labelFont(size * 0.16, 12);
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

  // What a cell HOLDS, on the same pill a count uses.
  //
  // **Drawn LAST of the markers, after the ghost and the selection outline**,
  // and that order is load-bearing. A crop plot's label sits on the ghost's
  // OWN cell (it is the only district that becomes a resource cell), so the
  // 60%-opaque preview sprite used to be painted straight over it and washed
  // it out — while a house's labels sit on its neighbours, which the ghost
  // never covers, so moving a house looked fine and moving a plot did not.
  // Nothing may paint over a number the player is reading.
  //
  // The pill is near-opaque and the ink bright for the same reason at one
  // remove: it is drawn over the influence wash, the brightest thing on the
  // map, and a translucent pill borrows whatever is under it.
  //
  // Untoned labels are WHITE. Only ground that is actually richer or poorer
  // than its authored stock gets colour, so the colour means something rather
  // than decorating every label on screen.
  for (const { cell, label, icon, tone } of markers.yieldCells) {
    if (label === '') continue;
    const { x, y } = cellRect(cell);
    drawPill(x + size / 2, y + size - 5, label, {
      icon,
      fontScale: 0.2,
      ink: tone === 'bad' ? PALETTE.yieldNegative
        : tone === 'good' ? PALETTE.yieldPositive : PALETTE.label,
    });
  }

  // Pass 3.9: ambient villagers — unassigned population strolling around
  // the Townhall and Housing. Under the workers, so busy people read on top.
  for (const v of villagers.positions(state, map, now)) {
    const { x, y } = cellRect(v);
    const sx = x + size * 0.18;
    const sy = y + size * 0.18;
    const uw = size * 0.6;
    const t = now + v.phase;
    const keys = v.walking ? [walkFrameKey('worker_walk', t), 'worker'] : ['worker'];
    // Cast by phase: it is per agent and stable, so a villager keeps its face.
    const [who, anim] = animFor(villagerFor(v.phase), v.walking ? 'walk' : 'idle');
    unitTransform(ctx, sx + uw / 2, sy + uw, v.walking && v.dx < 0,
      v.walking ? WALK_SQUASH : 0, WALK_FRAME_MS * 2, t, () => {
        if (drawCharacter(ctx, who, anim, t, sx + uw / 2, sy + uw, unitScale(size))) return;
        if (!keys.some((k) => drawSprite(ctx, k, sx, sy, uw, uw))) {
          drawGlyph(ctx, '🧍', sx, sy, uw, size * 0.34);
        }
      });
  }

  // Pass 3.8: the quest-hint arrow — a bouncing 👇 over the hinted cell.
  if (markers.hintCell) {
    const { x, y } = cellRect(markers.hintCell);
    const bob = Math.sin(now / 140) * size * 0.07;
    ctx.strokeStyle = PALETTE.selected;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    drawGlyph(ctx, '👇', x, y - size * 0.62 + bob, size, size * 0.5);
  }

  // Pass 4: worker units — animated. Walk cycles while moving (carry
  // variant on the way home), a per-source work loop while Working, and a
  // footfall squash & stretch about the feet. Every frame key falls back
  // through the static sprite to the emoji, so missing art degrades cleanly.
  // Workers of a Fish-harvesting building are FISHING BOATS out on the water.
  for (const worker of state.workers) {
    const pos = workerPosition(state, worker, now);
    if (!pos) continue;
    const building = districtById(state, worker.buildingId);
    if (!building) continue;
    const sources = DISTRICTS[building.definitionId].harvestSources;
    const boat = sources.includes('Fish');
    // Read from the cell the worker CLAIMED, not from the building: a Mine
    // works two mountains and its crew is on one or the other.
    const source = worker.claimedCell !== null
      ? harvestSourceAt(state, worker.claimedCell) : sources[0] ?? null;
    const { x, y } = cellRect(pos);
    const sx = x + size * 0.18;
    const sy = y + size * 0.18;
    const uw = size * 0.6;
    const t = now + unitPhase(worker.id);
    const moving = worker.activity === 'MovingToCell' || worker.activity === 'MovingHome';
    const working = worker.activity === 'Working';

    // Facing: mirror the sprite while the current leg heads left.
    let flip = false;
    if (moving && worker.claimedCell) {
      const dx = worker.claimedCell.x - building.location.x;
      flip = (worker.activity === 'MovingToCell' ? dx : -dx) < 0;
    }

    // Sprite chain: animation frame → static (carrying) sprite → base.
    const carrying = worker.carrying > 0;
    const stem = boat ? 'fishing_boat' : 'worker';
    const keys: string[] = [];
    if (boat) {
      if (moving && !carrying) keys.push(workFrameKey('fishing_boat_row', t));
    } else if (moving) {
      keys.push(walkFrameKey(carrying ? 'worker_carry' : 'worker_walk', t));
    } else if (working) {
      const anim = source ? WORK_ANIM[source] : undefined;
      if (anim) keys.push(workFrameKey(`worker_${anim}`, t));
    }
    if (carrying) keys.push(`${stem}_carrying`);
    keys.push(stem);

    // Squash & stretch: a bounce per footfall on land; a slow bob afloat.
    let amp = 0;
    let period = 1;
    if (moving || working) {
      amp = boat ? BOAT_SQUASH : moving ? WALK_SQUASH : WORK_SQUASH;
      period = boat ? BOAT_BOB_MS : moving ? WALK_FRAME_MS * 2 : WORK_FRAME_MS;
    }
    // The atlas cast first — a farmer for the Farm, a lumberjack for the
    // Sawmill — then the legacy sprite chain, then the emoji. Boats have no
    // cast and skip straight to the chain.
    const member = boat ? null : castFor(building.definitionId, unitPhase(worker.id));
    const pose: UnitPose = moving ? 'walk' : working ? 'work' : 'idle';
    const cast = member ? animFor(member, pose) : null;
    unitTransform(ctx, sx + uw / 2, sy + uw, flip, amp, period, t, () => {
      if (cast && drawCharacter(ctx, cast[0], cast[1], t, sx + uw / 2, sy + uw, unitScale(size))) {
        return;
      }
      if (!keys.some((k) => drawSprite(ctx, k, sx, sy, uw, uw))) {
        drawGlyph(ctx, boat ? '⛵' : '🧑‍🌾', sx, sy, uw, size * 0.34);
        if (carrying) {
          drawGlyph(ctx, boat ? '🐟' : '🎒', x + size * 0.42, y - size * 0.02, size * 0.5, size * 0.2);
        }
      }
    });
  }

  // Pass 5: floaters.
  for (const f of floaters.alive()) {
    const { x, y } = cellRect(f.cell);
    const fontSize = snapPx(size * 0.22, 12);
    ctx.globalAlpha = 1 - f.t;
    ctx.font = labelFont(fontSize, 12, true);
    const iconSize = f.icon ? Math.round(fontSize * 1.15) : 0;
    const gap = f.icon ? fontSize * 0.25 : 0;
    const textW = ctx.measureText(f.text).width;
    const cx = x + size / 2;
    const midY = y + size * 0.3 - f.t * size * 0.5;
    // Icon first, then the amount — the same order the pills use.
    let cursor = cx - (iconSize + gap + textW) / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (f.icon) {
      if (!drawIcon(ctx, f.icon, cursor, midY - iconSize / 2, iconSize)) {
        ctx.fillStyle = PALETTE.floaterText;
        ctx.fillText(ICON_EMOJI[f.icon as IconName] ?? '', cursor, midY);
      }
      cursor += iconSize + gap;
    }
    ctx.fillStyle = f.color ?? PALETTE.floaterText;
    ctx.fillText(f.text, cursor, midY);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------- unit animation

const WALK_FRAME_MS = 140; // 4-frame walk cycle ≈ 560 ms
const WORK_FRAME_MS = 320; // 2-frame work loop (strike cadence)
const BOAT_BOB_MS = 900;
const WALK_SQUASH = 0.06;
const WORK_SQUASH = 0.04;
const BOAT_SQUASH = 0.03;

/** Which 2-frame work loop a Working worker plays, by what it harvests. */
const WORK_ANIM: Partial<Record<HarvestSourceId, string>> = {
  Crops: 'farm',
  Forest: 'chop',
  Stone: 'mine',
  MountainIron: 'mine',
  MountainGold: 'mine',
};

const walkFrameKey = (stem: string, t: number): string =>
  `${stem}_${(Math.floor(t / WALK_FRAME_MS) % 4) + 1}`;

const workFrameKey = (stem: string, t: number): string =>
  `${stem}_${(Math.floor(t / WORK_FRAME_MS) % 2) + 1}`;

/** Stable per-unit phase offset (ms) so units don't animate in lockstep. */
function unitPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h >>> 0) % 997;
}

/**
 * Draw a unit mirrored and/or squash-and-stretched about its feet:
 * (cx, cy) is the bottom-center of the sprite rect. Volume-preserving —
 * width narrows as height stretches, so the bounce reads as weight.
 */
function unitTransform(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  flip: boolean,
  amp: number,
  periodMs: number,
  t: number,
  draw: () => void,
): void {
  if (!flip && amp === 0) {
    draw();
    return;
  }
  const stretch = 1 + amp * Math.sin((t / periodMs) * Math.PI * 2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale((flip ? -1 : 1) / stretch, stretch);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
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
  // Stays on system-ui deliberately: this draws EMOJI, and forcing a pixel
  // face here would break them. Becomes dead code as sprites cover every case.
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
