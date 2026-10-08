// WHAT THE POINTER SHOWS (Docs/features/24-dialogue.md §4): a line's `point`
// resolved to a thing on screen — a control, found by its `data-coach` key,
// or a place on the map.
//
// A map target is resolved to a CELL once, when the line begins, and kept
// while it still qualifies: a pointer that hopped to the next tree every frame
// would be chasing the player's thumb. A UI target is re-found every frame,
// because screens rebuild their nodes.

import { ABANDONED, DISTRICTS, LAIRS, LANDMARKS } from '../../sim/data/definitions';
import { groundBlock, placementBlock } from '../../sim/districts';
import { explorationGate, fogState, isPayable } from '../../sim/fog';
import { townhallDistance } from '../../sim/grid';
import { harvestSourceAt, isExhausted } from '../../sim/harvest';
import { workableCountAt } from '../../sim/workers';
import {
  cellsOfRect, coordKey, type Coord, type District, type DistrictId, type FeatureId, type LairId,
} from '../../sim/state';
import { hexAt, hexDistance } from '../../sim/world/hex';
import { explorerRoute, fogStatesOf, homeIndex, readyTrips, tripRevealing, worldFog } from '../../sim/world/explorers';
import { boardOf } from '../../sim/world/source';
import type { Game } from '../../game';

/** A resolved target: a DOM node, or a plot of map cells. */
export type Target =
  | { kind: 'ui'; key: string }
  | { kind: 'cell'; cell: Coord; span: { x: number; y: number } }
  /** A hex of the world board, by index. */
  | { kind: 'hex'; index: number };

/** The screen rect a target occupies right now, in #app's coordinates. */
export interface Rect { x: number; y: number; w: number; h: number }

const ONE = { x: 1, y: 1 };

