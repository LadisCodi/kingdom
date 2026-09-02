// UI icon pipeline: ChatGPT sheets → one atlas + the code that indexes it.
//
//   node scripts/ui-atlas.mjs build            slice every sheet, pack, generate
//   node scripts/ui-atlas.mjs build --only ui-a   just that sheet
//   node scripts/ui-atlas.mjs check            verify the sheets, emit nothing
//   node scripts/ui-atlas.mjs contact          regenerate the contact sheet
//   node scripts/ui-atlas.mjs sprites          slice the WORLD sheets instead
//
// The `sprites` mode shares the band reading and the alpha check but emits
// something different: one 128px PNG per name straight into
// src/render/assets/, which sprites.ts picks up by filename stem. Map art is
// not atlas art — it is drawn at cell size onto the canvas, never inline — so
// it does not want packing, a shared 32px cell, or locked variants.
//
// Input:  Docs/art/ui/atlas.manifest.json + Docs/art/ui/sheets/*.png
// Output: Docs/art/ui/slices/*.png          per-icon, for review and git diffs
//         Docs/art/ui/contact.html          the visual gate
//         src/ui/assets/ui-atlas.png        the ONE shipped raster
//         src/ui/assets/ui-atlas.css        .icon-<name> background positions
//         src/ui/kit/atlas.generated.ts     ICON_INDEX + ATLAS_CELLS
//
// Not in `prebuild`: this needs ImageMagick, which CI doesn't have. Outputs
// are committed and the generator is run by hand.
//
// Why one atlas rather than ~70 files: Vite inlines anything under 4096 bytes,
// so individual icons would ALL become base64 inside a render-blocking
// stylesheet. The atlas clears the limit, gets a content hash, and is one
// decoded bitmap that CSS and canvas can share.
//
// Two things the sheets taught us (Docs/art/ui/CONVERSATION.md):
//   * a generated grid is neither centred on its canvas nor evenly spaced,
//     so the columns and rows are READ OFF the sheet by finding its gutters
//     rather than assumed from the canvas or from equal division;
//   * ChatGPT's image-editor download bakes the transparency checkerboard in
//     as opaque pixels, so alpha is checked by corner AND mean.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI_DIR = join(ROOT, 'Docs/art/ui');
const SLICES = join(UI_DIR, 'slices');
const OUT_ASSETS = join(ROOT, 'src/ui/assets');
const OUT_KIT = join(ROOT, 'src/ui/kit');
const MANIFEST = join(UI_DIR, 'atlas.manifest.json');

/** An empty run this wide counts as a gutter between icons rather than a gap
 *  inside one. Wide enough to survive a detached highlight, narrow enough to
 *  separate icons the generator placed close together. */
const GUTTER_PX = 12;
/** Below this fraction of the cell, an icon reads as a different set. */
const SCALE_WARN_LOW = 0.45;

const fail = (msg) => {
  console.error(`ui-atlas: ${msg}`);
  process.exit(1);
};
const magick = (...args) =>
  execFileSync('magick', args.map(String), { encoding: 'utf8', maxBuffer: 1 << 26 }).trim();

/** "WxH+X+Y" → {w,h,x,y}; null when the region is empty. */
function contentBox(file, region) {
  const args = [file];
  if (region) args.push('-crop', boxStr(region), '+repage');
  args.push('-alpha', 'extract', '-threshold', '10%', '-format', '%@', 'info:');
  let out;
  try {
    out = magick(...args);
  } catch {
    return null; // ImageMagick warns and exits non-zero on a fully blank region
  }
  const m = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(out);
  if (!m) return null;
  const [w, h, x, y] = m.slice(1).map(Number);
  // A crop-relative box needs the crop origin added back.
  return w === 0 || h === 0
    ? null
    : { w, h, x: x + (region?.x ?? 0), y: y + (region?.y ?? 0) };
}

const boxStr = (b) => `${b.w}x${b.h}+${b.x}+${b.y}`;

/**
 * Where the ink is along one axis: collapse the alpha channel to a single
 * row (or column) and read it back.
 */
