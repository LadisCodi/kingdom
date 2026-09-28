// A claimed reward flies into the header.
//
// The genre's payout: the reward bursts out of the place it was claimed —
// the tapped cell or the tap that claimed it, else the middle of the
// screen — as a handful of
// fragments of each resource, which hang for a beat and then fly in an arc,
// one after another, into that resource's slot in the header. The header
// counts each one in as it lands (hudHold.ts), with a tick and a spark.
//
// How many fragments is the presenter's call (`Game.rewardFragments`): one
// per minute of the city's own production the reward is worth, so a big
// payout looks big against what the player already makes — except a tap of
// fewer than five, which flies one fragment a unit.
//
// Presentation only. The wallet already holds the reward when this starts —
// the sim never waits for an animation — so a flight that is cut short
// (a hidden tab, a reload) loses nothing but the show.

import { playSfx } from '../audio/sfx';
import type { Game } from '../game';
import type { CurrencyId, Wallet } from '../sim/state';
import { hold, release } from './hudHold';
import { currencyIcon } from './kit';

/** The beat between one fragment and the next leaving. */
const STAGGER_MS = 70;
/** The burst out of the claim, then the arc into the header. */
const BURST_MS = 260;
const FLY_MS = 620;
/** Two resources in one reward leave a little apart. */
const BETWEEN_KINDS_MS = 180;
/** A tap older than this is not where the reward was claimed. */
const TAP_FRESH_MS = 1500;
/** Money clinks; goods pop. */
const MONEY: ReadonlySet<CurrencyId> = new Set<CurrencyId>(['Gold', 'Gems']);

const calm = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Where a resource lives in the header, or null when it is not on the plank. */
const slotIcon = (c: CurrencyId): HTMLElement | null => document.querySelector<HTMLElement>(
  c === 'Gems' ? '.hud-gems > .icon'
    : c === 'Mana' ? '.hud-mana > .icon'
      : `.hud-coin[data-currency="${c}"] > .icon`,
);

interface Point { x: number; y: number }

/** Split `amount` into `n` whole shares that add back up to it exactly. */
const shares = (amount: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) =>
    Math.floor((amount * (i + 1)) / n) - Math.floor((amount * i) / n));

