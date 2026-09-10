// The reveal — what a call paid, shown one prize at a time
// (Docs/features/10-heroes.md §8.3).
//
// NOT an overlay, for the reason the rewarded video is not one: `#overlay`
// has a z-index and is therefore a stacking context, so nothing inside it can
// rise above the nav bar. A reward the player can tap around is not a reward.
// This is its own mount at the end of `#ui`, which also makes "the only way
// out is through" structural rather than a rule — `dismiss()` and the
// tap-beside-a-sheet handler cannot reach a surface they do not own.
//
// THE SEQUENCE IS THE POINT. A call is the one moment in the game the player
// paid for a surprise, and a finished grid handed over all at once is a
// receipt. So the tiles land one after another, and the prompt to leave only
// appears once the last one has — a screen that says "tap to continue" while
// it is still dealing is asking to be skipped past.
//
// A hero interrupts. When the next tile would be a hero the sequence stops
// and the hero takes the whole screen, because a roster entry arriving is a
// different size of event from four fragments and must not be a tile the
// player's thumb is already moving past.

import { ARTIFACTS, HEROES } from '../sim/data/definitions';
import { playSfx } from '../audio/sfx';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { Game, GachaPrize } from '../game';
import type { HeroId } from '../sim/state';
import { el } from './format';
import { iconEl } from './kit';

/** How long between tiles. Long enough to read one, short enough that ten do
 *  not outlast the player's patience — a ten-call deals in about a second. */
const STEP_MS = 110;

const RARITY_CLASS = { Common: 'is-common', Rare: 'is-rare', Legendary: 'is-legendary' } as const;

/** A hero portrait, contained rather than cropped: the sheet is mixed. */
function portrait(id: HeroId, cls: string): HTMLElement {
  const def = HEROES[id];
  const url = spriteUrl(def.sprite);
  return url
    ? spriteImgAt(url, cls)
    : el('div', { class: `${cls} is-glyph` }, def.glyph);
}

/** One prize as a tile. Rarity colours the fragment and hero tiles for the
 *  same reason it colours the roster: the ladder should read before a label
 *  does. A currency has no rarity, so it gets parchment. */
function prizeTile(prize: GachaPrize): HTMLElement {
  if (prize.kind === 'currency') {
    return el('div', { class: 'gr-tile is-currency' },
      iconEl(prize.currency, { size: 'lg' }),
      el('span', { class: 'gr-count' }, String(prize.amount)));
  }
  // A relic's shards, which a room pays and a call never does. Same tile as a
  // hero's fragments, keyed on the relic instead.
  if (prize.kind === 'relicFragments') {
    const relic = ARTIFACTS[prize.artifactId];
    const url = spriteUrl(relic.sprite);
    return el('div', { class: 'gr-tile is-fragment' },
      url ? spriteImgAt(url, 'gr-art')
        : el('div', { class: 'gr-art is-glyph' }, relic.glyph),
      el('span', { class: 'gr-mark' }, iconEl('fragment', { size: 'sm' })),
      el('span', { class: 'gr-count' }, String(prize.amount)));
  }
  const def = HEROES[prize.heroId];
  if (prize.kind === 'hero') {
    // The one tile with a light frame. A hero is not a bigger stack of the
    // tile beside it, and the grid has to say so at a glance.
    return el('div', { class: `gr-tile is-hero ${RARITY_CLASS[def.rarity]}` },
      portrait(prize.heroId, 'gr-art'),
      el('span', { class: 'gr-tag' }, def.name));
  }
  return el('div', { class: `gr-tile is-fragment ${RARITY_CLASS[def.rarity]}` },
    portrait(prize.heroId, 'gr-art'),
    el('span', { class: 'gr-mark' }, iconEl('fragment', { size: 'sm' })),
    el('span', { class: 'gr-count' }, String(prize.amount)));
}

