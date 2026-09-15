// Smooth-art cutter: ChatGPT sheets → one PNG per named piece.
//
//   node scripts/ui-cut.mjs            cut every sheet in the manifest
//   node scripts/ui-cut.mjs --only ui-k3-queue
//   node scripts/ui-cut.mjs --list     print what each sheet contains, cut nothing
//
// Input:  Docs/art/ui/cuts.manifest.json + Docs/art/ui/sheets/*.png
// Output: src/render/assets/<name>.png
//
// WHY A SECOND CUTTER, beside scripts/ui-atlas.mjs. That one exists for ICONS
// and for MAP sprites, and both of those are square cells of pixel art: it
// slices on a grid, pads every piece to one square canvas, and finishes with
// `-channel A -threshold 50%` so the alpha stays hard. Every one of those is
// wrong for this art:
//
//   * THE PIECES ARE NOT A GRID. A frame sheet has two panels on one row and
//     a strip on the next, at whatever size the piece wanted to be. So the
//     objects are FOUND rather than assumed — connected components over the
//     alpha, read row-major — which is also how their boxes were measured by
//     hand before this script existed.
//   * THE PIECES ARE NOT SQUARE. A standing figure is 2:3 and a button slab
//     is 5:2. Padding either into a square wastes most of the file and makes
//     every call site compensate, so a piece keeps its own aspect and `size`
//     is its LONG side.
//   * THE ALPHA IS SOFT. This art is drawn to be scaled, and thresholding its
//     edge is what would turn a painted rim into a staircase. So alpha is
//     left alone — and the coloured fringe ChatGPT leaves on a semi-
//     transparent edge is removed by un-premultiplying against it instead
//     (`-channel A -level`), which pulls the halo out without hardening.
//
// Not in `prebuild`: needs ImageMagick, which CI does not have. Outputs are
// committed and this is run by hand, exactly like the atlas.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI_DIR = join(ROOT, 'Docs/art/ui');
const OUT_DIR = join(ROOT, 'src/render/assets');
const MANIFEST = join(UI_DIR, 'cuts.manifest.json');

/** A blob smaller than this is a stray speck — an unpremultiplied fringe that
 *  survived, or a dot of the piece above it — never a piece of its own. */
const MIN_AREA = 3000;
/** Two objects whose vertical centres are closer than this belong to the same
 *  ROW, however far apart they sit: a bust and a standing figure on one line
 *  are 300px of height apart in their boxes and still one row. */
const ROW_TOLERANCE = 220;

const magick = (...args) =>
  execFileSync('magick', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const fail = (msg) => { console.error(`ui-cut: ${msg}`); process.exit(1); };

/**
 * Every piece on a sheet, in reading order.
 *
 * Row-major with a tolerance, not a sort by `y`: pieces on one row are drawn
 * at their own heights, so their box tops differ by more than the gap to the
 * next row. Grouping by CENTRE within `ROW_TOLERANCE` is what makes "left to
 * right, top to bottom" mean what a person reading the sheet means by it.
 */
function objects(file) {
  const out = magick(
    file, '-alpha', 'extract', '-threshold', '20%',
    '-define', 'connected-components:verbose=true',
    '-define', `connected-components:area-threshold=${MIN_AREA}`,
    '-define', 'connected-components:mean-color=true',
    '-connected-components', '8', 'null:',
  );
  const found = [];
  for (const line of out.split('\n').slice(1)) {
    // `  3: 685x333+32+132  373.7,302.8  207227  srgb(255,255,255)`
    const m = /^\s*\d+:\s+(\d+)x(\d+)\+(\d+)\+(\d+)\s+([\d.]+),([\d.]+)\s+(\d+)\s+(\S+)/.exec(line);
    if (!m) continue;
    const [, w, h, x, y, , cy, area, colour] = m;
    // The background component is the black one — the sheet's transparency.
    if (colour.startsWith('srgb(0,0,0')) continue;
    found.push({
      w: +w, h: +h, x: +x, y: +y, cy: +cy, area: +area,
    });
  }
  // Group into rows by centre, then order each row left to right.
  found.sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const o of found) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(o.cy - row.cy) < ROW_TOLERANCE) {
      row.items.push(o);
      row.cy = row.items.reduce((n, i) => n + i.cy, 0) / row.items.length;
    } else rows.push({ cy: o.cy, items: [o] });
  }
  return rows.flatMap((r) => r.items.sort((a, b) => a.x - b.x));
}

