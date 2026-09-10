// The store (Docs/features/14-monetization.md §2, §3): three surfaces, and
// nothing on any of them that a real store would not show.
//
//   * Heroes — the banner itself, first. A call for aid is a purchase, so the
//     gacha is pulled from HERE; the Reliquary's heroes tab keeps the roster
//     and points this way.
//   * Builders — priced in Gems, the same purchase the refused-build offer
//     raises (builderSheet.ts). Here it is the surface the player is SENT to
//     rather than the one they stumble into, and the two answer different
//     questions, which is why both exist.
//   * Gems — the real-money SKUs, last: six packs on a 3×2 grid of upright
//     cards (count, art, price). A tap opens the confirmation sheet, which is
//     where the price meets the monthly budget; nothing is granted from here.
//
// THE STORE DOES NOT KNOW IT IS SIMULATED. No budget line, no SIMULADO mark,
// no price greyed out because the allowance is short: a playtester browsing
// here sees exactly what a paying player would, and only learns about the
// budget when they go to pay (iapSheet.ts). That is what keeps the intent
// signal honest — the store measures desire, the confirmation measures it
// against a wallet.

import type { Game } from '../game';
import { GEM_PACK_ORDER, KINGDOM_DEF, STORE } from '../sim/data/definitions';
import { formatUsd } from '../sim/store';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import { bannerPanel } from './bannerPanel';
import { BANNERS, BANNER_ORDER } from '../sim/data/definitions';
import { el } from './format';
import { btn, card, currencyIcon, iconEl, sheet } from './kit';

export function renderStoreSheet(game: Game): HTMLElement {
  const close = () => game.dismiss();

  // ---- builders
  const offer = game.builderOffer();
  const atCeiling = offer.builders >= offer.ceiling;
  const builders = card({
    icon: 'builders',
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
      icon: offer.key,
      name: offer.key === 'GoldKey' ? 'A gold key' : 'A silver key',
      desc: `One call on ${def.name.toLowerCase()}. You hold ${offer.held}.`,
    }, btn({
      label: 'Buy',
      kind: 'gem',
      onClick: () => game.doBuyKeys(banner),
      cost: { Gems: offer.cost },
      have: (c) => game.walletValue(c),
    }));
  });

  // ---- gem packs: upright cards, count over art over price
  // GEM_PACK_ORDER, not every SKU: the Royal chest is a Store row because the
  // budget has to see it, but it is sold on the daily chest where the ladder
  // beside it explains the price (Docs/features/12-quests.md §3.3).
  const packs = GEM_PACK_ORDER.map((id) => {
    const sku = STORE[id];
    // Each pack has its own art, dropped into render/assets as
    // `<sprite>.png`; until it lands the Gems icon stands in.
    const url = spriteUrl(sku.sprite);
    const art = url
      ? spriteImgAt(url, 'store-pack-art')
      : el('span', { class: 'store-pack-art is-fallback' }, currencyIcon('Gems', { size: 'lg' }));
    const pack = el('div', { class: 'store-pack' },
      el('div', { class: 'store-pack-count' }, `${sku.gems} gems`),
      art,
      btn({
        label: formatUsd(Math.round(sku.priceUsd * 100)),
        kind: 'primary',
        onClick: () => game.openIap(id),
      }));
    // The whole card is the target; the button is where the eye lands.
    pack.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      game.openIap(id);
    });
    return pack;
  });

  const body = el('div', { class: 'store' },
    el('div', { class: 'store-section' }, el('span', {}, 'Heroes')),
    bannerPanel(game),
    el('div', { class: 'store-section' },
      el('span', {}, 'Keys'),
      el('span', { class: 'store-balance' }, currencyIcon('Gems', { size: 'sm' }),
        String(game.walletValue('Gems')))),
    ...keys,
    el('div', { class: 'store-section' },
      el('span', {}, 'Builders'),
      el('span', { class: 'store-balance' }, currencyIcon('Gems', { size: 'sm' }),
        String(game.walletValue('Gems')))),
    builders,
    el('div', { class: 'store-section' }, el('span', {}, 'Gems')),
    el('div', { class: 'store-packs' }, ...packs),
  );

  return sheet({ title: 'Store', onClose: close }, body);
}
