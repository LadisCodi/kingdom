// THE OFFER SPLASH (Docs/features/14-monetization.md §2.6), drawn from
// Docs/art/ui/mockups/m86b-offer-first-purchase.png: an offer with `splash`
// on a dark veil over the whole game — over the header too — its hero on a
// golden burst, a ribbon with its name, what lands now and what lands
// tomorrow, and its price on the button.
//
// Three moods, one screen. `buy`: the price buys, straight to the
// confirmation. `waiting`: bought, tomorrow's part counting down. `claim`:
// tomorrow is here, and the button takes it.
//
// Its own mount, `#offersplash` (96), over the stage and under the unlock
// splash, for the reason every full-screen moment has one: `#overlay` is a
// stacking context and nothing in it rises over the header. The game decides
// WHEN (`Game.offerSplashOnScreen`): at the start of a session, once the map
// is free.

import { BANNERS, BANNER_ORDER, HEROES, ITEMS, STORE } from '../sim/data/definitions';
import { boonText } from '../sim/heroes';
import type { CurrencyId, HeroId, ItemId, StoreSkuId } from '../sim/state';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { playSfx } from '../audio/sfx';
import type { Game, OfferTile } from '../game';
import { itemIcon } from './itemArt';
import { el, formatCountdown, formatExact, formatUsd } from './format';
import { heroFragmentIcon } from './heroFragment';
import { btn, closeKnob, currencyIcon, iconEl, withTooltip } from './kit';
import { itemLine, itemName } from './itemText';

/** A hero's round-cornered portrait, or its glyph while the art is missing. */
function heroArt(id: HeroId, cls: string): HTMLElement {
  const def = HEROES[id];
  const url = spriteUrl(`${def.sprite}_avatar`) ?? spriteUrl(def.sprite);
  return url ? spriteImgAt(url, cls) : el('span', { class: cls }, def.glyph);
}

/** What a reward IS, for the tooltip a tap on its tile opens. */
function tileTip(t: OfferTile): { title: string; text: string } {
  if (t.kind === 'hero' || t.kind === 'fragments') {
    const def = HEROES[t.id as HeroId];
    const name = def.name.replace(/^The /, '');
    if (t.kind === 'fragments') {
      return {
        title: `${formatExact(t.count)} fragments of ${name}`,
        text: `With Stardust, they raise ${name} a tier, and the level cap with it`,
      };
    }
    const boon = def.boon === null ? null : boonText(def.boon);
    return {
      title: def.name,
      text: `A ${def.rarity.toLowerCase()} hero, yours for good${boon === null ? '' : `. Held, for the whole kingdom: ${boon}`}`,
    };
  }
  if (t.kind === 'coin') {
    return t.id === 'HeroXp'
      ? { title: `${formatExact(t.count)} Hero XP`, text: 'Levels up any hero, up to their tier\'s cap' }
      : { title: `${formatExact(t.count)} Gems`, text: 'Keys, builders, time and more, in the store' };
  }
  const def = ITEMS[t.id as ItemId];
  const banner = def.kind === 'key' ? BANNER_ORDER.find((b) => BANNERS[b].key === t.id) : undefined;
  if (banner !== undefined) return { title: def.name, text: `One ${BANNERS[banner].name.replace(/^The /, '').toLowerCase()} for aid, in the store` };
  return { title: itemName(def), text: itemLine(def, t.worth ?? {}) };
}

/** One reward as a tile, with the tooltip saying what it is — the splash's
 *  panels and the Offers screen's card both draw these. */
export function offerTile(t: OfferTile): HTMLElement {
  const art = t.kind === 'hero' ? heroArt(t.id as HeroId, 'ofs-tile-hero')
    : t.kind === 'fragments' ? heroFragmentIcon(t.id as HeroId, { size: 'lg' })
    : t.kind === 'coin' ? currencyIcon(t.id as CurrencyId, { size: 'lg' })
    : iconEl(itemIcon(t.id as ItemId), { size: 'lg' });
  const tip = tileTip(t);
  return withTooltip(el('button', {
    class: `ofs-tile${t.kind === 'hero' ? ' is-hero' : ''}`, type: 'button', 'aria-label': tip.title,
  }, art, el('b', { class: 'ofs-tile-count' }, `×${formatExact(t.count)}`)), tip.text, tip.title);
}

