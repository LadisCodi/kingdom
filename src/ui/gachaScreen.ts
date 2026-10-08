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
//      spoils — with a count of what is inside, and opens on its own (the
//      player already paid); the first card rises out of it face down;
//   3. a tap flips it;
//   4. the next tap sends it to its own place on the stage — smaller, a little
//      dimmed — while the next card rises. The places are the summary: when
//      the last card lands they all light up, the chest sinks away and the
//      only thing left to do is Collect. There is no receipt drawn afterwards.
//
// A WHOLE NEW HERO is the rarest thing in a chest and is celebrated: its card
// back glows and trembles over a drum roll, and the flip darkens the room,
// flashes, shakes, raises rays, fires confetti and fireworks and plays a full
// fanfare. Fragments carry a bar under their card; one that reaches the
// recruiting price (Game.openReveal recruits the hero) presses the NEW wax seal on
// and is celebrated the same way. Skip deals everything else at once and
// still stops at every new hero.
//
// A TEN-CALL IS DEALT IN BEATS, not a tap per card (10-heroes.md §8.3): its
// goods — a card per currency, a card per supply family — rise together face
// up and settle in one tap; then the bag card, every hero's bar filling at
// once; then each new hero, one by one.
//
// Presentation only: the sim paid everything before this mounted, so a reveal
// cut short (a reload, a closed tab) loses nothing but the show.

import { ARTIFACTS, HEROES, ITEMS } from '../sim/data/definitions';
import { fragmentArt } from './relicSheet';
import { itemIcon } from './itemArt';
import { itemName } from './itemText';
import { playSfx, type SfxName } from '../audio/sfx';
import { duckFeast, setFeast } from '../audio/music';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { BagRow, FragmentProgress, Game, GachaPrize, GachaReveal, SupplyFamily } from '../game';
import type { CurrencyId, HeroId } from '../sim/state';
import { el, formatExact } from './format';
import { heroFragmentIcon } from './heroFragment';
import { btn, iconEl, progress, type Progress } from './kit';
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

/** The hero a prize brings onto the roster, if it does: a hero card, or
 *  fragments that filled the recruiting bar. The only prizes staged as an
 *  event. */
const newHero = (p: GachaPrize): HeroId | null =>
  p.kind === 'hero' || (p.kind === 'fragments' && p.progress?.recruited === true) ? p.heroId : null;

/** A fragments bar's reading: "8 / 10", or what filling it did. */
const barText = (p: FragmentProgress, n: number): string =>
  p.recruited && n >= p.goal ? 'Recruited!'
    : `${formatExact(p.toward === 'recruit' ? Math.min(n, p.goal) : n)} / ${formatExact(p.goal)}`;

const RARITY_RANK = { Common: 1, Rare: 2, Legendary: 3 } as const;

/** How loud a prize is: its rarity where it has one — the bag card's, its
 *  rarest hero's. */
function rarityOf(p: GachaPrize): keyof typeof RARITY_LIGHT | null {
  if (p.kind === 'hero' || p.kind === 'fragments') return HEROES[p.heroId].rarity;
  if (p.kind === 'relicFragment' && p.slot === 5) return 'Legendary';
  if (p.kind === 'bag') {
    return p.rows.map((r) => HEROES[r.heroId].rarity)
      .reduce<keyof typeof RARITY_LIGHT | null>((best, r) =>
        best === null || RARITY_RANK[r] > RARITY_RANK[best] ? r : best, null);
  }
  return null;
}

const FAMILY_NAME: Record<SupplyFamily, string> = { speedup: 'Speed-ups', chest: 'Chests' };

/** One line of the bag card: the hero (a silhouette until recruited), what
 *  the batch paid them, and their bar. */
