// The world board, drawn (Docs/features/19-world-map.md §1–§3,
// Docs/art/art-direction.md §2, §7, §8).
//
// A flat, top-down board: each hex a plate of the province's own terrain
// texture, with the province's own sprites standing on it as props — one
// palette, one terrain set, one light. There is no hex art yet, so this is
// the province's art arranged on a hex; the plates and props it reads are
// named in one place below, so hex art drops in by filename.
//
// The three fog states are treatments of the same hex, never a second asset:
// Revealed is full colour, Sensed is the same hex dimmed under a thin veil,
// Unknown is opaque rolling mist. Ownership is a border on the hex edge.

import type { GameState } from '../../sim/state';
import type { BoardHex } from '../../sim/world/board';
import {
  arrivesAt, fogStateOf, homeIndex, returnsAt, worldFogAt, type FogState,
} from '../../sim/world/explorers';
import { hexAt, type Hex } from '../../sim/world/hex';
import type { WorldSource } from '../../sim/world/source';
import type { WorldFeature, WorldImprovement, WorldTerrain } from '../../sim/world/types';
import { formatCountdown } from '../../ui/format';
import { PALETTE } from '../palette';
import { drawIcon, drawSprite, spriteAspect } from '../sprites';
import { WORLD_BUILD } from '../../sim/data/definitions';
import { hexCorners, regionEdges } from './hexLayout';
import type { HexCamera } from './hexCamera';

/** The terrain plate under each kind of ground: the province's tileable
 *  textures, clipped to the hex. */
const PLATE: Record<WorldTerrain, string> = {
  Grassland: 'terrain_grassland',
  Plains: 'terrain_plains',
  Desert: 'terrain_desert',
  Mountain: 'terrain_grassland',
};

/** A flat colour under the plate, for the frames before it loads. */
const PLATE_COLOR: Record<WorldTerrain, string> = {
  Grassland: '#6fae3c', Plains: '#a8ab4c', Desert: '#d8bf78', Mountain: '#8f9a7c',
};

/** What stands on a hex, and how big, as a share of the hex's width. */
const PROP: Record<WorldFeature | 'Mountain', { sprite: string; size: number }> = {
  Mountain: { sprite: 'mountain_2x2', size: 0.9 },
  Forest: { sprite: 'forest_3', size: 0.8 },
  FertileLand: { sprite: 'farmlands', size: 0.6 },
  Game: { sprite: 'wild_animals', size: 0.5 },
  Dungeon: { sprite: 'mountain', size: 0.62 },
  Sanctuary: { sprite: 'landmark_leyspring', size: 0.5 },
  Landmark: { sprite: 'landmark_stones', size: 0.56 },
};

/** What stands on a held hex: the province's own buildings, standing in
 *  until hex art exists. A level draws the highest tier at or below it. */
const IMPROVEMENT_SPRITE: Record<WorldImprovement, string> = {
  LoggingCamp: 'sawmill', Homestead: 'farm', StonePit: 'quarry', Fortress: 'barracks',
};
const tierOf = (level: number): string => (level >= 8 ? 'l8' : level >= 4 ? 'l4' : 'l1');
const OUTPOST_SPRITE = 'landmark_watchtower';
const CUT_OFF = 'rgba(60, 64, 72, 0.5)';

/** The player's colour, then the five rivals', in seat order after it. */
export const SEAT_COLORS = {
  you: '#2f6fe0',
  rivals: ['#c8312b', '#2e9e57', '#e0a020', '#7b4fc9', '#1c9a9a'],
};

const MIST = '#d9e0e6';
const MIST_DEEP = '#b9c4cd';
const SEAM = 'rgba(40, 52, 30, 0.28)';
const SENSED_DIM = 'rgba(24, 32, 44, 0.48)';
const SENSED_VEIL = 'rgba(225, 232, 238, 0.28)';

export interface WorldFrame {
  state: GameState;
  source: WorldSource;
  now: number;
  /** The hex the dispatch sheet is about, or null. */
  selected: number | null;
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

  for (const trip of state.world.explorers) drawExplorer(ctx, camera, trip, now);
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

  if (fogState === 'Unknown') {
    drawMist(ctx, c.x, c.y, r, bh.index);
    return;
  }