/** Where the sparkles sit over the hero, in % of the hero's box, how big
 *  (× the base size) and when each first lights. Fixed rather than random:
 *  the same splash twinkles the same way every time it is opened. */
const SPARKLES: ReadonlyArray<[number, number, number, number]> = [
  [14, 22, 1, 0], [78, 14, 1.3, 700], [88, 46, 0.8, 1500], [8, 58, 1.1, 2200],
  [62, 6, 0.7, 400], [30, 8, 0.9, 1900], [92, 74, 1, 1100], [20, 84, 0.8, 2600],
  [70, 62, 0.6, 3100], [46, 30, 0.6, 2900],
];

/** A painted title: the ornate face, cream to gold, in a dark outline. The
 *  outline is a second copy of the words behind the first, because a
 *  gradient fill and a stroke cannot share one layer of text. */
function ornate(text: string, cls: string): HTMLElement {
  return el('span', { class: `ofs-ornate ${cls}`, 'data-text': text }, text);
}

/** A textPath draws nothing past the end of its arc, so a title longer than
 *  the band is squeezed onto it. Measured once the svg is in the page, and
 *  again when the ornate face has loaded. */
function fitRibbonTitle(svg: SVGSVGElement): void {
  const fit = (): void => {
    const arc = svg.querySelector('path');
    const text = svg.querySelector('text');
    const path = svg.querySelector('textPath');
    if (arc === null || text === null || path === null || !svg.isConnected) return;
    path.removeAttribute('textLength');
    const room = arc.getTotalLength() * 0.96;
    if (text.getComputedTextLength() > room) {
      path.setAttribute('textLength', String(Math.round(room)));
      path.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    }
  };
  fit();
  void document.fonts?.ready.then(fit);
}

/** The ribbon's title, bent along the cloth: an SVG text on an arc through
 *  the middle of offer-ribbon.png's red band (its centre falls from y 73 at
 *  the middle to y 96 at x 200 and x 824, in the art's own 1024×250). The
 *  outline is the stroke painted under the fill (`paint-order`). A title
 *  too long for the band is squeezed to it rather than run onto the tails. */
function ribbonTitle(text: string): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const make = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };
  const svg = make('svg', { class: 'ofs-ribbon-title', viewBox: '0 0 1024 250', 'aria-hidden': 'true' });
  const defs = make('defs', {});
  const grad = make('linearGradient', { id: 'ofs-title-fill', x1: '0', y1: '0', x2: '0', y2: '1' });
  grad.append(make('stop', { offset: '0.3', 'stop-color': '#fffaf0' }), make('stop', { offset: '0.9', 'stop-color': '#f8dc93' }));
  defs.append(grad, make('path', { id: 'ofs-title-arc', d: 'M 180 102 Q 512 46 844 102' }));
  const words = make('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
  const path = make('textPath', { href: '#ofs-title-arc', startOffset: '50%' });
  path.textContent = text;
  words.append(path);
  svg.append(defs, words);
  return svg;
}

function panel(title: string, tiles: OfferTile[], badge: HTMLElement | null, locked: boolean): HTMLElement {
  return el('section', { class: `ofs-panel${locked ? ' is-locked' : ''}` },
    el('div', { class: 'ofs-panel-head' }, ...(badge === null ? [] : [badge]), el('span', {}, title)),
    el('div', { class: 'ofs-tiles' }, ...tiles.map(offerTile)));
}

