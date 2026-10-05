// THE EXCHANGE — precious materials traded between the players of a board
// (Docs/features/19-world-map.md §7.5).
//
// What the player holds, the offers standing (theirs to withdraw, everyone
// else's to take), and an offer to make: what to give, what to want, and how
// many of each. A fair offer — one for one — is taken by a rival after a
// while; the server says so when it is.

import type { Game } from '../../game';
import { getGood } from '../../sim/goods';
import { PRECIOUS, type PreciousId } from '../../sim/state';
import { WORLD_EXCHANGE } from '../../sim/data/definitions';
import type { Lot, OfferView } from '../../worldServer/types';
import { el, formatCount, formatCountdown } from '../format';
import { action, iconEl, sectionHead, sheet, toggleGroup } from '../kit';
import { seatName } from './dispatchSheet';

const AMOUNTS = [5, 10, 20] as const;

/** "10 Starmetal", with its icon. */
const lotEl = (l: Lot): HTMLElement =>
  el('span', { class: 'ex-lot' }, iconEl(l.id, { size: 'sm' }), `${formatCount(l.amount)} ${l.id}`);

function offerRow(game: Game, o: OfferView): HTMLElement {
  const left = formatCountdown(Math.max(0, o.expiresAt - game.now()) / 1000);
  const whose = o.mine ? 'You give' : `${seatName(game, o.seat).replace(/'s$/, '')} gives`;
  const info = el('span', { class: 'ex-offer' }, `${whose} `, lotEl(o.give), ' for ', lotEl(o.want), ` · ${left}`);
  if (o.mine) {
    return action({ label: 'Withdraw', kind: 'secondary', info, onClick: () => void game.doWithdrawOffer(o.id) });
  }
  const short = getGood(game.state.city.goods, o.want.id) < o.want.amount;
  return action({
    label: 'Take', kind: 'primary', info,
    disabledReason: short ? `Not enough ${o.want.id}` : undefined,
    onClick: () => void game.doTakeOffer(o.id),
  });
}

export function renderExchangeSheet(game: Game): HTMLElement {
  const goods = game.state.city.goods;
  const own = game.worldSource().board().materials[game.worldSeat()];
  const offers = game.worldView?.offers ?? [];
  const d = game.exchangeDraft;
  const set = (patch: Partial<typeof d>): void => {
    const next = { ...d, ...patch };
    // What is wanted is never what is given.
    if (next.want === next.give) next.want = PRECIOUS.find((p) => p !== next.give)!;
    game.exchangeDraft = next;
    game.notify();
  };

  const held = el('div', { class: 'ex-held' }, ...PRECIOUS.map((id) => el('span', { class: 'ex-lot' },
    iconEl(id, { size: 'md' }), `${formatCount(getGood(goods, id))}${id === own ? ' · yours' : ''}`)));

  /** One row of choices, every button sharing it. */
  const row = (g: HTMLElement): HTMLElement => {
    g.classList.add('ex-pick');
    return g;
  };
  const pick = (selected: PreciousId, onSelect: (id: PreciousId) => void, except?: PreciousId) =>
    row(toggleGroup(PRECIOUS.filter((p) => p !== except).map((p) => ({ label: p, value: p })), selected, onSelect));
  const count = (selected: number, onSelect: (n: number) => void) =>
    row(toggleGroup(AMOUNTS.map((n) => ({ label: formatCount(n), value: n as number })), selected, onSelect));

  const mine = offers.filter((o) => o.mine).length;
  const fair = d.giveN === d.wantN;
  const post = action({
    label: 'Offer', kind: 'primary',
    info: fair ? 'One for one: a rival who yields it takes it in a while' : 'Uneven: it waits for a player',
    disabledReason: getGood(goods, d.give) < d.giveN ? `Not enough ${d.give}`
      : mine >= WORLD_EXCHANGE.maxOffers ? 'You have as many offers up as you may' : undefined,
    onClick: () => void game.doPostOffer(),
  });

  const theirs = offers.filter((o) => !o.mine);
  const body = el('div', { class: 'wd-body' },
    held,
    sectionHead('Offers'),
    ...(offers.length === 0 ? [el('p', { class: 'wd-line' }, 'Nobody has an offer up.')] : [
      ...offers.filter((o) => o.mine).map((o) => offerRow(game, o)),
      ...theirs.map((o) => offerRow(game, o)),
    ]),
    sectionHead('Make an offer'),
    el('p', { class: 'wd-where' }, 'Give'), pick(d.give, (give) => set({ give })), count(d.giveN, (giveN) => set({ giveN })),
    el('p', { class: 'wd-where' }, 'For'), pick(d.want, (want) => set({ want }), d.give), count(d.wantN, (wantN) => set({ wantN })),
    post,
  );
  return sheet({ title: 'The Exchange', onClose: () => game.dismiss() }, body);
}
