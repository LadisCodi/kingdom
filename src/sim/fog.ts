// Fog of war: state derivation, reveal cost curve, pay-per-tap reveal (Docs/features/01-map-and-fog.md).

import { DISTRICTS, FOG, LANDMARKS, RUINS, levelIndexed, terrainGate } from './data/definitions';
import { recordSiteDiscovery } from './discovery';
import { cellsWithinRadiusOfRect, neighbors, townhallDistance, type MapData } from './grid';
import { resolve } from './modifiers';
import { techValue } from './techEffects';
import { recordQuestEvent } from './quests';
import { isTechComplete, revealedCellCount } from './research';
import {
  addToWallet, coordKey, districtCells, getWallet, townhall,
  type Coord, type District, type GameState, type TechId,
} from './state';

export type FogState = 'Revealed' | 'Discovered' | 'Undiscovered';

export function fogState(state: GameState, map: MapData, cell: Coord): FogState {
  if (state.fog.revealed[coordKey(cell)]) return 'Revealed';
  if (state.fog.discovered[coordKey(cell)]) return 'Discovered';
  for (const n of neighbors(map, cell)) {
    if (state.fog.revealed[coordKey(n)]) return 'Discovered';
  }
  return 'Undiscovered';
}

/** Total Gold to reveal a cell at BFS distance d (FogOfWarSettings.GetTotalCost). */
export function revealCost(d: number): number {
  const rings = FOG.rings;
  let cost: number;
  if (d <= rings[0].distance) {
    cost = rings[0].cost;
  } else {
    const last = rings[rings.length - 1];
    if (d <= last.distance) {
      // nearest LOWER authored ring
      let c = rings[0].cost;
      for (const r of rings) if (r.distance <= d) c = r.cost;
      cost = c;
    } else {
      cost = Math.round(last.cost * Math.max(1, FOG.fallbackGrowth) ** (d - last.distance));
    }
  }
  return Math.max(cost, FOG.minCost);
}

/**
 * The map gets dearer as it is revealed: ×`fog.countGrowth` once per
 * `fog.countStep` cells already revealed, on top of the ring price
 * (Docs/features/01-map-and-fog.md §5).
 *
 * Distance alone made a disc as cheap as a corridor — every near cell in
 * every direction was the same small price — so the player never chose a
 * direction. With the count in the price, breadth costs more than depth and
 * "which way" becomes the decision.
 *
 * The count is the same one the era bars read (`revealedCellCount`): every
 * revealed cell, seeded, built-around or divined alike, so "revealed" means
 * one thing. Stepped, not per cell, so the price moves every `countStep`
 * reveals rather than under every press. A step of 0 or a growth of 1 is ×1.
 */
export function countMultiplier(state: GameState): number {
  const step = FOG.countStep ?? 0;
  const growth = FOG.countGrowth ?? 1;
  if (step <= 0 || growth <= 1) return 1;
  return growth ** Math.floor(revealedCellCount(state) / step);
}

/** The cost the PLAYER actually pays, after the Dowsing Rod and anything else
 *  that discounts the fog. Every consumer reads this rather than revealCost(),
 *  so a discount can never apply to the bar but not the charge. */
export const revealCostForCell = (state: GameState, map: MapData, cell: Coord): number =>
  Math.max(
    FOG.minCost,
    Math.round(resolve(
      state,
      'revealCost',
      // Two things move what a cell costs: how much of the map is already
      // revealed (countMultiplier, at the base stage) and Pitons, which
      // discounts the result. Nothing buys the taps back: a cell is five
      // presses at every ring.
      revealCost(townhallDistance(map, cell)) * countMultiplier(state)
        * Math.max(0, techValue(state, 'revealCost', 1)),
    )),
  );

