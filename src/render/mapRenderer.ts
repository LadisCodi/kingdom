// Canvas 2D world renderer: terrain, fog, resource cells (with exhaustion),
// districts, worker units, bars, markers, floaters. Everything is redrawn
// each frame it is asked for (main.ts paces how often) except the floor —
// ground and fog scrim — which is kept in a canvas of its own (drawFloor).

import {
  CROPS_EXHAUSTED_GLYPH, DISTRICTS, FEATURES, FOG, HARVEST, LANDMARK_ART, LANDMARKS, UNITS,
} from '../sim/data/definitions';
import { sightedThings, type Sighted } from '../sim/sight';
import { landmarkDefAt, standingAbandonedAt, standingLairAt } from '../sim/sites';
import { lairZoneCells } from '../sim/lairZone';
import { ABANDONED, LAIR_ORDER, LAIRS } from '../sim/data/definitions';
import {
  clearLairArt, clearLairBubbles, compactCountdown, markLairArt, heldZone, LAIR_AVATAR, markLairBubble, outerSides,
} from './lairMap';
import { itemCount, lineFor, lineRemainingSeconds, trainingProgress, unitInTraining } from '../sim/army';
import { fogState, isPayable, reachBorder } from '../sim/fog';
import { footprintAt, type MapData } from '../sim/grid';
import {
  harvestSourceAt, recoversAt, recoveryProgress, stockFraction,
} from '../sim/harvest';
import { maxPopulation } from '../sim/population';
import { workerPosition } from '../sim/workers';
import {
  queueProgress, remainingSeconds, coordKey, districtById, districtOccupies,
  type Coord, type DistrictId, type FeatureId, type GameState, type LairId, type TerrainId, type UnitId,
} from '../sim/state';
import type { Camera, PlotBox } from './camera';
import type { Floaters } from './floaters';
import type { CollectBubbles } from './collectBubbles';
import { drawClaimBubble, drawCollectBubble, drawLairBubble } from './collectBubbleArt';
import { showsCollect } from '../sim/doors';
import type { TapFx } from './tapFx';
import type { Villagers } from './villagers';
import { PALETTE, TERRAIN_COLORS } from './palette';
import {
  drawIcon, drawSprite, spriteAspect, spriteInkTop, spriteSolidAt, spriteUrl, withSpriteLook,
} from './sprites';
import {
  diamondPath, drawGround, drawStanding, drawStandingGlow, drawStandingOutline, edgePath, FEATURE_PLOTS,
  fillDiamond, strokeDiamond,
} from './iso';
import { drawTerrainFringes, terrainKey, variantKey } from './terrain';
import { drawCharacter, unitHeight } from './characters';
import { animFor, castFor, NEVER_HIDES, villagerFor, type UnitPose } from './cast';
import { ICON_EMOJI, type IconName } from '../ui/kit/icon';
import { formatCount, formatDuration } from '../ui/format';
import { drawArea, drawAreaLine, drawReach } from './areaOverlays';
import { drawTraineeBadge, drawTroughBar, drawWorkingHammer } from './constructionArt';

export interface MarkerLayer {
  selected: Coord | null;
  selectedSize: { x: number; y: number } | null; // footprint the selection outline spans
  validCells: Array<{ cell: Coord; label: string }>; // valid placement cells
  validColor: string;
  influenceCells: Coord[]; // area-of-influence outline
  /** Workable cells inside the previewed building's range, with their yield;
   *  'bad' tone renders the label red (negative adjacency). */
  yieldCells: Array<{
    cell: Coord; label: string; icon?: string; tone?: 'good' | 'bad';
  }>;
  previewCell: Coord | null;
  previewGlyph: string | null;
  previewSprite: string | null;
  previewSize: { x: number; y: number } | null; // footprint of the previewed building
  /** The grid steps the ghost can take — one green arrow each, on the ground
   *  beside the footprint, pointing that way. */
  previewSteps: Coord[];
  /** The district currently being MOVED. It is drawn faint at its old address
   *  while its ghost is out — otherwise the player sees two of the same
   *  building and no way to tell which one is real. */
  liftedDistrictId: string | null;
  /** The building whose card is open: it pulses white, so the player can
   *  tell which one the card is about. */
  inspectedDistrictId: string | null;
  /** Quest-hint cell: pulsing outline + bouncing arrow until interacted. */
  hintCell: Coord | null;
  /** SPELLS STANDING ON THE GROUND (Docs/features/09-relics.md §11.6): the
   *  cells each one covers, and how much of its window is left. */
  spellZones: Array<{
    glyph: string; centre: Coord; cells: Coord[]; left: number;
  }>;
}

/**
 * THE SHARED CLOCK EVERY SPELL ANIMATES ON, one slow turn every six seconds.
 *
 * `performance.now()` and not the sim's, deliberately: this drives a shimmer
 * and nothing else, so it must keep moving between ticks — and it must never
 * be something the sim can be replayed from. A zone's actual remaining time
 * comes down the marker layer, where it is computed once against the sim's
 * own clock.
 */
/** The move arrows' bob, 0 → 1 → 0 over a second and a quarter; flat under
 *  reduced motion. */
const ARROW_CYCLE_MS = 1250;
const reducedMotion = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const moveArrowBob = (): number => (reducedMotion?.matches
  ? 0
  : 0.5 - 0.5 * Math.cos((performance.now() % ARROW_CYCLE_MS) / ARROW_CYCLE_MS * Math.PI * 2));

const SPELL_CYCLE_MS = 6000;
const spellPhase = (): number => (performance.now() % SPELL_CYCLE_MS) / SPELL_CYCLE_MS;

/** THE SELECTED BUILDING'S PULSE: 0 → 1 → 0 once every 1.4 s, on the same
 *  wall clock as the spells and for the same reason. */
const SELECTED_PULSE_MS = 1400;
const selectedPulse = (): number =>
  0.5 - 0.5 * Math.cos((2 * Math.PI * (performance.now() % SELECTED_PULSE_MS)) / SELECTED_PULSE_MS);

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

/** Map labels are NUMBERS and short counts, so they are set in the body face,
 *  not the title one — the same split the CSS makes. Sizes are whole CSS
 *  pixels with a floor under them: below 11px a count stops being legible on
 *  the phone, whatever the zoom did to the cell. */
const wholePx = (px: number, floor: number): number => Math.max(floor, Math.round(px));

