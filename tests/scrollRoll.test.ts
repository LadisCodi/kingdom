// The quest scroll's roll (ui/scrollRoll.ts) is decoration, never a gate: a
// roll whose animation is cancelled or frozen must still END, and nothing it
// leaves behind may hold the words faded out. A wait that never ended was the
// blank scroll of Docs/plans/ux-pass.md §2.2.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollRoll, type Animated } from '../src/ui/scrollRoll';

type Fate = 'finish' | 'cancel' | 'freeze';

/** A stand-in for an element: each animation it starts meets `fate`. A
 *  finished animation that fills forwards stays listed, holding its end. */
class FakeElement implements Animated {
  fate: Fate = 'finish';
  readonly live: Array<Animation & { holds: boolean }> = [];

  animate(_k: Keyframe[], options: KeyframeAnimationOptions): Animation {
    const holds = options.fill === 'forwards' || options.fill === 'both';
    let settle!: (v: unknown) => void;
    let fail!: (e: unknown) => void;
    const finished = new Promise((res, rej) => { settle = res; fail = rej; });
    finished.catch(() => undefined);
    const anim = {
      holds,
      playState: 'running' as AnimationPlayState,
      finished,
      cancel: () => {
        anim.playState = 'idle';
        this.live.splice(this.live.indexOf(anim as never), 1);
        fail(new DOMException('cancelled', 'AbortError'));
      },
    };
    this.live.push(anim as never);
    if (this.fate === 'finish') {
      anim.playState = 'finished';
      if (!holds) this.live.splice(this.live.indexOf(anim as never), 1);
      settle(anim);
    } else if (this.fate === 'cancel') {
      anim.cancel();
    }
    return anim as unknown as Animation;
  }

  getAnimations(): Animation[] {
    return [...this.live];
  }
}

const setup = () => {
  const base = new FakeElement();
  const content = new FakeElement();
  const roll = new ScrollRoll(base, content, () => false, () => undefined);
  return { base, content, roll };
};

/** Does `p` settle within `ms` of fake time? */
const endsWithin = async (p: Promise<unknown>, ms: number): Promise<boolean> => {
  let done = false;
  void p.then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(ms);
  return done;
};

describe('the quest scroll roll', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('rolls up and holds it, until settled', async () => {
    const { content, roll } = setup();
    expect(await endsWithin(roll.rollUp(), 0)).toBe(true);
    expect(content.getAnimations()).toHaveLength(1); // the words held faded out
    roll.settle();
    expect(content.getAnimations()).toHaveLength(0);
  });

  it('ends a roll-up whose animations are cancelled, without throwing', async () => {
    const { base, content, roll } = setup();
    base.fate = content.fate = 'cancel';
    expect(await endsWithin(roll.rollUp(), 0)).toBe(true);
  });

  it('ends a roll-up whose animations never finish, a moment after their length', async () => {
    const { base, content, roll } = setup();
    base.fate = content.fate = 'freeze';
    const p = roll.rollUp();
    expect(await endsWithin(p, 160 + 420)).toBe(false); // their own length is not enough…
    expect(await endsWithin(p, 600)).toBe(true); // …but a moment more is
  });

  it('ends an unroll whose words never finish', async () => {
    const { content, roll } = setup();
    content.fate = 'freeze';
    expect(await endsWithin(roll.unroll(), 360 + 200 + 300)).toBe(true);
  });

  it('heals a held roll-up, but leaves a running roll to finish', async () => {
    const { base, content, roll } = setup();
    await roll.rollUp(); // nothing settled it: the words stay faded out
    expect(content.getAnimations()).toHaveLength(1);
    base.fate = 'freeze';
    void roll.unroll(); // the parchment's open is still running
    roll.heal();
    expect(content.getAnimations()).toHaveLength(0);
    expect(base.getAnimations().some((a) => a.playState === 'running')).toBe(true);
  });
});
