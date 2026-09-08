// The hero banners — the gacha, drawn on the store (Docs/features/14-monetization.md
// §2.1) until the Tavern lands and takes the whole panel with it.
//
// TWO banners since 2026-09-08, one per key: the common call spends a silver
// key and hands out Commons and Rares; the golden call spends a gold key and
// is the only door to a Legendary. They are drawn as two of the same card
// rather than as a tab strip, because the choice between them is a price
// comparison and a player should be able to make it without switching screens.
//
// The pity counters are ALWAYS visible. A hidden pity counter is the same as
// no pity counter — it is the single thing that makes a gacha read as fair
// rather than predatory, and it only works if the player can see it working.

import { BANNERS, BANNER_ORDER, type BannerId } from '../sim/data/definitions';
import type { Game } from '../game';
import {
  heroChanceAt, pityCount, pullsToGuarantee, pullsToLegendary,
} from '../sim/heroes';
import { el } from './format';
import { action, iconEl } from './kit';

export function bannerPanel(game: Game): HTMLElement {
  return el('div', { class: 'store-banners' },
    ...BANNER_ORDER.map((id) => oneBanner(game, id)));
}

function oneBanner(game: Game, banner: BannerId): HTMLElement {
  const def = BANNERS[banner];
  const price = game.pullPrice(banner);
  const pity = pityCount(game.state, banner);
  const chance = heroChanceAt(pity, banner);
  const toGuarantee = pullsToGuarantee(game.state, banner);
  const toLegendary = pullsToLegendary(game.state, banner);

  const lines: HTMLElement[] = [
    el('div', { class: 'rel-line' },
      el('span', {}, 'Chance of a hero right now'),
      el('b', {}, `${Math.round(chance * 100)}%`)),
    el('div', { class: toLegendary === null ? 'rel-line is-total' : 'rel-line' },
      el('span', {}, 'A hero guaranteed within'),
      el('b', {}, `${toGuarantee} call${toGuarantee === 1 ? '' : 's'}`)),
  ];
  // Only the golden call has a Legendary to guarantee, so the basic one shows
  // two lines rather than a third reading "never".
  if (toLegendary !== null) {
    lines.push(el('div', { class: 'rel-line is-total' },
      el('span', {}, 'A legend guaranteed within'),
      el('b', {}, `${toLegendary} call${toLegendary === 1 ? '' : 's'}`)));
  }

  return el('div', { class: `store-banner is-${banner}` },
    el('div', { class: 'store-banner-head' },
      iconEl(def.key, { size: 'lg' }),
      el('div', {},
        el('div', { class: 'store-banner-title' }, def.name),
        el('div', { class: 'store-banner-hint' }, hint(banner)))),
    el('div', { class: 'rel-breakdown' }, ...lines),
    el('div', { class: 'store-banner-calls' },
      callAction(game, banner, price, 1),
      callAction(game, banner, price, 10)),
    el('div', { class: 'rel-note' }, keyNote(game, banner)),
  );
}

const hint = (banner: BannerId): string => (banner === 'advanced'
  ? 'The only call a legend answers. Every miss still pays fragments.'
  : 'Every miss still pays fragments. There are no wasted calls.');

/** What the player holds, and where more comes from — the one line that ties
 *  the banner back to the store card that sells its key. */
function keyNote(game: Game, banner: BannerId): string {
  const def = BANNERS[banner];
  const held = game.walletValue(def.key);
  const name = def.key === 'GoldKey' ? 'gold keys' : 'silver keys';
  return `You hold ${held} ${name}. More are ${def.keyGemCost} Gems each, `
    + 'or watch for the free call.';
}

/** A summon button, split out so the quest hint can light it — `action()`
 *  builds a whole row, so the class goes on afterwards rather than through a
 *  new option nothing else would use. */
function callAction(
  game: Game, banner: BannerId, price: { currency: string; amount: number }, times: number,
): HTMLElement {
  const total = price.amount * times;
  const row = action({
    // A price of zero is not a price. The free first call says so on the
    // button rather than rendering "0 🔑", which reads as a bug.
    label: total === 0 ? 'Call — free' : times === 1 ? 'Call' : 'Call ×10',
    kind: 'gem',
    onClick: () => (times === 1 ? game.doPull(banner) : game.doPullMany(banner, times)),
    cost: total === 0 ? undefined : { [price.currency]: total },
    have: (c) => game.walletValue(c),
  });
  if (times === 1 && banner === 'basic' && game.uiHint() === 'banner') row.classList.add('hinted');
  return row;
}
