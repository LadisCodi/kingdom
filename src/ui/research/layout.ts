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
/** Upgrade circle. */
export const UNODE = 36;
/** How far below its parent an upgrade fan hangs. */
export const FAN_DY = 0.7 * GRID;
/** Spacing between fanned upgrade circles. */
export const FAN_DX = 56;

/**
 * The corner points of the connector from `from` to `to`: horizontal first,
 * then vertical. Two points when they share a row or column, three when the
 * route needs an elbow — and the elbow is at (to.x, from.y).
 */
export function edgePath(from: GridPoint, to: GridPoint): GridPoint[] {
  if (from.x === to.x || from.y === to.y) return [from, to];
  return [from, { x: to.x, y: from.y }, to];
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
