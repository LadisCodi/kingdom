#!/usr/bin/env node
// A sprite sheet -> one PNG per frame, named for the character atlas.
//
//   node slice.mjs villager_1 walk 4
//
// The frames are cut on the EMPTY COLUMNS between them, not on an assumed
// grid: an image model spaces a row of poses by eye, and a fixed-width cut
// slices arms off. Reading the alpha tells us exactly where each figure
// starts and stops, and disagreeing with the expected count is the signal
// that the sheet is unusable — two figures touching, or one missing.
//
// Frames are NOT trimmed vertically here. Every figure in a sheet stands on
// one ground line, and it is the animation's whole point that a passing pose
// is taller than a stride: trimming each frame to its own ink would flatten
// that back out. `scripts/char-atlas.mjs` trims when it packs, and records
// the feet, so the common baseline has to survive until then.
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../characters');
const magick = (...a) => execFileSync('magick', a.map(String), { encoding: 'utf8' }).trim();

const [id, anim, want] = process.argv.slice(2);
const sheet = join(HERE, `${id}-${anim}.master.png`);
const [W, H] = magick(sheet, '-format', '%w %h', 'info:').split(' ').map(Number);

// One row of per-column alpha means, read out of a 1-pixel-tall resize.
const txt = join(HERE, '_cols.txt');
// `-alpha off` after the extract matters: without it the greyscale result
// keeps an alpha channel of its own and `txt:` reports every pixel as 0.
magick(sheet, '-alpha', 'extract', '-alpha', 'off',
  '-resize', `${W}x1!`, '-depth', '16', `txt:${txt}`);
const cols = readFileSync(txt, 'utf8').split('\n').slice(1)
  .map((l) => l.match(/^\d+,0: \((\d+)/)?.[1])
  .filter((v) => v !== undefined)
  .map(Number);
unlinkSync(txt);

// A column counts as empty when almost nothing in it is opaque. The threshold
// is loose because a soft contact shadow bleeds a little into the gaps.
const MAX = 65535;
const empty = cols.map((v) => v / MAX < 0.004);
const runs = [];
let start = null;
empty.forEach((e, x) => {
  if (!e && start === null) start = x;
  if (e && start !== null) { runs.push([start, x - 1]); start = null; }
});
if (start !== null) runs.push([start, cols.length - 1]);

// Drop slivers: a stray speck of shadow is not a frame.
const wide = runs.filter(([a, b]) => b - a > W / (Number(want) * 6));
console.log(`  ${W}x${H}, found ${wide.length} figures: ` +
  wide.map(([a, b]) => `${a}-${b}`).join(' '));
if (wide.length !== Number(want)) {
  console.error(`  FAIL: expected ${want} — regenerate the sheet`);
  process.exit(1);
}

// ONE SIZE FOR THE WHOLE CHARACTER, across sheets.
//
// Each sheet is a separate render, and the model draws the figure a little
// larger or smaller each time: this character's idle came back 371 px tall
// and its walk 268. The atlas takes a character's height from its tallest
// frame, so left alone the villager would shrink the moment it started
// walking.
//
// So every sheet is rescaled to put its TALLEST frame at NOMINAL. Within a
// sheet the differences survive — a passing pose really is taller than a
// stride, and that is the bounce in the walk — but standing and walking now
// agree, because a walking person is about as tall as a standing one.
// 128 and not 256: a villager is drawn about 49 CSS px tall, which is 98
// device pixels on a 2x screen. Frames four times larger than anything can
// show them tripled the shipped atlas for nothing.
const NOMINAL = 128;
const heights = wide.map(([a, b]) => {
  const pad = Math.round((b - a) * 0.06);
  const x = Math.max(0, a - pad);
  const w = Math.min(W - x, b - a + 1 + pad * 2);
  return Number(magick(sheet, '-crop', `${w}x${H}+${x}+0`, '+repage',
    '-fuzz', '3%', '-trim', '-format', '%h', 'info:'));
});
const factor = NOMINAL / Math.max(...heights);
console.log(`  tallest frame ${Math.max(...heights)} px -> ${NOMINAL} (x${factor.toFixed(3)})`);

wide.forEach(([a, b], i) => {
  const pad = Math.round((b - a) * 0.06); // a little air, so nothing is clipped
  const x = Math.max(0, a - pad);
  const w = Math.min(W - x, b - a + 1 + pad * 2);
  const out = join(OUT, `${id}_${anim}_${i + 1}.png`);
  // `-fuzz 3%` on the trim, not a bare trim: the render leaves a contact
  // shadow that fades to one or two units of alpha, which a bare trim counts
  // as ink. It made the same figure come out 387 px tall in one frame and
  // 268 in the next, which reads as the villager growing and shrinking as it
  // walks.
  magick(sheet, '-crop', `${w}x${H}+${x}+0`, '+repage',
    '-fuzz', '3%', '-trim', '+repage',
    '-filter', 'Lanczos', '-resize', `${Math.round(factor * 100 * 1000) / 1000}%`,
    '-strip', out);
  console.log(`  wrote ${id}_${anim}_${i + 1}.png  ${magick(out, '-format', '%wx%h', 'info:')}`);
});
