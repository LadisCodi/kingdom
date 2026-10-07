// The world board, drawn (Docs/features/19-world-map.md §1–§3,
// Docs/art/art-direction.md §2, §7, §8).
//
// A slightly tilted board (art-direction §7.1): each hex a terrain plate and
// one sprite for its feature, or the district standing in its place, with
// its Fortress at the rear corner (hexArt.ts, Docs/plans/world-hex-art.md). Hex art
// drops in by filename; until a file exists, the province's own textures and
// sprites stand in for it.
//
// The three fog states are treatments of the same hex, never a second asset:
// Revealed is full colour; Sensed is under a thin veil (cloudGrid.ts), what
// stands on it rising out as a pale silhouette; Unknown is under the cloud
// bank. A reveal eases a hex from one to the next.
//
// Four canvases, bottom to top: the GROUND (plates, sides, seams, the grey
// of a cut-off hex), the CLOUD BANK and its veil, what STANDS on the board —
// first the rims on the hex edges (ownership, selection), then everything
// upright on a hex — and this one, every mark over the board that moves or
// counts down. So the clouds lap over the near edge of a tile, and nothing
// upright is hidden or under a rim. The ground and what stands are kept,
// and slide under a pan (keepLayers): only this canvas is drawn every frame.

import { worldStoreReady } from '../../sim/world/stores';
import type { GameState } from '../../sim/state';
import { lumpMaterial, type BoardHex } from '../../sim/world/board';
import {
  arrivesAt, exploreGold, fogStatesOf, homeIndex, returnsAt, revealsAt, tripRevealing, worldFogAt, type FogState,
} from '../../sim/world/explorers';
import { PORTAL_INDICES, boardNeighbors, hexAt, hexIndex, type Hex } from '../../sim/world/hex';
import { imageCounts, loadImage } from '../imageLoad';
import { crestOf, type Crest } from '../../sim/crest';
import { chargeUrl, fieldUrl } from '../../ui/crestArt';
import type { Seat, WorldSource } from '../../sim/world/source';
import type { HexBits } from '../../sim/world/fogBits';
import type { ArmyView } from '../../worldServer/types';
import { depositMaterial, type WorldDistrict, type WorldTerrain } from '../../sim/world/types';
import { formatCount, formatCountdown } from '../../ui/format';
import { PALETTE } from '../palette';
import { drawIcon, drawSprite, spriteAspect, spriteUrl } from '../sprites';
import { homeboundMs, legPosition } from '../../sim/world/travel';
import {
  COMBO_SPRITE, PLATE_SPRITE, fortressSprite, hexArt, pickVariant, type HexCombo,
} from './hexArt';
import { TILT, hexCorners, labelShown, regionEdges, type WorldLabel } from './hexLayout';
import { drawCloudBank } from '../fog/fogLayer';
import { DENSITY, HEX_GRID, MASK_ORIGIN, MASK_SPAN, maskIndex } from './cloudGrid';
import { HexCamera } from './hexCamera';
import { featureNudge, hash01, hexDecorations } from './hexScatter';
import { DIFFICULTY_COLOR, campDifficulty, campShown, strongestParty } from '../../sim/world/camps';
import { ARTIFACTS, LAIRS, WORLD_DUNGEON } from '../../sim/data/definitions';

/** A flat colour under the plate, for the frames before it loads. */
const PLATE_COLOR: Record<WorldTerrain, string> = {
  Grassland: '#6fae3c', Plains: '#a8ab4c', Desert: '#d8bf78',
};

/** Until a combination has its own art, the province's sprites stand in for
 *  it: each a share of the hex's width, offset across it (`dx`, of the
 *  width) and down it (`dy`, of the tilted radius, from the centre). */
const COMBO_STAND_IN: Record<HexCombo, Array<{ sprite: string; size: number; dx: number; dy: number }>> = {
  Forest: [{ sprite: 'forest_3', size: 0.8, dx: 0, dy: 0.3 }],
  FertileLand: [{ sprite: 'farmlands', size: 0.6, dx: 0, dy: 0.3 }],
  Game: [{ sprite: 'wild_animals', size: 0.5, dx: 0, dy: 0.3 }],
  Mountain: [{ sprite: 'mountain_2x2', size: 0.9, dx: 0, dy: 0.3 }],
  MountainDungeon: [
    { sprite: 'mountain_2x2', size: 0.82, dx: -0.04, dy: 0.25 },
    { sprite: 'mountain', size: 0.36, dx: 0.22, dy: 0.5 },
  ],
  Sanctuary: [{ sprite: 'landmark_leyspring', size: 0.5, dx: 0, dy: 0.3 }],
  Landmark: [{ sprite: 'landmark_stones', size: 0.56, dx: 0, dy: 0.3 }],
  HeartwoodGrove: [{ sprite: 'forest_3', size: 0.8, dx: 0, dy: 0.3 }],
  StarfallCrater: [{ sprite: 'mountain', size: 0.5, dx: 0, dy: 0.3 }],
  MoonglassSpires: [{ sprite: 'landmark_stones', size: 0.56, dx: 0, dy: 0.3 }],
};

/** Until a district has its own art, a province building stands in for it,
 *  in front of its feature's drawing. */
const DISTRICT_STAND_IN: Record<WorldDistrict, string> = {
  Rural: 'housing_l1', LoggingCamp: 'sawmill_l1', Quarry: 'quarry_l1', FarmLands: 'farm_l1',
  HuntingGrounds: 'housing_l1', Observatory: 'housing_l1', Shrine: 'housing_l1',
  GroveCamp: 'sawmill_l1', StarmetalDig: 'quarry_l1', SpireQuarry: 'quarry_l1',
};

/** Hex art's foot line: the bottom of its canvas, a little in front of the
 *  hex's centre (world-hex-art.md §2), as a share of the tilted radius. */
const FOOT = 0.62;
/** The Fortress's keep at the rear corner, as a share of the hex's width. */
const FORTRESS_WIDTH = 0.3;
/** The Chapel, at the rear corner the Fortress leaves free. */
const CHAPEL_SPRITE = 'whex_chapel';
/** Narrower than the keep: it stands taller. */
const CHAPEL_WIDTH = 0.2;
/** Below this many pixels a hex, the strategic zoom (world-hex-art.md §4). */
const STRATEGIC_PX = 70;
const CUT_OFF = 'rgba(60, 64, 72, 0.5)';
/** A district raiders burnt: charred earth and soot. */
const BURNT = 'rgba(38, 22, 14, 0.55)';

/** The player's colour, then the five rivals', in seat order after it. */
export const SEAT_COLORS = {
  you: '#2f6fe0',
  // Ten, so the 41 rivals of a world of seven boards seldom meet their own
  // colour across a seam; none near the player's blue.
  rivals: ['#c8312b', '#2e9e57', '#e0a020', '#7b4fc9', '#1c9a9a', '#d2691e', '#c2185b', '#6b8e23', '#795548', '#9e9d24'],
};

/** The line between two hexes: faint, so the board reads as land and the
 *  hexes are found rather than drawn. */
const SEAM = 'rgba(40, 52, 30, 0.08)';
/** A tile's side: packed earth. */
const SKIRT_EARTH = { lit: '#7a5a3a', shade: '#5c4129' };
/** What stands on a Sensed hex rises out of its veil as a silhouette: pale
 *  in the cloud-shadow tone, paler still and hazy at its foot
 *  (art-direction §8.1). */
const SILHOUETTE_TOP = [171, 181, 243, 0.62] as const;
const SILHOUETTE_FOOT = [223, 216, 235, 0.8] as const;
/** How long a hex takes to ease from the bank to clear ground, and how long
 *  a tap's flash on a hex lasts. */
