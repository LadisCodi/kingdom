// The battle playback's effects layer (Docs/features/11a-ruins-ui.md §2.7):
// what flies between two slots and what bursts off one — arrows, bolts,
// slashes, thrusts, sparks, dust.
//
// One canvas over the board. The slots stay DOM; only what has no home in a
// slot is drawn here, so a fight's two hundred blows never touch the layout.
//
// EVERY EFFECT IS A FUNCTION OF THE FIGHT'S CLOCK, not of the frame: a spark
// is at `start + v·age`, never `x += vx`. So ×2 plays it twice as fast, a
// held clock (a heavy blow) freezes it mid-air, and a dropped frame lands it
// where it would have been.

export interface Pt { x: number; y: number }

interface Shot { kind: 'arrow' | 'bolt'; from: Pt; to: Pt; start: number; end: number; bend: number }
interface Blade { kind: 'slash' | 'thrust'; at: Pt; angle: number; start: number; end: number; size: number }

type Effect =
  | Shot
  | Blade
  | {
    kind: 'spark' | 'dust'; at: Pt; vx: number; vy: number; start: number; end: number;
    size: number; color: string;
  };

/** Leather, iron and feather — an arrow is drawn in what it is made of. */
const SHAFT = '#7a4d26';
const OUTLINE = '#3c2412';
const HEAD = '#5d6470';
const FLETCH = '#f4e4c1';
const SPARKS = ['#fff6dc', '#ffd36a', '#ffb13b'];
const BOLT = '#fff3c4';
const BOLT_GLOW = '#ffc94a';

export interface FxLayer {
  readonly canvas: HTMLCanvasElement;
  /** Match the canvas to its box. `unit` is one design pixel (`--px`) in CSS
   *  pixels, which every effect is sized in. */
  resize(width: number, height: number, unit: number): void;
  /** Something flying from `from`, landing on `to` at `end`. */
  shoot(kind: 'arrow' | 'bolt', from: Pt, to: Pt, start: number, end: number, bend: number): void;
  /** A blade's mark on a slot at `t`, along `angle` (the blow's direction). */
  strike(kind: 'slash' | 'thrust', at: Pt, angle: number, t: number, size: number): void;
  /** `n` sparks thrown along `angle`, fanned. */
  sparks(at: Pt, angle: number, t: number, n: number): void;
  /** A few puffs at someone's feet. */
  dust(at: Pt, t: number): void;
  /** Draw the clock's `t`, dropping whatever has finished. */
  draw(t: number): void;
  clear(): void;
}

