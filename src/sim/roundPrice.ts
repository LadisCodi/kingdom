// A NUMBER A PLAYER CAN READ BACK. Every cost and reward the game CALCULATES
// — a price multiplied by a curve, a reward priced in seconds of production —
// is rounded to three significant figures before it is charged or paid:
// 1,234 → 1,230, 12,345 → 12,300, 1,234,567 → 1,230,000. Below 1,000 it is a
// whole number as it stands: 7 → 7, 123 → 123.
//
// An AUTHORED number is never passed through here: a designer's own price is
// what the data says.

/** Three significant figures; a whole number below 1,000. */
export function roundPrice(n: number): number {
  if (!Number.isFinite(n)) return n;
  const sign = n < 0 ? -1 : 1;
  const v = Math.abs(n);
  if (v < 1000) return sign * Math.round(v);
  const scale = 10 ** (Math.floor(Math.log10(v)) - 2);
  return sign * Math.round(v / scale) * scale;
}
