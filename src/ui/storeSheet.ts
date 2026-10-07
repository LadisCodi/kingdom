// THE STORE (Docs/features/14-monetization.md §2.1), after the mockups
// Docs/art/ui/mockups/m95–m98: a screen of its own — a magic merchant's shop
// behind it, soft and out of focus, so the wares are what the eye finds —
// with a strip of wooden tabs and its close along the top, fixed, over the
// open tab's page, which scrolls:
//
//   * Offers (while there is one): a banner each, its figure, its name, a
//     summary of what it gives and its price — a tap opens its splash — and,
//     at the foot, today's offers with the time to the next draw;
//   * Heroes: the two calls (ui/storeHeroes.ts);
//   * Supplies: the Bag's bundles, the relic fragments, the crew's slots;
//   * Gems: the six packs.
//
// Every price in dollars opens the confirmation; nothing is granted from
// here. THE STORE DOES NOT KNOW IT IS SIMULATED: no budget line, no SIMULADO,
// no price greyed out for a short allowance — the confirmation is where the
// price meets the budget (iapSheet.ts).
//
// The store is rebuilt only when what it shows moves (`Game.overlaySignature`):
// its countdowns tick in place, so its pictures and the heroes' carousel are
// never torn down by the clock.

import type { Game, OfferCard, StoreTab } from '../game';
import { GEM_PACK_ORDER, HEROES, KINGDOM_DEF, STORE } from '../sim/data/definitions';
import type { StoreSkuId } from '../sim/state';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { el, formatCountdown, formatExact, formatUsd } from './format';
import { btn, closeKnob, ctaBadge, currencyIcon, iconEl, sheet, type IconName } from './kit';
import { offerTile } from './offerSplash';
import { kindIcon } from './offerWidget';
import { heroesTab } from './storeHeroes';

// ------------------------------------------------------------- countdowns

/** One clock for every countdown on the store: an element carrying
 *  `data-until` (epoch ms) shows the time left, written in place each second
 *  — the screen around it is not rebuilt for it. */
let ticking: number | null = null;
function tickCountdowns(game: Game): void {
  if (ticking !== null) return;
  const write = (): void => {
    const nodes = document.querySelectorAll<HTMLElement>('.stx [data-until]');
    if (nodes.length === 0) {
      window.clearInterval(ticking!);
      ticking = null;
      return;
    }
    for (const n of nodes) {
      const text = formatCountdown(Math.max(0, Math.ceil((Number(n.dataset.until) - game.now()) / 1000)));
      if (n.textContent !== text) n.textContent = text;
    }
  };
  ticking = window.setInterval(write, 1000);
  queueMicrotask(write);
}

const countdown = (until: number): HTMLElement => el('b', { 'data-until': String(until) }, '');

// ------------------------------------------------------------------- tabs

const TAB: Record<StoreTab, { label: string; icon: IconName }> = {
  offers: { label: 'Offers', icon: 'chest' },
  heroes: { label: 'Heroes', icon: 'helmet' },
  supplies: { label: 'Supplies', icon: 'bag' },
  gems: { label: 'Gems', icon: 'Gems' as IconName },
};

function tabStrip(game: Game, tabs: StoreTab[], open: StoreTab): HTMLElement {
  // A dot where something waits: an offer to see, a free call to take.
  const news = (t: StoreTab): boolean =>
    t === 'offers' ? game.offerCards().length > 0
      : t === 'heroes' ? game.doorOpen('banner') && (['basic', 'advanced'] as const).some((b) => game.freePull(b).ready || game.pullPrice(b).amount === 0)
        : false;
  return el('div', { class: 'stx-tabs', role: 'tablist' }, ...tabs.map((t) => {
    const b = el('button', {
      class: `stx-tab${t === open ? ' is-open' : ''}`, type: 'button', role: 'tab',
      'aria-selected': t === open ? 'true' : 'false',
    }, iconEl(TAB[t].icon, { size: 'lg' }), el('span', {}, TAB[t].label),
    ...(news(t) && t !== open ? [ctaBadge(1, `store-tab:${t}`)] : []));
    b.addEventListener('click', () => game.setStoreTab(t));
    return b;
  }));
}

/** A section's name on a red cloth ribbon. */
const ribbon = (text: string, extra?: HTMLElement): HTMLElement =>
  el('div', { class: 'stx-ribbon' }, el('span', {}, text), ...(extra === undefined ? [] : [extra]));

// ----------------------------------------------------------------- offers

