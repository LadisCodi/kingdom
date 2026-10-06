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

import { HEROES, STORE } from '../sim/data/definitions';
import type { CurrencyId, HeroId, ItemId, StoreSkuId } from '../sim/state';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { playSfx } from '../audio/sfx';
import type { Game, OfferTile } from '../game';
import { itemIcon } from './itemArt';
import { el, formatCountdown, formatExact, formatUsd } from './format';
import { heroFragmentIcon } from './heroFragment';
import { btn, closeKnob, currencyIcon, iconEl } from './kit';

/** A hero's round-cornered portrait, or its glyph while the art is missing. */
function heroArt(id: HeroId, cls: string): HTMLElement {
  const def = HEROES[id];
  const url = spriteUrl(`${def.sprite}_avatar`) ?? spriteUrl(def.sprite);
  return url ? spriteImgAt(url, cls) : el('span', { class: cls }, def.glyph);
}

function tile(t: OfferTile): HTMLElement {
  const art = t.kind === 'hero' ? heroArt(t.id as HeroId, 'ofs-tile-hero')
    : t.kind === 'fragments' ? heroFragmentIcon(t.id as HeroId, { size: 'lg' })
    : t.kind === 'coin' ? currencyIcon(t.id as CurrencyId, { size: 'lg' })
    : iconEl(itemIcon(t.id as ItemId), { size: 'lg' });
  return el('div', { class: `ofs-tile${t.kind === 'hero' ? ' is-hero' : ''}` },
    art, el('b', { class: 'ofs-tile-count' }, `×${formatExact(t.count)}`));
}

function panel(title: string, tiles: OfferTile[], badge: HTMLElement | null, locked: boolean): HTMLElement {
  return el('section', { class: `ofs-panel${locked ? ' is-locked' : ''}` },
    el('div', { class: 'ofs-panel-head' }, ...(badge === null ? [] : [badge]), el('span', {}, title)),
    el('div', { class: 'ofs-tiles' }, ...tiles.map(tile)));
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
      action = btn({ label: formatUsd(Math.round(s.priceUsd * 100)), kind: 'gold', onClick: () => game.buyFromSplash(sku) });
    } else if (mode === 'claim') {
      action = btn({ label: 'Claim', kind: 'gold', onClick: () => game.doClaimNextDay(sku) });
    } else {
      const pill = game.nextDayPill();
      waitUntil = pill?.at ?? 0;
      timer = el('b', {}, '');
      action = el('div', { class: 'ofs-wait' }, iconEl('hourglass', { size: 'sm' }), el('span', {}, 'Tomorrow in '), timer);
    }

    const screen = el('div', { class: 'ofs-screen', role: 'dialog', 'aria-modal': 'true', 'aria-label': s.name },
      close,
      el('div', { class: 'ofs-ribbon' }, el('span', {}, s.name)),
      el('div', { class: 'ofs-hero' },
        el('div', { class: 'ofs-burst', 'aria-hidden': 'true' }),
        ...(s.hero === null ? [] : [(() => {
          const url = spriteUrl(HEROES[s.hero].sprite);
          return url ? spriteImgAt(url, 'ofs-hero-art') : el('span', {});
        })()]),
        ...(hero === null ? [] : [el('div', { class: 'ofs-hero-name' },
          el('b', {}, hero.name), el('span', { class: 'ofs-rarity' }, hero.rarity))])),
      panel(mode === 'buy' ? 'Yours now' : 'Yours', tiles.now, null, false),
      ...(tiles.nextDay.length === 0 ? [] : [panel('Tomorrow', tiles.nextDay,
        mode === 'claim' ? null : el('span', { class: 'ofs-lock' }, iconEl('padlock', { size: 'sm' }), iconEl('hourglass', { size: 'sm' })),
        mode !== 'claim')]),
      el('div', { class: 'ofs-actions' }, action,
        ...(mode === 'buy' && s.limit === 1 ? [el('span', { class: 'ofs-note' }, 'Once per kingdom.')] : [])));
    root.replaceChildren(screen);
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