const REVEAL_MS = 1100;
const PRESS_MS = 320;

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
  const layers = worldLayers(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const { state, source, now } = frame;
  const board = source.board();
  const r = camera.hexRadius;
  const motion = motionOf(canvas);
  const facts = factsOf(source);
  const states = fogStates(motion, state, source, now);
  const clock = performance.now();
  const density = easeDensities(motion, motion.targets!, clock);
  /** How much veil a hex carries, 0 clear to 1 Sensed or thicker. */
  const veilAt = (i: number): number => Math.min(1, density[i] / DENSITY.Sensed);
  /** How much of the bank still stands on a hex, 0 to 1. */
  const bankAt = (i: number): number => Math.max(0, (density[i] - DENSITY.Sensed) / (1 - DENSITY.Sensed));

  // The clouds, over the ground and under what stands on it: every Unknown
  // hex, and the world past the board's edge — the board stops and the
  // clouds go on (19 §1) — and the veil over every Sensed one.
  const mask = cloudMask(motion, board, density);
  drawCloudBank(layers.clouds, HEX_GRID, {
    w, h, dpr, camX: camera.x, camY: camera.y, zoom: camera.zoom,
    mask, maskX: MASK_ORIGIN, maskY: MASK_ORIGIN, maskW: MASK_SPAN, maskH: MASK_SPAN,
    maskSig: String(motion.maskVersion), clock,
    // Far out, the puffs grow so they stay calm: the texture at twice the
    // size takes over between these zooms.
    far: smoothstep(FAR_FROM_ZOOM, FAR_FULL_ZOOM, camera.zoom),
  });

  // The selected hex: a tap flashes it and swells its rim for a moment, so
  // it is answered before the sheet is read.
  if (frame.selected !== motion.selected) {
    motion.selected = frame.selected;
    motion.pressAt = clock;
  }

  // THE KEPT LAYERS: the ground, and everything that stands on the board,
  // drawn again only when what they show changes; a pan slides them.
  keepLayers(layers, camera, frame, motion, facts, states, veilAt, w, h, dpr, clock);

  // From here on, THIS canvas: what moves or counts down, over everything.
  const onScreen = (c: { x: number; y: number }, above = 3): boolean =>
    c.x >= -r * 2 && c.x <= w + r * 2 && c.y >= -r * above && c.y <= h + r * 2;

  if (frame.selected !== null) {
    const press = Math.max(0, 1 - (clock - motion.pressAt) / PRESS_MS);
    if (press > 0) {
      const c = camera.hexToScreen(hexAt(frame.selected));
      ctx.save();
      hexPath(ctx, c.x, c.y, r);
      ctx.fillStyle = `rgba(255, 244, 214, ${(0.5 * press * press).toFixed(3)})`;
      ctx.fill();
      ctx.restore();
      drawBorder(ctx, camera, [hexAt(frame.selected)], PALETTE.selected, 1, 4 * (1 + 0.8 * press));
    }
  }

  // Over the ground the player holds or claims: a builder's time left, or a
  // store ready to collect.
  for (const index of facts.held) {
    const fogState = states[index];
    if (fogState === 'Unknown') continue;
    const c = camera.hexToScreen(hexAt(index));
    if (!onScreen(c)) continue;
    drawHeldMarks(ctx, camera, source.hexOf(index)!, c, fogState, now);
  }

  // Burnt districts: fire at their foot and smoke rising in columns (19 §5.5).
  // A raid to come is an arc from the camp to each district of the player's
  // it will raid, its dashes running towards it, and the time left on the camp:
  // "this camp raids this district in this time".
  const raids: Array<{ camp: number; target: number }> = [];
  const raidAt = new Map<number, number>();
  for (const index of facts.held) {
    const hc = source.hexOf(index)!;
    if (states[index] !== 'Revealed') continue;
    if (hc.burnt) {
      const c = camera.hexToScreen(hexAt(index));
      if (!onScreen(c, 4)) continue;
      drawFire(ctx, camera, c, index, clock);
    } else if (hc.threat != null) {
      for (const camp of hc.threat.camps) {
        raids.push({ camp, target: index });
        raidAt.set(camp, Math.min(raidAt.get(camp) ?? Infinity, hc.threat.nextRaidAt));
      }
    }
  }
  for (const { camp, target } of raids) {
    const from = camera.hexToScreen(board.hexes[camp].hex);
    const to = camera.hexToScreen(board.hexes[target].hex);
    drawRaidArc(ctx, camera, from, to, clock + camp * 211 + target * 97);
  }

  // Over every camp the player can see, how hard it is against the
  // strongest party they could send (19 §5.4) — on explored ground only,
  // since a camp in the mist is only a shape.
  const party = strongestParty(state);
  const shows = (label: WorldLabel): boolean => labelShown(label, camera.hexWidth);
  for (const bh of board.hexes) {
    if (states[bh.index] !== 'Revealed' || bh.camp === null || !campShown(source, bh, 'Revealed')) continue;
    if (!raidAt.has(bh.index) && !shows('camp')) continue;
    const c = camera.hexToScreen(bh.hex);
    if (!onScreen(c)) continue;
    // Its power, in the units of the player's own army, coloured by how it
    // compares with the strongest party they could send.
    const difficulty = campDifficulty(bh.camp.power, party);
    drawCampPower(ctx, camera, c.x - camera.hexWidth * 0.14, c.y - r * 0.2, formatCount(bh.camp.power), DIFFICULTY_COLOR[difficulty]);
    // A camp about to raid: the time left, under its difficulty.
    const at = raidAt.get(bh.index);
    if (at !== undefined) drawRaidTimer(ctx, camera, c.x - camera.hexWidth * 0.14, c.y + r * 0.22, formatCountdown(Math.max(0, (at - now) / 1000)));
  }

  // A dungeon: how far the player has gone in it, as a ring and "13/24",
  // and a badge when their army is camped there and can fight (19 §8.2).
  const total = WORLD_DUNGEON.depths * WORLD_DUNGEON.roomsPerDepth;
  for (const bh of board.hexes) {
    if (!shows('dungeon')) break;
    if (!bh.features.includes('Dungeon') || states[bh.index] !== 'Revealed') continue;
    const c = camera.hexToScreen(bh.hex);
    if (!onScreen(c)) continue;
    const camped = (frame.armies ?? []).some((a) => a.target === bh.index && a.purpose === 'delve' && a.phase === 'camp'
      && source.seats()[a.owner]?.owner.you === true);
    drawProgressRing(ctx, camera, c.x, c.y - r * 0.55, source.delved(bh.index), total, camped);
  }

  // A deposit: a sparkle and its material's icon at its right corner
  // (Docs/plans/precious-deposits.md), on ground the player has explored.
  for (const bh of board.hexes) {
    if (!shows('deposit')) break;
    if (states[bh.index] !== 'Revealed') continue;
    const material = depositMaterial(bh.features);
    if (material === null) continue;
    const c = camera.hexToScreen(bh.hex);
    if (!onScreen(c)) continue;
    drawRich(ctx, camera, c.x + camera.hexWidth * 0.3, c.y + r * 0.1, material, clock + bh.index * 397);
  }

  // Over every misty hex, what exploring it promises and the Gold it costs
  // (19 §3.2); once an explorer is on its way there, only the promise.
  for (const bh of board.hexes) {
    if (!shows('promise')) break;
    if (states[bh.index] !== 'Sensed' || bh.scout === null) continue;
    const c = camera.hexToScreen(bh.hex);
    if (!onScreen(c)) continue;
    const going = tripRevealing(state, bh.index) !== null;
    const seat = state.world.board.seat;
    const icon = bh.scout.reward === 'Pack' ? 'pack'
      : bh.scout.reward === 'Precious' ? lumpMaterial(board, seat, 'scout', bh.index, seat) : bh.scout.reward;
    drawPromise(ctx, camera, c.x, c.y - r * 0.15, icon,
      going ? null : formatCount(exploreGold(state, bh.index)));
  }

  // The Portals' appointment, over each: when they open, or how long they
  // have left (19 §10.1) — all seven on the world's one clock.
  const portal = source.portal();
  if (portal !== null) {
    const left = Math.max(0, ((portal.open ? portal.closesAt : portal.opensAt) - now) / 1000);
    for (const index of PORTAL_INDICES) {
      const c = camera.hexToScreen(hexAt(index));
      if (c.x < -r * 3 || c.x > w + r * 3 || c.y < -r * 3 || c.y > h + r * 3) continue;
      drawPill(ctx, camera, c.x, c.y - camera.hexRadius * 0.75,
        portal.open ? `Open · ${formatCountdown(left)}` : `Opens in ${formatCountdown(left)}`);
    }
  }

  // Under every city the player can see, its kingdom's name on a plank
  // (19 §1.3): the nickname a player chose, or a rival's — its crest hung
  // at the plank's left end (15 §2.2). The player's own is the save's, which
  // the board may not have heard yet.
  for (const seat of source.seats()) {
    const friend = !seat.owner.you && seat.owner.friend === true;
    if (!seat.owner.you && (states[seat.index] === 'Unknown' || (!friend && !shows('rival')))) continue;
    const c = camera.hexToScreen(hexAt(seat.index));
    if (c.x < -r * 3 || c.x > w + r * 3 || c.y < -r * 2 || c.y > h + r * 3) continue;
    const color = seatColor(seat);
    const crest = crestOf(seat.owner.name, seat.owner.you ? state.kingdom.profile.crest : seat.owner.crest);
    drawNameplate(ctx, camera, c.x, c.y + r * 0.62, seat.owner.name, color, seat.owner.you, crest);
  }

  // A route fades as it goes into the bank.
  const routeAlpha = (i: number): number => 1 - 0.65 * bankAt(i);
  for (const trip of state.world.explorers) drawExplorer(ctx, camera, trip, now, routeAlpha);
  for (const army of frame.armies ?? []) {
    const seat = source.seats()[army.owner];
    const color = seat === undefined ? '#888' : seatColor(seat);
    const at = armyPosition(army, now);
    // A rival's army is seen only where the player can see.
    const near = states[at.from] !== 'Unknown' || states[at.to] !== 'Unknown';
    // Only the player's own armies show the way they are taking.
    if (seat?.owner.you || near) drawArmy(ctx, camera, army, at, color, now, seat?.owner.you === true, routeAlpha);
  }
}

/** A seat's colour: the player's blue, or its rival's. */
function seatColor(seat: Seat): string {
  return seat.owner.you ? SEAT_COLORS.you : SEAT_COLORS.rivals[seat.owner.rival % SEAT_COLORS.rivals.length];
}

// ------------------------------------------------------- what is read once

/** What the board draws from a source that only a new source changes: the
 *  hexes held or claimed, each seat's ground for its border, and the
 *  signatures the kept layers are compared against. */
interface Facts {
  /** Every hex someone holds or is claiming, by index. */
  held: number[];
  /** Each seat, and its city with the ground it holds or claims. */
  regions: Array<{ seat: Seat; region: number[] }>;
  /** What the ground is drawn from: who holds what, and how it stands. */
  ground: string;
  /** What everything standing on the board is drawn from. */
  stand: string;
}
const factsBySource = new WeakMap<WorldSource, Facts>();

