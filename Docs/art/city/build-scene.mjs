// Builds scene.html — the isometric coherence check for the city set.
//
// Reads manifest.json, sees which sprites actually exist, and writes a
// self-contained page that lays every building on a real 2:1 isometric grid
// using the SAME maths the renderer will use (Docs/art/art-direction.md §3).
// Sprites are referenced by relative path, so the page works over file://.
//
//   node Docs/art/city/build-scene.mjs
//
// Re-run it after every new sprite lands: what is missing shows as a dashed
// footprint, so the page doubles as the progress board.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const M = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'));
const { tileW: TW, tileH: TH } = M;
const HEADROOM = { '1x1': 128, '2x1': 128, '1x2': 128, '2x2': 192, '3x3': 256 };

const ground = (w, h) => [(TW / 2) * (w + h), (TH / 2) * (w + h)];
const headroom = (w, h) => HEADROOM[`${w}x${h}`] ?? 128;

/** Screen position of a cell's centre — the renderer's own formula. */
const cell = (x, y) => [(x - y) * (TW / 2), (x + y) * (TH / 2)];

/** Where a footprint's sprite goes: its anchor sits on the plot's centre. */
function place(b, cx, cy) {
  const [gw, gh] = ground(b.w, b.h);
  const canvasH = gh + headroom(b.w, b.h);
  const mx = cx + (b.w - 1) / 2, my = cy + (b.h - 1) / 2;
  const [px, py] = cell(mx, my);
  return { left: px - gw / 2, top: py - (canvasH - gh / 2), w: gw, h: canvasH, px, py, gw, gh };
}

const buildings = M.buildings.map(b => ({ ...b, has: existsSync(join(HERE, b.file)) }));
const TIER_LIST = [1, 4, 8];
const tierCount = buildings.reduce((n, b) => n + TIER_LIST.filter(lv =>
  existsSync(join(HERE, b.file.replace('_l1.png', `_l${lv}.png`)))).length, 0);
const tierTotal = buildings.reduce((n, b) => n + (b.w === 1 && b.h === 1 && b.deco ? 1 : 0), 0);
const expected = buildings.reduce((n, b) => n + (b.deco ? 1 : 3), 0);
const done = buildings.filter(b => b.has).length;

// ── two layouts ────────────────────────────────────────────────────────────
// Showcase: each building on its OWN patch of ground, arranged in screen-space
// rows so they can be scanned and compared side by side. Laying them on one
// iso grid spreads them across a 2,000px diamond, which compares nothing.
function showcase() {
  const TIERS = [1, 4, 8];
  return buildings.map(b => {
    const [gw, gh] = ground(b.w, b.h);
    const canvasH = gh + headroom(b.w, b.h);
    const tiles = [];
    for (let x = 0; x < b.w; x++) for (let y = 0; y < b.h; y++) {
      const px = (x - y) * (TW / 2) + gw / 2 - ((b.w - 1) - (b.h - 1)) * (TW / 4);
      const py = (x + y) * (TH / 2) + canvasH - gh / 2 - ((b.w - 1) + (b.h - 1)) * (TH / 4);
      tiles.push(`<path class="t on" d="M${px} ${py - TH / 2}l${TW / 2} ${TH / 2}l${-TW / 2} ${TH / 2}l${-TW / 2} ${-TH / 2}z"/>`);
    }
    const plot = `<svg class="grid" width="${gw}" height="${canvasH}">${tiles.join('')}</svg>`;
    const cells = TIERS.map(lv => {
      const file = b.file.replace('_l1.png', `_l${lv}.png`);
      const has = existsSync(join(HERE, file));
      // a tier the building does not own yet falls back the way the renderer
      // does: the highest tier at or below it
      const art = has
        ? `<img src="${file}" alt="${b.label} ${lv}" width="${gw}" height="${canvasH}">`
        : `<div class="miss" style="width:${gw}px;height:${gh}px"><span>l${lv}</span></div>`;
      return `<div class="tier${has ? '' : ' todo'}">
        <div class="slot" style="width:${gw}px;height:${canvasH}px">${plot}${art}</div>
        <span class="lv">L${lv}</span></div>`;
    }).join('');
    return `<section class="row">
      <h3>${b.label}<em>${b.w}×${b.h}${b.deco ? ' · decoration' : ''}</em></h3>
      <div class="tiers">${cells}</div>
    </section>`;
  }).join('');
}

