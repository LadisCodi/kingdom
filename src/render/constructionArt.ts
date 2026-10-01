// A building at work, on the map: the card's working hammer
// (district.css `.dc-hammer`) flying over it while it is built, and the kit's
// glass bar (kit.css `.k-trough`) with the time inside — blue for a build,
// green for a training line, as their cards wear them.

import barBaseUrl from '../ui/assets/bar-base.png?url';
import barBorderUrl from '../ui/assets/bar-border.png?url';
import barFillBlueUrl from '../ui/assets/bar-fill-blue.png?url';
import barFillGreenUrl from '../ui/assets/bar-fill-green.png?url';
import hammerUrl from '../ui/assets/art-hammer.png?url';
import { loadImage } from './imageLoad';

const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A three-slice: the image's `slice` source pixels at each end kept in
 * proportion to the drawn height, the middle stretched.
 */
function draw3(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement, slice: number,
  x: number, y: number, w: number, h: number,
): void {
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const end = Math.min(w / 2, (h * slice) / sh);
  ctx.drawImage(img, 0, 0, slice, sh, x, y, end, h);
  ctx.drawImage(img, slice, 0, sw - slice * 2, sh, x + end, y, w - end * 2, h);
  ctx.drawImage(img, sw - slice, 0, slice, sh, x + w - end, y, end, h);
}

/**
 * The kit's bar, `h` tall: the tube's dark inside, the fill uncovered from
 * the left to `fraction`, the glass over both, and `text` inside in light
 * ink on a warm shadow. The same insets as kit.css, as fractions of `h`.
 */
export function drawTroughBar(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  fraction: number, text: string, font: string, tone: 'blue' | 'green' = 'blue',
): void {
  const base = loadImage(barBaseUrl);
  const fill = loadImage(tone === 'green' ? barFillGreenUrl : barFillBlueUrl);
  const border = loadImage(barBorderUrl);
  if (!base.ready || !fill.ready || !border.ready) return;
  const tx = x + h * 0.0625;
  const ty = y + h * 0.078;
  const tw = w - h * 0.125;
  const th = h - h * 0.156;
  draw3(ctx, base.img, 54, tx, ty, tw, th);
  const f = Math.min(1, Math.max(0, fraction));
  if (f > 0) {
    const fx = tx - h * 0.03;
    const fw = tw + h * 0.06;
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx, ty, fw * f, th);
    ctx.clip();
    draw3(ctx, fill.img, 54, fx, ty, fw, th);
    ctx.restore();
  }
  draw3(ctx, border.img, 64, x, y, w, h);
  if (text === '') return;
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(30, 16, 6, 0.85)';
  ctx.shadowColor = 'rgba(30, 16, 6, 0.75)';
  ctx.shadowBlur = h * 0.2;
  const cx = x + w / 2;
  const cy = y + h / 2 + h * 0.04;
  ctx.fillText(text, cx, cy + h * 0.09);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#fff8ea';
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

// ------------------------------------------------------------ the hammer

type Ease = (k: number) => number;
const cubic = (x1: number, y1: number, x2: number, y2: number): Ease => (k) => {
  // Solve the bezier's x for k by bisection, then read its y.
  let lo = 0;
  let hi = 1;
  let t = k;
  for (let i = 0; i < 20; i++) {
    t = (lo + hi) / 2;
    const x = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3;
    if (x < k) lo = t; else hi = t;
  }
  return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3;
};
const EASE_IN_OUT = cubic(0.42, 0, 0.58, 1);
const EASE_IN = cubic(0.42, 0, 1, 1);
const EASE_OUT = cubic(0, 0, 0.58, 1);
const LINEAR: Ease = (k) => k;
const BLOW = cubic(0.6, 0, 1, 0.6);

/** One property's keyframes: at `t` (0…1 of the loop), the value, and the
 *  easing of the stretch to the next one — as district.css writes them. */
type Track = Array<[t: number, v: number[], ease: Ease]>;

