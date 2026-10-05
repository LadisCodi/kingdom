// THE QUEST SCROLL'S ROLL — the parchment unrolling under its words, and
// rolling back up (ui/questPill.ts). Kept apart from the pill so it can be
// driven without a DOM: it needs only something that animates.
//
// A roll is decoration, never a gate. An animation can be cancelled (its
// promise rejects) or frozen (a backgrounded page stops the animation clock),
// and the pill used to wait on one for ever with its words faded out — a
// blank scroll that no later quest repaired (Docs/plans/ux-pass.md §2.2).
// So every wait here ends: on the animation, or on its own length plus a
// margin, whichever comes first, and never throws.

/** What a roll animates: the parchment, or the words on it. */
export interface Animated {
  animate(keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation;
  getAnimations(): Animation[];
}

/** The unroll, in ms. The words start before the parchment is fully open. */
const OPEN_MS = 520;
const WORDS_IN_AT = 360;
const WORDS_MS = 200;
const CLOSE_WORDS_MS = 160;
const CLOSE_MS = 420;
/** How narrow the rolled-up scroll is: its two rollers side by side. */
const ROLLED = 0.16;
/** How long past its own length a wait holds on before giving up on it. */
const SLACK_MS = 250;

const sleep = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms); });

/** The animation's end, or its length plus the slack — whichever is first. */
const ended = (anim: Animation, ms: number): Promise<void> =>
  Promise.race([anim.finished.then(() => undefined, () => undefined), sleep(ms + SLACK_MS)]);

export class ScrollRoll {
  constructor(
    private readonly base: Animated,
    private readonly content: Animated,
    /** Reduced motion: every phase takes no time. */
    private readonly calm: () => boolean,
    private readonly sound: (name: 'scrollOpen' | 'scrollClose') => void,
  ) {}

  /** The parchment opens, then the words fade in. Holds nothing at its end. */
  async unroll(): Promise<void> {
    const fast = this.calm();
    this.base.animate([
      { width: `${ROLLED * 100}%`, opacity: 0 },
      { width: '100%', opacity: 1 },
    ], { duration: fast ? 0 : OPEN_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'backwards' });
    const words = this.content.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: fast ? 0 : WORDS_MS, delay: fast ? 0 : WORDS_IN_AT, fill: 'backwards',
    });
    if (!fast) this.sound('scrollOpen');
    await ended(words, fast ? 0 : WORDS_IN_AT + WORDS_MS);
  }

  /** The words fade out, then the parchment closes. Both HOLD their end —
   *  the scroll stays rolled up — until `settle()`. */
  async rollUp(): Promise<void> {
    const fast = this.calm();
    if (!fast) this.sound('scrollClose');
    await ended(this.content.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: fast ? 0 : CLOSE_WORDS_MS, fill: 'forwards',
    }), fast ? 0 : CLOSE_WORDS_MS);
    await ended(this.base.animate([
      { width: '100%', opacity: 1 },
      { width: `${ROLLED * 100}%`, opacity: 0 },
    ], { duration: fast ? 0 : CLOSE_MS, easing: 'cubic-bezier(0.6, 0, 0.8, 0.4)', fill: 'forwards' }),
    fast ? 0 : CLOSE_MS);
  }

  /** Drop every roll, running or held: the scroll as its stylesheet draws
   *  it, open and its words at full opacity. */
  settle(): void {
    for (const a of this.all()) a.cancel();
  }

  /** Drop any roll that ended but still holds its end state — a roll-up
   *  nothing settled. A running roll is left to finish. */
  heal(): void {
    for (const a of this.all()) if (a.playState === 'finished') a.cancel();
  }

  private all(): Animation[] {
    return [...this.base.getAnimations(), ...this.content.getAnimations()];
  }
}
