// Tap feedback: a squash & stretch scale punch plus a white flash on the
// tapped element (feature or building). Purely visual and transient — the
// renderer samples the curves each frame; re-tapping restarts the punch.

const DURATION_MS = 300;

export interface PunchSample {
  sx: number; // horizontal scale factor
  sy: number; // vertical scale factor
  flash: number; // 0..1 — drives the white/brightness flash
}

export class TapFx {
  private punches = new Map<string, number>(); // anchor coordKey → start ms
  private readonly clock: () => number;

  constructor(clock: () => number = () => performance.now()) {
    this.clock = clock;
  }

  add(anchorKey: string): void {
    this.punches.set(anchorKey, this.clock());
  }

  /** Current punch state for the sprite anchored at `anchorKey`; null = idle. */
  sample(anchorKey: string): PunchSample | null {
    const startedAt = this.punches.get(anchorKey);
    if (startedAt === undefined) return null;
    const t = this.clock() - startedAt;
    if (t >= DURATION_MS) {
      this.punches.delete(anchorKey);
      return null;
    }
    const k = t / DURATION_MS;
    const decay = Math.exp(-4.5 * k);
    return {
      // Different curves per axis: on impact the element squashes (wide and
      // short), then rebounds past 1 at different rates before settling.
      sx: 1 + 0.22 * decay * Math.cos(k * Math.PI * 3),
      sy: 1 - 0.28 * decay * Math.cos(k * Math.PI * 3.8),
      flash: Math.exp(-7 * k),
    };
  }
}