function factsOf(source: WorldSource): Facts {
  let f = factsBySource.get(source);
  if (f !== undefined) return f;
  const board = source.board();
  const held: number[] = [];
  const owned = new Map<number, number[]>();
  let ground = '';
  let stand = '';
  for (const bh of board.hexes) {
    const hc = source.hexOf(bh.index);
    if (hc !== null) {
      held.push(bh.index);
      if (hc.owner !== null) {
        const list = owned.get(hc.owner) ?? [];
        list.push(bh.index);
        owned.set(hc.owner, list);
      }
      const how = `${bh.index}:${hc.owner}:${hc.held ? 1 : 0}${hc.active ? 1 : 0}${hc.burnt ? 1 : 0}`;
      ground += `${how};`;
      stand += `${how}:${hc.district}:${hc.fortress}:${hc.work?.upgrade ?? ''}${hc.work?.toLevel ?? ''}`
        + `:${hc.chapel ? 1 : 0}:${hc.relic?.id ?? ''};`;
    }
    if (bh.features.includes('Dungeon')) stand += `d${bh.index};`;
    if (bh.camp !== null && source.campBeaten(bh.index)) stand += `b${bh.index};`;
  }
  const regions = source.seats().map((seat) => ({ seat, region: [seat.index, ...(owned.get(seat.seat) ?? [])] }));
  for (const { seat } of regions) {
    stand += `s${seat.seat}:${seat.owner.you ? 'y' : `${seat.owner.rival}${seat.owner.friend ? 'f' : ''}`};`;
  }
  f = { held, regions, ground, stand };
  factsBySource.set(source, f);
  return f;
}

/** Every hex's fog state, read again only when the fog or the source
 *  changes — and each hex's density target with it. */
function fogStates(m: Motion, state: GameState, source: WorldSource, now: number): readonly FogState[] {
  const fog = worldFogAt(state, now);
  if (m.states === undefined || m.fogSource !== source || m.fog === undefined || !sameBits(m.fog, fog)) {
    m.fog = fog;
    m.fogSource = source;
    m.states = withFriends(source, fogStatesOf(fog));
    m.statesSig = m.states.map((s) => s[0]).join('');
    m.targets = m.states.map((s) => DENSITY[s]);
  }
  return m.states;
}

function sameBits(a: HexBits, b: HexBits): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** The cloud bank's mask: each hex's density as a byte, and 255 past the
 *  board. Its version moves on only when a byte does, so the texture is
 *  uploaded — and what stands in the veil drawn again — only then. */
function cloudMask(m: Motion, board: ReturnType<WorldSource['board']>, density: Float32Array): Uint8Array {
  const next = m.maskNext ??= new Uint8Array(MASK_SPAN * MASK_SPAN).fill(255);
  for (const bh of board.hexes) next[maskIndex(bh.hex)] = Math.round(density[bh.index] * 255);
  const mask = m.mask;
  let same = mask !== undefined;
  for (let i = 0; same && i < next.length; i++) if (mask![i] !== next[i]) same = false;
  if (same) return mask!;
  m.maskNext = mask ?? new Uint8Array(MASK_SPAN * MASK_SPAN).fill(255);
  m.mask = next;
  m.maskVersion += 1;
  return next;
}

// --------------------------------------------------------- the kept layers

/**
 * THE GROUND AND WHAT STANDS ON IT, KEPT — the province's floor
 * (mapRenderer.ts drawFloor), twice. Plates, blends, seams and roads on the
 * ground canvas; borders, the selected rim and everything upright on the
 * hexes — their silhouettes in the veil among them — on the canvas over
 * the clouds. Neither changes unless the camera does, the fog does, what is
 * held does or art loads, so both are drawn `SLIDE_MARGIN` px past the
 * screen on every side:
 *
 * - a PAN slides them (a CSS transform, composited) until the screen
 *   reaches their edge, and only then are they drawn again around the view;
 * - a ZOOM scales them while it is still moving, and draws them again,
 *   sharp, once it has settled — or sooner, if they no longer cover the
 *   screen or are blown up past `SLIDE_MAX_SCALE`;
 * - each is drawn again, where it lies, when what it shows changes.
 */
const SLIDE_MARGIN = 256;
const SLIDE_MAX_SCALE = 1.3;
const SLIDE_ZOOM_SETTLE_MS = 160;

interface Slide {
  /** The camera both layers were drawn through, frozen at the view. */
  cam: HexCamera;
  w: number;
  h: number;
  dpr: number;
  /** Their size in CSS px. */
  cw: number;
  ch: number;
  /** What each was last drawn from, or null to draw it. */
  ground: string | null;
  stand: string | null;
  /** The zoom of the last frame, and when it last changed. */
  lastZoom: number;
  zoomAt: number;
}

function keepLayers(
  layers: WorldLayers, camera: HexCamera, frame: WorldFrame, motion: Motion, facts: Facts,
  states: readonly FogState[], veilAt: (i: number) => number, w: number, h: number, dpr: number, clock: number,
): void {
  const zoom = camera.zoom;
  let s = motion.slide;
  if (s !== undefined && s.lastZoom !== zoom) {
    s.lastZoom = zoom;
    s.zoomAt = clock;
  }
  // Where the layers as drawn land on screen now.
  const place = (sl: Slide) => {
    const px = sl.cam.x + (-SLIDE_MARGIN - w / 2) / sl.cam.zoom;
    const py = sl.cam.y + (-SLIDE_MARGIN - h / 2) / sl.cam.zoom;
    return { k: zoom / sl.cam.zoom, x: (px - camera.x) * zoom + w / 2, y: (py - camera.y) * zoom + h / 2 };
  };
  let at = s === undefined ? null : place(s);
  const keep = s !== undefined && at !== null
    && s.w === w && s.h === h && s.dpr === dpr
    && (s.cam.zoom === zoom || (clock - s.zoomAt < SLIDE_ZOOM_SETTLE_MS && at.k <= SLIDE_MAX_SCALE))
    && at.x <= 0 && at.y <= 0 && at.x + s.cw * at.k >= w && at.y + s.ch * at.k >= h;
  if (!keep || s === undefined) {
    const cam = new HexCamera({ clientWidth: w, clientHeight: h });
    cam.x = camera.x;
    cam.y = camera.y;
    cam.zoom = zoom;
    const cw = w + 2 * SLIDE_MARGIN;
    const ch = h + 2 * SLIDE_MARGIN;
    for (const c of [layers.ground, layers.stand]) {
      const bw = Math.round(cw * dpr);
      const bh = Math.round(ch * dpr);
      if (c.width !== bw || c.height !== bh) {
        c.width = bw;
        c.height = bh;
      }
      c.style.width = `${cw}px`;
      c.style.height = `${ch}px`;
    }
    s = { cam, w, h, dpr, cw, ch, ground: null, stand: null, lastZoom: zoom, zoomAt: s?.zoomAt ?? -Infinity };
    motion.slide = s;
    at = place(s);
  }
  const settled = imageCounts().settled;
  const ground = `${settled}|${motion.statesSig}|${facts.ground}`;
  const stand = `${settled}|${motion.statesSig}|${motion.maskVersion}|${frame.selected}|${facts.stand}`;
  if (s.ground !== ground) {
    s.ground = ground;
    drawGroundLayer(beginSlide(layers.ground, dpr), s.cam, frame, states, w, h);
  }
  if (s.stand !== stand) {
    s.stand = stand;
    drawStandLayer(beginSlide(layers.stand, dpr), s.cam, frame, facts, states, veilAt, w, h);
  }
  // Snapped to the device pixel while not scaled, so a still layer is never
  // resampled.
  const x = at!.k === 1 ? Math.round(at!.x * dpr) / dpr : at!.x;
  const y = at!.k === 1 ? Math.round(at!.y * dpr) / dpr : at!.y;
  const transform = at!.k === 1 ? `translate(${x}px, ${y}px)` : `translate(${x}px, ${y}px) scale(${at!.k})`;
  for (const c of [layers.ground, layers.stand]) if (c.style.transform !== transform) c.style.transform = transform;
}

/** A kept layer, cleared, drawing in SCREEN coordinates shifted by the margin. */
function beginSlide(c: HTMLCanvasElement, dpr: number): CanvasRenderingContext2D {
  const g = c.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  g.setTransform(dpr, 0, 0, dpr, SLIDE_MARGIN * dpr, SLIDE_MARGIN * dpr);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  return g;
}

/** Is a hex centred at `c` on a kept layer — `above` radii of art over it? */
const onSlide = (c: { x: number; y: number }, r: number, w: number, h: number, above = 3): boolean =>
  c.x >= -SLIDE_MARGIN - r * 2 && c.x <= w + SLIDE_MARGIN + r * 2
  && c.y >= -SLIDE_MARGIN - r * above && c.y <= h + SLIDE_MARGIN + r * 2;

/** The ground: each seen hex's side, plate and seam, the grey of ground cut
 *  off or burnt, then the plates' blends and the roads over them. */