/** What stands on an offer's banner: its cut-out, its hero, or its icon. */
function offerFigure(id: StoreSkuId): HTMLElement {
  const s = STORE[id];
  const art = s.art !== '' ? spriteUrl(s.art) : null;
  const hero = art === null && s.hero !== null ? spriteUrl(HEROES[s.hero].sprite) : null;
  const url = art ?? hero ?? spriteUrl(s.sprite);
  return url === null ? el('span', { class: 'stx-offer-figure is-empty' }, iconEl(kindIcon(id), { size: 'lg' }))
    // A hero stands taller and narrower than a cut-out: it is drawn larger,
    // rising out of the frame, so it reads as large as one.
    : spriteImgAt(url, `stx-offer-figure${hero !== null ? ' is-hero' : ''}`);
}

function offerBanner(game: Game, card: OfferCard): HTMLElement {
  const tiles = game.offerTiles(card.id).now;
  const shown = tiles.slice(0, tiles.length > 4 ? 3 : 4);
  const more = tiles.length - shown.length;
  const open = (): void => game.openOfferSplash(card.id, true);
  const node = el('article', { class: 'stx-offer' },
    offerFigure(card.id),
    el('div', { class: 'stx-offer-body' },
      el('div', { class: 'stx-offer-name' }, el('span', {}, card.name)),
      el('p', { class: 'stx-offer-pitch' }, card.description),
      el('div', { class: 'stx-offer-tiles' }, ...shown.map(offerTile),
        ...(more > 0 ? [el('span', { class: 'stx-more' }, `+${formatExact(more)}`)] : [])),
      el('div', { class: 'stx-offer-foot' },
        ...(card.closesAt === null ? [] : [el('span', { class: 'stx-timer' }, iconEl('hourglass', { size: 'sm' }), countdown(card.closesAt))]),
        btn({ label: formatUsd(card.priceCents), kind: 'gold', finish: 'gem', onClick: open }))),
    ...(card.valuePercent > 100 ? [el('span', { class: 'stx-seal' }, `${formatExact(card.valuePercent)}%`)] : []));
  node.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    open();
  });
  return node;
}

function dailyCard(game: Game, card: OfferCard): HTMLElement {
  const tiles = game.offerTiles(card.id).now.slice(0, 2);
  return el('article', { class: 'stx-daily' },
    el('b', { class: 'stx-daily-name' }, card.name),
    el('div', { class: 'stx-daily-tiles' }, ...tiles.map(offerTile)),
    btn({
      label: card.left === 0 ? 'Sold out' : formatUsd(card.priceCents),
      kind: 'gold', finish: 'gem',
      onClick: () => game.openIap(card.id, 'store'),
      disabledReason: card.left === 0 ? 'Back tomorrow' : undefined,
    }));
}

function offersTab(game: Game): HTMLElement {
  const offers = game.offerCards();
  const daily = game.dailyCards();
  return el('div', { class: 'stx-list' },
    ...offers.map((c) => offerBanner(game, c)),
    ...(daily.cards.length === 0 ? [] : [
      ribbon('Today', el('span', { class: 'stx-timer' }, iconEl('hourglass', { size: 'sm' }), countdown(daily.resetsAt))),
      el('div', { class: 'stx-dailies' }, ...daily.cards.map((c) => dailyCard(game, c))),
    ]));
}

// --------------------------------------------------------------- supplies

function bundleCard(game: Game, b: ReturnType<Game['itemBundleOffers']>[number]): HTMLElement {
  const url = spriteUrl(b.sprite);
  return el('article', { class: 'stx-card' },
    el('b', { class: 'stx-card-name' }, b.name),
    url === null ? el('span', { class: 'stx-card-art is-empty' }, iconEl('bag', { size: 'lg' })) : spriteImgAt(url, 'stx-card-art'),
    el('div', { class: 'stx-card-lines' }, ...b.lines.map((l) => el('span', {}, l))),
    btn({ label: formatUsd(b.priceCents), kind: 'gold', finish: 'gem', onClick: () => game.openIap(b.id, 'store') }));
}

/** A slot for good, sold for Gems: its picture, how many are open, its
 *  price — or, at the ceiling, that the crew is whole. */