const ROTATE: Track = [
  [0, [-20], EASE_IN_OUT], [0.09, [-24], BLOW], [0.15, [70], EASE_OUT], [0.2, [58], EASE_IN_OUT],
  [0.3, [-20], LINEAR], [0.32, [-26], LINEAR], [0.345, [-34], LINEAR], [0.37, [-22], LINEAR],
  [0.395, [-8], LINEAR], [0.42, [-14], LINEAR], [0.445, [-24], LINEAR], [0.47, [-16], EASE_OUT],
  [0.5, [-20], EASE_IN_OUT], [0.54, [30], EASE_IN], [0.57, [70], EASE_OUT], [0.63, [30], EASE_IN],
  [0.66, [70], EASE_OUT], [0.74, [-20], EASE_IN_OUT], [0.83, [-14], EASE_IN_OUT], [0.92, [-20], EASE_IN_OUT],
  [1, [-20], EASE_IN_OUT],
];
const TRANSLATE: Track = [
  [0, [0, 0], EASE_IN_OUT], [0.3, [0, 0], LINEAR], [0.32, [9, 4], LINEAR], [0.345, [11, 14], LINEAR],
  [0.37, [3, 20], LINEAR], [0.395, [-5, 13], LINEAR], [0.42, [-2, 3], LINEAR], [0.445, [-14, 7], LINEAR],
  [0.47, [-27, 1], EASE_OUT], [0.5, [-40, 4], EASE_IN_OUT], [0.74, [-40, 4], EASE_IN_OUT],
  [0.83, [-20, 10], EASE_IN_OUT], [0.92, [0, 0], EASE_IN_OUT], [1, [0, 0], EASE_IN_OUT],
];

function sample(track: Track, k: number): number[] {
  let i = 0;
  while (i < track.length - 2 && track[i + 1][0] <= k) i++;
  const [t0, a, ease] = track[i];
  const [t1, b] = track[i + 1];
  const e = ease(t1 === t0 ? 1 : (k - t0) / (t1 - t0));
  return a.map((v, j) => v + (b[j] - v) * e);
}

/** A spark burst: when in the loop each blow lands, where, and how far its
 *  four specks fly (district.css `.dc-sparks`). */
const BURSTS: Array<{ at: number; life: number; x: number; y: number; reach: number }> = [
  { at: 0.15, life: 0.11, x: 70, y: 20, reach: 16 },
  { at: 0.57, life: 0.05, x: 30, y: 24, reach: 10 },
  { at: 0.66, life: 0.06, x: 30, y: 24, reach: 10 },
];
const SPECKS: Array<[number, number]> = [[1, -1.1], [1.4, -0.3], [-0.6, -1.3], [0.4, -1.5]];

const LOOP_MS = 3200;

/** A stable phase per building, so two sites do not hammer in step. */
const phaseOf = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % LOOP_MS;
};

/**
 * The working hammer over a building. The card's portrait is 84 × 75 and the
 * keyframes are written in it; here that frame is `width` wide with its top
 * left at (x, y), so the blows land on the building's upper half.
 */
export function drawWorkingHammer(
  ctx: CanvasRenderingContext2D, id: string, x: number, y: number, width: number, clock: number,
): void {
  const art = loadImage(hammerUrl);
  if (!art.ready) return;
  const u = width / 84;
  const still = reducedMotion();
  const k = still ? 0 : ((clock + phaseOf(id)) % LOOP_MS) / LOOP_MS;
  const [rot] = sample(ROTATE, k);
  const [dx, dy] = sample(TRANSLATE, k);
  const size = 40 * u;
  // The pivot is the handle's end: 15% across, 90% down the art.
  const px = x + (35 + dx) * u + size * 0.15;
  const py = y + (-16 + dy) * u + size * 0.9;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.shadowColor = 'rgba(40, 22, 10, 0.35)';
  ctx.shadowBlur = 2 * u;
  ctx.shadowOffsetY = 2 * u;
  ctx.drawImage(art.img, -size * 0.15, -size * 0.9, size, size);
  ctx.restore();
  if (still) return;
  for (const b of BURSTS) {
    const p = (k - b.at) / b.life;
    if (p < 0 || p > 1) continue;
    for (const [sx, sy] of SPECKS) {
      const r = 3 * u * (1 - 0.6 * p);
      const cx = x + (b.x + b.reach * sx * p) * u;
      const cy = y + (b.y + b.reach * sy * p) * u;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.shadowColor = '#ffb627';
      ctx.shadowBlur = 4 * u;
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
