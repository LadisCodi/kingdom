// The store's Heroes tab (Docs/features/14-monetization.md §2.1), after
// Docs/art/ui/mockups/m96-store-heroes.png:
//
//   * the keys held, silver and gold, each with a "+" that buys one more;
//   * "Call for aid" over a CAROUSEL of the heroes — one at a time, drifting
//     slowly right to left, fading in and out into the next, every hero of
//     the roster once before any comes round again;
//   * the odds, on a tap;
//   * the two calls, one banner each: the common call shows only its silver
//     key; the golden call (`showsHero`) a Legendary — a different one each
//     time the store is opened, every one before any comes round again.
//
// The pity counters stay on the banners, always: a hidden pity counter is
// the same as no pity counter.
//
// The ×1 slot is ONE button wearing whichever of three faces is true — the
// call is free, an ad pays for it, or it costs a key — rather than a free row
// that appears above the pair and shoves it down every five minutes.

import { BANNERS, BANNER_ORDER, HEROES, HERO_ORDER, type BannerId } from '../sim/data/definitions';
import type { Game } from '../game';
import { heroChanceAt, pityCount, pullsToGuarantee, pullsToLegendary } from '../sim/heroes';
import type { HeroId, ItemId } from '../sim/state';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { el, formatExact } from './format';
import { btn, iconEl, withTooltip, type CostTerm, type IconName } from './kit';

// ------------------------------------------------------------- the carousel

/** How long one hero stays, entrance and exit included (store.css). */
const CAROUSEL_MS = 4200;

/** The shuffle bag the carousel draws from: every hero once, in a random
 *  order, then a fresh bag. Module state, so a rebuild of the store goes on
 *  from where it was rather than starting the roster again. A cosmetic
 *  shuffle — the sim's randomness rules do not reach a picture. */
let bag: HeroId[] = [];
let showing: HeroId | null = null;

function nextHero(): HeroId {
  if (bag.length === 0) {
    bag = [...HERO_ORDER];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    // A new bag never opens on the hero the last one closed on.
    if (bag[0] === showing && bag.length > 1) [bag[0], bag[1]] = [bag[1], bag[0]];
  }
  showing = bag.shift()!;
  return showing;
}

/** One hero on stage: their art, drifting and fading by CSS; at the end of
 *  its run the next one takes the stage. */
function carousel(): HTMLElement {
  const stage = el('div', { class: 'sth-carousel', 'aria-hidden': 'true' });
  const show = (id: HeroId): void => {
    const url = spriteUrl(HEROES[id].sprite);
    if (url === null) return;
    const img = spriteImgAt(url, 'sth-carousel-hero');
    img.style.animationDuration = `${CAROUSEL_MS}ms`;
    img.addEventListener('animationend', () => {
      if (stage.isConnected) show(nextHero());
    }, { once: true });
    stage.replaceChildren(img);
  };
  show(showing ?? nextHero());
  return stage;
}

// ------------------------------------------------------ the banner's hero

/** What a banner can stand: the heroes of the rarest rarity it calls. */
function bannerLegends(id: BannerId): HeroId[] {
  const weights = BANNERS[id].weights;
  const rarest = (['Legendary', 'Rare', 'Common'] as const).find((r) => weights[r] > 0);
  return rarest === undefined ? [] : HERO_ORDER.filter((h) => HEROES[h].rarity === rarest);
}

/** Per banner: its shuffle bag, the hero standing and the visit it stood
 *  for. A new visit to the store draws the next. */
const featured = new Map<BannerId, { bag: HeroId[]; hero: HeroId | null; visit: number }>();

function featuredHero(id: BannerId, visit: number): HeroId | null {
  const slot = featured.get(id) ?? { bag: [], hero: null, visit: -1 };
  featured.set(id, slot);
  if (slot.visit === visit && slot.hero !== null) return slot.hero;
  if (slot.bag.length === 0) {
    slot.bag = bannerLegends(id);
    for (let i = slot.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slot.bag[i], slot.bag[j]] = [slot.bag[j], slot.bag[i]];
    }
    if (slot.bag[0] === slot.hero && slot.bag.length > 1) [slot.bag[0], slot.bag[1]] = [slot.bag[1], slot.bag[0]];
  }
  slot.hero = slot.bag.shift() ?? null;
  slot.visit = visit;
  return slot.hero;
}