function crewCard(
  game: Game, name: string, art: HTMLElement, line: string, full: boolean, cost: number, buy: () => void,
): HTMLElement {
  return el('article', { class: 'stx-wide is-crew' },
    el('span', { class: 'stx-wide-art is-icon' }, art),
    el('div', {}, el('b', {}, name), el('span', {}, line)),
    full
      ? el('span', { class: 'stx-owned' }, iconEl('tick', { size: 'sm' }), 'All open')
      : btn({ label: 'Hire', kind: 'gem', onClick: buy, cost: { Gems: cost }, have: (c) => game.walletValue(c) }));
}

function suppliesTab(game: Game): HTMLElement {
  const bundles = game.doorOpen('bag') ? game.itemBundleOffers() : [];
  const frag = game.fragmentPackOffer();
  const builder = game.builderOffer();
  const explorer = game.explorerOffer();
  const slot = game.heroSlotOffer();
  return el('div', { class: 'stx-list' },
    ...(bundles.length === 0 ? [] : [ribbon('For the Bag'), el('div', { class: 'stx-grid' }, ...bundles.map((b) => bundleCard(game, b)))]),
    ...(!frag.available ? [] : [
      ribbon('Relics'),
      el('article', { class: 'stx-wide', 'data-coach': 'store-fragments' },
        el('span', { class: 'store-art is-fragments stx-wide-art', role: 'img', 'aria-label': 'relic fragments' }),
        el('div', {}, el('b', {}, `Relic fragments ×${formatExact(frag.size)}`),
          el('span', {}, 'Of the relics you have found, at random.')),
        btn({ label: 'Buy', kind: 'gem', onClick: () => game.doBuyFragmentPack(), cost: { Gems: frag.gems }, have: (c) => game.walletValue(c) })),
    ]),
    ribbon('Crew'),
    el('div', { class: 'stx-list is-tight' },
      crewCard(game, 'Another builder', iconEl('build', { size: 'lg' }),
        `${formatExact(builder.builders)} of ${formatExact(KINGDOM_DEF.maxBuilders)} hired`,
        builder.builders >= builder.ceiling, builder.cost, () => game.doBuyBuilder({ closeSheet: false })),
      ...(explorer.slots === 0 ? [] : [crewCard(game, 'Another explorer', iconEl('compass', { size: 'lg' }),
        `${formatExact(explorer.bought)} of ${formatExact(explorer.forSale)} bought`,
        explorer.bought >= explorer.forSale, explorer.cost, () => game.doBuyExplorer())]),
      ...(!game.doorOpen('heroes') ? [] : [crewCard(game, 'Another hero slot', iconEl('helmet', { size: 'lg' }),
        `${formatExact(slot.slots)} of ${formatExact(slot.ceiling)} open`,
        slot.slots >= slot.ceiling, slot.cost, () => game.doBuyHeroSlot())])));
}

// ------------------------------------------------------------------- gems

function gemsTab(game: Game): HTMLElement {
  return el('div', { class: 'stx-list' },
    ribbon('Gem packs'),
    el('div', { class: 'stx-grid is-three' }, ...GEM_PACK_ORDER.map((id) => {
      const sku = STORE[id];
      const url = spriteUrl(sku.sprite);
      const pack = el('article', { class: 'stx-card is-gems' },
        el('b', { class: 'stx-card-name' }, formatExact(sku.gems), currencyIcon('Gems', { size: 'sm' })),
        url === null ? el('span', { class: 'stx-card-art is-empty' }, currencyIcon('Gems', { size: 'lg' })) : spriteImgAt(url, 'stx-card-art'),
        btn({ label: formatUsd(Math.round(sku.priceUsd * 100)), kind: 'gold', finish: 'gem', onClick: () => game.openIap(id, 'store') }));
      pack.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        game.openIap(id, 'store');
      });
      return pack;
    })));
}

// ------------------------------------------------------------------ screen

export function renderStoreSheet(game: Game): HTMLElement {
  const { tabs, open } = game.storeTabs();
  const page = open === 'offers' ? offersTab(game)
    : open === 'heroes' ? heroesTab(game)
      : open === 'supplies' ? suppliesTab(game)
        : gemsTab(game);
  const close = closeKnob(() => game.dismiss(), 'Close the store');
  const body = el('div', { class: 'stx' },
    el('header', { class: 'stx-head' }, tabStrip(game, tabs, open), close),
    el('div', { class: 'stx-page', 'data-keep-scroll': `store-${open}` }, page));
  tickCountdowns(game);
  const screen = sheet({ title: 'Store', onClose: () => game.dismiss(), tall: true, bare: true }, body);
  screen.classList.add('is-store');
  return screen;
}
