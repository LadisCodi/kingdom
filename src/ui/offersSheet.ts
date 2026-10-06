// THE OFFERS SCREEN (Docs/features/14-monetization.md §2.4), after
// Docs/art/ui/mockups/m87-offer-novice-chain.png: one tab an offer on sale,
// each tab the offer's icon over its short name, and under them the open
// offer's card —
//
//   * its name and one line, and — for a step of a chain — "I / III";
//   * its picture;
//   * its Gems beside a sack of them, and its value in a red wax seal;
//   * what else lands, one tile each, a tap saying what it is;
//   * what it opens for good on a green GIFT strip;
//   * how long it lasts and how many are left, and its price.
//
// An offer with a splash (the first-purchase pack) is not a tab here: its
// splash is its screen.

import type { Game, OffersScreen } from '../game';
import { STORE } from '../sim/data/definitions';
import type { StoreSkuId } from '../sim/state';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { el, formatCountdown, formatExact, formatUsd } from './format';
import { btn, currencyIcon, iconEl, sheet, type IconName } from './kit';
import { offerTile } from './offerSplash';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const roman = (n: number): string => ROMAN[n - 1] ?? formatExact(n);

/** The picture on a GIFT strip, by what the offer opens for good. */
const GIFT_ICON: Record<NonNullable<OffersScreen['card']>['gifts'][number]['icon'], IconName> = {
  builder: 'build', explorer: 'compass', heroSlot: 'helmet',
};

/** A tab's picture while its offer has no art of its own: what it is for. */
function tabIcon(id: StoreSkuId): IconName {
  const s = STORE[id];
  if (s.explorers > 0) return 'compass';
  if (s.heroSlots > 0) return 'helmet';
  if (s.opensOn === 'manaLow') return 'manaFlask';
  if (s.opensOn === 'buildersBusy' || s.opensOn === 'townhall') return 'speedup';
  return 'chest';
}

function tabs(game: Game, view: OffersScreen): HTMLElement {
  return el('div', { class: 'ofr-tabs', role: 'tablist' }, ...view.tabs.map((t) => {
    const url = spriteUrl(t.sprite);
    const b = el('button', {
      class: `ofr-tab${t.open ? ' is-open' : ''}`, type: 'button', role: 'tab', 'aria-selected': t.open ? 'true' : 'false',
    },
      url === null ? iconEl(tabIcon(t.id), { size: 'lg' }) : spriteImgAt(url, 'ofr-tab-icon'),
      el('span', { class: 'ofr-tab-label' }, t.label));
    b.addEventListener('click', () => game.showOfferTab(t.id));
    return b;
  }));
}

function card(game: Game, c: NonNullable<OffersScreen['card']>): HTMLElement {
  const art = c.art === '' ? null : spriteUrl(c.art);
  const now = game.now();
  const meta = [
    ...(c.closesAt === null ? [] : [el('span', { class: 'ofr-timer' }, iconEl('hourglass', { size: 'sm' }),
      formatCountdown(Math.max(0, Math.ceil((c.closesAt - now) / 1000))))]),
    ...(c.left === null ? [] : [el('span', {}, `Purchase limit: ${formatExact(c.left)}`)]),
  ];
  return el('article', { class: 'ofr-card' },
    el('header', { class: 'ofr-head' },
      el('div', { class: 'ofr-titles' },
        el('h2', { class: 'ofr-title' }, c.name),
        el('p', { class: 'ofr-pitch' }, c.description)),
      ...(c.chain === null ? [] : [el('div', { class: 'ofr-chain', 'aria-label': `Step ${c.chain.at} of ${c.chain.of}` },
        el('span', { class: 'ofr-chain-knob', 'aria-hidden': 'true' }, '↻'),
        el('span', { class: 'ofr-chain-plate' }, `${roman(c.chain.at)} / ${roman(c.chain.of)}`))])),
    ...(art === null ? [] : [el('div', { class: 'ofr-art' }, spriteImgAt(art, 'ofr-art-img'))]),
    el('section', { class: 'ofr-loot' },
      el('div', { class: 'ofr-gems' },
        el('span', { class: 'ofr-sack', 'aria-hidden': 'true' }),
        currencyIcon('Gems', { size: 'lg' }),
        el('b', { class: 'ofr-gems-count' }, formatExact(c.gems))),
      ...(c.valuePercent > 100 ? [el('span', { class: 'ofr-seal', 'aria-label': `${formatExact(c.valuePercent)}% value` },
        `${formatExact(c.valuePercent)}%`)] : []),
      el('div', { class: 'ofr-tiles' }, ...c.tiles.map(offerTile))),
    ...c.gifts.map((g) => el('section', { class: 'ofr-gift' },
      el('span', { class: 'ofr-gift-tag', 'aria-label': 'Gift' }),
      el('span', { class: 'ofr-gift-art' }, iconEl(GIFT_ICON[g.icon], { size: 'lg' })),
      el('div', {}, el('b', {}, g.title), el('span', {}, g.text)))),
    el('footer', { class: 'ofr-foot' },
      ...(meta.length === 0 ? [] : [el('div', { class: 'ofr-meta' }, ...meta)]),
      btn({
        label: c.left === 0 ? 'Sold out' : formatUsd(c.priceCents),
        kind: 'gold',
        finish: 'gem',
        onClick: () => game.openIap(c.id, 'offers'),
        disabledReason: c.left === 0 ? 'Sold out' : undefined,
      })));
}

export function renderOffersSheet(game: Game): HTMLElement {
  const view = game.offersScreen();
  const body = view.card === null
    ? el('div', { class: 'ofr-empty' }, 'No offers right now — new ones arrive as your kingdom grows.')
    : el('div', { class: 'ofr' }, tabs(game, view), card(game, view.card));
  const screen = sheet({ title: 'Offers', onClose: () => game.setOverlay('store'), tall: true }, body);
  // The whole box between the header and the nav: a card is a full screen.
  screen.classList.add('ofr-sheet');
  return screen;
}
