// The world board, drawn (Docs/features/19-world-map.md §1–§3,
// Docs/art/art-direction.md §2, §7, §8).
//
// A slightly tilted board (art-direction §7.1): each hex a terrain plate and
// one sprite for its combination of terrain and features, or the improvement
// standing in its place (hexArt.ts, Docs/plans/world-hex-art.md). Hex art
// drops in by filename; until a file exists, the province's own textures and
// sprites stand in for it.
//
// The three fog states are treatments of the same hex, never a second asset:
// Revealed is full colour, Sensed is the same hex dimmed under a thin veil,
// Unknown is opaque rolling mist. Ownership is a border on the hex edge.

import type { GameState } from '../../sim/state';
import type { BoardHex } from '../../sim/world/board';
import {
  arrivesAt, fogStateOf, homeIndex, returnsAt, revealsAt, worldFogAt, type FogState,
} from '../../sim/world/explorers';
import { PORTAL_INDEX, hexAt, type Hex } from '../../sim/world/hex';
import type { WorldSource } from '../../sim/world/source';
import type { ArmyView } from '../../worldServer/types';
import type { WorldImprovement, WorldTerrain } from '../../sim/world/types';
import { formatCountdown } from '../../ui/format';
import { PALETTE } from '../palette';
import { drawIcon, drawSprite, spriteAspect, spriteUrl } from '../sprites';
import { homeboundMs, legPosition } from '../../sim/world/travel';
import { WORLD_BUILD } from '../../sim/data/definitions';
import {
  COMBO_SPRITE, OUTPOST_BUILDING_SPRITE, OUTPOST_SPRITE, hexArt, pickVariant, type HexCombo,
} from './hexArt';
import { TILT, hexCorners, regionEdges } from './hexLayout';
import type { HexCamera } from './hexCamera';

/** A flat colour under the plate, for the frames before it loads. */
const PLATE_COLOR: Record<WorldTerrain, string> = {
  Grassland: '#6fae3c', Plains: '#a8ab4c', Desert: '#d8bf78', Mountain: '#8f9a7c',
};

/** Until a combination has its own art, the province's sprites stand in for
 *  it: each a share of the hex's width, offset across it (`dx`, of the
 *  width) and down it (`dy`, of the tilted radius, from the centre). */
const COMBO_STAND_IN: Record<HexCombo, Array<{ sprite: string; size: number; dx: number; dy: number }>> = {
  Forest: [{ sprite: 'forest_3', size: 0.8, dx: 0, dy: 0.3 }],
  FertileLand: [{ sprite: 'farmlands', size: 0.6, dx: 0, dy: 0.3 }],
  Game: [{ sprite: 'wild_animals', size: 0.5, dx: 0, dy: 0.3 }],
  FertileGame: [
    { sprite: 'farmlands', size: 0.55, dx: 0.12, dy: 0.2 },
    { sprite: 'wild_animals', size: 0.38, dx: -0.2, dy: 0.5 },
  ],
  Mountain: [{ sprite: 'mountain_2x2', size: 0.9, dx: 0, dy: 0.3 }],
  MountainForest: [
    { sprite: 'mountain_2x2', size: 0.78, dx: 0.06, dy: 0.2 },
    { sprite: 'forest_3', size: 0.48, dx: -0.22, dy: 0.5 },
  ],
  MountainDungeon: [
    { sprite: 'mountain_2x2', size: 0.82, dx: -0.04, dy: 0.25 },
    { sprite: 'mountain', size: 0.36, dx: 0.22, dy: 0.5 },
  ],
  Sanctuary: [{ sprite: 'landmark_leyspring', size: 0.5, dx: 0, dy: 0.3 }],
  Landmark: [{ sprite: 'landmark_stones', size: 0.56, dx: 0, dy: 0.3 }],
};

/** The province's buildings stand in for improvement art; a level draws the
 *  highest province tier at or below it. */
const IMPROVEMENT_STAND_IN: Record<WorldImprovement, string> = {
  LoggingCamp: 'sawmill', Homestead: 'farm', StonePit: 'quarry', Fortress: 'barracks',
};
const standInTier = (level: number): string => (level >= 8 ? 'l8' : level >= 4 ? 'l4' : 'l1');