function bagRow(row: BagRow, bars: Map<HTMLElement, Progress>): HTMLElement {
  const def = HEROES[row.heroId];
  const missing = row.progress?.toward === 'recruit';
  const line = el('div', { class: `gr-bag-row ${RARITY_CLASS[def.rarity]}${missing ? ' is-missing' : ''}` },
    el('div', { class: 'gr-bag-art' }, portrait(row.heroId, 'gr-card-img')),
    el('div', { class: 'gr-bag-body' },
      el('div', { class: 'gr-bag-name' }, def.name.replace(/^The /, '')),
      el('div', { class: 'gr-bag-count' }, heroFragmentIcon(row.heroId, { size: 'sm' }), `+${formatExact(row.amount)}`)));
  if (row.progress !== undefined) {
    const p = row.progress;
    const bar = progress(p.toward === 'recruit' ? 'gold' : 'blue');
    bar.set(p.from / p.goal, barText(p, p.from));
    bars.set(line, bar);
    line.querySelector('.gr-bag-body')!.append(el('div', { class: 'gr-bag-bar' }, bar.root));
    if (p.recruited) line.append(el('div', { class: 'gr-stamp' }, 'New'));
  }
  return line;
}

/** One prize as a card: a back and a face, flipped by its inner. Fragments
 *  carry their bar UNDER the card (outside the flip), and a recruit the
 *  NEW wax seal pressed onto it when the bar fills. */
function prizeCard(prize: GachaPrize, bars: Map<HTMLElement, Progress>): HTMLElement {
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
  } else if (prize.kind === 'item') {
    cls = 'is-currency is-item';
    face = [
      el('div', { class: 'gr-card-art' }, iconEl(itemIcon(prize.item), { size: 'lg' })),
      el('div', { class: 'gr-card-name' }, itemName(ITEMS[prize.item])),
      count(prize.amount),
    ];
  } else if (prize.kind === 'supplies') {
    cls = 'is-currency is-item is-supplies';
    face = [
      el('div', { class: 'gr-card-name' }, FAMILY_NAME[prize.family]),
      el('div', { class: 'gr-supplies' }, ...prize.items.map((i) => el('div', { class: 'gr-supply' },
        iconEl(itemIcon(i.item), { size: 'md', label: itemName(ITEMS[i.item]) }),
        el('span', {}, `×${formatExact(i.amount)}`)))),
    ];
  } else if (prize.kind === 'bag') {
    cls = 'is-bag';
    face = [
      el('div', { class: 'gr-card-name' }, 'Fragments'),
      el('div', { class: 'gr-bag' }, ...prize.rows.map((r) => bagRow(r, bars))),
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
      // Not on the roster yet: a silhouette, as on the heroes menu — until a
      // call recruits them and the seal brings them into colour.
      const missing = prize.progress?.toward === 'recruit' ? ' is-missing' : '';
      cls = `is-fragments ${RARITY_CLASS[def.rarity]}${missing}`;
      face = [
        el('div', { class: 'gr-card-art' }, portrait(prize.heroId, 'gr-card-img')),
        el('div', { class: 'gr-card-name' }, def.name.replace(/^The /, '')),
        count(prize.amount, heroFragmentIcon(prize.heroId, { size: 'sm' })),
      ];
    }
  }
  // The back says how rare the card is before it turns: the rarer, the more
  // ornate its ink (gacha.css `.ink-n`).
  const rarity = rarityOf(prize);
  const ink = rarity === null ? 0 : { Common: 1, Rare: 2, Legendary: 3 }[rarity];
  const card = el('div', { class: `gr-card ${cls} ink-${ink} is-down is-hidden` },
    el('div', { class: 'gr-card-inner' },
      el('div', { class: 'gr-card-back' }),
      el('div', { class: 'gr-card-face' }, ...face)));
  if (prize.kind === 'bag') card.style.setProperty('--rows', String(Math.ceil(prize.rows.length / 2)));
  if (prize.kind === 'fragments' && prize.progress !== undefined) {
    const p = prize.progress;
    const bar = progress(p.toward === 'recruit' ? 'gold' : 'blue');
    bar.set(p.from / p.goal, barText(p, p.from));
    bars.set(card, bar);
    card.append(el('div', { class: 'gr-card-bar' }, bar.root));
    if (p.recruited) card.append(el('div', { class: 'gr-stamp' }, 'New'));
  }
  return card;
}