function drawGroundLayer(
  g: CanvasRenderingContext2D, cam: HexCamera, frame: WorldFrame, states: readonly FogState[], w: number, h: number,
): void {
  const r = cam.hexRadius;
  const hw = cam.hexWidth;
  for (const bh of frame.source.board().hexes) {
    // Under the clouds, the hex is not there.
    if (states[bh.index] === 'Unknown') continue;
    const c = cam.hexToScreen(bh.hex);
    if (!onSlide(c, r, w, h)) continue;
    // The tile's thickness under its two lower edges: hidden by the row in
    // front, it shows only along the board's near rim and over the clouds.
    drawSkirt(g, c.x, c.y, r);
    // A city's hex and the Portal have their own drawing; every other hex is
    // its plate and its art (world-hex-art.md §2–§3).
    const held = bh.seat === null && bh.role !== 'portal' ? frame.source.hexOf(bh.index) : null;
    g.save();
    hexPath(g, c.x, c.y, r);
    g.clip();
    if (bh.role === 'portal') {
      drawPortalGround(g, c.x, c.y, r);
    } else if (bh.terrain !== null) {
      const art = hexArt(bh.terrain, bh.features, held?.district ?? null, hw < STRATEGIC_PX);
      g.fillStyle = PLATE_COLOR[bh.terrain];
      g.fillRect(c.x - r, c.y - r * TILT, r * 2, r * 2 * TILT);
      drawSprite(g, variant(art.plate, bh.index), c.x - r, c.y - r * TILT, r * 2, r * 2 * TILT);
    }
    g.restore();
    // Cut off from its city: greyed; burnt by raiders: charred (art-direction §8).
    if (held !== null && bh.terrain !== null) {
      const wash = held.held && !held.active ? CUT_OFF : held.burnt ? BURNT : null;
      if (wash !== null) {
        hexPath(g, c.x, c.y, r);
        g.fillStyle = wash;
        g.fill();
      }
    }
    hexPath(g, c.x, c.y, r * 0.995);
    g.strokeStyle = SEAM;
    g.lineWidth = Math.max(1, r * 0.025);
    g.stroke();
  }
  // Where two terrains meet, each plate fades softly across the edge into
  // its neighbour, so the ground reads as land rather than tiles.
  blendPlates(g, cam, frame, states, w, h);
  // Roads: every standing district joined to its owner's neighbours, its
  // city included — on the ground, over the plates, so what stands on a
  // hex stands over it (19 §7.1).
  drawRoads(g, cam, frame, states);
}

/** Everything standing on the board: first the rims on the hex edges —
 *  each kingdom's border, the selected hex's — then, row by row from the
 *  back, what stands on each hex. */
function drawStandLayer(
  g: CanvasRenderingContext2D, cam: HexCamera, frame: WorldFrame, facts: Facts, states: readonly FogState[],
  veilAt: (i: number) => number, w: number, h: number,
): void {
  const r = cam.hexRadius;
  // Borders: each kingdom's city and the ground it holds or is claiming, as
  // far as the player can see it, in its owner's colour — dashed round a hex
  // whose district is still building.
  const claiming = (hex: Hex): boolean => frame.source.hexOf(hexIndex(hex))?.held === false;
  for (const { seat, region } of facts.regions) {
    const seen = region.filter((i) => states[i] !== 'Unknown');
    if (seen.length === 0) continue;
    const lit = seen.some((i) => states[i] === 'Revealed');
    drawBorder(g, cam, seen.map(hexAt), seatColor(seat), lit ? 1 : 0.55, 3, claiming);
  }
  if (frame.selected !== null) drawBorder(g, cam, [hexAt(frame.selected)], PALETTE.selected, 1, 4);
  // Row by row, top to bottom, so a prop that rises over the hex above is
  // drawn after it.
  const seenAt = (sx: number, sy: number): boolean => {
    const i = hexIndex(cam.screenToHex(sx, sy));
    return i < 0 || states[i] !== 'Unknown';
  };
  for (const bh of frame.source.board().hexes) {
    if (states[bh.index] === 'Unknown') continue;
    const c = cam.hexToScreen(bh.hex);
    if (!onSlide(c, r, w, h)) continue;
    drawStanding(g, cam, bh, states[bh.index], veilAt(bh.index), c, frame, seenAt);
  }
}

/** A friend's city and the ground it holds show through the fog
 *  (15 §2.1): seen as explored, though the player has not explored it. */
export function withFriends(source: WorldSource, states: FogState[]): FogState[] {
  for (const seat of source.seats()) {
    if (seat.owner.you || seat.owner.friend !== true) continue;
    states[seat.index] = 'Revealed';
    for (const bh of source.board().hexes) if (source.hexOf(bh.index)?.owner === seat.seat) states[bh.index] = 'Revealed';
  }
  return states;
}

/** Where an army stands at `now`: between two hexes of its path, `f` of the
 *  way, or in its Fortress. */
/** Where an army is at `now`, as `tripPosition` reads an explorer: between
 *  path[k] and path[next], `f` of the way; still at its hex once it is there. */
function armyPosition(a: ArmyView, now: number): { from: number; to: number; f: number; step: number; outbound: boolean; moving: boolean } {
  const steps = a.path.length - 1;
  if (a.phase === 'garrison' || a.phase === 'camp' || steps === 0) {
    return { from: a.target, to: a.target, f: 0, step: steps, outbound: true, moving: false };
  }
  const out = a.phase === 'out';
  const start = out ? a.departedAt : (a.at ?? now) - homeboundMs(a.stepMs);
  const at = legPosition(a.stepMs, now - start, out);
  return { from: a.path[at.k], to: a.path[at.next], f: at.f, step: Math.min(at.k, at.next), outbound: out, moving: true };
}

