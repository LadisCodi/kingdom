// THE TOAST SHELF — one slip per message (Docs/plans/ux-pass.md §2.11).
// Two identical refusals used to stack, the first fading under the second;
// a message already on screen now starts its life over instead, so a player
// tapping the same refused thing sees one slip that stays while they do.
//
// Kept apart from the DOM so it can be driven without one: it is handed how
// to put a slip up, and the slip says how to restart and take itself down.

/** A slip on screen. */
export interface Slip {
  /** Play its entrance and fade from the start again. */
  restart(): void;
  remove(): void;
}

export class ToastShelf {
  private readonly up = new Map<string, { slip: Slip; timer: ReturnType<typeof setTimeout> }>();

  constructor(
    private readonly put: (msg: string) => Slip,
    /** How long a slip stays: its CSS fade's length. */
    private readonly lifeMs: number,
  ) {}

  show(msg: string): void {
    const shown = this.up.get(msg);
    if (shown !== undefined) {
      clearTimeout(shown.timer);
      shown.slip.restart();
      shown.timer = this.expire(msg, shown.slip);
      return;
    }
    const slip = this.put(msg);
    this.up.set(msg, { slip, timer: this.expire(msg, slip) });
  }

  /** How many slips are on screen. */
  get count(): number {
    return this.up.size;
  }

  private expire(msg: string, slip: Slip): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      slip.remove();
      this.up.delete(msg);
    }, this.lifeMs);
  }
}