/** Hex art's foot line: the bottom of its canvas, a little in front of the
 *  hex's centre (world-hex-art.md §2), as a share of the tilted radius. */
const FOOT = 0.62;
/** The Outpost's tower, as a share of the hex's width. */
const OUTPOST_WIDTH = 0.24;
/** Below this many pixels a hex, the strategic zoom (world-hex-art.md §4). */
const STRATEGIC_PX = 70;
/** The province's watch-tower stands in until the Outpost has its own art. */
const OUTPOST_STAND_IN = 'landmark_watchtower';
const CUT_OFF = 'rgba(60, 64, 72, 0.5)';

/** The player's colour, then the five rivals', in seat order after it. */
export const SEAT_COLORS = {
  you: '#2f6fe0',
  rivals: ['#c8312b', '#2e9e57', '#e0a020', '#7b4fc9', '#1c9a9a'],
};

const MIST = '#d9e0e6';
const MIST_DEEP = '#b9c4cd';
const SEAM = 'rgba(40, 52, 30, 0.28)';
/** A tile's side: packed earth under the ground, grey under the mist. */
const SKIRT_EARTH = { lit: '#7a5a3a', shade: '#5c4129' };
const SKIRT_MIST = { lit: '#9aa6b2', shade: '#86929e' };
const SENSED_DIM = 'rgba(24, 32, 44, 0.48)';
const SENSED_VEIL = 'rgba(225, 232, 238, 0.28)';

export interface WorldFrame {
  state: GameState;
  source: WorldSource;
  now: number;
  /** The hex the dispatch sheet is about, or null. */
  selected: number | null;
  /** Every army the server says is out, the player's and the rivals'. */
  armies?: readonly ArmyView[];
}

export function drawWorld(canvas: HTMLCanvasElement, camera: HexCamera, frame: WorldFrame): void {
  const dpr = camera.dpr;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  camera.settle();
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // The world past the board's edge is mist too: the board stops and the
  // clouds go on (19 §1).
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#c3cdd6');
  sky.addColorStop(1, '#a9b6c1');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const { state, source, now } = frame;
  const board = source.board();
  const fog = worldFogAt(state, now);
  const r = camera.hexRadius;
  const states = board.hexes.map((bh) => fogStateOf(state, bh.index, now, fog));

  // Row by row, top to bottom, so a prop that rises over the hex above is
  // drawn after it.
  for (const bh of board.hexes) {
    const c = camera.hexToScreen(bh.hex);
    if (c.x < -r * 2 || c.x > w + r * 2 || c.y < -r * 3 || c.y > h + r * 2) continue;
    drawHex(ctx, camera, bh, states[bh.index], c, frame);
  }

  // Borders: each kingdom's city and the ground it holds or is claiming, as
  // far as the player can see it, in its owner's colour.
  for (const seat of source.seats()) {
    const region = [seat.index, ...board.hexes.filter((bh) => source.hexOf(bh.index)?.owner === seat.seat).map((bh) => bh.index)]
      .filter((i) => states[i] !== 'Unknown');
    if (region.length === 0) continue;
    const color = seat.owner.you ? SEAT_COLORS.you : SEAT_COLORS.rivals[seat.owner.rival % SEAT_COLORS.rivals.length];
    const seen = region.some((i) => states[i] === 'Revealed');
    drawBorder(ctx, camera, region.map(hexAt), color, seen ? 1 : 0.55);
  }

  if (frame.selected !== null) {
    drawBorder(ctx, camera, [hexAt(frame.selected)], PALETTE.selected, 1, 4);
  }

  // The Portal's appointment, over its hex: when it opens, or how long it
  // has left (19 §10.1).
  const portal = source.portal();
  if (portal !== null) {
    const c = camera.hexToScreen(hexAt(PORTAL_INDEX));
    const left = Math.max(0, ((portal.open ? portal.closesAt : portal.opensAt) - now) / 1000);
    drawPill(ctx, camera, c.x, c.y - camera.hexRadius * 0.75,
      portal.open ? `Open · ${formatCountdown(left)}` : `Opens in ${formatCountdown(left)}`);
  }

  for (const trip of state.world.explorers) drawExplorer(ctx, camera, trip, now);
  for (const army of frame.armies ?? []) {
    const seat = source.seats()[army.owner];
    const color = seat === undefined ? '#888' : seat.owner.you ? SEAT_COLORS.you
      : SEAT_COLORS.rivals[seat.owner.rival % SEAT_COLORS.rivals.length];
    const at = armyPosition(army, now);
    // A rival's army is seen only where the player can see.
    const near = states[at.from] !== 'Unknown' || states[at.to] !== 'Unknown';
    if (seat?.owner.you || near) drawArmy(ctx, camera, army, at, color, now);
  }
}