function drawArmy(
  ctx: CanvasRenderingContext2D, camera: HexCamera, a: ArmyView,
  at: ReturnType<typeof armyPosition>, color: string, now: number, trail: boolean,
  routeAlpha: (index: number) => number,
): void {
  const p = camera.hexToScreen(hexAt(at.from));
  const q = camera.hexToScreen(hexAt(at.to));
  const x = p.x + (q.x - p.x) * at.f;
  const garrisoned = a.phase === 'garrison';
  const y = p.y + (q.y - p.y) * at.f + (garrisoned ? camera.hexRadius * 0.35 * TILT : 0);
  // The way it has walked and the way still to go, as an explorer's.
  if (trail && at.moving) drawTrail(ctx, camera, a.path, at.step, at.outbound, { x: p.x + (q.x - p.x) * at.f, y: p.y + (q.y - p.y) * at.f }, routeAlpha);
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

/** Far out, the cloud texture at twice the size takes over between these
 *  zooms, so the puffs never shrink to a busy speckle. */
const FAR_FROM_ZOOM = 0.75;
const FAR_FULL_ZOOM = 0.45;

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** What the board remembers between frames: the fog it last read, each
 *  hex's density as it eases toward its fog state, the cloud mask, the tap
 *  on the selected hex, and the kept layers. */
interface Motion {
  /** The fog and source the states were read from (fogStates). */
  fog?: HexBits;
  fogSource?: WorldSource;
  states?: FogState[];
  /** The states, a letter a hex, to compare layers against. */
  statesSig?: string;
  /** Each hex's density as its state would have it. */
  targets?: number[];
  /** The cloud mask, the next one being filled, and how often it changed. */
  mask?: Uint8Array;
  maskNext?: Uint8Array;
  maskVersion: number;
  slide?: Slide;
  density: Float32Array | null;
  at: number;
  selected: number | null;
  pressAt: number;
}
const motions = new WeakMap<HTMLCanvasElement, Motion>();

function motionOf(canvas: HTMLCanvasElement): Motion {
  let m = motions.get(canvas);
  if (m === undefined) {
    m = { density: null, at: 0, selected: null, pressAt: -Infinity, maskVersion: 0 };
    motions.set(canvas, m);
  }
  return m;
}

/** Ease every hex's density toward `target`, a whole step in REVEAL_MS. The
 *  first frame, or one after the board was not drawn for a while, starts
 *  where it is going: a reveal is watched, not replayed. */
function easeDensities(m: Motion, target: readonly number[], clock: number): Float32Array {
  const dt = clock - m.at;
  m.at = clock;
  if (m.density === null || m.density.length !== target.length || dt > 500) {
    m.density = Float32Array.from(target);
    return m.density;
  }
  const step = dt / REVEAL_MS;
  for (let i = 0; i < target.length; i++) {
    const d = target[i] - m.density[i];
    m.density[i] += Math.sign(d) * Math.min(Math.abs(d), step);
  }
  return m.density;
}

// ----------------------------------------------------------- the ground

/** How far a plate's soft edge reaches past its hex, as a share of the
 *  radius, and where inside it starts to fade. */
const BLEND_OUTER = 1.22;
const BLEND_INNER = 0.8;

/** Which ground softens over which where two meet: the higher over the lower. */
const BLEND_RANK: Record<WorldTerrain, number> = { Grassland: 0, Plains: 1, Desert: 2 };

/** A plate's sprite with its edge feathered — opaque in the middle, fading
 *  out past the hex's edge — at a radius in whole pixels. Cached: the
 *  terrain does not change, only the zoom. */
const feathered = new Map<string, HTMLCanvasElement | ImageBitmap>();

function featheredPlate(sprite: string, r: number, dpr: number): HTMLCanvasElement | ImageBitmap | null {
  const url = spriteUrl(sprite);
  const img = url === null ? null : loadImage(url);
  if (img === null || !img.ready) return null;
  const px = Math.max(8, Math.round(r * dpr));
  const key = `${sprite}@${px}`;
  let c = feathered.get(key);
  if (c === undefined) {
    if (feathered.size > 96) feathered.clear();
    c = document.createElement('canvas');
    c.width = Math.ceil(px * BLEND_OUTER * 2);
    c.height = Math.ceil(px * BLEND_OUTER * 2 * TILT);
    const g = c.getContext('2d')!;
    g.drawImage(img.img, 0, 0, c.width, c.height);
    // The fade is a circle on the untilted ground, squashed with it.
    g.globalCompositeOperation = 'destination-in';
    g.save();
    g.scale(1, TILT);
    const cx = c.width / 2;
    const cy = c.height / 2 / TILT;
    const fade = g.createRadialGradient(cx, cy, px * BLEND_INNER, cx, cy, px * BLEND_OUTER);
    fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = fade;
    g.fillRect(0, 0, c.width, c.height / TILT);
    g.restore();
    feathered.set(key, c);
    // A small canvas may stay in software and be uploaded again every time
    // it is drawn; a bitmap of it lives where the board is drawn.
    if (typeof createImageBitmap === 'function') {
      void createImageBitmap(c).then((bitmap) => { if (feathered.get(key) === c) feathered.set(key, bitmap); });
    }
  }
  return c;
}

/** Every plate beside a different terrain, drawn again feathered over its
 *  edges: the two grounds blend where they meet. */
function blendPlates(
  ground: CanvasRenderingContext2D, camera: HexCamera, frame: WorldFrame, states: readonly FogState[], w: number, h: number,
): void {
  const r = camera.hexRadius;
  const hexes = frame.source.board().hexes;
  for (const bh of hexes) {
    if (bh.terrain === null || bh.role === 'portal' || states[bh.index] === 'Unknown') continue;
    // One side of an edge is enough to blend it: the rarer ground softens
    // over the commoner — Plains over Grassland, Desert over both.
    const differs = boardNeighbors(bh.index).some((n) => {
      const t = hexes[n].terrain;
      return t !== null && BLEND_RANK[t] < BLEND_RANK[bh.terrain!] && hexes[n].role !== 'portal' && states[n] !== 'Unknown';
    });
    if (!differs) continue;
    const c = camera.hexToScreen(bh.hex);
    if (!onSlide(c, r, w, h, 2)) continue;
    const plate = featheredPlate(variant(PLATE_SPRITE[bh.terrain], bh.index), r, camera.dpr);
    if (plate === null) continue;
    const rw = r * BLEND_OUTER;
    ground.drawImage(plate, c.x - rw, c.y - rw * TILT, rw * 2, rw * 2 * TILT);
  }
}

// ------------------------------------------------------------------ roads

/** The road strip: a seamless texture running left to right, its road band
 *  across the middle (Docs/plans/world-districts.md §3). */
const ROAD_SPRITE = 'wroad';
/** How wide the strip is drawn, as a share of a hex's width: the road band
 *  is the middle of it. Each road is a little wider or narrower. */
const ROAD_WIDTH = 0.2;
/** How far a road's two bends swing aside, at most, as a share of its
 *  length: some roads arc, some snake. */
const ROAD_BEND = 0.32;
/** How many straight pieces a road's curve is laid in. */
const ROAD_PIECES = 10;
/** Until the texture loads, a plain earth line, this share of a hex wide. */
const ROAD_STAND_IN = { color: 'rgba(150, 112, 70, 0.85)', width: 0.08 };

const roadPatterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern>();

/**
 * One road between two hex centres on the screen, laid on the tilted ground:
 * a curve on the untilted plane from one centre to the other, its two bends
 * swung aside by its own amounts (from `seed`, so each road keeps its shape),
 * then squashed as the ground is. The strip is laid along the curve piece by
 * piece, its texture running on from one piece to the next. Drawn centre to
 * centre, so roads that meet at a hex meet under its district.
 */
function drawRoad(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, hw: number, seed: number): void {
  const dx = b.x - a.x;
  const dy = (b.y - a.y) / TILT;
  const length = Math.hypot(dx, dy);
  // The curve in the road's own frame: from (0, 0) to (length, 0).
  const o1 = (hash01(seed, 1) - 0.5) * 2 * ROAD_BEND * length;
  const o2 = (hash01(seed, 2) - 0.5) * 2 * ROAD_BEND * length;
  const at = (t: number): { x: number; y: number } => {
    const u = 1 - t;
    return {
      x: 3 * u * u * t * (length / 3) + 3 * u * t * t * (2 * length / 3) + t * t * t * length,
      y: 3 * u * u * t * o1 + 3 * u * t * t * o2,
    };
  };
  const url = spriteUrl(ROAD_SPRITE);
  const img = url === null ? null : loadImage(url);
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.scale(1, TILT);
  ctx.rotate(Math.atan2(dy, dx));
  if (img === null || !img.ready) {
    ctx.strokeStyle = ROAD_STAND_IN.color;
    ctx.lineWidth = hw * ROAD_STAND_IN.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(length / 3, o1, (2 * length) / 3, o2, length, 0);
    ctx.stroke();
    ctx.restore();
    return;
  }
  let pattern = roadPatterns.get(ctx);
  if (pattern === undefined) {
    pattern = ctx.createPattern(img.img, 'repeat-x')!;
    roadPatterns.set(ctx, pattern);
  }
  const height = hw * ROAD_WIDTH * (0.85 + 0.3 * hash01(seed, 3));
  const k = height / img.img.naturalHeight;
  ctx.fillStyle = pattern;
  let along = hash01(seed, 4) * img.img.naturalWidth * k; // each road starts somewhere else on the strip
  let p = at(0);
  for (let i = 1; i <= ROAD_PIECES; i++) {
    const q = at(i / ROAD_PIECES);
    const seg = Math.hypot(q.x - p.x, q.y - p.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(q.y - p.y, q.x - p.x));
    pattern.setTransform(new DOMMatrix().translate(-along, -height / 2).scale(k));
    // A hair longer than the piece, so no gap opens on the outside of a bend.
    ctx.fillRect(-1, -height / 2, seg + 2, height);
    ctx.restore();
    along += seg;
    p = q;
  }
  ctx.restore();
}

/** Every road on the board: one between each pair of neighbouring hexes a
 *  seat holds — a standing district, or its city — both of them seen. */
function drawRoads(ctx: CanvasRenderingContext2D, camera: HexCamera, frame: WorldFrame, states: readonly FogState[]): void {
  const source = frame.source;
  const ownerOf = (i: number): number | null => {
    const seat = source.seats().find((s) => s.index === i);
    if (seat !== undefined) return seat.seat;
    const h = source.hexOf(i);
    return h !== null && h.held && h.owner !== null ? h.owner : null;
  };
  const hw = camera.hexWidth;
  for (const bh of source.board().hexes) {
    if (states[bh.index] === 'Unknown') continue;
    const owner = ownerOf(bh.index);
    if (owner === null) continue;
    for (const n of boardNeighbors(bh.index)) {
      // Each pair once, from its lower index; a city to a city never.
      if (n < bh.index || states[n] === 'Unknown' || ownerOf(n) !== owner) continue;
      if (bh.seat !== null && source.board().hexes[n].seat !== null) continue;
      drawRoad(ctx, camera.hexToScreen(bh.hex), camera.hexToScreen(hexAt(n)), hw, bh.index * 131 + n);
    }
  }
}

/** The layers under the board's canvas, bottom to top: the sky far below,
 *  the ground, the clouds, and what stands on the board — made the first
 *  time the board is drawn and laid under it (`.world-layer`). The ground
 *  and what stands are kept and slide (keepLayers). */
interface WorldLayers {
  ground: HTMLCanvasElement;
  clouds: HTMLCanvasElement;
  stand: HTMLCanvasElement;
}
const worldLayerSets = new WeakMap<HTMLCanvasElement, WorldLayers>();

function worldLayers(canvas: HTMLCanvasElement): WorldLayers {
  let layers = worldLayerSets.get(canvas);
  if (layers === undefined) {
    const make = <K extends 'div' | 'canvas'>(tag: K, kind: string): HTMLElementTagNameMap[K] => {
      const c = document.createElement(tag);
      c.className = `world-layer ${kind}`;
      c.setAttribute('aria-hidden', 'true');
      canvas.parentElement?.insertBefore(c, canvas);
      return c;
    };
    make('div', 'world-sky');
    layers = {
      ground: make('canvas', 'world-slide'),
      clouds: make('canvas', 'world-clouds'),
      stand: make('canvas', 'world-slide'),
    };
    worldLayerSets.set(canvas, layers);
  }
  return layers;
}

/** Lay `fill` over what has been drawn standing on a hex. */
function veilStanding(g: CanvasRenderingContext2D, c: { x: number; y: number }, r: number, fill: string): void {
  g.save();
  g.globalCompositeOperation = 'source-atop';
  hexPath(g, c.x, c.y, r);
  g.fillStyle = fill;
  g.fill();
  g.restore();
}

/** A canvas for drawing what stands on one hex before it is washed: the
 *  size of the largest hex's box so far, never of the whole board — it is
 *  copied out once a hex, and a copy of a canvas drawn on again costs what
 *  the canvas weighs. */
let scratch: HTMLCanvasElement | null = null;

/**
 * Draw what stands on a hex apart, then lay it on the board — so a wash over
 * it reaches nothing already there. With `amount` (0 to 1) it becomes a
 * silhouette rising out of its veil: washed in the veil's tones, palest at
 * its foot.
 */
function drawSilhouetted(
  ctx: CanvasRenderingContext2D, c: { x: number; y: number }, r: number, hw: number, amount: number,
  draw: (g: CanvasRenderingContext2D) => void,
): void {
  const board = ctx.canvas;
  const m = ctx.getTransform();
  // The box everything on the hex stands in: on the board's coordinates,
  // then in its backing pixels, cut to the canvas.
  const ux0 = c.x - hw * 0.75;
  const uy0 = c.y - r * 3.2;
  const ux1 = c.x + hw * 0.75;
  const uy1 = c.y + r * 1.1;
  const x0 = Math.max(0, Math.floor(ux0 * m.a + m.e));
  const y0 = Math.max(0, Math.floor(uy0 * m.d + m.f));
  const x1 = Math.min(board.width, Math.ceil(ux1 * m.a + m.e));
  const y1 = Math.min(board.height, Math.ceil(uy1 * m.d + m.f));
  if (x1 <= x0 || y1 <= y0) return;
  const bw = x1 - x0;
  const bh = y1 - y0;
  scratch ??= document.createElement('canvas');
  if (scratch.width < bw || scratch.height < bh) {
    scratch.width = Math.max(scratch.width, bw);
    scratch.height = Math.max(scratch.height, bh);
  }
  const g = scratch.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, bw, bh);
  g.setTransform(m.a, 0, 0, m.d, m.e - x0, m.f - y0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  draw(g);
  if (amount > 0.01) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    const rgba = (t: readonly number[]) => `rgba(${t[0]}, ${t[1]}, ${t[2]}, ${(t[3] * amount).toFixed(3)})`;
    const wash = g.createLinearGradient(0, c.y + r * 0.4 * TILT, 0, c.y - r * 2.2);
    wash.addColorStop(0, rgba(SILHOUETTE_FOOT));
    wash.addColorStop(1, rgba(SILHOUETTE_TOP));
    g.fillStyle = wash;
    g.fillRect(ux0, uy0, ux1 - ux0, uy1 - uy0);
    g.restore();
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(scratch, 0, 0, bw, bh, x0, y0, bw, bh);
  ctx.restore();
}

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const corners = hexCorners(cx, cy, r);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let k = 1; k < 6; k++) ctx.lineTo(corners[k].x, corners[k].y);
  ctx.closePath();
}

