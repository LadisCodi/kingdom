// The store (Docs/features/14-monetization.md §2, §3), top to bottom:
//
//   * Offers — the packs with a window (sim/offers.ts): each with its value,
//     its countdown and what is left of it. Then today's daily offers.
//   * Heroes — the banner itself. A call for aid is a purchase, so the
//     gacha is pulled from HERE.
//   * For the Bag — the item bundles, always on sale.
//   * Relics, Keys — Gem-priced, the shapes the store shows without owning.
//   * Crew — the slots for good, in Gems: a builder (the purchase the
//     refused-build offer raises), an explorer, a hero slot.
//   * Gems — the real-money packs, last: a 3×2 grid of upright cards.
//
// Every price in dollars opens the confirmation sheet; nothing is granted
// from here. A layout stand-in: the store's redesign (Kingshot's one tab an
// offer) comes once every offer kind is in.
//
// THE STORE DOES NOT KNOW IT IS SIMULATED. No budget line, no SIMULADO mark,
// no price greyed out because the allowance is short: a playtester browsing
// here sees exactly what a paying player would, and only learns about the
// budget when they go to pay (iapSheet.ts). That is what keeps the intent
// signal honest — the store measures desire, the confirmation measures it
// against a wallet.

import type { Game, OfferCard } from '../game';
import { GEM_PACK_ORDER, KINGDOM_DEF, STORE } from '../sim/data/definitions';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { bannerPanel } from './bannerPanel';
import { BANNERS, BANNER_ORDER } from '../sim/data/definitions';
import { el, formatCountdown, formatExact, formatUsd } from './format';
import { btn, card, currencyIcon, iconEl, sheet } from './kit';

/** One offer: its art, what it holds line by line, its value, how long it
 *  lasts and how many are left, and its price. */
function offerRow(game: Game, offer: OfferCard): HTMLElement {
  const url = spriteUrl(offer.sprite);
  const art = url
    ? spriteImgAt(url, 'store-pack-row-art')
    : el('span', { class: 'store-pack-row-art is-fallback' }, iconEl('chest', { size: 'lg' }));
  const now = game.now();
  const meta = [
    ...(offer.closesAt === null ? [] : [el('span', { class: 'store-offer-timer' }, iconEl('hourglass', { size: 'sm' }),
      formatCountdown(Math.max(0, Math.ceil((offer.closesAt - now) / 1000))))]),
    ...(offer.left === null ? [] : [el('span', { class: 'store-offer-left' }, `Left: ${formatExact(offer.left)}`)]),
  ];
  const row = el('div', { class: `store-offer${STORE[offer.id].splash ? ' is-splash' : ''}` },
    card({ art, name: offer.name, desc: offer.description },
      el('div', { class: 'store-bundle-lines' },
        ...(offer.gems > 0 ? [el('div', { class: 'store-bundle-line' },
          currencyIcon('Gems', { size: 'sm' }), el('span', {}, `${formatExact(offer.gems)} Gems`))] : []),
        ...offer.lines.map((line) => el('div', { class: 'store-bundle-line' },
          iconEl('tick', { size: 'sm' }), el('span', {}, line)))),
      el('div', { class: 'store-price-col' },
        ...(meta.length === 0 ? [] : [el('div', { class: 'store-offer-meta' }, ...meta)]),
        btn({
          label: offer.left === 0 ? 'Sold out' : formatUsd(offer.priceCents),
          kind: 'primary',
          finish: 'gem',
          onClick: () => game.openIap(offer.id),
          disabledReason: offer.left === 0 ? 'Back tomorrow' : undefined,
        }))),
    // The value is a wax seal pressed on the card's corner.
    offer.valuePercent > 100
      ? el('span', { class: 'store-value', 'aria-label': `${formatExact(offer.valuePercent)}% value` },
        `${formatExact(offer.valuePercent)}%`)
      : '');
  // An offer opens its own screen from its row — its splash, or its tab in
  // the Offers screen; the price still buys.
  if (STORE[offer.id].shelf === 'offer') {
    row.classList.add('is-splash');
    row.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      if (STORE[offer.id].splash) game.openOfferSplash(offer.id);
      else game.openOffers(offer.id);
    });
  }
  return row;
}