/** Where an army stands at `now`: between two hexes of its path, `f` of the
 *  way, or in its Fortress. */
function armyPosition(a: ArmyView, now: number): { from: number; to: number; f: number } {
  const steps = a.path.length - 1;
  if (a.phase === 'garrison' || a.phase === 'camp' || steps === 0) return { from: a.target, to: a.target, f: 0 };
  const out = a.phase === 'out';
  const start = out ? a.departedAt : (a.at ?? now) - homeboundMs(a.stepMs);
  const at = legPosition(a.stepMs, now - start, out);
  return { from: a.path[at.k], to: a.path[at.next], f: at.f };
}

function drawArmy(
  ctx: CanvasRenderingContext2D, camera: HexCamera, a: ArmyView,
  at: { from: number; to: number; f: number }, color: string, now: number,
): void {
  const p = camera.hexToScreen(hexAt(at.from));
  const q = camera.hexToScreen(hexAt(at.to));
  const x = p.x + (q.x - p.x) * at.f;
  const garrisoned = a.phase === 'garrison';
  const y = p.y + (q.y - p.y) * at.f + (garrisoned ? camera.hexRadius * 0.35 * TILT : 0);
  const size = Math.max(16, camera.hexWidth * (garrisoned ? 0.22 : 0.3));
  // A banner in its owner's colour under the soldier, so whose it is reads first.
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#1d140c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.45, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  const aspect = spriteAspect('unit_warrior');
  if (aspect !== null) drawSprite(ctx, 'unit_warrior', x - size / 2, y - size * aspect * 0.9, size, size * aspect);
  if (!garrisoned && a.at !== null) {
    drawPill(ctx, camera, x, y - size * (aspect ?? 1) - 8, formatCountdown(Math.max(0, a.at - now) / 1000));
  }
}

// ------------------------------------------------------------------ a hex

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const corners = hexCorners(cx, cy, r);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let k = 1; k < 6; k++) ctx.lineTo(corners[k].x, corners[k].y);
  ctx.closePath();
}

