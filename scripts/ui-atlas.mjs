// UI icon pipeline: ChatGPT sheets → one atlas + the code that indexes it.
//
//   node scripts/ui-atlas.mjs build            slice every sheet, pack, generate
//   node scripts/ui-atlas.mjs build --only ui-a   just that sheet
//   node scripts/ui-atlas.mjs check            verify the sheets, emit nothing
//   node scripts/ui-atlas.mjs contact          regenerate the contact sheet
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
//   * a generated grid is NOT centred on its canvas, so we crop to the
//     content bounding box FIRST and divide that — never the raw canvas;
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

/** Content must clear its cell edge by this much, or the grid has drifted. */
const BLEED_PX = 6;
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
 * The grid is derived from the CONTENT bounding box, not the canvas: a
 * generated sheet routinely sits off-centre (UI-A: 884×702 at 72,156 on a
 * 1024² canvas), and dividing the canvas would cut through the last row.
 */
function sliceSheet(sheet, cell, outDir) {
  const file = join(UI_DIR, sheet.file);
  if (!existsSync(file)) fail(`${sheet.file} not found`);
  const label = sheet.file;
  checkAlpha(file, label);

  const outer = contentBox(file);
  if (!outer) fail(`${label}: the sheet is empty`);
  const { rows, cols } = sheet.grid;
  const cw = Math.floor(outer.w / cols);
  const ch = Math.floor(outer.h / rows);
  console.log(
    `ui-atlas: ${label} content ${outer.w}x${outer.h} at (${outer.x},${outer.y}) ` +
    `→ ${cols}x${rows} cells of ${cw}x${ch}`,
  );

  // Pass 1: locate every icon, and find the largest so the whole sheet can
  // share one scale. Per-icon scaling would make the coin and the log stack
  // different visual weights, which is what makes a set look bought-in.
  const found = [];
  sheet.names.forEach((name, i) => {
    if (!name) return; // a deliberately empty cell
    const col = i % cols;
    const row = Math.floor(i / cols);
    const region = { w: cw, h: ch, x: outer.x + col * cw, y: outer.y + row * ch };
    const box = contentBox(file, region);
    if (!box) fail(`${label} [row ${row + 1}, col ${col + 1}] "${name}": the cell is empty`);

    // Bleed gate — but only on boundaries this cell SHARES with a neighbour.
    // The grid is cropped to the content bbox, so by construction the
    // topmost icon touches the top of it, the leftmost touches the left, and
    // so on; policing the outer rim would reject every correct sheet. What
    // actually matters is an icon leaking into the cell next door, which is
    // the only way trimming can pick up someone else's pixels.
    const clear = {
      left: col > 0 ? box.x - region.x : Infinity,
      top: row > 0 ? box.y - region.y : Infinity,
      right: col < cols - 1 ? region.x + region.w - (box.x + box.w) : Infinity,
      bottom: row < rows - 1 ? region.y + region.h - (box.y + box.h) : Infinity,
    };
    const tight = Object.entries(clear).filter(([, v]) => v < BLEED_PX);
    if (tight.length) {
      fail(
        `${label} [row ${row + 1}, col ${col + 1}] "${name}": content reaches the ` +
        `${tight.map(([k]) => k).join(' and ')} cell edge ` +
        `(clearance ${tight.map(([, v]) => v).join(',')}px, need ${BLEED_PX}). ` +
        'The grid drifted — regenerate the sheet, or set "gutter" in the manifest.',
      );
    }
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
if (sheets.length === 0) fail(`no sheet matches --only ${only}`);

if (mode === 'check') {
  for (const s of sheets) checkAlpha(join(UI_DIR, s.file), s.file);
  console.log(`ui-atlas: ${sheets.length} sheet(s) pass the alpha check`);
  process.exit(0);
}

if (mode === 'build') {
  mkdirSync(SLICES, { recursive: true });
  mkdirSync(OUT_ASSETS, { recursive: true });
  if (!only) rmSync(SLICES, { recursive: true, force: true });
  mkdirSync(SLICES, { recursive: true });

  for (const s of sheets) sliceSheet(s, cell, SLICES);

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
