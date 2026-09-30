// Cut the research book's connector kit out of its ChatGPT sheet
// (rb-edges-raw.png, a 2x2 grid: vertical run · horizontal run · elbow ·
// arrowhead) into the four sprites research.css assembles every arrow from.
//
//   node Docs/art/ui/sheets/rb-edges.mjs
//
// Everything is measured off the sheet, not typed in: the stroke's width
// sets the scale (STROKE_PX on the page), and the elbow's radius is printed
// so ELBOW_R in src/ui/research/layout.ts can match the art. Output is 3x.

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, 'rb-edges-raw.png');
const OUT = path.resolve(here, '../../../../src/ui/assets');

const DPR = 3;
/** The stroke's width on the page, in CSS px. */
const STROKE_PX = 2;
/** The band a straight run is drawn in, in CSS px — the stroke plus room for
 *  its wobble. research.css draws the runs this wide. */
const BAND_PX = 8;
/** The arrowhead's width on the page, in CSS px. */
const HEAD_PX = 12;

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const half = Math.floor(W / 2);
const alpha = (x, y) => data[(y * W + x) * 4 + 3];
const inkRun = (fixed, from, to, vertical) => {
  let a = -1, b = -1;
  for (let i = from; i < to; i++) {
    if ((vertical ? alpha(fixed, i) : alpha(i, fixed)) > 128) { if (a < 0) a = i; b = i; }
  }
  return a < 0 ? null : { a, b, mid: (a + b) / 2, width: b - a + 1 };
};
const median = (xs) => xs.sort((p, q) => p - q)[Math.floor(xs.length / 2)];

// ---- scale, from the vertical run's width
const vRows = [];
for (let y = 150; y < 500; y += 10) vRows.push(inkRun(y, 0, half, false));
const strokeW = median(vRows.map((r) => r.width));
const vx = median(vRows.map((r) => r.mid));
const scale = (STROKE_PX * DPR) / strokeW;
console.log(`stroke ${strokeW}px on the sheet → scale ${scale.toFixed(4)}`);

const crop = (left, top, width, height) =>
  sharp(SRC).extract({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) });

/** A seamless tile: `len` sheet px of the run with its first `fade` px
 *  cross-faded into the `fade` px that follow it, so the end meets the start. */
async function seamless(vertical, across, start, len, fade) {
  const band = BAND_PX * DPR / scale;
  const left = vertical ? across - band / 2 : start;
  const top = vertical ? start : across - band / 2;
  const w = vertical ? band : len + fade;
  const h = vertical ? len + fade : band;
  const { data: px, info: i } = await crop(left, top, w, h).raw().toBuffer({ resolveWithObject: true });
  const tw = vertical ? i.width : len;
  const th = vertical ? len : i.height;
  const out = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const along = vertical ? y : x;
      const o = (y * tw + x) * 4;
      const a = (y * i.width + x) * 4;
      const b = vertical ? ((y + len) * i.width + x) * 4 : (y * i.width + x + len) * 4;
      const t = along < fade ? along / fade : 1; // 0 → all tail, 1 → all head
      for (let c = 0; c < 4; c++) out[o + c] = along < fade ? Math.round(px[a + c] * t + px[b + c] * (1 - t)) : px[a + c];
    }
  }
  const tileLen = Math.round(len * scale);
  const size = vertical
    ? { width: BAND_PX * DPR, height: tileLen }
    : { width: tileLen, height: BAND_PX * DPR };
  return sharp(out, { raw: { width: tw, height: th, channels: 4 } }).resize({ ...size, fit: 'fill' }).png();
}

// ---- the straight runs
await (await seamless(true, vx, 150, 330, 40)).toFile(path.join(OUT, 'rb-edge-v.png'));
const hCols = [];
for (let x = half + 120; x < W - 120; x += 10) hCols.push(inkRun(x, 0, half, true));
const hy = median(hCols.map((r) => r.mid));
await (await seamless(false, hy, half + 90, 330, 40)).toFile(path.join(OUT, 'rb-edge-h.png'));

// ---- the elbow: find its vertex (where the two legs' centre lines meet) and
// the radius at which each leg stops being straight
const legX = median([...Array(10).keys()].map((k) => inkRun(half + 90 + k * 10, 0, half, false).mid));
let rightmost = 0;
for (let x = half - 1; x > 0 && rightmost === 0; x--) if (inkRun(x, half, W, true)) rightmost = x;
const legY = median([...Array(10).keys()].map((k) => inkRun(rightmost - 20 - k * 10, half, W, true).mid));
let bendY = legY;
for (let y = half + 90; y < legY; y++) {
  const r = inkRun(y, 0, half, false);
  if (r && Math.abs(r.mid - legX) > 1.5) { bendY = y; break; }
}
let bendX = legX;
for (let x = rightmost - 20; x > legX; x--) {
  const r = inkRun(x, half, W, true);
  if (r && Math.abs(r.mid - legY) > 1.5) { bendX = x; break; }
}
const radius = Math.max(legY - bendY, bendX - legX);
const radiusPx = radius * scale / DPR;
console.log(`elbow vertex (${legX}, ${legY}), radius ${radius}px on the sheet → ${radiusPx.toFixed(2)} CSS px`);
const r = Math.round(radiusPx) * DPR / scale; // cut the legs at the radius the layout will use
const bandHalf = BAND_PX * DPR / scale / 2;
await crop(legX - bandHalf, legY - r, r + bandHalf, r + bandHalf)
  .resize({ width: Math.round((r + bandHalf) * scale), height: Math.round((r + bandHalf) * scale), fit: 'fill' })
  .png().toFile(path.join(OUT, 'rb-edge-elbow.png'));

// ---- the arrowhead: its ink box, scaled to HEAD_PX wide. The box is found
// from the alpha rather than with sharp's trim, which keys on colour.
let hx0 = W, hy0 = W, hx1 = -1, hy1 = -1;
for (let y = half; y < W; y++) {
  for (let x = half; x < W; x++) {
    if (alpha(x, y) > 8) { hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x); hy0 = Math.min(hy0, y); hy1 = Math.max(hy1, y); }
  }
}
await crop(hx0, hy0, hx1 - hx0 + 1, hy1 - hy0 + 1).resize({ width: HEAD_PX * DPR })
  .png().toFile(path.join(OUT, 'rb-edge-head.png'));

for (const f of ['rb-edge-v', 'rb-edge-h', 'rb-edge-elbow', 'rb-edge-head']) {
  const m = await sharp(path.join(OUT, `${f}.png`)).metadata();
  console.log(`${f}.png ${m.width}×${m.height} (${(m.width / DPR).toFixed(1)}×${(m.height / DPR).toFixed(1)} CSS px)`);
}