// Village: packed the way a player would build, to catch collisions.
function village() {
  const spots = [
    ['Townhall', 6, 6], ['Housing', 5, 4], ['Housing', 6, 4], ['Housing', 7, 4],
    ['Housing', 4, 5], ['Housing', 4, 6], ['Farm', 9, 5], ['Sawmill', 9, 7],
    ['Quarry', 4, 9], ['Sanctum', 8, 9], ['Barracks', 6, 10], ['SpearHall', 7, 10],
    ['ShootingGrounds', 8, 11], ['Stables', 9, 11], ['Infirmary', 5, 11],
    ['Carpenter', 11, 5], ['MasonsYard', 11, 7], ['Smelter', 11, 9],
    ['RuneCarver', 10, 3], ['Docks', 2, 8], ['Plaza', 8, 6], ['Shrine', 2, 11],
    ['Orchard', 12, 3], ['Garden', 5, 8], ['Well', 7, 8], ['Statue', 6, 8],
  ];
  const by = Object.fromEntries(buildings.map(b => [b.id, b]));
  return spots.filter(([id]) => by[id]).map(([id, cx, cy]) => ({ b: by[id], cx, cy }));
}

function render(items, withLabels) {
  const placed = items.map(it => ({ ...it, p: place(it.b, it.cx, it.cy) }));
  placed.sort((a, c) => (a.cx + a.cy) - (c.cx + c.cy));           // painter's algorithm
  const xs = placed.flatMap(p => [p.p.left, p.p.left + p.p.w]);
  const ys = placed.flatMap(p => [p.p.top, p.p.top + p.p.h]);
  const pad = 140;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  const W = Math.max(...xs) - minX + pad, H = Math.max(...ys) - minY + pad;

  // the ground: one diamond per occupied cell, plus a ring of bare ones
  const cells = new Set();
  for (const { b, cx, cy } of items)
    for (let x = cx - 1; x <= cx + b.w; x++)
      for (let y = cy - 1; y <= cy + b.h; y++) cells.add(`${x},${y}`);
  const tiles = [...cells].map(k => {
    const [x, y] = k.split(',').map(Number);
    const [px, py] = cell(x, y);
    const on = items.some(({ b, cx, cy }) => x >= cx && x < cx + b.w && y >= cy && y < cy + b.h);
    return `<path class="t${on ? ' on' : ''}" d="M${px - minX} ${py - minY - TH / 2}l${TW / 2} ${TH / 2}l${-TW / 2} ${TH / 2}l${-TW / 2} ${-TH / 2}z"/>`;
  }).join('');

  const sprites = placed.map(({ b, p }) => {
    const L = p.left - minX, T = p.top - minY;
    if (!b.has) return `<div class="miss" style="left:${p.px - minX - p.gw / 2}px;top:${p.py - minY - p.gh / 2}px;width:${p.gw}px;height:${p.gh}px"><span>${b.label}</span></div>`;
    const lab = withLabels ? `<figcaption>${b.label}<em>${b.w}×${b.h}</em></figcaption>` : '';
    return `<figure style="left:${L}px;top:${T}px;width:${p.w}px"><img src="${b.file}" alt="${b.label}" width="${p.w}" height="${p.h}">${lab}</figure>`;
  }).join('');

  return `<div class="stage" style="width:${W}px;height:${H}px">
<svg class="grid" width="${W}" height="${H}">${tiles}</svg>${sprites}</div>`;
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Kingdom — isometric city set</title>
<style>
:root{--bg:#f3efe6;--ink:#241f18;--dim:#7d7365;--line:rgba(60,48,32,.20);
      --t:#cfe3a8;--t2:#bcd694;--card:#fffdf8;--edge:rgba(60,48,32,.14);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){
  --bg:#17140f;--ink:#f0e9dc;--dim:#9b9083;--line:rgba(255,255,255,.14);
  --t:#3c4a2c;--t2:#334024;--card:#211d16;--edge:rgba(255,255,255,.10);color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
     font:14px/1.5 ui-sans-serif,system-ui,'PT Sans',sans-serif}
header{position:sticky;top:0;z-index:5;padding:14px 20px;background:var(--card);
       border-bottom:1px solid var(--edge);display:flex;gap:18px;align-items:baseline;flex-wrap:wrap}
h1{margin:0;font-size:16px;font-weight:650;letter-spacing:-.01em}
.meta{color:var(--dim);font-size:12.5px}
.ctl{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
button{font:inherit;font-size:12.5px;padding:5px 11px;border:1px solid var(--edge);
       border-radius:7px;background:transparent;color:var(--dim);cursor:pointer}
button[aria-pressed=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
main{padding:24px 20px 80px;overflow-x:auto}
.stage{position:relative;margin:0 auto;transform-origin:top left}
.rows{display:flex;flex-direction:column;gap:36px;max-width:980px;margin:0 auto}
.row h3{margin:0 0 10px;font-size:15px;font-weight:650;display:flex;gap:10px;align-items:baseline;
        border-bottom:1px solid var(--edge);padding-bottom:7px}
.row h3 em{font-style:normal;font-weight:400;font-size:12px;color:var(--dim)}
.tiers{display:flex;gap:26px;align-items:flex-end;flex-wrap:wrap}
.tier{display:flex;flex-direction:column;align-items:center;gap:6px}
.tier.todo{opacity:.55}
.lv{font-size:11px;letter-spacing:.06em;color:var(--dim)}
.card{position:relative;margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}
.slot{position:relative}
.slot img{position:absolute;inset:0}
.card figcaption{position:static;transform:none;bottom:auto}
.grid{position:absolute;inset:0;pointer-events:none}
.t{fill:var(--t);stroke:var(--line);stroke-width:1}
.t.on{fill:var(--t2)}
body.nogrid .t{fill:none;stroke:none}
body.wire .t{fill:none;stroke:var(--line)}
figure{position:absolute;margin:0}
figure img{display:block;width:100%;height:auto;image-rendering:auto}
figcaption{position:absolute;left:50%;transform:translateX(-50%);bottom:-26px;
           white-space:nowrap;font-size:11.5px;color:var(--dim);text-align:center}
figcaption em{display:block;font-style:normal;font-size:10px;opacity:.65}
body.nolabel figcaption{display:none}
.miss{position:absolute;border:1.5px dashed var(--line);
      display:grid;place-items:center;border-radius:2px;
      clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
.miss span{font-size:10px;color:var(--dim);opacity:.8}
footer{padding:0 20px 40px;color:var(--dim);font-size:12.5px;max-width:64ch}
code{font-family:ui-monospace,monospace;font-size:.92em}
</style></head><body class="">
<header>
  <h1>Kingdom — the isometric city set</h1>
  <span class="meta">2:1 · tile 128×64 · <strong id="n">${tierCount}/${expected}</strong> sprites · tiers L1·L4·L8</span>
  <span class="ctl">
    <button id="m1" aria-pressed="true">Showcase</button>
    <button id="m2" aria-pressed="false">Village</button>
    <button id="g"  aria-pressed="true">Ground</button>
    <button id="l"  aria-pressed="true">Labels</button>
    <button id="z"  aria-pressed="false">Zoom ½</button>
  </span>
</header>
<main>
  <div id="v1" class="rows">${showcase()}</div>
  <div id="v2" hidden>${render(village(), false)}</div>
</main>
<footer>
  Every sprite is placed with the renderer's own formula —
  <code>screenX=(x−y)·64</code>, <code>screenY=(x+y)·32</code>, drawn in
  <code>x+y</code> order, anchored on its plot's ground diamond. A building that
  sits wrong here will sit wrong in the game. Dashed diamonds are footprints
  whose sprite has not been generated yet.
</footer>
<script>
const $=id=>document.getElementById(id), B=document.body;
const tog=(el,cls)=>{const on=el.getAttribute('aria-pressed')==='true';
  el.setAttribute('aria-pressed',String(!on));B.classList.toggle(cls,on)};
$('g').onclick=()=>tog($('g'),'nogrid');
$('l').onclick=()=>tog($('l'),'nolabel');
$('z').onclick=()=>{const on=$('z').getAttribute('aria-pressed')==='true';
  $('z').setAttribute('aria-pressed',String(!on));
  document.querySelectorAll('.stage').forEach(s=>s.style.transform=on?'':'scale(.5)')};
function mode(n){$('v1').hidden=n!==1;$('v2').hidden=n!==2;
  $('m1').setAttribute('aria-pressed',String(n===1));
  $('m2').setAttribute('aria-pressed',String(n===2))}
$('m1').onclick=()=>mode(1); $('m2').onclick=()=>mode(2);
</script></body></html>`;

writeFileSync(join(HERE, 'scene.html'), html);
console.log(`  scene.html  ${tierCount}/${expected} sprites (tramos L1/L4/L8)`);
for (const b of buildings.filter(x => !x.has)) console.log(`    falta ${b.file}`);
