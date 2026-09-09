// Character pipeline: the loose per-frame PNGs in Docs/art/characters → one
// atlas + the code that indexes it.
//
//   node scripts/char-atlas.mjs build     pack every frame, generate the index
//   node scripts/char-atlas.mjs check     parse the names, report, emit nothing
//
// Input:  Docs/art/characters/*.png        one file per animation frame
// Output: src/render/characters/atlas.png            the ONE shipped raster
//         src/render/characters/atlas.generated.ts   CHARACTERS[name][anim][frame]
//         Docs/art/characters/contact.html           every character, animated
//
// Why an atlas and not "drop them in src/render/assets": sprites.ts globs that
// directory EAGERLY and builds an <img> per file, and there are six hundred
// frames here. One decoded bitmap, one request.
//
// Why the frames are trimmed and anchored here rather than at draw time: the
// pack's frames are tight crops of the ink, so a hoe sticking out to the left
// widens the bitmap and shifts the body. Centring the bitmap would make the
// farmer lurch sideways every time the tool swings. Each frame therefore
// carries the x of its FEET (the centre of the bottom rows of ink), and the
// renderer plants that point on the ground. Feet are always the bottom row.
//
// Filename grammar (the pack is not perfectly consistent, so this is loose):
//   <character>_<anim>_<n>.png     farm_1_action_2, mine_woman_1_walk_1
//   <character>_<anim><n>.png      cow01_walk3, chicken01_idle1
//   <character>_<anim>_<nn>.png    bard_attack_01, ra_walking_01
//   <character>_<n>.png            guard_bow_1 — no anim tag: it is the idle
//   "<file> 1.png"                 a Finder duplicate; skipped
// `walk_idle` is the pack's name for idle on one character; it is folded in.
//
// Not in `prebuild`: needs ImageMagick, which CI doesn't have. Outputs are
// committed and the generator is run by hand — same rule as ui-atlas.mjs.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'Docs/art/characters');
const OUT_DIR = join(ROOT, 'src/render/characters');

/** Atlas width. Shelves grow downward as needed. */
const ATLAS_W = 1024;
/** Empty pixels between frames. Integer nearest-neighbour scaling never
 *  samples outside a source rect, so this is belt-and-braces. */
const PAD = 1;
/** Rows of ink, from the bottom, that count as "the feet". Legs spread in a
 *  walk frame, so this is wider than the ankle and narrower than the torso. */
const FEET_ROWS = 5;

const ANIM_ALIAS = { walk_idle: 'idle', walking: 'walk' };

const fail = (msg) => {
  console.error(`char-atlas: ${msg}`);
  process.exit(1);
};
const magick = (...args) =>
  execFileSync('magick', args.map(String), { encoding: 'utf8', maxBuffer: 1 << 26 }).trim();

// ------------------------------------------------------------------ naming

/** "farm_1_action_2.png" → { character: 'farm_1', anim: 'action', n: 2 }, or
 *  null for a file the atlas does not want. */
function parseName(file) {
  if (!file.endsWith('.png')) return null;
  if (/ 1\.png$/.test(file)) return null; // Finder duplicate of the real file
  const stem = file.slice(0, -4);
  const m = /^(.*?)_?(idle|walk_idle|walking|walk|attack|action|singing)_?(\d+)$/.exec(stem);
  if (m) {
    const anim = ANIM_ALIAS[m[2]] ?? m[2];
    return { character: m[1], anim, n: Number(m[3]) };
  }
  const bare = /^(.*)_(\d+)$/.exec(stem);
  if (bare) return { character: bare[1], anim: 'idle', n: Number(bare[2]) };
  return null;
}

// ---------------------------------------------------------------- measuring

/** "WxH+X+Y" → {w,h,x,y}. */
function parseBox(s) {
  const m = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(s);
  if (!m) return null;
  const [w, h, x, y] = m.slice(1).map(Number);
  return w === 0 || h === 0 ? null : { w, h, x, y };
}

/**
 * Two batched ImageMagick calls for the whole directory — one per frame would
 * be six hundred process spawns.
 *   1. the ink box of every file, in file coordinates;
 *   2. the ink box of the bottom FEET_ROWS rows of every TRIMMED file, so the
 *      feet centre comes out relative to the trimmed frame.
 */