function drawHex(
  ctx: CanvasRenderingContext2D, camera: HexCamera, bh: BoardHex, fogState: FogState,
  c: { x: number; y: number }, frame: WorldFrame,
): void {
  const r = camera.hexRadius;
  const hw = camera.hexWidth;

  // The tile's thickness under its two lower edges: hidden by the row in
  // front, it shows only along the board's near rim.
  drawSkirt(ctx, c.x, c.y, r, fogState === 'Unknown');

  if (fogState === 'Unknown') {
    drawMist(ctx, c.x, c.y, r, bh.index);
    return;
  }

  // A city's hex and the Portal have their own drawing; every other hex is
  // its plate and its art (world-hex-art.md §2–§3).
  const held = bh.seat === null && bh.role !== 'portal' ? frame.source.hexOf(bh.index) : null;
  const standing = held?.improvement ?? (held?.work !== null && held?.work !== undefined ? { kind: held.work.kind, level: 1 } : null);
  const art = bh.terrain === null ? null : hexArt(bh.terrain, bh.features, standing, hw < STRATEGIC_PX);

  ctx.save();
  hexPath(ctx, c.x, c.y, r);
  ctx.clip();
  if (bh.role === 'portal') {
    drawPortalGround(ctx, c.x, c.y, r);
  } else if (bh.terrain !== null && art !== null) {
    ctx.fillStyle = PLATE_COLOR[bh.terrain];
    ctx.fillRect(c.x - r, c.y - r * TILT, r * 2, r * 2 * TILT);
    drawSprite(ctx, variant(art.plate, bh.index), c.x - r, c.y - r * TILT, r * 2, r * 2 * TILT);
  }
  ctx.restore();

  if (bh.seat !== null) {
    const mine = bh.index === homeIndex(frame.state);
    drawProp(ctx, mine ? 'townhall_l8' : 'townhall_l4', c.x, c.y + r * 0.35 * TILT, hw * 0.86);
  } else if (bh.role === 'portal') {
    drawPortal(ctx, c.x, c.y, r);
  } else if (art !== null) {
    // Behind, what the improvement does not work; then the combination or
    // the improvement; then Game in front of it.
    const key = bh.index;
    if (art.behind !== null) drawCombo(ctx, art.behind, key, c.x - hw * 0.2, c.y + r * 0.1 * TILT, hw * 0.6, r);
    if (art.main !== null && 'combo' in art.main) drawCombo(ctx, art.main.combo, key, c.x, c.y + r * FOOT * TILT, hw, r);
    if (art.main !== null && 'improvement' in art.main) {
      ctx.save();
      if (held?.improvement === null) ctx.globalAlpha = 0.45; // its first level still building
      drawImprovement(ctx, art.main.improvement, art.main.sprite, standing!.level, c, hw, r);
      ctx.restore();
    }
    if (art.front !== null) drawCombo(ctx, art.front, key, c.x - hw * 0.2, c.y + r * 0.85 * TILT, hw * 0.45, r);
    if (held !== null) drawHeld(ctx, camera, key, held, c, fogState, frame);
  }

  if (fogState === 'Sensed') {
    ctx.save();
    hexPath(ctx, c.x, c.y, r);
    ctx.fillStyle = SENSED_DIM;
    ctx.fill();
    ctx.fillStyle = SENSED_VEIL;
    ctx.fill();
    ctx.restore();
  }

  hexPath(ctx, c.x, c.y, r * 0.995);
  ctx.strokeStyle = SEAM;
  ctx.lineWidth = Math.max(1, r * 0.025);
  ctx.stroke();
}

/** How thick a tile is, as a share of its radius. */
const SKIRT = 0.16;

/** The two faces under a tile's lower edges, the right one in shade. */
function drawSkirt(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, mist: boolean): void {
  const [, c1, c2, c3] = hexCorners(cx, cy, r);
  const d = r * SKIRT;
  const face = (a: { x: number; y: number }, b: { x: number; y: number }, color: string) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x, b.y + d);
    ctx.lineTo(a.x, a.y + d);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  face(c2, c3, mist ? SKIRT_MIST.lit : SKIRT_EARTH.lit);
  face(c1, c2, mist ? SKIRT_MIST.shade : SKIRT_EARTH.shade);
}

/** A combination standing with its foot at (x, footY), `width` wide: its own
 *  art, whose canvas is the hex's width, or the province's sprites standing
 *  in, laid out across that width. */
function drawCombo(
  ctx: CanvasRenderingContext2D, combo: HexCombo, key: number, x: number, footY: number, width: number, r: number,
): void {
  if (spriteUrl(COMBO_SPRITE[combo]) !== null) {
    drawProp(ctx, variant(COMBO_SPRITE[combo], key), x, footY, width);
    return;
  }
  const k = width / (r * Math.sqrt(3)); // this drawing's share of a whole hex
  const top = footY - r * FOOT * TILT * k;
  for (const p of COMBO_STAND_IN[combo]) {
    drawProp(ctx, p.sprite, x + p.dx * width, top + r * p.dy * TILT * k, width * p.size);
  }
}

/** How many variants of a sprite exist — `name`, `name_2`, `name_3`… —
 *  counted once. */
const variantCounts = new Map<string, number>();
function variant(name: string, key: number): string {
  let n = variantCounts.get(name);
  if (n === undefined) {
    n = spriteUrl(name) === null ? 0 : 1;
    while (n > 0 && spriteUrl(`${name}_${n + 1}`) !== null) n += 1;
    variantCounts.set(name, n);
  }
  return pickVariant(name, n, key);
}

/** An improvement in the middle of its hex: its own art, or the province's
 *  building standing in. */
function drawImprovement(
  ctx: CanvasRenderingContext2D, kind: WorldImprovement, sprite: string, level: number,
  c: { x: number; y: number }, hw: number, r: number,
): void {
  if (spriteUrl(sprite) !== null) {
    drawProp(ctx, sprite, c.x, c.y + r * FOOT * TILT, hw);
    return;
  }
  drawProp(ctx, `${IMPROVEMENT_STAND_IN[kind]}_${standInTier(level)}`, c.x + hw * 0.06, c.y + r * 0.42 * TILT, hw * 0.62);
}