/** What stands on a seen hex: as itself, or on a Sensed hex as a silhouette
 *  rising out of its veil. It is drawn apart whenever it is washed — the
 *  veil, or the grey of a hex cut off from its city — so the wash never
 *  reaches the rims drawn under it. */
function drawStanding(
  ctx: CanvasRenderingContext2D, camera: HexCamera, bh: BoardHex, fogState: FogState,
  veil: number, c: { x: number; y: number }, frame: WorldFrame,
  seenAt: (sx: number, sy: number) => boolean,
): void {
  const r = camera.hexRadius;
  const hw = camera.hexWidth;
  // A city's hex and the Portal have their own drawing; every other hex is
  // its plate and its art (world-hex-art.md §2–§3).
  const held = bh.seat === null && bh.role !== 'portal' ? frame.source.hexOf(bh.index) : null;
  const art = bh.terrain === null ? null : hexArt(bh.terrain, bh.features, held?.district ?? null, hw < STRATEGIC_PX);

  const stand = (g: CanvasRenderingContext2D): void => {
    if (bh.seat !== null) {
      const mine = bh.index === homeIndex(frame.state);
      drawProp(g, mine ? 'townhall_l8' : 'townhall_l4', c.x, c.y + r * 0.35 * TILT, hw * 0.86);
    } else if (bh.role === 'portal') {
      drawPortal(g, c.x, c.y, r);
    } else if (art !== null) {
      // The district, which carries its feature in its art; or the feature,
      // with the district's stand-in in front of it until it has art.
      const key = bh.index;
      const own = art.district !== null && spriteUrl(art.district.sprite) !== null;
      // Bare ground and a feature scatter small decorations over the hex,
      // a little past its edge, so neighbours blend (world-hex-art.md §3.1);
      // never where the cloud bank is, nor at the strategic zoom.
      const decos = art.district === null && hw >= STRATEGIC_PX
        ? hexDecorations(key, bh.features[0] ?? null)
          .map((d) => ({ ...d, x: c.x + d.dx * r, y: c.y + d.dy * r * TILT }))
          .filter((d) => spriteUrl(d.sprite) !== null && seenAt(d.x, d.y))
        : [];
      const deco = (d: (typeof decos)[number]) => drawProp(g, d.sprite, d.x, d.y, hw * d.size);
      for (const d of decos) if (d.dy < 0) deco(d);
      if (art.combo !== null && !own) {
        // The feature, nudged off the middle so the rows do not line up.
        const n = art.district === null ? featureNudge(key) : { dx: 0, dy: 0, scale: 1 };
        drawCombo(g, art.combo, key, c.x + n.dx * hw, c.y + r * FOOT * TILT + n.dy * hw, hw * n.scale, r);
      }
      for (const d of decos) if (d.dy >= 0) deco(d);
      if (art.district !== null) {
        g.save();
        if (held !== null && !held.held) g.globalAlpha = 0.45; // still being built
        if (own) drawProp(g, variant(art.district.sprite, key), c.x, c.y + r * FOOT * TILT, hw);
        else drawProp(g, DISTRICT_STAND_IN[art.district.kind], c.x + hw * 0.12, c.y + r * 0.7 * TILT, hw * 0.42);
        g.restore();
      }
      if (held !== null) drawHeld(g, camera, held, c);
      // A camp stands at the hex's near left, in front of its feature (19 §5.4).
      if (campShown(frame.source, bh, fogState) && bh.camp !== null) {
        const own = `whex_camp_${bh.camp.creature.toLowerCase()}`;
        const sprite = spriteUrl(own) !== null ? own : LAIRS[bh.camp.creature].sprite;
        drawProp(g, sprite, c.x - hw * 0.14, c.y + r * 0.78 * TILT, hw * CAMP_WIDTH);
      }
    }
  };
  if (veil > 0.01 || (held !== null && held.held && (!held.active || held.burnt === true))) drawSilhouetted(ctx, c, r, hw, veil, stand);
  else stand(ctx);
}

/** A camp's drawing, as a share of the hex's width. */
const CAMP_WIDTH = 0.5;

/** How thick a tile is, as a share of its radius. */
const SKIRT = 0.16;

