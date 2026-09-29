// Drawing the collect bubble (./collectBubbles.ts has the why).

import type { CurrencyId, District } from '../sim/state';
import { isStoreFull } from '../sim/storage';
import type { CollectBubbles } from './collectBubbles';
import { drawIcon } from './sprites';

/** What the bubble shows: the currency the store holds most of. */
export function bubbleCurrency(district: District): CurrencyId | null {
  let best: CurrencyId | null = null;
  let most = 0;
  for (const [c, n] of Object.entries(district.stored ?? {}) as Array<[CurrencyId, number]>) {
    if (n > most) { most = n; best = c; }
  }
  return best;
}

const PARCHMENT = '#f4e4c1';
const PARCHMENT_LIGHT = '#fbf1da';
const RIM = '#8a5a2b';
const RIM_FULL = '#b3402c';

const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A stable phase per building, so the neighbourhood does not bob in step. */
const phaseOf = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000 * Math.PI * 2;
};

/**
 * Draw one bubble whose tail tip touches (tipX, tipY), `width` wide.
 * `clock` is performance.now(), the same clock the hop was stamped with.
 */
export function drawCollectBubble(
  ctx: CanvasRenderingContext2D,
  bubbles: CollectBubbles,
  district: District,
  tipX: number,
  tipY: number,
  width: number,
  clock: number,
): void {
  const currency = bubbleCurrency(district);
  if (currency === null) return;
  const still = reducedMotion();
  const pop = still ? 1 : bubbles.appear(district.uniqueId, clock);
  // Overshoot on the way in: a pop, not a fade.
  const scale = pop >= 1 ? 1 : 1 - (1 - pop) ** 3 * (1 - 2.2 * pop);
  const bob = still ? 0 : (Math.sin(clock / 260 + phaseOf(district.uniqueId)) * 0.5 + 0.5) * width * 0.14;
  const hop = still ? 0 : bubbles.hop(district.location, clock) * width * 0.22;

  const w = width;
  const h = width * 0.92;
  const tail = width * 0.2;
  const r = width * 0.22;
  const line = Math.max(1.5, width * 0.05);

  ctx.save();
  ctx.translate(tipX, tipY - bob - hop);
  ctx.scale(scale, scale);
  // The body sits on the tail; (0, 0) is the tail's tip.
  const x = -w / 2;
  const y = -tail - h;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(tail * 0.7, y + h);
  ctx.lineTo(0, 0);
  ctx.lineTo(-tail * 0.7, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  // Lit from above: lighter at the top edge, the parchment below.
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, PARCHMENT_LIGHT);
  fill.addColorStop(0.45, PARCHMENT);
  fill.addColorStop(1, PARCHMENT);
  ctx.shadowColor = 'rgba(40, 22, 10, 0.35)';
  ctx.shadowBlur = width * 0.18;
  ctx.shadowOffsetY = width * 0.06;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = line;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = isStoreFull(district) ? RIM_FULL : RIM;
  ctx.stroke();
  const icon = Math.round(Math.min(w, h) * 0.7);
  drawIcon(ctx, currency, -icon / 2, y + (h - icon) / 2, icon);
  ctx.restore();
}