/** A sprite standing with its foot at (x, footY), `width` wide. */
function drawProp(ctx: CanvasRenderingContext2D, sprite: string, x: number, footY: number, width: number): void {
  const aspect = spriteAspect(sprite);
  if (aspect === null) {
    // Still loading: a soft dot where it will stand.
    ctx.fillStyle = 'rgba(40, 60, 30, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, footY - width * 0.15, width * 0.3, width * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const height = width * aspect;
  drawSprite(ctx, sprite, x - width / 2, footY - height, width, height);
}

/** Opaque rolling mist: a pale hex with soft puffs, placed by the hex's
 *  index so the clouds hold still from frame to frame. */
function drawMist(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number): void {
  ctx.save();
  hexPath(ctx, cx, cy, r * 1.04);
  ctx.fillStyle = MIST;
  ctx.fill();
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    const a = ((seed * 7 + i * 13) % 12) / 12 * Math.PI * 2;
    const px = cx + Math.cos(a) * r * 0.45;
    const py = cy + Math.sin(a) * r * 0.35 * TILT;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r * 0.75);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);
  }
  const shade = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, MIST_DEEP + '66');
  ctx.fillStyle = shade;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/** The Portal's hex has no ground: cracked dark stone. */
function drawPortalGround(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, '#4a3d5c');
  g.addColorStop(1, '#2c2536');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

/** A ring of dark standing stones round a dim violet void — shut until the
 *  first Portal event (19 §10). */