/** The nearest cell (by Townhall distance) that satisfies `pred`. */
function nearest(game: Game, pred: (cell: Coord) => boolean): Coord | null {
  let best: Coord | null = null;
  let bestD = Infinity;
  for (const c of game.map.cells) {
    if (!pred(c)) continue;
    const d = townhallDistance(game.map, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

const featureAt = (game: Game, c: Coord): FeatureId | undefined =>
  game.state.features[coordKey(c)] as FeatureId | undefined;

/** Can the player pay the fog off `cell` right now? */
const buyable = (game: Game, cell: Coord): boolean =>
  fogState(game.state, game.map, cell) === 'Discovered' && isPayable(game.state, game.map, cell)
  && explorationGate(game.map, cell) === null;

/** Does `cell` still answer the point it was resolved for? */
function stillGood(game: Game, point: string, cell: Coord): boolean {
  // `abandoned:<id>Fog` is a step of the way: good until it is cleared.
  if (point.startsWith('abandoned:') && point.endsWith('Fog')) return buyable(game, cell);
  if (!point.startsWith('feature:')) return true;
  // `feature:<id>` is the nearest cell carrying it out of the dark;
  // `…Fog` the nearest FOGGED one the player can pay for — to be bought;
  // `…Revealed` the nearest revealed one that is not spent — to be tapped.
  const want = point.slice('feature:'.length);
  const mode = want.endsWith('Revealed') ? 'revealed' : want.endsWith('Fog') ? 'fog' : 'seen';
  const id = mode === 'revealed' ? want.slice(0, -'Revealed'.length)
    : mode === 'fog' ? want.slice(0, -'Fog'.length) : want;
  if (featureAt(game, cell) !== id) return false;
  const fog = fogState(game.state, game.map, cell);
  if (mode === 'revealed') {
    return fog === 'Revealed' && harvestSourceAt(game.state, cell) !== null
      && !isExhausted(game.state, game.map, cell, game.now());
  }
  if (mode === 'fog') return buyable(game, cell);
  return fog !== 'Undiscovered';
}

/**
 * `feature:<id>Fog` with nothing of that kind payable — every one in sight
 * already cleared, the next still deep in the dark: point at the frontier
 * cell the player can pay for that leads TOWARDS the nearest one, so the
 * hand always shows the next tap rather than nothing.
 */
function towards(game: Game, point: string): Coord | null {
  if (!point.endsWith('Fog')) return null;
  const id = point.slice('feature:'.length, -'Fog'.length);
  const goal = nearest(game, (c) => featureAt(game, c) === id
    && game.state.fog.revealed[coordKey(c)] !== true);
  return goal === null ? null : stepTowards(game, goal);
}

/** The cell the player can pay for that is nearest `goal` — the next step
 *  of the way through the fog; straight lines before diagonals. */
function stepTowards(game: Game, goal: Coord): Coord | null {
  let best: Coord | null = null;
  let bestD = Infinity;
  for (const c of game.map.cells) {
    if (!buyable(game, c)) continue;
    const dx = Math.abs(c.x - goal.x);
    const dy = Math.abs(c.y - goal.y);
    const d = Math.max(dx, dy) * 100 + dx + dy;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/** A building of this kind to measure with: the player's own, or one as it
 *  would stand at level 1. */
const sampleOf = (game: Game, id: DistrictId): District =>
  game.state.city.districts.find((d) => d.definitionId === id)
  ?? {
    uniqueId: '', definitionId: id, ordinal: 0, level: 1, assignedWorkers: 0,
    location: { x: 0, y: 0 }, state: 'Built', visualVariant: 1,
  };

/** Could a footprint stand on `cell` once the player pays off its fog? Every
 *  cell clear already, or buyable and bare. */
function standsOnceCleared(game: Game, id: DistrictId, cell: Coord, movingId: string): boolean {
  const state = game.state;
  return cellsOfRect(cell, DISTRICTS[id].size).every((c) => {
    if (!game.map.terrain.has(coordKey(c)) || game.map.terrain.get(coordKey(c)) === 'Water') return false;
    if (state.fog.revealed[coordKey(c)] === true) return groundBlock(state, game.map, c, { movingId }) === null;
    // Under the fog: the rest of groundBlock's rules, read off the state.
    return buyable(game, c) && state.features[coordKey(c)] === undefined
      && !state.city.districts.some((d) => cellsOfRect(d.location, DISTRICTS[d.definitionId].size)
        .some((f) => f.x === c.x && f.y === c.y))
      && !ABANDONED.some((a) => a.location.x === c.x && a.location.y === c.y && state.abandoned.repaired[a.id] !== true);
  });
}

/**
 * WHERE A WORKER BUILDING WOULD WORK THE MOST (`reach:<id>`): of the cells it
 * could stand on — or could, once their fog is paid — the one its crew
 * reaches the most from; ground already clear before fogged ground, then
 * the nearest the Townhall. `clearOnly` keeps to ground already clear. Its
 * own footprint counts as free, since it is the thing being moved.
 */
export function reachSpot(
  game: Game, id: DistrictId, clearOnly = false,
): { cell: Coord; works: number; clear: boolean } | null {
  const sample = sampleOf(game, id);
  let best: { cell: Coord; works: number; clear: boolean; d: number } | null = null;
  for (const c of game.map.cells) {
    const clear = placementBlock(game.state, game.map, id, c, sample.uniqueId || undefined) === null;
    if (!clear && (clearOnly || !standsOnceCleared(game, id, c, sample.uniqueId))) continue;
    const works = workableCountAt(game.state, sample, c);
    const d = townhallDistance(game.map, c);
    if (best === null || works > best.works
      || (works === best.works && clear && !best.clear)
      || (works === best.works && clear === best.clear && d < best.d)) {
      best = { cell: c, works, clear, d };
    }
  }
  return best === null ? null : { cell: best.cell, works: best.works, clear: best.clear };
}

/**
 * Resolve a line's `point` into a target. `previous` is what it resolved to a
 * moment ago, kept while it still qualifies. Null = nothing to point at (an
 * empty point, or nothing on the map that fits yet).
 */
export function resolveTarget(game: Game, point: string, previous: Target | null): Target | null {
  if (point === '') return null;
  if (point === 'quest') return { kind: 'ui', key: 'quest' };
  if (point === BACK) return { kind: 'ui', key: BACK };
  if (point.startsWith('ui:')) return { kind: 'ui', key: point.slice(3) };
  if (previous?.kind === 'cell' && stillGood(game, point, previous.cell)) return previous;
  const [kind, id = ''] = point.split(':');
  switch (kind) {
    // A hex of the world board (19-world-map.md §3.1): `hex:explore` the one
    // a first explorer should go to, `hex:ready` the one an explorer waits
    // at, or a board index.
    case 'hex': {
      const index = id === 'explore' ? firstExploreHex(game)
        : id === 'ready' ? readyTrips(game.state, game.now())[0]?.target ?? null
          : id !== '' && Number.isInteger(Number(id)) ? Number(id) : null;
      return index === null ? null : { kind: 'hex', index };
    }
    case 'cell': {
      const [x, y] = id.split(',').map(Number);
      return { kind: 'cell', cell: { x, y }, span: ONE };
    }
    case 'feature': {
      const cell = nearest(game, (c) => stillGood(game, point, c)) ?? towards(game, point);
      return cell === null ? null : { kind: 'cell', cell, span: ONE };
    }
    case 'district': {
      const all = game.state.city.districts.filter((d) => d.definitionId === id);
      const d = all.find((x) => x.state === 'Built') ?? all[0];
      if (d === undefined) return null;
      return { kind: 'cell', cell: d.location, span: DISTRICTS[d.definitionId].size };
    }
    case 'lair': {
      // `lair:` alone is the first lair found that still stands — what a
      // scene on `lairFound` with no target is about.
      const lair = LAIRS[(id === '' ? firstStandingLair(game) : id) as LairId];
      return lair === undefined ? null
        : { kind: 'cell', cell: lair.location, span: { x: lair.size, y: lair.size } };
    }
    case 'landmark': {
      const l = LANDMARKS.find((x) => x.id === id);
      return l === undefined ? null : { kind: 'cell', cell: l.location, span: { x: l.size, y: l.size } };
    }
    // An abandoned building, wherever the fog has it — a silhouette, a ruin
    // under the scrim, or revealed (01-map-and-fog.md §6.3). `…Fog` is the
    // way to it: the ruin once its fog can be paid, until then the cell the
    // player can pay for that leads towards it.
    case 'abandoned': {
      const way = id.endsWith('Fog');
      const a = ABANDONED.find((x) => x.id === (way ? id.slice(0, -'Fog'.length) : id));
      if (a === undefined) return null;
      const span = DISTRICTS[a.districtId].size;
      if (!way || fogState(game.state, game.map, a.location) === 'Revealed' || buyable(game, a.location)) {
        return { kind: 'cell', cell: a.location, span };
      }
      const step = stepTowards(game, a.location);
      return step === null ? { kind: 'cell', cell: a.location, span } : { kind: 'cell', cell: step, span: ONE };
    }
    // Where a worker building would work the most (`reachSpot`).
    case 'reach': {
      if (!(id in DISTRICTS)) return null;
      const spot = reachSpot(game, id as DistrictId);
      return spot === null ? null : { kind: 'cell', cell: spot.cell, span: DISTRICTS[id as DistrictId].size };
    }
    // The nearest treasure still on the ground, chest or open (§6.2).
    case 'treasure': {
      const cell = nearest(game, (c) => game.state.fog.treasures[coordKey(c)] !== undefined);
      return cell === null ? null : { kind: 'cell', cell, span: ONE };
    }
    default: return null;
  }
}

/**
 * The hex a first explorer is shown to: misty ground it can reach and nobody
 * is out to, the nearest the city — one with a promise over it before one
 * without, then the lowest index, so it is the same hex every frame.
 */
function firstExploreHex(game: Game): number | null {
  const state = game.state;
  const home = homeIndex(state);
  const hexes = boardOf(state.world.board).hexes;
  const states = fogStatesOf(worldFog(state));
  const open = hexes.filter((h) => states[h.index] === 'Sensed' && tripRevealing(state, h.index) === null
    && explorerRoute(state, h.index) !== null);
  const away = (i: number): number => hexDistance(hexAt(home), hexAt(i));
  open.sort((a, b) => away(a.index) - away(b.index)
    || (a.scout === null ? 1 : 0) - (b.scout === null ? 1 : 0) || a.index - b.index);
  return open[0]?.index ?? null;
}

/** The lair found first, of those not cleared — by when its clock started. */
function firstStandingLair(game: Game): LairId | '' {
  const found = Object.entries(game.state.lairs)
    .filter(([, l]) => l !== undefined && !l.cleared)
    .sort(([, a], [, b]) => a!.armedAt - b!.armedAt);
  return (found[0]?.[0] ?? '') as LairId | '';
}

/** The point that names THE WAY BACK to the map: the close of whatever is
 *  open on top (24-dialogue.md §4). */
export const BACK = 'back';

/**
 * The controls a line can point at that spend Gems, by their `data-coach`
 * key. The First Morning never points the hand at one: a beat may name a
 * paid shortcut, but following the hand must never cost the player Gems
 * (Docs/features/23-tutorials.md §3). `tests/tutorialGems.test.ts` holds
 * this list to every Gem button the UI marks for the stage.
 */
export const GEM_CONTROLS: ReadonlySet<string> = new Set(['card:finish-training']);

/** Is `node` drawn, not merely in the page? */
const drawn = (node: HTMLElement): boolean => {
  const r = node.getBoundingClientRect();
  return r.width > 0 || r.height > 0;
};

/**
 * The close of whatever is open on top: a menu or sheet (`#overlay`) before
 * a card or a placement bar (`#panel`), and in each the last one drawn — a
 * popup opened over a sheet comes after it. Every close is marked
 * `data-own-close` (kit `closeKnob`, the cast bar's cancel) or is the host's
 * own knob on a legacy screen.
 */
function backNode(): HTMLElement | null {
  for (const mount of ['overlay', 'panel']) {
    const closes = document.getElementById(mount)
      ?.querySelectorAll<HTMLElement>('[data-own-close], .legacy-close') ?? [];
    for (let i = closes.length - 1; i >= 0; i--) if (drawn(closes[i])) return closes[i];
  }
  return null;
}

/** The DOM node a UI target names, if it is on screen. */
export const uiNode = (key: string): HTMLElement | null => (key === BACK ? backNode()
  : document.querySelector<HTMLElement>(`[data-coach="${CSS.escape(key)}"]`));

/** Where a target is on screen right now, relative to `frame` (#app). */
export function targetRect(game: Game, target: Target, frame: HTMLElement): Rect | null {
  const origin = frame.getBoundingClientRect();
  if (target.kind === 'ui') {
    const node = uiNode(target.key);
    if (node === null) return null;
    const r = node.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
  }
  if (target.kind === 'hex') {
    // Only on the board: a hex is nowhere on the province.
    const camera = game.worldCamera;
    if (game.scene !== 'world' || camera === null) return null;
    const c = camera.hexToScreen(hexAt(target.index));
    const canvas = frame.querySelector<HTMLCanvasElement>('canvas#world')?.getBoundingClientRect() ?? origin;
    const w = camera.hexWidth * 0.8;
    const h = camera.hexRadius;
    return { x: c.x - w / 2 + canvas.left - origin.left, y: c.y - h / 2 + canvas.top - origin.top, w, h };
  }
  const box = game.camera.plotBox(target.cell, target.span);
  // The map's own canvas: the floor and the cloud bank are canvases too,
  // under it, and the floor is larger than the frame and slides.
  const canvas = frame.querySelector<HTMLCanvasElement>('canvas#map');
  const c = canvas?.getBoundingClientRect() ?? origin;
  return { x: box.x + c.left - origin.left, y: box.y + c.top - origin.top, w: box.w, h: box.h };
}

/** The top of the collect bubble standing over a map target, relative to
 *  `frame`, or null when there is none — the pointer stands above it rather
 *  than hiding what a line may be asking the player to tap. */
export function bubbleTopOver(game: Game, target: Target, frame: HTMLElement): number | null {
  if (target.kind !== 'cell') return null;
  const d = game.state.city.districts.find((x) => targetHasCell(target, x.location));
  if (d === undefined) return null;
  const r = game.collectBubbles.rectOf(d.uniqueId, performance.now());
  if (r === null) return null;
  // The map's own canvas: the floor and the cloud bank are canvases too,
  // under it, and the floor is larger than the frame and slides.
  const canvas = frame.querySelector<HTMLCanvasElement>('canvas#map');
  const c = canvas?.getBoundingClientRect() ?? frame.getBoundingClientRect();
  return r.y + c.top - frame.getBoundingClientRect().top;
}

/** Is `cell` inside a cell target's plot? */
export const targetHasCell = (target: Target, cell: Coord): boolean =>
  target.kind === 'cell'
  && cell.x >= target.cell.x && cell.x < target.cell.x + target.span.x
  && cell.y >= target.cell.y && cell.y < target.cell.y + target.span.y;

/** Do two rects overlap? Touching is not overlapping. */
const meets = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** How far the hand bobs away from where it stands. */
const HAND_BOB = 8;

/**
 * Where the hand stands on its target `r`: ABOVE it, fingertip down, unless
 * that would leave the screen — then BELOW, fingertip up. Never on the line
 * box: a hand that would meet the box stands on the target's other side, and
 * only when both sides meet it does the box itself move away (`moveBox`).
 * `fingertip` is where the fingertip rests when above — over a collect
 * bubble it stands higher, so the bubble stays in sight.
 */
export function handPlace(
  r: Rect, hand: { w: number; h: number }, box: Rect | null, frameH: number, fingertip = r.y - 8,
): { above: boolean; moveBox: boolean } {
  const x = r.x + r.w / 2 - hand.w / 2;
  const aboveRect: Rect = { x, y: fingertip - hand.h - HAND_BOB, w: hand.w, h: hand.h + HAND_BOB };
  const belowRect: Rect = { x, y: r.y + r.h + 8, w: hand.w, h: hand.h + HAND_BOB };
  const fitsAbove = r.y > 70;
  const fitsBelow = belowRect.y + belowRect.h <= frameH;
  const clear = (side: Rect): boolean => box === null || !meets(side, box);
  const [first, second] = fitsAbove ? [true, false] : [false, true];
  if (clear(first ? aboveRect : belowRect)) return { above: first, moveBox: false };
  if ((second ? fitsAbove : fitsBelow) && clear(second ? aboveRect : belowRect)) {
    return { above: second, moveBox: false };
  }
  return { above: first, moveBox: true };
}
