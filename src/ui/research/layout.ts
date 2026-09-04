// Tech-tree geometry, with no DOM in sight.
//
// tests/research.test.ts used to hand-copy the renderer's H-then-V connector
// route in order to assert that no elbow crosses an unrelated node — two
// definitions of one thing, in different directories, one of which was about
// to be redesigned. The route lives here now and both sides read it, so the
// test is coupled to the renderer rather than to a comment about it.
//
// The `x`/`y` in TECHNOLOGIES[*].node are hand-authored CONTENT: this is the
// only test protecting a UI decision, and it is what stops someone adding a
// technology whose connector runs straight through another one.

/** A position on the authored tech grid (not pixels). */
export interface GridPoint {
  x: number;
  y: number;
}

/** px per tree-grid step. */
export const GRID = 120;
/** Tech node square. */
export const NODE = 56;
/**
 * Minor-rank node. Smaller than a major, and that is now the ONLY thing the
 * shape says: a rank is a technology like any other (tech-tree.md §1 rule 3),
 * so it is a square too, not the circle an upgrade used to be.
 */
export const UNODE = 40;
/**
 * How far below its parent a rank fan hangs.
 *
 * 0.5, not 0.7. The window is narrow and both ends of it are hard: a rank
 * must clear its PARENT square (28 + 20 = 48px of half-heights) and it must
 * clear the tech one row BELOW it (another 48, out of the 120 the row is
 * worth). So FAN_DY has to sit between 48 and 72, and 0.7 x 120 = 84 was
 * outside it — the fan overlapped the node underneath by 12px, which
 * `tests/research.test.ts` never saw because its invariant is about
 * connector elbows crossing nodes, not about nodes crossing each other.
 * 0.5 x 120 = 60 centres the fan in the gap with 12px clear on each side.
 *
 * The fan is a STOPGAP: it is what keeps ~49 rank nodes on screen without
 * authoring 49 positions. Docs/features/tomes-and-research.md §5 replaces the
 * whole layout with one bounded page per tome, at which point this goes.
 */
export const FAN_DY = 0.5 * GRID;
/** Spacing between fanned rank nodes. */
export const FAN_DX = 56;

/**
 * The corner points of the connector from `from` to `to`.
 *
 * THE HORIZONTAL LEG ALWAYS RUNS ALONG AN EVEN ROW, and that is the whole
 * rule. A tome page is a spine of keystones at (0, even) with each era's
 * content spread across the odd row below it, so the even rows are empty
 * except for the spine itself and the odd rows are full. Route along an odd
 * row and the connector ploughs through whichever majors sit between the
 * endpoint and the trunk — which is exactly what it did: `Forestry →
 * Charter II` ran straight through `Urban Planning`.
 *
 * So the elbow is at (to.x, from.y) when `from` is on the even row, and at
 * (from.x, to.y) when it is not. Two points when they already share a row or
 * a column.
 */
export function edgePath(from: GridPoint, to: GridPoint): GridPoint[] {
  if (from.x === to.x || from.y === to.y) return [from, to];
  const elbow = from.y % 2 === 0 ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  return [from, elbow, to];
}

/** Every grid cell the connector passes through, endpoints excluded. */
export function edgeCells(from: GridPoint, to: GridPoint): GridPoint[] {
  const cells: GridPoint[] = [];
  const path = edgePath(from, to);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const stepX = Math.sign(b.x - a.x);
    const stepY = Math.sign(b.y - a.y);
    let { x, y } = a;
    while (x !== b.x || y !== b.y) {
      x += stepX;
      y += stepY;
      cells.push({ x, y });
    }
  }
  // Drop the destination itself; the elbow and everything between stays.
  return cells.slice(0, -1);
}