function drawPortal(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const void_ = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.5);
  void_.addColorStop(0, '#7a4fd0');
  void_.addColorStop(0.55, '#3b2370');
  void_.addColorStop(1, '#160d26');
  ctx.fillStyle = void_;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.48, r * 0.48 * TILT, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
    const sx = cx + Math.cos(a) * r * 0.6;
    const sy = cy + Math.sin(a) * r * 0.6 * TILT;
    const sh = r * (0.22 + (i % 3) * 0.05);
    ctx.fillStyle = '#5b5466';
    ctx.strokeStyle = '#25202c';
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath();
    ctx.moveTo(sx - r * 0.06, sy);
    ctx.lineTo(sx - r * 0.04, sy - sh);
    ctx.lineTo(sx + r * 0.05, sy - sh * 0.9);
    ctx.lineTo(sx + r * 0.06, sy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// ------------------------------------------------------------ held ground

/** The Outpost's watch-tower at the hex's upper-right corner: its own art —
 *  scaffolded while the builder is at it — or the province's tower, faint
 *  while it is building. */
function drawOutpost(
  ctx: CanvasRenderingContext2D, built: boolean, key: number, c: { x: number; y: number }, hw: number, r: number,
): void {
  const x = c.x + hw * 0.28;
  const footY = c.y - r * 0.12 * TILT;
  if (spriteUrl(OUTPOST_SPRITE) !== null) {
    const sprite = built || spriteUrl(OUTPOST_BUILDING_SPRITE) === null ? variant(OUTPOST_SPRITE, key) : OUTPOST_BUILDING_SPRITE;
    drawProp(ctx, sprite, x, footY, hw * OUTPOST_WIDTH);
    return;
  }
  ctx.save();
  if (!built) ctx.globalAlpha = 0.45;
  drawProp(ctx, OUTPOST_STAND_IN, x, footY, hw * 0.16);
  ctx.restore();
}

function drawHeld(
  ctx: CanvasRenderingContext2D, camera: HexCamera, key: number,
  held: NonNullable<ReturnType<WorldSource['hexOf']>>, c: { x: number; y: number }, fogState: FogState, frame: WorldFrame,
): void {
  const r = camera.hexRadius;
  const hw = camera.hexWidth;
  // The Outpost: a small watch-tower on the hex's upper right, faint while
  // its builder is still at it.
  if (hw >= STRATEGIC_PX) drawOutpost(ctx, held.held, key, c, hw, r);
  // Cut off from its city: greyed, buildings intact (art-direction §8).
  if (held.held && !held.active) {
    ctx.save();
    hexPath(ctx, c.x, c.y, r);
    ctx.fillStyle = CUT_OFF;
    ctx.fill();
    ctx.restore();
  }
  // A builder at work: an hourglass and the time left.
  const now = frame.now;
  const busyUntil = !held.held ? held.outpostAt : held.work?.at ?? null;
  if (busyUntil !== null && fogState === 'Revealed') drawPill(ctx, camera, c.x, c.y - r * 0.62, formatCountdown(Math.max(0, busyUntil - now) / 1000));
  // The player's own store, ready: a bubble with what it holds.
  const s = held.stores;
  if (s !== null && held.held && held.active) {
    const produces = held.improvement === null ? '' : WORLD_BUILD.improvements[held.improvement.kind].produces;
    const icon = produces !== '' && s.material >= Math.max(1, s.materialCap * 0.25) ? produces
      : s.knowledge >= 1 ? 'Knowledge' : null;
    if (icon !== null) drawBubble(ctx, camera, c.x, c.y - r * 0.55, icon);
  }
}

/** A round wooden bubble with an icon, over a hex. */
function drawBubble(ctx: CanvasRenderingContext2D, camera: HexCamera, x: number, y: number, icon: string): void {
  const size = Math.max(16, camera.hexWidth * 0.2);
  ctx.save();
  ctx.fillStyle = '#6b4424';
  ctx.strokeStyle = '#2e1c0e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - size * 0.2, y + size * 0.62);
  ctx.lineTo(x, y + size * 0.95);
  ctx.lineTo(x + size * 0.2, y + size * 0.62);
  ctx.fill();
  drawIcon(ctx, icon, x - size / 2, y - size / 2, size);
  ctx.restore();
}

/** A wooden pill with a short text — a countdown over something at work. */
function drawPill(ctx: CanvasRenderingContext2D, camera: HexCamera, x: number, y: number, text: string): void {
  const fs = Math.max(10, Math.min(14, camera.hexWidth * 0.1));
  ctx.save();
  ctx.font = `800 ${fs}px Nunito, system-ui, sans-serif`;
  const pw = ctx.measureText(text).width + fs * 1.4;
  const ph = fs * 1.6;
  ctx.fillStyle = '#5a3a20';
  ctx.strokeStyle = '#2e1c0e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - pw / 2, y - ph / 2, pw, ph, ph / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff3d6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

// --------------------------------------------------------------- borders

function drawBorder(
  ctx: CanvasRenderingContext2D, camera: HexCamera, region: Hex[], color: string, alpha: number, width = 3,
): void {
  const r = camera.hexRadius;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(2, r * 0.12);
  ctx.lineWidth = Math.max(2, width * camera.zoom * 1.4);
  ctx.beginPath();
  for (const { hex, edge } of regionEdges(region)) {
    const c = camera.hexToScreen(hex);
    const corners = hexCorners(c.x, c.y, r * 0.96);
    const a = corners[edge];
    const b = corners[(edge + 1) % 6];
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  ctx.restore();
}

// -------------------------------------------------------------- explorers

/** Footprints along a walked path. */
function drawFootprints(ctx: CanvasRenderingContext2D, pts: ReadonlyArray<{ x: number; y: number }>, unit: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 252, 240, 0.9)';
  const dot = Math.max(1.5, unit * 0.025);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    for (let d = dot * 4; d < len; d += dot * 5) {
      ctx.beginPath();
      ctx.arc(p.x + ((q.x - p.x) * d) / len, p.y + ((q.y - p.y) * d) / len, dot, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The way still to go: a dashed line, dark-edged so it reads on grass and
 *  on mist alike, and a ring on the hex it ends at. */
function drawRoute(ctx: CanvasRenderingContext2D, pts: ReadonlyArray<{ x: number; y: number }>, unit: number): void {
  if (pts.length < 2) return;
  const width = Math.max(2, unit * 0.028);
  const end = pts[pts.length - 1];
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  };
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(46, 28, 14, 0.45)';
  ctx.lineWidth = width + 2.5;
  path();
  ctx.stroke();
  ctx.setLineDash([width * 3, width * 2.2]);
  ctx.strokeStyle = 'rgba(255, 246, 220, 0.95)';
  ctx.lineWidth = width;
  path();
  ctx.stroke();
  ctx.setLineDash([]);
  const ring = Math.max(6, unit * 0.13);
  ctx.strokeStyle = 'rgba(46, 28, 14, 0.5)';
  ctx.lineWidth = width + 2.5;
  ctx.beginPath();
  ctx.ellipse(end.x, end.y, ring, ring * TILT, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 246, 220, 0.95)';
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(end.x, end.y, ring, ring * TILT, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Where a trip is at `now`: between step `step` and the next of its path,
 *  `f` of the way, and whether it is still on its way out. While it works the
 *  hex it went to, it stands there, its whole way out behind it. */
function tripPosition(
  trip: GameState['world']['explorers'][number], now: number,
): { step: number; from: number; to: number; f: number; outbound: boolean; working: boolean } {
  const working = now >= arrivesAt(trip) && now < revealsAt(trip);
  const outbound = now < revealsAt(trip);
  const at = working
    ? legPosition(trip.stepMs, Number.POSITIVE_INFINITY, true)
    : legPosition(trip.stepMs, now - (outbound ? trip.departedAt : revealsAt(trip)), outbound);
  // `step` is the lower of the two hexes, the way the trail reads it.
  const step = Math.min(at.k, at.next);
  return { step, from: trip.path[at.k], to: trip.path[at.next], f: at.f, outbound, working };
}

function drawExplorer(
  ctx: CanvasRenderingContext2D, camera: HexCamera, trip: GameState['world']['explorers'][number], now: number,
): void {
  const pos = tripPosition(trip, now);
  const a = camera.hexToScreen(hexAt(pos.from));
  const b = camera.hexToScreen(hexAt(pos.to));
  const x = a.x + (b.x - a.x) * pos.f;
  const y = a.y + (b.y - a.y) * pos.f;
  const unit = camera.hexWidth;

  // Behind it, footprints along the hexes it has walked; ahead, a line along
  // the hexes it will walk, to the hex it is going to — or, on the way back,
  // to the city — ringed where it ends.
  const at = (k: number) => camera.hexToScreen(hexAt(trip.path[k]));
  const here = { x, y };
  const last = trip.path.length - 1;
  const walked: Array<{ x: number; y: number }> = [];
  const ahead: Array<{ x: number; y: number }> = [here];
  if (pos.outbound) {
    for (let k = 0; k <= pos.step; k++) walked.push(at(k));
    walked.push(here);
    for (let k = pos.step + 1; k <= last; k++) ahead.push(at(k));
  } else {
    for (let k = last; k > pos.step; k--) walked.push(at(k));
    walked.push(here);
    for (let k = pos.step; k >= 0; k--) ahead.push(at(k));
  }
  drawFootprints(ctx, walked, unit);
  drawRoute(ctx, ahead, unit);

  // The scout, gameplay-sized: a figure on the board, not a portrait.
  const fw = Math.max(18, unit * 0.32);
  const aspect = spriteAspect('hero_scout');
  if (aspect !== null) {
    drawSprite(ctx, 'hero_scout', x - fw / 2, y - fw * aspect * 0.85, fw, fw * aspect);
  } else {
    ctx.fillStyle = '#3d6b2f';
    ctx.beginPath();
    ctx.arc(x, y - fw * 0.4, fw * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // A wooden pill: how long until it is there, until the hex is explored, or
  // until it is home.
  const until = pos.working ? revealsAt(trip) : pos.outbound ? arrivesAt(trip) : returnsAt(trip);
  const left = Math.max(0, (until - now) / 1000);
  const text = formatCountdown(left);
  const fs = Math.max(11, Math.min(15, unit * 0.11));
  ctx.save();
  ctx.font = `800 ${fs}px Nunito, system-ui, sans-serif`;
  const tw = ctx.measureText(text).width;
  const pw = tw + fs * 1.4;
  const ph = fs * 1.6;
  const px = x - pw / 2;
  const py = y - fw * (aspect ?? 1) * 0.85 - ph - 4;
  ctx.fillStyle = '#5a3a20';
  ctx.strokeStyle = '#2e1c0e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, ph / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff3d6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, py + ph / 2 + 0.5);
  ctx.restore();
}