export function mountRewardFly(game: Game, layer: HTMLElement): void {
  // The tap that claimed the reward is where it bursts from. Captured before
  // anything else sees it, so a handler that stops propagation cannot hide it.
  let lastTap: (Point & { at: number }) | null = null;
  document.addEventListener('pointerdown', (e) => {
    lastTap = { x: e.clientX, y: e.clientY, at: performance.now() };
  }, { capture: true, passive: true });

  /** A point in the layer's own coordinates. */
  const local = (x: number, y: number): Point => {
    const frame = layer.getBoundingClientRect();
    return { x: x - frame.left, y: y - frame.top };
  };
  const centreOf = (el: Element): Point => {
    const r = el.getBoundingClientRect();
    return local(r.left + r.width / 2, r.top + r.height / 2);
  };
  const origin = (): Point => {
    const frame = layer.getBoundingClientRect();
    const tap = lastTap;
    if (tap !== null && performance.now() - tap.at < TAP_FRESH_MS
      && tap.x >= frame.left && tap.x <= frame.right && tap.y >= frame.top && tap.y <= frame.bottom) {
      return local(tap.x, tap.y);
    }
    return { x: frame.width / 2, y: frame.height / 2 };
  };
  /** One reference pixel, in CSS px (tokens.css's --rpx). */
  const rpx = () => layer.getBoundingClientRect().width / 1125;

  const spawn = (cls: string, at: Point, ...children: Node[]): HTMLElement => {
    const node = document.createElement('div');
    node.className = cls;
    node.style.left = `${at.x}px`;
    node.style.top = `${at.y}px`;
    node.append(...children);
    layer.append(node);
    return node;
  };

  /** The soft flash the reward leaves the claim with. */
  const flash = (at: Point) => {
    const ring = spawn('rf-ring', at);
    ring.animate([
      { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0.9 },
      { transform: 'translate(-50%, -50%) scale(1.7)', opacity: 0 },
    ], { duration: 420, easing: 'ease-out' }).finished.then(() => ring.remove(), () => ring.remove());
  };

  /** Sparks where a fragment lands. */
  const sparks = (at: Point) => {
    const u = rpx();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 + Math.random() * 0.6;
      const d = (26 + Math.random() * 22) * u;
      const spark = spawn('rf-spark', at);
      spark.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0.2)`, opacity: 0 },
      ], { duration: 360, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' })
        .finished.then(() => spark.remove(), () => spark.remove());
    }
  };

  /** The slot swells a little each time something lands in it. */
  const pulse = (icon: HTMLElement) => {
    icon.animate([
      { transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' },
    ], { duration: 220, easing: 'ease-out' });
  };

  /**
   * The whole path of one fragment as keyframes: out of the claim to a spot
   * of its own (the burst), a hang, then a quadratic arc into the slot that
   * speeds up as it goes, shrinking a little on the way in.
   */
  const path = (from: Point, to: Point): Keyframe[] => {
    const u = rpx();
    const angle = Math.random() * Math.PI * 2;
    const spread = (40 + Math.random() * 50) * u;
    const out = { x: from.x + Math.cos(angle) * spread, y: from.y + Math.sin(angle) * spread };
    // The arc bows sideways and up, a different amount for each fragment, so
    // a run of them reads as a stream rather than a queue on one line.
    const bow = (120 + Math.random() * 160) * u * (Math.random() < 0.5 ? -1 : 1);
    const ctrl = { x: (out.x + to.x) / 2 + bow, y: Math.min(out.y, to.y) - 60 * u };
    const total = BURST_MS + FLY_MS;
    const burstEnd = BURST_MS / total;
    const at = (p: Point, scale: number, opacity: number, offset: number): Keyframe => ({
      offset,
      opacity,
      transform: `translate(${p.x - from.x}px, ${p.y - from.y}px) translate(-50%, -50%) scale(${scale})`,
    });
    const frames: Keyframe[] = [
      at(from, 0.3, 0, 0),
      at(out, 1.1, 1, burstEnd * 0.7),
      at(out, 1, 1, burstEnd),
    ];
    const STEPS = 12;
    for (let s = 1; s <= STEPS; s++) {
      const k = s / STEPS;
      const t = k * k; // ease in: slow off the hang, fast into the slot
      const mt = 1 - t;
      const p = {
        x: mt * mt * out.x + 2 * mt * t * ctrl.x + t * t * to.x,
        y: mt * mt * out.y + 2 * mt * t * ctrl.y + t * t * to.y,
      };
      frames.push(at(p, 1 - 0.35 * k, 1, burstEnd + (1 - burstEnd) * k));
    }
    return frames;
  };

  const fly = (c: CurrencyId, amount: number, from: Point, icon: HTMLElement, delay: number, tap: boolean) => {
    const n = game.rewardFragments(c, amount, tap);
    const parts = shares(amount, n);
    hold(c, amount);
    let owed = amount;
    const pay = (share: number) => {
      const paid = Math.min(owed, share);
      owed -= paid;
      release(c, paid);
    };
    // A flight that never lands (the tab hidden mid-flight freezes its
    // animations) must not keep the header short for ever.
    window.setTimeout(() => pay(owed), delay + n * STAGGER_MS + BURST_MS + FLY_MS + 1500);

    // Re-found each time: the header rebuilds its coins when the set on the
    // plank changes, and a detached icon has no position.
    const slot = () => slotIcon(c) ?? icon;
    parts.forEach((share, i) => {
      window.setTimeout(() => {
        const to = centreOf(slot());
        const frag = spawn('rf-frag', from, currencyIcon(c, { size: 'sm' }));
        frag.animate(path(from, to), { duration: BURST_MS + FLY_MS, fill: 'both' })
          .finished.then(() => {
            frag.remove();
            pay(share);
            pulse(slot());
            sparks(centreOf(slot()));
            // Each landing a shade higher than the last: the run climbs.
            playSfx(MONEY.has(c) ? 'rewardCoin' : 'rewardPop', {
              rate: 1 + i * 0.035, group: 'rewardLand', limit: 4,
            });
          }, () => { frag.remove(); pay(share); });
      }, delay + i * STAGGER_MS);
    });
  };

  game.onReward((haul: Wallet, at?: Point, tap = false) => {
    if (calm()) return; // the header simply shows the new totals
    // A tapped cell's own centre when the presenter knows it (the frame's
    // pixels, which the layer shares — both fill #app), else the tap.
    const from = at ?? origin();
    const flights = (Object.entries(haul) as Array<[CurrencyId, number]>)
      .filter(([, n]) => n > 0)
      .map(([c, n]) => [c, n, slotIcon(c)] as const)
      .filter((f): f is readonly [CurrencyId, number, HTMLElement] => f[2] !== null);
    if (flights.length === 0) return;
    playSfx('rewardBurst');
    flash(from);
    flights.forEach(([c, n, icon], k) => fly(c, n, from, icon, k * BETWEEN_KINDS_MS, tap));
  });
}
