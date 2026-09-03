// The map editor: ?dev=map.
//
// It replaces the game rather than sitting inside it. The game frames itself
// to a 9:16 phone, which is exactly the wrong shape for looking at a region,
// so this hides #app and takes the whole window.
//
// Everything it can do is a consequence of two choices:
//   - the document is validated by src/sim/data/mapRules.ts on every edit, so
//     the editor never has an opinion about legality that the build does not
//     share, and Save is simply disabled while errors stand;
//   - what it paints is derived through the game's own buildMapDataFrom(), so
//     the distances and fog prices on screen are the ones the player will pay.
//
// Saving POSTs to the dev-only Vite middleware in scripts/vite-map-editor.mjs,
// which writes src/sim/data/region-map.json. Writing that file is an HMR edit,
// so the page reloads right after a save — camera, tool and overlay state ride
// through it in sessionStorage, and the reload doubles as proof that what was
// written parses and loads.

import { Camera } from '../render/camera';
import { TILE_SIZE } from '../render/palette';
import { spriteUrl } from '../render/sprites';
import {
  ARTIFACT_ORDER, CURRENCIES, FEATURES, LANDMARK_ART, RUINS, UNIT_ORDER,
} from '../sim/data/definitions';
import regionMap from '../sim/data/region-map.json';
import {
  LANDMARK_KINDS, TERRAIN_IDS, type MapIssue, type RegionMapDoc,
} from '../sim/data/mapRules';
import { coordKey, type Coord, type FeatureId, type TerrainId } from '../sim/state';
import { MapDoc } from './doc';
import { drawEditor, type Overlays, type ViewState } from './render';
import './editor.css';

type Tool = 'paint' | 'rect' | 'fill' | 'pick' | 'sites';

/** What a click does while the Sites tool is up. Placing and removing a
 *  landmark used to be a bare `N` and a bare `Delete` — correct, discoverable
 *  by nobody. They are modes now, for the same reason terrain has swatches:
 *  the tool should say what a click is about to do. */
type SiteMode = 'select' | 'place' | 'erase';

type Brush =
  | { kind: 'terrain'; id: TerrainId }
  | { kind: 'feature'; id: FeatureId }
  | { kind: 'clearFeature' }
  | { kind: 'void' };

/** Currencies a delve can be provisioned in. Mana, Knowledge and Gems are not
 *  things you pack for a trip. */
const SUPPLY_CURRENCIES = ['Gold', 'Food', 'Wood', 'Stone'] as const;

/** A void flood-fill has no natural edge, so it gets an explicit one: the
 *  world's bounding box grown by this much. Painting past it is a brush job. */
const FILL_MARGIN = 6;
const FILL_LIMIT = 20_000;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: Array<Node | string>
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
};

interface Session {
  cam: { x: number; y: number; zoom: number };
  tool: Tool;
  siteMode: SiteMode;
  brush: Brush;
  brushSize: number;
  overlays: Overlays;
}