/**
 * Can the player pay to clear this cell yet?
 *
 * The frontier has to stay CONNECTED: a cell is only payable when it touches
 * ground you have already cleared. A building's discover radius reaches
 * further than its reveal radius, so without this the player could buy an
 * island three tiles out and leave a ring of fog around it — exploration
 * became a shopping list of whatever looked interesting rather than a border
 * you push outward, and the distance cost curve stopped meaning anything
 * because you could skip straight to the cheap side of the map.
 *
 * Being Discovered still means "you can SEE something is there". This is only
 * about what you can buy.
 */
export const isReachable = (state: GameState, map: MapData, cell: Coord): boolean =>
  neighbors(map, cell).some((n) => state.fog.revealed[coordKey(n)] === true);

/**
 * How far from the Townhall the player may PAY for a cell, in BFS rings —
 * the same axis the price is authored on — indexed by the Townhall's level
 * (Docs/features/01-map-and-fog.md §4, 05-city-and-districts.md §1).
 *
 * The Townhall already says how many of each building the city may own and
 * how high each may level; this makes it say how far the city may reach, so
 * the map is met in the order the city can use it. An empty list is no
 * limit, the way an empty count cap is.
 */
export const explorationReach = (state: GameState): number =>
  FOG.reachPerTownhallLevel.length === 0
    ? Infinity
    : levelIndexed(FOG.reachPerTownhallLevel, townhall(state).level);

/** Is this cell inside the reach of the current Townhall level? */
export const isWithinReach = (state: GameState, map: MapData, cell: Coord): boolean =>
  townhallDistance(map, cell) <= explorationReach(state);

/** The first Townhall level whose reach holds this cell — what the refused
 *  tap tells the player to build. `maxLevel + 1` if no level ever does. */
export function reachLevelFor(map: MapData, cell: Coord): number {
  const d = townhallDistance(map, cell);
  const ladder = FOG.reachPerTownhallLevel;
  if (ladder.length === 0) return 1;
  const i = ladder.findIndex((r) => r >= d);
  return i === -1 ? ladder.length + 1 : i + 1;
}

/** One side of a cell, for drawing the reach border along it. */
export type CellSide = 'N' | 'S' | 'W' | 'E';

/**
 * Where the reach ENDS: for each of `cells` inside the reach, the sides that
 * face a cell on the map just beyond it. The renderer strokes these, over
 * the fog, so the player can see how far the capital lets them explore
 * before they tap — a rule that is spatial should be visible spatially.
 * Empty when the reach holds the whole province (nothing to draw), and a
 * map edge is not a border: there is nothing past it to explore.
 */
export function reachBorder(
  state: GameState, map: MapData, cells: Iterable<Coord>,
): Array<{ cell: Coord; sides: CellSide[] }> {
  const reach = explorationReach(state);
  if (!Number.isFinite(reach)) return [];
  const beyond = (c: Coord): boolean =>
    map.terrain.has(coordKey(c)) && townhallDistance(map, c) > reach;
  const out: Array<{ cell: Coord; sides: CellSide[] }> = [];
  for (const cell of cells) {
    if (!map.terrain.has(coordKey(cell)) || townhallDistance(map, cell) > reach) continue;
    const sides: CellSide[] = [];
    if (beyond({ x: cell.x, y: cell.y - 1 })) sides.push('N');
    if (beyond({ x: cell.x, y: cell.y + 1 })) sides.push('S');
    if (beyond({ x: cell.x - 1, y: cell.y })) sides.push('W');
    if (beyond({ x: cell.x + 1, y: cell.y })) sides.push('E');
    if (sides.length > 0) out.push({ cell, sides });
  }
  return out;
}

/**
 * Can the player buy this cell right now, leaving the purse and the terrain
 * aside? The connected frontier AND the Townhall's reach — the one predicate
 * the renderer draws the border from and the harness pushes against.
 */
export const isPayable = (state: GameState, map: MapData, cell: Coord): boolean =>
  isReachable(state, map, cell) && isWithinReach(state, map, cell);

/** Exploration gate: sea cells need Sailing before the player can pay to
 *  reveal them (building fog radii ignore this).
 *
 *  Mountains used to be gated here too, as a TERRAIN. They are a feature
 *  now, so Scaling Tools gates WORKING one rather than reaching it — the
 *  same shape as Forestry on the forest, and a refused tap costs no Mana.
 *  See Docs/features/01-map-and-fog.md §3. */
