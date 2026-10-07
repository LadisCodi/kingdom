// A small particle layer for the full-screen moments (the chest reveal).
//
// One canvas over the screen it decorates, pointer-events off, and a frame
// loop that runs only while something is alive — a still screen costs
// nothing. Presentation only: nothing here is read back, so `Math.random`
// is fine (the sim's randomness rules reach the sim, not a spark).
//
// Four kinds, each a different material, because the genre's payoff reads
// as light AND matter: `spark` (a four-pointed glint that fades), `confetti`
// (a paper flake that tumbles and falls), `dust` (a soft puff that swells and
// drifts — the chest landing) and `mote` (an ember that rises slowly).

export type ParticleKind = 'spark' | 'confetti' | 'dust' | 'mote';

export interface BurstOpts {
  kind: ParticleKind;
  count: number;
  colors: readonly string[];
  /** Initial speed, in CSS px a second (randomised ±50%). */
  speed?: number;
  /** Direction in radians and how wide the cone is; omitted = all around. */
  angle?: number;
  spread?: number;
  /** Size in CSS px (randomised ±40%). */
  size?: number;
  /** Lifetime in ms (randomised ±30%). */
  life?: number;
  /** Downward pull, in CSS px a second squared. */
  gravity?: number;
  /** Spawn jitter around the point, in CSS px. */
  radius?: number;
}

interface Particle {
  kind: ParticleKind;
  x: number; y: number; vx: number; vy: number;
  size: number; color: string;
  age: number; life: number; gravity: number;
  rot: number; spin: number;
}

export interface ParticleLayer {
  readonly canvas: HTMLCanvasElement;
  burst(x: number, y: number, opts: BurstOpts): void;
  /** A slow drift of embers across the screen while `on`. */
  ambient(on: boolean): void;
  clear(): void;
  destroy(): void;
}

const rnd = (base: number, spread: number): number => base * (1 - spread + Math.random() * spread * 2);

export function particleLayer(host: HTMLElement, className: string): ParticleLayer {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const ctx = canvas.getContext('2d');
  const parts: Particle[] = [];
  let raf: number | null = null;
  let last = 0;
  let ambientOn = false;
  let ambientDebt = 0;
  let w = 0;
  let h = 0;

  const fit = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const spawn = (x: number, y: number, o: BurstOpts): void => {
    for (let i = 0; i < o.count; i++) {
      const a = o.angle === undefined
        ? Math.random() * Math.PI * 2
        : o.angle + (Math.random() - 0.5) * (o.spread ?? Math.PI / 3);
      const v = rnd(o.speed ?? 220, 0.5);
      const r = (o.radius ?? 0) * Math.sqrt(Math.random());
      const ra = Math.random() * Math.PI * 2;
      parts.push({
        kind: o.kind,
        x: x + Math.cos(ra) * r, y: y + Math.sin(ra) * r,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        size: rnd(o.size ?? 6, 0.4),
        color: o.colors[Math.floor(Math.random() * o.colors.length)]!,
        age: 0, life: rnd(o.life ?? 900, 0.3), gravity: o.gravity ?? 0,
        rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 12,
      });
    }
  };

  const draw = (p: Particle): void => {
    if (ctx === null) return;
    const t = p.age / p.life;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.kind === 'spark') {
      // A four-pointed glint: it flares, then shrinks to nothing.
      const s = p.size * (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8);
      ctx.rotate(p.rot);
      ctx.globalAlpha = 1 - t * 0.6;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s);
      ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s);
      ctx.fill();
    } else if (p.kind === 'confetti') {
      // A paper flake: its width breathes as it tumbles, which is the whole
      // trick that makes a rectangle read as paper turning in the air.
      ctx.rotate(p.rot);
      ctx.scale(Math.cos(p.age / 90 + p.rot), 1);
      ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
    } else if (p.kind === 'dust') {
      const s = p.size * (0.6 + t * 1.2);
      ctx.globalAlpha = 0.55 * (1 - t);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
    } else {
      const s = p.size;
      ctx.globalAlpha = Math.sin(Math.PI * t) * 0.8;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(255, 180, 60, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, s * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fit();
    if (ambientOn) {
      ambientDebt += dt * 5; // embers a second
      while (ambientDebt >= 1) {
        ambientDebt -= 1;
        spawn(Math.random() * w, h * (0.75 + Math.random() * 0.3), {
          kind: 'mote', count: 1, colors: ['rgba(255, 196, 92, 0.9)', 'rgba(255, 228, 160, 0.9)'],
          speed: 30, angle: -Math.PI / 2, spread: 0.8, size: 2.2, life: 4200,
        });
      }
    }
    ctx?.clearRect(0, 0, w, h);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]!;
      p.age += dt * 1000;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      if (p.kind === 'confetti') { p.vx *= 1 - 1.6 * dt; p.vy = Math.min(p.vy, 140); }
      if (p.kind === 'dust') { p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      draw(p);
    }
    raf = parts.length > 0 || ambientOn ? requestAnimationFrame(frame) : null;
  };

  const wake = (): void => {
    if (raf !== null || ctx === null) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  return {
    canvas,
    burst(x, y, opts) {
      fit();
      spawn(x, y, opts);
      wake();
    },
    ambient(on) {
      ambientOn = on;
      if (on) wake();
    },
    clear() {
      parts.length = 0;
      ctx?.clearRect(0, 0, w, h);
    },
    destroy() {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      parts.length = 0;
      canvas.remove();
    },
  };
}