/** How many across, for how many cards — and how wide each is, in --px. */
function boardShape(n: number): { cols: number; width: number } {
  if (n <= 3) return { cols: Math.max(1, n), width: 104 };
  if (n <= 6) return { cols: 3, width: 100 };
  if (n <= 12) return { cols: 4, width: 82 };
  return { cols: 5, width: 66 };
}

/** A board whose widest row holds n cards: never narrower than three, so the
 *  bag card spanning it has room for its two columns. */
function rowShape(n: number): { cols: number; width: number } {
  const cols = Math.min(5, Math.max(3, n));
  return { cols, width: cols === 3 ? 100 : cols === 4 ? 82 : 66 };
}

export function mountGachaScreen(game: Game, root: HTMLElement): void {
  /** The reveal currently on screen. Identity, not a flag: `notify()` fires
   *  every tick, and rebuilding the screen mid-sequence would restart it. */
  let showing: GachaReveal | null = null;
  let fx: ParticleLayer | null = null;
  /** The reveal's own timers, cut when it is torn down. */
  let stopTimers: (() => void) | null = null;

  const teardown = (): void => {
    stopTimers?.();
    stopTimers = null;
    fx?.destroy();
    fx = null;
    root.replaceChildren();
  };

  const build = (reveal: GachaReveal): void => {
    teardown();
    const quiet = calm();
    const { prizes } = reveal;
    const bars = new Map<HTMLElement, Progress>();
    const cards = prizes.map((p) => prizeCard(p, bars));
    // A grouped ten-call: the bag takes a row of its own, so the board is as
    // wide as its widest other row.
    const others = prizes.filter((p) => p.kind !== 'bag');
    const shape = prizes.some((p) => p.kind === 'bag')
      ? rowShape(Math.max(others.filter((p) => p.kind !== 'hero').length, others.filter((p) => p.kind === 'hero').length))
      : boardShape(cards.length);

    const board = el('div', { class: 'gr-board' }, ...cards);
    board.style.setProperty('--cols', String(shape.cols));
    board.style.setProperty('--cw', `calc(var(--px) * ${shape.width})`);

    const left = el('div', { class: 'gr-left' }, formatExact(prizes.length));
    const chest = el('div', { class: `gr-chest is-${reveal.chest} is-closed` },
      el('div', { class: 'gr-chest-art' }),
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
    const veil = el('div', { class: 'gr-veil' });
    const flash = el('div', { class: 'gr-flash' });

    const screen = el('div', { class: `gr-screen is-${reveal.chest}` },
      veil, rays, board, chest, kicker, heroLine, prompt, title, foot, skip, flash);
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
      // The bag card is wide: it fits the stage rather than a card's size.
      const k = card.classList.contains('is-bag')
        ? Math.min((s.width * 0.94) / r.width, (s.height * 0.5) / r.height)
        : bigW / r.width;
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

    type Phase = 'landing' | 'busy' | 'down' | 'up' | 'done';
    let phase: Phase = 'landing';
    /** What comes out of the chest at once: one card, or a ten-call's goods
     *  together (10-heroes.md §8.3). */
    const grouped = prizes.some((p) => p.kind === 'bag' || p.kind === 'supplies');
    const deals: number[][] = [];
    if (grouped) {
      const goods = prizes.flatMap((p, i) => (p.kind === 'bag' || p.kind === 'hero' ? [] : [i]));
      if (goods.length > 0) deals.push(goods);
      prizes.forEach((p, i) => { if (p.kind === 'bag' || p.kind === 'hero') deals.push([i]); });
    } else {
      cards.forEach((_, i) => deals.push([i]));
    }
    let nextDeal = 0; // the next deal to come out of the chest
    let dealt = 0; // cards out of it so far
    /** A crowd of goods standing together, face up, waiting for one tap. */
    let crowd: Array<{ card: HTMLElement; at: string }> = [];
    let current: HTMLElement | null = null;
    let currentAt = '';
    let currentPrize: GachaPrize | null = null;
    /** A celebration is not skipped by the tap that is still on its way:
     *  taps before this moment only hurry, they do not move on. */
    let holdUntil = 0;
    /** The celebration's own timers — rain, fireworks, the fanfare — cut
     *  when the card leaves. */
    let party: number[] = [];
    const later = (ms: number, fn: () => void): void => { party.push(window.setTimeout(fn, ms * pace())); };
    stopTimers = () => { party.forEach((t) => window.clearTimeout(t)); party = []; };
    const endParty = (): void => {
      party.forEach((t) => window.clearTimeout(t));
      party = [];
      screen.classList.remove('is-party');
      rays.classList.remove('is-on');
      kicker.classList.remove('is-on');
      heroLine.classList.remove('is-on');
    };

    const say = (text: string): void => {
      prompt.textContent = text;
      prompt.classList.toggle('is-on', text !== '');
    };
    const syncSkip = (): void => {
      skip.classList.toggle('is-on', phase !== 'landing' && phase !== 'done' && !skipping && cards.length - dealt > 1);
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
      chest.getAnimations().forEach((an) => an.cancel()); // its own opacity again (the party dims it)
      playSfx('chestLand');
      const r = chest.getBoundingClientRect();
      const [x, y] = at(r, 0.5, 0.88);
      layer?.burst(x - r.width * 0.3, y, { kind: 'dust', count: 9, colors: ['rgba(214, 186, 140, 0.8)'], speed: 90, angle: Math.PI, spread: 0.9, size: 14, life: 900 });
      layer?.burst(x + r.width * 0.3, y, { kind: 'dust', count: 9, colors: ['rgba(214, 186, 140, 0.8)'], speed: 90, angle: 0, spread: 0.9, size: 14, life: 900 });
      // It opens on its own: the player already paid, the chest is not a
      // second door to knock on.
      await wait(260);
      await open();
    };

    // 2. The latch, the lid flies.
    const open = async (): Promise<void> => {
      phase = 'busy';
      say('');
      syncSkip();
      playSfx('chestUnlock');
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

    /** Where the i-th of n goods stands in their row: the middle of the
     *  stage, as big as the width lets them be. */
    const crowdAt = (card: HTMLElement, i: number, n: number): string => {
      const s = screenRect();
      const r = card.getBoundingClientRect();
      const gap = s.width * 0.03;
      const w = Math.min(s.width * 0.3, (s.height * 0.3) / 1.5, (s.width * 0.94 - gap * (n - 1)) / n);
      const k = w / r.width;
      const x = s.left + s.width / 2 + (i - (n - 1) / 2) * (w + gap);
      const dx = x - (r.left + r.width / 2);
      const dy = s.top + s.height * 0.4 - (r.top + r.height / 2);
      return `translate(${dx}px, ${dy}px) scale(${k})`;
    };

    // A ten-call's goods rise together, face up: nothing in them is a
    // surprise worth a flip each.
    const drawCrowd = async (deal: number[]): Promise<void> => {
      const out = deal.map((i, n) => {
        const card = cards[i]!;
        card.style.transform = '';
        card.classList.remove('is-hidden', 'is-down');
        return { card, at: crowdAt(card, n, deal.length) };
      });
      crowd = out;
      sfx('cardDraw');
      await Promise.all(out.map(({ card, at: to }, n) => wait(n * 70).then(() => play(card, [
        { transform: chestMouthOf(card), opacity: 0 },
        { transform: `${to} translateY(-8%)`, opacity: 1, offset: 0.72 },
        { transform: to, opacity: 1 },
      ], 560)).then(() => {
        card.style.transform = to;
        card.classList.add('is-centre');
      })));
      playSfx('cardImpact');
      playSfx('cardRevealCommon');
      for (const { card } of out) {
        const [x, y] = at(card.getBoundingClientRect());
        layer?.burst(x, y, { kind: 'spark', count: 8, colors: GOLD, speed: 200, size: 7, life: 650 });
      }
      phase = 'up';
      say('Tap to continue');
      syncSkip();
      if (skipping) await settle();
    };

    // The next card rises out of the chest, face down — or the next crowd.
    const draw = async (): Promise<void> => {
      phase = 'busy';
      const deal = deals[nextDeal]!;
      nextDeal += 1;
      dealt += deal.length;
      left.textContent = formatExact(cards.length - dealt);
      left.classList.toggle('is-empty', cards.length - dealt === 0);
      if (deal.length > 1) {
        await drawCrowd(deal);
        return;
      }
      const card = cards[deal[0]!]!;
      const prize = prizes[deal[0]!]!;
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
      // A drum roll under a hero still face down; a Legendary's is the long one.
      if (newHero(prize) !== null) playSfx(rarity === 'Legendary' ? 'heroRiser' : 'heroRiserShort');
      phase = 'down';
      say('Tap to reveal');
      syncSkip();
      if (skipping && !charged) await flip();
    };

    /** A fragments card's bar fills from what was held to what is held now.
     *  A recruit's fills to the brim and the NEW stamp drops onto the card. */
    const fillBar = async (card: HTMLElement, p: FragmentProgress): Promise<void> => {
      const bar = bars.get(card);
      if (bar === undefined) return;
      const fill = card.querySelector<HTMLElement>('.k-fill');
      const to = Math.min(p.to, p.goal);
      if (fill !== null && !quiet) {
        playSfx('barFill', { gain: skipping ? 0.6 : 1 });
        await play(fill, [
          { clipPath: `inset(0 ${(1 - p.from / p.goal) * 100}% 0 0)` },
          { clipPath: `inset(0 ${(1 - to / p.goal) * 100}% 0 0)` },
        ], 700 + 500 * Math.min(1, (to - p.from) / p.goal), 'cubic-bezier(.3,0,.2,1)');
        fill.getAnimations().forEach((a) => a.cancel());
      }
      bar.set(to / p.goal, barText(p, p.to));
      if (!p.recruited) {
        sfx('cardSettle');
        return;
      }
      // Full: the bar flares, and the stamp comes down hard.
      card.classList.add('is-full');
      playSfx('cardSparkle');
      const b = card.querySelector('.gr-card-bar')!.getBoundingClientRect();
      const [bx, by] = at(b);
      layer?.burst(bx, by, { kind: 'spark', count: 24, colors: GOLD, speed: 260, size: 9, life: 800, radius: b.width / 3 });
      const stamp = card.querySelector('.gr-stamp')!;
      await play(stamp, [
        { transform: 'scale(3.2) rotate(-30deg)', opacity: 0 },
        { transform: 'scale(0.9) rotate(-12deg)', opacity: 1, offset: 0.7 },
        { transform: 'scale(1) rotate(-12deg)', opacity: 1 },
      ], 380, 'cubic-bezier(.6,0,.9,.5)');
      card.classList.add('is-stamped');
      card.classList.remove('is-missing');
      playSfx('chestLand');
      await play(card, [
        { transform: currentAt }, { transform: `${currentAt} translateY(1.5%) scale(0.97)` }, { transform: currentAt },
      ], 200);
    };

    /** The bag card's bars, every one at once; a recruit's flares and takes
     *  its seal. The hero itself is celebrated on its own card after. */
    const fillBag = async (card: HTMLElement): Promise<void> => {
      const rows = [...card.querySelectorAll<HTMLElement>('.gr-bag-row')];
      const prize = currentPrize;
      if (prize?.kind !== 'bag') return;
      if (!quiet) playSfx('barFill', { gain: skipping ? 0.6 : 1 });
      await Promise.all(rows.map(async (line, i) => {
        const p = prize.rows[i]?.progress;
        const bar = bars.get(line);
        if (p === undefined || bar === undefined) return;
        const fill = line.querySelector<HTMLElement>('.k-fill');
        const to = Math.min(p.to, p.goal);
        if (fill !== null && !quiet) {
          await play(fill, [
            { clipPath: `inset(0 ${(1 - p.from / p.goal) * 100}% 0 0)` },
            { clipPath: `inset(0 ${(1 - to / p.goal) * 100}% 0 0)` },
          ], 900, 'cubic-bezier(.3,0,.2,1)');
          fill.getAnimations().forEach((a) => a.cancel());
        }
        bar.set(to / p.goal, barText(p, p.to));
        if (!p.recruited) return;
        line.classList.add('is-full');
        const b = line.getBoundingClientRect();
        const [bx, by] = at(b);
        layer?.burst(bx, by, { kind: 'spark', count: 18, colors: GOLD, speed: 220, size: 8, life: 750, radius: b.width / 4 });
        await play(line.querySelector('.gr-stamp')!, [
          { transform: 'scale(3.2) rotate(-30deg)', opacity: 0 },
          { transform: 'scale(0.9) rotate(-12deg)', opacity: 1, offset: 0.7 },
          { transform: 'scale(1) rotate(-12deg)', opacity: 1 },
        ], 380, 'cubic-bezier(.6,0,.9,.5)');
        line.classList.add('is-stamped');
        line.classList.remove('is-missing');
      }));
      if (prize.rows.some((r) => r.progress?.recruited === true)) {
        playSfx('cardSparkle');
        playSfx('chestLand');
      } else {
        sfx('cardSettle');
      }
    };

    /** A WHOLE hero joins: the rarest thing in a chest, and the party says
     *  so — the room darkens, a flash, a shake, rays, the plaque, cannons of
     *  confetti, a rain of it, fireworks, and a fanfare. */
    const celebrate = async (id: HeroId, card: HTMLElement): Promise<void> => {
      const def = HEROES[id];
      const legend = def.rarity === 'Legendary';
      const light = RARITY_LIGHT[def.rarity];
      screen.classList.add('is-party');
      rays.className = `gr-rays is-on ${RARITY_CLASS[def.rarity]}`;
      kicker.textContent = legend ? 'A legend answers' : 'A new hero answers';
      kicker.classList.add('is-on');
      heroLine.replaceChildren(
        el('div', { class: 'gr-heroline-name' }, def.name),
        el('div', { class: 'gr-heroline-title' }, def.title),
        el('div', { class: `gr-heroline-rarity ${RARITY_CLASS[def.rarity]}` }, def.rarity));
      heroLine.classList.add('is-on');
      duckFeast(legend ? 6500 : 5200);
      playSfx(legend ? 'heroLegend' : 'heroNew');
      playSfx('heroPop');
      later(260, () => playSfx(legend ? 'heroFanfareLegend' : 'heroFanfare'));
      if (legend) later(700, () => playSfx('heroApplause'));
      holdUntil = performance.now() + 1300 * pace();
      if (!quiet) {
        void play(flash, [{ opacity: 0.85 }, { opacity: 0 }], 650, 'ease-out');
        void play(screen, [
          { transform: 'none' }, { transform: 'translate(-1.2%, 0.6%)' }, { transform: 'translate(1%, -0.8%)' },
          { transform: 'translate(-0.6%, 0.4%)' }, { transform: 'none' },
        ], 380, 'linear');
      }
      const s = screenRect();
      const r = card.getBoundingClientRect();
      const [x, y] = at(r);
      layer?.burst(x, y, { kind: 'spark', count: 50, colors: light, speed: 420, size: 13, life: 1200 });
      // Two cannons from the bottom corners, aimed at the card.
      layer?.burst(0, s.height * 0.95, { kind: 'confetti', count: legend ? 90 : 60, colors: CONFETTI, speed: 760, angle: -Math.PI / 3, spread: 0.5, size: 11, life: 3000, gravity: 380 });
      layer?.burst(s.width, s.height * 0.95, { kind: 'confetti', count: legend ? 90 : 60, colors: CONFETTI, speed: 760, angle: -Math.PI * 2 / 3, spread: 0.5, size: 11, life: 3000, gravity: 380 });
      // A rain from above, for a while.
      for (let i = 0; i < (legend ? 14 : 9); i++) {
        later(200 + i * 220, () => layer?.burst(Math.random() * s.width, -10, {
          kind: 'confetti', count: 8, colors: CONFETTI, speed: 60, angle: Math.PI / 2, spread: 1, size: 10, life: 3200, gravity: 120,
        }));
      }
      // Fireworks round the card.
      for (let i = 0; i < (legend ? 6 : 4); i++) {
        later(350 + i * 330, () => {
          const fx2 = s.width * (0.15 + Math.random() * 0.7);
          const fy = s.height * (0.12 + Math.random() * 0.4);
          layer?.burst(fx2, fy, { kind: 'spark', count: 28, colors: i % 2 === 0 ? light : GOLD, speed: 240, size: 8, life: 900, gravity: 90 });
          playSfx('cardSparkle', { gain: 0.5, rate: 1 + i * 0.05 });
        });
      }
      await play(card, [
        { transform: `${currentAt} scale(0.85)` }, { transform: `${currentAt} scale(1.18)`, offset: 0.55 }, { transform: currentAt },
      ], 520, 'cubic-bezier(.34,1.56,.64,1)');
      phase = 'up';
      say('Tap to continue');
      syncSkip();
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
      // Every face lands with a hit and its rarity's stinger — a common prize
      // is still a prize. A whole hero is left to its celebration; a skip
      // keeps only the hit for the commons, so a run of them doesn't pile up.
      if (hero === null) {
        playSfx('cardImpact');
        const reveal: SfxName = rarity === 'Legendary' ? 'cardRevealLegend'
          : rarity === 'Rare' ? 'cardRevealRare' : 'cardRevealCommon';
        if (!skipping || reveal !== 'cardRevealCommon') playSfx(reveal);
      }
      if (prize.kind === 'fragments' && prize.progress !== undefined) {
        await fillBar(card, prize.progress);
      }
      if (prize.kind === 'bag') await fillBag(card);
      if (hero !== null) {
        await celebrate(hero, card);
        return;
      }
      if (rarity === 'Rare' || rarity === 'Legendary') {
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

    /** Every card going home, landing dimmed in its place. */
    const flyHome = (card: HTMLElement, from: string): Promise<void> =>
      play(card, [{ transform: from }, { transform: 'none' }], 440, 'cubic-bezier(.5,0,.2,1)')
        .then(() => {
          card.style.transform = '';
          card.getAnimations().forEach((a) => a.cancel());
          card.classList.add('is-dim');
          sfx('cardSettle');
          const [x, y] = at(card.getBoundingClientRect());
          layer?.burst(x, y, { kind: 'spark', count: 5, colors: GOLD, speed: 90, size: 5, life: 450 });
        });

    // 4. Home: the card flies to its place and the next one rises.
    const settle = async (): Promise<void> => {
      if (crowd.length > 0) {
        phase = 'busy';
        say('');
        const going = crowd;
        crowd = [];
        sfx('cardWhoosh');
        const home = Promise.all(going.map(({ card, at: from }) => {
          card.classList.remove('is-centre');
          return flyHome(card, from);
        }));
        if (nextDeal < deals.length) {
          await wait(120);
          await Promise.all([home, draw()]);
        } else {
          await home;
          await finish();
        }
        return;
      }
      if (current === null) return;
      phase = 'busy';
      say('');
      endParty();
      const card = current;
      current = null;
      currentPrize = null;
      card.classList.remove('is-centre');
      sfx('cardWhoosh');
      const home = flyHome(card, currentAt);
      if (nextDeal < deals.length) {
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
      if (phase === 'up' && performance.now() < holdUntil) return;
      if (phase === 'down') void flip();
      else if (phase === 'up') void settle();
      else if (phase === 'done') game.dismissGachaReveal();
    });
    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      skipping = true;
      syncSkip();
      hurry();
      if (phase === 'down' && current !== null && !current.classList.contains('is-charged')) void flip();
      else if (phase === 'up' && (crowd.length > 0 || (currentPrize !== null && newHero(currentPrize) === null))) void settle();
    });

    void land();
  };

  const refresh = (): void => {
    const reveal = game.gachaReveal;
    if (reveal === null) {
      if (showing !== null) {
        teardown();
        showing = null;
        setFeast(false);
      }
      return;
    }
    if (reveal === showing) return; // mid-sequence; leave it alone
    showing = reveal;
    setFeast(true);
    build(reveal);
  };

  game.onChange(refresh);
  refresh();
}