export function explorationGate(map: MapData, cell: Coord): TechId | null {
  const terrain = map.terrain.get(coordKey(cell));
  // Which technology crosses which ground is the TECHNOLOGY's to say —
  // Sailing carries `unlocks: [{ terrain: 'Water' }]` — so this is a lookup
  // rather than the hardcoded `if (terrain === 'Water') return 'Sailing'` it
  // used to be (Docs/tech-tree-editor.md §2).
  return terrain === undefined ? null : terrainGate(terrain);
}

/**
 * **A cell is FIVE taps, whatever ring it sits in.** What the ring decides is
 * how much each of those taps CHARGES — a fifth of the cell's Gold.
 *
 * The tap used to be the unit of both money and time: one Gold a press, so a
 * distance-9 cell was 1,600 Gold *and* 1,600 presses, and clearing the far
 * fog was rationed by the thumb rather than by the purse. A fixed five makes
 * the Gold the whole of the price, which is the one thing a player can plan
 * against, and it makes the progress bar mean the same thing on every cell.
 *
 * `fog.tapsToReveal` is the count, and every ring price from 3 out is a
 * multiple of it so the fifths come out whole. When that does not divide — the
 * two penny rings in the Townhall's own shadow, or a price Pitons has taken
 * 10% off — the slices are the DIFFERENCES of a running floor, so they still
 * sum to exactly the price and never round a cell up or down.
 */
export const revealPaidGold = (total: number, taps: number): number =>
  Math.floor((total * Math.min(Math.max(taps, 0), FOG.tapsToReveal)) / FOG.tapsToReveal);

/** What the tap after `taps` charges: this slice of the price and no more. */
export const revealTapCost = (total: number, taps: number): number =>
  revealPaidGold(total, taps + 1) - revealPaidGold(total, taps);

/** Taps already spent on a cell, 0 to `fog.tapsToReveal` − 1. */
export const revealTapsDone = (state: GameState, cell: Coord): number =>
  state.fog.progress[coordKey(cell)] ?? 0;

/** What the NEXT tap on this cell will cost — the floater and the tile card
 *  read it before the tap, so the number the player sees is the number the
 *  purse loses. */
export const nextRevealTapCost = (state: GameState, map: MapData, cell: Coord): number =>
  revealTapCost(revealCostForCell(state, map, cell), revealTapsDone(state, cell));

/** Gold already sunk into a cell — what abandoning it would waste, and what
 *  Divination does NOT have to pay. */
export const revealPaidSoFar = (state: GameState, map: MapData, cell: Coord): number =>
  revealPaidGold(revealCostForCell(state, map, cell), revealTapsDone(state, cell));

export type RevealTapResult =
  | 'Paid' | 'Revealed' | 'NotDiscovered' | 'NotReachable' | 'OutOfReach' | 'NotEnoughGold'
  | 'TechLocked';

/** One tap on a Discovered cell: pay this tap's fifth of its price. The fifth
 *  one clears it. */
