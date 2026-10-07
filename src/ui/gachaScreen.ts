// The reveal — a chest of random rewards, opened one card at a time
// (Docs/features/10-heroes.md §8.3; mockups m99a–m99d).
//
// NOT an overlay, for the reason the rewarded video is not one: `#overlay`
// has a z-index and is therefore a stacking context, so nothing inside it can
// rise above the nav bar. A reward the player can tap around is not a reward.
// This is its own mount at the end of `#ui`, which also makes "the only way
// out is through" structural rather than a rule.
//
// THE SEQUENCE IS THE POINT. A call is the one moment in the game the player
// paid for a surprise, so it is staged like the genre's chest opening:
//
//   1. the chest drops onto the carpet — silver for the common call, gold for
//      the golden one, the relic chest for a fragment pack, the war chest for
//      spoils — with a count of what is inside;
//   2. a tap turns the key and throws the lid; the first card rises out of it
//      face down;
//   3. a tap flips it;
//   4. the next tap sends it to its own place on the stage — smaller, a little
//      dimmed — while the next card rises. The places are the summary: when
//      the last card lands they all light up, the chest sinks away and the
//      only thing left to do is Collect. There is no receipt drawn afterwards.
//
// A NEW HERO is a bigger event than a stack of fragments and is staged as one:
// its card back glows in its rarity before the flip (a Legendary's rises with
// a drum roll), and the flip raises rays, confetti and a plaque. Skip deals
// everything else at once and still stops at every new hero.
//
// Presentation only: the sim paid everything before this mounted, so a reveal
// cut short (a reload, a closed tab) loses nothing but the show.

import { ARTIFACTS, HEROES } from '../sim/data/definitions';
import { fragmentArt } from './relicSheet';
import { playSfx, type SfxName } from '../audio/sfx';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { Game, GachaPrize, GachaReveal } from '../game';
import type { CurrencyId, HeroId } from '../sim/state';
import { el, formatExact } from './format';
import { heroFragmentIcon } from './heroFragment';
import { btn, iconEl } from './kit';
import { particleLayer, type ParticleLayer } from './particles';

const RARITY_CLASS = { Common: 'is-common', Rare: 'is-rare', Legendary: 'is-legendary' } as const;

/** Each rarity's light: the glow on a card back, the sparks of its flip. */
const RARITY_LIGHT = {
  Common: ['#bfe3f5', '#7fc3e6', '#ffffff'],
  Rare: ['#d9c4ff', '#a98be6', '#ffffff'],
  Legendary: ['#ffe9a8', '#f2b233', '#fff6da'],
} as const;
const GOLD = ['#ffe9a8', '#f2b233', '#ffd36b', '#fff6da'];
const CONFETTI = ['#f2b233', '#ffd36b', '#d4553e', '#4fa3c7', '#6fbf4a', '#fff6e0'];

const calm = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** The id, made readable — `SilverKey` → "Silver key" (as purseSheet.ts). */
const currencyName = (c: CurrencyId): string =>
  c.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/ (\w)/g, (_, ch: string) => ` ${ch.toLowerCase()}`);

/** A hero portrait, contained rather than cropped: the sheet is mixed. */
function portrait(id: HeroId, cls: string): HTMLElement {
  const def = HEROES[id];
  const url = spriteUrl(def.sprite);
  return url ? spriteImgAt(url, cls) : el('div', { class: `${cls} is-glyph` }, def.glyph);
}

/** The new hero a prize is, if it is one — the only prize staged as an event. */
const newHero = (p: GachaPrize): HeroId | null => (p.kind === 'hero' ? p.heroId : null);

/** How loud a prize is: its rarity where it has one. */
function rarityOf(p: GachaPrize): keyof typeof RARITY_LIGHT | null {
  if (p.kind === 'hero' || p.kind === 'fragments') return HEROES[p.heroId].rarity;
  if (p.kind === 'relicFragment' && p.slot === 5) return 'Legendary';
  return null;
}