function measure(files) {
  const paths = files.map((f) => join(SRC_DIR, f));
  const boxes = new Map();
  for (const line of magick('identify', '-format', '%f %w %h %@\n', ...paths).split('\n')) {
    const [f, w, h, box] = line.split(' ');
    boxes.set(f, { w: Number(w), h: Number(h), ink: parseBox(box) });
  }
  const feet = new Map();
  const out = magick(
    ...paths, '-trim', '+repage', '-gravity', 'south', '-crop', `x${FEET_ROWS}+0+0`, '+repage',
    '-format', '%f %@\n', 'info:',
  );
  for (const line of out.split('\n')) {
    const [f, box] = line.split(' ');
    feet.set(f, parseBox(box));
  }
  return files.map((f) => {
    const b = boxes.get(f);
    if (!b?.ink) fail(`${f}: the frame is empty`);
    const ft = feet.get(f);
    // Feet centre, relative to the trimmed frame. A frame whose bottom rows
    // measured empty (cannot happen after a trim, but be safe) centres.
    const ax = ft ? ft.x + ft.w / 2 : b.ink.w / 2;
    return { file: f, src: b.ink, w: b.ink.w, h: b.ink.h, ax: Math.round(ax) };
  });
}

// ------------------------------------------------------------------ packing

/** Shelf packing: tallest first, left to right, new shelf when the row is
 *  full. Not optimal, but frames are all about the same size and the result
 *  is deterministic — a clean diff on regeneration. */
function pack(frames) {
  const order = [...frames].sort((a, b) => b.h - a.h || a.file.localeCompare(b.file));
  let x = PAD;
  let y = PAD;
  let shelfH = 0;
  for (const f of order) {
    if (x + f.w + PAD > ATLAS_W) {
      x = PAD;
      y += shelfH + PAD;
      shelfH = 0;
    }
    f.x = x;
    f.y = y;
    x += f.w + PAD;
    shelfH = Math.max(shelfH, f.h);
  }
  return y + shelfH + PAD;
}

function writeAtlas(frames, height) {
  const args = ['-size', `${ATLAS_W}x${height}`, 'xc:none'];
  for (const f of frames) {
    args.push(
      '(', join(SRC_DIR, f.file), '-crop', `${f.src.w}x${f.src.h}+${f.src.x}+${f.src.y}`, '+repage', ')',
      '-geometry', `+${f.x}+${f.y}`, '-composite',
    );
  }
  args.push(
    // Hard pixel edges, and a palette-mode source comes out RGBA like the rest.
    '-channel', 'A', '-threshold', '50%', '+channel',
    '-strip', '-define', 'png:exclude-chunk=date,time',
    join(OUT_DIR, 'atlas.png'),
  );
  magick(...args);
}

// --------------------------------------------------------------- generating

/** frames → { character: { anim: [frame, ...] } }, frames in numeric order. */
function group(frames) {
  const chars = new Map();
  for (const f of frames) {
    const anims = chars.get(f.name.character) ?? new Map();
    chars.set(f.name.character, anims);
    const list = anims.get(f.name.anim) ?? [];
    anims.set(f.name.anim, list);
    list.push(f);
  }
  for (const anims of chars.values()) {
    for (const list of anims.values()) list.sort((a, b) => a.name.n - b.name.n);
  }
  return chars;
}

function writeTs(chars, height) {
  const lines = [];
  for (const name of [...chars.keys()].sort()) {
    lines.push(`  ${JSON.stringify(name)}: {`);
    const anims = chars.get(name);
    for (const anim of [...anims.keys()].sort()) {
      const frames = anims.get(anim).map((f) => `[${f.x}, ${f.y}, ${f.w}, ${f.h}, ${f.ax}]`);
      lines.push(`    ${anim}: [${frames.join(', ')}],`);
    }
    lines.push('  },');
  }
  writeFileSync(join(OUT_DIR, 'atlas.generated.ts'), `// GENERATED by scripts/char-atlas.mjs — do not edit.
//
// DOM-free on purpose: tests/characters.test.ts imports this under Vitest's
// node environment to check that every character the renderer casts exists.

/** One animation frame: its rect in atlas.png, and \`ax\`, the x of the feet
 *  within that rect. Feet are the bottom row — plant (x + ax, y + h) on the
 *  ground. */
export type CharFrame = readonly [x: number, y: number, w: number, h: number, ax: number];

export const CHAR_ATLAS_W = ${ATLAS_W};
export const CHAR_ATLAS_H = ${height};

export const CHARACTERS: Readonly<Record<string, Readonly<Record<string, readonly CharFrame[]>>>> = {
${lines.join('\n')}
};
`);
}

/** Every character, every animation, playing — the visual gate before any of
 *  it is wired. Works over file:// or, since Vite serves the repo root,
 *  http://localhost:5173/Docs/art/characters/contact.html */
