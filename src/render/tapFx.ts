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
  /** anchor coordKey → [start ms, strength 0..1]. Strength scales the flash
   *  and the punch together, which is how a WORKER's strike is told apart from
   *  the player's tap: same gesture, quieter. The white flash stays the
   *  player's signature (`Docs/features/04-harvest.md` §4). */
  private punches = new Map<string, [number, number]>();
  private readonly clock: () => number;

  constructor(clock: () => number = () => performance.now()) {
    this.clock = clock;
  }

  /** `strength` 1 = the player's tap; 0 = punch only, no flash at all. */
  add(anchorKey: string, strength = 1): void {
    this.punches.set(anchorKey, [this.clock(), strength]);
  }

  /** Current punch state for the sprite anchored at `anchorKey`; null = idle. */
  sample(anchorKey: string): PunchSample | null {
    const punch = this.punches.get(anchorKey);
    if (punch === undefined) return null;
    const [startedAt, strength] = punch;
    const t = this.clock() - startedAt;
    if (t >= DURATION_MS) {
      this.punches.delete(anchorKey);
      return null;
    }
    const k = t / DURATION_MS;
    const decay = Math.exp(-4.5 * k) * strength;
    return {
      // Different curves per axis: on impact the element squashes (wide and
      // short), then rebounds past 1 at different rates before settling.
      sx: 1 + 0.22 * decay * Math.cos(k * Math.PI * 3),
      sy: 1 - 0.28 * decay * Math.cos(k * Math.PI * 3.8),
      // A strike punches without flashing: the flash is what says "that was
      // ME", and a worker doing it thirty times a minute would drown it.
      flash: strength >= 1 ? Math.exp(-7 * k) : 0,
    };
  }
}