/** The hero interstitial — the whole screen, one face. */
function heroCurtain(id: HeroId): HTMLElement {
  const def = HEROES[id];
  return el('div', { class: `gr-curtain ${RARITY_CLASS[def.rarity]}` },
    el('div', { class: 'gr-curtain-kicker' },
      def.rarity === 'Legendary' ? 'A legend answers' : 'A new hero answers'),
    portrait(id, 'gr-curtain-art'),
    el('div', { class: 'gr-curtain-name' }, def.name),
    el('div', { class: 'gr-curtain-title' }, def.title),
    el('div', { class: 'gr-curtain-rarity' }, def.rarity),
    el('div', { class: 'gr-prompt' }, 'Tap to continue'));
}

export function mountGachaScreen(game: Game, root: HTMLElement): void {
  /** The reveal currently on screen. Identity, not a flag: `notify()` fires
   *  every tick, and rebuilding the screen mid-sequence would restart it. */
  let showing: unknown = null;
  let timer: number | null = null;

  const stop = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const build = (reveal: NonNullable<Game['gachaReveal']>): void => {
    const { prizes } = reveal;
    const tiles = prizes.map((p) => {
      const t = prizeTile(p);
      t.classList.add('is-hidden');
      return t;
    });

    const prompt = el('div', { class: 'gr-prompt is-hidden' }, 'Tap anywhere to finish');
    const curtainSlot = el('div', { class: 'gr-curtain-slot' });
    const screen = el('div', { class: 'gr-screen' },
      el('div', { class: 'gr-plaque' }, 'Rewards'),
      el('div', { class: `gr-grid${prizes.length > 6 ? ' is-dense' : ''}` }, ...tiles),
      el('div', { class: 'gr-calls' }, reveal.caption
        ?? (reveal.calls === 1 ? 'One call' : `${reveal.calls ?? 0} calls`)),
      prompt,
      curtainSlot,
    );

    let next = 0;
    let curtain: HeroId | null = null;

    const showCurtain = (id: HeroId): void => {
      curtain = id;
      curtainSlot.replaceChildren(heroCurtain(id));
      playSfx('chainFinished');
    };

    /** Reveal the next tile. Returns false when it raised a curtain or ran
     *  out — either way the timer has nothing left to do. */
    const revealOne = (): boolean => {
      if (next >= prizes.length) return false;
      const prize = prizes[next]!;
      tiles[next]!.classList.remove('is-hidden');
      next += 1;
      if (prize.kind === 'hero') {
        showCurtain(prize.heroId);
        return false;
      }
      playSfx('click');
      return true;
    };

    const finishSequence = (): void => {
      stop();
      prompt.classList.remove('is-hidden');
    };

    const run = (): void => {
      stop();
      timer = window.setInterval(() => {
        if (!revealOne()) {
          stop();
          if (curtain === null && next >= prizes.length) finishSequence();
        }
      }, STEP_MS);
    };

    /**
     * One tap, three meanings, in this order:
     *   1. a curtain is up  → put it away and carry on dealing
     *   2. still dealing    → deal the rest at once (never skip a curtain)
     *   3. done             → leave
     * Skipping to the end is what every player's thumb tries first, and a
     * screen that ignores it is a screen that feels stuck.
     */
    screen.addEventListener('click', () => {
      if (curtain !== null) {
        curtain = null;
        curtainSlot.replaceChildren();
        if (next >= prizes.length) finishSequence();
        else run();
        return;
      }
      if (next < prizes.length) {
        stop();
        while (revealOne()) { /* deal until a curtain or the end */ }
        if (curtain === null && next >= prizes.length) finishSequence();
        return;
      }
      game.dismissGachaReveal();
    });

    root.replaceChildren(screen);
    run();
  };

  const refresh = (): void => {
    const reveal = game.gachaReveal;
    if (reveal === null) {
      if (showing !== null) {
        stop();
        root.replaceChildren();
        showing = null;
      }
      return;
    }
    if (reveal === showing) return; // mid-sequence; leave it alone
    showing = reveal;
    build(reveal);
  };

  game.onChange(refresh);
  refresh();
}