export function mountEditor(): void {
  document.getElementById('app')?.setAttribute('hidden', '');
  document.title = 'Kingdom — map editor';

  const doc = new MapDoc(regionMap as unknown as RegionMapDoc);

  // ------------------------------------------------------------- session
  const saved = readSession();
  let tool: Tool = saved?.tool ?? 'paint';
  let siteMode: SiteMode = saved?.siteMode ?? 'select';
  let brush: Brush = saved?.brush ?? { kind: 'terrain', id: 'Grassland' };
  let brushSize = saved?.brushSize ?? 1;
  const overlays: Overlays = saved?.overlays
    ?? { grid: true, distance: false, rings: false, warnings: true, sites: true };
  let selected: ViewState['selected'] = null;

  // ------------------------------------------------------------------ DOM
  const canvas = el('canvas', { class: 'ed-canvas' });
  const toolbar = el('div', { class: 'ed-toolbar' });
  const side = el('aside', { class: 'ed-side' });
  const status = el('footer', { class: 'ed-status' });
  const root = el('div', { class: 'ed-root' },
    toolbar,
    el('main', { class: 'ed-stage' }, canvas),
    side,
    status);
  document.body.append(root);

  const camera = new Camera(canvas);
  if (saved) { camera.x = saved.cam.x; camera.y = saved.cam.y; camera.zoom = saved.cam.zoom; }
  else fitToWorld(camera, canvas, doc);

  // ------------------------------------------------------------ gestures
  let panning = false;
  let painting = false;
  let spaceHeld = false;
  let rectFrom: Coord | null = null;
  let dragSite: { kind: 'landmark' | 'ruin'; id: string } | null = null;
  let hover: Coord | null = null;
  let lastPaint: Coord | null = null;
  let lastPointer = { x: 0, y: 0 };

  const cellAt = (e: PointerEvent | MouseEvent): Coord => {
    const rect = canvas.getBoundingClientRect();
    return camera.screenToCell(e.clientX - rect.left, e.clientY - rect.top);
  };

  const brushCells = (center: Coord): Coord[] => {
    const out: Coord[] = [];
    const r = Math.floor((brushSize - 1) / 2);
    const extra = (brushSize - 1) % 2;
    for (let dy = -r; dy <= r + extra; dy++) {
      for (let dx = -r; dx <= r + extra; dx++) out.push({ x: center.x + dx, y: center.y + dy });
    }
    return out;
  };

  const applyBrush = (cell: Coord): void => {
    for (const c of brushCells(cell)) {
      if (brush.kind === 'terrain') doc.setTerrain(c, brush.id);
      else if (brush.kind === 'void') doc.clearTerrain(c);
      else if (brush.kind === 'clearFeature') doc.clearFeature(c);
      else doc.setFeature(c, brush.id);
    }
  };

  /** Bresenham-ish: a fast drag must not leave gaps between sampled points. */
  const paintLine = (from: Coord, to: Coord): void => {
    const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    if (steps === 0) { applyBrush(to); return; }
    for (let i = 0; i <= steps; i++) {
      applyBrush({
        x: Math.round(from.x + ((to.x - from.x) * i) / steps),
        y: Math.round(from.y + ((to.y - from.y) * i) / steps),
      });
    }
  };

  const pickAt = (cell: Coord): void => {
    const feature = doc.featureAt(cell);
    const terrain = doc.terrainAt(cell);
    if (feature) brush = { kind: 'feature', id: feature };
    else if (terrain) brush = { kind: 'terrain', id: terrain };
    else brush = { kind: 'void' };
    refresh();
  };

  const floodFill = (origin: Coord): void => {
    if (brush.kind === 'clearFeature' || brush.kind === 'feature') {
      // Features fill over one terrain, not over one feature — "scatter trees
      // across this meadow" is the thing anyone actually wants here.
      const terrain = doc.terrainAt(origin);
      if (terrain === null) return;
      for (const c of region(origin, (p) => doc.terrainAt(p) === terrain)) {
        if (brush.kind === 'clearFeature') doc.clearFeature(c);
        else doc.setFeature(c, brush.id);
      }
      return;
    }
    const from = doc.terrainAt(origin);
    for (const c of region(origin, (p) => doc.terrainAt(p) === from)) {
      if (brush.kind === 'void') doc.clearTerrain(c);
      else doc.setTerrain(c, brush.id);
    }
  };

  /** 4-way connected cells matching `same`, bounded so a void fill terminates. */
  const region = (origin: Coord, same: (c: Coord) => boolean): Coord[] => {
    const bounds = worldBounds(doc);
    const seen = new Set<string>([coordKey(origin)]);
    const out: Coord[] = [origin];
    for (let i = 0; i < out.length && out.length < FILL_LIMIT; i++) {
      const c = out[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = { x: c.x + dx, y: c.y + dy };
        if (n.x < bounds.x0 || n.x > bounds.x1 || n.y < bounds.y0 || n.y > bounds.y1) continue;
        const key = coordKey(n);
        if (seen.has(key) || !same(n)) continue;
        seen.add(key);
        out.push(n);
      }
    }
    return out;
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    lastPointer = { x: e.clientX, y: e.clientY };
    const cell = cellAt(e);

    if (e.button === 1 || e.button === 2 || spaceHeld) { panning = true; return; }
    if (e.button !== 0) return;

    if (e.altKey || tool === 'pick') { pickAt(cell); return; }

    if (tool === 'sites') { clickSite(cell); return; }

    if (e.ctrlKey || e.metaKey || tool === 'fill') {
      doc.stroke(() => floodFill(cell));
      refresh();
      return;
    }

    if (tool === 'rect' || e.shiftKey) { rectFrom = cell; refresh(); return; }

    painting = true;
    lastPaint = cell;
    doc.begin();
    applyBrush(cell);
    refresh();
  });

  /** One click with the Sites tool, per mode. */
  const clickSite = (cell: Coord): void => {
    const hit = doc.siteAt(cell);

    if (siteMode === 'place') {
      // Landing a second site on an occupied cell is only ever a misclick —
      // it is a hard validation error — so it selects what is there instead.
      if (hit) { selected = hit; refresh(); return; }
      selected = { kind: 'landmark', id: doc.strokeResult(() => doc.addLandmark(cell)) };
      refresh();
      return;
    }

    if (siteMode === 'erase') {
      if (hit?.kind === 'landmark') {
        doc.stroke(() => doc.removeLandmark(hit.id));
        if (selected?.id === hit.id) selected = null;
      } else if (hit?.kind === 'ruin') {
        toast(`${hit.id} cannot be deleted — the five ruins are fixed in code.`, true);
      }
      refresh();
      return;
    }

    selected = hit;
    dragSite = hit;
    if (hit) doc.begin();
    refresh();
  };

  canvas.addEventListener('pointermove', (e) => {
    const cell = cellAt(e);
    const moved = hover === null || cell.x !== hover.x || cell.y !== hover.y;
    hover = cell;

    if (panning) {
      camera.panByScreen(e.clientX - lastPointer.x, e.clientY - lastPointer.y);
      lastPointer = { x: e.clientX, y: e.clientY };
      return; // the render loop is already running; no refresh needed
    }
    lastPointer = { x: e.clientX, y: e.clientY };

    if (dragSite && moved) {
      if (dragSite.kind === 'landmark') doc.moveLandmark(dragSite.id, cell);
      else doc.moveRuin(dragSite.id, cell);
      refresh();
      return;
    }
    if (painting && moved) {
      if (lastPaint) paintLine(lastPaint, cell);
      else applyBrush(cell);
      lastPaint = cell;
      refresh();
      return;
    }
    if (moved) updateStatus();
  });

  const endGesture = (e: PointerEvent) => {
    if (rectFrom && hover) {
      const cell = cellAt(e);
      doc.stroke(() => {
        for (const c of rectBetween(rectFrom!, cell)) {
          if (brush.kind === 'terrain') doc.setTerrain(c, brush.id);
          else if (brush.kind === 'void') doc.clearTerrain(c);
          else if (brush.kind === 'clearFeature') doc.clearFeature(c);
          else doc.setFeature(c, brush.id);
        }
      });
      rectFrom = null;
    }
    if (painting || dragSite) doc.commit();
    panning = false;
    painting = false;
    dragSite = null;
    lastPaint = null;
    refresh();
  };
  canvas.addEventListener('pointerup', endGesture);
  canvas.addEventListener('pointercancel', endGesture);
  canvas.addEventListener('pointerleave', () => { hover = null; updateStatus(); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    // Zoom about the pointer, not the screen centre — panning back after every
    // zoom is the difference between usable and infuriating.
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const before = camera.screenToCellExact(sx, sy);
    camera.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    const after = camera.screenToCellExact(sx, sy);
    camera.x += (before.x - after.x) * TILE_SIZE;
    camera.y += (before.y - after.y) * TILE_SIZE;
  }, { passive: false });

  // ------------------------------------------------------------ keyboard
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    const key = e.key.toLowerCase();
    if (key === ' ') { spaceHeld = true; e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && key === 's') { e.preventDefault(); void save(); return; }
    if ((e.ctrlKey || e.metaKey) && key === 'z') {
      e.preventDefault();
      if (e.shiftKey ? doc.redo() : doc.undo()) refresh();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); if (doc.redo()) refresh(); return; }
    if (e.ctrlKey || e.metaKey) return;

    const tools: Record<string, Tool> = { b: 'paint', r: 'rect', f: 'fill', i: 'pick', s: 'sites' };
    if (tools[key]) { tool = tools[key]; refresh(); return; }
    if (key >= '1' && key <= '5') { brushSize = Number(key); refresh(); return; }
    if (key === 'g') { overlays.grid = !overlays.grid; refresh(); return; }
    if (key === 'd') { overlays.distance = !overlays.distance; refresh(); return; }
    if (key === 'k') { overlays.rings = !overlays.rings; refresh(); return; }
    if (key === 'w') { overlays.warnings = !overlays.warnings; refresh(); return; }
    if (key === 'h') { overlays.sites = !overlays.sites; refresh(); return; }
    // N still places one wherever the pointer is, from any tool — the mode
    // buttons are the discoverable path, not the only one.
    if (key === 'n' && hover) {
      tool = 'sites';
      siteMode = 'place';
      clickSite(hover);
      return;
    }
    if ((key === 'delete' || key === 'backspace') && selected?.kind === 'landmark') {
      doc.stroke(() => doc.removeLandmark(selected!.id));
      selected = null;
      refresh();
    }
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') spaceHeld = false; });

  window.addEventListener('beforeunload', (e) => {
    // Only when the page is going away for a reason other than our own save.
    if (doc.dirty && !savingNow) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------------------------------------------------------------- save
  let savingNow = false;
  let toastTimer: number | null = null;

  const toast = (message: string, bad = false) => {
    document.querySelector('.ed-toast')?.remove();
    const node = el('div', { class: `ed-toast${bad ? ' bad' : ''}` }, message);
    document.body.append(node);
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => node.remove(), bad ? 8000 : 3000);
  };

  async function save(): Promise<void> {
    if (!doc.validation.ok) { toast('Fix the errors first — the map will not load.', true); return; }
    if (!doc.dirty) { toast('Nothing to save.'); return; }
    savingNow = true;
    try {
      const res = await fetch('/__map/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc.toJSON()),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      doc.markSaved();
      writeSession();
      savingNow = false;
      toast(`Saved — ${body.cells} cells written to region-map.json`);
    } catch (err) {
      savingNow = false;
      // The endpoint only exists under `npm run dev`. Anywhere else, hand the
      // file over rather than losing the work.
      toast(`Save failed (${String(err)}) — downloading the JSON instead.`, true);
      download(doc.toJSON());
    }
    refresh();
  }

  // -------------------------------------------------------------- panels
  function buildToolbar(): void {
    toolbar.replaceChildren();
    toolbar.append(el('div', { class: 'ed-brand' }, 'Kingdom · map'));

    const toolRow = el('div', { class: 'ed-tools' });
    const TOOLS: Array<[Tool, string, string]> = [
      ['paint', '✏️', 'Brush (B)'],
      ['rect', '▭', 'Rectangle (R) — or hold Shift'],
      ['fill', '🪣', 'Fill (F) — or hold Ctrl'],
      ['pick', '💧', 'Pick (I) — or hold Alt'],
      ['sites', '⛩', 'Sites (S)'],
    ];
    for (const [id, icon, title] of TOOLS) {
      const b = el('button', {
        class: `ed-tool${tool === id ? ' on' : ''}`, title, type: 'button',
      }, icon);
      b.onclick = () => { tool = id; refresh(); };
      toolRow.append(b);
    }
    toolbar.append(toolRow);

    if (tool === 'sites') {
      // The Sites tool has its own three verbs, and a brush size means nothing
      // to it, so that row goes away rather than sitting there inert.
      const MODES: Array<[SiteMode, string, string]> = [
        ['select', '⤧ Select & move', 'Click a site to inspect it, drag to move it'],
        ['place', '＋ Place landmark', 'Click any cell to drop a new landmark (N)'],
        ['erase', '🗑 Erase landmark', 'Click a landmark to delete it (or Delete when selected)'],
      ];
      const modeRow = el('div', { class: 'ed-modes' });
      for (const [id, label, title] of MODES) {
        const b = el('button', {
          class: `ed-mode${siteMode === id ? ` on ${id}` : ''}`, type: 'button', title,
        }, label);
        b.onclick = () => { siteMode = id; refresh(); };
        modeRow.append(b);
      }
      toolbar.append(el('div', { class: 'ed-label' }, 'Landmarks'), modeRow);
      if (siteMode === 'place') {
        toolbar.append(el('p', { class: 'ed-note' },
          'New landmarks arrive as an unnamed Shrine at 25,000 Gold — rename and price it here.'));
      }
      if (siteMode === 'erase') {
        toolbar.append(el('p', { class: 'ed-note' },
          'Ruins cannot be erased: the roster of five is fixed in code.'));
      }
    } else {
      const sizeRow = el('div', { class: 'ed-sizes' });
      for (const n of [1, 2, 3, 4, 5]) {
        const b = el('button', {
          class: `ed-size${brushSize === n ? ' on' : ''}`, type: 'button',
          title: `Brush ${n}×${n} (${n})`,
        }, String(n));
        b.onclick = () => { brushSize = n; refresh(); };
        sizeRow.append(b);
      }
      toolbar.append(el('div', { class: 'ed-label' }, 'Brush'), sizeRow);
    }

    toolbar.append(el('div', { class: 'ed-label' }, 'Terrain'));
    const terrainRow = el('div', { class: 'ed-swatches' });
    for (const id of TERRAIN_IDS) {
      terrainRow.append(swatch(
        `terrain_${id.toLowerCase()}`, id,
        brush.kind === 'terrain' && brush.id === id,
        () => { brush = { kind: 'terrain', id }; refresh(); },
      ));
    }
    terrainRow.append(swatch(null, 'Void — erase the cell', brush.kind === 'void',
      () => { brush = { kind: 'void' }; refresh(); }, '⌫'));
    toolbar.append(terrainRow);

    toolbar.append(el('div', { class: 'ed-label' }, 'Features'));
    const featureRow = el('div', { class: 'ed-swatches' });
    for (const [id, def] of Object.entries(FEATURES)) {
      featureRow.append(swatch(
        def.sprite, `${def.name} — ${def.respawnTerrain === 'Water' ? 'water only' : 'dry land'}`,
        brush.kind === 'feature' && brush.id === id,
        () => { brush = { kind: 'feature', id: id as FeatureId }; refresh(); },
      ));
    }
    featureRow.append(swatch(null, 'Clear the feature', brush.kind === 'clearFeature',
      () => { brush = { kind: 'clearFeature' }; refresh(); }, '✖'));
    toolbar.append(featureRow);

    toolbar.append(el('div', { class: 'ed-label' }, 'Overlays'));
    const overlayRow = el('div', { class: 'ed-overlays' });
    const OVERLAYS: Array<[keyof Overlays, string]> = [
      ['grid', 'Grid (G)'],
      ['distance', 'Distance & fog cost (D)'],
      ['rings', 'Ring bands (K)'],
      ['warnings', 'Problems (W)'],
      ['sites', 'Sites (H)'],
    ];
    for (const [id, title] of OVERLAYS) {
      const b = el('button', {
        class: `ed-toggle${overlays[id] ? ' on' : ''}`, type: 'button', title,
      }, title.replace(/ \(.\)$/, ''));
      b.onclick = () => { overlays[id] = !overlays[id]; refresh(); };
      overlayRow.append(b);
    }
    toolbar.append(overlayRow);
  }

  const swatch = (
    sprite: string | null, title: string, on: boolean, onPick: () => void, glyph = '',
  ): HTMLElement => {
    const url = sprite ? spriteUrl(sprite) : null;
    const b = el('button', { class: `ed-swatch${on ? ' on' : ''}`, title, type: 'button' });
    if (url) b.append(el('img', { src: url, alt: '' }));
    else b.append(el('span', {}, glyph || title.slice(0, 2)));
    // Reaching for a colour means you want to paint with it. Without this,
    // picking a swatch while the Sites tool is up arms a brush that the next
    // click will not use, which reads as the swatch being broken.
    b.onclick = () => { if (tool === 'sites' || tool === 'pick') tool = 'paint'; onPick(); };
    return b;
  };

  function buildSide(): void {
    side.replaceChildren();
    const { errors, warnings } = doc.validation;

    // Problems first: a designer who cannot save wants to know why without
    // scrolling past a census to find out.
    const problems = el('section', { class: 'ed-card' });
    problems.append(el('h2', {},
      errors.length > 0 ? `${errors.length} error${errors.length === 1 ? '' : 's'}`
        : warnings.length > 0 ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
          : 'No problems'));
    if (errors.length === 0 && warnings.length === 0) {
      problems.append(el('p', { class: 'ed-ok' }, 'The map validates. Save is live.'));
    }
    for (const issue of errors) problems.append(issueRow(issue, 'err'));
    for (const issue of warnings) problems.append(issueRow(issue, 'warn'));
    side.append(problems);

    if (selected) side.append(inspector(selected));
    side.append(censusCard());
  }

  const issueRow = (issue: MapIssue, cls: string): HTMLElement => {
    const row = el('button', { class: `ed-issue ${cls}`, type: 'button' }, issue.message);
    if (issue.cell) {
      row.onclick = () => {
        camera.centerOnCell(issue.cell!);
        hover = issue.cell!;
        updateStatus();
      };
    } else row.disabled = true;
    return row;
  };

  function inspector(sel: NonNullable<ViewState['selected']>): HTMLElement {
    const card = el('section', { class: 'ed-card' });
    if (sel.kind === 'landmark') {
      const l = doc.landmarks.find((x) => x.id === sel.id);
      if (!l) return card;
      card.append(el('h2', {}, 'Landmark'));
      card.append(field('id', textInput(l.id, (v) => {
        doc.stroke(() => doc.updateLandmark(l.id, { id: v }));
        selected = { kind: 'landmark', id: v };
        refresh();
      })));
      card.append(field('kind', select([...LANDMARK_KINDS], l.kind, (v) => {
        doc.stroke(() => doc.updateLandmark(l.id, { kind: v }));
        refresh();
      })));
      card.append(field('claim cost', numberInput(l.claimCost, (v) => {
        doc.stroke(() => doc.updateLandmark(l.id, { claimCost: v }));
        refresh();
      })));
      card.append(field('defended', checkbox(l.defended, (v) => {
        doc.stroke(() => doc.updateLandmark(l.id, { defended: v }));
        refresh();
      })));
      card.append(el('p', { class: 'ed-hint' },
        `at (${l.x}, ${l.y}) · ring ${doc.distanceAt(l)} · `
        + `${LANDMARK_ART[l.kind as keyof typeof LANDMARK_ART]?.name ?? l.kind}`));
      const remove = el('button', { class: 'ed-danger', type: 'button' }, 'Delete landmark');
      remove.onclick = () => {
        doc.stroke(() => doc.removeLandmark(l.id));
        selected = null;
        refresh();
      };
      card.append(remove);
      return card;
    }

    const r = doc.ruins[sel.id];
    if (!r) return card;
    const patch = (p: Parameters<MapDoc['updateRuin']>[1]) => {
      doc.stroke(() => doc.updateRuin(sel.id, p));
      refresh();
    };
    card.append(el('h2', {}, RUINS[sel.id as keyof typeof RUINS]?.name ?? sel.id));
    card.append(el('p', { class: 'ed-hint' },
      `${sel.id} · at (${r.x}, ${r.y}) · ring ${doc.distanceAt(r)}. `
      + 'The roster of five is fixed in code — a ruin can move and retune, not be added.'));
    card.append(field('tier', numberInput(r.tier, (v) => patch({ tier: v }))));
    card.append(field('difficulty', numberInput(r.difficulty, (v) => patch({ difficulty: v }))));
    card.append(field('base depth s', numberInput(r.baseDepthSeconds,
      (v) => patch({ baseDepthSeconds: v }))));
    card.append(field('depth growth', numberInput(r.depthGrowth,
      (v) => patch({ depthGrowth: v }), 0.01)));
    card.append(field('max depth', numberInput(r.maxDepth, (v) => patch({ maxDepth: v }))));
    card.append(field('affinity', select(['Any', ...UNIT_ORDER], r.affinity,
      (v) => patch({ affinity: v }))));
    card.append(field('artifact', select([...ARTIFACT_ORDER], r.artifact,
      (v) => patch({ artifact: v }))));
    card.append(el('div', { class: 'ed-label' }, 'Supplies'));
    for (const c of SUPPLY_CURRENCIES) {
      if (!(c in CURRENCIES)) continue;
      card.append(field(c.toLowerCase(), numberInput(r.supplies[c] ?? 0, (v) => {
        const supplies = { ...r.supplies };
        if (v > 0) supplies[c] = v; else delete supplies[c];
        patch({ supplies });
      })));
    }
    return card;
  }

  function censusCard(): HTMLElement {
    const c = doc.census;
    const card = el('section', { class: 'ed-card' });
    card.append(el('h2', {}, `${c.cells} cells`));

    const chips = el('div', { class: 'ed-chips' });
    for (const t of c.terrain) chips.append(el('span', { class: 'ed-chip' }, `${t.id} ${t.count}`));
    card.append(chips);

    const fchips = el('div', { class: 'ed-chips' });
    for (const f of c.features) {
      fchips.append(el('span', { class: 'ed-chip feat' }, `${FEATURES[f.id].name} ${f.count}`));
    }
    card.append(fchips);

    // Per ring, because "is there enough Wood before the player has to pay
    // 320 Gold a cell" is the question the spreadsheet could never answer.
    const table = el('table', { class: 'ed-table' });
    table.append(el('thead', {}, el('tr', {},
      el('th', {}, 'ring'), el('th', {}, 'gold'), el('th', {}, 'cells'), el('th', {}, 'features'))));
    const body = el('tbody');
    for (const row of c.rings) {
      const list = Object.entries(row.features)
        .map(([id, n]) => `${FEATURES[id as FeatureId].glyph}${n}`).join(' ');
      body.append(el('tr', {},
        el('td', {}, String(row.ring)),
        el('td', {}, String(row.cost)),
        el('td', {}, String(row.cells)),
        el('td', {}, list)));
    }
    table.append(body);
    card.append(table);
    return card;
  }

  function buildStatus(): void {
    status.replaceChildren();
    status.append(el('span', { class: 'ed-readout' }, readout()));

    const spacer = el('span', { class: 'ed-spacer' });
    const undo = el('button', { class: 'ed-btn', type: 'button', title: 'Ctrl+Z' }, '↶ Undo');
    undo.disabled = !doc.canUndo;
    undo.onclick = () => { if (doc.undo()) refresh(); };
    const redo = el('button', { class: 'ed-btn', type: 'button', title: 'Ctrl+Shift+Z' }, '↷ Redo');
    redo.disabled = !doc.canRedo;
    redo.onclick = () => { if (doc.redo()) refresh(); };

    const saveBtn = el('button', {
      class: `ed-btn primary${doc.dirty ? ' dirty' : ''}`, type: 'button', title: 'Ctrl+S',
    }, doc.dirty ? '● Save map' : 'Saved');
    saveBtn.disabled = !doc.validation.ok || !doc.dirty;
    saveBtn.onclick = () => void save();

    status.append(spacer, undo, redo, saveBtn);
  }

  const HINTS: Record<SiteMode, string> = {
    select: 'Sites: click to inspect, drag to move',
    place: 'Sites: click any cell to place a landmark',
    erase: 'Sites: click a landmark to delete it',
  };

  const readout = (): string => {
    if (!hover) {
      return tool === 'sites'
        ? `${HINTS[siteMode]} · space or right-drag pans`
        : 'Space or right-drag pans · wheel zooms · N places a landmark';
    }
    const terrain = doc.terrainAt(hover);
    if (terrain === null) return `(${hover.x}, ${hover.y}) · void`;
    const feature = doc.featureAt(hover);
    const site = doc.siteAt(hover);
    return [
      `(${hover.x}, ${hover.y})`,
      terrain,
      feature ? FEATURES[feature].name : null,
      site ? `${site.id}` : null,
      `ring ${doc.distanceAt(hover)}`,
      `${doc.costAt(hover)} gold`,
    ].filter(Boolean).join(' · ');
  };

  const updateStatus = () => {
    const node = status.querySelector('.ed-readout');
    if (node) node.textContent = readout();
  };

  function refresh(): void {
    buildToolbar();
    buildSide();
    buildStatus();
    writeSession();
  }

  // -------------------------------------------------------------- session
  function writeSession(): void {
    const session: Session = {
      cam: { x: camera.x, y: camera.y, zoom: camera.zoom },
      tool, siteMode, brush, brushSize, overlays,
    };
    try { sessionStorage.setItem('kingdom.mapEditor', JSON.stringify(session)); } catch { /* private mode */ }
  }

  // -------------------------------------------------------------- render
  const view: ViewState = { hover: null, preview: [], selected: null };
  const frame = () => {
    view.hover = hover;
    view.selected = selected;
    view.preview = rectFrom && hover ? rectBetween(rectFrom, hover)
      : hover && tool !== 'sites' && brushSize > 1 ? brushCells(hover)
        : [];
    canvas.dataset.mode = tool === 'sites' ? siteMode : 'paint';
    drawEditor(canvas, camera, doc, overlays, view);
    requestAnimationFrame(frame);
  };

  refresh();
  requestAnimationFrame(frame);
  // Camera state is written continuously so a save-triggered HMR reload lands
  // where the designer was looking.
  setInterval(writeSession, 1000);
}

// --------------------------------------------------------------- helpers

const field = (label: string, input: HTMLElement): HTMLElement =>
  el('label', { class: 'ed-field' }, el('span', {}, label), input);

function textInput(value: string, onCommit: (v: string) => void): HTMLInputElement {
  const input = el('input', { type: 'text' });
  input.value = value;
  input.onchange = () => {
    const next = input.value.trim();
    if (next) onCommit(next);
    else input.value = value; // a blank id is not an edit, it is a slip
  };
  return input;
}

function numberInput(
  value: number, onCommit: (v: number) => void, step = 1,
): HTMLInputElement {
  const input = el('input', { type: 'number', step: String(step) });
  input.value = String(value);
  input.onchange = () => {
    // A number input reports '' for ANYTHING it could not parse — a cleared
    // field, or a decimal typed with the wrong separator for the locale. And
    // Number('') is 0, not NaN, so the obvious isFinite() guard lets a blank
    // through as a zero and quietly rewrites a balance number. Blank reverts.
    const raw = input.value.trim();
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n)) { input.value = String(value); return; }
    onCommit(n);
  };
  return input;
}

