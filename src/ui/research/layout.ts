// Tome-page geometry, with no DOM in sight.
//
// A tome is ONE page read top to bottom: three columns of slots, a row of
// three at a time, with an era GATE BAR spanning the width wherever the next
// band begins (Docs/features/07-research.md §2.2). The game screen and
// `?dev=tree` both lay themselves out from this module, so there is one
// definition of where a card sits and where its connector runs.
//
// Everything here is pure: authored slots in, rows and pixels out.

/** Three columns. A fourth would not fit a phone, and the flow stops reading
 *  as a flow past three. */
export const COLS = 3;

// ---- pixels ---------------------------------------------------------------
/** One node card. Three of these plus two gaps and the two channels is the
 *  page's width, and the page's width is the phone's.
 *
 * The body face has ONE legal size — 18px on the m6x11plus grid
 * (ui/styles/tokens.css) — which is 6px a character, so these two numbers are
 * a character count: 120 wide leaves 106px of content, or 17 characters, and
 * the longest technology name in the game ("Stonecutting III") is 16. 96 tall
 * is that name on one line and three lines of what it does under it. */
export const NODE_W = 120;
export const NODE_H = 96;
const COL_GAP = 6;
/** The gutter between two rows of cards: where a connector's horizontal leg
 *  runs, so it never crosses a card. */
export const ROW_GAP = 36;
/** The era bar itself. */
export const GATE_BAR_H = 34;
/** The line an era bar takes: the bar with a half-gutter each side, so the
 *  bar's bottom edge IS the gutter the next row's connectors come out of. */
const GATE_H = GATE_BAR_H + ROW_GAP;

/**
 * The lane down each side of the page that long connectors run in.
 *
 * A connector between two ADJACENT rows has a gutter to cross in and can
 * never touch a card. One that reaches further used to be the whole problem —
 * it had to run down a column, through whatever was parked in it — so when
 * that column is not clear it steps out into the channel, down the outside of
 * the page, and back in above its target. Nothing on the page can be crossed
 * by a line, which is why there is no rule about it.
 */
export const CHANNEL_W = 14;

export const PAGE_W = COLS * NODE_W + (COLS - 1) * COL_GAP + 2 * CHANNEL_W;
/** Left edge of a column, in page pixels. */
export const colLeft = (col: number): number => CHANNEL_W + col * (NODE_W + COL_GAP);
/** Centre of a column, in page pixels. */
const colCentre = (col: number): number => colLeft(col) + NODE_W / 2;

/**
 * One entry of a laid-out page, in reading order.
 *
 * A `techs` row keeps its AUTHORED row number (the editor addresses slots by
 * it, and a requirement is legal by it); its index in the list is a different
 * number, because gates take a line of their own and the game collapses rows
 * the fog has emptied.
 */
export type PageRow =
  | {
    kind: 'techs'; row: number; era: number; slots: Array<string | null>;
    /** Editor only: the empty line at the end of a band, there to be dropped
     *  into. Its row number is the next band's first row, so it draws empty
     *  whatever is authored there — dropping into it is what pushes the bands
     *  below down a line. */
    spare?: true;
  }
  | { kind: 'gate'; era: number };

/**
 * What `pageRows` needs to know about a technology — the shape file's entry,
 * or the game's definition; both satisfy it.
 *
 * Optional, because a technology can be OFF THE PAGE in the editor: with no
 * tome it matches no page and simply is not laid out. The rules call that an
 * error, so the game never sees one.
 */
export interface Placed {
  tome?: string;
  era?: number;
  row?: number;
  col?: number;
}

/**
 * The page for one tome: every authored row that holds something, in order,
 * with a gate bar wherever the era changes.
 *
 * `keep` is the fog: a node it rejects is left out, and a row that ends up
 * empty is dropped with it — so the game's page is as long as what the player
 * can actually see, while the editor (which keeps everything) sees every row
 * it has authored. Era bars survive an empty band: the bar is the statement
 * that there IS more book, which is the one thing worth showing behind a
 * locked gate.
 */
export function pageRows(
  placed: Readonly<Record<string, Placed>>,
  tome: string,
  keep: (id: string) => boolean = () => true,
): PageRow[] {
  const byRow = new Map<number, { era: number; slots: Array<string | null> }>();
  const eras = new Set<number>();
  for (const [id, node] of Object.entries(placed)) {
    if (node.tome !== tome || node.era === undefined) continue;
    eras.add(node.era);
    if (!keep(id)) continue;
    if (node.row === undefined || node.col === undefined) continue;
    if (node.col < 0 || node.col >= COLS) continue;
    const row = byRow.get(node.row)
      ?? { era: node.era, slots: Array.from({ length: COLS }, () => null) };
    row.slots[node.col] = id;
    row.era = node.era; // rows never straddle eras (techTreeRules.ts)
    byRow.set(node.row, row);
  }
  const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]);
  const out: PageRow[] = [];
  let era = 0;
  for (const [row, held] of rows) {
    // Every band between the last row's era and this one gets its bar, so a
    // band nothing is placed in still shows the door it is behind.
    for (let e = era + 1; e <= held.era; e++) if (e > 1) out.push({ kind: 'gate', era: e });
    era = held.era;
    out.push({ kind: 'techs', row, era: held.era, slots: held.slots });
  }
  // A band authored but wholly invisible (era 4 behind its gate) still says so.
  for (const e of [...eras].sort((a, b) => a - b)) {
    if (e > era && e > 1) out.push({ kind: 'gate', era: e });
  }
  return out;
}

