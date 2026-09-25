// THE GROUND: which tile a cell draws, and what happens where two terrains
// meet.
//
// Two problems, two answers.
//
// **The repeat.** One drawing per terrain across 1,470 cells is a visible
// weave, and the eye finds it long before it finds anything else on screen.
// So each terrain has up to `VARIANTS` drawings and a cell picks one by a
// hash of its own coordinates — stable across redraws, free, and needing no
// state anywhere. Missing variants simply never come up: a terrain that has
// only its base drawing behaves exactly as it did before any were authored.
//
// **The seam.** Two terrains meeting on a hard diamond edge reads as a
// mosaic, not as ground. Each terrain therefore has a FRINGE — its own
// material creeping over the edge — drawn on top of the neighbour whenever
// it outranks it. The art is authored once, for the diamond's top-right
// edge, and the other three sides are that same piece mirrored: a 2:1
// diamond is symmetric about both axes, which is why one drawing covers
// four sides and a seventh terrain costs one file.

import type { Coord, TerrainId } from '../sim/state';
import type { MapData } from '../sim/grid';
import { coordKey } from '../sim/state';
import type { PlotBox } from './camera';
import { onDiamond } from './iso';
import { drawSprite, spriteUrl } from './sprites';

/** How many drawings a terrain may have. `terrain_grassland.png` is the
 *  first; `terrain_grassland_2.png` onwards are the rest. */
export const VARIANTS = 4;

/**
 * WHOSE FRINGE WINS where two terrains meet: the higher number creeps over
 * the lower one, and only one of the two is ever drawn, so a seam is one
 * piece of art and never two fighting.
 *
 * Water is on top because the thing a shoreline needs to show is the WATER's
 * edge — foam on the sand, not sand trailing off into the sea. Below it the
 * order runs from the most alive ground to the least, so grass creeps onto
 * sand and never the other way round.
 */
const LAYER: Record<TerrainId, number> = {
  Desert: 0,
  Snow: 1,
  Tundra: 2,
  Plains: 3,
  Grassland: 4,
  Water: 5,
};

/** The four sides of a cell, and the neighbour on each. The names are the
 *  sim's compass, on its square grid; `onDiamond` rotates the piece onto the
 *  matching edge of the diamond. */
const SIDES = [
  { side: 'N', dx: 0, dy: -1 },
  { side: 'E', dx: 1, dy: 0 },
  { side: 'S', dx: 0, dy: 1 },
  { side: 'W', dx: -1, dy: 0 },
] as const;

/**
 * Which drawing this cell uses. A hash of the coordinates — the same pair of
 * primes the spell motes scatter on — so the ground holds still between
 * frames and between sessions without anything being stored.
 */
export function terrainVariant(cell: Coord): number {
  const h = ((cell.x * 374761393) ^ (cell.y * 668265263)) >>> 0;
  // Mixed once more: the raw xor puts neighbours on adjacent values, which
  // a modulo turns straight back into a diagonal stripe.
  return (Math.imul(h ^ (h >>> 15), 2246822519) >>> 0) % VARIANTS;
}

/** The sprite key for a cell's ground, falling back to the base drawing when
 *  the variant it drew has not been authored. */
export function terrainKey(terrain: TerrainId, cell: Coord): string {
  const stem = `terrain_${terrain.toLowerCase()}`;
  const v = terrainVariant(cell);
  if (v === 0) return stem;
  return spriteUrl(`${stem}_${v + 1}`) === null ? stem : `${stem}_${v + 1}`;
}

/**
 * The fringes of every neighbour that outranks this cell's terrain, laid over
 * its ground.
 *
 * A fringe is authored as a square with a band of material along its TOP edge
 * fading down into transparency, and `onDiamond` puts that top edge on
 * whichever of the diamond's four edges the neighbour is across. One piece,
 * four sides, no mirroring — the basis is rotated. The art is lit flat
 * because of it: light coming from one direction in the source would arrive
 * from four different directions on screen.
 */
export function drawTerrainFringes(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  cell: Coord,
  terrain: TerrainId,
  box: PlotBox,
): void {
  for (const { side, dx, dy } of SIDES) {
    const other = map.terrain.get(coordKey({ x: cell.x + dx, y: cell.y + dy }));
    if (!other || other === terrain || LAYER[other] <= LAYER[terrain]) continue;
    const key = `terrain_${other.toLowerCase()}_edge`;
    if (spriteUrl(key) === null) continue;
    onDiamond(ctx, box, side, () => { drawSprite(ctx, key, 0, 0, 1, 1); });
  }
}
