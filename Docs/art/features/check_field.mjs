#!/usr/bin/env node
// Does a field tile's SOIL actually sit on a 2:1 diamond?
//
// A field is the one asset that has to tile edge to edge, so its ground is
// the one silhouette that must be exact. It is also the one the eye checks:
// two plots side by side meet along a straight line, and a diamond even a
// little too deep leaves a notch where four corners should meet.
//
// The soil is measurable without guessing. Read the ink's width row by row:
// the widest row is where the diamond's left and right corners are, and the
// lowest row is its bottom corner. A true 2:1 diamond drops from one to the
// other in exactly a QUARTER of its width. The crop standing above the
// widest row is ignored, which is the point — it is the SOIL that tiles.
import { execFileSync } from 'node:child_process';

const file = process.argv[2];
const txt = execFileSync('magick',
  [file, '-alpha', 'extract', '-alpha', 'off', '-depth', '8', 'txt:-'],
  { encoding: 'utf8', maxBuffer: 1 << 28 });

const rows = new Map();
for (const line of txt.split('\n').slice(1)) {
  if (!line) continue;
  const [pos, rest] = line.split(':');
  const [x, y] = pos.split(',').map(Number);
  if (Number(rest.split('(')[1].split(',')[0]) <= 128) continue;
  const r = rows.get(y) ?? [Infinity, -1];
  rows.set(y, [Math.min(r[0], x), Math.max(r[1], x)]);
}

let widest = 0, yMid = 0, yBot = 0;
for (const [y, [lo, hi]] of rows) {
  if (hi - lo + 1 > widest) { widest = hi - lo + 1; yMid = y; }
  if (y > yBot) yBot = y;
}
const half = yBot - yMid;
const want = widest / 4;
const ratio = widest / (half * 2);
console.log(`  soil ${widest} wide, ${half * 2} tall -> ${ratio.toFixed(2)}:1` +
  `  (bottom half ${half} rows, wants ${want.toFixed(0)})`);
if (ratio < 1.9 || ratio > 2.1) {
  console.error(`  FAIL: ${ratio.toFixed(2)}:1 is not the 2:1 camera — ` +
    'two plots will not meet at the corners. Regenerate.');
  process.exit(1);
}