  ctx.save();
  hexPath(ctx, c.x, c.y, r);
  ctx.clip();
  if (bh.role === 'portal') {
    drawPortalGround(ctx, c.x, c.y, r);
  } else if (bh.terrain !== null) {
    ctx.fillStyle = PLATE_COLOR[bh.terrain];
    ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
    drawSprite(ctx, PLATE[bh.terrain], c.x - r, c.y - r, r * 2, r * 2);
  }
  ctx.restore();

  // What stands on it, standing up off the plate: a city, the Portal, or the
  // ground's own props, at most three side by side.
  if (bh.seat !== null) {
    const mine = bh.index === homeIndex(frame.state);
    drawProp(ctx, mine ? 'townhall_l8' : 'townhall_l4', c.x, c.y + r * 0.35, hw * 0.86);
  } else if (bh.role === 'portal') {
    drawPortal(ctx, c.x, c.y, r);
  } else {
    const held = frame.source.hexOf(bh.index);
    const props: Array<{ sprite: string; size: number }> = [];
    if (bh.terrain === 'Mountain') props.push(PROP.Mountain);
    for (const f of bh.features) props.push(PROP[f]);
    // An improvement takes the middle; the ground's own props step aside.
    const standing = held?.improvement ?? null;
    const scale = standing !== null ? 0.6 : 1;
    const spread = standing !== null
      ? [-0.3, 0.3, 0.3].slice(0, props.length)
      : props.length <= 1 ? [0] : props.length === 2 ? [-0.2, 0.2] : [-0.26, 0, 0.26];
    props.slice(0, 3).forEach((p, i) => {
      drawProp(ctx, p.sprite, c.x + spread[i] * hw, c.y + r * (0.3 + (i % 2) * 0.12), hw * p.size * scale * (props.length > 1 ? 0.8 : 1));
    });
    if (held !== null) drawHeld(ctx, camera, held, c, fogState, frame);
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
    const py = cy + Math.sin(a) * r * 0.35;
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
  ctx.ellipse(cx, cy, r * 0.48, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
    const sx = cx + Math.cos(a) * r * 0.6;
    const sy = cy + Math.sin(a) * r * 0.5;
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

function drawHeld(
  ctx: CanvasRenderingContext2D, camera: HexCamera,
  held: NonNullable<ReturnType<WorldSource['hexOf']>>, c: { x: number; y: number }, fogState: FogState, frame: WorldFrame,
): void {
  const r = camera.hexRadius;
  const hw = camera.hexWidth;
  // The Outpost: a small watch-tower on the hex's upper right, faint while
  // its builder is still at it.
  ctx.save();
  if (!held.held) ctx.globalAlpha = 0.45;
  drawProp(ctx, OUTPOST_SPRITE, c.x + hw * 0.27, c.y - r * 0.18, hw * 0.16);
  ctx.restore();
  if (held.improvement !== null || held.work !== null) {
    const kind = held.improvement?.kind ?? held.work!.kind;
    const level = held.improvement?.level ?? 1;
    ctx.save();
    if (held.improvement === null) ctx.globalAlpha = 0.45; // its first level still building
    drawProp(ctx, `${IMPROVEMENT_SPRITE[kind]}_${tierOf(level)}`, c.x, c.y + r * 0.42, hw * 0.62);
    ctx.restore();
  }
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

/** Where a trip is at `now`: between step `step` and the next of its path,
 *  `f` of the way, and whether it is still on its way out. */
function tripPosition(
  trip: GameState['world']['explorers'][number], now: number,
): { step: number; from: number; to: number; f: number; outbound: boolean } {
  const steps = trip.path.length - 1;
  const s = Math.max(0, (now - trip.departedAt) / trip.msPerHex);
  const outbound = s <= steps;
  const along = outbound ? s : Math.max(0, 2 * steps - s);
  const i = Math.min(steps - 1, Math.floor(along));
  return { step: i, from: trip.path[i], to: trip.path[i + 1], f: Math.min(1, along - i), outbound };
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

  // The trail: footprints from the city along the path to where it stands.
  ctx.save();
  ctx.fillStyle = 'rgba(255, 252, 240, 0.9)';
  const pts: Array<{ x: number; y: number }> = [];
  for (let k = 0; k <= pos.step; k++) pts.push(camera.hexToScreen(hexAt(trip.path[k])));
  pts.push({ x, y });
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

  // A wooden pill: how long until it is there, or until it is home.
  const left = Math.max(0, ((pos.outbound ? arrivesAt(trip) : returnsAt(trip)) - now) / 1000);
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