/** The two faces under a tile's lower edges, the right one in shade. */
function drawSkirt(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
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
  face(c2, c3, SKIRT_EARTH.lit);
  face(c1, c2, SKIRT_EARTH.shade);
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

/** The Fortress's keep at the hex's rear corner, by its level — faint while
 *  its first level is still building. */
function drawFortress(
  ctx: CanvasRenderingContext2D, level: number, building: boolean, c: { x: number; y: number }, hw: number, r: number,
): void {
  ctx.save();
  if (building) ctx.globalAlpha = 0.45;
  drawProp(ctx, fortressSprite(Math.max(1, level)), c.x + hw * 0.26, c.y - r * 0.1 * TILT, hw * FORTRESS_WIDTH);
  ctx.restore();
}

function drawHeld(
  ctx: CanvasRenderingContext2D, camera: HexCamera,
  held: NonNullable<ReturnType<WorldSource['hexOf']>>, c: { x: number; y: number },
): void {
  const r = camera.hexRadius;
  const hw = camera.hexWidth;
  // The Fortress built into the district, faint while its first level goes up.
  if (held.fortress > 0 || (held.work?.upgrade === 'Fortress' && held.work.toLevel === 1)) {
    drawFortress(ctx, held.fortress, held.fortress === 0, c, hw, r);
  }
  // The Chapel at the other rear corner, faint while it goes up; the relic
  // it holds hovers over it (relic-restoration.md §5.2). A Shrine district's
  // own Chapel is the Shrine itself.
  const chapelBuilding = held.work?.upgrade === 'Chapel';
  if ((held.chapel === true && held.district !== 'Shrine') || chapelBuilding) {
    ctx.save();
    if (chapelBuilding) ctx.globalAlpha = 0.45;
    drawProp(ctx, CHAPEL_SPRITE, c.x - hw * 0.26, c.y - r * 0.1 * TILT, hw * CHAPEL_WIDTH);
    ctx.restore();
  }
  if (held.relic != null) {
    const x = held.district === 'Shrine' ? c.x : c.x - hw * 0.26;
    drawProp(ctx, ARTIFACTS[held.relic.id].sprite, x, c.y - r * 0.62 * TILT, hw * 0.12);
  }
  // Cut off from its city: greyed, buildings intact (art-direction §8); its
  // ground is greyed with it (drawGroundLayer).
  if (held.held && !held.active) veilStanding(ctx, c, r, CUT_OFF);
  // Burnt by raiders: charred, its fires drawn over the board (19 §5.5).
  else if (held.burnt) veilStanding(ctx, c, r, BURNT);
}

/** Over held ground, what counts down or fills: a builder at work, or a
 *  store ready to collect. */
function drawHeldMarks(
  ctx: CanvasRenderingContext2D, camera: HexCamera,
  held: NonNullable<ReturnType<WorldSource['hexOf']>>, c: { x: number; y: number }, fogState: FogState, now: number,
): void {
  const r = camera.hexRadius;
  // A builder at work: an hourglass and the time left.
  const busyUntil = !held.held ? held.standsAt : held.work?.at ?? null;
  if (busyUntil !== null && fogState === 'Revealed') drawPill(ctx, camera, c.x, c.y - r * 0.62, formatCountdown(Math.max(0, busyUntil - now) / 1000));
  // The player's own store, ready: a bubble with what it holds.
  const s = held.stores;
  if (held.burnt) {
    // Burning: the fire says it all; its store waits under it.
  } else if (!worldStoreReady(held)) {
    // Nothing ready to collect yet.
  } else if (s !== null && s.cap > 0 && s.amount >= Math.max(1, s.cap * 0.25)) {
    drawBubble(ctx, camera, c.x, c.y - r * 0.55, s.currency);
  } else if (held.precious != null) {
    // Its precious store, ready: a bubble with the material (19 §7.4).
    drawBubble(ctx, camera, c.x, c.y - r * 0.55, held.precious.id);
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

/** A burnt district's fires: flames flickering at the foot of two or three
 *  columns of smoke, each puff rising, swelling and thinning as it goes.
 *  Each hex's columns stand where its own hash puts them. */
function drawFire(ctx: CanvasRenderingContext2D, camera: HexCamera, c: { x: number; y: number }, key: number, clock: number): void {
  const hw = camera.hexWidth;
  const r = camera.hexRadius;
  const columns = 2 + Math.floor(hash01(key, 91) * 2);
  ctx.save();
  for (let k = 0; k < columns; k++) {
    const x = c.x + (hash01(key, 100 + k) - 0.5) * hw * 0.5;
    const foot = c.y + (hash01(key, 200 + k) * 0.35) * r * TILT;
    const rise = r * (2.4 + hash01(key, 300 + k) * 1.0);
    const period = 2600 + hash01(key, 400 + k) * 1400;
    // Smoke: puffs evenly out of phase, so the column is always full.
    for (let p = 0; p < 9; p++) {
      const f = ((clock / period) + p / 9 + hash01(key, 500 + k)) % 1;
      const drift = Math.sin(f * Math.PI * 1.5 + k) * hw * 0.06 + f * hw * 0.1;
      const rad = hw * (0.06 + f * 0.15);
      // Dark and dense at the fire, grey and thin as it climbs.
      const shade = Math.round(45 + f * 60);
      ctx.fillStyle = `rgba(${shade}, ${shade - 4}, ${shade - 8}, ${(0.8 * (1 - f) ** 1.2).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x + drift, foot - f * rise, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fire: two tongues, flickering.
    for (let t = 0; t < 2; t++) {
      const flick = 0.75 + 0.25 * Math.sin(clock / (90 + t * 37) + k * 2 + t);
      const fh = hw * 0.2 * flick;
      const fw = hw * 0.07;
      const fx = x + (t - 0.5) * fw * 1.2;
      const grad = ctx.createLinearGradient(0, foot, 0, foot - fh);
      grad.addColorStop(0, 'rgba(255, 120, 30, 0.95)');
      grad.addColorStop(0.6, 'rgba(255, 190, 60, 0.85)');
      grad.addColorStop(1, 'rgba(255, 240, 160, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(fx - fw, foot);
      ctx.quadraticCurveTo(fx - fw * 0.6, foot - fh * 0.6, fx, foot - fh);
      ctx.quadraticCurveTo(fx + fw * 0.6, foot - fh * 0.6, fx + fw, foot);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * A raid to come: a dashed red arc from the camp to the district, high in
 * the middle like a thrown spear, its dashes running towards the arrowhead
 * where it lands.
 */
function drawRaidArc(
  ctx: CanvasRenderingContext2D, camera: HexCamera, from: { x: number; y: number }, to: { x: number; y: number }, clock: number,
): void {
  const lift = camera.hexRadius * 0.25;
  const p0 = { x: from.x, y: from.y - lift };
  const p2 = { x: to.x, y: to.y - lift };
  const span = Math.hypot(p2.x - p0.x, p2.y - p0.y);
  const ctl = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 - span * 0.55 };
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * ctl.x + t * t * p2.x,
    y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * ctl.y + t * t * p2.y,
  });
  // The arc stops short of the district, so the arrowhead lands on it.
  const head = Math.max(8, camera.hexWidth * 0.08);
  const end = 1 - Math.min(0.2, head / Math.max(1, span * 1.2));
  const tip = at(1);
  const back = at(end);
  const width = Math.max(2, camera.hexWidth * 0.022);
  ctx.save();
  ctx.lineCap = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    // The curve to `end`: the same parabola, its control point pulled in.
    const c1 = { x: p0.x + (ctl.x - p0.x) * end, y: p0.y + (ctl.y - p0.y) * end };
    ctx.quadraticCurveTo(c1.x, c1.y, back.x, back.y);
  };
  // A dark groove under the red, so it reads on grass, sand and snow.
  path();
  ctx.strokeStyle = 'rgba(40, 8, 4, 0.55)';
  ctx.lineWidth = width + 3;
  ctx.stroke();
  path();
  ctx.strokeStyle = '#d23a2a';
  ctx.lineWidth = width;
  ctx.setLineDash([width * 3, width * 2]);
  ctx.lineDashOffset = -clock / 40;
  ctx.stroke();
  ctx.setLineDash([]);
  // The arrowhead, along the curve's last direction.
  const ang = Math.atan2(tip.y - back.y, tip.x - back.x);
  ctx.translate(tip.x, tip.y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-head, head * 0.55);
  ctx.lineTo(-head * 0.7, 0);
  ctx.lineTo(-head, -head * 0.55);
  ctx.closePath();
  ctx.fillStyle = '#d23a2a';
  ctx.strokeStyle = 'rgba(40, 8, 4, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** A camp's power: the power icon and the number on a parchment pill,
 *  written in its difficulty's colour. */
function drawCampPower(ctx: CanvasRenderingContext2D, camera: HexCamera, x: number, y: number, text: string, ink: string): void {
  const fs = Math.max(10, Math.min(14, camera.hexWidth * 0.1));
  const icon = fs * 1.3;
  ctx.save();
  ctx.font = `800 ${fs}px Nunito, system-ui, sans-serif`;
  const pw = ctx.measureText(text).width + fs * 1.4 + icon;
  const ph = fs * 1.7;
  ctx.fillStyle = '#f4e3bc';
  ctx.strokeStyle = '#2e1c0e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - pw / 2, y - ph / 2, pw, ph, ph / 2);
  ctx.fill();
  ctx.stroke();
  drawIcon(ctx, 'power', x - pw / 2 + fs * 0.45, y - icon / 2, icon);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + icon / 2, y + 0.5);
  ctx.restore();
}

/** The time left before a camp raids: a red pill with crossed swords, on
 *  the camp. */
function drawRaidTimer(ctx: CanvasRenderingContext2D, camera: HexCamera, x: number, y: number, text: string): void {
  const fs = Math.max(10, Math.min(14, camera.hexWidth * 0.1));
  const icon = fs * 1.3;
  ctx.save();
  ctx.font = `800 ${fs}px Nunito, system-ui, sans-serif`;
  const pw = ctx.measureText(text).width + fs * 1.4 + icon;
  const ph = fs * 1.7;
  ctx.fillStyle = '#a8231d';
  ctx.strokeStyle = '#3d0c08';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - pw / 2, y - ph / 2, pw, ph, ph / 2);
  ctx.fill();
  ctx.stroke();
  drawIcon(ctx, 'atk', x - pw / 2 + fs * 0.45, y - icon / 2, icon);
  ctx.fillStyle = '#fff3d6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + icon / 2, y + 0.5);
  ctx.restore();
}

/** A dungeon's progress: a ring filled as far as the player has cleared,
 *  the count in it, and a red badge when their army can fight there. */
function drawProgressRing(
  ctx: CanvasRenderingContext2D, camera: HexCamera, x: number, y: number, cleared: number, total: number, badge: boolean,
): void {
  const rad = Math.max(13, camera.hexWidth * 0.12);
  ctx.save();
  ctx.fillStyle = 'rgba(46, 28, 14, 0.8)';
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(3, rad * 0.22);
  ctx.strokeStyle = 'rgba(255, 243, 214, 0.25)';
  ctx.beginPath();
  ctx.arc(x, y, rad * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  if (cleared > 0) {
    ctx.strokeStyle = '#f2b233';
    ctx.beginPath();
    ctx.arc(x, y, rad * 0.82, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(cleared, total)) / total);
    ctx.stroke();
  }
  const fs = Math.max(8, rad * 0.62);
  ctx.font = `800 ${fs}px Nunito, system-ui, sans-serif`;
  ctx.fillStyle = '#fff3d6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${formatCount(cleared)}/${formatCount(total)}`, x, y + 0.5);
  if (badge) {
    ctx.fillStyle = '#d4553e';
    ctx.strokeStyle = '#5c1e14';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + rad * 0.8, y - rad * 0.8, rad * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** A rich hex's mark: its material's icon on a small brass disc, and a
 *  sparkle that slowly breathes beside it. */
function drawRich(ctx: CanvasRenderingContext2D, camera: HexCamera, x: number, y: number, material: string, clock: number): void {
  const size = Math.max(16, camera.hexWidth * 0.18);
  ctx.save();
  ctx.fillStyle = 'rgba(46, 28, 14, 0.55)';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.62, 0, Math.PI * 2);
  ctx.fill();
  drawIcon(ctx, material, x - size / 2, y - size / 2, size);
  const pulse = 0.55 + 0.45 * Math.sin(clock / 700);
  ctx.globalAlpha = pulse;
  drawIcon(ctx, 'sparkle', x + size * 0.25, y - size * 0.95, size * 0.7);
  ctx.restore();
}

/** A scouting promise: a brass-rimmed medallion holding the reward's icon,
 *  and under it a small plank with the Gold exploring costs, or none. */
function drawPromise(ctx: CanvasRenderingContext2D, camera: HexCamera, x: number, y: number, icon: string, cost: string | null): void {
  const size = Math.max(18, camera.hexWidth * 0.2);
  const rad = size * 0.72;
  ctx.save();
  const brass = ctx.createLinearGradient(0, y - rad, 0, y + rad);
  brass.addColorStop(0, '#f2d68a');
  brass.addColorStop(0.5, '#c99a3e');
  brass.addColorStop(1, '#7c5820');
  ctx.fillStyle = brass;
  ctx.strokeStyle = '#3d2810';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const wood = ctx.createLinearGradient(0, y - rad, 0, y + rad);
  wood.addColorStop(0, '#7a4f2a');
  wood.addColorStop(1, '#4e3018');
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.arc(x, y, rad * 0.8, 0, Math.PI * 2);
  ctx.fill();
  drawIcon(ctx, icon, x - size / 2, y - size / 2, size);
  if (cost !== null) {
    const fs = Math.max(9, Math.min(13, camera.hexWidth * 0.09));
    ctx.font = `800 ${fs}px Nunito, system-ui, sans-serif`;
    const coin = fs * 1.2;
    const pw = ctx.measureText(cost).width + coin + fs * 1.1;
    const ph = fs * 1.55;
    const py = y + rad + ph * 0.55;
    ctx.fillStyle = '#5a3a20';
    ctx.strokeStyle = '#2e1c0e';
    ctx.beginPath();
    ctx.roundRect(x - pw / 2, py - ph / 2, pw, ph, ph * 0.3);
    ctx.fill();
    ctx.stroke();
    drawIcon(ctx, 'Gold', x - pw / 2 + fs * 0.35, py - coin / 2, coin);
    ctx.fillStyle = '#fff3d6';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cost, x - pw / 2 + fs * 0.45 + coin, py + 0.5);
  }
  ctx.restore();
}

/** A wooden pill with a short text — a countdown over something at work —
 *  or, with `ink`, a parchment one with the text in that colour. */
function drawPill(ctx: CanvasRenderingContext2D, camera: HexCamera, x: number, y: number, text: string, ink?: string): void {
  const fs = Math.max(10, Math.min(14, camera.hexWidth * 0.1));
  ctx.save();
  ctx.font = `800 ${fs}px Nunito, system-ui, sans-serif`;
  const pw = ctx.measureText(text).width + fs * 1.4;
  const ph = fs * 1.6;
  ctx.fillStyle = ink === undefined ? '#5a3a20' : '#f4e3bc';
  ctx.strokeStyle = '#2e1c0e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - pw / 2, y - ph / 2, pw, ph, ph / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ink ?? '#fff3d6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

/**
 * A kingdom's name under its city: a plank of carved wood, lit from above,
 * the name burnt in cream, and a strip of cloth in the kingdom's colour
 * tacked along its top edge — the colour of its border. The player's own
 * plank is edged in brass.
 */
function drawNameplate(
  ctx: CanvasRenderingContext2D, camera: HexCamera, x: number, y: number, name: string, color: string, you: boolean,
  crest: Crest,
): void {
  const fs = Math.max(10, Math.min(15, camera.hexWidth * 0.1));
  ctx.save();
  ctx.font = `800 ${fs}px Nunito, system-ui, sans-serif`;
  const pw = ctx.measureText(name).width + fs * 1.5;
  const ph = fs * 1.75;
  const px = x - pw / 2;
  const py = y - ph / 2;
  const radius = ph * 0.28;
  // Its shadow on the ground below it.
  ctx.fillStyle = 'rgba(30, 18, 8, 0.35)';
  ctx.beginPath();
  ctx.roundRect(px + 1, py + 2.5, pw, ph, radius);
  ctx.fill();
  // The plank.
  const wood = ctx.createLinearGradient(0, py, 0, py + ph);
  wood.addColorStop(0, '#8a5a30');
  wood.addColorStop(0.45, '#6b4324');
  wood.addColorStop(1, '#4a2d16');
  ctx.fillStyle = wood;
  ctx.strokeStyle = you ? '#e9c46a' : '#2e1c0e';
  ctx.lineWidth = you ? 2 : 1.5;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, radius);
  ctx.fill();
  ctx.stroke();
  // The cloth along its top, in the kingdom's colour.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, radius);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(px, py, pw, ph * 0.26);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(px, py + ph * 0.26, pw, 1);
  ctx.restore();
  // The name, burnt into it: a dark groove under the cream.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const ty = py + ph * 0.62;
  ctx.fillStyle = 'rgba(20, 10, 4, 0.6)';
  ctx.fillText(name, x, ty + 1);
  ctx.fillStyle = '#fff3d6';
  ctx.fillText(name, x, ty);
  // The crest, hung over the plank's left end: its field, then its charge.
  const ch = ph * 1.7;
  const cw = ch * (144 / 160);
  for (const url of [fieldUrl(crest.tincture), chargeUrl(crest.charge)]) {
    const art = url === null ? null : loadImage(url);
    if (art?.ready) ctx.drawImage(art.img, px - cw * 0.55, y - ch * 0.55, cw, ch);
  }
  ctx.restore();
}

// --------------------------------------------------------------- borders

function drawBorder(
  ctx: CanvasRenderingContext2D, camera: HexCamera, region: Hex[], color: string, alpha: number, width = 3,
  dashed: (h: Hex) => boolean = () => false,
): void {
  const r = camera.hexRadius;
  const lineWidth = Math.max(2, width * camera.zoom * 1.4);
  const edges = regionEdges(region);
  // Its glow: the line again under it, wider and fainter each time — what
  // a canvas shadow blur looked like, without a blur on every stroke.
  const blur = Math.max(2, r * 0.12);
  const strokes = [
    { width: lineWidth + blur * 1.1, alpha: 0.08 },
    { width: lineWidth + blur * 0.7, alpha: 0.12 },
    { width: lineWidth + blur * 0.35, alpha: 0.2 },
    { width: lineWidth, alpha: 1 },
  ];
  ctx.save();
  ctx.strokeStyle = color;
  for (const dash of [false, true]) {
    ctx.beginPath();
    let any = false;
    for (const { hex, edge } of edges) {
      if (dashed(hex) !== dash) continue;
      const c = camera.hexToScreen(hex);
      const corners = hexCorners(c.x, c.y, r * 0.96);
      const a = corners[edge];
      const b = corners[(edge + 1) % 6];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      any = true;
    }
    if (!any) continue;
    ctx.lineCap = dash ? 'butt' : 'round';
    ctx.setLineDash(dash ? [lineWidth * 2.5, lineWidth * 1.8] : []);
    for (const s of strokes) {
      ctx.globalAlpha = alpha * s.alpha;
      ctx.lineWidth = s.width;
      ctx.stroke();
    }
  }
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
function drawRoute(ctx: CanvasRenderingContext2D, pts: readonly RoutePoint[], unit: number): void {
  if (pts.length < 2) return;
  const width = Math.max(2, unit * 0.028);
  const end = pts[pts.length - 1];
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Leg by leg, each as faint as the fainter of its two ends, the dashes
  // running on unbroken from one leg to the next.
  let along = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    ctx.globalAlpha = Math.min(a.a, b.a);
    const leg = () => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    };
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(46, 28, 14, 0.45)';
    ctx.lineWidth = width + 2.5;
    leg();
    ctx.stroke();
    ctx.setLineDash([width * 3, width * 2.2]);
    ctx.lineDashOffset = -along;
    ctx.strokeStyle = 'rgba(255, 246, 220, 0.95)';
    ctx.lineWidth = width;
    leg();
    ctx.stroke();
    along += Math.hypot(b.x - a.x, b.y - a.y);
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = end.a;
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

/** A point of a route, and how opaque the route is there. */
interface RoutePoint { x: number; y: number; a: number }

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

/**
 * Behind a marcher, footprints along the hexes it has walked; ahead, a line
 * along the hexes it will walk, to the hex it is going to — or, on the way
 * back, to the city — ringed where it ends. `step` is the lower of the two
 * hexes it is between; `here` is where it stands.
 */
function drawTrail(
  ctx: CanvasRenderingContext2D, camera: HexCamera, path: readonly number[], step: number, outbound: boolean,
  here: { x: number; y: number }, routeAlpha: (index: number) => number,
): void {
  const at = (k: number) => camera.hexToScreen(hexAt(path[k]));
  const stop = (k: number) => ({ ...at(k), a: routeAlpha(path[k]) });
  const last = path.length - 1;
  const walked: Array<{ x: number; y: number }> = [];
  const ahead: RoutePoint[] = [{ ...here, a: routeAlpha(path[step]) }];
  if (outbound) {
    for (let k = 0; k <= step; k++) walked.push(at(k));
    walked.push(here);
    for (let k = step + 1; k <= last; k++) ahead.push(stop(k));
  } else {
    for (let k = last; k > step; k--) walked.push(at(k));
    walked.push(here);
    for (let k = step; k >= 0; k--) ahead.push(stop(k));
  }
  drawFootprints(ctx, walked, camera.hexWidth);
  drawRoute(ctx, ahead, camera.hexWidth);
}

function drawExplorer(
  ctx: CanvasRenderingContext2D, camera: HexCamera, trip: GameState['world']['explorers'][number], now: number,
  routeAlpha: (index: number) => number,
): void {
  const pos = tripPosition(trip, now);
  const a = camera.hexToScreen(hexAt(pos.from));
  const b = camera.hexToScreen(hexAt(pos.to));
  const x = a.x + (b.x - a.x) * pos.f;
  const y = a.y + (b.y - a.y) * pos.f;
  const unit = camera.hexWidth;

  drawTrail(ctx, camera, trip.path, pos.step, pos.outbound, { x, y }, routeAlpha);

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
