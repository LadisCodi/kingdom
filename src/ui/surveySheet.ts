// The Survey: one ladder over the whole province, climbed by the cells the
// player reveals (Docs/features/25-the-survey.md §6), drawn from
// Docs/art/ui/mockups/m62-royal-survey.png.
//
// A FULL-SCREEN LEDGER (survey.css): the title band with its compass, the
// province's count on a strip of surveyor's map, the two column heads, the
// ladder — a rope threading one wax seal a level, the free tile left of it and
// the paid tile right — and the grand prize pinned at the foot. Only the
// ladder scrolls. There is no clock: the Survey never resets.

import { tr } from '../i18n/tr';
import type { Game } from '../game';
import type { CurrencyId, ItemId, Wallet } from '../sim/state';
import type { ItemStock } from '../sim/rewards';
import { itemIcon } from './itemArt';
import { el, formatCount, formatUsd } from './format';
import { btn, ctaBadge, currencyIcon, iconEl, progress } from './kit';
import { sheet } from './kit/surface';

type Track = 'free' | 'paid';
type Cell = { reward: Wallet; items: ItemStock; fragments: number; claimed: boolean; claimable: boolean; locked?: boolean };

/** A wax seal with a number pressed into it (assets/seal-*.png): blue where
 *  the player is, gold reached, green taken, cream ahead. */
export const surveySeal = (state: 'active' | 'reached' | 'done' | 'ahead', n: number, big = false): HTMLElement =>
  el('span', { class: `rs-seal is-${state}${big ? ' is-big' : ''}` }, el('b', {}, formatCount(n)));

/** What one tile pays: each coin at the header coin's size with its amount,
 *  then the pack, if any. The data puts at most two on a level. */
function prizes(reward: Wallet, fragments: number, items: ItemStock): HTMLElement[] {
  const out = (Object.entries(reward) as Array<[CurrencyId, number]>)
    .filter(([, n]) => n > 0)
    .map(([c, n]) => el('span', { class: 'rs-prize' }, currencyIcon(c), el('b', {}, formatCount(n))));
  // Items — the keys — land in the Bag, and wear its pictures.
  for (const [id, n] of Object.entries(items) as Array<[ItemId, number]>) {
    if (n > 0) out.push(el('span', { class: 'rs-prize' }, iconEl(itemIcon(id)), el('b', {}, formatCount(n))));
  }
  if (fragments > 0) out.push(el('span', { class: 'rs-prize' }, iconEl('shard'), el('b', {}, formatCount(fragments))));
  return out;
}

export function renderSurveySheet(game: Game): HTMLElement {
  const s = game.surveyScreen();
  const close = () => game.setOverlay(null);
  const price = formatUsd(Math.round(s.priceUsd * 100));
  const top = s.length;

  // ---- the province, on its strip of map: the level you are on, the bar to
  // the next, and the next — or, at the top, the whole province.
  const from = s.level === 0 ? 0 : s.ladder[s.level - 1].cells;
  const bar = progress('gold');
  if (s.nextAt === null) bar.set(1, formatCount(s.revealed));
  else bar.set((s.revealed - from) / Math.max(1, s.nextAt - from), `${formatCount(s.revealed)} / ${formatCount(s.nextAt)}`);
  const band = el('div', { class: 'rs-band' },
    el('div', { class: 'rs-band-row' },
      surveySeal('active', s.level, true),
      bar.root,
      s.nextAt === null ? surveySeal('done', top, true) : surveySeal('ahead', s.level + 1, true)),
    el('p', { class: 'rs-band-line' }, tr('{n} of {total} cells won back', { n: formatCount(s.revealed), total: formatCount(s.total) })));

  // ---- the column heads. The paid one carries the purchase: one verb, the
  // price on its face (Docs/art/ui-menus-redesign.md §6.4, §6.9).
  const paidHead = el('div', { class: 'rs-plank is-gold' },
    iconEl(s.owned ? 'tick' : 'padlock', { size: 'sm' }),
    el('span', { class: 'rs-plank-title' }, tr('Royal Survey')));
  if (!s.owned) {
    const buy = btn({ label: tr('Buy'), kind: 'primary', onClick: () => game.doBuySurvey() });
    buy.classList.add('rs-buy');
    buy.setAttribute('aria-label', tr('Unlock the Royal Survey for {price}', { price }));
    buy.append(el('span', { class: 'rs-price' }, price));
    paidHead.append(buy);
  }
  const heads = el('div', { class: 'rs-heads' },
    el('div', { class: 'rs-plank' }, el('span', { class: 'rs-plank-title' }, tr('Free'))),
    paidHead);

  // A tile is a <button> exactly when it can be taken.
  const tile = (track: Track, level: number, c: Cell, reached: boolean): HTMLElement => {
    const state = c.claimed ? ' is-taken'
      : c.claimable ? ' is-ready'
        : !reached ? ' is-ahead' : '';
    const classes = `rs-tile is-${track}${state}${c.locked && !c.claimed ? ' is-locked' : ''}`;
    const marks = c.claimed ? [el('span', { class: 'rs-mark' }, iconEl('tick'))]
      : c.locked ? [el('span', { class: 'rs-mark' }, iconEl('padlock', { size: 'sm' }))] : [];
    const face = el('span', { class: 'rs-tile-face' }, ...prizes(c.reward, c.fragments, c.items));
    if (!c.claimable) return el('div', { class: classes }, face, ...marks);
    const b = el('button', { class: classes, type: 'button', 'aria-label': tr('Claim level {n}', { n: level }) },
      face, ctaBadge(1, `survey:${track}:${level}`));
    b.addEventListener('click', () => game.doClaimSurveyCell(level, track));
    return b;
  };

  /** A level's seal: green once nothing on it waits, gold while something
   *  does, cream ahead. */
  const sealFor = (r: (typeof s.ladder)[number]): HTMLElement => {
    if (!r.reached) return surveySeal('ahead', r.level);
    const waiting = r.free.claimable || r.paid.claimable;
    return surveySeal(waiting ? 'reached' : 'done', r.level);
  };

  const ladder = el('div', { class: 'rs-ladder', 'data-keep-scroll': 'survey-ladder' },
    ...s.ladder.filter((r) => r.level < top).map((r) =>
      el('div', { class: `rs-row${r.level === s.level ? ' is-here' : ''}` },
        tile('free', r.level, r.free, r.reached),
        el('div', { class: 'rs-spine' }, sealFor(r)),
        tile('paid', r.level, r.paid, r.reached))));

  // ---- the grand prize, pinned under the ladder: the province bought out.
  const g = s.ladder[top - 1];
  const grand = el('div', { class: `rs-grand${g.reached ? ' is-reached' : ''}` },
    el('div', { class: 'rs-grand-ribbon' }, tr('Level {n}', { n: formatCount(top) })),
    el('div', { class: 'rs-grand-chest', 'aria-hidden': 'true' }),
    tile('free', top, g.free, g.reached),
    tile('paid', top, g.paid, g.reached));

  const body = el('div', { class: 'rs' }, band, heads, ladder, grand);
  const surface = sheet({ title: tr('The Royal Survey'), onClose: close, tall: true }, body);
  surface.classList.add('is-survey');
  // The compass is set into the title band's left end.
  surface.querySelector('.k-head')?.prepend(el('div', { class: 'rs-compass', 'aria-hidden': 'true' }));
  return surface;
}
