// THE MINIMAP (Docs/plans/precious-deposits.md §3.1): the whole world in a
// corner of the world board — the camera's own zoom stops at one board —
// framed in wood on parchment. Mist where the player has not looked, the
// ground's colour where they have, every kingdom's ground in its colour, the
// cities and the Portals as dots, and the camera's frame. A tap there moves
// the camera to that place. Absent on the province and under a sheet.

import type { Game } from '../../game';
import { SEAT_COLORS } from '../../render/world/boardRenderer';
import { hexToPlane, planeToHex } from '../../render/world/hexLayout';
import { BOARD_HEXES, PORTAL_INDICES, WORLD_RADIUS } from '../../sim/world/hex';
import { fogStateOf, worldFogAt } from '../../sim/world/explorers';
import type { WorldTerrain } from '../../sim/world/types';
import { el } from '../format';
import { setHidden } from '../domWrite';

/** The ground's colour, flat — the minimap is a map, not a painting. */
const GROUND: Record<WorldTerrain, string> = { Grassland: '#86b35a', Plains: '#bdb768', Desert: '#d9c387' };
const MIST = '#c9d3dc';
const SENSED = '#aebdc9';

/** The world's extent on the plane, with a hex's margin. */
const EXTENT = (() => {
  const ps = BOARD_HEXES.map(hexToPlane);
  const xs = ps.map((p) => p.x);
  const ys = ps.map((p) => p.y);
  const pad = 80;
  return { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad };
})();

export function mountMinimap(game: Game, root: HTMLElement): void {
  const canvas = el('canvas', { class: 'wmini-canvas', 'aria-label': 'The world: tap to look there' }) as HTMLCanvasElement;
  root.replaceChildren(el('div', { class: 'wmini' }, canvas));
  root.hidden = WORLD_RADIUS === 0;

  /** Plane to minimap pixels, and back. */
  const fit = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const k = Math.min(w / (EXTENT.x1 - EXTENT.x0), h / (EXTENT.y1 - EXTENT.y0));
    const ox = (w - (EXTENT.x1 - EXTENT.x0) * k) / 2 - EXTENT.x0 * k;
    const oy = (h - (EXTENT.y1 - EXTENT.y0) * k) / 2 - EXTENT.y0 * k;
    return { k, ox, oy, w, h };
  };

  canvas.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const r = canvas.getBoundingClientRect();
    const { k, ox, oy } = fit();
    const px = (e.clientX - r.left - ox) / k;
    const py = (e.clientY - r.top - oy) / k;
    game.worldCamera?.centerOnHex(planeToHex(px, py));
    draw();
  });

  let last = '';
  const draw = (): void => {
    const camera = game.worldCamera;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const { k, ox, oy, w, h } = fit();
    if (w === 0 || h === 0 || camera === null || camera === undefined) return;
    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const now = game.now();
    const state = game.state;
    const source = game.worldSource();
    const board = source.board();
    const fog = worldFogAt(state, now);
    const seats = source.seats();
    const colourOf = (owner: number | null): string | null => {
      if (owner === null) return null;
      const s = seats[owner];
      if (s === undefined) return null;
      return s.owner.you ? SEAT_COLORS.you : SEAT_COLORS.rivals[s.owner.rival % SEAT_COLORS.rivals.length];
    };
    const dot = Math.max(1.6, k * 70);
    for (const bh of board.hexes) {
      const p = hexToPlane(bh.hex);
      const x = p.x * k + ox;
      const y = p.y * k + oy;
      const fogState = fogStateOf(state, bh.index, now, fog);
      let fill = fogState === 'Unknown' ? MIST : fogState === 'Sensed' ? SENSED : GROUND[bh.terrain ?? 'Grassland'];
      const held = source.hexOf(bh.index);
      const city = bh.seat !== null ? colourOf(bh.seat) : null;
      const owned = held === null ? null : colourOf(held.owner ?? null);
      if (fogState !== 'Unknown' && owned !== null) fill = owned;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, dot, 0, Math.PI * 2);
      ctx.fill();
      if (city !== null && (fogState === 'Revealed' || seats[bh.seat!]?.owner.you)) {
        ctx.fillStyle = '#2e1c0e';
        ctx.beginPath();
        ctx.arc(x, y, dot * 1.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = city;
        ctx.beginPath();
        ctx.arc(x, y, dot * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // The Portals: violet dots, seen by everyone.
    for (const i of PORTAL_INDICES) {
      const p = hexToPlane(BOARD_HEXES[i]);
      ctx.fillStyle = '#6a3fb5';
      ctx.strokeStyle = '#f4e3bc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x * k + ox, p.y * k + oy, dot * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // The camera's frame.
    const cw = camera.viewWidth / camera.zoom;
    const ch = camera.viewHeight / camera.zoom;
    ctx.strokeStyle = '#fff6e0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect((camera.x - cw / 2) * k + ox, (camera.y - ch / 2) * k + oy, cw * k, ch * k);
    ctx.strokeStyle = 'rgba(46, 28, 14, 0.8)';
    ctx.lineWidth = 0.75;
    ctx.strokeRect((camera.x - cw / 2) * k + ox - 1, (camera.y - ch / 2) * k + oy - 1, cw * k + 2, ch * k + 2);
  };

  const refresh = (): void => {
    const show = game.scene === 'world' && game.worldView !== null && !game.hasOpenSheet() && WORLD_RADIUS > 0;
    setHidden(root, !show);
    if (!show) return;
    const camera = game.worldCamera;
    const key = `${camera?.x}|${camera?.y}|${camera?.zoom}|${game.worldView?.at ?? 0}|${Math.floor(game.now() / 5000)}`;
    if (key === last) return;
    last = key;
    draw();
  };
  game.onChange(refresh);
  // The camera moves between notifies: a glance at it a few times a second.
  globalThis.setInterval?.(refresh, 250);
  refresh();
}
