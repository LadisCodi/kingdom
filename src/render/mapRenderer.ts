// Canvas 2D world renderer: terrain, fog, resource cells (with exhaustion),
// districts, worker units, bars, markers, floaters. Redraws every frame —
// 155 cells is trivial.

import {
  CROPS_EXHAUSTED_GLYPH, DISTRICTS, FEATURES, FOG, HARVEST, LANDMARK_ART,
} from '../sim/data/definitions';
import { landmarkDefAt, ruinDefAt } from '../sim/sites';
import { trainingProgress, unitInTraining } from '../sim/army';
import { fogState, isPayable, reachBorder } from '../sim/fog';
import { footprintAt, type MapData } from '../sim/grid';
import {
  harvestSourceAt, recoversAt, recoveryProgress, stockFraction,
} from '../sim/harvest';
import { maxPopulation } from '../sim/population';
import { workerPosition } from '../sim/workers';
import {
  queueProgress, remainingSeconds, coordKey, districtById, districtOccupies,
  type Coord, type GameState, type HarvestSourceId,
} from '../sim/state';
import type { Camera, PlotBox } from './camera';
import type { Floaters } from './floaters';
import type { TapFx } from './tapFx';
import type { Villagers } from './villagers';
import { PALETTE, TERRAIN_COLORS } from './palette';
import { drawIcon, drawSprite, spriteAspect } from './sprites';
import {
  diamondPath, drawGround, drawStanding, edgePath, fillDiamond, strokeDiamond,
} from './iso';
import { drawTerrainFringes, terrainKey, variantKey } from './terrain';
import { drawCharacter, unitHeight } from './characters';
import { animFor, castFor, NEVER_HIDES, villagerFor, type UnitPose } from './cast';
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
const SPELL_CYCLE_MS = 6000;
const spellPhase = (): number => (performance.now() % SPELL_CYCLE_MS) / SPELL_CYCLE_MS;

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
  // SMOOTHING ON. The world is stylized 3D, not pixel art: every piece is
  // authored at twice the size it is drawn at (a 1×1 tile is a 256×128 PNG
  // on a 128×64 diamond), so it is always being scaled DOWN, and nearest
  // neighbour on a downscale is just aliasing.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = PALETTE.fogUndiscovered;
  ctx.fillRect(0, 0, w, h);

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
    if (p.flash > 0.02) ctx.filter = `brightness(${1 + 2.5 * p.flash})`;
    draw();
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
  const drawSiteBadge = (box: PlotBox, text: string, alarm = false): void => {
    const r = Math.max(6, size * 0.13);
    // Off the diamond's RIGHT CORNER and raised: a badge pinned to the top of
    // a square used to sit on the tile, and a tile is now a flat lozenge with
    // a building standing out of it.
    const c = mid(box);
    const bx = c.x + box.w * 0.26;
    const by = c.y - box.h * 0.55 - r;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = alarm ? PALETTE.siteBadgeRaid : PALETTE.siteBadge;
    ctx.fill();
    ctx.strokeStyle = PALETTE.siteBadgeEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = alarm ? PALETTE.siteBadgeRaidInk : PALETTE.siteBadgeInk;
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
    punched(coordKey(district.location), box, () => {
      tall = stand(box, keys, def.glyph, (draw) => {
        const drew = flip(draw);
        drewExhaustedPlot = drew > 0 && exhaustedPlot &&
          spriteAspect(`${def.sprite}_exhausted`) !== null;
        return drew;
      });
    });
    // WHERE THE ROOF IS. A label belongs above the building, and how tall a
    // building is, is an art decision — so it is read back off the art that
    // was actually drawn rather than guessed from the footprint.
    const roof = foot.y - tall;
    if (district.state === 'UnderConstruction') {
      ctx.fillStyle = PALETTE.constructionHatch;
      fillDiamond(ctx, box);
      drawGlyph(ctx, '🚧', c.x - box.w / 2, roof - size * 0.4, box.w, size * 0.3, size * 0.5);
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
        drawPill(c.x, roof - 2, `${state.city.population}/${maxPopulation(state)}`,
          { icon: 'population' });
        const inLine = unitInTraining(state, district.uniqueId);
        if (inLine) {
          drawBar(ctx, c.x - box.w * 0.24, c.y + box.h * 0.2, box.w * 0.48, 4,
            trainingProgress(state, district.uniqueId, now), PALETTE.progressFill);
        }
      }
      // Needs-workers warning.
      if (def.maxWorkersPerLevel.length > 0 && district.assignedWorkers === 0) {
        drawGlyph(ctx, '⚠️', c.x - box.w * 0.2, roof - size * 0.3, box.w * 0.4, size * 0.26, size * 0.4);
      }
    }
    if (lifted) ctx.globalAlpha = 1;
    return tall;
  };

  /**
   * HOW WIDE A FEATURE'S CANVAS IS, in plots.
   *
   * A building is drawn exactly to its plot, so its art is one plot across.
   * A feature is not: a stand of trees spreads half a tile past its own
   * ground and overlaps its neighbours, which is what makes a wood read as a
   * wood rather than as a row of separate tiles — and a boar covers a
   * fraction of a tile. Both have to fit the same canvas, so the canvas is
   * TWO plots wide and the thing sits somewhere inside it
   * (Docs/art/features/props.json says where).
   */
  const FEATURE_PLOTS = 2;

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
   * So a fogged cell dims its own prop. The number is what the scrim actually
   * does: `fogDiscovered` is 55% of near-black over the ground, and a cell
   * the player cannot buy yet takes it twice.
   */
  const FOG_DIM = 0.45;
  const dimmed = (dim: number, draw: () => void): void => {
    if (dim >= 1) { draw(); return; }
    ctx.save();
    ctx.filter = `brightness(${dim.toFixed(3)}) saturate(0.75)`;
    draw();
    ctx.restore();
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
      const keys = v.walking ? [walkFrameKey('worker_walk', t), 'worker'] : ['worker'];
      // Cast by phase: it is per agent and stable, so a villager keeps its face.
      const [who, anim] = animFor(villagerFor(v.phase), v.walking ? 'walk' : 'idle');
      // Takes its context so the same drawing can go into the outline's
      // offscreen canvas as well as onto the map.
      const paint = (g: CanvasRenderingContext2D): void => {
        unitTransform(g, sx + uw / 2, sy + uw, v.walking && facesRight(v.dx), () => {
          if (drawCharacter(g, who, anim, t, sx + uw / 2, sy + uw, unitHeight(size))) return;
          if (!keys.some((k) => drawSprite(g, k, sx, sy, uw, uw))) {
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
    } = {},
  ): void => {
    standing.push({
      depth: (cell.x + span.x / 2) + (cell.y + span.y / 2),
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
   * A person, drawn as a pale silhouette with a dark rim.
   *
   * White alone vanishes on a cream wall and black alone vanishes on a dark
   * roof, so it is both: the fill inverted to white and a drop shadow around
   * it for the outline. One filter, no offscreen canvas, and it reads on
   * anything the buildings are made of.
   */
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
    g.filter = 'brightness(0) invert(1)';
    for (const [ox, oy] of RING) {
      g.save();
      g.translate(ox * RIM, oy * RIM);
      draw(g);
      g.restore();
    }
    g.filter = 'none';
    g.globalCompositeOperation = 'destination-out';
    draw(g);
    g.restore();

    ctx.save();
    ctx.beginPath();
    for (const r of clip) ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.globalAlpha = 0.9;
    // A dark halo under the bright rim, so it reads on a cream wall as well
    // as on a slate roof.
    ctx.filter = 'drop-shadow(0 0 1px rgba(10,14,20,0.95))';
    ctx.drawImage(gc, 0, 0, Math.ceil(cw * dpr), Math.ceil(ch * dpr),
      rect.x - pad, rect.y - pad, cw, ch);
    ctx.restore();
  };

  for (let cy = view.y0; cy <= view.y1; cy++) {
    for (let cx = view.x0; cx <= view.x1; cx++) {
      const cell = { x: cx, y: cy };
      const key = coordKey(cell);
      const terrain = map.terrain.get(key);
      if (!terrain) continue;
      const fog = fogState(state, map, cell);
      if (fog === 'Undiscovered') continue; // opaque background already drawn
      const box = cellRect(cell);

      // The ground: one of the terrain's drawings, picked by a hash of the
      // cell so a field of it does not weave (src/render/terrain.ts), then
      // the fringe of any neighbour that creeps over it. Flat colour while
      // the art is missing — that path has to be given the diamond shape
      // explicitly, where a drawing carries its own.
      const ground = drawGround(ctx, terrainKey(terrain, cell), box);
      if (!ground) {
        ctx.fillStyle = TERRAIN_COLORS[terrain];
        fillDiamond(ctx, box);
      }
      drawTerrainFringes(ctx, map, cell, terrain, box);
      // THE GRID LINE IS SCAFFOLDING, and only for ground that has no art:
      // it was what told one flat-coloured cell from the next. Drawn over a
      // real tile it is a dark seam on ground that is supposed to read as a
      // continuous field, and the fringes above already say where one
      // terrain ends.
      if (!ground) {
        ctx.strokeStyle = PALETTE.gridLine;
        ctx.lineWidth = 1;
        strokeDiamond(ctx, box, 0.5);
      }

      // How dark anything standing on this cell has to be. Computed here,
      // beside the scrim it has to match, so the two cannot drift apart.
      const dim = fog === 'Discovered'
        ? (isPayable(state, map, cell) ? FOG_DIM : FOG_DIM * FOG_DIM)
        : 1;

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
      const ruin = ruinDefAt(cell);
      if (ruin && ruin.location.x === cx && ruin.location.y === cy) {
        const plot = ruin.size === 1
          ? box : camera.plotBox(cell, { x: ruin.size, y: ruin.size });
        later(cell, (mark) => {
          dimmed(dim, () => {
            punched(key, plot, () => {
              mark(artRect(plot,
                stand(plot, [ruin.sprite], ruin.glyph, undefined, FEATURE_PLOTS), FEATURE_PLOTS));
            });
          });
          // The tier alone: a bare digit reads at any zoom, and "T1" in a
          // display face is one stroke away from an arrow. While a garrison is
          // counting down it takes the badge instead — the minutes left, which
          // is the only thing about this ruin that is urgent
          // (Docs/features/18-garrisons-and-raids.md §7).
          const gate = state.gates[ruin.id];
          const raidIn = gate && !gate.cleared && gate.nextRaidAt !== null
            ? Math.max(0, Math.ceil((gate.nextRaidAt - now) / 60_000)) : null;
          if (raidIn !== null) drawSiteBadge(plot, String(raidIn), true);
          else drawSiteBadge(plot, String(ruin.tier));
        }, { x: ruin.size, y: ruin.size });

      }

      if (fog === 'Revealed') drawResourceState(cell, box);

      if (fog === 'Discovered') {
        ctx.fillStyle = PALETTE.fogDiscovered;
        fillDiamond(ctx, box);
        // A cell you can see but cannot buy yet — not touching cleared
        // ground, or past the Townhall's reach — sits under a second layer,
        // so the payable frontier reads as a border rather than as every
        // pale tile on screen. Both rules are spatial, so they should be
        // visible spatially — a toast on a refused tap is the fallback, not
        // the teacher.
        if (!isPayable(state, map, cell)) fillDiamond(ctx, box);
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
    }
  }

  // Pass 1.2: the Townhall's reach (01-map-and-fog.md §4). A dashed line
  // along the last ring the player may pay for, drawn over the fog and
  // across undiscovered ground too, so the extent of what the capital allows
  // is read off the map before a tap is refused. Nothing is drawn when the
  // reach holds the whole province.
  //
  // The sim answers in N/S/E/W on its square grid; `edgePath` rotates each
  // one onto the diamond (src/render/iso.ts).
  {
    const visible: Coord[] = [];
    for (let cy = view.y0; cy <= view.y1; cy++) {
      for (let cx = view.x0; cx <= view.x1; cx++) visible.push({ x: cx, y: cy });
    }
    const border = reachBorder(state, map, visible);
    if (border.length > 0) {
      ctx.save();
      ctx.strokeStyle = PALETTE.reachBorder;
      ctx.lineWidth = 2;
      ctx.setLineDash([Math.max(4, size * 0.18), Math.max(3, size * 0.12)]);
      ctx.beginPath();
      for (const { cell, sides } of border) {
        const box = cellRect(cell);
        for (const side of sides) edgePath(ctx, box, side);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // Pass 1.5: districts, each drawn once spanning its full footprint — and
  // queued into the same depth-sorted list the props are in, so a hall in
  // front of a forest covers it and never the other way round.
  for (const district of state.city.districts) {
    if (fogState(state, map, district.location) !== 'Revealed') continue;
    const def = DISTRICTS[district.definitionId];
    const box = camera.plotBox(district.location, def.size);
    if (box.x + box.w < 0 || box.y + box.h < 0 || box.x > w || box.y - box.w > h) continue;
    later(district.location,
      (mark) => mark(artRect(box, drawDistrict(district, box), 1)), def.size,
      { occludes: !NEVER_HIDES.has(district.definitionId) });
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
    // being worked, and the art above it is allowed to be any height.
    drawBar(ctx, c.x - b.w * 0.3, c.y - 3, b.w * 0.6, 6, progress, PALETTE.progressFill);
    ctx.fillStyle = PALETTE.label;
    ctx.font = labelFont(size * 0.15, 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(item.startedAt === null ? 'queued' : `${remaining}s`, c.x, c.y + 5);
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

  // Pass 3: markers.
  // Working area: one translucent white region with a crisp outline — border
  // segments are drawn only on edges that face a cell outside the area.
  if (markers.influenceCells.length > 0) {
    const inArea = new Set(markers.influenceCells.map(coordKey));
    ctx.fillStyle = PALETTE.influenceFill;
    ctx.beginPath();
    for (const cell of markers.influenceCells) diamondPath(ctx, cellRect(cell));
    ctx.fill();
    ctx.strokeStyle = PALETTE.influenceBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const cell of markers.influenceCells) outline(cellRect(cell), cell, inArea);
    ctx.stroke();
  }
  for (const { cell, label } of markers.validCells) {
    if (fogState(state, map, cell) === 'Undiscovered') continue;
    const b = cellRect(cell);
    ctx.strokeStyle = markers.validColor;
    ctx.lineWidth = 2;
    strokeDiamond(ctx, b, 3);
    if (label) {
      const c = mid(b);
      ctx.fillStyle = markers.validColor;
      ctx.font = labelFont(size * 0.16, 12);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, c.x, c.y);
    }
  }
  for (const cell of markers.claimedCells) {
    ctx.strokeStyle = PALETTE.workedTile;
    ctx.lineWidth = 3;
    strokeDiamond(ctx, cellRect(cell), 4);
  }
  if (markers.previewCell && markers.previewGlyph) {
    const b = camera.plotBox(markers.previewCell, markers.previewSize ?? { x: 1, y: 1 });
    ctx.globalAlpha = 0.6;
    // The ghost stands on the plot it would occupy, so what the player is
    // judging is the footprint and not a rectangle floating over it.
    ctx.strokeStyle = markers.validColor;
    ctx.lineWidth = 2;
    strokeDiamond(ctx, b, 2);
    // New builds preview at level 1; fall back to the un-levelled sprite.
    const sprite = markers.previewSprite;
    stand(b, sprite ? [`${sprite}_l1`, sprite] : [], markers.previewGlyph);
    ctx.globalAlpha = 1;
  }
  if (markers.selected) {
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



  // Pass 3.8: the quest-hint arrow — a bouncing 👇 over the hinted cell.
  if (markers.hintCell) {
    const b = cellRect(markers.hintCell);
    const c = mid(b);
    const bob = Math.sin(now / 140) * size * 0.07;
    ctx.strokeStyle = PALETTE.selected;
    ctx.lineWidth = 3;
    strokeDiamond(ctx, b, 3);
    drawGlyph(ctx, '👇', c.x - size / 2, c.y - size * 1.1 + bob, size, size * 0.5);
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
    // Read from the cell the worker CLAIMED, not from the building: a Mine
    // works two mountains and its crew is on one or the other.
    const source = worker.claimedCell !== null
      ? harvestSourceAt(state, worker.claimedCell) : sources[0] ?? null;
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

    // The atlas cast first — a farmer for the Farm, a lumberjack for the
    // Sawmill — then the legacy sprite chain, then the emoji. Boats have no
    // cast and skip straight to the chain.
    const member = boat ? null : castFor(building.definitionId, unitPhase(worker.id));
    const pose: UnitPose = moving ? 'walk' : working ? 'work' : 'idle';
    const cast = member ? animFor(member, pose) : null;
    const paint = (g: CanvasRenderingContext2D): void => {
      unitTransform(g, sx + uw / 2, sy + uw, flip, () => {
        if (cast && drawCharacter(g, cast[0], cast[1], t, sx + uw / 2, sy + uw, unitHeight(size))) {
          return;
        }
        if (!keys.some((k) => drawSprite(g, k, sx, sy, uw, uw))) {
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

// ---------------------------------------------------------- unit animation

const WALK_FRAME_MS = 140; // 4-frame walk cycle ≈ 560 ms
const WORK_FRAME_MS = 320; // 2-frame work loop (strike cadence)

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