/** One prize as a card: a back and a face, flipped by its inner. */
function prizeCard(prize: GachaPrize): HTMLElement {
  const count = (n: number, mark?: Node): HTMLElement =>
    el('div', { class: 'gr-card-count' }, ...(mark ? [mark] : []), `×${formatExact(n)}`);
  let cls = '';
  let face: Node[];
  if (prize.kind === 'currency') {
    cls = 'is-currency';
    face = [
      el('div', { class: 'gr-card-art' }, iconEl(prize.currency, { size: 'lg' })),
      el('div', { class: 'gr-card-name' }, currencyName(prize.currency)),
      count(prize.amount),
    ];
  } else if (prize.kind === 'relicFragment') {
    const def = ARTIFACTS[prize.relic];
    cls = `is-relic${prize.slot === 5 ? ' is-legendary is-keystone' : ''}`;
    face = [
      el('div', { class: 'gr-card-art' }, fragmentArt(def.sprite, prize.slot, 'gr-card-img')),
      el('div', { class: 'gr-card-name' }, def.name.replace(/^The /, '')),
      count(prize.amount),
    ];
  } else {
    const def = HEROES[prize.heroId];
    if (prize.kind === 'hero') {
      cls = `is-hero ${RARITY_CLASS[def.rarity]}`;
      face = [
        el('div', { class: 'gr-card-art' }, portrait(prize.heroId, 'gr-card-img')),
        el('div', { class: 'gr-card-new' }, 'New'),
        el('div', { class: 'gr-card-name' }, def.name.replace(/^The /, '')),
      ];
    } else {
      cls = `is-fragments ${RARITY_CLASS[def.rarity]}`;
      face = [
        el('div', { class: 'gr-card-art' }, portrait(prize.heroId, 'gr-card-img')),
        el('div', { class: 'gr-card-name' }, def.name.replace(/^The /, '')),
        count(prize.amount, heroFragmentIcon(prize.heroId, { size: 'sm' })),
      ];
    }
  }
  return el('div', { class: `gr-card ${cls} is-down is-hidden` },
    el('div', { class: 'gr-card-inner' },
      el('div', { class: 'gr-card-back' }),
      el('div', { class: 'gr-card-face' }, ...face)));
}

/** How many across, for how many cards — and how wide each is, in --px. */
function boardShape(n: number): { cols: number; width: number } {
  if (n <= 3) return { cols: Math.max(1, n), width: 104 };
  if (n <= 6) return { cols: 3, width: 100 };
  if (n <= 12) return { cols: 4, width: 82 };
  return { cols: 5, width: 66 };
}