function select(options: string[], value: string, onCommit: (v: string) => void): HTMLSelectElement {
  const node = el('select');
  for (const o of options) node.append(el('option', { value: o }, o));
  node.value = value;
  node.onchange = () => onCommit(node.value);
  return node;
}

function checkbox(value: boolean, onCommit: (v: boolean) => void): HTMLInputElement {
  const input = el('input', { type: 'checkbox' });
  input.checked = value;
  input.onchange = () => onCommit(input.checked);
  return input;
}

function rectBetween(a: Coord, b: Coord): Coord[] {
  const out: Coord[] = [];
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push({ x, y });
  }
  return out;
}

/** First run frames the whole region: opening onto a fourteen-cell window of
 *  a nineteen-by-twenty world and having to hunt for the coast is a bad first
 *  five seconds. Afterwards the session's own camera wins. */
function fitToWorld(camera: Camera, canvas: HTMLCanvasElement, doc: MapDoc): void {
  const b = worldBounds(doc, 0);
  camera.centerOnCell({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });
  const w = canvas.clientWidth || 900;
  const h = canvas.clientHeight || 700;
  const fit = Math.min(w / ((b.x1 - b.x0 + 2) * TILE_SIZE), h / ((b.y1 - b.y0 + 2) * TILE_SIZE));
  camera.zoom = 1;
  camera.zoomBy(fit); // through zoomBy, so the camera's own clamps still apply
}

function worldBounds(doc: MapDoc, margin = FILL_MARGIN): { x0: number; x1: number; y0: number; y1: number } {
  let x0 = 0; let x1 = 0; let y0 = 0; let y1 = 0;
  for (const c of doc.terrainCells) {
    x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x);
    y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y);
  }
  return { x0: x0 - margin, x1: x1 + margin, y0: y0 - margin, y1: y1 + margin };
}

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem('kingdom.mapEditor');
    return raw ? JSON.parse(raw) as Session : null;
  } catch { return null; }
}

/** The fallback when the dev endpoint is not there — never lose the work. */
function download(doc: RegionMapDoc): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'region-map.json' });
  a.click();
  URL.revokeObjectURL(a.href);
}
