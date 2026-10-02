// Drawing the collect bubble (./collectBubbles.ts has the why).

import type { CurrencyId, District, GameState } from '../sim/state';
import { isStoreFull } from '../sim/storage';
import type { CollectBubbles } from './collectBubbles';
import { drawIcon, drawSprite } from './sprites';

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
  state: GameState,
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
  // Its whole reach, the bob's top included.
  bubbles.place(district.uniqueId, { x: tipX - w / 2, y: tipY - width * 1.26 - hop, w, h: width * 1.26 }, clock);
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
  ctx.strokeStyle = isStoreFull(state, district) ? RIM_FULL : RIM;
  ctx.stroke();
  const icon = Math.round(Math.min(w, h) * 0.7);
  drawIcon(ctx, currency, -icon / 2, y + (h - icon) / 2, icon);
  ctx.restore();
}

// ------------------------------------------------------------ the lair bubble

// THE WARNING BUBBLE over a standing lair (Docs/proposals/lairs.md §6): the
// collect bubble's shape in danger red, wider than tall, the creature's head
// on the left and the time to the next raid on the right.
const DANGER = '#c8452f';
const DANGER_LIGHT = '#e0654a';
const DANGER_RIM = '#7a2016';
const COUNT_INK = '#fff1d6';
const COUNT_EDGE = '#3a0e08';

export interface BubbleRect { x: number; y: number; w: number; h: number }

/**
 * Draw one lair's bubble with its tail tip at (tipX, tipY), `height` tall.
 * `avatar` is the creature's medallion sprite, `countdown` the text beside
 * the hourglass. Returns the screen rect it covers, tail included, so a tap
 * on it can be resolved to the lair.
 */
export function drawLairBubble(
  ctx: CanvasRenderingContext2D,
  bubbles: CollectBubbles,
  id: string,
  avatar: string,
  countdown: string,
  font: string,
  tipX: number,
  tipY: number,
  height: number,
  clock: number,
): BubbleRect {
  const still = reducedMotion();
  const pop = still ? 1 : bubbles.appear(id, clock);
  const scale = pop >= 1 ? 1 : 1 - (1 - pop) ** 3 * (1 - 2.2 * pop);
  const bob = still ? 0 : (Math.sin(clock / 260 + phaseOf(id)) * 0.5 + 0.5) * height * 0.14;

  const h = height;
  const tail = h * 0.22;
  const pad = h * 0.2;
  const head = h * 0.58;
  const glass = Math.round(h * 0.38);
  const textPx = Math.max(11, Math.round(h * 0.38));
  ctx.save();
  ctx.font = `bold ${textPx}px ${font}`;
  const textW = ctx.measureText(countdown).width;
  const w = Math.max(h * 1.6, pad + head + h * 0.14 + glass + h * 0.06 + textW + pad);
  const r = h * 0.42;
  const line = Math.max(1.5, h * 0.055);

  const ty = tipY - bob;
  ctx.translate(tipX, ty);
  ctx.scale(scale, scale);
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
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, DANGER_LIGHT);
  fill.addColorStop(0.45, DANGER);
  fill.addColorStop(1, DANGER);
  ctx.shadowColor = 'rgba(40, 10, 6, 0.4)';
  ctx.shadowBlur = h * 0.2;
  ctx.shadowOffsetY = h * 0.07;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = line;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = DANGER_RIM;
  ctx.stroke();

  // The creature's head, a medallion clipped to its circle.
  const midY = y + h / 2;
  const hx = x + pad;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx + head / 2, midY, head / 2, 0, Math.PI * 2);
  ctx.clip();
  if (!drawSprite(ctx, avatar, hx, midY - head / 2, head, head)) {
    ctx.fillStyle = DANGER_RIM;
    ctx.fill();
  }
  ctx.restore();

  // The hourglass, then the time left.
  let cursor = hx + head + h * 0.14;
  if (!drawIcon(ctx, 'hourglass', cursor, midY - glass / 2, glass)) {
    drawHourglass(ctx, cursor, midY - glass / 2, glass);
  }
  cursor += glass + h * 0.06;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, textPx * 0.22);
  ctx.strokeStyle = COUNT_EDGE;
  ctx.strokeText(countdown, cursor, midY + textPx * 0.05);
  ctx.fillStyle = COUNT_INK;
  ctx.fillText(countdown, cursor, midY + textPx * 0.05);
  ctx.restore();
  return { x: tipX - w / 2, y: ty - tail - h, w, h: h + tail };
}

/** Two triangles and a frame: the fallback while the atlas has not loaded. */
function drawHourglass(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const l = x + s * 0.2;
  const rr = x + s * 0.8;
  ctx.beginPath();
  ctx.moveTo(l, y + s * 0.1);
  ctx.lineTo(rr, y + s * 0.1);
  ctx.lineTo(x + s / 2, y + s / 2);
  ctx.closePath();
  ctx.moveTo(l, y + s * 0.9);
  ctx.lineTo(rr, y + s * 0.9);
  ctx.lineTo(x + s / 2, y + s / 2);
  ctx.closePath();
  ctx.fillStyle = COUNT_INK;
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.strokeStyle = COUNT_EDGE;
  ctx.stroke();
}

// ------------------------------------------------------------ the claim bubble

/**
 * A BEATEN lair's bubble (Docs/proposals/lairs.md §5): the collect bubble
 * itself — parchment, the brown rim — with the reward chest in it, because a
 * beaten lair is exactly a store with something waiting in it. No countdown:
 * it raids no more. Returns its rect, so a tap on it opens the card.
 */
export function drawClaimBubble(
  ctx: CanvasRenderingContext2D,
  bubbles: CollectBubbles,
  id: string,
  tipX: number,
  tipY: number,
  width: number,
  clock: number,
): BubbleRect {
  const still = reducedMotion();
  const pop = still ? 1 : bubbles.appear(id, clock);
  const scale = pop >= 1 ? 1 : 1 - (1 - pop) ** 3 * (1 - 2.2 * pop);
  const bob = still ? 0 : (Math.sin(clock / 260 + phaseOf(id)) * 0.5 + 0.5) * width * 0.14;
  const w = width;
  const h = width * 0.92;
  const tail = width * 0.2;
  const r = width * 0.22;
  const line = Math.max(1.5, width * 0.05);
  const ty = tipY - bob;
  ctx.save();
  ctx.translate(tipX, ty);
  ctx.scale(scale, scale);
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
  ctx.strokeStyle = RIM;
  ctx.stroke();
  const icon = Math.round(Math.min(w, h) * 0.72);
  drawIcon(ctx, 'chest', -icon / 2, y + (h - icon) / 2, icon);
  ctx.restore();
  return { x: tipX - w / 2, y: ty - tail - h, w, h: h + tail };
}