export function mountOfferSplash(game: Game, root: HTMLElement): void {
  /** What is on screen, so a notify — every tick — rebuilds only what moves. */
  let showing: string | null = null;
  let timer: HTMLElement | null = null;
  let waitUntil = 0;

  const build = (sku: StoreSkuId, mode: 'buy' | 'claim' | 'waiting'): void => {
    const s = STORE[sku];
    const tiles = game.offerTiles(sku);
    const hero = s.hero === null ? null : HEROES[s.hero];
    const close = closeKnob(() => game.closeOfferSplash());
    close.classList.add('ofs-close');

    timer = null;
    let action: HTMLElement;
    if (mode === 'buy') {
      action = btn({ label: formatUsd(Math.round(s.priceUsd * 100)), kind: 'gold', finish: 'gem', onClick: () => game.buyFromSplash(sku) });
    } else if (mode === 'claim') {
      action = btn({ label: 'Claim', kind: 'gold', finish: 'gem', onClick: () => game.doClaimNextDay(sku) });
    } else {
      const pill = game.nextDayPill();
      waitUntil = pill?.at ?? 0;
      timer = el('b', {}, '');
      action = el('div', { class: 'ofs-wait' }, iconEl('hourglass', { size: 'sm' }), el('span', {}, 'Tomorrow in '), timer);
    }

    // The magic in the light: sparkles that come and go, each on its own
    // beat, so the burst never pulses as one.
    const sparkles = SPARKLES.map(([x, y, size, delay]) => el('span', {
      class: 'ofs-sparkle', 'aria-hidden': 'true',
      style: `left:${x}%;top:${y}%;--s:${size};animation-delay:${delay}ms`,
    }));
    const art = s.hero === null ? null : spriteUrl(HEROES[s.hero].sprite);
    const screen = el('div', { class: 'ofs-screen', role: 'dialog', 'aria-modal': 'true', 'aria-label': s.name },
      close,
      el('div', { class: 'ofs-column' },
        el('div', { class: 'ofs-hero', 'aria-hidden': 'true' },
          el('div', { class: 'ofs-burst' }),
          ...(art === null ? [] : [spriteImgAt(art, 'ofs-hero-art')]),
          ...sparkles),
        el('div', { class: 'ofs-ribbon' }, ribbonTitle(s.name)),
        ...(hero === null ? [] : [el('div', { class: 'ofs-hero-name' },
          ornate(hero.name.replace(/^The /, ''), 'ofs-name-text'),
          el('span', { class: `ofs-rarity is-${hero.rarity.toLowerCase()}` }, hero.rarity))]),
        el('div', { class: 'ofs-panels' },
          panel(mode === 'buy' ? 'Yours now' : 'Yours', tiles.now, null, false),
          ...(tiles.nextDay.length === 0 ? [] : [panel('Tomorrow', tiles.nextDay,
            mode === 'claim' ? null : el('span', { class: 'ofs-lock' }, iconEl('padlock', { size: 'lg' }), iconEl('hourglass', { size: 'lg' })),
            mode !== 'claim')]),
          el('div', { class: 'ofs-actions' }, action,
            ...(mode === 'buy' && s.limit === 1 ? [el('span', { class: 'ofs-note' }, 'Once per kingdom.')] : [])))));
    root.replaceChildren(screen);
    const title = screen.querySelector<SVGSVGElement>('.ofs-ribbon-title');
    if (title !== null) fitRibbonTitle(title);
    if (mode !== 'waiting') playSfx('unlock');
  };

  const refresh = (): void => {
    const on = game.offerSplashOnScreen();
    const key = on === null ? null : `${on.mode}:${on.sku}`;
    if (key !== showing) {
      showing = key;
      if (on === null) root.replaceChildren();
      else build(on.sku, on.mode);
    }
    if (timer !== null) timer.textContent = formatCountdown(Math.max(0, Math.ceil((waitUntil - game.now()) / 1000)));
  };

  game.onChange(refresh);
  refresh();
}

/** The pill on the right edge for a bought pack's next-day part: a countdown
 *  until tomorrow, then a glowing "Claim". It opens the splash. */
export function mountNextDayPill(game: Game, root: HTMLElement): void {
  const label = el('b', { class: 'nd-tab-label' }, '');
  const tab = el('button', { class: 'ad-tab nd-tab', type: 'button', 'aria-label': 'Tomorrow’s reward' },
    iconEl('chest', { size: 'lg' }), label);
  let sku: StoreSkuId | null = null;
  tab.addEventListener('click', () => { if (sku !== null) game.openOfferSplash(sku); });
  root.replaceChildren(tab);

  const refresh = (): void => {
    const pill = game.nextDayPill();
    const showing = pill !== null && !game.hasOpenSheet() && game.offerSplashOnScreen() === null;
    root.hidden = !showing;
    if (!showing) return;
    sku = pill!.sku;
    tab.classList.add('is-in');
    tab.classList.toggle('is-ready', pill!.ready);
    label.textContent = pill!.ready ? 'Claim' : formatCountdown(Math.max(0, Math.ceil((pill!.at - game.now()) / 1000)));
  };
  game.onChange(refresh);
  refresh();
}