export function mountGachaScreen(game: Game, root: HTMLElement): void {
  /** The reveal currently on screen. Identity, not a flag: `notify()` fires
   *  every tick, and rebuilding the screen mid-sequence would restart it. */
  let showing: GachaReveal | null = null;
  let fx: ParticleLayer | null = null;

  const teardown = (): void => {
    fx?.destroy();
    fx = null;
    root.replaceChildren();
  };

  const build = (reveal: GachaReveal): void => {
    teardown();
    const quiet = calm();
    const { prizes } = reveal;
    const cards = prizes.map(prizeCard);
    const shape = boardShape(cards.length);

    const board = el('div', { class: 'gr-board' }, ...cards);
    board.style.setProperty('--cols', String(shape.cols));
    board.style.setProperty('--cw', `calc(var(--px) * ${shape.width})`);

    const left = el('div', { class: 'gr-left' }, formatExact(prizes.length));
    const chest = el('div', { class: `gr-chest is-${reveal.chest} is-closed` },
      el('div', { class: 'gr-chest-art' }),
      el('div', { class: 'gr-key' }),
      left);
    const rays = el('div', { class: 'gr-rays' });
    const kicker = el('div', { class: 'gr-kicker' });
    const heroLine = el('div', { class: 'gr-heroline' });
    const prompt = el('div', { class: 'gr-prompt' });
    const title = el('div', { class: 'gr-title' },
      el('div', { class: 'gr-plaque' }, 'Rewards'),
      el('div', { class: 'gr-calls' }, reveal.caption
        ?? (reveal.calls === 1 ? 'One call' : `${formatExact(reveal.calls ?? 0)} calls`)));
    const collect = btn({ label: 'Collect', kind: 'primary', onClick: () => game.dismissGachaReveal() });
    const foot = el('div', { class: 'gr-foot' }, collect);
    const skip = el('button', { class: 'gr-skip', type: 'button' }, 'Skip');

    const screen = el('div', { class: `gr-screen is-${reveal.chest}` },
      rays, board, chest, kicker, heroLine, prompt, title, foot, skip);
    root.replaceChildren(screen);
    fx = quiet ? null : particleLayer(screen, 'gr-fx');
    const layer = fx;

    // ------------------------------------------------------------ pacing

    /** Every animation still running, so a tap can finish them at once:
     *  hurrying is what a thumb tries first, and a screen that ignores it
     *  feels stuck. */
    const running = new Set<Animation>();
    let skipping = false;
    /** Durations scale by this: reduced motion all but removes them, Skip
     *  shortens them. */
    const pace = (): number => (quiet ? 0.01 : skipping ? 0.35 : 1);

    const play = (node: Element, frames: Keyframe[], ms: number, easing = 'cubic-bezier(.2,.8,.2,1)'): Promise<void> => {
      const a = node.animate(frames, { duration: Math.max(1, ms * pace()), easing, fill: 'forwards' });
      running.add(a);
      return a.finished.then(() => { running.delete(a); }, () => { running.delete(a); });
    };
    const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms * pace()));
    const hurry = (): void => { for (const a of [...running]) a.finish(); };
    const sfx = (name: SfxName): void => { if (!skipping || name !== 'cardWhoosh') playSfx(name); };

    const screenRect = (): DOMRect => screen.getBoundingClientRect();
    /** A point on the screen, in the particle canvas's coordinates. */
    const at = (r: DOMRect, fx0 = 0.5, fy = 0.5): [number, number] => {
      const s = screenRect();
      return [r.left - s.left + r.width * fx0, r.top - s.top + r.height * fy];
    };

    /** Where a card stands while it is being looked at: the middle of the
     *  stage, big — as a transform from its own slot, so flying it home is
     *  just letting the transform go. */
    const centreOf = (card: HTMLElement): string => {
      const s = screenRect();
      const r = card.getBoundingClientRect();
      const bigW = Math.min(s.width * 0.54, (s.height * 0.38) / 1.5);
      const k = bigW / r.width;
      const dx = s.left + s.width / 2 - (r.left + r.width / 2);
      const dy = s.top + s.height * 0.4 - (r.top + r.height / 2);
      return `translate(${dx}px, ${dy}px) scale(${k})`;
    };
    const chestMouthOf = (card: HTMLElement): string => {
      const c = chest.getBoundingClientRect();
      const r = card.getBoundingClientRect();
      const dx = c.left + c.width / 2 - (r.left + r.width / 2);
      const dy = c.top + c.height * 0.45 - (r.top + r.height / 2);
      return `translate(${dx}px, ${dy}px) scale(0.3) rotate(-8deg)`;
    };

    // ------------------------------------------------------------- state

    type Phase = 'landing' | 'closed' | 'busy' | 'down' | 'up' | 'done';
    let phase: Phase = 'landing';
    let next = 0; // the next card to come out of the chest
    let current: HTMLElement | null = null;
    let currentAt = '';
    let currentPrize: GachaPrize | null = null;

    const say = (text: string): void => {
      prompt.textContent = text;
      prompt.classList.toggle('is-on', text !== '');
    };
    const syncSkip = (): void => {
      skip.classList.toggle('is-on', phase !== 'landing' && phase !== 'done' && !skipping && cards.length - next > 1);
    };

    // 1. The chest lands.
    const land = async (): Promise<void> => {
      layer?.ambient(true);
      await play(chest, [
        { transform: 'translateY(-130%) scale(0.9)', opacity: 0 },
        { transform: 'translateY(0) scale(1.05, 0.92)', opacity: 1, offset: 0.72 },
        { transform: 'translateY(-4%) scale(0.98, 1.03)', offset: 0.86 },
        { transform: 'none', opacity: 1 },
      ], 620, 'ease-in');
      playSfx('chestLand');
      const r = chest.getBoundingClientRect();
      const [x, y] = at(r, 0.5, 0.88);
      layer?.burst(x - r.width * 0.3, y, { kind: 'dust', count: 9, colors: ['rgba(214, 186, 140, 0.8)'], speed: 90, angle: Math.PI, spread: 0.9, size: 14, life: 900 });
      layer?.burst(x + r.width * 0.3, y, { kind: 'dust', count: 9, colors: ['rgba(214, 186, 140, 0.8)'], speed: 90, angle: 0, spread: 0.9, size: 14, life: 900 });
      phase = 'closed';
      say('Tap to open');
      syncSkip();
    };

    // 2. The key turns, the lid flies.
    const open = async (): Promise<void> => {
      phase = 'busy';
      say('');
      syncSkip();
      const keyed = reveal.chest === 'common' || reveal.chest === 'golden';
      if (keyed) {
        const key = chest.querySelector('.gr-key')!;
        await play(key, [
          { transform: 'translate(60%, 0) rotate(0deg)', opacity: 0 },
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, offset: 0.45 },
          { transform: 'translate(0, 0) rotate(90deg)', opacity: 1 },
        ], 520);
        playSfx('chestUnlock');
      }
      const art = chest.querySelector('.gr-chest-art')!;
      await play(art, [
        { transform: 'none' }, { transform: 'rotate(-3deg) scale(1.03)' }, { transform: 'rotate(3deg) scale(1.05)' },
        { transform: 'rotate(-2deg) scale(1.07)' }, { transform: 'none' },
      ], 360, 'linear');
      chest.classList.replace('is-closed', 'is-open');
      playSfx('chestOpen');
      const r = chest.getBoundingClientRect();
      const [x, y] = at(r, 0.5, 0.42);
      layer?.burst(x, y, { kind: 'spark', count: 26, colors: GOLD, speed: 260, angle: -Math.PI / 2, spread: 2.2, size: 9, life: 900, gravity: 160 });
      layer?.burst(x, y, { kind: 'mote', count: 14, colors: ['rgba(255, 210, 120, 0.9)'], speed: 120, angle: -Math.PI / 2, spread: 1.6, size: 4, life: 1300 });
      await play(chest.querySelector('.gr-chest-art')!, [{ transform: 'scale(1.1, 0.94)' }, { transform: 'none' }], 240);
      await draw();
    };

    // The next card rises out of the chest, face down.
    const draw = async (): Promise<void> => {
      phase = 'busy';
      const card = cards[next]!;
      const prize = prizes[next]!;
      next += 1;
      left.textContent = formatExact(cards.length - next);
      left.classList.toggle('is-empty', cards.length - next === 0);
      current = card;
      currentPrize = prize;
      card.style.transform = '';
      card.classList.remove('is-hidden');
      currentAt = centreOf(card);
      const charged = newHero(prize) !== null || (prize.kind === 'relicFragment' && prize.slot === 5);
      const rarity = rarityOf(prize);
      if (charged && rarity !== null) card.classList.add('is-charged', `glow-${rarity.toLowerCase()}`);
      sfx('cardDraw');
      await play(card, [
        { transform: chestMouthOf(card), opacity: 0 },
        { transform: `${currentAt} translateY(-8%)`, opacity: 1, offset: 0.72 },
        { transform: currentAt, opacity: 1 },
      ], 560);
      card.style.transform = currentAt;
      card.classList.add('is-centre');
      if (charged && rarity === 'Legendary') playSfx('heroRiser');
      phase = 'down';
      say('Tap to reveal');
      syncSkip();
      if (skipping && !charged) await flip();
    };

    // 3. The flip.
    const flip = async (): Promise<void> => {
      if (current === null || currentPrize === null) return;
      phase = 'busy';
      say('');
      const card = current;
      const prize = currentPrize;
      const inner = card.querySelector('.gr-card-inner')!;
      sfx('cardFlip');
      await play(inner, [
        { transform: 'rotateY(180deg) scale(1)' },
        { transform: 'rotateY(90deg) scale(1.12)' },
        { transform: 'rotateY(0deg) scale(1)' },
      ], 420, 'ease-in-out');
      card.classList.remove('is-down', 'is-charged');
      const r = card.getBoundingClientRect();
      const [x, y] = at(r);
      const hero = newHero(prize);
      const rarity = rarityOf(prize);
      if (hero !== null) {
        const def = HEROES[hero];
        rays.className = `gr-rays is-on ${RARITY_CLASS[def.rarity]}`;
        kicker.textContent = def.rarity === 'Legendary' ? 'A legend answers' : 'A new hero answers';
        kicker.classList.add('is-on');
        heroLine.replaceChildren(
          el('div', { class: 'gr-heroline-title' }, def.title),
          el('div', { class: `gr-heroline-rarity ${RARITY_CLASS[def.rarity]}` }, def.rarity));
        heroLine.classList.add('is-on');
        playSfx(def.rarity === 'Legendary' ? 'heroLegend' : 'heroNew');
        layer?.burst(x, y, { kind: 'spark', count: 40, colors: RARITY_LIGHT[def.rarity], speed: 380, size: 12, life: 1100 });
        layer?.burst(x, r.top - screenRect().top, { kind: 'confetti', count: def.rarity === 'Legendary' ? 110 : 70, colors: CONFETTI, speed: 420, angle: -Math.PI / 2, spread: 2.4, size: 11, life: 2600, gravity: 420 });
        await play(card, [{ transform: currentAt }, { transform: `${currentAt} scale(1.1)` }, { transform: currentAt }], 380);
        phase = 'up';
        say('Tap to continue');
        syncSkip();
        return;
      }
      if (rarity === 'Rare' || rarity === 'Legendary') {
        sfx('cardSparkle');
        layer?.burst(x, y, { kind: 'spark', count: 22, colors: RARITY_LIGHT[rarity], speed: 300, size: 10, life: 900 });
      } else {
        layer?.burst(x, y, { kind: 'spark', count: 12, colors: GOLD, speed: 220, size: 8, life: 700 });
      }
      await play(card, [{ transform: currentAt }, { transform: `${currentAt} scale(1.06)` }, { transform: currentAt }], 260);
      phase = 'up';
      say('');
      syncSkip();
      if (skipping) await settle();
    };

    // 4. Home: the card flies to its place and the next one rises.
    const settle = async (): Promise<void> => {
      if (current === null) return;
      phase = 'busy';
      say('');
      rays.classList.remove('is-on');
      kicker.classList.remove('is-on');
      heroLine.classList.remove('is-on');
      const card = current;
      current = null;
      currentPrize = null;
      card.classList.remove('is-centre');
      sfx('cardWhoosh');
      const home = play(card, [{ transform: currentAt }, { transform: 'none' }], 440, 'cubic-bezier(.5,0,.2,1)')
        .then(() => {
          card.style.transform = '';
          card.getAnimations().forEach((a) => a.cancel());
          card.classList.add('is-dim');
          sfx('cardSettle');
          const [x, y] = at(card.getBoundingClientRect());
          layer?.burst(x, y, { kind: 'spark', count: 5, colors: GOLD, speed: 90, size: 5, life: 450 });
        });
      if (next < cards.length) {
        await wait(120);
        await Promise.all([home, draw()]);
      } else {
        await home;
        await finish();
      }
    };

    // The last card is home: the chest sinks, every card lights, Collect.
    const finish = async (): Promise<void> => {
      phase = 'busy';
      skipping = false;
      syncSkip();
      say('');
      await play(chest, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(35%) scale(0.9)', opacity: 0 }], 420, 'ease-in');
      chest.style.visibility = 'hidden';
      layer?.ambient(false);
      // The cards are already where they belong; only the block moves, to
      // the middle between the plaque and the button.
      screen.classList.add('is-done');
      const t = title.getBoundingClientRect();
      const f = foot.getBoundingClientRect();
      const b = board.getBoundingClientRect();
      const dy = (t.bottom + f.top) / 2 - (b.top + b.height / 2);
      const settleBoard = Math.abs(dy) > 4
        ? play(board, [{ transform: 'none' }, { transform: `translateY(${dy}px)` }], 420)
        : Promise.resolve();
      playSfx('chestSummary');
      cards.forEach((card, i) => window.setTimeout(() => {
        card.classList.remove('is-dim');
        card.classList.add('is-lit');
        const [x, y] = at(card.getBoundingClientRect());
        layer?.burst(x, y, { kind: 'spark', count: 6, colors: GOLD, speed: 120, size: 7, life: 600 });
      }, i * 70 * pace()));
      await settleBoard;
      phase = 'done';
    };

    // ------------------------------------------------------------- taps

    screen.addEventListener('click', () => {
      if (phase === 'busy' || phase === 'landing') { hurry(); return; }
      if (phase === 'closed') void open();
      else if (phase === 'down') void flip();
      else if (phase === 'up') void settle();
      else if (phase === 'done') game.dismissGachaReveal();
    });
    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      skipping = true;
      syncSkip();
      hurry();
      if (phase === 'closed') void open();
      else if (phase === 'down' && current !== null && !current.classList.contains('is-charged')) void flip();
      else if (phase === 'up' && currentPrize !== null && newHero(currentPrize) === null) void settle();
    });

    void land();
  };

  const refresh = (): void => {
    const reveal = game.gachaReveal;
    if (reveal === null) {
      if (showing !== null) {
        teardown();
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