/**
 * The page as the EDITOR sees it: every authored row of every band, empty
 * ones included, plus one spare row at the end of each band to drop into.
 *
 * A band's rows are every integer from its first to its last, which is what
 * makes "insert a row here" nothing more than renumbering the rows below it —
 * the gap left behind IS an empty row, with no extra state anywhere to say
 * so. The game's `pageRows` skips empty rows for the same reason: there, a
 * gap is the fog, and a blank line in the middle of the flow would be a lie.
 */
export function authoredRows(
  placed: Readonly<Record<string, Placed>>,
  tome: string,
  eras: readonly number[],
): PageRow[] {
  const held = new Map<string, string>(); // `row,col` → id
  const bounds = new Map<number, { lo: number; hi: number }>();
  for (const [id, node] of Object.entries(placed)) {
    if (node.tome !== tome || node.era === undefined) continue;
    if (node.row === undefined || node.col === undefined) continue;
    held.set(`${node.row},${node.col}`, id);
    const seen = bounds.get(node.era);
    bounds.set(node.era, seen === undefined
      ? { lo: node.row, hi: node.row }
      : { lo: Math.min(seen.lo, node.row), hi: Math.max(seen.hi, node.row) });
  }
  const out: PageRow[] = [];
  let next = 0; // where an empty band's spare row goes
  for (const era of eras) {
    // EVERY band gets a header here, era 1 included — unlike the game, where
    // the first band has no bar because it opens with the book. In the editor
    // the bar is the band's HANDLE: what it asks for, and the button that
    // drops it. A band with no header would be a band you cannot edit.
    out.push({ kind: 'gate', era });
    const span = bounds.get(era);
    const lo = span?.lo ?? next;
    const hi = span?.hi ?? next - 1;
    for (let row = lo; row <= hi; row++) {
      out.push({
        kind: 'techs',
        row,
        era,
        slots: Array.from({ length: COLS }, (_, col) => held.get(`${row},${col}`) ?? null),
      });
    }
    out.push({
      kind: 'techs',
      row: hi + 1,
      era,
      slots: Array.from({ length: COLS }, () => null),
      spare: true,
    });
    next = hi + 2;
  }
  return out;
}

/** Height of one laid-out row. */
const rowHeight = (row: PageRow): number =>
  row.kind === 'gate' ? GATE_H : NODE_H + ROW_GAP;

/** Top edge of each row, and the page's total height. */
export function rowTops(rows: readonly PageRow[]): { tops: number[]; height: number } {
  const tops: number[] = [];
  let y = 0;
  for (const row of rows) {
    tops.push(y);
    y += rowHeight(row);
  }
  return { tops, height: y };
}

/**
 * The connector from one card to another, as page pixels.
 *
 * Out of the bottom of the source, down its own column, across the GUTTER
 * above the target row, and down into the target's top edge. The horizontal
 * leg runs in a gutter, so it crosses nothing — and neither does the vertical
 * one as long as the column below the source is empty the whole way.
 *
 * `clear` is that condition, and the caller is the only one who can answer
 * it. When it is false the line steps out into the side CHANNEL instead and
 * comes back in above the target: longer, and worth it — a line that cannot
 * cross a card is one less thing for the page to get wrong.
 */
export function edgePath(
  from: { top: number; col: number },
  to: { top: number; col: number },
  clear = true,
): Array<{ x: number; y: number }> {
  const startY = from.top + NODE_H;
  const gutterBelow = startY + ROW_GAP / 2;
  const gutterAbove = to.top - ROW_GAP / 2;
  const x0 = colCentre(from.col);
  const x1 = colCentre(to.col);
  if (clear) {
    if (x0 === x1) return [{ x: x0, y: startY }, { x: x1, y: to.top }];
    return [
      { x: x0, y: startY },
      { x: x0, y: gutterAbove },
      { x: x1, y: gutterAbove },
      { x: x1, y: to.top },
    ];
  }
  // Out to whichever side the two ends are nearer, so a left-hand branch does
  // not walk the whole width of the page to come back to itself.
  const channelX = from.col + to.col <= COLS - 1
    ? CHANNEL_W / 2
    : PAGE_W - CHANNEL_W / 2;
  return [
    { x: x0, y: startY },
    { x: x0, y: gutterBelow },
    { x: channelX, y: gutterBelow },
    { x: channelX, y: gutterAbove },
    { x: x1, y: gutterAbove },
    { x: x1, y: to.top },
  ];
}

/** An SVG `d` for a connector, with rounded elbows. */
export function edgeD(points: Array<{ x: number; y: number }>, radius = 8): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const here = points[i];
    const next = points[i + 1];
    const inDir = { x: Math.sign(here.x - prev.x), y: Math.sign(here.y - prev.y) };
    const outDir = { x: Math.sign(next.x - here.x), y: Math.sign(next.y - here.y) };
    const rIn = Math.min(radius, Math.abs(here.x - prev.x) + Math.abs(here.y - prev.y));
    const rOut = Math.min(radius, Math.abs(next.x - here.x) + Math.abs(next.y - here.y));
    d += ` L ${here.x - inDir.x * rIn} ${here.y - inDir.y * rIn}`;
    d += ` Q ${here.x} ${here.y} ${here.x + outDir.x * rOut} ${here.y + outDir.y * rOut}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}