export function revealTap(state: GameState, map: MapData, cell: Coord): RevealTapResult {
  if (fogState(state, map, cell) !== 'Discovered') return 'NotDiscovered';
  // Checked before the tech gate: "you cannot reach it yet" is the more
  // useful thing to be told about a cell two rings out, and it is true
  // whether or not the player has the tech for that terrain.
  if (!isReachable(state, map, cell)) return 'NotReachable';
  // The Townhall before the terrain: it is the bigger gate, and a player told
  // to research Sailing for a cell their capital cannot reach would be sent
  // the wrong way. Refused, it costs nothing.
  if (!isWithinReach(state, map, cell)) return 'OutOfReach';
  const gate = explorationGate(map, cell);
  if (gate !== null && !isTechComplete(state, gate)) return 'TechLocked';
  const key = coordKey(cell);
  // Read fresh every tap. A cell whose price moved mid-clear — Pitons landing
  // between two presses — reprices the taps still to come and leaves the ones
  // already paid alone, which is the same rule a running timer follows.
  const total = revealCostForCell(state, map, cell);
  const done = state.fog.progress[key] ?? 0;
  const payment = revealTapCost(total, done);
  if (getWallet(state.city.wallet, 'Gold') < payment) return 'NotEnoughGold';
  addToWallet(state.city.wallet, 'Gold', -payment);
  if (done + 1 >= FOG.tapsToReveal) {
    delete state.fog.progress[key];
    delete state.fog.discovered[key];
    state.fog.revealed[key] = true;
    // Clearing fog pays no currency. What a reveal buys is MAP — resource
    // cells, buildable ground, ruins and landmarks — against a Gold price
    // that doubles from ring 4. Knowledge comes out of dungeons instead
    // (sim/expeditions.ts), because heroes and relics are all it buys.
    recordQuestEvent(state, { kind: 'reveal', feature: state.features[key] ?? null });
    // Clearing a cell can bring a whole ring of new ground into view.
    recordVisibleSites(state, map);
    return 'Revealed'; // caller must trigger a production recalc
  }
  state.fog.progress[key] = done + 1;
  return 'Paid';
}

/**
 * Announce every landmark and ruin the player can now SEE, once each.
 *
 * A SWEEP rather than a hook, because "became visible" is not a mutation.
 * Fog state is derived — a cell turns Discovered when a NEIGHBOUR is revealed,
 * when a building's radius lands on it, or when a claimed sanctuary lifts the
 * fog nearby — so there is no single write to hang the announcement off. There
 * are fifteen sites; checking all of them after a fog change is cheaper than
 * being wrong about which change mattered.
 *
 * Visible means not `Undiscovered`: a site under the fog still draws, so the
 * moment the player can make one out is the moment worth telling them about.
 * Waiting for `Revealed` would announce a place they had already walked to.
 */
export function recordVisibleSites(state: GameState, map: MapData): void {
  for (const l of LANDMARKS) {
    if (fogState(state, map, l.location) !== 'Undiscovered') recordSiteDiscovery(state, l.id);
  }
  for (const r of Object.values(RUINS)) {
    if (fogState(state, map, r.location) === 'Undiscovered') continue;
    recordSiteDiscovery(state, r.id);
  }
}

/** Apply a district's fog radii: reveal fogRevealRadius around the footprint
 *  (footprint included), mark Discovered out to fogDiscoverRadius. Called at
 *  the new-game seed and when a build completes. */
export function revealAroundDistrict(state: GameState, map: MapData, district: District): void {
  const def = DISTRICTS[district.definitionId];
  for (const cell of districtCells(district)) {
    if (map.terrain.has(coordKey(cell))) state.fog.revealed[coordKey(cell)] = true;
  }
  for (const cell of cellsWithinRadiusOfRect(map, district.location, def.size, def.fogRevealRadius)) {
    state.fog.revealed[coordKey(cell)] = true;
  }
  for (const cell of cellsWithinRadiusOfRect(map, district.location, def.size,
    effectiveDiscoverRadius(state, def.fogDiscoverRadius))) {
    if (!state.fog.revealed[coordKey(cell)]) state.fog.discovered[coordKey(cell)] = true;
  }
  recordVisibleSites(state, map);
}

/** How far a building marks the fog Discovered (Farsight: +1/rank). Reveal
 *  radius is untouched: seeing farther is not the same as owning farther, and
 *  the paid reveal stays the economy's main sink. */
export const effectiveDiscoverRadius = (state: GameState, base: number): number =>
  Math.max(0, Math.round(resolve(state, 'discoverRadius',
    techValue(state, 'discoverRadius', base))));

/** New-game seed: every district applies its fog radii. */
export function seedFog(state: GameState, map: MapData): void {
  for (const d of state.city.districts) revealAroundDistrict(state, map, d);
}