function coverage(file, axis, length) {
  const geom = axis === 'x' ? `${length}x1!` : `1x${length}!`;
  const txt = magick(file, '-alpha', 'extract', '-resize', geom, '-depth', '8', 'txt:-');
  const values = new Array(length).fill(0);
  for (const line of txt.split('\n')) {
    const m = /^(\d+),(\d+):\s*\((\d+)/.exec(line);
    if (m) values[axis === 'x' ? Number(m[1]) : Number(m[2])] = Number(m[3]);
  }
  return values;
}

/**
 * Split an axis into bands of ink separated by empty gutters.
 *
 * This replaces dividing the sheet into equal cells, which assumed the
 * generator spaces its icons evenly — it does not. UI-D put the research
 * icon close enough to the settings cog that an equal quarter-width boundary
 * fell inside the book. Reading the actual gutters is both simpler and
 * exactly right: the sheet tells us where its columns are.
 */
function bands(values, minGap = 4) {
  const out = [];
  let start = null;
  let gap = 0;
  values.forEach((v, i) => {
    if (v > 2) {
      if (start === null) start = i;
      gap = 0;
    } else if (start !== null) {
      gap += 1;
      if (gap >= minGap) {
        out.push({ start, end: i - gap });
        start = null;
        gap = 0;
      }
    }
  });
  if (start !== null) out.push({ start, end: values.length - 1 });
  return out;
}

// ---------------------------------------------------------------- verifying

/**
 * Alpha has to be checked two ways. A sheet whose transparency was faked as a
 * painted checkerboard still reports a transparent corner if the very first
 * pixel happens to be a light square — the mean is what actually proves it.
 */
function checkAlpha(file, label) {
  const corner = magick(file, '-format', '%[pixel:p{0,0}]', 'info:');
  const mean = Number(magick(file, '-alpha', 'extract', '-format', '%[fx:mean]', 'info:'));
  const problems = [];
  if (!/^srgba?\(0,0,0,0\)$/.test(corner.replace(/\s/g, ''))) {
    problems.push(`corner is ${corner}, expected srgba(0,0,0,0)`);
  }
  if (!(mean < 0.5)) {
    problems.push(
      `alpha mean ${mean.toFixed(3)} — the sheet is opaque. This is what a baked-in ` +
      'checkerboard looks like: re-ask for the true-alpha correction, and take the ' +
      '"Download the corrected PNG" link in the message, NOT the image editor\'s ' +
      'download button (which exports what it displays).',
    );
  }
  if (problems.length) fail(`${label}: ${problems.join('; ')}`);
  return { corner, mean };
}

// ----------------------------------------------------------------- slicing

/**
 * Cut one sheet into named 32×32 cells.
 *
 * The grid comes from the sheet's own gutters. Two assumptions failed in a
 * row here: the grid is not centred on the canvas (UI-A sat at 72,156), and
 * it is not evenly spaced either (UI-D's book nearly touched the cog).
 * Finding the empty columns and rows is immune to both.
 */
function sliceSheet(sheet, cell, outDir) {
  const file = join(UI_DIR, sheet.file);
  if (!existsSync(file)) fail(`${sheet.file} not found`);
  const label = sheet.file;
  checkAlpha(file, label);

  const { rows, cols } = sheet.grid;
  const [w, h] = magick(file, '-format', '%wx%h', 'info:').split('x').map(Number);

  // Read the grid off the sheet instead of assuming even spacing.
  const colBands = bands(coverage(file, 'x', w), GUTTER_PX);
  const rowBands = bands(coverage(file, 'y', h), GUTTER_PX);
  if (colBands.length !== cols || rowBands.length !== rows) {
    fail(
      `${label}: found ${colBands.length} columns and ${rowBands.length} rows of ` +
      `icons, but the manifest says ${cols}x${rows}. Either the grid in the ` +
      'manifest is wrong, or two icons in a row are touching and read as one — ' +
      'regenerate asking for wider gaps.',
    );
  }
  console.log(
    `ui-atlas: ${label} ${cols}x${rows}, columns at ` +
    `${colBands.map((b) => `${b.start}-${b.end}`).join(' ')}`,
  );

  // Pass 1: locate every icon, and find the largest so the whole sheet can
  // share one scale. Per-icon scaling would make the coin and the log stack
  // different visual weights, which is what makes a set look bought-in.
  const found = [];
  sheet.names.forEach((name, i) => {
    if (!name) return; // a deliberately skipped cell
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cb = colBands[col];
    const rb = rowBands[row];
    const region = {
      x: cb.start, w: cb.end - cb.start + 1,
      y: rb.start, h: rb.end - rb.start + 1,
    };
    // The bands bound the whole column and row; this narrows to THIS icon.
    const box = contentBox(file, region);
    if (!box) fail(`${label} [row ${row + 1}, col ${col + 1}] "${name}": the cell is empty`);
    found.push({ name, box, row, col });
  });

  // Pass 2: one scale for the sheet, then render each onto an exact cell.
  const largest = Math.max(...found.map((f) => Math.max(f.box.w, f.box.h)));
  const scale = (cell * (sheet.fill ?? 0.88)) / largest;
  const report = [];
  for (const f of found) {
    const w = Math.max(1, Math.round(f.box.w * scale));
    const h = Math.max(1, Math.round(f.box.h * scale));
    const out = join(outDir, `${f.name}.png`);
    magick(
      '-size', `${cell}x${cell}`, 'xc:none',
      '(', file, '-crop', boxStr(f.box), '+repage', '-filter', 'point', '-resize', `${w}x${h}!`, ')',
      '-gravity', 'center', '-composite',
      // Hard pixel edges: a soft alpha fringe looks wrong at every scale.
      '-channel', 'A', '-threshold', '50%', '+channel',
      '-strip', '-define', 'png:exclude-chunk=date,time',
      out,
    );
    const extent = Math.max(w, h) / cell;
    report.push({ name: f.name, extent });
  }

  // Scale consistency: this is how you catch "the fish came out three times
  // bigger than the coin" before it reaches the atlas.
  for (const r of report.sort((a, b) => a.extent - b.extent)) {
    const pct = (r.extent * 100).toFixed(0);
    if (r.extent < SCALE_WARN_LOW) {
      console.log(`ui-atlas:   ! ${r.name} fills only ${pct}% of its cell`);
    }
  }
  return found.map((f) => f.name);
}

/**
 * Slice a sheet that is ALREADY a pixel grid.
 *
 * `sliceSheet` above exists for generated sheets: it hunts for gutters, trims
 * each icon to its ink, and rescales the whole sheet to one visual weight,
 * because a model cannot be trusted to place or size anything. A hand-authored
 * pack is the opposite problem — the grid is exact, the sizing is already
 * consistent, and the placement inside each cell is a decision the artist made.
 * Trimming would throw that away, and the refit would land on a fractional
 * scale, which is how pixel art turns to mush.
 *
 * So this one does almost nothing: take the cell as drawn, point-scale it by a
 * whole number, keep the alpha hard. The integer check is the whole safety
 * net — a dense sheet whose size does not divide the atlas cell is a mistake,
 * not something to round.
 */
function sliceDenseSheet(sheet, cell, outDir) {
  const file = join(UI_DIR, sheet.file);
  if (!existsSync(file)) fail(`${sheet.file} not found`);
  const src = sheet.dense.size;
  if (cell % src !== 0) {
    fail(`${sheet.file}: ${src}px cells do not divide the ${cell}px atlas cell, so every ` +
      'icon would be resampled off-grid. Change the atlas cell, not the art.');
  }
  const [w, h] = magick(file, '-format', '%wx%h', 'info:').split('x').map(Number);
  const cols = sheet.dense.cols ?? Math.floor(w / src);
  if (w % src || h % src) {
    fail(`${sheet.file}: ${w}x${h} is not a whole number of ${src}px cells`);
  }
  console.log(`ui-atlas: ${sheet.file} dense ${src}px x${cell / src}, ${cols} cols`);

  const out = [];
  sheet.names.forEach((name, i) => {
    if (!name) return; // a cell we deliberately do not ship
    const x = (i % cols) * src;
    const y = Math.floor(i / cols) * src;
    if (contentBox(file, { x, y, w: src, h: src }) === null) {
      fail(`${sheet.file} [${Math.floor(i / cols)},${i % cols}] "${name}": the cell is empty`);
    }
    const dest = join(outDir, `${name}.png`);
    // Slices are keyed by name, so a dense sheet listed after a generated one
    // replaces it. That is the point, but silent replacement is how a set ends
    // up half in one style — so say it out loud.
    if (existsSync(dest)) console.log(`ui-atlas:   overrides ${name}`);
    magick(
      file, '-crop', `${src}x${src}+${x}+${y}`, '+repage',
      '-filter', 'point', '-resize', `${cell}x${cell}`,
      '-channel', 'A', '-threshold', '50%', '+channel',
      '-strip', '-define', 'png:exclude-chunk=date,time',
      dest,
    );
    out.push(name);
  });
  return out;
}

/**
 * Slice a WORLD sheet into individual map sprites.
 *
 * Deliberately different from sliceSheet in three ways, all because these are
 * drawn on the map rather than inline in a menu:
 *   - the output is one file per name at `size`, not a packed cell;
 *   - each sprite is scaled to fill its own frame rather than sharing one
 *     sheet-wide scale, because a shrine and a chapel are genuinely different
 *     sizes on the ground and forcing them to one scale makes the small ones
 *     vanish at low zoom;
 *   - it sits on the SOUTH edge by default, so a building meets the tile it
 *     stands on. A sheet of held OBJECTS (relics, portraits) sets
 *     `gravity: "center"` instead — those are shown in a framed slot, not on
 *     the ground, and sinking them looks like a layout bug.
 */
function sliceWorldSheet(sheet, outDir, size) {
  const file = join(UI_DIR, sheet.file);
  if (!existsSync(file)) fail(`${sheet.file} not found`);
  checkAlpha(file, sheet.file);

  const { rows, cols } = sheet.grid;
  const [w, h] = magick(file, '-format', '%wx%h', 'info:').split('x').map(Number);
  const colBands = bands(coverage(file, 'x', w), GUTTER_PX);
  const rowBands = bands(coverage(file, 'y', h), GUTTER_PX);
  if (colBands.length !== cols || rowBands.length !== rows) {
    fail(
      `${sheet.file}: found ${colBands.length} columns and ${rowBands.length} rows, ` +
      `but the manifest says ${cols}x${rows}.`,
    );
  }
  console.log(`ui-atlas: ${sheet.file} ${cols}x${rows} → ${outDir}`);

  const written = [];
  sheet.names.forEach((name, i) => {
    if (!name) return;
    const cb = colBands[i % cols];
    const rb = rowBands[Math.floor(i / cols)];
    const region = {
      x: cb.start, w: cb.end - cb.start + 1,
      y: rb.start, h: rb.end - rb.start + 1,
    };
    const box = contentBox(file, region);
    if (!box) fail(`${sheet.file}: the cell for "${name}" is empty`);
    const fill = sheet.fill ?? 0.94;
    const scale = (size * fill) / Math.max(box.w, box.h);
    const sw = Math.max(1, Math.round(box.w * scale));
    const sh = Math.max(1, Math.round(box.h * scale));
    const out = join(outDir, `${name}.png`);
    magick(
      '-size', `${size}x${size}`, 'xc:none',
      '(', file, '-crop', boxStr(box), '+repage', '-filter', 'point', '-resize', `${sw}x${sh}!`, ')',
      '-gravity', sheet.gravity ?? 'south', '-composite',
      '-channel', 'A', '-threshold', '50%', '+channel',
      '-strip', '-define', 'png:exclude-chunk=date,time',
      out,
    );
    written.push(name);
  });
  return written;
}

// -------------------------------------------------------------- derivatives

/** Desaturate toward --locked. Derived, so the silhouette is identical and a
 *  row can't shift when an item locks. */
function deriveLocked(src, dest) {
  magick(
    src, '(', '+clone', '-alpha', 'extract', ')', '-alpha', 'off',
    '-modulate', '100,18', '-fill', '#CBBA96', '-colorize', '55%',
    '-compose', 'CopyOpacity', '-composite',
    '-channel', 'A', '-threshold', '50%', '+channel',
    '-strip', '-define', 'png:exclude-chunk=date,time', dest,
  );
}

/** Authored at 16 logical pixels and stored doubled, so the atlas grid stays
 *  uniform while the inline variant gets genuinely chunkier pixels. */
function deriveTiny(src, dest, cell) {
  magick(
    src, '-filter', 'point', '-resize', `${cell / 2}x${cell / 2}`,
    '-filter', 'point', '-resize', `${cell}x${cell}`,
    '-channel', 'A', '-threshold', '50%', '+channel',
    '-strip', '-define', 'png:exclude-chunk=date,time', dest,
  );
}

// ------------------------------------------------------------------ packing

function pack(names, cell, cols) {
  const rows = Math.ceil(names.length / cols);
  const args = ['-size', `${cols * cell}x${rows * cell}`, 'xc:none'];
  names.forEach((name, i) => {
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * cell;
    args.push('(', join(SLICES, `${name}.png`), ')', '-geometry', `+${x}+${y}`, '-composite');
  });
  args.push('-strip', '-define', 'png:exclude-chunk=date,time', join(OUT_ASSETS, 'ui-atlas.png'));
  magick(...args);
  return rows;
}

const GENERATED = '/* GENERATED by scripts/ui-atlas.mjs — do not edit. */';

function writeCss(names, cell, cols, rows) {
  const lines = names.map((name, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return `.icon-${name} { background-position: calc(var(--icon-size) * -${col}) ` +
      `calc(var(--icon-size) * -${row}); }`;
  });
  writeFileSync(join(OUT_ASSETS, 'ui-atlas.css'), `${GENERATED}
/* One atlas serves 16/32/64: the background scales by the same factor as the
 * cell, so cell (col,row) is always at -col x size, -row x size. */
.icon {
  background-image: url('./ui-atlas.png');
  background-repeat: no-repeat;
  background-size: calc(var(--icon-size) * ${cols}) calc(var(--icon-size) * ${rows});
  image-rendering: pixelated;
}
/* An atlas-backed icon has no text to show. */
.icon:not(.icon--emoji) { font-size: 0; }

${lines.join('\n')}
`);
}

function writeTs(names, cell, cols) {
  const entries = names.map((n, i) => `  '${n}': ${i},`).join('\n');
  writeFileSync(join(OUT_KIT, 'atlas.generated.ts'), `// GENERATED by scripts/ui-atlas.mjs — do not edit.
//
// DOM-free on purpose: tests/icons.test.ts imports this under Vitest's node
// environment to check that every currency and district has a cell.

export const ATLAS_CELL = ${cell};
export const ATLAS_COLS = ${cols};

export const ICON_INDEX = {
${entries}
} as const;

/** Cells the atlas actually provides. An icon absent from this set falls back
 *  to its emoji, so art can land one sheet at a time. */
export const ATLAS_CELLS: ReadonlySet<string> = new Set(Object.keys(ICON_INDEX));
`);
}

// ------------------------------------------------------------ contact sheet

function writeContact(names, cell) {
  const grounds = [
    ['parchment', '#F4E4C1', '#3B2412'],
    ['wood', '#A9713F', '#FFF6E0'],
    ['grass', '#7AC74F', '#2F5E1C'],
  ];
  const rowFor = (bg, fg, size) => `
  <div class="ground" style="background:${bg};color:${fg}">
    <span class="lbl">${size}px</span>
    ${names.map((n) => `<i class="icon icon-${n}" style="--icon-size:${size}px" title="${n}"></i>`).join('')}
  </div>`;
  writeFileSync(join(UI_DIR, 'contact.html'), `<!doctype html>
<meta charset="utf-8"><title>Kingdom UI icons — contact sheet</title>
<!-- GENERATED by scripts/ui-atlas.mjs.
     Loads the REAL tokens, the REAL kit CSS and the REAL atlas, so what you
     see here is what the game gets — the box model comes from kit.css, the
     background from the generated atlas CSS, and neither is duplicated.
     Works over file:// or, since Vite serves the repo root,
     http://localhost:5173/Docs/art/ui/contact.html -->
<link rel="stylesheet" href="../../../src/ui/styles/tokens.css">
<link rel="stylesheet" href="../../../src/ui/styles/kit.css">
<link rel="stylesheet" href="../../../src/ui/assets/ui-atlas.css">
<style>
  body { margin:0; padding:24px; background:#2b2119; color:#F4E4C1;
         font:14px system-ui; }
  h1 { font-size:16px; letter-spacing:.08em; text-transform:uppercase; color:#F2B233; }
  .ground { display:flex; flex-wrap:wrap; gap:8px; align-items:center;
            padding:10px; border-radius:8px; margin-bottom:8px; }
  .lbl { font-size:11px; text-transform:uppercase; opacity:.75; min-width:44px; }
  .icon { display:inline-block; }
  .names { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; font-size:11px; opacity:.7; }
</style>
<h1>${names.length} cells · ${cell}px</h1>
<!-- An icon that reads on parchment can vanish on wood. Check every ground. -->
${grounds.map(([, bg, fg]) => [16, 32, 64].map((s) => rowFor(bg, fg, s)).join('')).join('\n')}
<div class="names">${names.map((n) => `<span>${n}</span>`).join('')}</div>
`);
}

// ------------------------------------------------------------------ command

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const mode = process.argv[2] ?? 'build';
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg === -1 ? null : process.argv[onlyArg + 1];
const { cell, atlasCols: cols } = manifest;

const sheets = manifest.sheets.filter((s) => !only || s.file.includes(only));
const worldSheets = (manifest.worldSheets ?? []).filter((s) => !only || s.file.includes(only));
if (sheets.length === 0 && worldSheets.length === 0) fail(`no sheet matches --only ${only}`);

if (mode === 'check') {
  for (const s of [...sheets, ...worldSheets]) checkAlpha(join(UI_DIR, s.file), s.file);
  console.log(`ui-atlas: ${sheets.length + worldSheets.length} sheet(s) pass the alpha check`);
  process.exit(0);
}

if (mode === 'sprites') {
  if (worldSheets.length === 0) fail('no world sheets in the manifest');
  const outDir = join(ROOT, 'src/render/assets');
  const size = manifest.spriteSize ?? 128;
  const written = worldSheets.flatMap((s) => sliceWorldSheet(s, outDir, size));
  console.log(`ui-atlas: wrote ${written.length} map sprites to src/render/assets`);
  console.log(`ui-atlas:   ${written.join(' ')}`);
  process.exit(0);
}

if (mode === 'build') {
  mkdirSync(SLICES, { recursive: true });
  mkdirSync(OUT_ASSETS, { recursive: true });
  if (!only) rmSync(SLICES, { recursive: true, force: true });
  mkdirSync(SLICES, { recursive: true });

  for (const s of sheets) (s.dense ? sliceDenseSheet : sliceSheet)(s, cell, SLICES);

  // Derivatives, from what is on disk — so --only still rebuilds the atlas
  // from every sheet sliced so far.
  const base = readdirSync(SLICES)
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.slice(0, -4))
    .filter((n) => !n.endsWith('-locked') && !n.endsWith('-sm'));
  const lockedExcept = new Set(manifest.locked?.except ?? []);
  const tinyOnly = new Set(manifest.tiny?.only ?? []);
  for (const name of base) {
    if (!lockedExcept.has(name)) {
      deriveLocked(join(SLICES, `${name}.png`), join(SLICES, `${name}-locked.png`));
    }
    if (tinyOnly.has(name)) {
      deriveTiny(join(SLICES, `${name}.png`), join(SLICES, `${name}-sm.png`), cell);
    }
  }

  // Sorted → a deterministic layout → clean diffs on regeneration.
  const names = readdirSync(SLICES)
    .filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();
  const rows = pack(names, cell, cols);
  writeCss(names, cell, cols, rows);
  writeTs(names, cell, cols);
  writeContact(names, cell);
  console.log(
    `ui-atlas: ${names.length} cells → ${cols}x${rows} atlas` +
    ` (${base.length} drawn, ${names.length - base.length} derived)`,
  );
  console.log('ui-atlas: open Docs/art/ui/contact.html before wiring anything');
  process.exit(0);
}

if (mode === 'contact') {
  const names = readdirSync(SLICES)
    .filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();
  writeContact(names, cell);
  console.log(`ui-atlas: wrote contact.html (${names.length} cells)`);
  process.exit(0);
}

fail(`unknown command "${mode}" — expected build, check or contact`);