function writeContact(chars) {
  const data = {};
  for (const [name, anims] of chars) {
    data[name] = {};
    for (const [anim, frames] of anims) data[name][anim] = frames.map((f) => [f.x, f.y, f.w, f.h, f.ax]);
  }
  writeFileSync(join(SRC_DIR, 'contact.html'), `<!doctype html>
<meta charset="utf-8"><title>Kingdom characters — contact sheet</title>
<!-- GENERATED by scripts/char-atlas.mjs. -->
<style>
  body { margin:0; padding:24px; background:#3c6e3c; color:#F4E4C1; font:12px system-ui; }
  h1 { font-size:16px; letter-spacing:.08em; text-transform:uppercase; color:#F2B233; }
  .grid { display:flex; flex-wrap:wrap; gap:12px; }
  .char { background:#2f5a2f; border-radius:6px; padding:6px; }
  .char b { display:block; margin-bottom:4px; font-size:11px; }
  .anims { display:flex; gap:6px; }
  .anim { text-align:center; opacity:.85; font-size:10px; }
  canvas { display:block; image-rendering:pixelated; margin:0 auto 2px; }
</style>
<h1>${chars.size} characters</h1>
<div class="grid" id="grid"></div>
<script>
const DATA = ${JSON.stringify(data)};
const SCALE = 3, MS = { idle: 500, walk: 220, action: 250, attack: 120 };
const img = new Image(); img.src = '../../../src/render/characters/atlas.png';
const cells = [];
const grid = document.getElementById('grid');
for (const [name, anims] of Object.entries(DATA)) {
  const box = document.createElement('div'); box.className = 'char';
  box.innerHTML = '<b>' + name + '</b><div class="anims"></div>';
  for (const [anim, frames] of Object.entries(anims)) {
    const w = Math.max(...frames.map((f) => f[2])), h = Math.max(...frames.map((f) => f[3]));
    const c = document.createElement('canvas'); c.width = (w + 2) * SCALE; c.height = (h + 2) * SCALE;
    const cell = document.createElement('div'); cell.className = 'anim';
    cell.appendChild(c); cell.append(anim + ' ×' + frames.length);
    box.querySelector('.anims').appendChild(cell);
    cells.push({ c, frames, ms: MS[anim] ?? 300 });
  }
  grid.appendChild(box);
}
function tick(t) {
  for (const { c, frames, ms } of cells) {
    const [x, y, w, h, ax] = frames[Math.floor(t / ms) % frames.length];
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    const feetX = c.width / 2, feetY = c.height - SCALE;
    ctx.drawImage(img, x, y, w, h, feetX - ax * SCALE, feetY - h * SCALE, w * SCALE, h * SCALE);
    ctx.fillStyle = '#F2B233'; ctx.fillRect(feetX - 1, feetY - 1, 3, 3);
  }
  requestAnimationFrame(tick);
}
img.onload = () => requestAnimationFrame(tick);
</script>
`);
}

// ------------------------------------------------------------------ command

const mode = process.argv[2] ?? 'build';
if (!existsSync(SRC_DIR)) fail(`${SRC_DIR} not found`);

const all = readdirSync(SRC_DIR).filter((f) => f.endsWith('.png')).sort();
const named = [];
const skipped = [];
for (const file of all) {
  const name = parseName(file);
  if (name) named.push({ file, name });
  else skipped.push(file);
}
if (named.length === 0) fail('no frames found');

if (mode === 'check') {
  const chars = group(named.map((n) => ({ ...n })));
  for (const name of [...chars.keys()].sort()) {
    const anims = chars.get(name);
    const desc = [...anims.entries()].map(([a, fs]) => `${a}×${fs.length}`).join(' ');
    console.log(`char-atlas: ${name.padEnd(28)} ${desc}`);
  }
  console.log(`char-atlas: ${chars.size} characters, ${named.length} frames, ${skipped.length} skipped`);
  if (skipped.length) console.log(`char-atlas:   skipped ${skipped.join(' ')}`);
  process.exit(0);
}

if (mode === 'build') {
  mkdirSync(OUT_DIR, { recursive: true });
  const measured = measure(named.map((n) => n.file));
  const frames = measured.map((m, i) => ({ ...m, name: named[i].name }));
  const height = pack(frames);
  writeAtlas(frames, height);
  const chars = group(frames);
  writeTs(chars, height);
  writeContact(chars);
  console.log(
    `char-atlas: ${chars.size} characters, ${frames.length} frames → ${ATLAS_W}x${height} atlas` +
    (skipped.length ? ` (${skipped.length} files skipped: ${skipped.join(' ')})` : ''),
  );
  console.log('char-atlas: open Docs/art/characters/contact.html before wiring anything');
  process.exit(0);
}

fail(`unknown command "${mode}" — expected build or check`);
