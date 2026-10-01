// WHAT THE POINTER SHOWS (Docs/features/24-dialogue.md §4): a line's `point`
// resolved to a thing on screen — a control, found by its `data-coach` key,
// or a place on the map.
//
// A map target is resolved to a CELL once, when the line begins, and kept
// while it still qualifies: a pointer that hopped to the next tree every frame
// would be chasing the player's thumb. A UI target is re-found every frame,
// because screens rebuild their nodes.

import { DISTRICTS, LAIRS, LANDMARKS } from '../../sim/data/definitions';
import { explorationGate, fogState, isPayable } from '../../sim/fog';
import { townhallDistance } from '../../sim/grid';
import { harvestSourceAt, isExhausted } from '../../sim/harvest';
import { coordKey, type Coord, type FeatureId, type LairId } from '../../sim/state';
import type { Game } from '../../game';

/** A resolved target: a DOM node, or a plot of map cells. */
export type Target =
  | { kind: 'ui'; key: string }
  | { kind: 'cell'; cell: Coord; span: { x: number; y: number } };

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

/** Does `cell` still answer the point it was resolved for? */
function stillGood(game: Game, point: string, cell: Coord): boolean {
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
  if (mode === 'fog') {
    return fog === 'Discovered' && isPayable(game.state, game.map, cell)
      && explorationGate(game.map, cell) === null;
  }
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
  if (goal === null) return null;
  let best: Coord | null = null;
  let bestD = Infinity;
  for (const c of game.map.cells) {
    if (fogState(game.state, game.map, c) !== 'Discovered' || !isPayable(game.state, game.map, c)
      || explorationGate(game.map, c) !== null) continue;
    const d = Math.max(Math.abs(c.x - goal.x), Math.abs(c.y - goal.y));
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/**
 * Resolve a line's `point` into a target. `previous` is what it resolved to a
 * moment ago, kept while it still qualifies. Null = nothing to point at (an
 * empty point, or nothing on the map that fits yet).
 */
export function resolveTarget(game: Game, point: string, previous: Target | null): Target | null {
  if (point === '') return null;
  if (point === 'quest') return { kind: 'ui', key: 'quest' };
  if (point.startsWith('ui:')) return { kind: 'ui', key: point.slice(3) };
  if (previous?.kind === 'cell' && stillGood(game, point, previous.cell)) return previous;
  const [kind, id = ''] = point.split(':');
  switch (kind) {
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
    default: return null;
  }
}

/** The lair found first, of those not cleared — by when its clock started. */
function firstStandingLair(game: Game): LairId | '' {
  const found = Object.entries(game.state.lairs)
    .filter(([, l]) => l !== undefined && !l.cleared)
    .sort(([, a], [, b]) => a!.armedAt - b!.armedAt);
  return (found[0]?.[0] ?? '') as LairId | '';
}

/** The DOM node a UI target names, if it is on screen. */
export const uiNode = (key: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-coach="${CSS.escape(key)}"]`);

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
  const box = game.camera.plotBox(target.cell, target.span);
  const canvas = frame.querySelector('canvas');
  const c = canvas?.getBoundingClientRect() ?? origin;
  return { x: box.x + c.left - origin.left, y: box.y + c.top - origin.top, w: box.w, h: box.h };
}

/** Is `cell` inside a cell target's plot? */
export const targetHasCell = (target: Target, cell: Coord): boolean =>
  target.kind === 'cell'
  && cell.x >= target.cell.x && cell.x < target.cell.x + target.span.x
  && cell.y >= target.cell.y && cell.y < target.cell.y + target.span.y;