export function createFxLayer(): FxLayer {
  const canvas = document.createElement('canvas');
  canvas.className = 'bs-fx';
  const ctx = canvas.getContext('2d');
  let effects: Effect[] = [];
  let u = 1;
  let dpr = 1;

  const ease = (p: number): number => 1 - (1 - p) * (1 - p);

  /** Where a projectile is at `p` of its flight, bowed sideways by `bend`
   *  (a lob seen from above), and which way it points. */
  const along = (e: Shot, p: number): { x: number; y: number; a: number } => {
    const dx = e.to.x - e.from.x;
    const dy = e.to.y - e.from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const lift = e.bend * 4 * p * (1 - p);
    const dlift = e.bend * 4 * (1 - 2 * p);
    return {
      x: e.from.x + dx * p + nx * lift,
      y: e.from.y + dy * p + ny * lift,
      a: Math.atan2(dy + ny * dlift, dx + nx * dlift),
    };
  };

  const drawArrow = (x: number, y: number, a: number): void => {
    if (ctx === null) return;
    const len = 16 * u;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.4 * u;
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.strokeStyle = SHAFT;
    ctx.lineWidth = 1.8 * u;
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
    // The head, and the fletching at the nock.
    ctx.fillStyle = HEAD;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath(); ctx.moveTo(4 * u, 0); ctx.lineTo(-2 * u, -3 * u); ctx.lineTo(-2 * u, 3 * u); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = FLETCH;
    ctx.beginPath(); ctx.moveTo(-len + 5 * u, 0); ctx.lineTo(-len - 1 * u, -3.5 * u); ctx.lineTo(-len + 1 * u, 0);
    ctx.lineTo(-len - 1 * u, 3.5 * u); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  };

  const drawBolt = (e: Shot, p: number): void => {
    if (ctx === null) return;
    // A trail of three fading beads behind the head.
    for (let i = 3; i >= 0; i -= 1) {
      const q = Math.max(0, p - i * 0.06);
      const { x, y } = along(e, q);
      ctx.globalAlpha = i === 0 ? 1 : 0.5 - i * 0.12;
      ctx.fillStyle = i === 0 ? BOLT : BOLT_GLOW;
      ctx.beginPath(); ctx.arc(x, y, (i === 0 ? 5.5 : 4.5 - i) * u, 0, Math.PI * 2); ctx.fill();
    }
    const { x, y } = along(e, p);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = BOLT_GLOW;
    ctx.beginPath(); ctx.arc(x, y, 10 * u, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  };

  /** A crescent sweeping across the slot, outlined, gone in a blink. */
  const drawSlash = (e: Blade, p: number): void => {
    if (ctx === null) return;
    const r = 30 * u * e.size;
    const sweep = 2.4;
    // Square to the blow, so it reads as a cut ACROSS the target.
    const a0 = e.angle - Math.PI / 2 - sweep / 2;
    const head = a0 + sweep * ease(Math.min(1, p * 1.6));
    const tail = a0 + sweep * ease(Math.max(0, p * 1.6 - 0.6));
    ctx.save();
    ctx.translate(e.at.x - Math.cos(e.angle) * r * 0.35, e.at.y - Math.sin(e.angle) * r * 0.35);
    ctx.globalAlpha = 1 - p * p;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(60, 36, 18, 0.55)';
    ctx.lineWidth = 11 * u * e.size * (1 - p * 0.5);
    ctx.beginPath(); ctx.arc(0, 0, r, tail, head); ctx.stroke();
    ctx.strokeStyle = '#fff6dc';
    ctx.lineWidth = 6 * u * e.size * (1 - p * 0.5);
    ctx.beginPath(); ctx.arc(0, 0, r, tail, head); ctx.stroke();
    ctx.restore();
  };

  /** A straight streak through the slot along the blow: a lance going in. */
  const drawThrust = (e: Blade, p: number): void => {
    if (ctx === null) return;
    const reach = 30 * u * e.size;
    const head = ease(Math.min(1, p * 1.8));
    const tail = ease(Math.max(0, p * 1.8 - 0.7));
    const cx = Math.cos(e.angle);
    const cy = Math.sin(e.angle);
    const x0 = e.at.x - cx * reach;
    const y0 = e.at.y - cy * reach;
    ctx.save();
    ctx.globalAlpha = 1 - p * p;
    ctx.lineCap = 'round';
    for (const [style, w] of [['rgba(60, 36, 18, 0.55)', 10], ['#fff6dc', 5]] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = w * u * e.size;
      ctx.beginPath();
      ctx.moveTo(x0 + cx * reach * 1.5 * tail, y0 + cy * reach * 1.5 * tail);
      ctx.lineTo(x0 + cx * reach * 1.5 * head, y0 + cy * reach * 1.5 * head);
      ctx.stroke();
    }
    ctx.restore();
  };

  return {
    canvas,
    resize(width, height, unit) {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      u = unit;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    },
    shoot(kind, from, to, start, end, bend) {
      effects.push({ kind, from, to, start, end, bend: bend * u });
    },
    strike(kind, at, angle, t, size) {
      effects.push({ kind, at, angle, start: t, end: t + (kind === 'slash' ? 200 : 170), size });
    },
    sparks(at, angle, t, n) {
      for (let i = 0; i < n; i += 1) {
        const a = angle + (Math.random() - 0.5) * 1.9;
        const speed = (0.1 + Math.random() * 0.16) * u;
        effects.push({
          kind: 'spark', at, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          start: t, end: t + 220 + Math.random() * 200,
          size: (2.4 + Math.random() * 1.6) * u, color: SPARKS[i % SPARKS.length]!,
        });
      }
    },
    dust(at, t) {
      for (let i = 0; i < 4; i += 1) {
        const a = Math.PI * (0.15 + 0.7 * Math.random()) + (i % 2 === 0 ? 0 : Math.PI);
        effects.push({
          kind: 'dust', at: { x: at.x, y: at.y + 18 * u }, vx: Math.cos(a) * 0.03 * u, vy: -0.015 * u,
          start: t, end: t + 420 + Math.random() * 160, size: (5 + Math.random() * 3) * u,
          color: 'rgba(214, 190, 150, 0.7)',
        });
      }
    },
    draw(t) {
      if (ctx === null) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (effects.length === 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      effects = effects.filter((e) => t < e.end);
      for (const e of effects) {
        if (t < e.start) continue;
        const p = (t - e.start) / Math.max(1, e.end - e.start);
        switch (e.kind) {
          case 'arrow': {
            const { x, y, a } = along(e, p);
            drawArrow(x, y, a);
            break;
          }
          case 'bolt': drawBolt(e, p); break;
          case 'slash': drawSlash(e, p); break;
          case 'thrust': drawThrust(e, p); break;
          case 'spark': {
            const age = t - e.start;
            const x = e.at.x + e.vx * age;
            const y = e.at.y + e.vy * age + 0.0004 * u * age * age;
            // A chip of light, outlined like everything else on the board:
            // a long diamond along its flight, shrinking as it goes.
            const s = e.size * (1 - p * 0.6);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.atan2(e.vy + 0.0008 * u * age, e.vx));
            ctx.globalAlpha = Math.min(1, 2 * (1 - p));
            ctx.beginPath();
            ctx.moveTo(s * 2.2, 0); ctx.lineTo(0, -s * 0.8); ctx.lineTo(-s * 1.4, 0); ctx.lineTo(0, s * 0.8);
            ctx.closePath();
            ctx.lineWidth = 1.4 * u;
            ctx.strokeStyle = OUTLINE;
            ctx.fillStyle = e.color;
            ctx.stroke();
            ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
            break;
          }
          case 'dust': {
            const age = t - e.start;
            ctx.globalAlpha = 0.7 * (1 - p);
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.arc(e.at.x + e.vx * age, e.at.y + e.vy * age, e.size * (0.6 + p), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            break;
          }
        }
      }
    },
    clear() {
      effects = [];
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