/** Canvas font string in the body face, at a whole-pixel size. */
const labelFont = (px: number, floor: number, bold = false): string =>
  `${bold ? 'bold ' : ''}${wholePx(px, floor)}px ${labelFace()}`;

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
  bubbles: CollectBubbles,
  /** Lairs just claimed, and the `performance.now()` of the claim: their
   *  going-away is played from it, then they are forgotten (§5). */
  vanishing: Map<LairId, number> = new Map(),
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
  // The frame's own clock, for animations the sim knows nothing about.
  const clockNow = performance.now();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // SMOOTHING ON. The world is stylized 3D, not pixel art: every piece is
  // authored at twice the size it is drawn at (a 1×1 tile is a 256×128 PNG
  // on a 128×64 diamond), so it is always being scaled DOWN, and nearest
  // neighbour on a downscale is just aliasing.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // No background fill: the floor (drawFloor) is opaque and covers the frame.

  // The three numbers a frame is drawn from. `tw`/`th` are the ground
  // diamond, always 2:1; `size` is A CELL'S WORTH OF PIXELS for things that
  // are sized rather than placed — label sizes, bar lengths, how big a
  // villager is — because a number set in the diamond's full width would be
  // twice the size it was on the old square grid.
  const th = camera.tileH;
  const size = camera.unit;
  const view = camera.visibleCells(1);

  const cellRect = (cell: Coord) => camera.cellToScreen(cell);
  /** The centre of a plot's ground diamond — where a label or a bar hangs. */
  const mid = (b: PlotBox) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  /** The bottom corner of a plot's ground diamond — where art STANDS. */
  const base = (b: PlotBox) => ({ x: b.x + b.w / 2, y: b.y + b.h });

  /**
   * THE GHOST'S MOVE ARROWS (Docs/art/ui-menus-redesign.md §5.6): one green
   * arrow per grid step the ghost can take, lying flat on the ground just
   * past the middle of that side of its footprint and pointing along the
   * grid's axis — so on screen they run diagonally, parallel to the
   * diamond's edges. They bob gently outward along their axis.
   */
  const drawMoveArrows = (cell: Coord, fp: { x: number; y: number }, steps: Coord[]) => {
    if (steps.length === 0) return;
    const origin = mid(cellRect(cell));
    const stepOf = (d: Coord) => {
      const m = mid(cellRect({ x: cell.x + d.x, y: cell.y + d.y }));
      return { x: m.x - origin.x, y: m.y - origin.y };
    };
    const c = mid(camera.plotBox(cell, fp));
    const bob = moveArrowBob();
    for (const d of steps) {
      const v = stepOf(d);
      // The other axis, for the arrow's width: on the ground, not the screen.
      const w = stepOf(d.x !== 0 ? { x: 0, y: 1 } : { x: 1, y: 0 });
      const half = (d.x !== 0 ? fp.x : fp.y) / 2;
      const along = half + 0.3 + bob * 0.12;
      const at = (u: number, k: number) => ({
        x: c.x + v.x * (along + u) + w.x * k,
        y: c.y + v.y * (along + u) + w.y * k,
      });
      // Tail to tip in cells: a short shaft and a broad head.
      const pts = [
        at(0, -0.11), at(0.26, -0.11), at(0.26, -0.26), at(0.55, 0),
        at(0.26, 0.26), at(0.26, 0.11), at(0, 0.11),
      ];
      ctx.save();
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.globalAlpha = 0.92;
      const g = ctx.createLinearGradient(c.x, c.y - th * 0.3, c.x, c.y + th * 0.3);
      g.addColorStop(0, PALETTE.moveArrowLight);
      g.addColorStop(1, PALETTE.moveArrow);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1.5, size * 0.025);
      ctx.strokeStyle = PALETTE.moveArrowRim;
      ctx.stroke();
      ctx.restore();
    }
  };

  /**
   * A prop standing on a plot: the first of `keys` whose art exists, drawn
   * to the diamond's width with its feet on the diamond's bottom corner;
   * the glyph in the same box when none of them has landed.
   */
  const stand = (
    b: PlotBox, keys: string[], glyph: string,
    wrap: (draw: () => number) => number = (d) => d(),
    canvasPlots = 1,
  ): number => {
    const foot = base(b);
    const drew = wrap(() => {
      for (const k of keys) {
        const tall = drawStanding(ctx, k, foot.x, foot.y, b.w, canvasPlots);
        if (tall > 0) return tall;
      }
      return 0;
    });
    if (drew > 0) return drew;
    drawGlyph(ctx, glyph, b.x, foot.y - b.w, b.w, size * 0.52, b.w);
    return b.w;
  };

  // The per-cell resource-state overlay (recovery/tap bar). An exhausted
  // feature already swaps to its own sprite; no extra dim on top of it.
  const drawResourceState = (cell: Coord, box: PlotBox) => {
    const source = harvestSourceAt(state, cell);
    if (source === null) return;
    const spec = HARVEST[source];
    const growing = recoveryProgress(state, map, cell, spec, now);
    if (growing !== null) {
      const c = mid(box);
      drawBar(ctx, c.x - size * 0.35, c.y + th * 0.2, size * 0.7, 4, growing, PALETTE.recoveryFill);
    } else {
      const fraction = stockFraction(state, map, cell, spec, now);
      if (fraction < 1) {
        const c = mid(box);
        drawBar(ctx, c.x - size * 0.35, c.y + th * 0.2, size * 0.7, 4, fraction, PALETTE.vaultFill);
      }
    }
  };
  /**
   * `draw`, BRIGHTENED by `k`: CSS `brightness(1 + k)` without a filter. The
   * same drawing added on top of itself with `lighter` at alpha `k` is
   * `colour × (1 + k)` wherever it is opaque and the same blend at its
   * soft edge — so it is drawn once plainly, then once more for each whole
   * step of `k`. `lighting` is up for the added passes, so a glow that
   * belongs under the art is not added again.
   */
  let lighting = false;
  const brightened = (k: number, draw: () => void): void => {
    draw();
    if (k <= 0.004) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const alpha = ctx.globalAlpha;
    const was = lighting;
    lighting = true;
    for (let left = k; left > 0.004; left -= 1) {
      ctx.globalAlpha = alpha * Math.min(1, left);
      draw();
    }
    lighting = was;
    ctx.restore();
  };

  // Tap punch: draw a sprite squashed/stretched about its bottom center
  // (things smoosh into the ground), brightened while the flash lasts.
  const punched = (anchorKey: string, box: PlotBox, draw: () => void) => {
    const p = tapFx.sample(anchorKey);
    if (!p) {
      draw();
      return;
    }
    ctx.save();
    // The squash anchors on the diamond's BOTTOM CORNER, which is the same
    // point the art stands on: a tapped building smooshes into its own plot.
    const { x: cx, y: cy } = base(box);
    ctx.translate(cx, cy);
    ctx.scale(p.sx, p.sy);
    ctx.translate(-cx, -cy);
    brightened(p.flash > 0.02 ? 2.5 * p.flash : 0, draw);
    ctx.restore();
  };

  /**
   * THE EDGES OF AN AREA, never the grid inside it: add to the current path
   * only those sides of `cell` whose neighbour is outside `inside`. What is
   * enchanted, or worked, or reachable is an AREA — a chequerboard of outlined
   * tiles says something different and says it worse.
   *
   * The sim answers in N/S/E/W on its square grid; `edgePath` rotates each
   * onto the diamond (src/render/iso.ts).
   */
  const outline = (b: PlotBox, cell: Coord, inside: Set<string>): void => {
    if (!inside.has(coordKey({ x: cell.x, y: cell.y - 1 }))) edgePath(ctx, b, 'N');
    if (!inside.has(coordKey({ x: cell.x + 1, y: cell.y }))) edgePath(ctx, b, 'E');
    if (!inside.has(coordKey({ x: cell.x, y: cell.y + 1 }))) edgePath(ctx, b, 'S');
    if (!inside.has(coordKey({ x: cell.x - 1, y: cell.y }))) edgePath(ctx, b, 'W');
  };

  /** A small corner tag on a site: what it still wants from the player. */
  const drawSiteBadge = (box: PlotBox, text: string): void => {
    const r = Math.max(6, size * 0.13);
    // Off the diamond's RIGHT CORNER and raised: a badge pinned to the top of
    // a square used to sit on the tile, and a tile is now a flat lozenge with
    // a building standing out of it.
    const c = mid(box);
    const bx = c.x + box.w * 0.26;
    const by = c.y - box.h * 0.55 - r;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.siteBadge;
    ctx.fill();
    ctx.strokeStyle = PALETTE.siteBadgeEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = PALETTE.siteBadgeInk;
    ctx.font = labelFont(r * 1.2, 11, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx, by + 1);
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
    const fontSize = wholePx(size * (opts.fontScale ?? 0.17), 12);
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

  /**
   * ONE BUILDING, standing on its plot.
   *
   * `box` is the bounding box of the plot's ground diamond: `(w + h)` half
   * tiles across and the same number of half tiles down, always 2:1. The art
   * is as wide as that diamond with its base on the image's bottom edge, so
   * `stand` puts that edge on the diamond's bottom corner and everything the
   * artist drew above it rises into the sky.
   */
  const drawDistrict = (district: GameState['city']['districts'][number], box: PlotBox): number => {
    // Lifted: this building is being moved and its ghost is out. Draw the
    // original as a faint outline of itself so the address it is leaving
    // stays legible without competing with the ghost.
    const lifted = district.uniqueId === markers.liftedDistrictId;
    const def = DISTRICTS[district.definitionId];
    const c = mid(box);
    const foot = base(box);
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
    const flip = (draw: () => number): number => {
      if (!mirrored) return draw();
      ctx.save();
      ctx.translate(foot.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-foot.x, 0);
      const drew = draw();
      ctx.restore();
      return drew;
    };
    // Levelled art comes in TIERS, not one piece per level: a building draws
    // the highest `_l<n>` it owns at or below its level, so `_l1`, `_l4` and
    // `_l8` dress all ten levels with three drawings. Walking down is also
    // what stops a level with no art of its own from falling past the base
    // sprite to the emoji.
    const keys: string[] = [];
    if (exhaustedPlot) keys.push(`${def.sprite}_exhausted`);
    for (let l = district.level; l >= 1; l--) keys.push(`${def.sprite}_l${l}`);
    keys.push(def.sprite);
    let drewExhaustedPlot = false;
    let tall = 0;
    // Its card is open: a small white pulse — the art a touch brighter and a
    // soft white glow around its edge — breathing while the card stays up.
    const inspected = !lifted && district.uniqueId === markers.inspectedDistrictId;
    const pulse = inspected ? selectedPulse() : 0;
    // The glow is the art's own shape, baked once and laid UNDER it — the
    // first key with art, the same one `stand` will draw.
    const glowKey = inspected ? keys.find((k) => spriteAspect(k) !== null) : undefined;
    const glow = (): void => {
      if (glowKey === undefined || lighting) return;
      ctx.save();
      ctx.globalAlpha *= 0.35 + 0.55 * pulse;
      drawStandingGlow(ctx, glowKey, foot.x, foot.y, box.w, size * 0.06, '#fff');
      ctx.restore();
    };
    punched(coordKey(district.location), box, () => {
      brightened(0.18 * pulse, () => {
        tall = stand(box, keys, def.glyph, (draw) => {
          const drew = flip(() => { glow(); return draw(); });
          drewExhaustedPlot = drew > 0 && exhaustedPlot &&
            spriteAspect(`${def.sprite}_exhausted`) !== null;
          return drew;
        });
      });
    });
    // WHERE THE ROOF IS. A label belongs above the building, and how tall a
    // building is, is an art decision — so it is read back off the art that
    // was actually drawn rather than guessed from the footprint.
    const roof = foot.y - tall;
    // Being built or upgraded, by a builder at work: the card's hammer
    // works it here too, over the upper half of its art.
    if (state.city.queue.some((q) => q.districtUniqueId === district.uniqueId && q.startedAt !== null)) {
      const hw = Math.min(box.w, size * 1.6);
      drawWorkingHammer(ctx, district.uniqueId, c.x - hw / 2, roof + (foot.y - roof) * 0.15, hw, clockNow);
    }
    if (district.state === 'UnderConstruction') {
      ctx.fillStyle = PALETTE.constructionHatch;
      fillDiamond(ctx, box);
    } else {
      if (district.level > 1) {
        ctx.fillStyle = PALETTE.label;
        ctx.font = labelFont(size * 0.16, 12);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(`L${district.level}`, box.x + box.w - 3, roof);
      }
      // Exhausted crop plot: withered overlay (unless its sprite covers it).
      if (exhaustedPlot && !drewExhaustedPlot) {
        drawGlyph(ctx, CROPS_EXHAUSTED_GLYPH, box.x, c.y - box.h * 0.5, box.w, size * 0.3, box.h);
      }
      // A district that is itself a resource cell (FarmLands → Crops,
      // lived-in Housing → Taxes): wear/recovery bar.
      if (def.providesHarvestSource !== null) drawResourceState(district.location, box);
      // Townhall: villager-training progress bar, and the population count.
      //
      // Population is drawn HERE rather than in the header because the
      // Townhall is where villagers come from: the number and the button that
      // changes it are the same object, so wanting more people and knowing
      // how many you have are one glance instead of two. It also buys the
      // header back the width the widget was costing on a phone.
      if (district.definitionId === 'Townhall') {
        drawPill(c.x, roof - 2, `${formatCount(state.city.population)}/${formatCount(maxPopulation(state))}`,
          { icon: 'population' });
      }
      // Needs-workers warning.
      if (def.maxWorkersPerLevel.length > 0 && district.assignedWorkers === 0) {
        drawGlyph(ctx, '⚠️', c.x - box.w * 0.2, roof - size * 0.3, box.w * 0.4, size * 0.26, size * 0.4);
      }
    }
    if (lifted) ctx.globalAlpha = 1;
    return tall;
  };

  // ------------------------------------------------------------ THE FLOOR
  //
  // Pass 1: terrain, the grid, and the fog over it. Every cell of the ground
  // is a DIAMOND: the projection is 2:1 isometric, so a square of ground is
  // drawn twice as wide as it is tall (src/render/palette.ts).
  //
  // Nothing that STANDS on the ground is drawn here. A tall thing painted
  // cell by cell would be overpainted by the floor of the cell behind it, so
  // features, sites and buildings are collected into one depth-sorted pass
  // below — the painter's algorithm, which is the whole cost of isometry.
  /**
   * WHAT THE FOG DOES TO A THING STANDING IN IT.
   *
   * The scrim is painted on the floor, and until the painter's-algorithm pass
   * arrived that was enough: a feature was drawn in the same per-cell loop,
   * just before its own cell's scrim went down over it. Depth sorting moved
   * every standing thing to AFTER the whole floor, and the trees came out
   * lit like noon on ground the player has not paid for.
   *
   * So a fogged cell pales its own prop, the way the veil pales its ground:
   * the colour drains and the light lifts (Docs/art/art-direction.md §8.1).
   * The lower the number, the deeper in the mist — a cell the player cannot
   * buy yet takes it twice.
   */
  const FOG_DIM = 0.45;
  /** A chest in the fog is paled far less than the ground it sits on. */
  const TREASURE_DIM = 0.85;
  // From a copy of the art baked once per sprite (sprites.ts
  // `withSpriteLook`), never `ctx.filter`: a frame at the fog's edge has a
  // wood's worth of trees in it.
  const dimmed = (dim: number, draw: () => void): void => {
    if (dim >= 1) { draw(); return; }
    withSpriteLook(ctx, { brightness: 1 + 0.18 * (1 - dim), saturate: 0.15 + 0.7 * dim }, draw);
  };

  /**
   * A CLOUD OF THE BANK on a cell the fog still hides — or on no cell at all,
   * past the map's edge (art-direction.md §8.1). A cell that touches ground
   * the player can see takes the WALL, the bank rising where it meets the
   * mist. Each drifts on the spot, a few pixels on a loop of its own, and
   * never across its cell.
   */
  /** How many cells wide a cloud of the bank is drawn. */
  const CLOUD_SPAN = 1.7;
  /** How flat the bank lies, and how far the wall rises. */
  const CLOUD_SQUASH = 0.55;
  const CLOUD_WALL_SQUASH = 0.85;
  /** How far below its cell's front corner a cloud's foot sits, in cell
   *  heights — so it covers its own ground rather than standing on it. */
  const CLOUD_SINK = 0.35;
  /** The patch of mist on a cell the player can pay for: how wide, how flat,
   *  and how thick before the first tap — it thins with every tap. */
  const PATCH_SPAN = 1.25;
  const PATCH_SQUASH = 0.45;
  const PATCH_ALPHA = 0.45;

  /**
   * THE GROUND THE PLAYER CAN SEE, on screen: no cloud of the bank covers it.
   * A cloud is wider than its cell and rises toward the back, so one standing
   * in front of seen ground would hide it; a cloud near any is clipped to the
   * frame less those cells (evenodd: the frame, and every seen diamond as a
   * hole in it). A cushion lies on Discovered ground by design, so it is kept
   * off the Revealed alone. Filled in by the floor pass below, read when the
   * clouds are drawn.
   */
  const seenOnScreen = new Set<string>();
  const clearOfBank = new Path2D();
  const clearOfCushion = new Path2D();
  clearOfBank.rect(-w, -h, w * 3, h * 3);
  clearOfCushion.rect(-w, -h, w * 3, h * 3);
  const nearSeen = (cell: Coord): boolean => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (seenOnScreen.has(coordKey({ x: cell.x + dx, y: cell.y + dy }))) return true;
      }
    }
    return false;
  };
  const clippedTo = (clear: Path2D, cell: Coord, draw: () => void): void => {
    if (!nearSeen(cell)) { draw(); return; }
    ctx.save();
    ctx.clip(clear, 'evenodd');
    draw();
    ctx.restore();
  };

  /** A site on this cell stays in view through the cushion. */
  const cellHasSiteForView = (cell: Coord): boolean =>
    landmarkDefAt(cell) !== undefined || standingAbandonedAt(state, cell) !== undefined
    || standingLairAt(state, cell) !== undefined;

  const queueCloud = (cell: Coord): void => {
    const box = cellRect(cell);
    if (box.x + box.w * 1.5 < 0 || box.x - box.w * 0.5 > w || box.y + box.h * 2 < 0 || box.y - box.h > h) return;
    const wall = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].some((d) => {
      const n = { x: cell.x + d.x, y: cell.y + d.y };
      return map.terrain.has(coordKey(n)) && fogState(state, map, n) !== 'Undiscovered';
    });
    const key = variantKey(wall ? 'fog_wall' : 'fog_cloud', cell);
    const aspect = spriteAspect(key);
    if (aspect === null) return;
    const phase = ((cell.x * 73856093) ^ (cell.y * 19349663)) >>> 0;
    const sway = Math.sin(clockNow / 3200 + (phase % 628) / 100) * size * 0.012;
    // Wider than its cell, so neighbours knit into one bank, and FLATTENED:
    // the bank lies on the province, and only the wall rises — about a cell
    // high — where it meets the mist (art-direction.md §8.1).
    // A little of each cloud's size and seat is its own, by the cell's hash,
    // so a field of them reads as a bank rather than as wallpaper.
    const jitter = (n: number): number => ((phase >>> n) % 1000) / 1000 - 0.5;
    const cw = box.w * CLOUD_SPAN * (1 + 0.22 * jitter(3));
    const ch = cw * aspect * (wall ? CLOUD_WALL_SQUASH : CLOUD_SQUASH) * (1 + 0.3 * jitter(13));
    const foot = base(box);
    const dx = box.w * 0.18 * jitter(7);
    const dy = box.h * 0.25 * jitter(19);
    // Half a row back: a cloud is wider than its cell, and one level with a
    // building or a tree beside it would otherwise spill over its art.
    later(cell, () => clippedTo(clearOfBank, cell, () => {
      drawSprite(ctx, key, foot.x - cw / 2 + sway + dx, foot.y + box.h * CLOUD_SINK - ch + dy, cw, ch);
    }), undefined, { depthBias: -0.5 });
  };

  interface Standing {
    depth: number;
    tie: number;
    /** `mark` reports the rect the art ACTUALLY landed on, once it is drawn. */
    draw: (mark: (r: PlotBox) => void) => void;
    /**
     * What it covers on screen. Starts as the ground plot and is replaced by
     * the drawn art the moment there is any, because the two are nothing
     * alike: a hall's art rises far above its plot, and a crop plot's barely
     * leaves it. Testing the plot said a field of wheat hides a standing
     * villager, which it plainly does not.
     */
    rect: PlotBox;
    /** Set on PEOPLE: draw me again as a silhouette, clipped to whatever is
     *  in front of me. Absent on scenery, which may be hidden freely. */
    ghost?: (clip: PlotBox[]) => void;
    /** False for things low enough to stand IN (`NEVER_HIDES`). They keep
     *  their place in the draw order and simply never hide anybody. */
    occludes?: boolean;
  }
  const standing: Standing[] = [];
  /** Ambient villagers and workers go in the SAME list as the buildings.
   *  Drawn in a pass of their own they were on top of the world, walking
   *  over roofs. */
  function queueVillagers(): void {
    for (const v of villagers.positions(state, map, now)) {
      // A unit STANDS on the middle of its cell: its feet are the diamond's
      // centre, not the bottom-left of a square that no longer exists.
      const c = mid(cellRect(v));
      const uw = size * 0.6;   // the legacy sprite chain's box, feet at its base
      const sx = c.x - uw / 2;
      const sy = c.y - uw;
      const t = now + v.phase;
      // Cast by phase: it is per agent and stable, so a villager keeps its face.
      const [who, anim] = animFor(villagerFor(v.phase), v.walking ? 'walk' : 'idle');
      // Takes its context so the same drawing can go into the outline's
      // offscreen canvas as well as onto the map.
      const paint = (g: CanvasRenderingContext2D): void => {
        unitTransform(g, sx + uw / 2, sy + uw, v.walking && facesRight(v.dx), () => {
          if (drawCharacter(g, who, anim, t, sx + uw / 2, sy + uw, unitHeight(size))) return;
          {
            drawGlyph(g, '🧍', sx, sy, uw, size * 0.34);
          }
        });
      };
      const rect = personRect(c.x, c.y);
      // Span of ONE, not zero: a person is drawn at the CENTRE of their cell,
      // so that is where they must be sorted. Measured at the corner, every
      // villager sorted a whole cell too far back and wore an outline in
      // front of the crop plot they were standing on.
      later(v, () => paint(ctx), { x: 1, y: 1 },
        { rect, ghost: (clip) => asGhost(clip, rect, paint) });
    }
  }

  /**
   * Queue a thing to be drawn in depth order.
   *
   * DEPTH IS THE CENTRE OF ITS FOOTPRINT, `x + y` through the middle of it,
   * not through its anchor. Cells on one diagonal are the same distance from
   * the viewer and a larger sum is nearer, so a larger sum draws later. The
   * centre and not the corner because a PERSON is a point and a building is
   * an area: measured at its anchor, a 2×2 hall lost to every villager
   * standing beside it, including the ones behind its back wall.
   *
   * `span` of zero is a person — no area, so its foot IS its depth.
   */
  const later = (
    cell: Coord, draw: (mark: (r: PlotBox) => void) => void, span = { x: 1, y: 1 },
    extra: {
      rect?: PlotBox; ghost?: (clip: PlotBox[]) => void; occludes?: boolean;
      /** Added to the depth: below 0 sorts it behind its row. */
      depthBias?: number;
    } = {},
  ): void => {
    standing.push({
      depth: (cell.x + span.x / 2) + (cell.y + span.y / 2) + (extra.depthBias ?? 0),
      tie: cell.x + span.x,
      draw,
      rect: extra.rect ?? camera.plotBox(cell, { x: span.x || 1, y: span.y || 1 }),
      ghost: extra.ghost,
      occludes: extra.occludes,
    });
  };

  /** Do two screen rects touch at all? */
  const overlaps = (a: PlotBox, b: PlotBox): boolean =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  /** The screen box a person standing with their feet at (fx, fy) covers. */
  const personRect = (fx: number, fy: number): PlotBox => {
    const h = unitHeight(size);
    return { x: fx - h * 0.4, y: fy - h, w: h * 0.8, h };
  };

  /**
   * Where a standing sprite's INK ended up: as wide as its canvas, as tall as
   * `stand` says it drew, sitting on the plot's bottom corner. This and not
   * the plot is what can hide a person.
   */
  const artRect = (plot: PlotBox, tall: number, plots: number): PlotBox => {
    const dw = plot.w * plots;
    return { x: plot.x + plot.w / 2 - dw / 2, y: plot.y + plot.h - tall, w: dw, h: tall };
  };

  /**
   * A PERSON BEHIND SOMETHING, drawn as an OUTLINE — the way Age of Empires
   * does it: a bright rim tracing their shape with the middle left open, so
   * the building is still visible through them. A filled silhouette reads as
   * a ghost standing ON the roof; a rim reads as a person behind it.
   *
   * The rim is made by stamping the shape around a small circle and then
   * punching the shape itself back out of the middle, which needs an
   * offscreen canvas — there is no filter that leaves a hole. It is one
   * small canvas, reused, and only hidden people ever reach here.
   *
   * CLIPPED to what is actually in front, so a villager whose legs are
   * behind a wall gets an outline on the legs and stays themselves above it.
   */
  /**
   * A THING SIGHTED PAST THE FOG (01-map-and-fog.md §4.1): its own drawing
   * as one flat, cold, faint shape over the dark — there, and nothing more
   * about it. The shape is stamped on a small offscreen canvas and filled
   * with one colour, which no filter does. Returns where it landed.
   */
  let sightCanvas: HTMLCanvasElement | null = null;
  const silhouette = (plot: PlotBox, keys: string[], plots = FEATURE_PLOTS): PlotBox | null => {
    const key = keys.find((k) => spriteAspect(k) !== null);
    if (key === undefined) return null;
    const foot = base(plot);
    const cw = plot.w * plots;
    const ch = cw * spriteAspect(key)!;
    if (cw < 1 || ch < 1) return null;
    sightCanvas ??= document.createElement('canvas');
    const gc = sightCanvas;
    if (gc.width < cw * dpr || gc.height < ch * dpr) {
      gc.width = Math.ceil(cw * dpr);
      gc.height = Math.ceil(ch * dpr);
    }
    const g = gc.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, gc.width, gc.height);
    const tall = drawStanding(g, key, cw / 2, ch, plot.w, plots);
    if (tall <= 0) return null;
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = PALETTE.sighted;
    g.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalAlpha = PALETTE.sightedAlpha;
    ctx.drawImage(gc, 0, 0, Math.ceil(cw * dpr), Math.ceil(ch * dpr), foot.x - cw / 2, foot.y - ch, cw, ch);
    ctx.restore();
    return artRect(plot, tall, plots);
  };

  /** The drawings a sighted thing would be drawn with in plain view. */
  const sightKeys = (t: Sighted): string[] => {
    if (t.kind === 'lair') return [LAIRS[t.id as LairId].sprite];
    if (t.kind === 'abandoned') {
      const a = ABANDONED.find((x) => x.id === t.id);
      return a === undefined ? [] : ruinKeys(a.districtId);
    }
    if (t.kind === 'landmark') {
      const l = LANDMARKS.find((x) => x.id === t.id);
      return l === undefined ? [] : [LANDMARK_ART[l.kind].sprite];
    }
    const stem = FEATURES[t.id as FeatureId].sprite;
    return t.size === 1 ? [variantKey(stem, t.anchor)]
      : [`${stem}_${t.size}x${t.size}`, variantKey(stem, t.anchor)];
  };

  const RIM = 1.6;
  const RING: ReadonlyArray<readonly [number, number]> = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7],
  ];
  let rimCanvas: HTMLCanvasElement | null = null;
  const asGhost = (
    clip: PlotBox[], rect: PlotBox, draw: (c: CanvasRenderingContext2D) => void,
  ): void => {
    const pad = Math.ceil(RIM) + 2;
    const cw = Math.ceil(rect.w) + pad * 2;
    const ch = Math.ceil(rect.h) + pad * 2;
    if (cw <= 0 || ch <= 0) return;
    rimCanvas ??= document.createElement('canvas');
    const gc = rimCanvas;
    if (gc.width < cw * dpr || gc.height < ch * dpr) {
      gc.width = Math.ceil(cw * dpr);
      gc.height = Math.ceil(ch * dpr);
    }
    const g = gc.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, gc.width, gc.height);
    g.save();
    g.translate(pad - rect.x, pad - rect.y);
    for (const [ox, oy] of RING) {
      g.save();
      g.translate(ox * RIM, oy * RIM);
      draw(g);
      g.restore();
    }
    g.restore();
    // Everything stamped turns white, keeping its alpha — what a
    // `brightness(0) invert(1)` filter did, without one.
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, Math.ceil(cw * dpr), Math.ceil(ch * dpr));
    g.restore();
    g.save();
    g.translate(pad - rect.x, pad - rect.y);
    g.globalCompositeOperation = 'destination-out';
    draw(g);
    g.restore();

    ctx.save();
    ctx.beginPath();
    for (const r of clip) ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.globalAlpha = 0.9;
    // A dark halo under the bright rim, so it reads on a cream wall as well
    // as on a slate roof. A canvas shadow, which is not scaled by the
    // transform, so it is given in device pixels.
    ctx.shadowColor = 'rgba(10,14,20,0.95)';
    ctx.shadowBlur = dpr;
    ctx.drawImage(gc, 0, 0, Math.ceil(cw * dpr), Math.ceil(ch * dpr),
      rect.x - pad, rect.y - pad, cw, ch);
    ctx.restore();
  };

  // Every cell on screen with ground the player can see, and what its fog
  // is. The floor below is drawn from exactly this, and only this, so it is
  // also what says when the floor has to be drawn again.
  const floor: FloorCell[] = [];
  let floorSig = 0x811c9dc5;
  for (let cy = view.y0; cy <= view.y1; cy++) {
    for (let cx = view.x0; cx <= view.x1; cx++) {
      const cell = { x: cx, y: cy };
      const key = coordKey(cell);
      const terrain = map.terrain.get(key);
      // Past the map's edge, and under the fog, is the cloud bank.
      if (!terrain) { queueCloud(cell); continue; }
      const fog = fogState(state, map, cell);
      if (fog === 'Undiscovered') { queueCloud(cell); continue; }
      const payable = fog === 'Discovered' && isPayable(state, map, cell);
      const taps = fog === 'Discovered' ? state.fog.progress[key] ?? 0 : 0;
      const box = cellRect(cell);
      floor.push({ cell, key, terrain, fog, payable, taps, box });
      seenOnScreen.add(key);
      diamondPath(clearOfBank, box);
      if (fog === 'Revealed') diamondPath(clearOfCushion, box);
      const code = fog === 'Revealed' ? 1 : (payable ? 2 : 3) + 4 * taps;
      floorSig = Math.imul(floorSig ^ (((cx & 0xffff) << 16) | (cy & 0xffff)), 16777619);
      floorSig = Math.imul(floorSig ^ code, 16777619);
    }
  }
  drawFloor(canvas, ctx, camera, map, floor, floorSig >>> 0, w, h, dpr);

  for (const { cell, key, fog, payable, box } of floor) {
    const cx = cell.x;
    const cy = cell.y;

    // How dark anything standing on this cell has to be — the floor's
    // scrim, said again for what stands on it, from the same `payable`.
    const dim = fog === 'Discovered' ? (payable ? FOG_DIM : FOG_DIM * FOG_DIM) : 1;
    const feature = state.features[key];
    const district = state.city.districts.find((d) => districtOccupies(d, cell));
    if (district) continue; // drawn (with its overlays) in the district pass

    // Features (Forest): normal or exhausted sprite, emoji fallback.
    if (feature) {
      const def = FEATURES[feature];
      const exhausted = recoversAt(state, map, cell, now) !== null;
      // A feature that spans cells is ONE THING: drawn once, on its anchor,
      // across its whole block (Docs/features/01-map-and-fog.md §3.1). Every
      // other cell of it draws nothing at all.
      const { anchor, size } = footprintAt(map, cell);
      if (anchor.x === cx && anchor.y === cy) {
        const plot = size === 1 ? box : camera.plotBox(anchor, { x: size, y: size });
        // A feature picks a drawing the way the ground does: twenty cells of
        // one tree shape is a wallpaper, not a wood. A bigger block asks for
        // the drawing made for it — `mountain_2x2` — and falls back to the
        // 1×1 while that art does not exist.
        const stem = exhausted ? `${def.sprite}_exhausted` : def.sprite;
        const keys = size === 1
          ? [variantKey(stem, cell)]
          : [`${stem}_${size}x${size}`, variantKey(stem, cell)];
        later(cell, () => dimmed(dim, () => {
          punched(key, plot, () => {
            stand(plot, keys,
              exhausted ? def.exhaustedGlyph : def.glyph, undefined, FEATURE_PLOTS);
          });
        }), { x: size, y: size });
      }
    }

    // Landmarks and lairs: authored sites, drawn where a feature would be.
    // They are what the fog is FOR, so they get the same weight as a forest
    // and a badge saying whether they still want something from you.
    //
    // Drawn through the fog, exactly like a feature. A site you cannot see
    // until you have already paid to stand on it is not a destination —
    // it is a surprise, and the whole economy is built on the player
    // choosing which direction to spend Gold in. The Discovered scrim below
    // still dims them, so "there, and not yet yours" reads at a glance.
    const landmark = landmarkDefAt(cell);
    if (landmark && landmark.location.x === cx && landmark.location.y === cy) {
      const art = LANDMARK_ART[landmark.kind];
      const claimed = state.landmarks.claimed[landmark.id] === true;
      // A site that spans cells is drawn ONCE, over the whole of it, from
      // its anchor (Docs/features/01-map-and-fog.md §3.1).
      const plot = landmark.size === 1
        ? box : camera.plotBox(cell, { x: landmark.size, y: landmark.size });
      later(cell, (mark) => {
        dimmed(dim, () => {
          punched(key, plot, () => {
            mark(artRect(plot,
              stand(plot, [art.sprite], art.glyph, undefined, FEATURE_PLOTS), FEATURE_PLOTS));
          });
        });
        // A star means "claimable". Nothing holds a sanctuary: it is bought.
        // NOT dimmed: a badge is the game talking, not part of the world.
        if (!claimed) drawSiteBadge(plot, '✦');
      }, { x: landmark.size, y: landmark.size });
    }
    // A treasure (01-map-and-fog.md §6.2): a closed chest while the cell is
    // fog — a thing to go and get, so it stands out of the scrim more than
    // the ground under it — and, once revealed, what it holds, waiting for
    // the tap that picks it up.
    const treasure = state.fog.treasures[key];
    if (treasure !== undefined) {
      const keys = fog === 'Revealed'
        ? [`treasure_${treasure.coin.toLowerCase()}`, 'treasure_closed']
        : ['treasure_closed'];
      later(cell, () => dimmed(fog === 'Revealed' ? 1 : TREASURE_DIM, () => {
        punched(key, box, () => { stand(box, keys, ''); });
      }));
    }

    // An abandoned building (01-map-and-fog.md §6.3): its ruin, drawn as a
    // building is — one plot across, feet on the plot's bottom corner — and
    // dimmed by the fog like anything standing in it.
    const ruin = standingAbandonedAt(state, cell);
    if (ruin && ruin.location.x === cx && ruin.location.y === cy) {
      const size = DISTRICTS[ruin.districtId].size;
      const plot = size.x === 1 && size.y === 1 ? box : camera.plotBox(cell, size);
      later(cell, (mark) => {
        dimmed(dim, () => {
          punched(key, plot, () => {
            mark(artRect(plot, stand(plot, ruinKeys(ruin.districtId), ''), 1));
          });
        });
      }, size);
    }

    if (fog === 'Revealed') drawResourceState(cell, box);

    if (fog === 'Discovered') {
      // A cell you can see but cannot buy yet lies under a cushion of cloud
      // (the floor's veil, drawFloor). The cushion stands over what is on
      // the cell, so only the tips of tall things clear it; a site is left
      // in view.
      if (!payable && !cellHasSiteForView(cell)) later(cell, () => clippedTo(clearOfCushion, cell, () => { stand(box, ['fog_cloud_cushion'], ''); }));
      // A cell the player can pay for keeps a thin patch of mist over what is
      // on it, so it reads as part of the bank and still shows its contents.
      if (payable) {
        const patchKey = variantKey('fog_cloud', cell);
        const aspect = spriteAspect(patchKey);
        if (aspect !== null) {
          const thin = 1 - 0.6 * ((state.fog.progress[key] ?? 0) / FOG.tapsToReveal);
          const phase = ((cell.x * 73856093) ^ (cell.y * 19349663)) >>> 0;
          const sway = Math.sin(clockNow / 3600 + (phase % 628) / 100) * size * 0.01;
          const pw = box.w * PATCH_SPAN;
          const ph = pw * aspect * PATCH_SQUASH;
          const foot = base(box);
          later(cell, () => clippedTo(clearOfCushion, cell, () => {
            ctx.save();
            ctx.globalAlpha *= PATCH_ALPHA * thin;
            drawSprite(ctx, patchKey, foot.x - pw / 2 + sway, foot.y + box.h * 0.1 - ph, pw, ph);
            ctx.restore();
          }));
        }
      }
      // Reveal progress only — the total cost is deliberately not shown.
      // Five taps at every ring, so the bar fills in the same five steps
      // wherever the player is standing.
      const taps = state.fog.progress[key] ?? 0;
      if (taps > 0) {
        const c = mid(box);
        drawBar(ctx, c.x - size * 0.35, c.y + th * 0.06, size * 0.7, 5,
          taps / FOG.tapsToReveal, PALETTE.progressFill);
      }
    }
    // A tap on the fog flashes the cell white, the last one too as it
    // clears (Game.flashFog).
    const flash = tapFx.sample(`fog:${key}`)?.flash ?? 0;
    if (flash > 0.02) {
      ctx.save();
      ctx.globalAlpha = flash * 0.75;
      ctx.fillStyle = PALETTE.fogFlash;
      fillDiamond(ctx, box);
      ctx.restore();
    }
  }

  // Pass 1.1: THE GROUND THE LAIRS HOLD (Docs/proposals/lairs.md §3), over
  // every fog state and under everything that stands: a tint on each cell of
  // the union of the standing zones, then a border round the union's outside
  // — solid where the cell inside is revealed, dashed where it is fog, in the
  // reach line's dash. Overlapping zones are one zone, one outline.
  const zone = heldZone(state, map);
  if (zone.cells.length > 0) {
    ctx.save();
    const clear: Coord[] = [];
    const fogged: Coord[] = [];
    for (const c of zone.cells) {
      (fogState(state, map, c) === 'Revealed' ? clear : fogged).push(c);
    }
    for (const [cells, tint] of [
      [clear, PALETTE.lairZoneTint], [fogged, PALETTE.lairZoneTintFog],
    ] as const) {
      if (cells.length === 0) continue;
      ctx.fillStyle = tint;
      ctx.beginPath();
      for (const c of cells) diamondPath(ctx, cellRect(c));
      ctx.fill();
    }
    ctx.strokeStyle = PALETTE.lairZoneBorder;
    ctx.lineWidth = Math.max(1.5, size * 0.035);
    ctx.lineCap = 'round';
    for (const [cells, dashed] of [[clear, false], [fogged, true]] as const) {
      if (cells.length === 0) continue;
      ctx.setLineDash(dashed ? [Math.max(4, size * 0.18), Math.max(3, size * 0.12)] : []);
      ctx.beginPath();
      for (const c of cells) {
        const box = cellRect(c);
        for (const side of outerSides(c, zone.keys)) edgePath(ctx, box, side);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Pass 1.1b: a CLAIMED lair's ground, letting go. The zone fades out over
  // the going-away (VANISH_MS) instead of blinking off, so the player sees the
  // ground come back to them.
  const letting = vanishingPhases(vanishing, clockNow);
  for (const [id, t] of letting) {
    const cells = lairZoneCells(id).filter((c) => map.terrain.has(coordKey(c)) && !zone.keys.has(coordKey(c)));
    if (cells.length === 0) continue;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = PALETTE.lairZoneTint;
    ctx.beginPath();
    for (const c of cells) diamondPath(ctx, cellRect(c));
    ctx.fill();
    ctx.restore();
  }

  // Pass 1.1c: THE WORK AREA the markers carry (a selected building's range,
  // a placement's, a spell's targets), over the floor and under
  // everything that stands on it — trees and buildings stand in front of
  // the line (render/areaOverlays.ts).
  drawArea(ctx, markers.influenceCells, cellRect, (b) => diamondPath(ctx, b), size,
    performance.now());
  // Where a building may go (or a spell may land): ONE region in the work
  // area's line, not a diamond per cell (render/areaOverlays.ts); its
  // labels, if any, are Pass 3's.
  drawAreaLine(ctx, markers.validCells
    .filter(({ cell }) => fogState(state, map, cell) !== 'Undiscovered')
    .map(({ cell }) => cell), cellRect, size);

  // Pass 1.2: the Townhall's reach (01-map-and-fog.md §4). A line of white
  // dots along the last ring the player may pay for, with a soft shadow on
  // the far side, drawn over the fog and across undiscovered ground too, so
  // the extent of what the capital allows is read off the map before a tap
  // is refused. Nothing is drawn when the reach holds the whole province.
  {
    const visible: Coord[] = [];
    for (let cy = view.y0; cy <= view.y1; cy++) {
      for (let cx = view.x0; cx <= view.x1; cx++) visible.push({ x: cx, y: cy });
    }
    drawReach(ctx, reachBorder(state, map, visible), cellRect, size);
  }

  // Pass 1.5: districts, each drawn once spanning its full footprint — and
  // queued into the same depth-sorted list the props are in, so a hall in
  // front of a forest covers it and never the other way round.
  // Where each building's art was drawn, so its collect bubble can sit on
  // its roof whatever height the art is.
  const artOf = new Map<string, PlotBox>();
  for (const district of state.city.districts) {
    if (fogState(state, map, district.location) !== 'Revealed') continue;
    const def = DISTRICTS[district.definitionId];
    const box = camera.plotBox(district.location, def.size);
    if (box.x + box.w < 0 || box.y + box.h < 0 || box.x > w || box.y - box.w > h) continue;
    later(district.location,
      (mark) => {
        const art = artRect(box, drawDistrict(district, box), 1);
        artOf.set(district.uniqueId, art);
        mark(art);
      }, def.size,
      { occludes: !NEVER_HIDES.has(district.definitionId) });
  }

  // THE LAIRS, once FOUND and until cleared (Docs/proposals/lairs.md §2.1,
  // §5) — whatever the fog on their own plot, since a lair is found by
  // revealing any cell of its zone. Queued here rather than in the floor loop,
  // which skips Undiscovered cells, and depth-sorted with everything else.
  // Under fog the model is dimmed as a feature would be; its bubble is not.
  const lairArt = new Map<LairId, PlotBox>();
  clearLairArt();
  for (const id of LAIR_ORDER) {
    const lair = standingLairAt(state, LAIRS[id].location);
    if (!lair) continue;
    const plot = camera.plotBox(lair.location, { x: lair.size, y: lair.size });
    if (plot.x + plot.w * 1.5 < 0 || plot.x - plot.w * 0.5 > w
      || plot.y + plot.h < 0 || plot.y - plot.w * 1.5 > h) continue;
    const fog = fogState(state, map, lair.location);
    const dim = fog === 'Revealed' ? 1 : FOG_DIM;
    const key = coordKey(lair.location);
    later(lair.location, (mark) => {
      dimmed(dim, () => {
        punched(key, plot, () => {
          const art = artRect(plot,
            stand(plot, [lair.sprite], lair.glyph, undefined, FEATURE_PLOTS), FEATURE_PLOTS);
          lairArt.set(id, art);
          markLairArt(id, art, (u, v) => spriteSolidAt(lair.sprite, u, v));
          mark(art);
        });
      });
    }, { x: lair.size, y: lair.size });
  }

  // …and a CLAIMED one, going: it sinks a little into its ground and fades,
  // under a ring of dust, over VANISH_MS, then it is gone for good.
  for (const [id, t] of letting) {
    const lair = LAIRS[id];
    const plot = camera.plotBox(lair.location, { x: lair.size, y: lair.size });
    const sunk = { ...plot, y: plot.y + plot.h * 0.18 * t };
    later(lair.location, (mark) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t * 1.15);
      mark(artRect(sunk, stand(sunk, [lair.sprite], lair.glyph, undefined, FEATURE_PLOTS), FEATURE_PLOTS));
      ctx.restore();
      drawDust(ctx, plot, t, id);
    }, { x: lair.size, y: lair.size });
  }

  // SIGHTED: the tall things past the fog a revealed cell is close enough to
  // see (01-map-and-fog.md §4.1), in the same depth order as everything.
  for (const t of sightedThings(state, map)) {
    const span = { x: t.size, y: t.size };
    const plot = camera.plotBox(t.anchor, span);
    if (plot.x + plot.w * 1.5 < 0 || plot.x - plot.w * 0.5 > w
      || plot.y + plot.h < 0 || plot.y - plot.w * 2 > h) continue;
    const keys = sightKeys(t);
    // A ruin is building art: one plot across, where a feature's is two.
    const plots = t.kind === 'abandoned' ? 1 : FEATURE_PLOTS;
    // A row forward: the clouds of the cells just in front rise about a cell,
    // and a ruin, one plot tall, would sink out of sight behind them.
    later(t.anchor, (mark) => {
      const art = silhouette(plot, keys, plots);
      if (art !== null) mark(art);
    }, span, { depthBias: 1 });
  }

  // The people go in the same list, so a villager behind a hall is behind it.
  queueVillagers();
  queueWorkers();

  // Run every standing thing back to front: the painter's algorithm.
  standing.sort((a, b) => a.depth - b.depth || a.tie - b.tie);
  for (const item of standing) item.draw((r) => { item.rect = r; });

  /**
   * THE PEOPLE BEHIND THE BUILDINGS.
   *
   * Depth order is right, and right is not enough: a villager walking behind
   * a hall is CORRECTLY invisible, and a player who cannot see their
   * villagers thinks they have lost them. So anyone a later thing covered is
   * drawn once more as a silhouette, over everything — and only over the
   * part of them that is actually covered.
   *
   * Only people. Scenery may hide behind scenery all it likes — that is what
   * makes a wood a wood.
   */
  for (const item of standing) {
    if (!item.ghost) continue;
    const over = standing.filter(
      (o) => o !== item && o.occludes !== false
        && o.depth > item.depth && overlaps(o.rect, item.rect),
    );
    if (over.length > 0) item.ghost(over.map((o) => o.rect));
  }

  // Pass 2: queue progress bars over districts.
  for (const item of state.city.queue) {
    const district = state.city.districts.find((d) => d.uniqueId === item.districtUniqueId);
    if (!district) continue;
    const b = camera.plotBox(district.location, DISTRICTS[district.definitionId].size);
    const c = mid(b);
    const progress = queueProgress(item, now);
    const remaining = Math.ceil(remainingSeconds(item, now));
    // On the plot, not over the scaffolding: the bar belongs to the ground
    // being worked, and the art above it is allowed to be any height. The
    // kit's glass bar, blue as the card wears it, with the time inside.
    const barH = Math.max(20, Math.min(28, size * 0.22));
    const barW = Math.max(barH * 4, b.w * 0.6);
    drawTroughBar(ctx, c.x - barW / 2, c.y - barH / 2, barW, barH, progress,
      item.startedAt === null ? 'queued' : formatDuration(remaining), labelFont(barH * 0.6, 12, true));
  }

  // Pass 2b: TRAINING, on every building with someone in its line — the
  // kit's bar, green as the training card wears it: the fill is the one in
  // training now, the time is the WHOLE line's. Under a construction bar if
  // the building also has one.
  for (const district of state.city.districts) {
    if (district.state !== 'Built' || !unitInTraining(state, district.uniqueId)) continue;
    const b = camera.plotBox(district.location, DISTRICTS[district.definitionId].size);
    const c = mid(b);
    const barH = Math.max(20, Math.min(28, size * 0.22));
    const barW = Math.max(barH * 4, b.w * 0.6);
    const building = state.city.queue.some((q) => q.districtUniqueId === district.uniqueId);
    // The portrait rides the bar's left end, so the bar steps right by half
    // of it and the pair stays centred on the plot.
    const d = barH * 1.7;
    const x = c.x - barW / 2 + d * 0.3;
    const y = c.y - barH / 2 + (building ? barH * 1.15 : 0);
    drawTroughBar(ctx, x, y, barW, barH, trainingProgress(state, district.uniqueId, now),
      formatDuration(Math.ceil(lineRemainingSeconds(state, district.uniqueId, now))),
      labelFont(barH * 0.6, 12, true), 'green');
    const line = lineFor(state, district.uniqueId);
    const trainee = line[0].trainee;
    const bust = `${trainee === 'Villager' ? 'unit_villager' : UNITS[trainee as UnitId].sprite}_avatar`;
    drawTraineeBadge(ctx, x, y + barH / 2, d, bust,
      line.reduce((n, item) => n + itemCount(item), 0), labelFont(d * 0.3, 12, true));
  }

  // Pass 3a: SPELLS STANDING ON THE GROUND.
  //
  // Drawn before every other marker, because a zone is a fact about the world
  // rather than a preview of a decision: a placement outline or a cast target
  // must be able to sit ON TOP of it and still be read.
  //
  // THE TINT SAYS "THERE IS MAGIC HERE" AND THE WHEEL SAYS FOR HOW LONG, and
  // they are drawn on different things on purpose: the tint on EVERY covered
  // cell, because the question it answers is *which ground* — and the wheel on
  // the CENTRE alone, because a countdown repeated across twenty-five cells is
  // twenty-five things to read that all say the same number.
  for (const zone of markers.spellZones) {
    const inZone = new Set(zone.cells.map(coordKey));
    // The pulse is the whole of the "living" read, and it is slow — a zone
    // stands for minutes, so anything quick would be a distraction rather
    // than a presence.
    const pulse = 0.82 + 0.18 * Math.sin(spellPhase() * Math.PI * 2);
    ctx.save();
    ctx.globalAlpha = pulse;
    // THE GLOW IS THE GROUND. A drawn haze under every covered cell, larger
    // than the cell so neighbours bleed into one another and a block of tiles
    // reads as ONE enchanted area rather than as a chequerboard of lit
    // squares. The flat fill stays underneath it as the floor of the effect,
    // so the zone is still legible before the art loads.
    ctx.fillStyle = PALETTE.spellFill;
    ctx.beginPath();
    for (const cell of zone.cells) diamondPath(ctx, cellRect(cell));
    ctx.fill();
    ctx.globalAlpha = pulse * 0.2;
    for (const cell of zone.cells) {
      const b = cellRect(cell);
      drawSprite(ctx, 'spell_glow', b.x - b.w * 0.1, b.y - b.h * 0.6, b.w * 1.2, b.h * 2.2);
    }
    // A SIGIL ON A FEW CELLS, and FEW is the whole point. A zone is 81 cells
    // at radius 4 and 121 at radius 5; a mark on each is a rash that buries
    // the kingdom the player is trying to look at. These are TEXTURE — enough
    // to say the ground is enchanted, never enough to count. One in seven, by
    // a hash, so they hold still while the zone is redrawn.
    ctx.globalAlpha = pulse * 0.4;
    for (const cell of zone.cells) {
      const seed = ((cell.x * 374761393) ^ (cell.y * 668265263)) >>> 0;
      if (seed % 7 !== 0) continue;
      const c = mid(cellRect(cell));
      drawSprite(ctx, 'spell_sigil', c.x - size * 0.2, c.y - size * 0.2, size * 0.4, size * 0.4);
    }
    // The border traces the OUTSIDE of the whole zone, never the grid inside
    // it: what is enchanted is an area, not a set of squares.
    ctx.strokeStyle = PALETTE.spellBorder;
    ctx.lineWidth = 3;
    ctx.shadowColor = PALETTE.spellGlow;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (const cell of zone.cells) outline(cellRect(cell), cell, inZone);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // MOTES: two per cell, drifting upward on a loop seeded by the cell, so a
    // big zone shimmers without any two cells moving alike. They are the
    // "living" half of the read — a flat tint alone says a rule applies here,
    // where something MOVING says a spell is working.
    // NO shadow on these. The border draws four segments and can afford a
    // blur; the motes are two per cell and a radius-5 zone is 121 of them, so
    // a blurred mote is 242 blurred circles a frame.
    ctx.fillStyle = PALETTE.spellGlow;
    const moteSize = Math.max(5, size * 0.2);
    for (const cell of zone.cells) {
      // One mote a cell, and only on the cells the sigils skipped: two rising
      // sparkles on top of a mark is the same tile saying the same thing twice.
      const pick = ((cell.x * 374761393) ^ (cell.y * 668265263)) >>> 0;
      if (pick % 3 !== 1) continue;
      const b = cellRect(cell);
      const c = mid(b);
      for (let i = 0; i < 1; i++) {
        const seed = ((cell.x * 73856093) ^ (cell.y * 19349663) ^ (i * 83492791)) >>> 0;
        const t = (spellPhase() + (seed % 1000) / 1000) % 1;
        const mx = c.x + (((seed >>> 10) % 100) / 100 - 0.5) * b.w * 0.5;
        const my = c.y + b.h * 0.3 - t * size;
        ctx.globalAlpha = pulse * Math.sin(t * Math.PI) * 0.75;
        // The drawn mote if the sheet has landed, a plain dot if it has not —
        // the same fallback every sprite in the game has, so art lands one
        // file at a time.
        if (!drawSprite(ctx, 'spell_mote', mx - moteSize / 2, my - moteSize / 2, moteSize, moteSize)) {
          ctx.beginPath();
          ctx.arc(mx, my, Math.max(2, size * 0.07), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // THE WHEEL, on the centre: a dark disc with the window sweeping off it
    // clockwise from twelve, and the relic's own glyph in the middle so two
    // zones standing at once are told apart by WHOSE they are.
    const wheel = mid(cellRect(zone.centre));
    const cx = wheel.x;
    const cy = wheel.y;
    const r = size * 0.3;
    ctx.save();
    // THE RUNE CIRCLE turns under the wheel, one slow revolution a cycle. It
    // is the only thing in the zone that rotates, which is what makes the
    // centre read as the source rather than as one more lit tile.
    //
    // Its own save/restore: the rotation must come off cleanly, and resetting
    // the transform outright would take the CAMERA with it.
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.translate(cx, cy);
    ctx.rotate(spellPhase() * Math.PI * 2);
    drawSprite(ctx, 'spell_rune', -size * 0.55, -size * 0.55, size * 1.1, size * 1.1);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.spellDial;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * zone.left);
    ctx.closePath();
    ctx.fillStyle = PALETTE.spellGlow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = PALETTE.spellBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `${Math.round(r)}px ${labelFace()}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(zone.glyph, cx, cy + r * 0.05);
    ctx.restore();
  }

  // Pass 3: markers. (The work area is Pass 1.1c: it lies under what stands.)
  for (const { cell, label } of markers.validCells) {
    if (fogState(state, map, cell) === 'Undiscovered') continue;
    const b = cellRect(cell);
    if (label) {
      const c = mid(b);
      ctx.fillStyle = markers.validColor;
      ctx.font = labelFont(size * 0.16, 12);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, c.x, c.y);
    }
  }
  if (markers.previewCell && markers.previewGlyph) {
    const b = camera.plotBox(markers.previewCell, markers.previewSize ?? { x: 1, y: 1 });
    // No footprint diamond: the ghost's rim and its move arrows are what
    // tell it apart, and a square round its feet was one outline too many.
    // New builds preview at level 1; fall back to the un-levelled sprite.
    const sprite = markers.previewSprite;
    const keys = sprite ? [`${sprite}_l1`, sprite] : [];
    // A solid rim round the ghost, opaque under the translucent building,
    // so it stands out from the grass and the roofs around it.
    ctx.globalAlpha = 1;
    const foot = base(b);
    const rim = Math.max(2.5, b.w / (markers.previewSize ? markers.previewSize.x + markers.previewSize.y : 2) * 0.05);
    keys.some((k) => drawStandingOutline(ctx, k, foot.x, foot.y, b.w, PALETTE.ghostOutline, rim));
    ctx.globalAlpha = 0.6;
    stand(b, keys, markers.previewGlyph);
    ctx.globalAlpha = 1;
    drawMoveArrows(markers.previewCell, markers.previewSize ?? { x: 1, y: 1 }, markers.previewSteps);
  }
  // A placement's or a move's target is the ghost itself; only a spell's
  // target keeps the outline.
  if (markers.selected && !markers.previewCell) {
    ctx.strokeStyle = PALETTE.selected;
    ctx.lineWidth = 3;
    strokeDiamond(ctx, camera.plotBox(markers.selected, markers.selectedSize ?? { x: 1, y: 1 }), 2);
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
    const c = mid(cellRect(cell));
    drawPill(c.x, c.y + th * 0.4, label, {
      icon,
      fontScale: 0.2,
      ink: tone === 'bad' ? PALETTE.yieldNegative
        : tone === 'good' ? PALETTE.yieldPositive : PALETTE.label,
    });
  }



  // Pass 3.8: the quest hint — the tutorial's own sign (Docs/features/
  // 24-dialogue.md §4): the plot's diamond lit in the blue magic glow, and
  // the gloved hand bobbing over it. One sign for "here" across the map and
  // the menus, and never an emoji.
  if (markers.hintCell) {
    const b = cellRect(markers.hintCell);
    const c = mid(b);
    const bob = Math.sin(now / 140) * size * 0.07;
    const pulse = 0.5 + 0.5 * Math.sin(now / 220);
    ctx.save();
    ctx.shadowColor = '#3c9dff';
    ctx.shadowBlur = 10 + pulse * 10;
    ctx.strokeStyle = '#c8f0ff';
    ctx.lineWidth = 3;
    strokeDiamond(ctx, b, 3);
    ctx.restore();
    const handH = size * 0.5;
    const handW = handH / (spriteAspect('tutorial_hand_down') ?? 1.22);
    const tipY = c.y - size * 0.12 + bob;
    // The fingertip sits a little right of the glove's middle.
    if (!drawSprite(ctx, 'tutorial_hand_down', c.x - handW * 0.57, tipY - handH, handW, handH)) {
      const half = size * 0.22;
      ctx.beginPath();
      ctx.moveTo(c.x, tipY);
      ctx.lineTo(c.x - half, tipY - half * 1.4);
      ctx.lineTo(c.x + half, tipY - half * 1.4);
      ctx.closePath();
      ctx.fillStyle = '#f2b233';
      ctx.strokeStyle = '#5c3a1e';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    }
  }

  function queueWorkers(): void {
  // Worker units — animated. Walk cycles while moving (carry
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
    const c = mid(cellRect(pos));
    const uw = size * 0.6;
    const sx = c.x - uw / 2;
    const sy = c.y - uw;
    const t = now + unitPhase(worker.id);
    const moving = worker.activity === 'MovingToCell' || worker.activity === 'MovingHome';
    const working = worker.activity === 'Working';

    // Facing: mirror the sprite while the current leg heads left.
    let flip = false;
    if (moving && worker.claimedCell) {
      // ACROSS THE SCREEN, not across the grid: a step in +y goes left under
      // the isometric projection, so a cell-space dx alone had half the
      // workers walking backwards.
      const out = worker.activity === 'MovingToCell' ? 1 : -1;
      const dx = (worker.claimedCell.x - building.location.x) * out;
      const dy = (worker.claimedCell.y - building.location.y) * out;
      flip = facesRight(dx - dy);
    }

    const carrying = worker.carrying > 0;

    // Every working building is cast (src/render/cast.ts), the Docks included
    // — its member is the boat that rows out. The emoji below is the same last
    // resort every drawing has, not a tier anything reaches in practice.
    const member = castFor(building.definitionId, unitPhase(worker.id));
    const pose: UnitPose = moving ? 'walk' : working ? 'work' : 'idle';
    const cast = member ? animFor(member, pose) : null;
    const paint = (g: CanvasRenderingContext2D): void => {
      unitTransform(g, sx + uw / 2, sy + uw, flip, () => {
        if (cast && drawCharacter(g, cast[0], cast[1], t, sx + uw / 2, sy + uw, unitHeight(size))) {
          return;
        }
        {
          drawGlyph(g, boat ? '⛵' : '🧑‍🌾', sx, sy, uw, size * 0.34);
          if (carrying) {
            drawGlyph(g, boat ? '🐟' : '🎒', c.x, c.y - uw - size * 0.2, size * 0.5, size * 0.2);
          }
        }
      });
    };
    const rect = personRect(c.x, c.y);
    later(pos, () => paint(ctx), { x: 1, y: 1 },
      { rect, ghost: (clip) => asGhost(clip, rect, paint) });
  }
  }

  // Pass 4: COLLECT BUBBLES — over the whole world, under the UI. One per
  // building with something in its store (render/collectBubbles.ts).
  const clock = performance.now();
  for (const district of state.city.districts) {
    if (!showsCollect(state, district)) { bubbles.forget(district.uniqueId); continue; }
    const art = artOf.get(district.uniqueId);
    if (!art) continue;
    const plot = camera.plotBox(district.location, DISTRICTS[district.definitionId].size);
    // The art's box carries transparent headroom; a tenth of it down is the roof.
    drawCollectBubble(ctx, bubbles, state, district, art.x + art.w / 2, art.y + art.h * 0.12,
      Math.max(34, Math.min(88, plot.w * 0.4)), clock);
  }

  // Pass 4.5: THE WARNING BUBBLES, one over each standing lair's model, under
  // fog or not (Docs/proposals/lairs.md §6): the creature, and the time to
  // its next raid. Their rects are kept so a tap on one opens the lair.
  clearLairBubbles();
  for (const id of LAIR_ORDER) {
    const held = state.lairs[id];
    const art = lairArt.get(id);
    if (!held || held.cleared || !art) { bubbles.forget(`lair:${id}`); continue; }
    const top = art.y + art.h * spriteInkTop(LAIRS[id].sprite);
    if (held.defeated) {
      // Beaten: the reward waits, so the bubble is a store's — the chest.
      markLairBubble(id, drawClaimBubble(ctx, bubbles, `lair:${id}:claim`,
        art.x + art.w / 2, top + size * 0.1, Math.max(34, Math.min(72, size * 0.62)), clock));
      continue;
    }
    const countdown = held.nextRaidAt === null ? '–' : compactCountdown(held.nextRaidAt - now);
    markLairBubble(id, drawLairBubble(ctx, bubbles, `lair:${id}`, LAIR_AVATAR[id], countdown,
      labelFace(), art.x + art.w / 2, top + size * 0.1,
      Math.max(28, Math.min(64, size * 0.62)), clock));
  }

  // Pass 5: floaters.
  for (const f of floaters.alive()) {
    const c = mid(cellRect(f.cell));
    const fontSize = wholePx(size * 0.22, 12);
    ctx.globalAlpha = 1 - f.t;
    ctx.font = labelFont(fontSize, 12, true);
    const iconSize = f.icon ? Math.round(fontSize * 1.15) : 0;
    const gap = f.icon ? fontSize * 0.25 : 0;
    const textW = ctx.measureText(f.text).width;
    const cx = c.x;
    const midY = c.y - size * 0.2 - f.t * size * 0.5;
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

// ------------------------------------------------------------- the floor

/** One cell of the floor: its ground, and the fog over it. */
interface FloorCell {
  cell: Coord;
  key: string;
  terrain: TerrainId;
  fog: 'Revealed' | 'Discovered';
  /** Discovered and buyable now — no cushion over the veil. */
  payable: boolean;
  /** Taps already paid into it — the veil thins with each. */
  taps: number;
  box: PlotBox;
}

/**
 * THE FLOOR, KEPT. The ground, its fringes and the fog's scrim are more than
 * half of what a frame paints, and none of it moves unless the camera does
 * or the fog changes. So it is drawn into a canvas of its own and laid down
 * in one copy; it is drawn again only when what it was drawn from changes —
 * the view, or a cell's fog — or while some of its art has yet to load.
 */
interface Floor {
  canvas: HTMLCanvasElement;
  /** What it was drawn from; `complete` is false while art was missing. */
  view: string;
  sig: number;
  complete: boolean;
}
const floors = new WeakMap<HTMLCanvasElement, Floor>();

function drawFloor(
  target: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  map: MapData,
  cells: FloorCell[],
  sig: number,
  w: number,
  h: number,
  dpr: number,
): void {
  const view = `${w}|${h}|${dpr}|${camera.x}|${camera.y}|${camera.zoom}`;
  let floor = floors.get(target);
  if (floor === undefined) {
    floor = { canvas: document.createElement('canvas'), view: '', sig: 0, complete: false };
    floors.set(target, floor);
  }
  if (floor.view !== view || floor.sig !== sig || !floor.complete) {
    const fc = floor.canvas;
    if (fc.width !== target.width || fc.height !== target.height) {
      fc.width = target.width;
      fc.height = target.height;
    }
    const g = fc.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.fillStyle = PALETTE.fogUndiscovered;
    g.fillRect(0, 0, w, h);
    let complete = true;
    for (const { cell, terrain, fog, payable, taps, box } of cells) {
      // The ground: one of the terrain's drawings, picked by a hash of the
      // cell so a field of it does not weave (src/render/terrain.ts), then
      // the fringe of any neighbour that creeps over it. Flat colour while
      // the art is missing — that path has to be given the diamond shape
      // explicitly, where a drawing carries its own.
      const groundKey = terrainKey(terrain, cell);
      const ground = drawGround(g, groundKey, box);
      if (!ground) {
        if (spriteUrl(groundKey) !== null) complete = false; // still loading
        g.fillStyle = TERRAIN_COLORS[terrain];
        fillDiamond(g, box);
      }
      if (!drawTerrainFringes(g, map, cell, terrain, box)) complete = false;
      // THE GRID LINE IS SCAFFOLDING, and only for ground that has no art:
      // it was what told one flat-coloured cell from the next. Drawn over a
      // real tile it is a dark seam on ground that is supposed to read as a
      // continuous field, and the fringes above already say where one
      // terrain ends.
      if (!ground) {
        g.strokeStyle = PALETTE.gridLine;
        g.lineWidth = 1;
        strokeDiamond(g, box, 0.5);
      }
      if (fog === 'Discovered') {
        // THE MIST (art-direction.md §8.1). The ground loses its colour, then
        // a pale veil lies on it — thinner with every tap that takes, torn a
        // fifth at a time.
        const thin = 1 - 0.6 * (taps / FOG.tapsToReveal);
        g.save();
        g.globalCompositeOperation = 'saturation';
        g.globalAlpha = PALETTE.fogDrain * thin;
        g.fillStyle = '#808080';
        fillDiamond(g, box);
        g.restore();
        g.save();
        g.globalAlpha = thin;
        g.fillStyle = PALETTE.fogDiscovered;
        fillDiamond(g, box);
        g.restore();
        // A cell you can see but cannot buy yet — not touching cleared
        // ground, or past the Townhall's reach — lies under a cushion, so
        // the payable frontier reads as a border rather than as every pale
        // tile on screen. Both rules are spatial, so they should be visible
        // spatially — a toast on a refused tap is the fallback, not the
        // teacher.
        if (!payable) {
          g.fillStyle = PALETTE.fogCushion;
          fillDiamond(g, box);
        }
      }
    }
    floor.view = view;
    floor.sig = sig;
    floor.complete = complete;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(floor.canvas, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------- unit animation

/** Stable per-unit phase offset (ms) so units don't animate in lockstep. */
function unitPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h >>> 0) % 997;
}

/**
 * WHICH WAY A FIGURE FACES, given how far it is travelling across the screen.
 *
 * The cast is drawn facing LEFT, so a mirror is what makes it face right. In
 * isometric the screen direction is `dx - dy` and not `dx`: a step down the
 * grid goes left on screen (src/render/camera.ts).
 */
const facesRight = (screenDx: number): boolean => screenDx > 0;

/**
 * Draw a unit mirrored about its feet; (cx, cy) is the bottom-centre of the
 * sprite rect.
 *
 * NO SQUASH AND STRETCH. The bounce was written for 22 px pixel-art people,
 * where a one-pixel wobble reads as weight. The cast is rendered figures now,
 * and the same wobble on one of those reads as the sprite being scaled —
 * which is exactly what it is.
 */
function unitTransform(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  flip: boolean,
  draw: () => void,
): void {
  if (!flip) {
    draw();
    return;
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(-1, 1);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
}

/** The drawings an abandoned building's ruin may use: its own ruin, then its
 *  level-1 art while that has not landed (Docs/features/01-map-and-fog.md §6.3). */
function ruinKeys(districtId: DistrictId): string[] {
  const sprite = DISTRICTS[districtId].sprite;
  return [`${sprite}_ruin`, `${sprite}_l1`, sprite];
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

// ------------------------------------------------------------ a lair going

/** How long a claimed lair takes to go (Docs/proposals/lairs.md §5). */
const VANISH_MS = 1400;

/** Each claimed lair still going, and how far along it is (0…1). Lairs done
 *  going are dropped from the map the presenter keeps. */
function vanishingPhases(vanishing: Map<LairId, number>, clock: number): Array<[LairId, number]> {
  const out: Array<[LairId, number]> = [];
  for (const [id, at] of vanishing) {
    const t = (clock - at) / VANISH_MS;
    if (t >= 1) { vanishing.delete(id); continue; }
    out.push([id, Math.max(0, t)]);
  }
  return out;
}

/** A ring of dust puffs round the lair's foot, swelling and thinning as it
 *  goes. Positions are a hash of the lair, so the ring is the same each frame. */
function drawDust(ctx: CanvasRenderingContext2D, plot: PlotBox, t: number, id: string): void {
  const cx = plot.x + plot.w / 2;
  const cy = plot.y + plot.h * 0.55;
  const n = 9;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (h % 628) / 100;
    const reach = plot.w * (0.18 + 0.32 * t);
    const x = cx + Math.cos(a) * reach;
    const y = cy + Math.sin(a) * reach * 0.5 - plot.h * 0.15 * t;
    const r = plot.w * (0.06 + 0.1 * t);
    ctx.globalAlpha = 0.55 * (1 - t);
    ctx.fillStyle = '#d9c7a4';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
