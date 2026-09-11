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
//
// TWO buttons, side by side: the ×1 slot and the ten. The ×1 slot is ONE
// button wearing whichever of three faces is true — a call, a free call, or
// an ad that pays for one — rather than a free row that appears above the
// pair and shoves it down the card every five minutes.

import { BANNERS, BANNER_ORDER, type BannerId } from '../sim/data/definitions';
import type { Game } from '../game';
import {
  heroChanceAt, pityCount, pullsToGuarantee, pullsToLegendary,
} from '../sim/heroes';
import { el, formatDuration } from './format';
import { btn } from './kit';

export function bannerPanel(game: Game): HTMLElement {
  return el('div', { class: 'store-banners' },
    ...BANNER_ORDER.map((id) => oneBanner(game, id)));
}

function oneBanner(game: Game, banner: BannerId): HTMLElement {
  const def = BANNERS[banner];
  const pity = pityCount(game.state, banner);
  const chance = heroChanceAt(pity, banner);
  const toGuarantee = pullsToGuarantee(game.state, banner);
  const toLegendary = pullsToLegendary(game.state, banner);

  const lines: HTMLElement[] = [
    el('div', { class: 'ban-line' },
      el('span', {}, 'Chance of a hero right now'),
      el('b', {}, `${Math.round(chance * 100)}%`)),
    el('div', { class: toLegendary === null ? 'ban-line is-total' : 'ban-line' },
      el('span', {}, 'A hero guaranteed within'),
      el('b', {}, `${toGuarantee} call${toGuarantee === 1 ? '' : 's'}`)),
  ];
  // Only the golden call has a Legendary to guarantee, so the basic one shows
  // two lines rather than a third reading "never".
  if (toLegendary !== null) {
    lines.push(el('div', { class: 'ban-line is-total' },
      el('span', {}, 'A legend guaranteed within'),
      el('b', {}, `${toLegendary} call${toLegendary === 1 ? '' : 's'}`)));
  }

  return el('div', { class: `store-banner is-${banner}` },
    // The key is a painted piece (S1), not the 64px coin from the atlas.
    el('div', { class: 'store-banner-art' },
      el('span', { class: `store-art is-${def.key}`, role: 'img', 'aria-label': def.key })),
    el('div', { class: 'store-banner-head' },
      el('div', { class: 'store-banner-title' }, def.name),
      el('div', { class: 'store-banner-hint' }, hint(banner))),
    el('div', { class: 'ban-breakdown' }, ...lines),
    el('div', { class: 'store-banner-calls' },
      callSlot(game, banner),
      tenCall(game, banner)),
    el('div', { class: 'ban-note' }, keyNote(game, banner)),
  );
}

const hint = (banner: BannerId): string => (banner === 'advanced'
  ? 'The only call a legend answers. Every miss still pays fragments.'
  : 'Every miss still pays fragments. There are no wasted calls.');

/** What the player holds, where more comes from, and how much of today's
 *  free allowance is left — the one line that ties the banner back to the
 *  store card that sells its key. */
function keyNote(game: Game, banner: BannerId): string {
  const def = BANNERS[banner];
  const held = game.walletValue(def.key);
  const name = def.key === 'GoldKey' ? 'gold keys' : 'silver keys';
  const left = def.freePerDay > 0 ? game.freePull(banner).left : 0;
  const free = left > 0 ? ` ${left} free call${left === 1 ? '' : 's'} left today.` : '';
  return `You hold ${held} ${name}. More are ${def.keyGemCost} Gems each.${free}`;
}

/**
 * The ×1 slot — one button that is whichever of three things is true.
 *
 * A free call and a paid one are the same press to the player, so they are
 * the same button rather than a second row that appears and disappears and
 * shoves the ten around. In order:
 *
 *   1. the call costs nothing (the first one on the basic banner) → **Free**
 *   2. an ad will pay for it                                      → **▶ Free**
 *   3. neither                                                    → **Call ×1**
 *
 * 1 beats 2 deliberately: a call that is already free must never ask for an
 * ad. When the press is not free, the button says when it next will be —
 * a button that is merely not free teaches the player nothing about why.
 */
function callSlot(game: Game, banner: BannerId): HTMLElement {
  const def = BANNERS[banner];
  const price = game.pullPrice(banner);
  const free = def.freePerDay > 0 ? game.freePull(banner) : null;

  let b: HTMLElement;
  if (price.amount === 0) {
    b = btn({ label: 'Free', kind: 'gem', onClick: () => game.doPull(banner) });
  } else if (free !== null && free.ready) {
    b = btn({
      label: 'Free',
      icon: 'video',
      kind: 'gem',
      onClick: () => game.startFreePullWatch(banner),
    });
  } else {
    b = btn({
      label: 'Call ×1',
      kind: 'gem',
      note: free === null ? undefined : free.left > 0
        // The countdown is the whole point of showing a dead free button:
        // it is short (five minutes) and the player will wait it out.
        ? `Free in ${formatDuration(Math.max(0, free.readyAt - game.now()) / 1000)}`
        // Spent for the day. The hours to midnight are not a countdown
        // anybody watches, so it says the day instead of the clock.
        : 'Free tomorrow',
      onClick: () => game.doPull(banner),
      cost: { [price.currency]: price.amount },
      have: (c) => game.walletValue(c),
    });
  }
  if (banner === 'basic' && game.uiHint() === 'banner') b.classList.add('hinted');
  return b;
}

/** The ten-call. Always a price: the free first call is free ONCE, so a ten
 *  over it costs nine — the same arithmetic `pullMany` charges. Showing
 *  "free" on the ten would be a lie the purse then contradicts. */
function tenCall(game: Game, banner: BannerId): HTMLElement {
  const price = game.pullPrice(banner);
  const total = price.amount === 0 ? 9 : price.amount * 10;
  return btn({
    label: 'Call ×10',
    kind: 'gem',
    onClick: () => game.doPullMany(banner, 10),
    cost: { [price.currency]: total },
    have: (c) => game.walletValue(c),
  });
}