/**
 * Punch a transparent disc through the middle of a square piece.
 *
 * The three ring states arrive with a FACE PAINTED INSIDE THEM — the sheet
 * shows them in use, on a villager and on a soldier. A ring is chrome: it has
 * to sit over whichever trainee the slot holds, so the portrait it was drawn
 * around has to come out and the rim has to stay. `inner` is that boundary as
 * a fraction of the radius, measured off the art (the rim runs from about
 * 0.78 out).
 */
function punch(file, inner) {
  const [w] = magick(file, '-format', '%wx%h', 'info:').split('x').map(Number);
  const r = (w / 2) * inner;
  const c = w / 2;
  magick(
    file,
    // Draw the hole into a copy of the alpha channel, then put it back: a
    // feathered edge (`-blur`) so the punched rim does not staircase against
    // the portrait that will show through it.
    // `-alpha off` on BOTH sides: the extracted mask keeps an alpha channel of
    // its own, and CopyOpacity would read that opaque channel instead of the
    // grey it was asked to read — which is a punch that silently does nothing.
    '(', '+clone', '-alpha', 'extract', '-alpha', 'off', '-fill', 'black', '-draw',
    `circle ${c},${c} ${c},${c - r}`, '-blur', '0x1', ')',
    '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
    '-strip', '-define', 'png:exclude-chunk=date,time', file,
  );
}

/**
 * Cut one piece out and rescale it onto its own canvas.
 *
 * `size` is the LONG side; the short side follows the content's aspect, so
 * nothing is letterboxed and nothing is padded. `square: true` overrides that
 * for a piece a call site wants centred in a square well — a medallion ring,
 * where the circle has to sit dead centre of whatever it is layered over.
 */
function cut(file, box, name, { size = 256, square = false, punchInner = null }) {
  const scale = size / Math.max(box.w, box.h);
  const w = Math.max(1, Math.round(box.w * scale));
  const h = Math.max(1, Math.round(box.h * scale));
  const out = join(OUT_DIR, `${name}.png`);
  const region = `${box.w}x${box.h}+${box.x}+${box.y}`;
  const piece = [
    '(', file, '-crop', region, '+repage',
    // Un-premultiply the edge: ChatGPT composites its pieces over white and
    // leaves a bright rim in the semi-transparent pixels. Lifting the alpha's
    // black point drops the rim without touching the solid interior, and
    // without the hard threshold that would staircase a painted edge.
    '-channel', 'A', '-level', '12%,100%', '+channel',
    '-filter', 'Lanczos', '-resize', `${w}x${h}!`, ')',
  ];
  if (square) {
    magick('-size', `${size}x${size}`, 'xc:none', ...piece,
      '-gravity', 'center', '-composite',
      '-strip', '-define', 'png:exclude-chunk=date,time', out);
  } else {
    magick('-size', `${w}x${h}`, 'xc:none', ...piece,
      '-gravity', 'center', '-composite',
      '-strip', '-define', 'png:exclude-chunk=date,time', out);
  }
  if (punchInner !== null) punch(out, punchInner);
  return `${name}.png ${square ? `${size}x${size}` : `${w}x${h}`}`
    + (punchInner !== null ? ' (punched)' : '');
}

// ------------------------------------------------------------------- the run

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const listOnly = args.includes('--list');

if (!existsSync(MANIFEST)) fail(`${MANIFEST} not found`);
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
for (const sheet of manifest.sheets) {
  const stem = sheet.file.replace(/^sheets\//, '').replace(/\.png$/, '');
  if (only && stem !== only) continue;
  const file = join(UI_DIR, sheet.file);
  if (!existsSync(file)) fail(`${sheet.file} not found`);

  const found = objects(file);
  if (listOnly) {
    console.log(`\n${sheet.file} — ${found.length} pieces`);
    found.forEach((o, i) => console.log(
      `  ${String(i).padStart(2)} ${o.w}x${o.h}+${o.x}+${o.y}  ${sheet.names[i] ?? '(unnamed)'}`));
    continue;
  }
  if (found.length !== sheet.names.length) {
    fail(`${sheet.file}: found ${found.length} pieces but the manifest names `
      + `${sheet.names.length}. Run --list to see them.`);
  }
  console.log(`ui-cut: ${sheet.file} — ${found.length} pieces`);
  sheet.names.forEach((name, i) => {
    if (!name) return;
    const opts = { size: sheet.size ?? 256, square: sheet.square === true, ...(sheet.each?.[name] ?? {}) };
    console.log(`   ${cut(file, found[i], name, opts)}`);
    total += 1;
  });
}
if (!listOnly) console.log(`ui-cut: wrote ${total} files to src/render/assets/`);