/** The odds, both calls, as the tooltip a tap on "Odds" opens. */
function oddsText(game: Game): string {
  return BANNER_ORDER.map((banner) => {
    const chance = heroChanceAt(pityCount(game.state, banner), banner);
    const legend = pullsToLegendary(game.state, banner);
    return `${BANNERS[banner].name}: ${Math.round(chance * 100)}% a hero now, one within ${formatExact(pullsToGuarantee(game.state, banner))}`
      + (legend === null ? '' : `, a legend within ${formatExact(legend)}`);
  }).join('. ') + '.';
}

// --------------------------------------------------------------- the calls

/** A key in a call's price: red when the Bag holds fewer. */
function keyTerm(game: Game, key: ItemId, amount: number): CostTerm {
  return { icon: key as IconName, amount: formatExact(amount), short: game.itemHeld(key) < amount };
}

/** The ×1 slot: free, an ad that pays for it, or a key. */
function callSlot(game: Game, banner: BannerId): HTMLElement {
  const def = BANNERS[banner];
  const price = game.pullPrice(banner);
  const free = def.freePerDay > 0 ? game.freePull(banner) : null;
  let b: HTMLElement;
  if (price.amount === 0) {
    b = btn({ label: 'Call', note: 'Free', kind: 'primary', onClick: () => game.doPull(banner) });
  } else if (free !== null && free.ready) {
    b = btn({ label: 'Call', note: 'Free', icon: 'video', kind: 'primary', onClick: () => game.startFreePullWatch(banner) });
  } else {
    b = btn({
      label: 'Call', kind: 'primary',
      onClick: () => game.doPull(banner),
      costExtra: [keyTerm(game, price.key, price.amount)],
    });
  }
  if (banner === 'basic' && game.uiHint() === 'banner') b.classList.add('hinted');
  return b;
}

/** The ten. Always a price: a free first call is free once, so a ten over
 *  it costs nine — the arithmetic `pullMany` charges. */
function tenCall(game: Game, banner: BannerId): HTMLElement {
  const price = game.pullPrice(banner);
  const total = price.amount === 0 ? 9 : price.amount * 10;
  return btn({
    label: 'Call ×10', kind: 'gold', finish: 'gem',
    onClick: () => game.doPullMany(banner, 10),
    costExtra: [keyTerm(game, price.key, total)],
  });
}

/** What the free allowance says: how many today, or when the next one is. */
function freeLine(game: Game, banner: BannerId): HTMLElement {
  const def = BANNERS[banner];
  if (def.freePerDay === 0) return el('span', {}, '');
  const free = game.freePull(banner);
  if (free.left === 0) return el('span', { class: 'sth-free' }, 'Free calls tomorrow');
  if (free.ready) return el('span', { class: 'sth-free' }, `Free calls today: ${formatExact(free.left)}`);
  return el('span', { class: 'sth-free' }, `Free calls today: ${formatExact(free.left)} · next in `,
    el('b', { 'data-until': String(free.readyAt) }, ''));
}

function banner(game: Game, id: BannerId): HTMLElement {
  const def = BANNERS[id];
  const stands = def.showsHero ? featuredHero(id, game.storeVisits) : null;
  const hero = stands === null ? null : spriteUrl(HEROES[stands].sprite);
  return el('section', { class: `sth-banner is-${id}${hero === null ? '' : ' has-hero'}` },
    // The common call shows nothing but its calls: smaller than the golden
    // call, which reads as the better one.
    ...(hero === null ? [] : [spriteImgAt(hero, 'sth-banner-hero')]),
    el('div', { class: 'sth-banner-body' },
      el('div', { class: 'sth-banner-ribbon' }, el('span', {}, def.name)),
      freeLine(game, id),
      // How soon a hero or a Legendary comes is under Odds.
      el('div', { class: 'sth-calls' }, callSlot(game, id), tenCall(game, id))));
}

export function heroesTab(game: Game): HTMLElement {
  if (!game.doorOpen('banner')) {
    return el('div', { class: 'stx-locked' }, iconEl('padlock', { size: 'lg' }), el('span', {}, 'Build a Tavern to call heroes.'));
  }
  const odds = withTooltip(el('button', { class: 'sth-odds', type: 'button', 'aria-label': 'Odds' },
    iconEl('quest', { size: 'lg' }), el('span', {}, 'Odds')), oddsText(game), 'Odds');
  return el('div', { class: 'sth' },
    el('div', { class: 'sth-top' },
      carousel(),
      el('h2', { class: 'sth-title' }, 'Call for aid'),
      odds),
    ...BANNER_ORDER.map((b) => banner(game, b)));
}