export function renderStoreSheet(game: Game): HTMLElement {
  const close = () => game.dismiss();

  // ---- builders
  const offer = game.builderOffer();
  const atCeiling = offer.builders >= offer.ceiling;
  const builders = card({
    art: el('span', { class: 'store-art is-hammer', role: 'img', 'aria-label': 'builders' }),
    name: 'Another builder',
    desc: atCeiling
      ? `${offer.ceiling} is as large as a crew gets.`
      : `Build two things at once. ${offer.builders} of ${KINGDOM_DEF.maxBuilders} hired.`,
  }, atCeiling
    ? el('span', { class: 'store-owned' }, iconEl('tick', { size: 'sm' }), 'Full crew')
    : btn({
        label: 'Hire',
        kind: 'gem',
        onClick: () => game.doBuyBuilder({ closeSheet: false }),
        cost: { Gems: offer.cost },
        have: (c) => game.walletValue(c),
      }));

  // ---- keys: one card per banner. A Gem-priced non-SKU, the shape the
  // second builder already uses — the store shows it without owning it.
  const keys = BANNER_ORDER.map((banner) => {
    const offer = game.keyOffer(banner);
    const def = BANNERS[banner];
    return card({
      art: el('span', { class: `store-art is-${offer.key}`, role: 'img', 'aria-label': String(offer.key) }),
      name: offer.key === 'GoldKey' ? 'A gold key' : 'A silver key',
      desc: `One call on ${def.name.toLowerCase()}. You hold ${formatExact(offer.held)}.`,
    }, btn({
      label: 'Buy',
      kind: 'gem',
      onClick: () => game.doBuyKeys(banner),
      cost: { Gems: offer.cost },
      have: (c) => game.walletValue(c),
    }));
  });

  // ---- relic fragments: a Gem-priced pack of random fragments of the
  // relics already met (sim/relics.ts `openFragmentPack`).
  const frag = game.fragmentPackOffer();
  const fragments = !frag.available ? null : card({
    art: el('span', { class: 'store-art is-fragments', role: 'img', 'aria-label': 'relic fragments' }),
    name: 'Relic fragments',
    desc: `${formatExact(frag.size)} fragments of the relics you have found, at random.`,
  }, btn({
    label: 'Buy',
    kind: 'gem',
    onClick: () => game.doBuyFragmentPack(),
    cost: { Gems: frag.gems },
    have: (c) => game.walletValue(c),
  }));

  // ---- the Bag's bundles: a row each, what lands in the Bag
  // listed, and the speed-ups' Gem worth at the rush price — what the shelf
  // exists to compare.
  const itemBundles = game.itemBundleOffers().map((bundle) => {
    const url = spriteUrl(bundle.sprite);
    const art = url
      ? spriteImgAt(url, 'store-pack-row-art')
      : el('span', { class: 'store-pack-row-art is-fallback' }, iconEl('bag', { size: 'lg' }));
    return card({
      art,
      name: bundle.name,
      desc: bundle.gemValue > 0
        ? `${formatExact(bundle.gemValue)} gems' worth of time, at the Finish price`
        : 'Into the Bag, to open when you need it',
    },
      el('div', { class: 'store-bundle-lines' },
        ...bundle.lines.map((line) => el('div', { class: 'store-bundle-line' },
          iconEl('tick', { size: 'sm' }), el('span', {}, line)))),
      btn({
        label: formatUsd(bundle.priceCents),
        kind: 'primary',
        finish: 'gem',
        onClick: () => game.openIap(bundle.id),
      }));
  });

  // ---- gem packs: upright cards, count over art over price
  // GEM_PACK_ORDER, not every SKU: the Survey is a Store row because the
  // budget has to see it, but it is sold on the Survey where the ladder beside
  // it explains the price (Docs/features/25-the-survey.md §6).
  const packs = GEM_PACK_ORDER.map((id) => {
    const sku = STORE[id];
    // Each pack has its own art, dropped into render/assets as
    // `<sprite>.png`; until it lands the Gems icon stands in.
    const url = spriteUrl(sku.sprite);
    const art = url
      ? spriteImgAt(url, 'store-pack-art')
      : el('span', { class: 'store-pack-art is-fallback' }, currencyIcon('Gems', { size: 'lg' }));
    // Art over count over price, as M5 stacks it.
    const pack = el('div', { class: 'store-pack' },
      art,
      el('div', { class: 'store-pack-count' }, `${formatExact(sku.gems)} gems`),
      btn({
        label: formatUsd(Math.round(sku.priceUsd * 100)),
        kind: 'primary',
        finish: 'gem',
        onClick: () => game.openIap(id),
      }));
    // The whole card is the target; the button is where the eye lands.
    pack.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      game.openIap(id);
    });
    return pack;
  });

  // ---- offers, and today's
  const offers = game.offerCards().map((o) => offerRow(game, o));
  const daily = game.dailyCards();
  const dailyRows = daily.cards.map((o) => offerRow(game, o));

  // ---- the crew's other slots, for Gems
  const explorer = game.explorerOffer();
  const explorerCard = explorer.slots === 0 ? null : card({
    art: iconEl('compass', { size: 'lg' }),
    name: 'Another explorer',
    desc: explorer.bought >= explorer.forSale
      ? 'Every explorer for sale is yours.'
      : `Explore with one more at once. ${formatExact(explorer.slots)} out at once now.`,
  }, explorer.bought >= explorer.forSale
    ? el('span', { class: 'store-owned' }, iconEl('tick', { size: 'sm' }), 'All hired')
    : btn({
        label: 'Hire', kind: 'gem', onClick: () => game.doBuyExplorer(),
        cost: { Gems: explorer.cost }, have: (c) => game.walletValue(c),
      }));
  const slot = game.heroSlotOffer();
  const heroSlotCard = !game.doorOpen('heroes') ? null : card({
    art: iconEl('helmet', { size: 'lg', label: 'hero slot' }),
    name: 'Another hero slot',
    desc: slot.slots >= slot.ceiling
      ? `${formatExact(slot.ceiling)} heroes is the whole board.`
      : `One more hero in every party. ${formatExact(slot.slots)} of ${formatExact(slot.ceiling)} open.`,
  }, slot.slots >= slot.ceiling
    ? el('span', { class: 'store-owned' }, iconEl('tick', { size: 'sm' }), 'All open')
    : btn({
        label: 'Open', kind: 'gem', onClick: () => game.doBuyHeroSlot(),
        cost: { Gems: slot.cost }, have: (c) => game.walletValue(c),
      }));

  const body = el('div', { class: 'store' },
    ...(offers.length === 0 ? [] : [el('div', { class: 'store-section' }, el('span', {}, 'Offers')), ...offers]),
    ...(dailyRows.length === 0 ? [] : [
      el('div', { class: 'store-section' }, el('span', {}, 'Today'),
        el('span', { class: 'store-balance' }, iconEl('hourglass', { size: 'sm' }),
          formatCountdown(Math.max(0, Math.ceil((daily.resetsAt - game.now()) / 1000))))),
      ...dailyRows,
    ]),
    el('div', { class: 'store-section' }, el('span', {}, 'Heroes')),
    // The banner hangs in the Tavern; until one stands, its place in the
    // store is padlocked (Docs/features/22-progression.md §3).
    game.doorOpen('banner') ? bannerPanel(game)
      : el('div', { class: 'store-banner-locked' }, iconEl('padlock'),
        el('span', {}, 'Build a Tavern to call heroes.')),
    // The Bag's own shelf, once the Bag is open.
    ...(itemBundles.length === 0 || !game.doorOpen('bag') ? [] : [
      el('div', { class: 'store-section' }, el('span', {}, 'For the Bag')),
      ...itemBundles,
    ]),
    ...(fragments === null ? [] : [
      el('div', { class: 'store-section', 'data-coach': 'store-fragments' },
        el('span', {}, 'Relics'),
        el('span', { class: 'store-balance' }, currencyIcon('Gems', { size: 'sm' }),
          formatExact(game.walletValue('Gems')))),
      fragments,
    ]),
    el('div', { class: 'store-section' },
      el('span', {}, 'Keys'),
      el('span', { class: 'store-balance' }, currencyIcon('Gems', { size: 'sm' }),
        formatExact(game.walletValue('Gems')))),
    ...keys,
    el('div', { class: 'store-section' },
      el('span', {}, 'Crew'),
      el('span', { class: 'store-balance' }, currencyIcon('Gems', { size: 'sm' }),
        formatExact(game.walletValue('Gems')))),
    builders,
    ...(explorerCard === null ? [] : [explorerCard]),
    ...(heroSlotCard === null ? [] : [heroSlotCard]),
    el('div', { class: 'store-section' }, el('span', {}, 'Gems')),
    el('div', { class: 'store-packs' }, ...packs),
  );

  return sheet({ title: 'Store', onClose: close }, body);
}
