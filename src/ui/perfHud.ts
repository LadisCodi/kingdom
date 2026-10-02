// THE PERF READOUT (?dev, 📈 in the dev bar): what a second of the game
// costs, read on the device itself. Frames per second and the worst gap
// between two frames, then each timed section — the map's draw, the world
// board's, `notify()`, the sim tick — as its mean and worst milliseconds and
// how many times a second it ran. Measured always while ?dev is on (a
// `performance.now()` pair a call); shown only while the readout is open.

import { el, formatNumber } from './format';

export interface PerfMeter {
  /** Call once an animation frame, with its timestamp. */
  frame(t: number): void;
  /** Time `fn` under `label`. */
  time<T>(label: string, fn: () => T): T;
  /** Show or hide the readout. */
  setVisible(on: boolean): void;
  visible(): boolean;
  /** The readout's element, to mount once. */
  node: HTMLElement;
}

/** How often the readout is rewritten, and the window it summarises. */
const WINDOW_MS = 1000;

interface Section {
  total: number;
  worst: number;
  calls: number;
}

export function createPerfMeter(): PerfMeter {
  const node = el('div', { class: 'dev-perf', 'aria-hidden': 'true' });
  let shown = false;
  let windowStart = performance.now();
  let frames = 0;
  let lastFrame = -1;
  let worstGap = 0;
  const sections = new Map<string, Section>();

  const ms = (n: number): string => formatNumber(n, 1, 1);
  const flush = (now: number): void => {
    const span = (now - windowStart) / 1000;
    if (shown) {
      const lines = [`${formatNumber(frames / span)} fps · worst gap ${ms(worstGap)} ms`];
      for (const [label, s] of sections) {
        if (s.calls === 0) continue;
        lines.push(`${label} ${ms(s.total / s.calls)} avg · ${ms(s.worst)} max · ${formatNumber(s.calls / span)}/s`);
      }
      node.textContent = lines.join('\n');
    }
    windowStart = now;
    frames = 0;
    worstGap = 0;
    for (const s of sections.values()) {
      s.total = 0;
      s.worst = 0;
      s.calls = 0;
    }
  };

  return {
    node,
    frame(t) {
      frames += 1;
      if (lastFrame >= 0) worstGap = Math.max(worstGap, t - lastFrame);
      lastFrame = t;
      if (t - windowStart >= WINDOW_MS) flush(t);
    },
    time(label, fn) {
      const t0 = performance.now();
      try {
        return fn();
      } finally {
        const d = performance.now() - t0;
        let s = sections.get(label);
        if (s === undefined) {
          s = { total: 0, worst: 0, calls: 0 };
          sections.set(label, s);
        }
        s.total += d;
        s.worst = Math.max(s.worst, d);
        s.calls += 1;
      }
    },
    setVisible(on) {
      shown = on;
      node.classList.toggle('is-open', on);
      if (!on) node.textContent = '';
    },
    visible: () => shown,
  };
}
